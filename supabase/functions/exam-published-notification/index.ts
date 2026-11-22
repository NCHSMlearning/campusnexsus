import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL=Deno.env.get("SUPABASE_URL")||"",SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const BREVO=(Deno.env.get("BREVO_API_KEY")||"").trim(),SENDER=(Deno.env.get("BREVO_SENDER_EMAIL")||"").trim();
const headers=(o:string)=>({"Access-Control-Allow-Origin":o,"Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"});
const out=(v:unknown,s:number,o:string)=>new Response(JSON.stringify(v),{status:s,headers:{...headers(o),"Content-Type":"application/json"}});
const esc=(v:unknown)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const valid=(v:unknown):v is string=>typeof v==="string"&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v);
async function send(to:string,subject:string,htmlContent:string,textContent:string){const r=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":BREVO,"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({sender:{name:"Campus Nexus",email:SENDER},to:[{email:to}],subject,htmlContent,textContent})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error("Brevo rejected an exam notification: "+r.status);return d?.messageId||null;}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get("origin")||"https://campusnexus.co.ke";
 if(req.method==="OPTIONS")return new Response("ok",{headers:headers(origin)});
 if(req.method!=="POST")return out({success:false,error:"Method not allowed"},405,origin);
 try{
  if(!SUPABASE_URL||!SERVICE||!BREVO||!valid(SENDER))throw new Error("Exam notification service is not configured.");
  const token=req.headers.get("Authorization")||"";if(!token.startsWith("Bearer "))return out({success:false,error:"Authentication required."},401,origin);
  const admin=createClient(SUPABASE_URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
  const caller=createClient(SUPABASE_URL,Deno.env.get("SUPABASE_ANON_KEY")||"",{global:{headers:{Authorization:token}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:callerData,error:callerError}=await caller.auth.getUser();if(callerError||!callerData.user)return out({success:false,error:"Session could not be verified."},401,origin);
  const {data:isSuper}=await caller.rpc("is_current_user_superadmin");
  const body=await req.json().catch(()=>({}));const examId=Number(body?.exam_id);
  if(!Number.isInteger(examId)||examId<=0)return out({success:false,error:"A valid examination is required."},400,origin);
  const {data:exam,error:examError}=await admin.from("exams").select("id,institution_id,title,exam_name,exam_type,program_type,target_program,block,block_term,intake_year,exam_date,start_time,exam_start_time,duration_minutes,instructions,exam_link,online_link,is_published,status,approval_status").eq("id",examId).maybeSingle();
  if(examError||!exam)return out({success:false,error:"Examination not found."},404,origin);
  if(exam.is_published!==true||String(exam.status||"").toLowerCase()!=="published"||String(exam.approval_status||"").toLowerCase()!=="approved")return out({success:false,error:"Only approved and published examinations can be announced."},409,origin);
  if(isSuper!==true){const {data:membership}=await admin.from("institution_users").select("id").eq("user_id",callerData.user.id).eq("institution_id",exam.institution_id).eq("role","institution_admin").eq("status","active").maybeSingle();if(!membership)return out({success:false,error:"Active institution administrator access is required."},403,origin);}
  const {data:inst,error:instError}=await admin.from("institutions").select("name,logo_url,portal_domain,custom_login_url").eq("id",exam.institution_id).maybeSingle();
  if(instError||!inst)return out({success:false,error:"Institution details unavailable."},409,origin);
  const program=String(exam.program_type||exam.target_program||"").trim(),block=String(exam.block_term||exam.block||"").trim();
  let query=admin.from("consolidated_user_profiles_table").select("user_id,email,full_name,program,block,intake_year").eq("institution_id",exam.institution_id).eq("role","student").in("status",["approved","active"]);
  if(program)query=query.eq("program",program);
  if(block)query=query.eq("block",block);
  if(exam.intake_year)query=query.eq("intake_year",String(exam.intake_year));
  const {data:students,error:studentsError}=await query.limit(5000);
  if(studentsError)throw new Error("Could not load eligible students: "+studentsError.message);
  let portal="https://campusnexus.co.ke/studentexam";
  const candidate=String(exam.exam_link||exam.online_link||"").trim();
  if(candidate){try{const u=new URL(candidate,portal);if(["https:","http:"].includes(u.protocol))portal=u.href;}catch{}}
  else {const login=String(inst.custom_login_url||"").trim(),domain=String(inst.portal_domain||"").trim();const candidatePortal=login||(domain?(domain.startsWith("https://")?domain:"https://"+domain):"");if(candidatePortal){try{const u=new URL(candidatePortal);if(u.protocol==="https:")portal=u.href.replace(/\/$/,"")+"/studentexam";}catch{}}}
  const title=String(exam.title||exam.exam_name||"Scheduled examination"),institution=String(inst.name||"Your institution");
  const date=String(exam.exam_date||"To be confirmed"),time=String(exam.start_time||exam.exam_start_time||"See portal");
  let sent=0,skipped=0,failed=0;
  for(const student of students||[]){
   if(!valid(student.email)){skipped++;continue;}
   const {data:userResult}=await admin.auth.admin.getUserById(student.user_id);
   const authUser=userResult?.user;if(!authUser){skipped++;continue;}
   const metadata=authUser.app_metadata||{},key="exam_notice_"+examId;
   if(metadata[key]){skipped++;continue;}
   const studentName=String(student.full_name||"Student");
   const subject="Examination scheduled: "+title;
   const html=`<div style="margin:0;padding:32px 12px;background:#eef3f8;font-family:Arial,sans-serif;color:#17324d"><div style="max-width:620px;margin:auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #e0e9ef"><div style="padding:28px 30px;background:linear-gradient(120deg,#092b49,#087f79);color:#fff"><div style="font-size:11px;letter-spacing:2px;color:#b7f2e8;font-weight:bold">CAMPUS NEXUS · EXAMINATION NOTICE</div><h1 style="font-size:24px;margin:12px 0 6px">Your examination is scheduled</h1><p style="margin:0;color:#d9f4ef">${esc(institution)}</p></div><div style="padding:28px 30px"><p>Hello <strong>${esc(studentName)}</strong>,</p><p style="font-size:14px;line-height:1.7;color:#526579">An examination has been scheduled for your programme. Please review the details below and make the necessary preparations.</p><div style="padding:18px;background:#f2faf8;border:1px solid #d8eee8;border-radius:12px"><h2 style="font-size:18px;margin:0 0 14px;color:#0b4357">${esc(title)}</h2><table style="width:100%;font-size:13px;border-collapse:collapse"><tr><td style="padding:7px;color:#718096">Type</td><td style="padding:7px;font-weight:bold">${esc(exam.exam_type||"Assessment")}</td></tr><tr><td style="padding:7px;color:#718096">Date</td><td style="padding:7px;font-weight:bold">${esc(date)}</td></tr><tr><td style="padding:7px;color:#718096">Start time</td><td style="padding:7px;font-weight:bold">${esc(time)}</td></tr><tr><td style="padding:7px;color:#718096">Duration</td><td style="padding:7px;font-weight:bold">${esc(exam.duration_minutes||"—")} minutes</td></tr><tr><td style="padding:7px;color:#718096">Programme / Block</td><td style="padding:7px;font-weight:bold">${esc(program||"—")} / ${esc(block||"—")}</td></tr></table></div><p style="font-size:13px;line-height:1.7;color:#526579">${esc(exam.instructions||"Please sign in before the examination and follow all instructions displayed in the examination portal.")}</p><div style="text-align:center;margin:26px 0"><a href="${esc(portal)}" style="display:inline-block;padding:15px 26px;background:#0b3b59;color:#fff;border-radius:10px;text-decoration:none;font-weight:bold">Open Examination Portal →</a></div><p style="font-size:11px;color:#8291a0">Sign in using your registered student account. If the examination is not yet open, return to the portal at the scheduled start time.</p></div><div style="padding:16px 30px;background:#f8fafc;color:#8291a0;font-size:11px;text-align:center">Campus Nexus · Secure examination management</div></div></div>`;
   const plain=`Hello ${studentName}. ${title} at ${institution} is scheduled for ${date} at ${time}. Duration: ${exam.duration_minutes||"—"} minutes. Open the examination portal: ${portal}`;
   try{const messageId=await send(student.email,subject,html,plain);const acceptedAt=new Date().toISOString();const {error:markError}=await admin.auth.admin.updateUserById(student.user_id,{app_metadata:{...metadata,[key]:acceptedAt}});if(markError)console.error("Exam email marker failed",student.user_id,markError.message);const {error:logError}=await admin.from("notification_delivery_logs").upsert({institution_id:exam.institution_id,recipient_user_id:student.user_id,recipient_email:student.email,notification_type:"exam_published",entity_type:"exam",entity_id:String(examId),delivery_status:"accepted",provider:"brevo",provider_message_id:messageId,attempted_at:acceptedAt,accepted_at:acceptedAt,error_message:null},{onConflict:"notification_type,entity_type,entity_id,recipient_user_id"});if(logError)console.error("Exam notification log failed",student.user_id,logError.message);console.log("Exam notice accepted",examId,student.user_id,messageId);sent++;}
   catch(e){console.error("Exam email failed",examId,student.user_id,e);const {error:logError}=await admin.from("notification_delivery_logs").upsert({institution_id:exam.institution_id,recipient_user_id:student.user_id,recipient_email:student.email,notification_type:"exam_published",entity_type:"exam",entity_id:String(examId),delivery_status:"failed",provider:"brevo",error_message:String(e?.message||e).slice(0,500),attempted_at:new Date().toISOString()},{onConflict:"notification_type,entity_type,entity_id,recipient_user_id"});if(logError)console.error("Failed exam notification log could not be saved",logError.message);failed++;}
  }
  return out({success:true,exam_id:examId,eligible:(students||[]).length,sent,skipped,failed},200,origin);
 }catch(e){console.error("Exam notification error",e);return out({success:false,error:e instanceof Error?e.message:"Unable to send exam notifications."},500,origin);}
});