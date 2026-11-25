(() => {
"use strict";
const URL="https://irahplkvocaakjxuisto.supabase.co";
const KEY="sb_publishable_5Cg5FFudf03UnmOXGNGMHQ_uK9S-uQX";
const $=id=>document.getElementById(id), state={db:null,user:null,profile:null,institution:null,institutionId:null,modules:new Set(),rows:{}};
const MODULES={marks_entry:"Marks entry",marks_approval:"Marks approval",mark_entry_control:"Mark entry control",published_marks:"Published marks",student_management:"Student management",lecturer_portal:"Staff & lecturers",academic_management:"Academic management",admin_exams:"Examinations",examinations:"Examinations",attendance:"Attendance",learning_management:"Learning management",analytics_reports:"Analytics & reports",administrator_portal:"Institution settings",proctoring:"Exam proctoring",transcripts_certificates:"Transcripts & certificates",admissions:"Admissions",timetable:"Timetabling & sessions",clinical_placements:"Clinical placements",research_management:"Research management",quality_assurance:"Quality assurance",student_welfare:"Student welfare & discipline",library:"Library management",hostel_management:"Accommodation & hostels",transport_management:"Transport management",career_services:"Career services & alumni",events:"Events & calendar",human_resources:"Human resources",timetable:"Timetabling",clinical_placements:"Clinical placements",research_management:"Research management",student_welfare:"Student welfare & discipline",finance:"Finance & payments",inventory:"Inventory & procurement",asset_management:"Asset management",document_management:"Records & document management",communication:"Communication & notifications",helpdesk:"Helpdesk & support",};
function message(text,error=false){const el=$("iaNotice");if(!el)return;el.hidden=!text;el.textContent=text||"";el.style.background=error?"#fff0ef":"#eaf8f2";el.style.color=error?"#a12b2b":"#16634a";}
function setText(id,value){const el=$(id);if(el)el.textContent=value==null?"":String(value);return el;}
function bootStage(text){setText("iaBootMessage",text);}
function withTimeout(promise,label,ms=12000){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+" timed out. Check your internet connection and sign in again.")),ms);})]).finally(()=>clearTimeout(timer));}
function fail(text){const boot=$("iaBoot");if(!boot)return;setText("iaBootMessage",text);const spinner=boot.querySelector(".ia-spinner");if(spinner)spinner.hidden=true;const card=boot.querySelector(".ia-boot-card");if(card){const old=card.querySelector(".ia-error");if(old)old.remove();const p=document.createElement("p");p.className="ia-error";p.setAttribute("role","alert");p.textContent=text;card.append(p);}}
function initials(v){return String(v||"IA").trim().split(/\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase()||"IA";}
function cell(tr,value,bold=false){const td=document.createElement("td");if(bold){const b=document.createElement("strong");b.textContent=value??"—";td.append(b);}else td.textContent=value??"—";tr.append(td);}
function empty(id,cols,text){const body=$(id);if(body)body.innerHTML='<tr><td class="ia-empty" colspan="'+cols+'">'+text+'</td></tr>';}
function rows(id,data,cols,mapper,emptyText="No records found."){const body=$(id);if(!body)return;body.replaceChildren();if(!data?.length){empty(id,cols,emptyText);return;}data.forEach(item=>{const tr=document.createElement("tr");mapper(tr,item);body.append(tr);});}
function statusLabel(v){return String(v||"pending").replace(/_/g," ").replace(/\b\w/g,x=>x.toUpperCase());}
async function count(table,filters={}){let q=state.db.from(table).select("id",{count:"exact",head:true}).eq("institution_id",state.institutionId);Object.entries(filters).forEach(([k,v])=>q=q.eq(k,v));const r=await q;if(r.error)throw r.error;return r.count||0;}
async function loadRows(table,select,limit=100,order="created_at"){let q=state.db.from(table).select(select).eq("institution_id",state.institutionId);if(order)q=q.order(order,{ascending:false}).limit(limit);else q=q.limit(limit);const r=await q;if(r.error)throw r.error;return r.data||[];}
async function verifyAccess(){
 bootStage("Checking your sign-in session…");
 const auth=await withTimeout(state.db.auth.getUser(),"Session verification");
 if(auth.error||!auth.data?.user)throw new Error("Your session has expired. Please sign in again.");
 state.user=auth.data.user;
 bootStage("Loading your administrator profile…");
 // Use the authenticated self-profile RPC (SECURITY DEFINER) so profile lookup is not blocked by table RLS.
 const p=await withTimeout(state.db.rpc("get_my_login_profile"),"Administrator profile lookup");
 if(p.error)throw new Error("Your administrator profile could not be loaded: "+p.error.message);
 const ownProfile=Array.isArray(p.data)?p.data[0]:p.data;
 if(!ownProfile||ownProfile.user_id!==state.user.id)throw new Error("Your signed-in account has no matching Campus Nexus administrator profile. Check that you are using the correct registered email account.");
 state.profile=ownProfile;
 const role=String(state.profile.role||"").toLowerCase();
 if(!["institution_admin","admin"].includes(role))throw new Error("This dashboard is only for institutional administrators.");
 if(!["active","approved"].includes(String(state.profile.status||"").toLowerCase())||state.profile.login_enabled===false)throw new Error("Your administrator account is not active. Contact the Platform Superadmin.");
 bootStage("Checking your institution assignment…");
 const m=await withTimeout(state.db.from("institution_users").select("institution_id,role,status").eq("user_id",state.user.id).eq("status","active"),"Institution membership lookup");
 if(m.error)throw m.error;
 const memberships=(m.data||[]).filter(x=>x.role==="institution_admin"&&(!state.profile.institution_id||x.institution_id===state.profile.institution_id));
 if(memberships.length!==1)throw new Error("This account must have exactly one active institution administrator assignment.");
 state.institutionId=memberships[0].institution_id;
 if(state.profile.institution_id&&state.profile.institution_id!==state.institutionId)throw new Error("Your profile and institution membership do not match. Contact platform support.");
 bootStage("Loading your institution code…");
 const i=await withTimeout(state.db.from("institutions").select("id,name,school_code,short_code,institution_type,logo_url,primary_color,secondary_color,brand_colors,status,admin_email,contact_email,contact_phone,website_url").eq("id",state.institutionId).single(),"Institution details lookup");
 if(i.error)throw i.error;state.institution=i.data;
 const institutionCode=i.data.school_code||i.data.short_code||"";
 if(institutionCode){const codeEl=$("iaBootInstitutionCode");if(codeEl){codeEl.textContent="Institution code: "+institutionCode;codeEl.hidden=false;}}
 bootStage("Loading your enabled academic modules…");
 const ent=await withTimeout(state.db.rpc("current_user_module_entitlements"),"Module permissions lookup");
 if(!ent.error&&Array.isArray(ent.data))state.modules=new Set(ent.data.map(x=>String(x).toLowerCase()));
 else {const mods=await withTimeout(state.db.from("institution_modules").select("module_key").eq("institution_id",state.institutionId).eq("enabled",true),"Institution modules lookup");if(mods.error)throw mods.error;state.modules=new Set((mods.data||[]).map(x=>String(x.module_key).toLowerCase()));}
}
function applyIdentity(){
 const i=state.institution||{},p=state.profile||{},name=i.name||"Your Institution",code=i.school_code||i.short_code||"";
 document.title=name+" | Institution Admin";
 setText("iaTenantName",name);setText("iaSchoolCode",code?"School code "+code:"Institution workspace");
 setText("iaTopInstitution",name);setText("iaTopCode",code?"School code "+code:"");
 setText("iaTopInstitutionName",name);setText("iaDropdownInstitutionName",name);
 setText("iaDropdownAdminName",p.full_name||p.email||"Administrator");
 setText("iaTopInstitutionRole",p.full_name||p.email||"Institution administrator");
 setText("iaMyProfileName",p.full_name||"Administrator");setText("iaMyProfileEmail",p.email||state.user?.email||"—");
 setText("iaMyProfileRole",String(p.role||"institution_admin").replace(/_/g," ").replace(/\b\w/g,x=>x.toUpperCase()));
 setText("iaMyProfileStatus",statusLabel(p.status));setText("iaMyProfileInstitution",name);
 setText("iaMyProfileAvatar",initials(p.full_name||p.email));
 setText("iaWelcomeName",(p.full_name||"Administrator").split(/\s+/)[0]);
 // The old iaAvatar selector was removed when the account menu was redesigned.
 // Keep this optional so a missing legacy avatar can never stop the entire portal boot.
 setText("iaAvatar",initials(p.full_name||p.email));
 setText("iaToday",new Intl.DateTimeFormat("en-KE",{weekday:"short",day:"numeric",month:"short",year:"numeric"}).format(new Date()));
 setText("iaProfileName",name);setText("iaProfileType",i.institution_type||"Institution");setText("iaProfileEmail",i.contact_email||i.admin_email||"");
 setText("iaProfileCode",code||"—");setText("iaProfileStatus",statusLabel(i.status));setText("iaProfileModules",state.modules.size+" enabled");
 setText("iaSettingsName",name);setText("iaSettingsType",i.institution_type||"Institution");
 setText("setCode",code||"—");setText("setAdminEmail",i.admin_email||"—");setText("setContactEmail",i.contact_email||"—");setText("setPhone",i.contact_phone||"—");setText("setWebsite",i.website_url||"—");setText("setStatus",statusLabel(i.status));
 const logo=i.logo_url&&/^https:\/\//i.test(i.logo_url)?i.logo_url:"";
 const validColor=(value,fallback)=>typeof value==="string"&&/^#[0-9a-f]{3,8}$/i.test(value)?value:fallback;
 const palette=Array.isArray(i.brand_colors)?i.brand_colors:[];
 const primary=validColor(i.primary_color,"#0c1445");
 const secondary=validColor(i.secondary_color,"#0f766e");
 const gold=validColor(palette[2]||i.accent_color,"#fdb913");
 const root=document.documentElement;
 root.dataset.institutionId=String(i.id||"");
 root.dataset.institutionName=name;
 root.dataset.institutionCode=code;
 root.style.setProperty("--navy",primary);
 root.style.setProperty("--teal",secondary);
 root.style.setProperty("--gold",gold);
 root.style.setProperty("--ia-super-navy",primary);
 root.style.setProperty("--ia-super-indigo",secondary);
 root.style.setProperty("--ia-super-gold",gold);
 let brandStyle=$("iaInstitutionBrandTheme");
 if(!brandStyle){brandStyle=document.createElement("style");brandStyle.id="iaInstitutionBrandTheme";document.head.append(brandStyle);}
 brandStyle.textContent=[
  ".ia-sidebar{background:linear-gradient(145deg,"+primary+" 0%,"+secondary+" 100%)!important}",
  ".ia-nav-item.active{border-color:"+gold+"55!important;box-shadow:inset 3px 0 "+gold+"!important}",
  ".ia-nav-item i,.ia-support i{color:"+gold+"!important}",
  ".ia-logo,.ia-brand-mark,.ia-profile-logo,.ia-avatar{background:"+primary+"!important;color:#fff!important}",
  ".ia-brand-mark img,.ia-logo img,.ia-profile-logo img,.ia-avatar img,.ia-account-logo img{display:block;width:100%;height:100%;max-width:100%;max-height:100%;object-fit:contain;border-radius:inherit}",
  ".ia-primary-btn{background:"+secondary+"!important}",
  ".ia-welcome{background:linear-gradient(120deg,"+primary+" 0%,"+secondary+" 100%)!important}",
  ".ia-eyebrow{color:"+secondary+"!important}",
  ".ia-welcome .ia-eyebrow{color:#fff!important}",
  ".ia-status{border-color:"+gold+"55}",
  ".ia-boot{background:linear-gradient(135deg,"+primary+","+secondary+")!important}",
  ".ia-boot .ia-brand-mark{background:"+gold+"!important;color:"+primary+"!important}",
  ".ia-tenant small,.ia-brand small{color:#fff!important}"
 ].join("\n");
 const setImage=(el,alt)=>{if(!el)return;if(logo){const img=document.createElement("img");img.src=logo;img.alt=alt;img.loading="eager";img.referrerPolicy="no-referrer";img.decoding="async";img.style.cssText="display:block;width:100%;height:100%;max-width:100%;max-height:100%;object-fit:contain;border-radius:inherit";img.onerror=()=>{el.textContent=initials(name);};el.replaceChildren(img);}else el.textContent=initials(name);};
 ["iaLogo","iaProfileLogo","iaSettingsLogo","iaSettingsBrandLogo","iaBootLogo"].forEach(id=>setImage($(id),name+" logo"));
 const topLogo=$("iaTopInstitutionLogo");setImage(topLogo,name+" logo");
 const bootTitle=$("iaBootTitle");if(bootTitle)bootTitle.textContent=name;
 const bootMark=$("iaBoot")?.querySelector(".ia-brand-mark");if(bootMark&&!logo)bootMark.textContent=initials(name);
 const footer=document.querySelector(".ia-footer");if(footer)footer.textContent=name+" · Powered by Campus Nexus";
 let favicon=document.querySelector('link[rel="icon"]');if(!favicon){favicon=document.createElement("link");favicon.rel="icon";document.head.append(favicon);}if(logo)favicon.href=logo;
 const themeMeta=document.querySelector('meta[name="theme-color"]');if(themeMeta)themeMeta.content=primary;
 const list=$("iaModuleList");if(list){list.replaceChildren();const keys=[...state.modules].filter(k=>MODULES[k]);if(!keys.length){const s=document.createElement("p");s.className="ia-empty";s.textContent="No module entitlements were returned.";list.append(s);}keys.forEach(k=>{const row=document.createElement("div");row.className="ia-module-row";const ic=document.createElement("i");ic.className="fa-solid fa-circle-check";const label=document.createElement("b");label.textContent=MODULES[k];const stateEl=document.createElement("span");stateEl.className="ia-module-state";stateEl.textContent="Enabled";row.append(ic,label,stateEl);list.append(row);});}
 document.querySelectorAll("[data-module]").forEach(el=>{const key=el.dataset.module;const allowed=key==="administrator_portal"||state.modules.has(key)||(key==="admin_exams"&&state.modules.has("examinations"));el.hidden=!allowed;});
}
function activate(view){if(!$("view-"+view))return;document.querySelectorAll(".ia-view").forEach(x=>x.classList.toggle("active",x.id==="view-"+view));document.querySelectorAll(".ia-nav-item").forEach(x=>x.classList.toggle("active",x.dataset.view===view));$("iaSidebar")?.classList.remove("open");$("iaScrim")?.classList.remove("show");}
const studentCharts={};
function chartEmpty(id,text){const canvas=$(id);if(!canvas)return;const wrap=canvas.parentElement;wrap.innerHTML='<div class="ia-chart-empty">'+text+'</div>';}
function drawStudentChart(id,type,labels,data,label){const canvas=$(id);if(!canvas||!window.Chart)return;if(studentCharts[id])studentCharts[id].destroy();const colors=['#2563eb','#0d9488','#f59e0b','#8b5cf6','#ec4899','#0891b2','#65a30d','#ea580c','#64748b','#be123c'];studentCharts[id]=new Chart(canvas,{type,data:{labels,datasets:[{label,data,backgroundColor:type==='line'?'rgba(13,148,136,.14)':colors,borderColor:type==='line'?'#0d9488':colors,borderWidth:type==='line'?3:1,fill:type==='line',tension:.35,pointRadius:type==='line'?3:0,pointHoverRadius:5}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:type==='doughnut',position:'bottom',labels:{usePointStyle:true,boxWidth:8,padding:14}},tooltip:{enabled:true}},scales:type==='doughnut'?{}:{y:{beginAtZero:true,ticks:{precision:0},grid:{color:'rgba(148,163,184,.16)'}},x:{grid:{display:false}}}}});}
async function loadStudentAnalytics(){
 const stamp=$("iaAnalyticsUpdated");
 try{
  const result=await state.db.from("students").select("id,course,status,intake_year,created_at").eq("institution_id",state.institutionId).limit(10000);
  if(result.error)throw result.error;
  const students=result.data||[];
  if(!students.length){["iaStudentsByProgramme","iaStudentTrend","iaStudentStatus","iaStudentIntake"].forEach(id=>chartEmpty(id,"No student records are available yet."));if(stamp)stamp.textContent="No student data";return;}
  const aggregate=(key,fallback)=>{const counts=new Map();students.forEach(s=>{const v=String(s[key]??"").trim()||fallback;counts.set(v,(counts.get(v)||0)+1);});return [...counts.entries()].sort((a,b)=>b[1]-a[1]);};
  const programmes=aggregate("course","Unassigned programme").slice(0,10);drawStudentChart("iaStudentsByProgramme","doughnut",programmes.map(x=>x[0]),programmes.map(x=>x[1]),"Students");
  const statuses=aggregate("status","Unspecified status");drawStudentChart("iaStudentStatus","bar",statuses.map(x=>x[0].replace(/_/g," ")),statuses.map(x=>x[1]),"Students");
  const intakes=aggregate("intake_year","Not recorded").sort((a,b)=>String(a[0]).localeCompare(String(b[0])));drawStudentChart("iaStudentIntake","bar",intakes.map(x=>x[0]),intakes.map(x=>x[1]),"Students");
  const monthCounts=new Map();const now=new Date();for(let i=11;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);monthCounts.set(d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"),0);}students.forEach(s=>{if(!s.created_at)return;const d=new Date(s.created_at);if(Number.isNaN(d.getTime()))return;const key=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");if(monthCounts.has(key))monthCounts.set(key,monthCounts.get(key)+1);});const trend=[...monthCounts.entries()];drawStudentChart("iaStudentTrend","line",trend.map(x=>new Date(x[0]+"-01T00:00:00").toLocaleDateString("en-KE",{month:"short",year:"2-digit"})),trend.map(x=>x[1]),"New registrations");
  if(stamp)stamp.textContent=students.length.toLocaleString("en-KE")+" student records · refreshed just now";
 }catch(error){console.warn("Student analytics unavailable",error);["iaStudentsByProgramme","iaStudentTrend","iaStudentStatus","iaStudentIntake"].forEach(id=>chartEmpty(id,"Student analytics could not be loaded: "+error.message));if(stamp)stamp.textContent="Analytics unavailable";}
}
async function loadWorkspaceDashboardStats(){
 const stamp=$("iaWorkspaceStatsUpdated");
 const keys=["proctoring","transcripts_certificates","quality_assurance","library","hostel_management","transport_management","career_services","events","inventory","asset_management","document_management","communication","helpdesk"];
 document.querySelectorAll("[data-workspace-stat]").forEach(card=>{card.hidden=!state.modules.has(card.dataset.workspaceStat);});
 const visible=keys.filter(k=>state.modules.has(k));
 if(!visible.length){if(stamp)stamp.textContent="No additional modules enabled";return;}
 try{
  const [rowsResult,totalResults]=await Promise.all([
   state.db.from("institution_workspace_records").select("module_key,status").eq("institution_id",state.institutionId).in("module_key",visible).limit(10000),
   Promise.all(visible.map(async key=>{
    const r=await state.db.from("institution_workspace_records").select("id",{count:"exact",head:true}).eq("institution_id",state.institutionId).eq("module_key",key);
    return {key,count:r.count,error:r.error};
   }))
  ]);
  if(rowsResult.error)throw rowsResult.error;
  const grouped=new Map(visible.map(k=>[k,{active:0,done:0,attention:0}]));
  (rowsResult.data||[]).forEach(row=>{
   const item=grouped.get(String(row.module_key||"").toLowerCase());if(!item)return;
   const status=String(row.status||"").toLowerCase().replace(/[ -]+/g,"_");
   if(["completed","resolved","closed","approved","issued","delivered"].includes(status))item.done++;
   else if(["rejected","overdue","urgent","high_priority","revision_required","needs_attention","escalated"].includes(status))item.attention++;
   else if(["active","open","in_progress","pending","planned","allocated","under_review","submitted","referred"].includes(status))item.active++;
  });
  totalResults.forEach(({key,count,error})=>{
   const total=$("wsDash-"+key),detail=$("wsDash-"+key+"-detail"),status=grouped.get(key);
   if(total)total.textContent=error?"—":Number(count||0).toLocaleString("en-KE");
   if(detail)detail.textContent=error?"Statistics unavailable":status.active+" active · "+status.done+" completed · "+status.attention+" attention";
  });
  if(stamp)stamp.textContent="Updated just now · "+visible.length+" enabled modules";
 }catch(error){
  console.warn("Additional module statistics unavailable",error);
  visible.forEach(k=>{const total=$("wsDash-"+k),detail=$("wsDash-"+k+"-detail");if(total)total.textContent="—";if(detail)detail.textContent="Statistics unavailable";});
  if(stamp)stamp.textContent="Module statistics unavailable";
 }
}
async function countIn(table,column,values,filters={}){let q=state.db.from(table).select("id",{count:"exact",head:true}).eq("institution_id",state.institutionId).in(column,values);Object.entries(filters).forEach(([k,v])=>q=q.eq(k,v));const r=await q;if(r.error)throw r.error;return r.count||0;}
async function loadDashboard(){
 const tasks=[
 ["students",()=>count("students")],["activeStudents",()=>countIn("students","status",["active","approved"])],["pendingStudents",()=>count("consolidated_user_profiles_table",{role:"student",status:"pending"})],["graduatedStudents",()=>count("students",{status:"graduated"})],["staff",()=>count("lecturers")],["programs",()=>count("programs")],["exams",()=>count("exams")],["attendance",()=>count("attendance")],["results",()=>count("student_marks",{published:true})],
 ["admissions",()=>count("institution_admissions")],["hr",()=>count("institution_hr_records")],["timetable",()=>count("institution_timetable_entries")],["placements",()=>count("institution_clinical_placements")],["research",()=>count("institution_research_projects")],["welfare",()=>count("institution_welfare_cases")]
 ];
 const values=await Promise.all(tasks.map(async([k,fn])=>{try{return [k,await fn()]}catch(e){console.warn("Institution metric unavailable",k,e.message);return [k,null]}}));
 await loadStudentAnalytics();
 await loadWorkspaceDashboardStats();
 values.forEach(([k,v])=>{const ids={students:"statStudents",activeStudents:"statActiveStudents",pendingStudents:"statPendingStudents",graduatedStudents:"statGraduatedStudents",staff:"statStaff",programs:"statPrograms",exams:"statExams",attendance:"statAttendance",results:"statResults",admissions:"statAdmissions",hr:"statHR",timetable:"statTimetable",placements:"statPlacements",research:"statResearch",welfare:"statWelfare"};const id=ids[k];if($(id))$(id).textContent=v===null?"—":v.toLocaleString("en-KE");const reportIds={students:"repStudents",activeStudents:null,pendingStudents:null,graduatedStudents:null,staff:"repStaff",programs:"repPrograms",exams:"repExams",attendance:"repAttendance",results:"repResults",admissions:"repAdmissions",hr:"repHR",timetable:"repTimetable",placements:"repPlacements",research:"repResearch",welfare:"repWelfare"};const reportId=reportIds[k];if($(reportId))$(reportId).textContent=v===null?"—":v.toLocaleString("en-KE");});
 if($("iaStudentNavCount"))$("iaStudentNavCount").textContent=$("statStudents")?.textContent||"—";
 let exams=[];try{exams=await loadRows("exams","id,title,exam_name,course_name,target_program,program_type,block,exam_date,approval_status,is_published,status,created_at",6);}catch(e){console.warn("Recent examinations unavailable:",e.message);}
 const recent=$("iaRecentExams");if(!recent)return;recent.replaceChildren();if(!exams.length){const e=document.createElement("div");e.className="ia-empty";e.textContent="No examination records are available yet.";recent.append(e);}else exams.forEach(x=>{const box=document.createElement("div");box.className="ia-list-row";const left=document.createElement("div");const b=document.createElement("b");b.textContent=x.title||x.exam_name||x.course_name||"Examination";const sm=document.createElement("small");sm.textContent=[x.target_program||x.program_type,x.exam_date].filter(Boolean).join(" · ");left.append(b,sm);const tag=document.createElement("span");tag.className="ia-status";tag.textContent=x.is_published?"Published":statusLabel(x.approval_status||x.status);box.append(left,tag);recent.append(box);});
}
async function loadStudents(){const data=await loadRows("students","id,full_name,email,admission_number,course,block,current_block,status",500);state.rows.students=data;renderStudents();}
function renderStudents(){const q=($("iaStudentSearch").value||"").toLowerCase();const data=state.rows.students.filter(x=>[x.full_name,x.email,x.admission_number,x.course].some(v=>String(v||"").toLowerCase().includes(q)));$("iaStudentCount").textContent=data.length+" students";rows("iaStudents",data,5,(tr,x)=>{cell(tr,x.full_name,true);cell(tr,x.admission_number);cell(tr,x.course);cell(tr,x.current_block||x.block);cell(tr,statusLabel(x.status));});}
async function loadStaff(){const data=await loadRows("lecturers","id,full_name,email,department,staff_id,status,approved",500);state.rows.staff=data;renderStaff();}
function renderStaff(){const q=($("iaStaffSearch").value||"").toLowerCase();const data=state.rows.staff.filter(x=>[x.full_name,x.email,x.department,x.staff_id].some(v=>String(v||"").toLowerCase().includes(q)));$("iaStaffCount").textContent=data.length+" staff records";rows("iaStaff",data,5,(tr,x)=>{cell(tr,x.full_name,true);cell(tr,x.email);cell(tr,x.department);cell(tr,x.staff_id);cell(tr,statusLabel(x.status));});}
async function loadAcademic(){const [p,c]=await Promise.all([loadRows("programs","id,program_name,program_code,category,duration_months,status",500),loadRows("courses","id,course_name,name,code,unit_code,target_program,block,status",500)]);rows("iaPrograms",p,5,(tr,x)=>{cell(tr,x.program_name,true);cell(tr,x.program_code);cell(tr,x.category||"—");cell(tr,x.duration_months?x.duration_months+" months":"—");cell(tr,statusLabel(x.status));});rows("iaCourses",c,5,(tr,x)=>{cell(tr,x.course_name||x.name,true);cell(tr,x.unit_code||x.code);cell(tr,x.target_program);cell(tr,x.block);cell(tr,statusLabel(x.status));});}
async function loadExams(){const d=await loadRows("exams","id,title,exam_name,course_name,target_program,program_type,block,exam_date,approval_status,is_published,status",500);rows("iaExams",d,6,(tr,x)=>{cell(tr,x.title||x.exam_name||x.course_name,true);cell(tr,x.target_program||x.program_type);cell(tr,x.block);cell(tr,x.exam_date);cell(tr,statusLabel(x.approval_status||x.status));cell(tr,x.is_published?"Published":"Not published");});}
async function loadLearning(){const data=await loadRows("resources","id,title,file_name,unit_name,unit_code,target_program,category,approval_status,file_url,created_at",300);const body=$("iaResources");body.replaceChildren();if(!data.length){empty("iaResources",6,"No learning resources have been uploaded for this institution.");return;}data.forEach(x=>{const tr=document.createElement("tr");cell(tr,x.title||x.file_name,true);cell(tr,x.unit_name||x.unit_code);cell(tr,x.target_program);cell(tr,x.category);cell(tr,statusLabel(x.approval_status));const td=document.createElement("td");if(typeof x.file_url==="string"&&x.file_url.startsWith("https://")){const a=document.createElement("a");a.href=x.file_url;a.target="_blank";a.rel="noopener noreferrer";a.textContent="Open resource";a.className="ia-text-btn";td.append(a);}else td.textContent="No file link";tr.append(td);body.append(tr);});}
async function loadAttendance(){const d=await loadRows("attendance","id,student_id,date,timestamp,course_or_rotation,status,marked_by",200);const ids=[...new Set(d.map(x=>x.student_id).filter(Boolean))];let names={};if(ids.length){const s=await state.db.from("students").select("id,full_name,admission_number").eq("institution_id",state.institutionId).in("id",ids);if(!s.error)(s.data||[]).forEach(x=>names[x.id]=x.full_name||x.admission_number||x.id);}rows("iaAttendance",d,5,(tr,x)=>{cell(tr,x.date||x.timestamp);cell(tr,names[x.student_id]||x.student_id);cell(tr,x.course_or_rotation);cell(tr,statusLabel(x.status));cell(tr,x.marked_by);});}
async function loadCNSEBInstitutionMonitor(){
 const body=$("iaCnsebSessions");if(body)body.innerHTML='<tr><td colspan="5" class="ia-empty">Loading secure exam sessions…</td></tr>';
 try{
  const result=await state.db.rpc("get_cnseb_institution_monitor",{p_institution_id:state.institutionId});
  if(result.error)throw result.error;
  const data=result.data||{},rows=data.sessions||[];
  setText("iaCnsebActive",Number(data.active_sessions||0).toLocaleString("en-KE"));
  setText("iaCnsebStale",Number(data.stale_sessions||0).toLocaleString("en-KE"));
  setText("iaCnsebAlerts",Number(data.proctoring_alerts_24h||0).toLocaleString("en-KE"));
  const esc=value=>String(value??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  if(body)body.innerHTML=rows.map(row=>{
   const version=String(row.user_agent||"").match(/CampusNexus-SEB\/([^ |]+)/)?.[1]||"Browser / unknown";
   const last=row.last_heartbeat?new Date(row.last_heartbeat).toLocaleString():"Unknown";
   const examTitle=esc(row.exam_title||("Exam "+row.exam_id)),studentLabel=esc(String(row.student_id||"").slice(0,8))+'…';
   const watch=row.is_active&&row.student_id&&row.exam_id?'<button type="button" data-ia-cnseb-watch="'+esc(row.student_id)+'" data-ia-cnseb-exam="'+Number(row.exam_id)+'" data-ia-cnseb-student-label="'+studentLabel+'" data-ia-cnseb-exam-label="'+examTitle+'" class="ia-secondary-btn" style="padding:6px 9px">Watch live</button>':'—';
   return '<tr><td><b style="color:'+(row.is_active?'#168154':'#b45309')+'">'+(row.is_active?'Active':'Stale')+'</b></td><td>'+examTitle+'</td><td style="font-family:monospace">'+studentLabel+'</td><td>'+esc(version)+'</td><td>'+esc(last)+'</td><td>'+watch+'</td></tr>';
  }).join("")||'<tr><td colspan="5" class="ia-empty">No Secure Exam Browser sessions found.</td></tr>';
  body?.querySelectorAll("[data-ia-cnseb-watch]")?.forEach(button=>button.addEventListener("click",async()=>{
   try{
    if(!window.CNSEBLiveViewer)throw new Error("Live camera viewer is not loaded. Refresh the page and try again.");
    await window.CNSEBLiveViewer.open({client:state.db,studentId:button.dataset.iaCnsebWatch,examId:Number(button.dataset.iaCnsebExam),studentName:button.dataset.iaCnsebStudentLabel,examName:button.dataset.iaCnsebExamLabel});
   }catch(error){message(error.message||"Live camera could not be opened.",true);}
  }));
  const updated=$("iaCnsebUpdated");if(updated)updated.textContent="Updated "+new Date(data.generated_at||Date.now()).toLocaleString()+" · scoped to "+(state.institution?.name||"this institution");
 }catch(error){
  console.warn("[CN-SEB institution monitor]",error);
  if(body)body.innerHTML='<tr><td colspan="5" class="ia-empty">Unable to load sessions: '+String(error.message||"Access unavailable").replace(/[&<>"]/g," ")+'</td></tr>';
 }
}
async function loadView(view){try{if(view==="students"&&!state.rows.students)await loadStudents();if(view==="staff"&&!state.rows.staff)await loadStaff();if(view==="academic")await loadAcademic();if(view==="proctoring")await loadCNSEBInstitutionMonitor();/* Examination records are rendered by institution-admin-modules.js, which supplies tenant-scoped CRUD and the matching action column. *//* Attendance is handled by institution-admin-attendance.js using the verified institution student roster. */if(view==="learning")await loadLearning();}catch(e){message("Unable to load "+view+": "+e.message,true);}}
function bind(){
 $("iaCnsebRefresh")?.addEventListener("click",loadCNSEBInstitutionMonitor);
 const menuSearch=$("iaSidebarSearch"),sidebar=$("iaSidebar"),scrim=$("iaScrim"),menuToggle=$("iaMenuToggle"),nav=$("iaNav");
 const closeMenu=()=>{sidebar?.classList.remove("open");scrim?.classList.remove("show");menuToggle?.setAttribute("aria-expanded","false");};
 let empty=$("iaSearchEmpty");
 if(!empty&&nav){empty=document.createElement("div");empty.id="iaSearchEmpty";empty.className="ia-search-empty";empty.setAttribute("role","status");empty.setAttribute("aria-live","polite");empty.textContent="No matching menu items. Try another keyword.";nav.append(empty);}
 const searchable=[...document.querySelectorAll("#iaNav [data-view]")];
 const aliases={
  overview:"home dashboard summary",students:"learners enrolment admissions register",
  staff:"lecturers teachers employees personnel",academic:"curriculum programme courses units", "unit-catalog":"curriculum unit catalogue units", "unit-registration":"curriculum unit registration approvals students", programs:"curriculum programmes intakes academic structure blocks semesters terms",
  exams:"exam examination assessment test paper","marks-entry":"marks grades scores results capture",
  "marks-approval":"approve marks verify grades","entry-control":"lock unlock marks entry",
  "published-marks":"released marks results grades",attendance:"register presence absent sessions",
  learning:"lms e-learning lessons resources",reports:"analytics statistics performance",
  admissions:"applicants applications intake",hr:"human resources payroll staff",
  timetable:"schedule calendar classes",placements:"clinical hospital attachment rotation",
  research:"projects proposals studies",welfare:"student support counselling discipline",
  settings:"configuration institution profile",proctoring:"exam monitoring invigilation integrity",
  "transcripts-certificates":"transcript certificate graduation","quality-assurance":"qa compliance audit standards",
  library:"books borrowing catalogue","hostel-management":"hostel accommodation residence",
  "transport-management":"bus transport","career-services":"careers alumni jobs",
  events:"calendar activities",inventory:"procurement stock supplies",
  "asset-management":"equipment assets","document-management":"records files documents",
  communication:"announcements messages notifications",helpdesk:"support tickets assistance"
 };
 const entitlementHidden=new WeakMap();
 searchable.forEach(item=>entitlementHidden.set(item,!!item.hidden));
 const runMenuSearch=()=>{
  const q=(menuSearch?.value||"").trim().toLocaleLowerCase(),terms=q.split(/\s+/).filter(Boolean);
  let count=0;
  searchable.forEach(item=>{
   const key=item.dataset.view||"",module=item.dataset.module||"";
   const haystack=(item.textContent+" "+key.replace(/-/g," ")+" "+module.replace(/_/g," ")+" "+(aliases[key]||"")).toLocaleLowerCase();
   const match=!terms.length||terms.every(term=>haystack.includes(term));
   item.hidden=!!entitlementHidden.get(item)||!match;
   if(!item.hidden)count++;
  });
  document.querySelectorAll("#iaNav .ia-nav-label").forEach(label=>{
   let next=label.nextElementSibling,visible=false;
   while(next&&!next.classList.contains("ia-nav-label")){if(next.matches("[data-view]")&&!next.hidden){visible=true;break;}next=next.nextElementSibling;}
   label.hidden=!!q&&!visible;
  });
  if(empty){empty.classList.toggle("show",!!q&&count===0);empty.hidden=!(!!q&&count===0);}
  if(menuSearch)menuSearch.setAttribute("aria-label",count+" menu items match");
 };
 menuSearch?.addEventListener("input",runMenuSearch);
 document.querySelectorAll("[data-view]").forEach(el=>el.addEventListener("click",()=>{activate(el.dataset.view);closeMenu();loadView(el.dataset.view);}));
 document.querySelectorAll("[data-open-view]").forEach(el=>el.addEventListener("click",()=>{const v=el.dataset.openView;activate(v);closeMenu();loadView(v);}));
 $("iaStudentSearch")?.addEventListener("input",renderStudents);$("iaStaffSearch")?.addEventListener("input",renderStaff);
 menuToggle?.addEventListener("click",()=>{const opening=!sidebar.classList.contains("open");sidebar.classList.toggle("open",opening);scrim?.classList.toggle("show",opening);menuToggle.setAttribute("aria-expanded",String(opening));});
 scrim?.addEventListener("click",closeMenu);
 document.addEventListener("keydown",event=>{
  if((event.key==="k"||event.key==="K")&&(event.metaKey||event.ctrlKey)){event.preventDefault();menuSearch?.focus();return;}
  if(event.key==="Escape"){
   if(document.activeElement===menuSearch&&menuSearch.value){menuSearch.value="";runMenuSearch();menuSearch.blur();return;}
   closeMenu();
  }
 });
 $("iaRefresh")?.addEventListener("click",()=>refresh());
 const accountTrigger=$("iaAccountTrigger"),accountDropdown=$("iaAccountDropdown"),profileDialog=$("iaMyProfileDialog");
 const closeAccountMenu=()=>{if(accountDropdown)accountDropdown.hidden=true;accountTrigger?.setAttribute("aria-expanded","false");};
 accountTrigger?.addEventListener("click",event=>{event.stopPropagation();const opening=accountDropdown.hidden;accountDropdown.hidden=!opening;accountTrigger.setAttribute("aria-expanded",String(opening));});
 document.addEventListener("click",event=>{if(!event.target.closest("#iaAccountMenu"))closeAccountMenu();});
 $("iaOpenMyProfile")?.addEventListener("click",()=>{closeAccountMenu();if(profileDialog?.showModal)profileDialog.showModal();});
 $("iaCloseMyProfile")?.addEventListener("click",()=>profileDialog?.close());
 profileDialog?.addEventListener("click",event=>{if(event.target===profileDialog)profileDialog.close();});
 $("iaOpenInstitutionProfile")?.addEventListener("click",()=>{closeAccountMenu();activate("settings");loadView("settings");});
 accountDropdown?.addEventListener("click",event=>{if(event.target.closest("[data-open-view]"))closeAccountMenu();});
 const signOut=async()=>{closeAccountMenu();await state.db.auth.signOut();localStorage.removeItem("userProfile");location.replace("/login/");};
 $("iaLogout")?.addEventListener("click",signOut);$("iaTopLogout")?.addEventListener("click",signOut);
 document.addEventListener("keydown",event=>{if(event.key==="Escape")closeAccountMenu();});
}
async function refresh(){message("");try{state.rows={};await loadDashboard();const active=document.querySelector(".ia-view.active")?.id?.replace("view-","");if(active&&active!=="overview")await loadView(active);message("Institution data refreshed.");}catch(e){message(e.message,true);}}
async function start(){try{bootStage("Connecting securely to Campus Nexus…");if(!window.supabase?.createClient)throw new Error("Secure database client could not load. Refresh the page.");state.db=window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});await verifyAccess();window.CampusInstitutionAdmin={db:state.db,user:state.user,profile:state.profile,institution:state.institution,institutionId:state.institutionId,modules:state.modules,refresh};bootStage("Opening your institution workspace…");applyIdentity();bind();await loadDashboard();$("iaBoot").hidden=true;$("iaApp").hidden=false;requestAnimationFrame(()=>loadStudentAnalytics());}catch(e){console.error("[Institution Admin]",e);fail(e.message);if(/session|sign in|administrator profile/i.test(e.message))setTimeout(()=>location.replace("/login/"),2800);}}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();