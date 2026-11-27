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
 function renderRegistrationTable(status,targetId){
  const body=$(targetId);if(!body)return;
  const q=norm($("iaUnitRegistrationSearch")?.value);
  const rows=registrations.filter(r=>norm(r.status||"pending")===status&&(!q||[groupStudentName({first:r,profile:r._studentProfile}),r._studentProfile?.student_id,r._studentProfile?.admission_number,r._studentProfile?.email,r.unit_name,r.unit_code,r.program,r.block,r.term,r.academic_year].some(v=>norm(v).includes(q))));
  const groups=registrationGroups(rows);
  body.innerHTML=groups.length?groups.map(g=>renderRegistrationGroup(g,status)).join(""):'<tr><td colspan="6" class="ia-empty">No '+status+' registrations found.</td></tr>';
 }
 function renderRegistrations(){
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
  $("iaUnitRegistrationRefresh")?.addEventListener("click",loadRegistrations);
  $("iaUnitRegistrationSearch")?.addEventListener("input",renderRegistrations);
  window.__iaExpandedRegistrationGroups=window.__iaExpandedRegistrationGroups||new Set();
  document.addEventListener("click",async e=>{
   const toggle=e.target.closest("[data-reg-group-toggle]");
   if(toggle){const key=toggle.dataset.regGroupToggle;if(window.__iaExpandedRegistrationGroups.has(key))window.__iaExpandedRegistrationGroups.delete(key);else window.__iaExpandedRegistrationGroups.add(key);renderRegistrations();return;}
   const bulk=e.target.closest("[data-unit-reg-group-action]");
   if(bulk){bulk.disabled=true;try{await decideRegistrationGroup(bulk.dataset.unitRegGroup,bulk.dataset.unitRegGroupAction);notify("All units in this student period were "+bulk.dataset.unitRegGroupAction+".","success");await loadRegistrations();}catch(err){notify("Unable to update student registrations: "+err.message,"error");}finally{bulk.disabled=false;}return;}
   const b=e.target.closest("[data-unit-reg-action]");
   if(b){b.disabled=true;try{await decideRegistration(b.dataset.unitRegId,b.dataset.unitRegAction);notify("Unit registration "+b.dataset.unitRegAction+".","success");await loadRegistrations();}catch(err){notify("Unable to update registration: "+err.message,"error");}finally{b.disabled=false;}}
  });
  window.addEventListener("campusnexus:institution-change",()=>{loadCatalog();loadRegistrations();});
  window.addEventListener("campusnexus:curriculum-refresh",loadCatalog);
 }
 function start(){api=window.CampusInstitutionAdmin;if(!api?.db||!api?.institutionId){setTimeout(start,120);return;}bind();loadCatalog();loadRegistrations();}
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
