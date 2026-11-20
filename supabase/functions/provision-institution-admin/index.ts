import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = {"Access-Control-Allow-Origin":"https://campusnexus.co.ke","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({success:false,error:"Method not allowed"},405);
 const authorization=req.headers.get("Authorization")||"";
 if(!authorization.startsWith("Bearer "))return json({success:false,error:"Authentication required"},401);
 try{
  const caller=createClient(URL,ANON,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
  const {data:authData,error:authError}=await caller.auth.getUser(authorization.slice(7));
  if(authError||!authData.user)return json({success:false,error:"Your session could not be verified"},401);
  const {data:allowed,error:roleError}=await caller.rpc("is_current_user_superadmin");
  if(roleError||allowed!==true)return json({success:false,error:"Only the Platform Super Admin can provision institution administrators"},403);
  const body=await req.json(),institutionId=String(body?.institution_id||"").trim(),email=String(body?.email||"").trim().toLowerCase(),fullName=String(body?.full_name||"").trim().replace(/\\s+/g," ").slice(0,120),phone=String(body?.phone||"").trim().slice(0,30);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(institutionId)||!/^[^\\s@<>]+@[^\\s@<>]+\\.[^\\s@<>]+$/.test(email)||fullName.length<2)return json({success:false,error:"A valid institution, administrator name and email are required"},400);
  const admin=createClient(URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:institution,error:institutionError}=await admin.from("institutions").select("id,name,admin_email,school_code").eq("id",institutionId).single();
  if(institutionError||!institution)return json({success:false,error:"Institution not found"},404);
  if(String(institution.admin_email||"").trim().toLowerCase()!==email)return json({success:false,error:"Administrator email does not match the institution record"},409);
  const {data:existingProfile}=await admin.from("consolidated_user_profiles_table").select("user_id,role,institution_id").eq("email",email).maybeSingle();
  if(existingProfile){
   if(existingProfile.role==="institution_admin"&&existingProfile.institution_id===institutionId)return json({success:true,already_provisioned:true,email,message:"Administrator account is already linked to this institution."});
   return json({success:false,error:"This email already belongs to a Campus Nexus account. Use the existing-account assignment workflow instead of creating a duplicate."},409);
  }
  const {data:activeAdmins}=await admin.from("institution_users").select("user_id").eq("institution_id",institutionId).eq("role","institution_admin").eq("status","active").limit(1);
  if(activeAdmins?.length) return json({success:false,error:"This institution already has an active administrator account. Use the existing administrator reassignment workflow instead of creating a second primary account."},409);
  const {data:invite,error:inviteError}=await admin.auth.admin.inviteUserByEmail(email,{data:{full_name:fullName,phone,role:"institution_admin",institution_id:institutionId,institution_name:institution.name},redirectTo:"https://campusnexus.co.ke/platform/set-password.html?school_code="+encodeURIComponent(institution.school_code||"")});
  if(inviteError||!invite?.user)return json({success:false,error:inviteError?.message||"Supabase could not create the invitation"},400);
  const userId=invite.user.id;
  const {error:profileError}=await admin.from("consolidated_user_profiles_table").upsert({user_id:userId,email,full_name:fullName,phone:phone||null,role:"institution_admin",status:"active",login_enabled:true,institution_id:institutionId,updated_at:new Date().toISOString()},{onConflict:"user_id"});
  if(profileError){await admin.auth.admin.deleteUser(userId);return json({success:false,error:"Auth account was rolled back because the administrator profile could not be saved: "+profileError.message},500);}
  const {error:membershipError}=await admin.from("institution_users").upsert({institution_id:institutionId,user_id:userId,role:"institution_admin",status:"active"},{onConflict:"institution_id,user_id"});
  if(membershipError){await admin.from("consolidated_user_profiles_table").delete().eq("user_id",userId);await admin.auth.admin.deleteUser(userId);return json({success:false,error:"Auth account was rolled back because institution membership could not be saved: "+membershipError.message},500);}
  const {error:linkError}=await admin.from("institutions").update({first_admin_user_id:userId,first_admin_claimed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",institutionId);
  if(linkError){await admin.from("institution_users").delete().eq("institution_id",institutionId).eq("user_id",userId);await admin.from("consolidated_user_profiles_table").delete().eq("user_id",userId);await admin.auth.admin.deleteUser(userId);return json({success:false,error:"Account setup was rolled back because the institution could not be linked: "+linkError.message},500);}
  return json({success:true,user_id:userId,email,role:"institution_admin",invitation_sent:true});
 }catch(error){console.error("Institution administrator provisioning failed:",error instanceof Error?error.message:"Unknown error");return json({success:false,error:error instanceof Error?error.message:"Unable to provision administrator"},500);}
});