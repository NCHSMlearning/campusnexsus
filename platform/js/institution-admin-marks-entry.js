/* Campus Nexus Institution Admin — tenant-scoped marks capture.
 * Mirrors the Super Admin CAT/exam calculation and submission workflow.
 * Every marks read/write is constrained to the verified institution_id.
 */
(() => {
 "use strict";
 const $=id=>document.getElementById(id);
 let api=null,units=[],rows=[],loading=false,saving=false;
 const db=()=>{if(!api?.db||!api?.institutionId||!api?.user?.id)throw new Error("Your institution administrator session is not ready.");return api.db;};
 const tenant=()=>api.institutionId;
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const say=(message,bad=false)=>{const el=$("iaMECaptureNotice");if(el){el.textContent=message;el.style.color=bad?"#a12b2b":"#16634a";}};
 const isTVET=program=>String(program||"").trim().toUpperCase()!=="KRCHN";
 const gradeFor=(score,program)=>{const n=Number(score);if(!Number.isFinite(n))return "PENDING";if(n>=75)return "A";if(n>=65)return "B";if(isTVET(program))return n>=50?"C":"FAIL";return n>=60?"C":"D";};
 function calculate(cat1,cat2,exam,type,program){
  const c1=Math.min(Math.max(Number(cat1)||0,0),30),c2=Math.min(Math.max(Number(cat2)||0,0),30),e=Math.min(Math.max(Number(exam)||0,0),100);
  let total=0;
  if(isTVET(program)){
   switch(type){case "single_cat":total=((c1+e)/130)*100;break;case "exam_only":total=e;break;case "cats_only":total=((c1+c2)/60)*100;break;case "cat_only":total=(c1/30)*100;break;default:total=((c1+c2+e)/160)*100;}
  }else{
   switch(type){case "single_cat":total=c1+e;break;case "exam_only":total=e;break;case "cats_only":total=((c1+c2)/60)*100;break;case "cat_only":total=(c1/30)*100;break;default:total=((c1+c2)/60*30)+Math.min(e,70);}
  }
  return Math.min(Math.round(total*10)/10,100);
 }
 function option(el,value,label){const o=document.createElement("option");o.value=String(value??"");o.textContent=String(label??value??"");el.append(o);}
 function fill(id,values,placeholder){const el=$(id);if(!el)return;const old=el.value;el.replaceChildren();option(el,"",placeholder);[...new Set(values.filter(v=>v!==null&&v!==undefined&&String(v).trim()!=="").map(String))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).forEach(v=>option(el,v,v));if([...el.options].some(o=>o.value===old))el.value=old;}
 async function loadPrograms(){
  if(loading)return;loading=true;
  try{
   const {data,error}=await db().from("units_catalog").select("program").eq("status","active").or("institution_id.is.null,institution_id.eq."+tenant()).limit(5000);
   if(error)throw error;
   fill("iaMEProgramSelect",(data||[]).map(x=>x.program),"Select programme");
   say("Choose a programme, block, unit and academic year.");
  }catch(e){say("Programmes could not be loaded: "+e.message,true);}
  finally{loading=false;}
 }
 async function loadBlocks(){
  const program=$("iaMEProgramSelect")?.value||"";
  fill("iaMEBlockSelect",[],"Select block");fill("iaMEUnitSelect",[],"Select unit");units=[];
  if(!program)return;
  try{const {data,error}=await db().from("units_catalog").select("block").eq("program",program).eq("status","active").or("institution_id.is.null,institution_id.eq."+tenant()).limit(5000);if(error)throw error;fill("iaMEBlockSelect",(data||[]).map(x=>x.block),"Select block");}
  catch(e){say("Blocks could not be loaded: "+e.message,true);}
 }
 async function loadUnits(){
  const program=$("iaMEProgramSelect")?.value||"",block=$("iaMEBlockSelect")?.value||"";
  fill("iaMEUnitSelect",[],"Select unit");units=[];
  if(!program||!block)return;
  try{const {data,error}=await db().from("units_catalog").select("unit_code,unit_name,assessment_type,program,block").eq("program",program).eq("block",block).eq("status","active").or("institution_id.is.null,institution_id.eq."+tenant()).order("unit_name",{ascending:true}).limit(1000);if(error)throw error;units=data||[];const el=$("iaMEUnitSelect");el.replaceChildren();option(el,"","Select unit");units.forEach(u=>option(el,u.unit_name,(u.unit_code?u.unit_code+" · ":"")+u.unit_name));if(units.length===1)el.value=units[0].unit_name;syncAssessmentType();}
  catch(e){say("Units could not be loaded: "+e.message,true);}
 }
 function syncAssessmentType(){const unit=units.find(u=>u.unit_name===($("iaMEUnitSelect")?.value||""));const el=$("iaMEAssessmentType");if(!el)return;if(unit?.assessment_type&&[...el.options].some(o=>o.value===unit.assessment_type)){el.value=unit.assessment_type;el.disabled=true;}else el.disabled=false;}
 function profileIndex(profiles){const m=new Map();profiles.forEach(p=>[p.user_id,p.student_id,p.admission_number].filter(Boolean).forEach(k=>m.set(String(k),p)));return m;}
 async function loadStudents(){
  if(loading)return;
  const program=$("iaMEProgramSelect")?.value||"",block=$("iaMEBlockSelect")?.value||"",unit=$("iaMEUnitSelect")?.value||"",year=$("iaMEYearSelect")?.value||"";
  if(!program||!block||!unit||!year){say("Select programme, block, unit and academic year first.",true);return;}
  loading=true;rows=[];renderRows();say("Loading approved registrations and existing marks…");
  try{
   const registrationResult=await db().from("student_unit_registrations").select("*").eq("institution_id",tenant()).eq("program",program).eq("block",block).eq("academic_year",Number(year)).eq("status","approved").limit(5000);
   // If the academic-management entitlement hides registrations, retain a safe
   // marks-only fallback so existing institution marks can still be reviewed.
   if(registrationResult.error)console.warn("[Institution marks capture] Registration lookup unavailable; using saved institution marks:",registrationResult.error.message);
   const registrations=registrationResult.error?[]:(registrationResult.data||[]);
   const matching=registrations.filter(r=>String(r.unit_code||"")===String(units.find(u=>u.unit_name===unit)?.unit_code||"")||String(r.unit_name||"")===unit);
   const studentIds=[...new Set(matching.map(r=>r.student_id).filter(Boolean).map(String))];
   let profiles=[];
   for(let i=0;i<studentIds.length;i+=150){
    const batch=studentIds.slice(i,i+150);
    const p=await db().from("consolidated_user_profiles_table").select("user_id,student_id,admission_number,full_name,program,institution_id").eq("institution_id",tenant()).eq("role","student").in("user_id",batch).limit(1000);
    if(p.error)throw p.error;profiles.push(...(p.data||[]));
   }
   const byKey=profileIndex(profiles);
   const {data:marks,error:markError}=await db().from("student_marks").select("id,student_id,admission_number,student_name,program,block,subject_name,academic_year,assessment_type,cat1_score,cat2_score,exam_score,final_score,grade,approval_status,published,retake_status,retake_score,institution_id").eq("institution_id",tenant()).eq("program",program).eq("block",block).eq("subject_name",unit).eq("academic_year",String(year)).order("created_at",{ascending:true}).limit(5000);
   if(markError)throw markError;
   const byMarkKey=new Map();(marks||[]).forEach(m=>[m.student_id,m.admission_number].filter(Boolean).forEach(k=>byMarkKey.set(String(k),m)));
   const built=matching.map(reg=>{
    const p=byKey.get(String(reg.student_id))||{};
    const admission=String(reg.admission_number||p.admission_number||p.student_id||"").trim();
    if(!admission)return null;
    const existing=byMarkKey.get(admission)||byMarkKey.get(String(reg.student_id))||null;
    return {id:existing?.id||null,student_id:existing?.student_id||reg.student_id,admission_number:existing?.admission_number||admission,student_name:existing?.student_name||p.full_name||"Student",program,block,subject_name:unit,academic_year:Number(year),assessment_type:existing?.assessment_type||$("iaMEAssessmentType")?.value||"full",cat1_score:existing?.cat1_score??0,cat2_score:existing?.cat2_score??0,exam_score:existing?.exam_score??0,final_score:existing?.final_score??0,grade:existing?.grade||"",approval_status:existing?.approval_status||"draft",published:existing?.published===true};
   }).filter(Boolean);
   rows=built;
   if(!rows.length){
    // Existing institution marks remain editable even if the registration
    // has since been archived or its approval state has changed.
    rows=(marks||[]).map(m=>({...m,student_name:m.student_name||"Student"}));
   }
   renderRows();
   say(rows.length+" students loaded from this institution's approved registrations. "+rows.filter(r=>r.published).length+" already published (locked).");
  }catch(e){console.error("[Institution marks capture]",e);say("Marks could not be loaded: "+e.message,true);}
  finally{loading=false;}
 }
 function renderRows(){
  const body=$("iaMEEditorRows"),save=$("iaMESaveCapture");if(!body)return;
  body.replaceChildren();
  if(!rows.length){const tr=document.createElement("tr"),td=document.createElement("td");td.colSpan=8;td.className="ia-empty";td.textContent="No students loaded.";tr.append(td);body.append(tr);if(save)save.disabled=true;return;}
  rows.forEach((r,index)=>{
   const tr=document.createElement("tr");tr.dataset.index=String(index);
   const td=(v)=>{const el=document.createElement("td");el.textContent=String(v??"—");tr.append(el);return el;};
   td(r.student_name);td(r.admission_number);
   ["cat1_score","cat2_score","exam_score"].forEach((key,j)=>{const cell=td("");const input=document.createElement("input");input.type="number";input.min="0";input.max=j===2?"100":"30";input.step="0.1";input.className="ia-score-input";input.value=String(r[key]??0);input.disabled=!!r.published;input.dataset.score=key;input.addEventListener("input",()=>updatePreview(index));cell.append(input);});
   const total=td(r.final_score??"—");total.dataset.final="1";
   const grade=td(r.grade||"—");grade.dataset.grade="1";
   const status=td(r.published?"Published":r.approval_status||"Draft");status.dataset.workflow="1";
   if(r.published)tr.style.opacity=".65";
   body.append(tr);
  });
  if(save)save.disabled=!rows.some(r=>!r.published);
 }
 function updatePreview(index){
  const row=rows[index],tr=$("iaMEEditorRows")?.querySelector('tr[data-index="'+index+'"]');if(!row||!tr)return;
  const vals={};tr.querySelectorAll("[data-score]").forEach(input=>vals[input.dataset.score]=Math.max(0,Number(input.value)||0));
  const type=$("iaMEAssessmentType")?.value||row.assessment_type||"full",total=calculate(vals.cat1_score,vals.cat2_score,vals.exam_score,type,row.program);
  row.cat1_score=vals.cat1_score;row.cat2_score=vals.cat2_score;row.exam_score=vals.exam_score;row.assessment_type=type;row.final_score=total;row.grade=gradeFor(total,row.program);
  tr.querySelector('[data-final]').textContent=total.toFixed(1)+"%";tr.querySelector('[data-grade]').textContent=row.grade;
 }
 async function saveMarks(){
  if(saving)return;const editable=rows.filter(r=>!r.published);if(!editable.length){say("There are no editable marks to save.",true);return;}
  if(!confirm("Save "+editable.length+" marks and submit them for approval? They will remain unpublished."))return;
  saving=true;const button=$("iaMESaveCapture");if(button){button.disabled=true;button.textContent="Saving marks…";}
  const now=new Date().toISOString(),type=$("iaMEAssessmentType")?.value||"full";let saved=0,errors=[];
  try{
   for(let i=0;i<editable.length;i+=8){
    const batch=editable.slice(i,i+8);
    const outcomes=await Promise.all(batch.map(async r=>{
     const total=calculate(r.cat1_score,r.cat2_score,r.exam_score,type,r.program),grade=gradeFor(total,r.program);
     const patch={student_name:r.student_name,program:r.program,block:r.block,subject_name:r.subject_name,academic_year:r.academic_year,assessment_type:type,cat1_score:Number(r.cat1_score)||0,cat2_score:Number(r.cat2_score)||0,exam_score:Number(r.exam_score)||0,final_score:total,grade,approval_status:"pending",approved_by:null,approved_at:null,rejection_reason:null,published:false,published_at:null,published_by:null,graded_by:api.user.id,submitted_at:now,updated_at:now};
     try{
      let result;
      if(r.id)result=await db().from("student_marks").update(patch).eq("id",r.id).eq("institution_id",tenant()).eq("published",false).select("id").maybeSingle();
      else result=await db().from("student_marks").insert({...patch,student_id:r.student_id,admission_number:r.admission_number,institution_id:tenant(),created_at:now}).select("id").single();
      if(result.error)throw result.error;if(!result.data?.id)throw new Error("The mark row was not updated.");r.id=result.data.id;r.final_score=total;r.grade=grade;r.approval_status="pending";return true;
     }catch(e){errors.push(r.admission_number+": "+e.message);return false;}
    }));
    saved+=outcomes.filter(Boolean).length;
   }
   try{await db().rpc("log_marks_security_event",{p_action:"institution_admin_marks_entry_saved",p_target_table:"student_marks",p_target_id:null,p_description:"Institution administrator saved marks for approval",p_status:errors.length?"partial":"success",p_details:{institution_id:tenant(),program:$("iaMEProgramSelect")?.value,block:$("iaMEBlockSelect")?.value,unit:$("iaMEUnitSelect")?.value,academic_year:$("iaMEYearSelect")?.value,saved,failed:errors.length}});}catch(e){console.warn("[Institution marks capture] Audit failed:",e.message);}
   say(errors.length?"Saved "+saved+" marks; "+errors.length+" failed. First error: "+errors[0]:"Successfully saved "+saved+" marks. They are pending approval and remain unpublished.",!!errors.length);
   if(window.InstitutionAdminResults?.refresh)await window.InstitutionAdminResults.refresh();
   await loadStudents();
  }finally{saving=false;if(button){button.disabled=!rows.some(r=>!r.published);button.innerHTML='<i class="fa-solid fa-floppy-disk"></i> Save marks & submit for approval';}}
 }
 function bind(){
  $("iaMEProgramSelect")?.addEventListener("change",loadBlocks);
  $("iaMEBlockSelect")?.addEventListener("change",loadUnits);
  $("iaMEUnitSelect")?.addEventListener("change",syncAssessmentType);
  $("iaMELoadStudents")?.addEventListener("click",loadStudents);
  $("iaMESaveCapture")?.addEventListener("click",saveMarks);
  $("iaMEAssessmentType")?.addEventListener("change",()=>rows.forEach((r,i)=>updatePreview(i)));
  document.addEventListener("click",e=>{if(e.target.closest('#iaNav [data-view="marks-entry"]')){if(!$("iaMEProgramSelect")?.options?.length||$("iaMEProgramSelect")?.options?.length<=1)loadPrograms();}});
 }
 function wait(){api=window.CampusInstitutionAdmin;if(!api?.db||!api?.institutionId||!api?.user){setTimeout(wait,150);return;}bind();loadPrograms();}
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",wait,{once:true});else wait();
 window.InstitutionAdminMarksEntry={load:loadStudents,refresh:loadPrograms,save:saveMarks};
})();