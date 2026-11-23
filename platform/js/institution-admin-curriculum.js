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
  const body=$("iaUnitRegistrationRows");if(body)body.innerHTML='<tr><td colspan="8" class="ia-empty">Loading registrations…</td></tr>';
  try{
   const {data,error}=await db().from("student_unit_registrations").select("*").eq("institution_id",tenant()).order("submitted_date",{ascending:false}).limit(5000);
   if(error)throw error;registrations=data||[];renderRegistrations();
  }catch(e){if(body)body.innerHTML='<tr><td colspan="8" class="ia-empty">Unable to load institution registrations: '+esc(e.message)+'</td></tr>';notify("Unit registrations could not be loaded: "+e.message,"error");}
 }
 function renderRegistrations(){
  const body=$("iaUnitRegistrationRows");if(!body)return;
  const q=($("iaUnitRegistrationSearch")?.value||"").trim().toLowerCase(),status=($("iaUnitRegistrationStatus")?.value||"").toLowerCase();
  const count=s=>registrations.filter(r=>String(r.status||"pending").toLowerCase()===s).length;
  $("iaRegTotal").textContent=registrations.length;$("iaRegPending").textContent=count("pending");$("iaRegApproved").textContent=count("approved");$("iaRegRejected").textContent=count("rejected");
  const rows=registrations.filter(r=>(!status||String(r.status||"pending").toLowerCase()===status)&&(!q||[r.student_name,r.full_name,r.name,r.student_id,r.unit_name,r.unit_code,r.program,r.course].some(v=>String(v||"").toLowerCase().includes(q))));
  body.innerHTML=rows.length?rows.map(r=>{
   const s=String(r.status||"pending").toLowerCase(),pending=s==="pending";
   return '<tr><td>'+esc(val(r,"student_name","full_name","name","student_id"))+'</td><td>'+esc(val(r,"unit_name","course_name"))+'</td><td>'+esc(val(r,"unit_code","course_code"))+'</td><td>'+esc(val(r,"program","course"))+'</td><td>'+esc(val(r,"block","semester","term","block_term"))+'</td><td>'+date(val(r,"submitted_date","created_at"))+'</td><td><span class="ia-status-pill">'+esc(s)+'</span></td><td>'+(pending?'<button class="ia-primary-btn" data-unit-reg-action="approved" data-unit-reg-id="'+esc(r.id)+'">Approve</button> <button class="ia-secondary-btn" data-unit-reg-action="rejected" data-unit-reg-id="'+esc(r.id)+'">Reject</button>':'—')+'</td></tr>';
  }).join(""):'<tr><td colspan="8" class="ia-empty">No registrations match the selected filters.</td></tr>';
 }
 async function decideRegistration(id,status){
  const row=registrations.find(r=>String(r.id)===String(id));if(!row)throw new Error("Registration was not found in this institution.");
  if(String(row.status||"pending").toLowerCase()!=="pending")throw new Error("Only pending registrations can be reviewed.");
  const {data,error}=await db().from("student_unit_registrations").update({status}).eq("id",id).eq("institution_id",tenant()).select("id").maybeSingle();
  if(error)throw error;if(!data)throw new Error("No registration was updated. Check institution permissions and row-level security.");
  notify("Unit registration "+status+".","success");await loadRegistrations();
 }
 function bind(){
  $("iaUnitCatalogRefresh")?.addEventListener("click",loadCatalog);
  $("iaUnitCatalogSearch")?.addEventListener("input",renderCatalog);
  $("iaUnitCatalogProgram")?.addEventListener("change",renderCatalog);
  $("iaUnitRegistrationRefresh")?.addEventListener("click",loadRegistrations);
  $("iaUnitRegistrationSearch")?.addEventListener("input",renderRegistrations);
  $("iaUnitRegistrationStatus")?.addEventListener("change",renderRegistrations);
  document.addEventListener("click",e=>{const b=e.target.closest("[data-unit-reg-action]");if(!b)return;b.disabled=true;decideRegistration(b.dataset.unitRegId,b.dataset.unitRegAction).catch(err=>notify("Unable to update registration: "+err.message,"error")).finally(()=>{b.disabled=false;});});
  window.addEventListener("campusnexus:institution-change",()=>{loadCatalog();loadRegistrations();});
 }
 function start(){api=window.CampusInstitutionAdmin;if(!api?.db||!api?.institutionId){setTimeout(start,120);return;}bind();loadCatalog();loadRegistrations();}
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
