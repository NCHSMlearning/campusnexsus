import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const BREVO = (Deno.env.get("BREVO_API_KEY") || "").trim();
const SENDER = (Deno.env.get("BREVO_SENDER_EMAIL") || "").trim();
const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});
const reply = (body: unknown, status: number, origin: string) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]!));
const validEmail = (v: unknown): v is string => typeof v === "string" && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function send(to: string, subject: string, htmlContent: string, textContent: string) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO, "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({
      sender: { name: "Campus Nexus", email: SENDER },
      to: [{ email: to }],
      subject, htmlContent, textContent
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Brevo approval email error", res.status, JSON.stringify(data).slice(0, 400));
    throw new Error("Brevo could not accept the approval email.");
  }
  return data?.messageId || null;
}

let failureStage = "request";

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "https://campusnexus.co.ke";
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return reply({ success:false, error:"Method not allowed" },405,origin);
  try {
    failureStage = "configuration";
    if (!SUPABASE_URL || !SERVICE || !BREVO || !validEmail(SENDER)) throw new Error("Approval email service is not configured.");
    failureStage = "authentication";
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return reply({success:false,error:"Authentication required."},401,origin);
    const admin = createClient(SUPABASE_URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
    const callerClient = createClient(SUPABASE_URL,Deno.env.get("SUPABASE_ANON_KEY") || "",{
      global:{headers:{Authorization:authHeader}},auth:{persistSession:false,autoRefreshToken:false}
    });
    const {data:callerData,error:callerError}=await callerClient.auth.getUser();
    if(callerError || !callerData.user) return reply({success:false,error:"Your session could not be verified."},401,origin);
    const callerId=callerData.user.id;
    const {data:superadmin}=await callerClient.rpc("is_current_user_superadmin");
    const body=await req.json().catch(()=>({}));
    const userId=String(body?.user_id||"").trim();
    if(!uuid.test(userId)) return reply({success:false,error:"A valid approved account is required."},400,origin);

    failureStage = "approved_profile_lookup";
    const {data:profile,error:profileError}=await admin.from("consolidated_user_profiles_table")
      .select("user_id,email,full_name,role,status,login_enabled,student_id,admission_number,staff_id,program,department,intake_year,intake_month,current_block,institution_id")
      .eq("user_id",userId).maybeSingle();
    if(profileError || !profile) return reply({success:false,error:"Approved account could not be found."},404,origin);
    const approvedRole = ["student","lecturer"].includes(String(profile.role||"").trim().toLowerCase());
    const approvedStatus = ["approved","active"].includes(String(profile.status||"").trim().toLowerCase());
    const loginEnabled = profile.login_enabled === true || String(profile.login_enabled).trim().toLowerCase() === "true";
    const hasInstitution = Boolean(profile.institution_id);
    if(!approvedRole || !approvedStatus || !loginEnabled || !hasInstitution) {
      return reply({
        success:false,
        error:"The account is not fully approved or login is not enabled.",
        stage:"approval_state",
        checks:{approvedRole,approvedStatus,loginEnabled,hasInstitution},
        accountStatus:String(profile.status||""),
        accountRole:String(profile.role||"")
      },409,origin);
    }

    // The approval RPC transaction creates/activates institution_users before this
    // function is invoked. The profile's approved + login_enabled state is the
    // authoritative recipient gate; do not block delivery on a stale membership read.
    failureStage = "administrator_authorization";
    if(superadmin!==true) {
      const {data:callerMembership}=await admin.from("institution_users").select("id")
        .eq("user_id",callerId).eq("institution_id",profile.institution_id).eq("role","institution_admin").eq("status","active").maybeSingle();
      if(!callerMembership) return reply({success:false,error:"You are not an active administrator for this institution."},403,origin);
    }

    failureStage = "recipient_lookup";
    const {data:authData,error:authError}=await admin.auth.admin.getUserById(userId);
    const authUser=authData?.user;
    const recipientEmail = validEmail(authUser?.email) ? authUser.email : profile.email;
    if(!validEmail(recipientEmail)) return reply({success:false,error:"The approved account does not have a valid email address.",stage:"recipient_email"},409,origin);
    const metadata=authUser.app_metadata||{};
    if(metadata.registration_approval_email_sent_at) {
      return reply({success:true,alreadySent:true,recipient:recipientEmail},200,origin);
    }
    failureStage = "institution_lookup";
    const {data:inst,error:instError}=await admin.from("institutions")
      .select("name,logo_url,primary_color,portal_domain,custom_login_url,website_url,school_code")
      .eq("id",profile.institution_id).maybeSingle();
    if(instError || !inst) return reply({success:false,error:"Institution details could not be loaded."},409,origin);

    let portalUrl="https://campusnexus.co.ke/platform/login";
    const custom=String(inst.custom_login_url||"").trim();
    const domain=String(inst.portal_domain||"").trim();
    const candidate=custom || (domain ? (domain.startsWith("https://") ? domain : "https://"+domain) : "");
    if(candidate) {
      try { const u=new URL(candidate); if(u.protocol==="https:" && !u.username && !u.password) portalUrl=u.toString(); } catch { /* safe default */ }
    }
    const name=String(profile.full_name||authUser.user_metadata?.full_name||"there").slice(0,120);
    const institution=String(inst.name||"your institution").slice(0,160);
    const role=String(profile.role).toLowerCase();
    const program=role==="student" ? String(profile.program||"Not specified") : String(profile.department||"Not specified");
    const identifier=String(profile.admission_number||profile.student_id||profile.staff_id||"To be assigned");
    const accent=/^#[0-9a-f]{6}$/i.test(String(inst.primary_color||""))?String(inst.primary_color):"#087f79";
    const logo=String(inst.logo_url||"").startsWith("https://")?'<img src="'+esc(inst.logo_url)+'" alt="'+esc(institution)+'" style="max-width:76px;max-height:64px;object-fit:contain;display:block;margin:0 auto 14px">':"";
    const subject="Your account has been approved — "+institution;
    const html=`
      <div style="margin:0;padding:36px 12px;background:#eef3f8;font-family:Arial,Helvetica,sans-serif;color:#152d45">
        <div style="max-width:640px;margin:0 auto;border-radius:22px;overflow:hidden;background:#fff;box-shadow:0 16px 48px rgba(15,41,66,.12)">
          <div style="padding:30px 32px 34px;text-align:center;background:linear-gradient(135deg,#092b49 0%,#0b5364 58%,${esc(accent)} 100%);color:#fff">
            <div style="font-size:11px;letter-spacing:3px;font-weight:700;color:#b8f3e9">CAMPUS NEXUS</div>
            <div style="width:66px;height:66px;line-height:66px;border-radius:50%;margin:20px auto 14px;background:#e5fbf4;color:#087b68;font-size:34px;font-weight:bold">✓</div>
            <div style="font-size:27px;line-height:1.2;font-weight:800">You're officially approved!</div>
            <p style="margin:10px 0 0;color:#d7edf0;font-size:14px">${esc(institution)}</p>
          </div>
          <div style="padding:34px 36px 30px">
            ${logo}
            <p style="font-size:16px;margin:0 0 14px">Hello <strong>${esc(name)}</strong>,</p>
            <p style="font-size:14px;line-height:1.8;color:#526579;margin:0 0 22px">Great news! Your ${esc(role)} account has been reviewed and approved by <strong>${esc(institution)}</strong>. Your account is now active and your portal access has been enabled.</p>
            <div style="padding:20px 22px;border:1px solid #d8eee8;border-radius:15px;background:#f3fbf8;margin:0 0 24px">
              <div style="font-size:11px;letter-spacing:1.5px;font-weight:700;color:#087b68;margin-bottom:12px">YOUR APPROVED ACCOUNT</div>
              <table style="width:100%;border-collapse:collapse;font-size:13px">
                <tr><td style="padding:8px 0;color:#758497;width:38%">Full name</td><td style="padding:8px 0;font-weight:700;color:#18334d">${esc(name)}</td></tr>
                <tr><td style="padding:8px 0;color:#758497">Account type</td><td style="padding:8px 0;font-weight:700;text-transform:capitalize">${esc(role)}</td></tr>
                <tr><td style="padding:8px 0;color:#758497">${role==="student"?"Admission number":"Staff number"}</td><td style="padding:8px 0;font-weight:700">${esc(identifier)}</td></tr>
                <tr><td style="padding:8px 0;color:#758497">${role==="student"?"Programme":"Department"}</td><td style="padding:8px 0;font-weight:700">${esc(program)}</td></tr>
                <tr><td style="padding:8px 0;color:#758497">Institution</td><td style="padding:8px 0;font-weight:700">${esc(institution)}</td></tr>
              </table>
            </div>
            <div style="text-align:center;margin:28px 0 22px">
              <a href="${esc(portalUrl)}" style="display:inline-block;padding:16px 30px;border-radius:11px;background:#0b3b59;color:#fff;text-decoration:none;font-weight:700;font-size:14px">Access Your Portal&nbsp; →</a>
            </div>
            <p style="font-size:12px;line-height:1.7;color:#748397;text-align:center">Use the email address you registered with to sign in. If you have not set a password or cannot sign in, use the password reset option on the login page.</p>
            <div style="border-top:1px solid #edf1f5;margin-top:26px;padding-top:18px;font-size:12px;line-height:1.7;color:#718096">Welcome aboard. We look forward to supporting your learning and professional journey.</div>
          </div>
          <div style="padding:18px 30px;background:#f7f9fb;text-align:center;color:#8a98a8;font-size:11px">Campus Nexus · Secure digital campus platform<br>Automated account notification — please do not reply to this email.</div>
        </div>
      </div>`;
    const textContent=`Hello ${name}, your ${role} account at ${institution} has been approved. Your login access is enabled. Programme/Department: ${program}. Account number: ${identifier}. Access your portal: ${portalUrl}`;
    failureStage = "brevo_delivery";
    const messageId=await send(recipientEmail,subject,html,textContent);
    failureStage = "delivery_record";
    const {error:markError}=authUser ? await admin.auth.admin.updateUserById(userId,{app_metadata:{...metadata,registration_approval_email_sent_at:new Date().toISOString()}}) : {error:new Error("Auth user record unavailable after successful email delivery.")};
    const {error:logError}=await admin.from("notification_delivery_logs").upsert({
      institution_id:profile.institution_id,recipient_user_id:userId,recipient_email:recipientEmail,
      notification_type:"registration_approved",entity_type:"registration",entity_id:userId,
      delivery_status:"accepted",provider:"brevo",provider_message_id:messageId,
      accepted_at:new Date().toISOString(),attempted_at:new Date().toISOString(),error_message:null
    },{onConflict:"notification_type,entity_type,entity_id,recipient_user_id"});
    if(logError) console.error("Approval notification log could not be saved:",logError.message);
    if(markError) console.error("Could not save approval email idempotency marker:",markError.message);
    console.log("Approval email accepted by Brevo",{userId,messageId});
    return reply({success:true,recipient:recipientEmail,messageId},200,origin);
  } catch(error) {
    console.error("Approval email failed:",{stage:failureStage,message:error instanceof Error?error.message:"Unknown error"});
    return reply({success:false,error:error instanceof Error?error.message:"Unable to send approval email.",stage:failureStage},500,origin);
  }
});