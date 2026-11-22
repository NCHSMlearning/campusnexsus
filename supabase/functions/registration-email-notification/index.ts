import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const BREVO_API_KEY = (Deno.env.get("BREVO_API_KEY") || "").trim();
const BREVO_SENDER_EMAIL = (Deno.env.get("BREVO_SENDER_EMAIL") || "").trim();

const isSecureOrigin = (origin: string) => {
  try {
    const parsed = new URL(origin);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch { return false; }
};
const corsHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});
const json = (body: unknown, status: number, origin: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
);
const validEmail = (value: unknown): value is string =>
  typeof value === "string" && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);

async function sendBrevo(to: string, subject: string, htmlContent: string, replyTo?: string) {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "Campus Nexus", email: BREVO_SENDER_EMAIL },
      to: [{ email: to }],
      ...(replyTo ? { replyTo: { email: replyTo } } : {}),
      subject,
      htmlContent,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Brevo delivery failed:", response.status, JSON.stringify(payload).slice(0, 500));
    throw new Error("Brevo could not accept a registration notification.");
  }
  return payload?.messageId || null;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (!isSecureOrigin(origin)) return new Response("Secure origin required", { status: 403 });
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405, origin);

  try {
    if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Supabase server credentials are unavailable.");
    if (!BREVO_API_KEY || !validEmail(BREVO_SENDER_EMAIL)) {
      console.error("Registration email function is missing BREVO_API_KEY or a valid BREVO_SENDER_EMAIL.");
      return json({ success: false, error: "Registration email service is not configured." }, 503, origin);
    }

    const body = await req.json().catch(() => ({}));
    const userId = String(body?.user_id || "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
      return json({ success: false, error: "A valid registration account is required." }, 400, origin);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authResult, error: authError } = await admin.auth.admin.getUserById(userId);
    const authUser = authResult?.user;
    if (authError || !authUser || authUser.user_metadata?.registration_source !== "campus_nexus_school_registration") {
      return json({ success: false, error: "Registration account could not be verified." }, 403, origin);
    }

    const createdAt = new Date(authUser.created_at).getTime();
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > 30 * 60 * 1000 || createdAt > Date.now() + 60_000) {
      return json({ success: false, error: "Registration notification window has expired." }, 403, origin);
    }
    if (!validEmail(authUser.email)) return json({ success: false, error: "Registered email address is invalid." }, 400, origin);

    const appMetadata = authUser.app_metadata || {};
    if (appMetadata.registration_brevo_notified_at) {
      return json({
        success: true,
        alreadySent: true,
        applicantEmailSent: true,
        institutionEmailSent: Boolean(appMetadata.registration_brevo_institution_sent),
      }, 200, origin);
    }

    let profile: Record<string, unknown> | null = null;
    let profileError: unknown = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const result = await admin.from("consolidated_user_profiles_table")
        .select("user_id,email,full_name,role,status,student_id,admission_number,staff_id,program,department,intake_year,intake_month,current_block,institution_id,created_at")
        .eq("user_id", userId)
        .maybeSingle();
      profile = result.data as Record<string, unknown> | null;
      profileError = result.error;
      if (profile || profileError) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (profileError || !profile) {
      console.error("Registration profile lookup failed:", profileError);
      return json({ success: false, error: "Registration profile is not ready yet. Please retry shortly." }, 409, origin);
    }

    const role = String(profile.role || authUser.user_metadata?.role || "").toLowerCase();
    const status = String(profile.status || "").toLowerCase();
    if (!["student", "lecturer"].includes(role) || status !== "pending" || !profile.institution_id) {
      return json({ success: false, error: "This account is not an eligible pending institution registration." }, 403, origin);
    }

    const { data: institution, error: institutionError } = await admin.from("institutions")
      .select("id,name,admin_email,contact_email,school_code,portal_domain,administrator_portal_url")
      .eq("id", String(profile.institution_id))
      .maybeSingle();
    if (institutionError || !institution) {
      console.error("Registration institution lookup failed:", institutionError?.message);
      return json({ success: false, error: "The institution linked to this registration could not be verified." }, 409, origin);
    }

    const requestHost = new URL(origin).hostname.toLowerCase();
    let institutionPortalHost = "";
    try {
      const configuredHost = String(institution.portal_domain || "").trim();
      if (configuredHost) {
        const portalUrl = configuredHost.startsWith("http://") || configuredHost.startsWith("https://")
          ? configuredHost : "https://" + configuredHost;
        institutionPortalHost = new URL(portalUrl).hostname.toLowerCase();
      }
    } catch { institutionPortalHost = ""; }
    const isCampusNexusHost = ["campusnexus.co.ke", "www.campusnexus.co.ke"].includes(requestHost);
    if (!isCampusNexusHost && (!institutionPortalHost || requestHost !== institutionPortalHost)) {
      return json({ success: false, error: "Registration origin does not match the institution portal." }, 403, origin);
    }

    const applicantEmail = authUser.email.toLowerCase();
    const applicantName = String(profile.full_name || authUser.user_metadata?.full_name || applicantEmail).slice(0, 120);
    const institutionName = String(institution.name || "Your institution").slice(0, 160);
    const adminEmail = [institution.admin_email, institution.contact_email]
      .map(value => String(value || "").trim().toLowerCase())
      .find(validEmail) || "";
    const reviewUrl = "https://campusnexus.co.ke/platform/login";
    const programOrDepartment = role === "student"
      ? String(profile.program || authUser.user_metadata?.program || "Not provided")
      : String(profile.department || authUser.user_metadata?.department || "Not provided");
    const identifier = String(profile.admission_number || profile.student_id || profile.staff_id || authUser.user_metadata?.student_id || "Pending assignment");

    const applicantHtml = `
      <div style="margin:0;padding:32px 12px;background:#f3f7fb;font-family:Arial,sans-serif;color:#17324d">
        <div style="max-width:620px;margin:auto;overflow:hidden;border:1px solid #e1eaf1;border-radius:18px;background:#fff">
          <div style="padding:26px 30px;background:linear-gradient(120deg,#0b2945,#087f79);color:#fff">
            <div style="font-size:11px;font-weight:bold;letter-spacing:2px;color:#a7f3e8">CAMPUS NEXUS</div>
            <h1 style="margin:12px 0 5px;font-size:24px">Registration received</h1>
            <p style="margin:0;color:#d8f3ef;font-size:14px">${esc(institutionName)}</p>
          </div>
          <div style="padding:28px 30px">
            <p style="font-size:15px">Hello ${esc(applicantName)},</p>
            <p style="font-size:14px;line-height:1.7;color:#526579">Your ${esc(role)} registration has been received successfully by ${esc(institutionName)}.</p>
            <div style="margin:20px 0;padding:16px;border:1px solid #dcebe8;border-radius:12px;background:#f2fbf9">
              <strong style="display:block;color:#087b70;margin-bottom:6px">Current account status: Pending approval</strong>
              <span style="font-size:13px;color:#526579">Your institution will review your details. You will be able to access the relevant portal after your account is approved.</span>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <tr><td style="padding:9px;border-bottom:1px solid #edf1f5;color:#718096">Name</td><td style="padding:9px;border-bottom:1px solid #edf1f5;font-weight:bold">${esc(applicantName)}</td></tr>
              <tr><td style="padding:9px;border-bottom:1px solid #edf1f5;color:#718096">Email</td><td style="padding:9px;border-bottom:1px solid #edf1f5">${esc(applicantEmail)}</td></tr>
              <tr><td style="padding:9px;border-bottom:1px solid #edf1f5;color:#718096">${role === "student" ? "Student ID" : "Staff ID"}</td><td style="padding:9px;border-bottom:1px solid #edf1f5">${esc(identifier)}</td></tr>
              <tr><td style="padding:9px;border-bottom:1px solid #edf1f5;color:#718096">${role === "student" ? "Programme" : "Department"}</td><td style="padding:9px;border-bottom:1px solid #edf1f5">${esc(programOrDepartment)}</td></tr>
            </table>
            <p style="margin:22px 0 0;font-size:12px;color:#718096">If email verification is requested on the registration page, please complete that step as well.</p>
          </div>
          <div style="padding:16px 30px;background:#f8fafc;color:#7b8b9a;font-size:11px">Campus Nexus · Secure institution registration</div>
        </div>
      </div>`;

    const adminRows = [
      ["Applicant", applicantName], ["Email", applicantEmail], ["Account type", role],
      [role === "student" ? "Student ID" : "Staff ID", identifier],
      [role === "student" ? "Programme" : "Department", programOrDepartment],
      ["School code", String(institution.school_code || "Not available")],
      ["Account status", "Pending approval"],
    ].map(([label, value]) => `<tr><th align="left" style="padding:10px;border-bottom:1px solid #e8eef3;color:#718096">${esc(label)}</th><td style="padding:10px;border-bottom:1px solid #e8eef3;font-weight:600">${esc(value)}</td></tr>`).join("");
    const adminHtml = `
      <div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#17324d">
        <div style="padding:24px;background:linear-gradient(120deg,#0b2945,#087f79);border-radius:14px 14px 0 0;color:#fff">
          <div style="font-size:11px;letter-spacing:2px;color:#a7f3e8;font-weight:bold">CAMPUS NEXUS · REGISTRATION ALERT</div>
          <h2 style="margin:10px 0 0">New registration awaiting review</h2>
          <p style="margin:7px 0 0;color:#d8f3ef">${esc(institutionName)}</p>
        </div>
        <div style="padding:24px;border:1px solid #e5edf3;border-top:0;border-radius:0 0 14px 14px">
          <p>A new ${esc(role)} account has been submitted and is waiting for institution approval.</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px">${adminRows}</table>
          <p style="margin-top:24px"><a href="${reviewUrl}" style="display:inline-block;padding:12px 18px;border-radius:9px;background:#0b4562;color:#fff;text-decoration:none;font-weight:bold">Open Institution Admin Portal</a></p>
          <p style="font-size:11px;color:#718096">This is an automated notification. The account remains pending until approved.</p>
        </div>
      </div>`;

    const applicantMessageId = await sendBrevo(
      applicantEmail,
      `Registration received — ${institutionName}`,
      applicantHtml,
    );
    let institutionMessageId: string | null = null;
    if (adminEmail && adminEmail !== applicantEmail) {
      institutionMessageId = await sendBrevo(
        adminEmail,
        `New ${role} registration awaiting approval — ${institutionName}`,
        adminHtml,
        applicantEmail,
      );
    }

    const notifiedAt = new Date().toISOString();
    const { error: metadataError } = await admin.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...appMetadata,
        registration_brevo_notified_at: notifiedAt,
        registration_brevo_institution_sent: Boolean(institutionMessageId),
      },
    });
    if (metadataError) console.error("Could not record registration email idempotency marker:", metadataError.message);

    console.log("Registration emails accepted by Brevo:", {
      userId,
      applicantMessageId,
      institutionMessageId,
      institutionRecipientConfigured: Boolean(adminEmail),
    });
    return json({
      success: true,
      applicantEmailSent: true,
      institutionEmailSent: Boolean(institutionMessageId),
      institutionRecipientConfigured: Boolean(adminEmail),
    }, 200, origin);
  } catch (error) {
    console.error("Registration Brevo notification failed:", error instanceof Error ? error.message : "Unknown error");
    return json({ success: false, error: error instanceof Error ? error.message : "Unable to send registration notifications." }, 500, origin);
  }
});
