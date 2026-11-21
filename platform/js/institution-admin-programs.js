/* Campus Nexus Institution Admin — canonical Super Admin Program Management adaptation.
 * Source markup and workflows are preserved from NCHSM-Digital-campus-/superadmin.html.
 * Tenant scoping is applied to every institution-owned query and mutation.
 */
(() => {
"use strict";
const $ = id => document.getElementById(id);
const TABLES = { programs:"programs", intakes:"program_intakes", blocks:"program_blocks", mappings:"program_courses", courses:"courses" };
let api = null, programs = [];
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const notify = (message, type="info") => {
  if (typeof window.showNotification === "function") window.showNotification(message, type);
  else if (typeof window.showFeedback === "function") window.showFeedback(message, type);
  else { const host=$("iaNotice"); if(host){host.textContent=message;host.hidden=false;host.classList.toggle("error",type==="error");} else alert(message); }
};
const db = () => { if(!api?.db || !api?.institutionId) throw new Error("Institution session is not ready. Refresh and sign in again."); return api.db; };
const tenant = () => { if(!api?.institutionId) throw new Error("Your active institution could not be verified."); return api.institutionId; };
const programQuery = () => db().from(TABLES.programs);
const ownProgram = async id => {
 const {data,error}=await programQuery().select("id,program_code,category").eq("id",id).eq("institution_id",tenant()).maybeSingle();
 if(error) throw error; if(!data) throw new Error("This programme does not belong to your institution."); return data;
};
const empty = (id,cols,message) => {const body=$(id);if(body)body.innerHTML='<tr><td colspan="'+cols+'" style="padding:28px;text-align:center;color:#64748b">'+esc(message)+'</td></tr>';};
async function loadAllPrograms(){
 try {
  const {data,error}=await programQuery().select("*").eq("institution_id",tenant()).order("program_code");
  if(error)throw error; programs=data||[];
  await renderProgramsTable(programs); updateProgramStats(programs); populateProgramSelectors(programs);
  await updateProgramTotals(); return programs;
 } catch(error){console.error("[Institution programmes]",error);empty("programs-table-body",10,"Unable to load programmes: "+error.message);notify("Unable to load programmes: "+error.message,"error");return [];}
}
async function renderProgramsTable(rows){
 const body=$("programs-table-body");if(!body)return;
 if(!rows.length){empty("programs-table-body",10,"No programmes found for this institution. Create your first programme above.");return;}
 body.innerHTML="";
 for(const p of rows){
  const [intakes,blocks]=await Promise.all([
   db().from(TABLES.intakes).select("id",{count:"exact",head:true}).eq("program_id",p.id).eq("institution_id",tenant()),
   db().from(TABLES.blocks).select("id",{count:"exact",head:true}).eq("program_id",p.id).eq("institution_id",tenant())
  ]);
  if(intakes.error)throw intakes.error;if(blocks.error)throw blocks.error;
  const tr=document.createElement("tr");
  const typeEmoji={diploma:"🎓",certificate:"📜",artisan:"🔧",degree:"🎓",other:"📊"};
  tr.innerHTML='<td><strong>'+esc(p.program_code)+'</strong></td><td>'+esc(p.program_name)+'</td><td><span class="program-badge '+(p.category==="KRCHN"?"program-badge-krchn":"program-badge-tvet")+'">'+esc(p.category)+'</span></td><td>'+esc((typeEmoji[p.program_type]||"📚")+" "+(p.program_type||"—"))+'</td><td>'+esc(p.duration_months||"-")+' mo</td><td>'+esc(p.total_credits||"-")+'</td><td><span class="badge badge-info" data-open-intakes="'+esc(p.id)+'" style="cursor:pointer">'+(intakes.count||0)+' <i class="fas fa-calendar-plus"></i></span></td><td><span class="badge badge-info" data-open-blocks="'+esc(p.id)+'" style="cursor:pointer">'+(blocks.count||0)+' <i class="fas fa-layer-group"></i></span></td><td><span class="program-badge program-badge-'+esc(p.status||"inactive")+'">'+esc(p.status||"inactive")+'</span></td><td><button type="button" class="btn-sm btn-edit" data-edit-program="'+esc(p.id)+'" title="Edit Program"><i class="fas fa-edit"></i></button> <button type="button" class="btn-sm btn-delete" data-delete-program="'+esc(p.id)+'" title="Delete Program"><i class="fas fa-trash"></i></button></td>';
  body.append(tr);
 }
}
function updateProgramStats(rows){
 const active=rows.filter(p=>p.status==="active").length,inactive=rows.filter(p=>["inactive","archived"].includes(p.status)).length;
 if($("activeProgramsCount"))$("activeProgramsCount").textContent=active;
 if($("inactiveProgramsCount"))$("inactiveProgramsCount").textContent=inactive;
}
async function updateProgramTotals(){
 const [i,b]=await Promise.all([
  db().from(TABLES.intakes).select("id",{count:"exact",head:true}).eq("institution_id",tenant()),
  db().from(TABLES.blocks).select("id",{count:"exact",head:true}).eq("institution_id",tenant())
 ]);
 if(i.error)throw i.error;if(b.error)throw b.error;
 if($("totalIntakesCount"))$("totalIntakesCount").textContent=i.count||0;
 if($("totalBlocksCount"))$("totalBlocksCount").textContent=b.count||0;
}
function populateProgramSelectors(rows){
 ["intake_program_select","block_program_select","mapping_program_select"].forEach(id=>{
  const select=$(id);if(!select)return;const current=select.value;
  select.innerHTML='<option value="">-- Select Program --</option>';
  rows.forEach(p=>{const opt=document.createElement("option");opt.value=p.id;opt.textContent=p.program_code+" - "+p.program_name;select.append(opt);});
  if(rows.some(p=>p.id===current))select.value=current;
 });
}
async function createProgram(){
 const form=$("add-program-form");if(!form)return;
 const code=$("program_code").value.trim().toUpperCase(),name=$("program_name").value.trim();
 if(!code||!name){notify("Program Code and Name are required!","error");return;}
 const editId=form.dataset.editId;
 const payload={program_code:code,program_name:name,category:$("program_category").value,program_type:$("program_type").value,duration_months:parseInt($("program_duration").value)||0,total_credits:parseInt($("program_credits").value)||0,description:$("program_description").value.trim(),status:$("program_status").value,updated_at:new Date().toISOString()};
 try{
  if(editId){const {error}=await programQuery().update(payload).eq("id",editId).eq("institution_id",tenant());if(error)throw error;notify("Programme updated successfully.","success");}
  else {
   const {data:duplicate,error:check}=await programQuery().select("id").eq("program_code",code).eq("institution_id",tenant()).maybeSingle();
   if(check)throw check;if(duplicate)throw new Error('Programme code "'+code+'" already exists in this institution.');
   payload.institution_id=tenant();payload.created_at=new Date().toISOString();
   const {data,error}=await programQuery().insert(payload).select("id,category").single();if(error)throw error;
   notify("Programme created successfully.","success");await autoCreateBlocks(data.id,data.category);
  }
  resetProgramForm();await loadAllPrograms();
 }catch(error){notify("Unable to save programme: "+error.message,"error");}
}
async function autoCreateBlocks(programId,category){
 const isTVET=category==="TVET";
 const blocks=isTVET?[["Introductory",0,12],["Term 1",1,14],["Term 2",2,14],["Term 3",3,14],["Term 4",4,14],["Term 5",5,14],["Term 6",6,14],["Final",7,12]]:[["Introductory",0,15],["Block 1",1,18],["Block 2",2,18],["Block 3",3,18],["Block 4",4,18],["Block 5",5,18],["Final",6,15]];
 const payload=blocks.map(([block_name,block_sequence,credit_hours])=>({institution_id:tenant(),program_id:programId,block_name,block_sequence,credit_hours,status:"active",created_at:new Date().toISOString(),updated_at:new Date().toISOString()}));
 const {error}=await db().from(TABLES.blocks).insert(payload);if(error)throw error;
}
function resetProgramForm(){
 const form=$("add-program-form");form?.reset();if(form){form.dataset.editId="";form.onsubmit=e=>{e.preventDefault();createProgram();};}
 const btn=form?.querySelector('button[type="submit"]');if(btn){btn.innerHTML='<i class="fas fa-save"></i> Create Program';btn.style.background="#4C1D95";}
}
async function editProgram(id){
 try{const {data,error}=await programQuery().select("*").eq("id",id).eq("institution_id",tenant()).single();if(error)throw error;
  $("program_code").value=data.program_code||"";$("program_name").value=data.program_name||"";$("program_category").value=data.category||"KRCHN";$("program_type").value=data.program_type||"diploma";$("program_duration").value=data.duration_months||"";$("program_credits").value=data.total_credits||"";$("program_description").value=data.description||"";$("program_status").value=data.status||"active";
  const form=$("add-program-form");form.dataset.editId=id;const btn=form.querySelector('button[type="submit"]');btn.innerHTML='<i class="fas fa-save"></i> Update Program';btn.style.background="#f59e0b";window.scrollTo({top:0,behavior:"smooth"});
 }catch(error){notify("Unable to load programme: "+error.message,"error");}
}
async function deleteProgram(id){
 if(!confirm("Are you sure you want to delete this programme and its associated intakes, blocks and mappings?"))return;
 try{await ownProgram(id);const {error}=await programQuery().delete().eq("id",id).eq("institution_id",tenant());if(error)throw error;notify("Programme deleted.","success");await loadAllPrograms();}
 catch(error){notify("Unable to delete programme: "+error.message,"error");}
}
function filterPrograms(status){if($("program_status_filter"))$("program_status_filter").value=status;filterProgramsTable();}
function filterProgramsTable(){
 const search=($("program_search")?.value||"").toLowerCase(),category=$("program_category_filter")?.value||"all",type=$("program_type_filter")?.value||"all",status=$("program_status_filter")?.value||"all";
 document.querySelectorAll("#programs-table-body tr").forEach(row=>{const text=row.textContent.toLowerCase(),cat=row.cells?.[2]?.textContent||"",typ=row.cells?.[3]?.textContent||"",st=row.cells?.[8]?.textContent?.toLowerCase()||"";row.style.display=(!search||text.includes(search))&&(category==="all"||cat.includes(category))&&(type==="all"||typ.toLowerCase().includes(type))&&(status==="all"||st.includes(status))?"":"none";});
}
function exportProgramsToCSV(){
 const rows=[...document.querySelectorAll("#programs-table-body tr")].filter(r=>r.style.display!=="none"&&r.cells.length>=9);
 const csv=["Code,Name,Category,Type,Duration,Credits,Status",...rows.map(r=>[0,1,2,3,4,5,8].map(i=>'"'+(r.cells[i]?.textContent||"").trim().replace(/"/g,'""')+'"').join(","))].join("\n");
 const blob=new Blob([csv],{type:"text/csv"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="Programs_Export_"+new Date().toISOString().slice(0,10)+".csv";a.click();URL.revokeObjectURL(url);notify("Programmes exported.","success");
}
async function loadProgramIntakes(){const id=$("intake_program_select")?.value;if(!id){empty("program-intakes-container",1,"Select a program to view its intakes.");return;}await loadIntakesForProgram(id);}
async function loadIntakesForProgram(id){
 await ownProgram(id);const {data,error}=await db().from(TABLES.intakes).select("*").eq("program_id",id).eq("institution_id",tenant()).order("intake_year",{ascending:false});if(error)throw error;
 const host=$("program-intakes-container");if(!data?.length){host.innerHTML='<p style="text-align:center;padding:20px;color:#64748b">No intakes found for this program.</p>';return;}
 host.innerHTML='<table class="data-table" style="width:100%"><thead><tr><th>Intake Name</th><th>Year</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+data.map(i=>'<tr><td><strong>'+esc(i.intake_name)+'</strong></td><td>'+esc(i.intake_year)+'</td><td>'+esc(i.status)+'</td><td><button class="btn-sm btn-delete" data-delete-intake="'+esc(i.id)+'"><i class="fas fa-trash"></i></button></td></tr>').join("")+'</tbody></table>';
 if($("totalIntakesCount"))$("totalIntakesCount").textContent=data.length;
}
async function addProgramIntake(){
 const id=$("intake_program_select")?.value,name=$("intake_name").value.trim(),year=parseInt($("intake_year").value)||new Date().getFullYear(),status=$("intake_status").value;
 if(!id){notify("Please select a program first.","error");return;}if(!name){notify("Please enter an intake name.","error");return;}
 try{await ownProgram(id);const {data:dup,error:check}=await db().from(TABLES.intakes).select("id").eq("program_id",id).eq("intake_name",name).eq("institution_id",tenant()).maybeSingle();if(check)throw check;if(dup)throw new Error("This intake already exists for the selected programme.");
 const payload={institution_id:tenant(),program_id:id,intake_name:name,intake_year:year,status,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};const {error}=await db().from(TABLES.intakes).insert(payload);if(error)throw error;$("intake_name").value="";$("intake_year").value="";notify("Intake added successfully.","success");await loadProgramIntakes();await updateProgramTotals();
 }catch(error){notify("Unable to add intake: "+error.message,"error");}
}
async function deleteIntake(id){
 if(!confirm("Delete this intake?"))return;
 try{const {data,error:readError}=await db().from(TABLES.intakes).select("id,program_id").eq("id",id).eq("institution_id",tenant()).maybeSingle();if(readError)throw readError;if(!data)throw new Error("Intake not found in this institution.");const {error}=await db().from(TABLES.intakes).delete().eq("id",id).eq("institution_id",tenant());if(error)throw error;await loadIntakesForProgram(data.program_id);await updateProgramTotals();}
 catch(error){notify("Unable to delete intake: "+error.message,"error");}
}
async function loadProgramBlocks(){const id=$("block_program_select")?.value;if(!id){empty("program-blocks-container",1,"Select a program to view its blocks.");return;}await loadBlocksForProgram(id);}
async function loadBlocksForProgram(id){
 await ownProgram(id);const {data,error}=await db().from(TABLES.blocks).select("*").eq("program_id",id).eq("institution_id",tenant()).order("block_sequence",{ascending:true});if(error)throw error;
 const host=$("program-blocks-container");if(!data?.length){host.innerHTML='<p style="text-align:center;padding:20px;color:#64748b">No blocks defined for this program.</p>';return;}
 host.innerHTML='<table class="data-table" style="width:100%"><thead><tr><th>#</th><th>Block Name</th><th>Sequence</th><th>Credit Hours</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+data.map((b,i)=>'<tr><td>'+(i+1)+'</td><td><strong>'+esc(b.block_name)+'</strong></td><td>'+esc(b.block_sequence)+'</td><td>'+esc(b.credit_hours||"-")+'</td><td>'+esc(b.status||"active")+'</td><td><button class="btn-sm btn-delete" data-delete-block="'+esc(b.id)+'"><i class="fas fa-trash"></i></button></td></tr>').join("")+'</tbody></table>';
 if($("totalBlocksCount"))$("totalBlocksCount").textContent=data.length;
}
async function addProgramBlock(){
 const id=$("block_program_select")?.value,name=$("block_name").value.trim(),sequence=parseInt($("block_sequence").value)||0,hours=parseInt($("block_credit_hours").value)||0;
 if(!id){notify("Please select a program first.","error");return;}if(!name){notify("Please enter a block name.","error");return;}
 try{await ownProgram(id);const payload={institution_id:tenant(),program_id:id,block_name:name,block_sequence:sequence,credit_hours:hours,status:"active",created_at:new Date().toISOString(),updated_at:new Date().toISOString()};const {error}=await db().from(TABLES.blocks).insert(payload);if(error)throw error;$("block_name").value="";$("block_sequence").value="";$("block_credit_hours").value="";notify("Block added successfully.","success");await loadProgramBlocks();await updateProgramTotals();}
 catch(error){notify("Unable to add block: "+error.message,"error");}
}
async function deleteBlock(id){
 if(!confirm("Delete this block?"))return;
 try{const {data,error:readError}=await db().from(TABLES.blocks).select("id,program_id").eq("id",id).eq("institution_id",tenant()).maybeSingle();if(readError)throw readError;if(!data)throw new Error("Block not found in this institution.");const {error}=await db().from(TABLES.blocks).delete().eq("id",id).eq("institution_id",tenant());if(error)throw error;await loadBlocksForProgram(data.program_id);await updateProgramTotals();}
 catch(error){notify("Unable to delete block: "+error.message,"error");}
}
async function populateCourseSelector(){
 const {data,error}=await db().from(TABLES.courses).select("id,course_name,unit_code,code").eq("institution_id",tenant()).order("course_name");if(error)throw error;
 const select=$("mapping_course_select");if(select){select.innerHTML='<option value="">-- Select Course --</option>';(data||[]).forEach(c=>{const o=document.createElement("option");o.value=c.id;o.textContent=(c.course_name||"Course")+" ("+(c.unit_code||c.code||"N/A")+")";select.append(o);});}
}
async function populateBlockSelector(programId){
 await ownProgram(programId);const {data,error}=await db().from(TABLES.blocks).select("block_name").eq("program_id",programId).eq("institution_id",tenant()).eq("status","active").order("block_sequence");if(error)throw error;
 const select=$("mapping_block_select");if(select){select.innerHTML='<option value="">-- Any Block --</option>';(data||[]).forEach(b=>{const o=document.createElement("option");o.value=b.block_name;o.textContent=b.block_name;select.append(o);});}
}
async function loadProgramMappings(){
 const id=$("mapping_program_select")?.value,host=$("program-mappings-container");if(!id){host.innerHTML='<p style="text-align:center;padding:20px;color:#64748b">Select a program to view its course mappings.</p>';return;}
 try{await ownProgram(id);const {data,error}=await db().from(TABLES.mappings).select("*,course:courses(id,course_name,unit_code,code,institution_id)").eq("program_id",id).order("created_at",{ascending:false});if(error)throw error;
 const rows=(data||[]).filter(m=>m.course?.institution_id===tenant());if(!rows.length){host.innerHTML='<p style="text-align:center;padding:20px;color:#64748b">No courses mapped to this program.</p>';return;}
 host.innerHTML='<table class="data-table" style="width:100%"><thead><tr><th>Course</th><th>Unit Code</th><th>Block</th><th>Type</th><th>Actions</th></tr></thead><tbody>'+rows.map(m=>'<tr><td>'+esc(m.course?.course_name||"Unknown")+'</td><td>'+esc(m.course?.unit_code||m.course?.code||"-")+'</td><td>'+esc(m.block_name||"Any")+'</td><td>'+ (m.is_core?"Core":"Elective")+'</td><td><button class="btn-sm btn-delete" data-delete-mapping="'+esc(m.id)+'" data-program-id="'+esc(id)+'"><i class="fas fa-trash"></i></button></td></tr>').join("")+'</tbody></table>';
 }catch(error){notify("Unable to load programme mappings: "+error.message,"error");}
}
async function addProgramCourseMapping(){
 const programId=$("mapping_program_select")?.value,courseId=$("mapping_course_select")?.value,blockName=$("mapping_block_select")?.value||null,isCore=$("mapping_is_core")?.value==="true";
 if(!programId||!courseId){notify("Please select a program and a course.","error");return;}
 try{
  await ownProgram(programId);
  const {data:course,error:courseError}=await db().from(TABLES.courses).select("id,institution_id").eq("id",courseId).eq("institution_id",tenant()).maybeSingle();if(courseError)throw courseError;if(!course)throw new Error("The selected course does not belong to this institution.");
  const {data:duplicate,error:check}=await db().from(TABLES.mappings).select("id").eq("program_id",programId).eq("course_id",courseId).maybeSingle();if(check)throw check;if(duplicate)throw new Error("This course is already mapped to this programme.");
  const {error}=await db().from(TABLES.mappings).insert({program_id:programId,course_id:courseId,block_name:blockName,is_core:isCore,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});if(error)throw error;
  notify("Course mapped to programme successfully.","success");await loadProgramMappings();
 }catch(error){notify("Unable to map course: "+error.message,"error");}
}
async function deleteMapping(id){
 if(!confirm("Remove this course mapping?"))return;
 try{const {data,error:readError}=await db().from(TABLES.mappings).select("id,program_id,course_id").eq("id",id).maybeSingle();if(readError)throw readError;if(!data)throw new Error("Mapping not found.");await ownProgram(data.program_id);const {data:course,error:courseError}=await db().from(TABLES.courses).select("id").eq("id",data.course_id).eq("institution_id",tenant()).maybeSingle();if(courseError)throw courseError;if(!course)throw new Error("The mapped course is outside this institution.");const {error}=await db().from(TABLES.mappings).delete().eq("id",id).eq("program_id",data.program_id);if(error)throw error;await loadProgramMappings();}
 catch(error){notify("Unable to remove mapping: "+error.message,"error");}
}
function showProgramIntakes(){$("intake_program_select")?.scrollIntoView({behavior:"smooth"});}
function showProgramBlocks(){$("block_program_select")?.scrollIntoView({behavior:"smooth"});}
function bind(){
 ["program_search","program_category_filter","program_type_filter","program_status_filter"].forEach(id=>$(id)?.addEventListener(id==="program_search"?"input":"change",filterProgramsTable));
 $("intake_program_select")?.addEventListener("change",()=>loadProgramIntakes().catch(e=>notify(e.message,"error")));
 $("block_program_select")?.addEventListener("change",()=>loadProgramBlocks().catch(e=>notify(e.message,"error")));
 $("mapping_program_select")?.addEventListener("change",async()=>{try{await loadProgramMappings();await populateBlockSelector($("mapping_program_select").value);}catch(e){notify(e.message,"error");}});
 document.addEventListener("click",async e=>{
  const edit=e.target.closest("[data-edit-program]");if(edit){await editProgram(edit.dataset.editProgram);return;}
  const del=e.target.closest("[data-delete-program]");if(del){await deleteProgram(del.dataset.deleteProgram);return;}
  const intake=e.target.closest("[data-delete-intake]");if(intake){await deleteIntake(intake.dataset.deleteIntake);return;}
  const block=e.target.closest("[data-delete-block]");if(block){await deleteBlock(block.dataset.deleteBlock);return;}
  const mapping=e.target.closest("[data-delete-mapping]");if(mapping){await deleteMapping(mapping.dataset.deleteMapping);return;}
  const openIntakes=e.target.closest("[data-open-intakes]");if(openIntakes){$("intake_program_select").value=openIntakes.dataset.openIntakes;await loadProgramIntakes();showProgramIntakes();return;}
  const openBlocks=e.target.closest("[data-open-blocks]");if(openBlocks){$("block_program_select").value=openBlocks.dataset.openBlocks;await loadProgramBlocks();showProgramBlocks();}
 });
 $("mapping_course_select")?.addEventListener("focus",()=>populateCourseSelector().catch(e=>notify(e.message,"error")));
 $("program_search")?.addEventListener("keyup",filterProgramsTable);
 window.addEventListener("campusnexus:institution-change",()=>loadAllPrograms());
}
function waitForApi(){
 api=window.CampusInstitutionAdmin;
 if(!api?.db||!api?.institutionId){setTimeout(waitForApi,120);return;}
 bind();loadAllPrograms().then(populateCourseSelector).catch(e=>notify("Programme workspace failed to initialise: "+e.message,"error"));
}
window.loadAllPrograms=loadAllPrograms;
window.createProgram=createProgram;
window.editProgram=editProgram;
window.deleteProgram=deleteProgram;
window.filterPrograms=filterPrograms;
window.filterProgramsTable=filterProgramsTable;
window.exportProgramsToCSV=exportProgramsToCSV;
window.loadProgramIntakes=loadProgramIntakes;
window.loadIntakesForProgram=loadIntakesForProgram;
window.addProgramIntake=addProgramIntake;
window.deleteIntake=deleteIntake;
window.loadProgramBlocks=loadProgramBlocks;
window.loadBlocksForProgram=loadBlocksForProgram;
window.addProgramBlock=addProgramBlock;
window.deleteBlock=deleteBlock;
window.loadProgramMappings=loadProgramMappings;
window.addProgramCourseMapping=addProgramCourseMapping;
window.deleteMapping=deleteMapping;
window.populateCourseSelector=populateCourseSelector;
window.populateBlockSelector=populateBlockSelector;
window.showProgramIntakes=showProgramIntakes;
window.showProgramBlocks=showProgramBlocks;
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",waitForApi,{once:true});else waitForApi();
})();
