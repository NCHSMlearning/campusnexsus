(() => {
"use strict";
const SUPABASE_URL="https://lwhtjozfsmbyihenfunw.supabase.co";
const SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3aHRqb3pmc21ieWloZW5mdW53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2NTgxMjcsImV4cCI6MjA3NTIzNDEyN30.7Z8AYvPQwTAEEEhODlW6Xk-IR1FK3Uj5ivZS7P17Wpk";
const $=id=>document.getElementById(id);
let sb,authUser,institution,profile,exams=[],selectedExamId=null,markStudents=[],markUnits=[];
const escapeHTML=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function notice(message,error=false){const el=$("notice");el.textContent=message;el.className="notice"+(error?" error":"");el.hidden=false;window.setTimeout(()=>{el.hidden=true},6000)}
function fail(message){$("bootMessage").textContent=message;$("bootMessage").style.color="#b42318";document.querySelector(".loader").style.display="none"}
function showApp(){ $("bootScreen").hidden=true;$("app").hidden=false }
async function boot(){
  if(!window.supabase?.createClient) throw new Error("Authentication service is unavailable. Refresh and try again.");
  sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  const {data:{session},error:sessionError}=await sb.auth.getSession();
  if(sessionError) throw sessionError;
  if(!session?.user){window.location.replace("/login?redirect=%2Fexams");return}
  authUser=session.user;
  const [{data:memberships,error:memberError},{data:isSuper,error:superError},{data:prof}] = await Promise.all([
    sb.from("institution_users").select("institution_id,role,status").eq("user_id",authUser.id).eq("role","institution_admin").eq("status","active"),
    sb.rpc("is_current_user_superadmin"),
    sb.from("consolidated_user_profiles_table").select("full_name,email,role,status").eq("user_id",authUser.id).maybeSingle()
  ]);
  if(memberError) throw memberError;
  const platformSuperadmin=!superError && isSuper===true;
  let institutionOptions=[];
  if(platformSuperadmin){
    const {data,error}=await sb.from("institutions").select("id,name,logo_url,primary_color,school_code,physical_address,postal_address").order("name");
    if(error) throw error;institutionOptions=data||[];
  }else{
    if(!memberships?.length) throw new Error("This account does not have an active institution administrator assignment. Ask the Campus Nexus platform administrator to assign your institution.");
    const ids=[...new Set(memberships.map(m=>m.institution_id))];
    const {data,error}=await sb.from("institutions").select("id,name,logo_url,primary_color,school_code,physical_address,postal_address").in("id",ids).order("name");
    if(error) throw error;institutionOptions=data||[];
  }
  if(!institutionOptions.length) throw new Error("No institutions are available to this account.");
  const params=new URLSearchParams(window.location.search);
  const requestedId=params.get("institution_id");
  institution=institutionOptions.find(i=>i.id===requestedId)||institutionOptions[0];
  if(institutionOptions.length>1){
    $("institutionSwitcherWrap").hidden=false;
    $("institutionSwitcher").innerHTML=institutionOptions.map(i=>'<option value="'+escapeHTML(i.id)+'">'+escapeHTML(i.name)+'</option>').join("");
    $("institutionSwitcher").value=institution.id;
    $("institutionSwitcher").addEventListener("change",()=>{const url=new URL(window.location.href);url.searchParams.set("institution_id",$("institutionSwitcher").value);window.location.href=url.toString()});
  }
  await applyInstitutionBranding();
  profile=prof||{};
  $("userName").textContent=profile.full_name||authUser.email||"Administrator";
  showApp();
  await refreshAll();
  $("markProgram").value=profile.program||"";$("markYear").value=new Date().getFullYear();
  await Promise.all([loadMarkStudents(),loadMarkUnits()]);
}
async function applyInstitutionBranding(){
  const inst=institution;
  const {data:mods,error:modError}=await sb.from("institution_modules").select("module_key,enabled").eq("institution_id",inst.id).in("module_key",["admin_exams","examinations","proctoring"]).eq("enabled",true);
  if(modError) throw modError;
  if(!mods?.some(m=>["admin_exams","examinations"].includes(m.module_key))) throw new Error("The Examinations module is not enabled for this institution. Contact the Campus Nexus platform administrator.");
  $("institutionName").textContent=inst.name||"Your institution";
  if(inst.logo_url && /^https:\/\//i.test(inst.logo_url)) $("institutionLogo").innerHTML='<img src="'+escapeHTML(inst.logo_url)+'" alt="">';
  else $("institutionLogo").textContent=(inst.name||"CN").split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase();
  if(/^#[0-9a-f]{6}$/i.test(inst.primary_color||"")) document.documentElement.style.setProperty("--navy",inst.primary_color);
}
async function refreshAll(){
  await loadExams();
  await Promise.all([loadAttempts(),loadProctoring(),loadAttendance()]);
}
async function loadExams(){
  const {data,error}=await sb.from("exams").select("id,title,exam_name,exam_type,program_type,target_program,block,block_term,exam_date,start_time,duration_minutes,total_marks,pass_mark,status,approval_status,is_published,created_at").eq("institution_id",institution.id).order("created_at",{ascending:false}).limit(250);
  if(error) throw error;exams=data||[];
  const published=exams.filter(e=>e.is_published||String(e.status||"").toLowerCase()==="published").length;
  const pending=exams.filter(e=>String(e.approval_status||"").toLowerCase()==="pending").length;
  $("statTotal").textContent=exams.length;$("statPublished").textContent=published;$("statPending").textContent=pending;
  renderExamRows();renderRecent();populateExamSelect();
}
function approvalBadge(e){const v=String(e.approval_status||"draft").toLowerCase();return '<span class="badge '+(v==="approved"?"green":v==="pending"?"amber":v==="rejected"?"red":"")+'">'+escapeHTML(v)+'</span>'}
function publicationBadge(e){return e.is_published?'<span class="badge green">Published</span>':'<span class="badge">Not published</span>'}
function renderExamRows(){
 const body=$("examsTable");if(!exams.length){body.innerHTML='<tr><td colspan="7" class="empty-state">No examinations have been created for this institution yet.</td></tr>';return}
 body.innerHTML=exams.map(e=>'<tr><td><strong>'+escapeHTML(e.title||e.exam_name||"Untitled examination")+'</strong><div class="muted-cell">'+escapeHTML(e.exam_type||"Assessment")+'</div></td><td>'+escapeHTML(e.program_type||e.target_program||"—")+'</td><td>'+escapeHTML(e.block_term||e.block||"—")+'</td><td>'+escapeHTML(e.exam_date||"Not scheduled")+'</td><td>'+escapeHTML(e.duration_minutes||"—")+' min</td><td>'+approvalBadge(e)+'</td><td>'+publicationBadge(e)+'</td></tr>').join("");
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
 const body=$("questionsTable");if(!selectedExamId){body.innerHTML='<tr><td colspan="6" class="empty-state">Choose an examination to view its questions.</td></tr>';return}
 const {data,error}=await sb.from("exam_questions").select("id,question_number,question_text,question_type,marks,correct_answer,status").eq("exam_id",Number(selectedExamId)).order("question_number");
 if(error){body.innerHTML='<tr><td colspan="6" class="empty-state">Unable to load questions: '+escapeHTML(error.message)+'</td></tr>';return}
 if(!data?.length){body.innerHTML='<tr><td colspan="6" class="empty-state">No questions have been added to this examination.</td></tr>';return}
 body.innerHTML=data.map(q=>'<tr><td>'+escapeHTML(q.question_number||"—")+'</td><td><strong>'+escapeHTML(q.question_text)+'</strong></td><td>'+escapeHTML(q.question_type||"mcq")+'</td><td>'+escapeHTML(q.marks||0)+'</td><td>'+escapeHTML(q.correct_answer||"—")+'</td><td><span class="badge">'+escapeHTML(q.status||"active")+'</span></td></tr>').join("");
}
async function loadAttempts(){
 const {data,error}=await sb.from("exam_attempts").select("id,exam_id,student_id,attempt_number,status,score,percentage,grade,total_marks,started_at,submitted_at").eq("institution_id",institution.id).order("started_at",{ascending:false}).limit(100);
 if(error){$("resultsTable").innerHTML='<tr><td colspan="7" class="empty-state">Attempts are not available to this account: '+escapeHTML(error.message)+'</td></tr>';return}
 const rows=data||[];$("statAttempts").textContent=rows.length;
 const examMap=new Map(exams.map(e=>[String(e.id),e.title||e.exam_name||"Examination"]));
 if(!rows.length){$("resultsTable").innerHTML='<tr><td colspan="7" class="empty-state">No examination attempts have been recorded.</td></tr>';return}
 $("resultsTable").innerHTML=rows.map(a=>'<tr><td>'+escapeHTML(String(a.student_id).slice(0,8))+'…</td><td>'+escapeHTML(examMap.get(String(a.exam_id))||"Examination")+'</td><td>'+escapeHTML(a.attempt_number||1)+'</td><td><span class="badge">'+escapeHTML(a.status||"—")+'</span></td><td>'+escapeHTML(a.score??"—")+' / '+escapeHTML(a.total_marks??"—")+'</td><td>'+escapeHTML(a.percentage==null?"—":Number(a.percentage).toFixed(1)+"%")+'</td><td>'+escapeHTML(a.submitted_at||"Not submitted")+'</td></tr>').join("");
}
async function loadProctoring(){
 const {data,error}=await sb.from("exam_proctoring_logs").select("id,exam_id,event_type,details,severity,timestamp,student_name,student_reg_number").eq("institution_id",institution.id).order("timestamp",{ascending:false}).limit(50);
 if(error){$("proctoringTable").innerHTML='<tr><td colspan="6" class="empty-state">Proctoring events are not available: '+escapeHTML(error.message)+'</td></tr>';return}
 const examMap=new Map(exams.map(e=>[String(e.id),e.title||e.exam_name||"Examination"]));
 if(!data?.length){$("proctoringTable").innerHTML='<tr><td colspan="6" class="empty-state">No proctoring events have been recorded.</td></tr>';return}
 $("proctoringTable").innerHTML=data.map(x=>'<tr><td>'+escapeHTML(x.timestamp||"—")+'</td><td>'+escapeHTML(x.student_name||x.student_reg_number||"Student")+'</td><td>'+escapeHTML(examMap.get(String(x.exam_id))||"Examination")+'</td><td>'+escapeHTML(x.event_type||"Event")+'</td><td><span class="badge '+(String(x.severity).toLowerCase()==="high"||String(x.severity).toLowerCase()==="critical"?"red":"amber")+'">'+escapeHTML(x.severity||"info")+'</span></td><td>'+escapeHTML(x.details||"—")+'</td></tr>').join("");
}
async function loadAttendance(){
 const {data,error}=await sb.from("exam_attendance").select("id,exam_id,student_name,student_reg_number,status,date,sign_in_time,exam_name").in("exam_id",exams.map(e=>e.id)).order("date",{ascending:false}).limit(100);
 if(error){$("attendanceTable").innerHTML='<tr><td colspan="6" class="empty-state">Attendance is not available: '+escapeHTML(error.message)+'</td></tr>';return}
 const examMap=new Map(exams.map(e=>[String(e.id),e.title||e.exam_name||"Examination"]));
 if(!data?.length){$("attendanceTable").innerHTML='<tr><td colspan="6" class="empty-state">No examination attendance records.</td></tr>';return}
 $("attendanceTable").innerHTML=data.map(x=>'<tr><td>'+escapeHTML(x.date||"—")+'</td><td>'+escapeHTML(x.student_name||"Student")+'</td><td>'+escapeHTML(x.student_reg_number||"—")+'</td><td>'+escapeHTML(examMap.get(String(x.exam_id))||x.exam_name||"Examination")+'</td><td><span class="badge">'+escapeHTML(x.status||"—")+'</span></td><td>'+escapeHTML(x.sign_in_time||"—")+'</td></tr>').join("");
}
function openExamModal(){ $("examModal").hidden=false;document.body.classList.add("modal-open")}
function closeExamModal(){ $("examModal").hidden=true;document.body.classList.remove("modal-open")}
async function saveExam(event){
 event.preventDefault();const total=Number($("totalMarks").value),pass=Number($("passMark").value),duration=Number($("examDuration").value);
 if(pass>total){notice("Pass mark cannot exceed total marks.",true);return}
 const date=$("examDate").value,time=$("examTime").value;if(!date||!time){notice("Select the examination date and start time.",true);return}
 const start=date+"T"+time+":00";const endDate=new Date(start);endDate.setMinutes(endDate.getMinutes()+duration);
 const pad=n=>String(n).padStart(2,"0");const end=endDate.getFullYear()+"-"+pad(endDate.getMonth()+1)+"-"+pad(endDate.getDate())+"T"+pad(endDate.getHours())+":"+pad(endDate.getMinutes())+":00";
 const title=$("examTitle").value.trim();
 const payload={institution_id:institution.id,title,exam_name:title,exam_type:$("examType").value,program_type:$("examProgram").value.trim(),target_program:$("examProgram").value.trim(),block:$("examBlock").value.trim()||null,block_term:$("examBlock").value.trim()||null,course_code:$("courseCode").value.trim()||null,exam_date:date,exam_start_time:time,start_time:start,end_time:end,duration_minutes:duration,total_marks:total,marks_out_of:total,pass_mark:pass,instructions:$("examInstructions").value.trim()||null,status:"draft",approval_status:"pending",is_published:false,is_active:true,created_by:authUser.id,created_by_actor:authUser.id};
 const button=$("saveExamBtn");button.disabled=true;button.textContent="Saving…";
 try{const {data,error}=await sb.from("exams").insert(payload).select("id").single();if(error)throw error;closeExamModal();$("examForm").reset();$("examDuration").value=60;$("totalMarks").value=100;$("passMark").value=60;notice("Examination saved as a draft and submitted for approval. Reference #"+data.id);await loadExams();switchView("exams")}
 catch(error){notice(error.message||"Unable to save examination.",true)}
 finally{button.disabled=false;button.textContent="Save draft for approval"}
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
 const {data,error}=await sb.from("consolidated_user_profiles_table").select("user_id,full_name,student_id,admission_number,program,block,intake_year,institution_id").eq("institution_id",institution.id).eq("role","student").in("status",["approved","active"]).order("full_name").limit(3000);
 if(error)throw error;markStudents=data||[];
 select.innerHTML='<option value="">Choose a student</option>'+markStudents.map(s=>'<option value="'+escapeHTML(s.user_id)+'">'+escapeHTML(s.full_name)+' · '+escapeHTML(s.admission_number||s.student_id||"No admission number")+'</option>').join("");
}
async function loadMarkUnits(){
 const {data,error}=await sb.from("units_catalog").select("id,unit_code,unit_name,program,block,institution_id").eq("institution_id",institution.id).eq("status","active").order("unit_code").limit(1500);
 if(error)throw error;markUnits=data||[];
 $("markUnit").innerHTML='<option value="">Choose a unit</option>'+markUnits.map(u=>'<option value="'+u.id+'">'+escapeHTML(u.unit_code+" · "+u.unit_name)+'</option>').join("");
}
async function renderStudentMarks(){
 const student=markStudents.find(s=>s.user_id===$("markStudent").value),body=$("marksTable");
 if(!student){body.innerHTML='<tr><td colspan="6" class="empty-state">Select a student to view recorded marks.</td></tr>';return}
 const {data,error}=await sb.from("student_marks").select("id,subject_name,block,final_score,approval_status,published").eq("institution_id",institution.id).eq("student_id",student.user_id).order("created_at",{ascending:false}).limit(100);
 if(error){body.innerHTML='<tr><td colspan="6" class="empty-state">Marks are not available to this account: '+escapeHTML(error.message)+'</td></tr>';return}
 body.innerHTML=data?.length?data.map(m=>'<tr><td>'+escapeHTML(student.full_name)+'</td><td>'+escapeHTML(m.subject_name)+'</td><td>'+escapeHTML(m.block)+'</td><td>'+escapeHTML(m.final_score??"—")+'</td><td>'+escapeHTML(m.approval_status||"draft")+'</td><td>'+(m.published?'Published':'Not published')+'</td></tr>').join(""):'<tr><td colspan="6" class="empty-state">No marks recorded for this student.</td></tr>';
}
async function saveManualMark(){
 const student=markStudents.find(s=>s.user_id===$("markStudent").value),unit=markUnits.find(u=>String(u.id)===$("markUnit").value),score=Number($("markScore").value),maximum=Number($("markMaximum").value),block=$("markBlock").value.trim(),year=String($("markYear").value);
 if(!student||!unit||!block||!year||!Number.isFinite(score)||!Number.isFinite(maximum)||maximum<=0||score<0||score>maximum){$("markFeedback").textContent="Choose a student and unit, then enter a valid block, academic year and score within the maximum marks.";return}
 if(student.institution_id!==institution.id||unit.institution_id!==institution.id){notice("Student and unit must belong to the selected institution.",true);return}
 const button=$("saveMarkBtn");button.disabled=true;button.textContent="Saving draft…";
 const payload={institution_id:institution.id,student_id:student.user_id,admission_number:student.admission_number||student.student_id||student.user_id,student_name:student.full_name,program:student.program||unit.program||"Unassigned",block,subject_name:unit.unit_name,assessment_type:$("markAssessment").value,final_score:score,approval_status:"draft",published:false,academic_year:year,graded_by:authUser.id,submitted_by:authUser.id,submitted_by_name:profile.full_name||authUser.email,points:0};
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
 $("questionExam").addEventListener("change",loadQuestions);$("addQuestionBtn").addEventListener("click",()=>{$("questionComposer").hidden=false});
 $("cancelQuestion").addEventListener("click",()=>{$("questionComposer").hidden=true});$("saveQuestion").addEventListener("click",saveQuestion);
 $("refreshProctoring").addEventListener("click",loadProctoring);
 $("markStudent").addEventListener("change",renderStudentMarks);$("saveMarkBtn").addEventListener("click",saveManualMark);
 $("logoutBtn").addEventListener("click",async()=>{await sb.auth.signOut();window.location.replace("/login")});
}
document.addEventListener("DOMContentLoaded",()=>{bind();boot().catch(e=>{console.error(e);fail(e.message||"Unable to open examination management.")})});
})();