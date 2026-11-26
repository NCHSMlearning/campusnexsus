import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://campusnexus.co.ke",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin"
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" }
});
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
async function sha256(value: string) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const origin = req.headers.get("origin");
  if (origin && origin !== "https://campusnexus.co.ke") return json({ error: "Origin not allowed" }, 403);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  if (body.action === "issue") {
    const bearer = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
    if (!bearer) return json({ error: "Student browser session required" }, 401);
    const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error } = await client.auth.getUser(bearer);
    if (error || !user?.id) return json({ error: "Please sign in to the student portal first" }, 401);
    const examId = Number(body.exam_id);
    if (!Number.isSafeInteger(examId) || examId <= 0) return json({ error: "Invalid exam ID" }, 400);
    const [{ data: profile, error: profileError }, { data: exam, error: examError }] = await Promise.all([
      admin.from("consolidated_user_profiles_table").select("user_id,institution_id,role,status,login_enabled").eq("user_id", user.id).maybeSingle(),
      admin.from("exams").select("id,institution_id,status,approval_status").eq("id", examId).maybeSingle()
    ]);
    if (profileError || examError || !profile || !exam ||
        String(profile.role).toLowerCase() !== "student" ||
        !["active", "approved"].includes(String(profile.status).toLowerCase()) ||
        profile.login_enabled === false ||
        String(exam.status).toLowerCase() !== "published" ||
        String(exam.approval_status).toLowerCase() !== "approved" ||
        profile.institution_id !== exam.institution_id) {
      return json({ error: "This examination is not authorised for your active student account and institution." }, 403);
    }
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const random = crypto.getRandomValues(new Uint8Array(12));
    const code = Array.from(random, value => alphabet[value & 31]).join("");
    const { error: insertError } = await admin.rpc("cnseb_create_auth_handoff", {
      p_code_hash: await sha256(code), p_user_id: user.id, p_exam_id: String(examId)
    });
    if (insertError) {
      console.error("CN-SEB handoff issue failed", insertError.message);
      return json({ error: "Could not create secure exam handoff" }, 500);
    }
    return json({ code, expires_in: 60 });
  }

  if (body.action === "redeem") {
    const code = String(body.code || "");
    const installId = String(body.device_install_id || "");
    if (!/^[A-HJ-NP-Z2-9]{12}$/.test(code)) return json({ error: "Invalid or expired activation key" }, 400);
    if (!/^[0-9a-f-]{36}$/i.test(installId)) return json({ error: "Secure device identity is unavailable. Restart the desktop app and launch again." }, 400);
    const { data: rows, error } = await admin.rpc("cnseb_redeem_auth_handoff", { p_code_hash: await sha256(code) });
    const row = Array.isArray(rows) ? rows[0] : null;
    if (error || !row?.user_id || !row?.exam_id) return json({ error: "Handoff expired or already used" }, 401);

    const deviceHash = await sha256(url + ":" + installId);
    const details = body.device_details && typeof body.device_details === "object" ? body.device_details : {};
    const { data: registration, error: registrationError } = await admin.rpc("cnseb_register_device", {
      p_device_hash: deviceHash,
      p_user_id: row.user_id,
      p_exam_id: Number(row.exam_id),
      p_device_name: String(body.device_name || "Windows device").slice(0, 120),
      p_device_details: details,
      p_app_version: String(body.app_version || "").slice(0, 40),
      p_platform: String(body.platform || "win32").slice(0, 40)
    });
    if (registrationError || !registration?.device_registration_id) {
      console.error("CN-SEB device registration failed", registrationError?.message);
      return json({ error: registrationError?.message || "Could not register this computer" }, 403);
    }
    const { data: { user }, error: userError } = await admin.auth.admin.getUserById(row.user_id);
    if (userError || !user?.email || user.banned_until) return json({ error: "Student account unavailable" }, 403);
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: user.email });
    const tokenHash = link?.properties?.hashed_token;
    if (linkError || !tokenHash) return json({ error: "Could not establish secure app session" }, 500);
    return json({
      token_hash: tokenHash, exam_id: String(row.exam_id), type: "magiclink",
      device_registration_id: registration.device_registration_id,
      device_approval_status: registration.approval_status,
      institution_id: registration.institution_id
    });
  }
  return json({ error: "Unsupported action" }, 400);
});
