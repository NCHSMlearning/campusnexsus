/* Institution Admin Curriculum workspace.
 * Mirrors the Super Admin Curriculum destinations while enforcing tenant scope.
 * Unit catalogue is a read-only view; programme settings remain the source of truth.
 */
(() => {
 "use strict";
 const $=id=>document.getElementById(id);
 let api=null, catalog=[], registrations=[];
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const tenant=()=>{if(!api?.institutionId)throw new Error("Institution session is not ready.");return api.institutionId;};
 const db=()=>{if(!api?.db)throw new Error("Institution database session is not ready.");return api.db;};
 const notify=(m,t="info")=>{if(typeof window.showNotification==="function")window.showNotification(m,t);else if(typeof window.showFeedback==="function")window.showFeedback(m,t);else alert(m);};
 const val=(o,...keys)=>{for(const k of keys){if(o?.[k]!==undefined&&o[k]!==null&&o[k]!=="")return o[k];}return "—";};
 const date=v=>{if(!v)return "—";const d=new Date(v);return Number.isNaN(d.getTime())?esc(v):d.toLocaleDateString();};
 const kenyaInputToIso=value=>{
  if(!value)return null;
  const d=new Date(value+":00+03:00");
  if(Number.isNaN(d.getTime()))throw new Error("Enter a valid date and time.");
  return d.toISOString();
 };
 const isoToKenyaInput=value=>{
  if(!value)return "";
  const d=new Date(value);if(Number.isNaN(d.getTime()))return "";
  return d.toLocaleString("sv-SE",{timeZone:"Africa/Nairobi",hour12:false}).replace(" ","T").slice(0,16);
 };
 const currentSchedule=()=>({
  opens:kenyaInputToIso($("iaUnitRegistrationOpensAt")?.value||""),
  closes:kenyaInputToIso($("iaUnitRegistrationClosesAt")?.value||"")
 });
 function renderUnitRegistrationControl(data){
  const status=$("iaUnitRegistrationControlStatus"),toggle=$("iaUnitRegistrationToggle");
  const open=data?.is_open===true,manualOpen=data?.manual_open!==false,statusKey=data?.status|| (open?"open":"manually_closed");
  const labels={open:"Unit registration is OPEN",scheduled:"Registration is SCHEDULED",deadline_passed:"Registration deadline has PASSED",manually_closed:"Unit registration is MANUALLY CLOSED",closed:"Unit registration is CLOSED"};
  if(status){status.textContent=labels[statusKey]||"Unit registration is CLOSED";status.dataset.state=open?"open":"closed";}
  if(toggle){toggle.checked=manualOpen;toggle.disabled=false;toggle.setAttribute("aria-label",manualOpen?"Manually close unit registration":"Manually open unit registration");}
  const opens=$("iaUnitRegistrationOpensAt"),closes=$("iaUnitRegistrationClosesAt");
  if(opens)opens.value=isoToKenyaInput(data?.opens_at);
  if(closes)closes.value=isoToKenyaInput(data?.closes_at);
  const hint=$("iaUnitRegistrationControlHint");
  if(hint)hint.textContent=statusKey==="scheduled"?"Registration is scheduled to open at the selected Kenya time.":open?"Students can submit new unit registrations until the closing deadline.":"Students cannot submit new unit registrations. Existing records and approvals remain available.";
  const note=$("iaUnitRegistrationScheduleNote");
  if(note)note.textContent=data?.opens_at||data?.closes_at?"Schedule saved. All displayed dates and times use Kenya time (EAT, UTC+3).":"Set an opening date and/or closing deadline. Leave a field blank for no restriction on that side of the window.";
 }
 async function loadUnitRegistrationControl(){
  const status=$("iaUnitRegistrationControlStatus"),toggle=$("iaUnitRegistrationToggle");
  if(status)status.textContent="Checking registration access…";
  if(toggle)toggle.disabled=true;
  try{
   const {data,error}=await db().rpc("get_my_unit_registration_control");
   if(error)throw error;
   renderUnitRegistrationControl(data||{});
  }catch(e){
   if(status)status.textContent="Unable to read registration status";
   if(toggle)toggle.disabled=true;
   notify("Could not load unit registration controls: "+e.message,"error");
  }
 }
 async function persistUnitRegistrationControl(isOpen,showSuccess=true){
  const toggle=$("iaUnitRegistrationToggle"),status=$("iaUnitRegistrationControlStatus");
  if(toggle)toggle.disabled=true;
  try{
   const schedule=currentSchedule();
   if(schedule.opens&&schedule.closes&&new Date(schedule.closes)<=new Date(schedule.opens))throw new Error("The closing deadline must be later than the opening date and time.");
   const {data,error}=await db().rpc("set_my_unit_registration_control",{
    p_is_open:isOpen,
    p_closed_message:"Unit registration is currently closed. Please contact your institution administrator.",
    p_opens_at:schedule.opens,
    p_closes_at:schedule.closes
   });
   if(error)throw error;
   renderUnitRegistrationControl(data||{});
   if(showSuccess)notify(data?.status==="scheduled"?"Registration schedule saved. Student registration will open automatically.":data?.is_open?"Unit registration settings saved.":"Unit registration is closed.","success");
  }catch(e){
   notify("Unable to save unit registration settings: "+e.message,"error");
   await loadUnitRegistrationControl();
  }finally{if(toggle)toggle.disabled=false;}
 }
 async function saveUnitRegistrationSchedule(){
  const button=$("iaUnitRegistrationSaveSchedule");
  if(button){button.disabled=true;button.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Saving schedule…';}
  try{
   const schedule=currentSchedule();
   if(schedule.opens&&schedule.closes&&new Date(schedule.closes)<=new Date(schedule.opens))throw new Error("The closing deadline must be later than the opening date and time.");
   await persistUnitRegistrationControl(true,true);
  }catch(e){notify(e.message,"error");}
  finally{if(button){button.disabled=false;button.innerHTML='<i class="fa-solid fa-calendar-check"></i> Save registration schedule';}}
 }
 async function loadCatalog(){
  const body=$("iaUnitCatalogRows");if(body)body.innerHTML='<tr><td colspan="6" class="ia-empty">Loading unit catalogue…</td></tr>';
  try{
   const {data,error}=await db().from("units_catalog").select("*").eq("institution_id",tenant()).order("program").order("block").order("unit_code").limit(5000);
   if(error)throw error;catalog=data||[];
   const select=$("iaUnitCatalogProgram"),previous=select?.value||"";
   if(select){const programs=[...new Set(catalog.map(x=>String(x.program||"").trim()).filter(Boolean))].sort();select.innerHTML='<option value="">All programmes</option>'+programs.map(p=>'<option value="'+esc(p)+'">'+esc(p)+'</option>').join("");select.value=programs.includes(previous)?previous:"";}
   renderCatalog();
  }catch(e){if(body)body.innerHTML='<tr><td colspan="6" class="ia-empty">Unable to load this institution’s unit catalogue: '+esc(e.message)+'</td></tr>';}
 }
 function renderCatalog(){
  const body=$("iaUnitCatalogRows");if(!body)return;
  const q=($("iaUnitCatalogSearch")?.value||"").trim().toLowerCase(),program=$("iaUnitCatalogProgram")?.value||"";
  const rows=catalog.filter(x=>(!program||String(x.program||"")===program)&&(!q||[x.unit_code,x.unit_name,x.program,x.block].some(v=>String(v||"").toLowerCase().includes(q))));
  body.innerHTML=rows.length?rows.map(x=>'<tr><td>'+esc(x.unit_code)+'</td><td>'+esc(x.unit_name)+'</td><td>'+esc(x.program)+'</td><td>'+esc(x.block)+'</td><td>'+esc(x.credits??"—")+'</td><td>'+esc(x.status||"—")+'</td></tr>').join(""):'<tr><td colspan="6" class="ia-empty">No units match the selected filters.</td></tr>';
 }
 async function loadRegistrations(){
  const targets=["iaUnitRegistrationPendingRows","iaUnitRegistrationApprovedRows","iaUnitRegistrationRejectedRows"];
  targets.forEach(id=>{const el=$(id);if(el)el.innerHTML='<tr><td colspan="6" class="ia-empty">Loading registrations…</td></tr>';});
  try{
   const {data,error}=await db().from("student_unit_registrations").select("*").eq("institution_id",tenant()).order("submitted_date",{ascending:false}).limit(5000);
   if(error)throw error;
   registrations=data||[];
   const studentIds=[...new Set(registrations.map(r=>r.student_id).filter(Boolean))];
   if(studentIds.length){
    const {data:profiles,error:profileError}=await db().from("consolidated_user_profiles_table")
     .select("user_id,full_name,student_id,admission_number,email")
     .eq("institution_id",tenant()).in("user_id",studentIds);
    if(profileError)throw new Error("Student names could not be resolved: "+profileError.message);
    const byUser=new Map((profiles||[]).map(p=>[String(p.user_id),p]));
    registrations=registrations.map(r=>({...r,_studentProfile:byUser.get(String(r.student_id))||null}));
   }
   renderRegistrations();
  }catch(e){
   targets.forEach(id=>{const el=$(id);if(el)el.innerHTML='<tr><td colspan="6" class="ia-empty">Unable to load registrations: '+esc(e.message)+'</td></tr>';});
   notify("Unit registrations could not be loaded: "+e.message,"error");
  }
 }
 const norm=v=>String(v??"").trim().toLowerCase();
 const groupPeriod=r=>[r.program||"Programme not set",r.block||"Period not set",r.term||"",r.academic_year||"",r.intake_year||""].join(" · ");
 function registrationGroups(rows){
  const map=new Map();
  rows.forEach(r=>{
   const p=r._studentProfile||{};
   const person=String(r.student_id||p.student_id||r.admission_number||"unknown");
   const key=[person,groupPeriod(r)].join("::");
   if(!map.has(key))map.set(key,{key,rows:[],profile:p,first:r});
   map.get(key).rows.push(r);
  });
  return [...map.values()].sort((a,b)=>String(b.first.submitted_date||"").localeCompare(String(a.first.submitted_date||"")));
 }
 function groupStudentName(g){
  const p=g.profile||{},r=g.first;
  return val(p,"full_name")!=="—"?p.full_name:val(r,"student_name","full_name","name","admission_number","student_id");
 }
 function renderRegistrationGroup(g,status){
  const r=g.first,p=g.profile||{},name=groupStudentName(g),admission=val(p,"admission_number","student_id")!=="—"?val(p,"admission_number","student_id"):val(r,"admission_number");
  const id=esc(g.key),period=groupPeriod(r),pending=status==="pending";
  const expanded=!!window.__iaExpandedRegistrationGroups?.has(g.key);
  const units=g.rows.map(x=>{
   const canAct=pending;
   return '<div class="ia-reg-unit-row"><div class="ia-reg-unit-main"><b>'+esc(val(x,"unit_name","course_name"))+'</b><small>'+esc(val(x,"unit_code","course_code"))+' · '+esc(val(x,"credits"))+' credits</small></div><span class="ia-reg-unit-status">'+esc(norm(x.status)||"pending")+'</span>'+(canAct?'<div class="ia-reg-actions"><button class="ia-primary-btn" data-unit-reg-action="approved" data-unit-reg-id="'+esc(x.id)+'">Approve</button><button class="ia-secondary-btn" data-unit-reg-action="rejected" data-unit-reg-id="'+esc(x.id)+'">Reject</button></div>':'')+'</div>';
  }).join("");
  const bulk=pending?'<button class="ia-primary-btn" data-unit-reg-group-action="approved" data-unit-reg-group="'+id+'">Approve all '+g.rows.length+' units</button>':'';
  const submitted=date(g.rows.map(x=>x.submitted_date||x.created_at).filter(Boolean).sort().at(-1));
  return '<tr class="ia-reg-group-row"><td><button type="button" class="ia-reg-expand" data-reg-group-toggle="'+id+'" aria-expanded="'+expanded+'"><i class="fa-solid fa-chevron-'+(expanded?"down":"right")+'"></i><span><b>'+esc(name)+'</b><small>'+esc(admission)+'</small></span></button></td><td>'+esc(val(r,"program"))+'</td><td>'+esc(period)+'</td><td><span class="ia-reg-unit-count">'+g.rows.length+' unit'+(g.rows.length===1?"":"s")+'</span></td><td>'+submitted+'</td><td><div class="ia-reg-actions">'+bulk+'<button type="button" class="ia-secondary-btn" data-reg-group-toggle="'+id+'">'+(expanded?"Hide units":"View units")+'</button></div></td></tr>'+
  (expanded?'<tr class="ia-reg-detail-row"><td colspan="6"><div class="ia-reg-unit-list">'+units+'</div></td></tr>':"");
 }
 function selectedFilter(id){return norm($(id)?.value);}
 function filteredRegistrationRows(status){
  const q=norm($("iaUnitRegistrationSearch")?.value);
  const program=selectedFilter("iaRegFilterProgramme"),year=selectedFilter("iaRegFilterAcademicYear"),intake=selectedFilter("iaRegFilterIntake"),block=selectedFilter("iaRegFilterBlock"),term=selectedFilter("iaRegFilterTerm");
  return registrations.filter(r=>{
   if(norm(r.status||"pending")!==status)return false;
   if(program&&norm(r.program)!==program)return false;
   if(year&&norm(r.academic_year)!==year)return false;
   if(intake&&norm(r.intake_year)!==intake)return false;
   if(block&&norm(r.block)!==block)return false;
   if(term&&norm(r.term)!==term)return false;
   return !q||[groupStudentName({first:r,profile:r._studentProfile}),r._studentProfile?.student_id,r._studentProfile?.admission_number,r._studentProfile?.email,r.unit_name,r.unit_code,r.program,r.block,r.term,r.academic_year,r.intake_year].some(v=>norm(v).includes(q));
  });
 }
 function populateRegistrationFilters(){
  const definitions=[
   ["iaRegFilterProgramme","program","All programmes"],
   ["iaRegFilterAcademicYear","academic_year","All academic years"],
   ["iaRegFilterIntake","intake_year","All intakes"],
   ["iaRegFilterBlock","block","All blocks"],
   ["iaRegFilterTerm","term","All semesters / terms"]
  ];
  definitions.forEach(([id,key,placeholder])=>{
   const el=$(id);if(!el)return;
   const previous=el.value;
   const values=[...new Set(registrations.map(r=>String(r[key]??"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:"base"}));
   el.innerHTML='<option value="">'+placeholder+'</option>'+values.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join("");
   if(values.includes(previous))el.value=previous;
  });
 }
 function clearRegistrationFilters(){
  ["iaUnitRegistrationSearch","iaRegFilterProgramme","iaRegFilterAcademicYear","iaRegFilterIntake","iaRegFilterBlock","iaRegFilterTerm"].forEach(id=>{const el=$(id);if(el)el.value="";});
  renderRegistrations();
 }
 function renderRegistrationTable(status,targetId){
  const body=$(targetId);if(!body)return;
  const rows=filteredRegistrationRows(status);
  const groups=registrationGroups(rows);
  const countNode=$(status==="pending"?"iaRegPendingGroups":status==="approved"?"iaRegApprovedGroups":"iaRegRejectedGroups");
  if(countNode)countNode.textContent=groups.length+" student group"+(groups.length===1?"":"s");
  body.innerHTML=groups.length?groups.map(g=>renderRegistrationGroup(g,status)).join(""):'<tr><td colspan="6" class="ia-empty">No '+status+' registrations found.</td></tr>';
 }
 function renderRegistrations(){
  populateRegistrationFilters();
  const count=s=>registrations.filter(r=>norm(r.status||"pending")===s).length;
  $("iaRegTotal").textContent=registrations.length;$("iaRegPending").textContent=count("pending");$("iaRegApproved").textContent=count("approved");$("iaRegRejected").textContent=count("rejected");
  renderRegistrationTable("pending","iaUnitRegistrationPendingRows");
  renderRegistrationTable("approved","iaUnitRegistrationApprovedRows");
  renderRegistrationTable("rejected","iaUnitRegistrationRejectedRows");
 }
 async function decideRegistration(id,status){
  const row=registrations.find(r=>String(r.id)===String(id));if(!row)throw new Error("Registration was not found in this institution.");
  if(norm(row.status||"pending")!=="pending")throw new Error("Only pending registrations can be reviewed.");
  const patch={status,updated_at:new Date().toISOString()};
  if(status==="approved"){
   patch.approval_date=new Date().toISOString().slice(0,10);patch.approved_at=new Date().toISOString();
   try{const {data}=await db().auth.getUser();if(data?.user?.id)patch.approved_by=data.user.id;}catch(_){}
  }
  const {data,error}=await db().from("student_unit_registrations").update(patch).eq("id",id).eq("institution_id",tenant()).eq("status","pending").select("id").maybeSingle();
  if(error)throw error;if(!data)throw new Error("No registration was updated. It may already have been reviewed or your institution permissions may have changed.");
 }
 async function decideRegistrationGroup(groupKey,status){
  const group=registrationGroups(registrations.filter(r=>norm(r.status||"pending")==="pending")).find(g=>g.key===groupKey);
  if(!group)throw new Error("Pending student registration group not found.");
  const ids=group.rows.map(r=>r.id);
  const patch={status,updated_at:new Date().toISOString()};
  if(status==="approved"){
   patch.approval_date=new Date().toISOString().slice(0,10);patch.approved_at=new Date().toISOString();
   try{const {data}=await db().auth.getUser();if(data?.user?.id)patch.approved_by=data.user.id;}catch(_){}
  }
  const {data,error}=await db().from("student_unit_registrations").update(patch).eq("institution_id",tenant()).in("id",ids).eq("status","pending").select("id");
  if(error)throw error;
  if((data||[]).length!==ids.length)throw new Error("Only "+(data||[]).length+" of "+ids.length+" units were updated. Refresh the list and review the remaining pending units.");
 }
 function bind(){
  $("iaUnitCatalogRefresh")?.addEventListener("click",loadCatalog);
  $("iaUnitCatalogSearch")?.addEventListener("input",renderCatalog);
  $("iaUnitCatalogProgram")?.addEventListener("change",renderCatalog);
  $("iaUnitRegistrationRefresh")?.addEventListener("click",()=>{loadRegistrations();loadUnitRegistrationControl();});
  $("iaUnitRegistrationToggle")?.addEventListener("change",e=>persistUnitRegistrationControl(!!e.target.checked,true));
  $("iaUnitRegistrationSaveSchedule")?.addEventListener("click",saveUnitRegistrationSchedule);
  $("iaUnitRegistrationClearSchedule")?.addEventListener("click",async()=>{const o=$("iaUnitRegistrationOpensAt"),c=$("iaUnitRegistrationClosesAt");if(o)o.value="";if(c)c.value="";await persistUnitRegistrationControl(true,true);});
  $("iaUnitRegistrationSearch")?.addEventListener("input",renderRegistrations);
  ["iaRegFilterProgramme","iaRegFilterAcademicYear","iaRegFilterIntake","iaRegFilterBlock","iaRegFilterTerm"].forEach(id=>$(id)?.addEventListener("change",renderRegistrations));
  $("iaRegFiltersReset")?.addEventListener("click",clearRegistrationFilters);
  window.__iaExpandedRegistrationGroups=window.__iaExpandedRegistrationGroups||new Set();
  document.addEventListener("click",async e=>{
   const toggle=e.target.closest("[data-reg-group-toggle]");
   if(toggle){const key=toggle.dataset.regGroupToggle;if(window.__iaExpandedRegistrationGroups.has(key))window.__iaExpandedRegistrationGroups.delete(key);else window.__iaExpandedRegistrationGroups.add(key);renderRegistrations();return;}
   const bulk=e.target.closest("[data-unit-reg-group-action]");
   if(bulk){bulk.disabled=true;try{await decideRegistrationGroup(bulk.dataset.unitRegGroup,bulk.dataset.unitRegGroupAction);notify("All units in this student period were "+bulk.dataset.unitRegGroupAction+".","success");await loadRegistrations();}catch(err){notify("Unable to update student registrations: "+err.message,"error");}finally{bulk.disabled=false;}return;}
   const b=e.target.closest("[data-unit-reg-action]");
   if(b){b.disabled=true;try{await decideRegistration(b.dataset.unitRegId,b.dataset.unitRegAction);notify("Unit registration "+b.dataset.unitRegAction+".","success");await loadRegistrations();}catch(err){notify("Unable to update registration: "+err.message,"error");}finally{b.disabled=false;}}
  });
  window.addEventListener("campusnexus:institution-change",()=>{loadCatalog();loadRegistrations();loadUnitRegistrationControl();});
  window.addEventListener("campusnexus:curriculum-refresh",loadCatalog);
 }
 function start(){api=window.CampusInstitutionAdmin;if(!api?.db||!api?.institutionId){setTimeout(start,120);return;}bind();loadCatalog();loadRegistrations();loadUnitRegistrationControl();}
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
