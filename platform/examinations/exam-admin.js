(() => {
"use strict";
const SUPABASE_URL="https://irahplkvocaakjxuisto.supabase.co";
const SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3aHRqb3pmc21ieWloZW5mdW53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2NTgxMjcsImV4cCI6MjA3NTIzNDEyN30.7Z8AYvPQwTAEEEhODlW6Xk-IR1FK3Uj5ivZS7P17Wpk";
const $=id=>document.getElementById(id);
let sb,authUser,institution=null,profile,exams=[],selectedExamId=null,markStudents=[],markUnits=[],institutionOptions=[],institutionNameMap=new Map(),platformSuperadmin=false,allInstitutionsView=false;
const escapeHTML=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function notice(message,error=false){const el=$("notice");el.textContent=message;el.className="notice"+(error?" error":"");el.hidden=false;window.setTimeout(()=>{el.hidden=true},6000)}
function fail(message){$("bootMessage").textContent=message;$("bootMessage").style.color="#b42318";document.querySelector(".loader").style.display="none"}
function showApp(){ $("bootScreen").hidden=true;$("app").hidden=false }
function withTimeout(promise,label,ms=15000){
  let timer;
  return Promise.race([Promise.resolve(promise),new Promise((_,reject)=>{timer=window.setTimeout(()=>reject(new Error(label+" timed out. Check your connection and reload the page.")),ms)})]).finally(()=>window.clearTimeout(timer));
}
async function boot(){
  if(!window.supabase?.createClient) throw new Error("Authentication service is unavailable. Refresh and try again.");
  $("bootMessage").textContent="Checking your secure sign-in…";
  sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:"campus-nexus-exam-auth"}});
  const sessionResult=await withTimeout(sb.auth.getSession(),"Secure sign-in check");
  const session=sessionResult?.data?.session,sessionError=sessionResult?.error;
  if(sessionError) throw sessionError;
  if(!session?.user){window.location.replace("/login?redirect=%2Fadminexams%2F");return}
  authUser=session.user;
  $("bootMessage").textContent="Checking your institution access…";
  const [memberResult,superResult,profileResult]=await withTimeout(Promise.all([
    sb.from("institution_users").select("institution_id,role,status").eq("user_id",authUser.id).eq("role","institution_admin").eq("status","active"),
    sb.rpc("is_current_user_superadmin"),
    sb.from("consolidated_user_profiles_table").select("user_id,full_name,email,role,status,program,institution_id").eq("user_id",authUser.id).maybeSingle()
  ]),"Institution access check");
  const memberships=memberResult.data||[];
  const prof=profileResult.data||{};
  const profileRole=String(prof.role||"").toLowerCase().trim().replace(/-/g,"_");
  const profileStatus=String(prof.status||"").toLowerCase();
  platformSuperadmin=!superResult.error && superResult.data===true;
  if(platformSuperadmin){
    const result=await withTimeout(sb.from("institutions").select("id,name,logo_url,primary_color,school_code,physical_address,postal_address").order("name"),"Institution list");
    if(result.error) throw result.error;
    institutionOptions=result.data||[];
  }else{
    // Membership rows are authoritative. Legacy institution-admin profiles are accepted only
    // when the profile itself is active/approved and contains a concrete institution_id.
    let ids=[...new Set(memberships.map(m=>m.institution_id).filter(Boolean))];
    if(!ids.length && profileRole==="institution_admin" && ["active","approved"].includes(profileStatus) && prof.institution_id){ids=[prof.institution_id];}
    if(!ids.length){if(memberResult.error) throw memberResult.error;throw new Error("This account does not have an active institution administrator assignment. Ask the Campus Nexus platform administrator to assign your institution.");}
    const result=await withTimeout(sb.from("institutions").select("id,name,logo_url,primary_color,school_code,physical_address,postal_address").in("id",ids).order("name"),"Institution details");
    if(result.error) throw result.error;
    institutionOptions=result.data||[];
  }
  if(!institutionOptions.length) throw new Error("No institutions are available to this account. Verify the institution assignment and access permissions.");
  institutionNameMap=new Map(institutionOptions.map(x=>[String(x.id),x.name||"Institution"]));
  const params=new URLSearchParams(window.location.search);
  const requestedId=params.get("institution_id");
  allInstitutionsView=platformSuperadmin && (!requestedId || requestedId==="all");
  institution=allInstitutionsView?null:(institutionOptions.find(i=>i.id===requestedId)||institutionOptions[0]);
  if(platformSuperadmin || institutionOptions.length>1){
    $("institutionSwitcherWrap").hidden=false;
    $("institutionSwitcher").innerHTML=(platformSuperadmin?'<option value="all">All institutions — system-wide</option>':"")+institutionOptions.map(i=>'<option value="'+escapeHTML(i.id)+'">'+escapeHTML(i.name)+'</option>').join("");
    $("institutionSwitcher").value=allInstitutionsView?"all":institution.id;
    $("institutionSwitcher").addEventListener("change",()=>{const url=new URL(window.location.href);const value=$("institutionSwitcher").value;if(value==="all")url.searchParams.set("institution_id","all");else url.searchParams.set("institution_id",value);window.location.href=url.toString()});
  }
  $("bootMessage").textContent=allInstitutionsView?"Loading system-wide examination workspace…":"Loading your institution workspace…";
  await withTimeout(applyInstitutionBranding(),"Institution module verification");
  profile=prof;
  $("userName").textContent=(profile.full_name||authUser.email||"Administrator")+(platformSuperadmin?" · Superadmin":"");
  if(allInstitutionsView){$("institutionName").textContent="All institutions";$("markProgram").value="Select an institution";$("markBlock").placeholder="Choose an institution first";}
  else $("markProgram").value=profile.program||"";
  showApp();if(new URLSearchParams(window.location.search).get("view")==="approvals")switchView("approvals");$("markYear").value=new Date().getFullYear();
  if(institution) await loadExamFormOptions(); else { $("examProgram").innerHTML='<option value="">Select an institution from the filter first</option>'; $("examProgram").disabled=true; $("examBlock").innerHTML='<option value="">Select an institution first</option>'; $("newExamBtn").title="Choose a specific institution before creating an examination"; }
  refreshAll().catch(error=>notice("Some examination data could not be loaded: "+(error.message||"Unknown error"),true));
  Promise.all([withTimeout(loadMarkStudents(),"Student list"),withTimeout(loadMarkUnits(),"Unit list")]).catch(error=>notice("Marks-entry lists could not be loaded: "+(error.message||"Unknown error"),true));
}
async function loadExamFormOptions(){
 const programSelect=$("examProgram"),yearSelect=$("examIntake"),blockSelect=$("examBlock");
 programSelect.innerHTML='<option value="">Loading institution programmes…</option>';
 try{
  const {data,error}=await sb.rpc("get_public_institution_programs",{p_institution_id:institution.id});
  if(error)throw error;
  const programs=(data||[]).filter(p=>p.program_code&&p.program_name);
  programSelect.innerHTML='<option value="">Select programme</option>'+programs.map(p=>'<option value="'+escapeHTML(p.program_code)+'">'+escapeHTML(p.program_name)+' · '+escapeHTML(p.program_code)+'</option>').join("");
  if(!programs.length)programSelect.innerHTML='<option value="">No programmes configured</option>';
 }catch(error){programSelect.innerHTML='<option value="">Unable to load programmes</option>';notice("Could not load institution programmes: "+error.message,true);}
 const currentYear=new Date().getFullYear();
 let years=[];
 try{
  const {data,error}=await sb.from("consolidated_user_profiles_table").select("intake_year").eq("institution_id",institution.id).not("intake_year","is",null).limit(3000);
  if(error)throw error;
  years=[...new Set((data||[]).map(x=>Number(x.intake_year)).filter(y=>Number.isInteger(y)&&y>=2000&&y<=2100))].sort((a,b)=>b-a);
 }catch(error){console.warn("Could not load intake years",error);}
 if(!years.length)years=[currentYear+2,currentYear+1,currentYear,currentYear-1,currentYear-2];
 yearSelect.innerHTML='<option value="">Select intake year</option>'+years.map(y=>'<option value="'+y+'">'+y+'</option>').join("");
 yearSelect.value=String(years.includes(currentYear)?currentYear:years[0]);
 blockSelect.innerHTML='<option value="">Select programme first</option>';
 programSelect.addEventListener("change",()=>loadInstitutionBlocks(programSelect.value));
}
async function loadInstitutionBlocks(programCode){
 const select=$("examBlock");
 select.disabled=true;
 select.innerHTML='<option value="">Loading programme blocks…</option>';
 if(!programCode){select.innerHTML='<option value="">Select programme first</option>';select.disabled=false;return;}
 try{
  // Keep the query institution-scoped, then match the catalogue's possible programme
  // identifiers client-side. Older DCHN catalogue rows may store the programme name
  // rather than its code, and some legacy rows do not use status="active".
  const {data,error}=await sb.from("units_catalog").select("*").eq("institution_id",institution.id).limit(5000);
  if(error)throw error;
  const norm=v=>String(v??"").trim().toLowerCase().replace(/[\s_-]+/g,"");
  const selected=(Array.from($("examProgram").selectedOptions||[])[0]?.textContent||"").split(" · ")[0].trim();
  const rows=(data||[]).filter(row=>{
   const candidates=[row.program,row.program_code,row.program_name,row.target_program,row.course_program,row.programme,row.programme_code,row.programme_name].filter(Boolean).map(norm);
   const matches=candidates.includes(norm(programCode))||(selected&&candidates.includes(norm(selected)));
   const status=norm(row.status);
   return matches&&(!status||["active","approved","published"].includes(status));
  });
  const blocks=[...new Set(rows.map(row=>row.block??row.block_name??row.block_number??row.block_term??row.term??row.semester).map(v=>String(v??"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  select.innerHTML='<option value="">Select block</option>'+blocks.map(b=>'<option value="'+escapeHTML(b)+'">'+escapeHTML(b)+'</option>').join("");
  if(!blocks.length)select.innerHTML='<option value="">No blocks found — check the programme unit catalogue</option>';
 }catch(error){
  select.innerHTML='<option value="">Blocks could not be loaded</option>';
  notice("Could not load blocks for this programme: "+(error.message||"Unknown error"),true);
 }finally{select.disabled=false;}
}
async function applyInstitutionBranding(){
  if(allInstitutionsView){$("institutionName").textContent="All institutions";$("institutionLogo").textContent="CN";document.documentElement.style.setProperty("--navy","#0b3553");$("newExamBtn").disabled=true;$("listCreateBtn").disabled=true;$("quickCreate").disabled=true;$("saveMarkBtn").disabled=true;return;}
  const inst=institution;if(!inst)throw new Error("Select an institution to continue.");
  const {data:mods,error:modError}=await sb.from("institution_modules").select("module_key,enabled").eq("institution_id",inst.id).in("module_key",["admin_exams","examinations","proctoring"]).eq("enabled",true);
  if(modError) throw modError;
  if(!mods?.some(m=>["admin_exams","examinations"].includes(m.module_key))) throw new Error("The Examinations module is not enabled for this institution. Contact the Campus Nexus platform administrator.");
  $("institutionName").textContent=inst.name||"Your institution";
  if(inst.logo_url && /^https:\/\//i.test(inst.logo_url)) $("institutionLogo").innerHTML='<img src="'+escapeHTML(inst.logo_url)+'" alt="">';
  else $("institutionLogo").textContent=(inst.name||"CN").split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase();
  if(/^#[0-9a-f]{6}$/i.test(inst.primary_color||"")) document.documentElement.style.setProperty("--navy",inst.primary_color);
}
function scopeInstitution(query,column="institution_id"){return allInstitutionsView?query:query.eq(column,institution.id);}
function requireInstitution(){if(!institution){notice("Choose a specific institution in the institution filter before creating or editing records.",true);return false;}return true;}
async function refreshAll(){
  await loadExams();
  await Promise.all([loadAttempts(),loadProctoring(),loadAttendance(),loadStudentDirectory(),loadRetakes(),loadLiveStudents(),loadLiveFeed(),loadLecturerQuestions()]);
}
async function loadExams(){
  const {data,error}=await scopeInstitution(sb.from("exams").select("id,institution_id,title,exam_name,exam_type,program_type,target_program,block,block_term,intake_year,intake_month,course_id,course_code,exam_date,start_time,exam_start_time,end_time,duration_minutes,total_marks,marks_out_of,pass_mark,instructions,status,approval_status,is_published,is_active,created_at,created_by,approved_by,approved_at,rejection_reason")).order("created_at",{ascending:false}).limit(1000);
  if(error) throw error;exams=data||[];
  const published=exams.filter(e=>e.is_published||String(e.status||"").toLowerCase()==="published").length;
  document.querySelectorAll(".stat-foot").forEach(el=>{if(allInstitutionsView)el.textContent="Across all institutions";});
  const welcome=document.querySelector(".welcome-row .eyebrow");if(welcome)welcome.textContent=allInstitutionsView?"CAMPUS NEXUS PLATFORM CONTROL CENTRE":"INSTITUTION CONTROL CENTRE";const desc=$("workspaceDescription");if(desc)desc.textContent=allInstitutionsView?"System-wide examination oversight across every institution on Campus Nexus.":"Manage assessments, question banks, monitoring, attendance and results for "+(institution?.name||"your institution")+".";
 const examScope=$("examScopeDescription");if(examScope)examScope.textContent=allInstitutionsView?"System-wide examination register across all institutions.":"All examinations belonging to "+(institution?.name||"the signed-in institution")+".";

  const pending=exams.filter(e=>String(e.approval_status||"").toLowerCase()==="pending").length;
  $("statTotal").textContent=exams.length;$("statPublished").textContent=published;$("statPending").textContent=pending;
  renderExamRows();renderRecent();populateExamSelect();loadApprovalQueue();loadAdminProfile();
}
function approvalBadge(e){const v=String(e.approval_status||"draft").toLowerCase();return '<span class="badge '+(v==="approved"?"green":v==="pending"?"amber":v==="rejected"?"red":"")+'">'+escapeHTML(v)+'</span>'}
function publicationBadge(e){return e.is_published?'<span class="badge green">Published</span>':'<span class="badge">Not published</span>'}
function renderExamRows(){
 const body=$("examsTable");
 const table=body.closest("table");
 if(table)table.querySelector("thead tr").innerHTML=(allInstitutionsView?"<th>Institution</th>":"")+"<th>Examination</th><th>Programme</th><th>Block</th><th>Date</th><th>Duration</th><th>Approval</th><th>Publication</th><th>Actions</th>";
 if(!exams.length){body.innerHTML='<tr><td colspan="'+(allInstitutionsView?9:8)+'" class="empty-state">No examinations have been created for this institution yet.</td></tr>';return}
 body.innerHTML=exams.map(e=>{const id=escapeHTML(e.id),institutionCell=allInstitutionsView?'<td>'+escapeHTML(institutionNameMap.get(String(e.institution_id))||"Institution")+"</td>":"",approval=String(e.approval_status||"draft").toLowerCase();let actions="";if(approval==="pending")actions='<button class="secondary-button small" data-exam-action="approve" data-id="'+id+'">Approve</button> <button class="secondary-button small" data-exam-action="reject" data-id="'+id+'">Reject</button>';else if(approval==="approved"&&!e.is_published)actions='<button class="primary-button small" data-exam-action="publish" data-id="'+id+'">Publish</button>';else if(e.is_published)actions='<span class="muted-cell">Live</span>';actions+=' <button class="secondary-button small" data-exam-action="edit" data-id="'+id+'"><i class="fa-solid fa-pen"></i> Edit</button>';return '<tr>'+institutionCell+'<td><strong>'+escapeHTML(e.title||e.exam_name||"Untitled examination")+'</strong><div class="muted-cell">'+escapeHTML(e.exam_type||"Assessment")+' · '+escapeHTML(e.course_code||"No unit linked")+'</div></td><td>'+escapeHTML(e.program_type||e.target_program||"—")+'</td><td>'+escapeHTML(e.block_term||e.block||"—")+'</td><td>'+escapeHTML(e.exam_date||"Not scheduled")+'</td><td>'+escapeHTML(e.duration_minutes||"—")+' min</td><td>'+approvalBadge(e)+(e.rejection_reason?'<div class="muted-cell">'+escapeHTML(e.rejection_reason)+'</div>':"")+'</td><td>'+publicationBadge(e)+'</td><td>'+actions+'</td></tr>'}).join("");
}
function renderRecent(){
 const target=$("recentExams");if(!exams.length){target.innerHTML='<div class="empty-state">No examinations yet. Create the first examination to get started.</div>';return}
 target.innerHTML=exams.slice(0,5).map(e=>'<div class="list-row"><div><b>'+escapeHTML(e.title||e.exam_name||"Untitled")+'</b><small>'+escapeHTML(e.program_type||"Programme")+' · '+escapeHTML(e.exam_date||"Date not set")+'</small></div><div class="list-row-right">'+approvalBadge(e)+'</div></div>').join("");
}
function populateExamSelect(){
 const select=$("questionExam"),old=selectedExamId||select.value;select.innerHTML='<option value="">Choose an examination</option>'+exams.map(e=>'<option value="'+e.id+'">'+escapeHTML(e.title||e.exam_name||"Untitled")+'</option>').join("");
 if(old&&exams.some(e=>String(e.id)===String(old)))select.value=old;else if(exams.length)select.value=String(exams[0].id);
 selectedExamId=select.value||null;if(selectedExamId)loadQuestions();
}
async function loadQuestions(){
 selectedExamId=$("questionExam").value||null;$("addQuestionBtn").disabled=!selectedExamId;
 const body=$("questionsTable");if(!selectedExamId){body.innerHTML='<tr><td colspan="7" class="empty-state">Choose an examination to view its questions.</td></tr>';return}
 if(!exams.some(e=>String(e.id)===String(selectedExamId))){body.innerHTML='<tr><td colspan="7" class="empty-state">This examination is outside your institution scope.</td></tr>';return}const {data,error}=await sb.from("exam_questions").select("id,question_number,question_text,question_type,marks,correct_answer,status").eq("exam_id",Number(selectedExamId)).order("question_number");
 if(error){body.innerHTML='<tr><td colspan="7" class="empty-state">Unable to load questions: '+escapeHTML(error.message)+'</td></tr>';return}
 if(!data?.length){body.innerHTML='<tr><td colspan="7" class="empty-state">No questions have been added to this examination.</td></tr>';return}
 body.innerHTML=data.map(q=>{const pending=String(q.status||"").toLowerCase()==="pending";const actions=pending?'<button class="secondary-button small" data-question-action="approve" data-id="'+escapeHTML(q.id)+'">Approve</button> <button class="secondary-button small" data-question-action="reject" data-id="'+escapeHTML(q.id)+'">Reject</button>':'<span class="muted-cell">Reviewed</span>';return '<tr><td>'+escapeHTML(q.question_number||"—")+'</td><td><strong>'+escapeHTML(q.question_text)+'</strong></td><td>'+escapeHTML(q.question_type||"mcq")+'</td><td>'+escapeHTML(q.marks||0)+'</td><td>'+escapeHTML(q.correct_answer||"—") +'</td><td><span class="badge">'+escapeHTML(q.status||"active")+'</span></td><td>'+actions+'</td></tr>'}).join("");
}
async function loadAttempts(){
 const {data,error}=await scopeInstitution(sb.from("exam_attempts").select("id,institution_id,exam_id,student_id,attempt_number,status,score,percentage,grade,total_marks,started_at,submitted_at")).order("started_at",{ascending:false}).limit(1000);
 if(error){$("resultsTable").innerHTML='<tr><td colspan="7" class="empty-state">Attempts are not available to this account: '+escapeHTML(error.message)+'</td></tr>';return}
 const rows=data||[];$("statAttempts").textContent=rows.length;
 const examMap=new Map(exams.map(e=>[String(e.id),e.title||e.exam_name||"Examination"]));
 if(!rows.length){$("resultsTable").innerHTML='<tr><td colspan="7" class="empty-state">No examination attempts have been recorded.</td></tr>';return}
 $("resultsTable").innerHTML=rows.map(a=>'<tr><td>'+escapeHTML(String(a.student_id).slice(0,8))+'…</td><td>'+escapeHTML(examMap.get(String(a.exam_id))||"Examination")+'</td><td>'+escapeHTML(a.attempt_number||1)+'</td><td><span class="badge">'+escapeHTML(a.status||"—")+'</span></td><td>'+escapeHTML(a.score??"—")+' / '+escapeHTML(a.total_marks??"—")+'</td><td>'+escapeHTML(a.percentage==null?"—":Number(a.percentage).toFixed(1)+"%")+'</td><td>'+escapeHTML(a.submitted_at||"Not submitted")+'</td></tr>').join("");
}
async function loadProctoring(){
 const {data,error}=await scopeInstitution(sb.from("exam_proctoring_logs").select("id,institution_id,exam_id,event_type,details,severity,timestamp,student_name,student_reg_number")).order("timestamp",{ascending:false}).limit(500);
 if(error){$("proctoringTable").innerHTML='<tr><td colspan="6" class="empty-state">Proctoring events are not available: '+escapeHTML(error.message)+'</td></tr>';return}
 const examMap=new Map(exams.map(e=>[String(e.id),e.title||e.exam_name||"Examination"]));
 if(!data?.length){$("proctoringTable").innerHTML='<tr><td colspan="6" class="empty-state">No proctoring events have been recorded.</td></tr>';return}
 $("proctoringTable").innerHTML=data.map(x=>'<tr><td>'+escapeHTML(x.timestamp||"—")+'</td><td>'+escapeHTML(x.student_name||x.student_reg_number||"Student")+'</td><td>'+escapeHTML(examMap.get(String(x.exam_id))||"Examination")+'</td><td>'+escapeHTML(x.event_type||"Event")+'</td><td><span class="badge '+(String(x.severity).toLowerCase()==="high"||String(x.severity).toLowerCase()==="critical"?"red":"amber")+'">'+escapeHTML(x.severity||"info")+'</span></td><td>'+escapeHTML(x.details||"—")+'</td></tr>').join("");
}
async function loadAttendance(){
 if(!exams.length){$("attendanceTable").innerHTML='<tr><td colspan="6" class="empty-state">No examinations are assigned to this institution yet.</td></tr>';return}
 const {data,error}=await sb.from("exam_attendance").select("id,exam_id,student_name,student_reg_number,status,date,sign_in_time,exam_name").in("exam_id",exams.map(e=>e.id)).order("date",{ascending:false}).limit(100);
 if(error){$("attendanceTable").innerHTML='<tr><td colspan="6" class="empty-state">Attendance is not available: '+escapeHTML(error.message)+'</td></tr>';return}
 const examMap=new Map(exams.map(e=>[String(e.id),e.title||e.exam_name||"Examination"]));
 if(!data?.length){$("attendanceTable").innerHTML='<tr><td colspan="6" class="empty-state">No examination attendance records.</td></tr>';return}
 $("attendanceTable").innerHTML=data.map(x=>'<tr><td>'+escapeHTML(x.date||"—")+'</td><td>'+escapeHTML(x.student_name||"Student")+'</td><td>'+escapeHTML(x.student_reg_number||"—")+'</td><td>'+escapeHTML(examMap.get(String(x.exam_id))||x.exam_name||"Examination")+'</td><td><span class="badge">'+escapeHTML(x.status||"—")+'</span></td><td>'+escapeHTML(x.sign_in_time||"—")+'</td></tr>').join("");
}

async function loadStudentDirectory(){
 const {data,error}=await scopeInstitution(sb.from("consolidated_user_profiles_table").select("*").eq("role","student")).order("full_name").limit(5000);
 const body=$("studentsTable"),enrol=$("enrolmentsTable");
 if(error){body.innerHTML=enrol.innerHTML='<tr><td colspan="6" class="empty-state">'+escapeHTML(error.message)+'</td></tr>';return}
 const rows=data||[];window.__examStudentRows=rows;
 const render=items=>items.map(s=>'<tr><td><b>'+escapeHTML(s.full_name||"Student")+'</b><div class="muted-cell">'+escapeHTML(s.email||"")+'</div></td><td>'+escapeHTML(s.admission_number||s.student_id||"—")+'</td><td>'+escapeHTML(s.program||"—")+'</td><td>'+escapeHTML(s.block||"—")+'</td><td>'+escapeHTML(s.intake_year||"—")+'</td><td>'+escapeHTML(s.status||"—")+'</td></tr>').join("");
 body.innerHTML=rows.length?render(rows):'<tr><td colspan="6" class="empty-state">No students found.</td></tr>';
 enrol.innerHTML=body.innerHTML;$("enrolmentCount").textContent=rows.length+" student records";
}
function loadApprovalQueue(){
 const rows=exams.filter(e=>String(e.approval_status||"").toLowerCase()==="pending");
 $("approvalQueueCount").textContent=rows.length+" pending";
 $("approvalQueueTable").innerHTML=rows.length?rows.map(e=>'<tr><td>'+escapeHTML(institutionNameMap.get(String(e.institution_id))||institution?.name||"Institution")+'</td><td>'+escapeHTML(e.title||e.exam_name||"Assessment")+'</td><td>'+escapeHTML(e.program_type||e.target_program||"—")+'</td><td>'+escapeHTML(e.block_term||e.block||"—")+'</td><td>'+escapeHTML(e.created_at||"—")+'</td><td><button class="secondary-button small" data-exam-action="approve" data-id="'+escapeHTML(e.id)+'">Approve</button> <button class="secondary-button small" data-exam-action="reject" data-id="'+escapeHTML(e.id)+'">Reject</button></td></tr>').join(""):'<tr><td colspan="6" class="empty-state">No assessments pending approval.</td></tr>';
}
async function loadRetakes(){
 const {data,error}=await scopeInstitution(sb.from("exam_attempts").select("*")).order("started_at",{ascending:false}).limit(1500),body=$("retakesTable");
 if(error){body.innerHTML='<tr><td colspan="7" class="empty-state">'+escapeHTML(error.message)+'</td></tr>';return}
 const em=new Map(exams.map(e=>[String(e.id),e]));
 const rows=(data||[]).filter(a=>Number(a.attempt_number||1)>1||["retake","resit","supplementary","failed"].includes(String(a.status||"").toLowerCase())||((a.percentage!=null)&&Number(a.percentage)<(Number(em.get(String(a.exam_id))?.pass_mark)||60)));
 body.innerHTML=rows.length?rows.map(a=>'<tr><td>'+escapeHTML(a.student_name||a.student_id||"Student")+'</td><td>'+escapeHTML(institutionNameMap.get(String(a.institution_id))||institution?.name||"Institution")+'</td><td>'+escapeHTML(em.get(String(a.exam_id))?.title||em.get(String(a.exam_id))?.exam_name||"Examination")+'</td><td>'+escapeHTML(a.attempt_number||1)+'</td><td>'+escapeHTML(a.status||"—")+'</td><td>'+escapeHTML(a.score??"—")+'</td><td>'+escapeHTML(a.submitted_at||"—")+'</td></tr>').join(""):'<tr><td colspan="7" class="empty-state">No retake candidates found.</td></tr>';
}
async function loadLiveStudents(){
 const ids=exams.map(e=>e.id),body=$("liveStudentsTable");if(!ids.length){body.innerHTML='<tr><td colspan="5">No examinations in scope.</td></tr>';return}
 const {data,error}=await sb.from("exam_heartbeats").select("*").in("exam_id",ids).order("updated_at",{ascending:false}).limit(500);
 if(error){body.innerHTML='<tr><td colspan="5">'+escapeHTML(error.message)+'</td></tr>';return}
 const em=new Map(exams.map(e=>[String(e.id),e.title||e.exam_name||"Examination"]));
 body.innerHTML=data?.length?data.map(x=>'<tr><td>'+escapeHTML(x.student_name||x.student_id||x.user_id||"Student")+'</td><td>'+escapeHTML(em.get(String(x.exam_id))||"Examination")+'</td><td>'+escapeHTML(x.updated_at||x.last_heartbeat||x.created_at||"—")+'</td><td><span class="badge green">Heartbeat received</span></td><td>'+escapeHTML(x.attempt_id||x.attempt_number||"—")+'</td></tr>').join(""):'<tr><td colspan="5" class="empty-state">No student heartbeats found.</td></tr>';
}
async function loadLiveFeed(){
 const {data,error}=await scopeInstitution(sb.from("exam_proctoring_logs").select("*")).order("timestamp",{ascending:false}).limit(500),body=$("liveFeedTable");
 if(error){body.innerHTML='<tr><td colspan="6">'+escapeHTML(error.message)+'</td></tr>';return}
 const em=new Map(exams.map(e=>[String(e.id),e.title||e.exam_name||"Examination"]));
 body.innerHTML=data?.length?data.map(x=>'<tr><td>'+escapeHTML(x.timestamp||"—")+'</td><td>'+escapeHTML(x.student_name||x.student_reg_number||"Student")+'</td><td>'+escapeHTML(em.get(String(x.exam_id))||"Examination")+'</td><td>'+escapeHTML(x.event_type||"Event")+'</td><td>'+escapeHTML(x.severity||"info")+'</td><td>'+escapeHTML(x.details||x.snapshot_url||x.recording_url||"—")+'</td></tr>').join(""):'<tr><td colspan="6" class="empty-state">No monitoring events recorded.</td></tr>';
}
async function loadLecturerQuestions(){
 const ids=exams.map(e=>e.id),body=$("lecturerQuestionsTable");if(!ids.length){body.innerHTML='<tr><td colspan="6">No examinations in scope.</td></tr>';return}
 const {data,error}=await sb.from("exam_questions").select("*").in("exam_id",ids).order("created_at",{ascending:false}).limit(1000);
 if(error){body.innerHTML='<tr><td colspan="6">'+escapeHTML(error.message)+'</td></tr>';return}
 const em=new Map(exams.map(e=>[String(e.id),e.title||e.exam_name||"Examination"]));$("lecturerQuestionCount").textContent=(data||[]).length+" submissions";
 body.innerHTML=data?.length?data.map(q=>'<tr><td>'+escapeHTML(em.get(String(q.exam_id))||"Examination")+'</td><td>'+escapeHTML(q.question_text||"Question")+'</td><td>'+escapeHTML(q.question_type||"—")+'</td><td>'+escapeHTML(q.marks??"—")+'</td><td>'+escapeHTML(q.status||"—")+'</td><td>'+(String(q.status||"").toLowerCase()==="pending"?'<button class="secondary-button small" data-question-action="approve" data-id="'+escapeHTML(q.id)+'">Approve</button> <button class="secondary-button small" data-question-action="reject" data-id="'+escapeHTML(q.id)+'">Reject</button>':'Reviewed')+'</td></tr>').join(""):'<tr><td colspan="6" class="empty-state">No lecturer questions found.</td></tr>';
}
function loadAdminProfile(){
 $("adminProfileDetails").innerHTML='<p><b>Name</b><br>'+escapeHTML(profile?.full_name||authUser.email)+'</p><p><b>Email</b><br>'+escapeHTML(authUser.email)+'</p><p><b>Institution</b><br>'+escapeHTML(allInstitutionsView?"Platform-wide":institution?.name||"—")+'</p>';
 $("adminRoleLabel").textContent=platformSuperadmin?"Platform superadmin":"Institution administrator";
}
async function changePassword(){const password=window.prompt("Enter a new password (minimum 8 characters):");if(password===null)return;if(password.length<8){notice("Password must contain at least 8 characters.",true);return}const {error}=await sb.auth.updateUser({password});if(error)notice(error.message,true);else notice("Password updated.");}

function openExamModal(){ $("examModal").hidden=false;document.body.classList.add("modal-open")}
function closeExamModal(){ $("examModal").hidden=true;document.body.classList.remove("modal-open")}
async function saveExam(event){
 event.preventDefault();if(!requireInstitution())return;const total=Number($("totalMarks").value),pass=Number($("passMark").value),duration=Number($("examDuration").value);
 if(pass>total){notice("Pass mark cannot exceed total marks.",true);return}
 const date=$("examDate").value,time=$("examTime").value;if(!date||!time){notice("Select the examination date and start time.",true);return}
 const linkValue=$("examLink").value.trim();let examLink=null;if(linkValue){try{const parsed=new URL(linkValue);if(!["http:","https:"].includes(parsed.protocol))throw new Error();examLink=parsed.href;}catch(_){notice("Enter a valid online exam project URL beginning with https:// or http://.",true);return;}}
 // Store the selected schedule as an explicit Kenya-time instant (UTC+03:00), independent of device timezone.
 // Persist the exact wall-clock time selected by the administrator as Kenya-local
 // timestamps without an offset. The student portal interprets these as UTC+3.
 const start=date+"T"+time+":00";
 const [year,month,day]=date.split("-").map(Number),[hour,minute]=time.split(":").map(Number);
 const endDate=new Date(Date.UTC(year,month-1,day,hour,minute)+duration*60000);
 const pad=n=>String(n).padStart(2,"0");
 const end=endDate.getUTCFullYear()+"-"+pad(endDate.getUTCMonth()+1)+"-"+pad(endDate.getUTCDate())+"T"+pad(endDate.getUTCHours())+":"+pad(endDate.getUTCMinutes())+":00";
 const title=$("examTitle").value.trim();
 const payload={institution_id:institution.id,title,exam_name:title,exam_type:$("examType").value,exam_basis:"ordinary",program_type:$("examProgram").value.trim(),target_program:$("examProgram").value.trim(),intake_year:Number($("examIntake").value)||null,intake_month:$("examIntakeMonth").value||null,block:$("examBlock").value.trim()||null,block_term:$("examBlock").value.trim()||null,course_code:$("courseCode").value.trim()||null,exam_date:date,exam_start_time:time,start_time:start,end_time:end,duration_minutes:duration,total_marks:total,marks_out_of:total,pass_mark:pass,instructions:$("examInstructions").value.trim()||null,exam_link:examLink,online_link:examLink,status:"draft",approval_status:"approved",approved_by:authUser.id,approved_at:new Date().toISOString(),is_published:false,is_active:true,created_by:authUser.id,created_by_actor:authUser.id};
 const button=$("saveExamBtn");button.disabled=true;button.textContent="Saving…";
 try{const {data,error}=await sb.from("exams").insert(payload).select("id").single();if(error)throw error;closeExamModal();$("examForm").reset();$("examDuration").value=60;$("totalMarks").value=100;$("passMark").value=60;notice("Examination created and automatically approved. It remains unpublished until you publish it. Reference #"+data.id);await loadExams();switchView("exams")}
 catch(error){notice(error.message||"Unable to save examination.",true)}
 finally{button.disabled=false;button.textContent="Create approved examination"}
}
function openEditExam(id){
 const exam=exams.find(e=>String(e.id)===String(id));
 if(!exam){notice("Examination not found in the current institution.",true);return;}
 $("editExamId").value=exam.id;
 $("editExamTitle").value=exam.title||exam.exam_name||"";
 $("editExamType").value=exam.exam_type||"CAT";
 $("editExamProgram").value=exam.program_type||exam.target_program||"";
 $("editExamBlock").value=exam.block_term||exam.block||"";
 $("editExamIntake").value=exam.intake_year||"";
 $("editExamIntakeMonth").value=exam.intake_month||"";
 $("editCourseCode").value=exam.course_code||"";
 $("editExamDate").value=String(exam.exam_date||"").slice(0,10);
 $("editExamTime").value=String(exam.exam_start_time||exam.start_time||"").slice(0,5);
 $("editExamDuration").value=exam.duration_minutes||60;
 $("editTotalMarks").value=exam.total_marks??exam.marks_out_of??100;
 $("editPassMark").value=exam.pass_mark??60;
 $("editExamInstructions").value=exam.instructions||"";
 $("editExamLink").value=exam.exam_link||exam.online_link||"";
 $("editExamModal").hidden=false;document.body.classList.add("modal-open");
}
function closeEditExamModal(){$("editExamModal").hidden=true;document.body.classList.remove("modal-open");}
async function saveEditedExam(event){
 event.preventDefault();if(!requireInstitution())return;
 const id=$("editExamId").value,exam=exams.find(e=>String(e.id)===String(id));
 if(!id||!exam){notice("The examination could not be identified. Refresh and try again.",true);return;}
 const total=Number($("editTotalMarks").value),pass=Number($("editPassMark").value),duration=Number($("editExamDuration").value);
 const date=$("editExamDate").value,time=$("editExamTime").value;
 if(!date||!time||!Number.isFinite(duration)||duration<1||duration>600||!Number.isFinite(total)||total<1||pass<0||pass>total){notice("Check the date, start time, duration and marks. Pass mark cannot exceed total marks.",true);return;}
 const linkValue=$("editExamLink").value.trim();let examLink=null;if(linkValue){try{const parsed=new URL(linkValue);if(!["http:","https:"].includes(parsed.protocol))throw new Error();examLink=parsed.href;}catch(_){notice("Enter a valid online exam project URL beginning with https:// or http://.",true);return;}}
 // Persist the exact wall-clock time selected by the administrator as Kenya-local
 // timestamps without an offset. The student portal interprets these as UTC+3.
 const start=date+"T"+time+":00";
 const [year,month,day]=date.split("-").map(Number),[hour,minute]=time.split(":").map(Number);
 const endDate=new Date(Date.UTC(year,month-1,day,hour,minute)+duration*60000);
 const pad=n=>String(n).padStart(2,"0");
 const end=endDate.getUTCFullYear()+"-"+pad(endDate.getUTCMonth()+1)+"-"+pad(endDate.getUTCDate())+"T"+pad(endDate.getUTCHours())+":"+pad(endDate.getUTCMinutes())+":00";
 const title=$("editExamTitle").value.trim(),program=$("editExamProgram").value.trim();
 if(!title||!program){notice("Examination title and programme are required.",true);return;}
 const payload={title,exam_name:title,exam_type:$("editExamType").value,program_type:program,target_program:program,block:$("editExamBlock").value.trim()||null,block_term:$("editExamBlock").value.trim()||null,intake_year:Number($("editExamIntake").value)||null,intake_month:$("editExamIntakeMonth").value||null,course_code:$("editCourseCode").value.trim()||null,exam_date:date,exam_start_time:time,start_time:start,end_time:end,duration_minutes:duration,total_marks:total,marks_out_of:total,pass_mark:pass,instructions:$("editExamInstructions").value.trim()||null,exam_link:examLink,online_link:examLink,updated_at:new Date().toISOString()};
 const button=$("editExamSaveBtn"),label=button.textContent;button.disabled=true;button.textContent="Saving changes…";
 try{
  const {data,error}=await sb.from("exams").update(payload).eq("id",id).eq("institution_id",institution.id).select("id,exam_date,exam_start_time,duration_minutes,title").single();
  if(error)throw error;
  if(!data)throw new Error("No examination was updated. Check your institution permissions and try again.");
  closeEditExamModal();notice("Examination changes saved permanently.");
  await loadExams();
 }catch(error){notice("Could not save examination: "+(error.message||"Unknown database error"),true);}
 finally{button.disabled=false;button.textContent=label;}
}
async function updateExamDecision(id,action){
 const exam=exams.find(e=>String(e.id)===String(id));if(!exam){notice("Examination not found in this institution.",true);return}
 const current=String(exam.approval_status||"").toLowerCase();let patch={};
 if(action==="approve"){if(current!=="pending"){notice("Only pending assessments can be approved.",true);return}patch={approval_status:"approved",approved_by:authUser.id,approved_at:new Date().toISOString(),rejection_reason:null};}
 else if(action==="reject"){if(current!=="pending"){notice("Only pending assessments can be rejected.",true);return}const reason=window.prompt("Reason for rejecting this assessment:");if(reason===null)return;if(!reason.trim()){notice("A rejection reason is required.",true);return}patch={approval_status:"rejected",rejection_reason:reason.trim(),is_published:false};}
 else if(action==="publish"){if(current!=="approved"){notice("Approve the assessment before publishing it.",true);return}patch={is_published:true,is_active:true,status:"published"};}else return;
 const {error}=await scopeInstitution(sb.from("exams").update(patch).eq("id",id));if(error){notice(error.message,true);return}if(action==="publish"){notice("Examination published. Sending student notifications…");try{const {data:mailResult,error:mailError}=await sb.functions.invoke("exam-published-notification",{body:{exam_id:Number(id)}});if(mailError||!mailResult?.success){console.error("Exam notification failed:",mailError||mailResult);notice("Examination is published, but student email notifications could not be completed. Check the notification service and retry.",true);}else{notice("Examination published. Email notifications accepted for "+mailResult.sent+" students ("+mailResult.skipped+" already notified or without valid email, "+mailResult.failed+" failed).");}}catch(mailError){console.error("Exam notification invocation failed:",mailError);notice("Examination published, but email notification service is temporarily unavailable.",true);}}else notice(action==="approve"?"Assessment approved.":"Assessment rejected.");await loadExams();
}
async function updateQuestionDecision(id,action){
 if(!selectedExamId||!exams.some(e=>String(e.id)===String(selectedExamId))){notice("Select an examination belonging to this institution.",true);return}
 const status=action==="approve"?"approved":action==="reject"?"rejected":null;if(!status)return;
 const patch={status,updated_at:new Date().toISOString()};if(action==="reject"){const reason=window.prompt("Reason for rejecting this question:");if(reason===null)return;if(!reason.trim()){notice("A rejection reason is required.",true);return}patch.rejection_reason=reason.trim();}
 const {error}=await sb.from("exam_questions").update(patch).eq("id",id).eq("exam_id",Number(selectedExamId));if(error){notice(error.message,true);return}notice("Question "+status+".");await loadQuestions();
}
async function saveQuestion(){
 const question=$("questionText").value.trim(),examId=Number(selectedExamId);
 const options=[$("optionA").value.trim(),$("optionB").value.trim(),$("optionC").value.trim(),$("optionD").value.trim()];
 if(!examId||!question||options.some(x=>!x)){notice("Complete the question and all four answer options.",true);return}
 const {count,error:countError}=await sb.from("exam_questions").select("id",{count:"exact",head:true}).eq("exam_id",examId);
 if(countError){notice(countError.message,true);return}
 const payload={exam_id:examId,question_number:(count||0)+1,question_text:question,option_a:options[0],option_b:options[1],option_c:options[2],option_d:options[3],correct_answer:$("correctAnswer").value,marks:Number($("questionMarks").value)||1,question_type:"mcq",status:"approved",created_by:authUser.id,lecturer_id:authUser.id};
 const button=$("saveQuestion");button.disabled=true;button.textContent="Saving…";
 const {error}=await sb.from("exam_questions").insert(payload);
 button.disabled=false;button.textContent="Save question";
 if(error){notice(error.message,true);return}
 $("questionComposer").hidden=true;$("questionText").value="";["optionA","optionB","optionC","optionD"].forEach(id=>$(id).value="");notice("Question added to the selected examination.");await loadQuestions();
}
async function loadMarkStudents(){
 const select=$("markStudent");select.innerHTML='<option value="">Loading students…</option>';
 const {data,error}=await scopeInstitution(sb.from("consolidated_user_profiles_table").select("user_id,full_name,student_id,admission_number,program,block,intake_year,institution_id")).eq("role","student").in("status",["approved","active"]).order("full_name").limit(5000);
 if(error)throw error;markStudents=data||[];
 select.innerHTML='<option value="">Choose a student</option>'+markStudents.map(s=>'<option value="'+escapeHTML(s.user_id)+'">'+escapeHTML(s.full_name)+' · '+escapeHTML(s.admission_number||s.student_id||"No admission number")+'</option>').join("");
}
async function loadMarkUnits(){
 const {data,error}=await scopeInstitution(sb.from("units_catalog").select("id,unit_code,unit_name,program,block,institution_id")).eq("status","active").order("unit_code").limit(5000);
 if(error)throw error;markUnits=data||[];
 $("markUnit").innerHTML='<option value="">Choose a unit</option>'+markUnits.map(u=>'<option value="'+u.id+'">'+escapeHTML(u.unit_code+" · "+u.unit_name)+'</option>').join("");
}
async function renderStudentMarks(){
 const student=markStudents.find(s=>s.user_id===$("markStudent").value),body=$("marksTable");
 if(!student){body.innerHTML='<tr><td colspan="6" class="empty-state">Select a student to view recorded marks.</td></tr>';return}
 const {data,error}=await scopeInstitution(sb.from("student_marks").select("id,institution_id,subject_name,block,final_score,max_score,approval_status,published")).eq("student_id",student.user_id).order("created_at",{ascending:false}).limit(500);
 if(error){body.innerHTML='<tr><td colspan="6" class="empty-state">Marks are not available to this account: '+escapeHTML(error.message)+'</td></tr>';return}
 body.innerHTML=data?.length?data.map(m=>'<tr><td>'+escapeHTML(student.full_name)+'</td><td>'+escapeHTML(m.subject_name)+'</td><td>'+escapeHTML(m.block)+'</td><td>'+escapeHTML(m.final_score??"—")+" / "+escapeHTML(m.max_score??"—")+'</td><td>'+escapeHTML(m.approval_status||"draft")+'</td><td>'+(m.published?'Published':'Not published')+'</td></tr>').join(""):'<tr><td colspan="6" class="empty-state">No marks recorded for this student.</td></tr>';
}
async function saveManualMark(){
 if(!requireInstitution())return;
 const student=markStudents.find(s=>s.user_id===$("markStudent").value),unit=markUnits.find(u=>String(u.id)===$("markUnit").value),score=Number($("markScore").value),maximum=Number($("markMaximum").value),block=$("markBlock").value.trim(),year=String($("markYear").value);
 if(!student||!unit||!block||!year||!Number.isFinite(score)||!Number.isFinite(maximum)||maximum<=0||score<0||score>maximum){$("markFeedback").textContent="Choose a student and unit, then enter a valid block, academic year and score within the maximum marks.";return}
 if(!institution||student.institution_id!==institution.id||unit.institution_id!==institution.id){notice("Student and unit must belong to the selected institution.",true);return}
 const button=$("saveMarkBtn");button.disabled=true;button.textContent="Saving draft…";
 const payload={institution_id:institution.id,student_id:student.user_id,admission_number:student.admission_number||student.student_id||student.user_id,student_name:student.full_name,program:student.program||unit.program||"Unassigned",block,subject_name:unit.unit_name,assessment_type:$("markAssessment").value,cat1_score:$("markAssessment").value==="cat"?score:null,exam_score:$("markAssessment").value==="exam"||$("markAssessment").value==="practical"?score:null,final_score:score,max_score:maximum,approval_status:"draft",published:false,academic_year:year,graded_by:authUser.id,submitted_by:authUser.id,submitted_by_name:profile.full_name||authUser.email,points:0};
 try{const {error}=await sb.from("student_marks").upsert(payload,{onConflict:"admission_number,subject_name,block,academic_year"});if(error)throw error;$("markFeedback").textContent="Marks saved as a draft. They are not approved or visible to students.";notice("Draft marks saved.");await renderStudentMarks();}
 catch(e){$("markFeedback").textContent=e.message||"Could not save marks.";notice(e.message||"Could not save marks.",true);}
 finally{button.disabled=false;button.innerHTML='<i class="fa-solid fa-floppy-disk"></i> Save marks as draft';}
}
function switchView(view){
 document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x.dataset.view===view));
 document.querySelectorAll(".view").forEach(x=>x.classList.toggle("active",x.id==="view-"+view));
}
function bind(){
 document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>switchView(b.dataset.view)));
 document.querySelectorAll("[data-open-view]").forEach(b=>b.addEventListener("click",()=>switchView(b.dataset.openView)));
 $("newExamBtn").addEventListener("click",openExamModal);$("quickCreate").addEventListener("click",openExamModal);$("listCreateBtn").addEventListener("click",openExamModal);
 document.querySelectorAll("[data-close-modal]").forEach(b=>b.addEventListener("click",closeExamModal));
 $("examForm").addEventListener("submit",saveExam);$("refreshBtn").addEventListener("click",()=>refreshAll().catch(e=>notice(e.message,true)));
 $("examsTable").addEventListener("click",e=>{const b=e.target.closest("[data-exam-action]");if(!b)return;if(b.dataset.examAction==="edit"){openEditExam(b.dataset.id);return;}updateExamDecision(b.dataset.id,b.dataset.examAction).catch(err=>notice(err.message,true));});$("approvalQueueTable").addEventListener("click",e=>{const b=e.target.closest("[data-exam-action]");if(b)updateExamDecision(b.dataset.id,b.dataset.examAction).catch(err=>notice(err.message,true));});$("refreshExamApprovals").addEventListener("click",()=>loadExams().catch(err=>notice(err.message,true)));$("editExamForm").addEventListener("submit",saveEditedExam);$("closeEditExam").addEventListener("click",closeEditExamModal);$("cancelEditExam").addEventListener("click",closeEditExamModal);$("cancelEditExamButton").addEventListener("click",closeEditExamModal);
 ["questionsTable","lecturerQuestionsTable"].forEach(id=>$(id).addEventListener("click",e=>{const b=e.target.closest("[data-question-action]");if(b)updateQuestionDecision(b.dataset.id,b.dataset.questionAction).catch(err=>notice(err.message,true))}));
 $("questionExam").addEventListener("change",loadQuestions);$("addQuestionBtn").addEventListener("click",()=>{$("questionComposer").hidden=false});
 $("cancelQuestion").addEventListener("click",()=>{$("questionComposer").hidden=true});$("saveQuestion").addEventListener("click",saveQuestion);
 $("refreshProctoring").addEventListener("click",loadProctoring);

 $("refreshRetakes").addEventListener("click",loadRetakes);$("refreshLiveStudents").addEventListener("click",loadLiveStudents);$("refreshLiveFeed").addEventListener("click",loadLiveFeed);
 $("studentSearch").addEventListener("input",()=>{const q=$("studentSearch").value.toLowerCase(),rows=(window.__examStudentRows||[]).filter(s=>[s.full_name,s.email,s.admission_number,s.student_id,s.program].some(v=>String(v||"").toLowerCase().includes(q)));$("studentsTable").innerHTML=rows.map(s=>'<tr><td>'+escapeHTML(s.full_name||"Student")+'</td><td>'+escapeHTML(s.admission_number||s.student_id||"—")+'</td><td>'+escapeHTML(s.program||"—")+'</td><td>'+escapeHTML(s.block||"—")+'</td><td>'+escapeHTML(s.intake_year||"—")+'</td><td>'+escapeHTML(s.status||"—")+'</td></tr>').join("")||'<tr><td colspan="6">No matching students.</td></tr>'});
 $("changePasswordBtn").addEventListener("click",changePassword);$("signOutOtherBtn").addEventListener("click",async()=>{await sb.auth.signOut();window.location.replace("/login")});

 $("markStudent").addEventListener("change",renderStudentMarks);$("saveMarkBtn").addEventListener("click",saveManualMark);
 $("logoutBtn").addEventListener("click",async()=>{await sb.auth.signOut();window.location.replace("/login")});
}
document.addEventListener("DOMContentLoaded",()=>{bind();boot().catch(e=>{console.error(e);fail(e.message||"Unable to open examination management.")})});
})();