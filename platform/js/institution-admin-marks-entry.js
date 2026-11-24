/* Campus Nexus Institution Admin — tenant-scoped marks capture.
 * Mirrors the Super Admin CAT/exam calculation and submission workflow.
 * Every marks read/write is constrained to the verified institution_id.
 */
(() => {
 "use strict";
 const aliases={"iaMECaptureNotice":"iaMECaptureNotice","iaMEProgramSelect":"me_program_select","iaMEBlockSelect":"me_block_select","iaMEUnitSelect":"me_subject_select","iaMEAssessmentType":"me_assessment_type","iaMEYearSelect":"me_year_select"}; const $=id=>document.getElementById(id)||document.getElementById(aliases[id]||"");
 let api=null,units=[],rows=[],loading=false,saving=false,page=1,pageSize=30,academicStructure=null,lastNotice="",lastNoticeBad=false;
 const db=()=>{if(!api?.db||!api?.institutionId||!api?.user?.id)throw new Error("Your institution administrator session is not ready.");return api.db;};
 const tenant=()=>api.institutionId;
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const say=(message,bad=false)=>{lastNotice=String(message||"");lastNoticeBad=!!bad;const el=$("iaMECaptureNotice");if(el){el.textContent=lastNotice;el.style.color=bad?"#a12b2b":"#16634a";}const visible=$("meMarksStatus");if(visible){visible.textContent=lastNotice;visible.style.color=bad?"#991b1b":"#16634a";}};
 const isTVET=program=>String(program||"").trim().toUpperCase()!=="KRCHN";
 const passThreshold=program=>isTVET(program)?50:60;
 const gradeFor=(score,program)=>{const n=Number(score);if(!Number.isFinite(n))return "PENDING";if(isTVET(program)){if(n>=80)return "A";if(n>=65)return "B";if(n>=50)return "C";return "E";}if(n>=75)return "A";if(n>=65)return "B";if(n>=60)return "C";return "D";};
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
   const [catalog,legacy]=await Promise.all([
    db().from("programs").select("program_code,program_name,status").eq("institution_id",tenant()).order("program_code"),
    db().from("units_catalog").select("program").eq("institution_id",tenant()).eq("status","active").limit(5000)
   ]);
   if(catalog.error)throw catalog.error;if(legacy.error)throw legacy.error;
   // Keep legacy programme codes visible until every existing catalogue has been
   // reconciled to a programme row; prefer the canonical programme table.
   const codes=[...(catalog.data||[]).filter(x=>!x.status||String(x.status).toLowerCase()==="active").map(x=>x.program_code),...(legacy.data||[]).map(x=>x.program)];
   fill("iaMEProgramSelect",codes,"Select programme");
   say("Choose a programme, academic period, unit and academic year.");
  }catch(e){say("Programmes could not be loaded: "+e.message,true);}
  finally{loading=false;}
 }
 async function loadBlocks(){
  const program=$("iaMEProgramSelect")?.value||"";
  fill("iaMEBlockSelect",[],"Select academic period");fill("iaMEUnitSelect",[],"Select unit");units=[];academicStructure=null;
  if(!program)return;
  try{
   if(window.CampusAcademicStructure)academicStructure=await window.CampusAcademicStructure.resolve(db(),tenant(),program);
   const {data:programRow,error:programError}=await db().from("programs").select("id,structure_type").eq("program_code",program).eq("institution_id",tenant()).maybeSingle();if(programError)throw programError;
   let periodNames=academicStructure?.periods?.map(x=>x.name)||[];
   if(!periodNames.length&&programRow?.id){const canonical=await db().from("program_blocks").select("block_name").eq("program_id",programRow.id).eq("institution_id",tenant()).eq("status","active").order("block_sequence");if(canonical.error)throw canonical.error;periodNames=(canonical.data||[]).map(x=>x.block_name);}
   if(!periodNames.length){const legacy=await db().from("units_catalog").select("block").eq("program",program).eq("institution_id",tenant()).eq("status","active").limit(5000);if(legacy.error)throw legacy.error;periodNames=(legacy.data||[]).map(x=>x.block);}
   const type=academicStructure?.type||programRow?.structure_type||"Block",singular=type.toLowerCase();
   const select=$("iaMEBlockSelect");if(select){select.setAttribute("aria-label","Marks entry "+singular);select.setAttribute("data-academic-structure",type);}
   fill("iaMEBlockSelect",periodNames,"Select "+singular);
   say("Choose a programme, "+singular+", unit and academic year.");
  }catch(e){say("Academic periods could not be loaded: "+e.message,true);}
 }
 async function loadUnits(){
  const program=$("iaMEProgramSelect")?.value||"",block=$("iaMEBlockSelect")?.value||"";
  fill("iaMEUnitSelect",[],"Select unit");units=[];
  if(!program||!block)return;
  try{
   const {data:programRow,error:programError}=await db().from("programs").select("id").eq("program_code",program).eq("institution_id",tenant()).maybeSingle();if(programError)throw programError;
   let mappedIds=[];
   if(programRow?.id){const mapped=await db().from("program_courses").select("unit_catalog_id,block_name").eq("program_id",programRow.id).not("unit_catalog_id","is",null);if(mapped.error)throw mapped.error;mappedIds=(mapped.data||[]).filter(x=>!x.block_name||x.block_name===block).map(x=>x.unit_catalog_id).filter(Boolean);if((mapped.data||[]).length&&!mappedIds.length){units=[];const el=$("iaMEUnitSelect");if(el){el.replaceChildren();option(el,"","No units mapped to this block");}return;}}
   let query=db().from("units_catalog").select("id,unit_code,unit_name,assessment_type,program,block").eq("program",program).eq("block",block).eq("status","active").eq("institution_id",tenant()).order("unit_name",{ascending:true}).limit(1000);
   if(mappedIds.length)query=query.in("id",mappedIds);
   const {data,error}=await query;if(error)throw error;units=data||[];
   const el=$("iaMEUnitSelect");el.replaceChildren();option(el,"","Select unit");units.forEach(u=>option(el,u.unit_name,(u.unit_code?u.unit_code+" · ":"")+u.unit_name));if(units.length===1){el.value=units[0].unit_name;syncAssessmentType();await loadStudents();}else syncAssessmentType();
  }catch(e){say("Units could not be loaded: "+e.message,true);}
 }
 function syncAssessmentType(){const unit=units.find(u=>u.unit_name===($("iaMEUnitSelect")?.value||""));const el=$("iaMEAssessmentType");if(!el)return;if(unit?.assessment_type&&[...el.options].some(o=>o.value===unit.assessment_type)){el.value=unit.assessment_type;el.disabled=true;}else el.disabled=false;}
 function profileIndex(profiles){const m=new Map();profiles.forEach(p=>[p.user_id,p.student_id,p.admission_number].filter(Boolean).forEach(k=>m.set(String(k),p)));return m;}
 async function loadStudents(){
  if(loading)return;
  const program=$("iaMEProgramSelect")?.value||"",block=$("iaMEBlockSelect")?.value||"",unit=$("iaMEUnitSelect")?.value||"",year=$("iaMEYearSelect")?.value||"";
  if(!program||!block||!unit||!year){say("Select programme, academic period, unit and academic year first.",true);return;}
  loading=true;rows=[];page=1;renderRows();say("Loading approved registrations and existing marks…");
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
    if(p.error)console.warn("[Institution marks capture] Student profile lookup unavailable:",p.error.message);else profiles.push(...(p.data||[]));
   }
   const byKey=profileIndex(profiles);
   const missingIdentityCount=matching.filter(reg=>{const p=byKey.get(String(reg.student_id))||{};return !String(reg.admission_number||p.admission_number||p.student_id||"").trim();}).length;
   const {data:marks,error:markError}=await db().from("student_marks").select("id,student_id,admission_number,student_name,program,block,subject_name,academic_year,assessment_type,cat1_score,cat2_score,exam_score,final_score,grade,final_grade,approval_status,published,retake_status,retake_score,created_at").eq("institution_id",tenant()).eq("program",program).eq("block",block).eq("subject_name",unit).eq("academic_year",Number(year)).order("created_at",{ascending:true}).limit(5000);
   if(markError)throw markError;
   const byMarkKey=new Map();(marks||[]).forEach(m=>[m.student_id,m.admission_number].filter(Boolean).forEach(k=>byMarkKey.set(String(k),m)));
   const built=matching.map(reg=>{
    const p=byKey.get(String(reg.student_id))||{};
    const admission=String(reg.admission_number||p.admission_number||p.student_id||"").trim();
    if(!admission)return null;
    const existing=byMarkKey.get(admission)||byMarkKey.get(String(reg.student_id))||null;
    return {id:existing?.id||null,student_id:existing?.student_id||reg.student_id,admission_number:existing?.admission_number||admission,student_name:existing?.student_name||p.full_name||"Student",program,block,subject_name:unit,academic_year:Number(year),assessment_type:existing?.assessment_type||$("iaMEAssessmentType")?.value||"full",cat1_score:existing?.cat1_score??0,cat2_score:existing?.cat2_score??0,exam_score:existing?.exam_score??0,final_score:existing?.final_score??0,grade:existing?.grade||"",retake_status:existing?.retake_status||"",retake_score:existing?.retake_score??null,retake_count:existing?.retake_count??0,retake_date:existing?.retake_date||null,final_grade:existing?.final_grade||"",final_status:existing?.final_status||"",approval_status:existing?.approval_status||"draft",published:existing?.published===true};
   }).filter(Boolean);
   rows=built;
   if(!rows.length){
    // Existing institution marks remain editable even if the registration
    // has since been archived or its approval state has changed.
    rows=(marks||[]).map(m=>({...m,student_name:m.student_name||"Student"}));
   }
   renderRows();
   say(rows.length+" students loaded from this institution's approved registrations. "+rows.filter(r=>r.published).length+" already published (locked)."+(missingIdentityCount?" "+missingIdentityCount+" registration(s) skipped because admission/profile details are missing.":""));
  }catch(e){console.error("[Institution marks capture]",e);say("Marks could not be loaded: "+e.message,true);const host=$("me_marks_container");if(host)host.innerHTML='<div style="padding:32px;text-align:center;color:#991b1b"><i class="fas fa-triangle-exclamation" style="font-size:30px"></i><h3>Unable to load marks</h3><p>'+esc(e.message)+'</p><button type="button" onclick="loadMarksEntry()" style="padding:9px 16px;background:#4C1D95;color:#fff;border:0;border-radius:7px">Retry</button></div>';const dynamic=$("marksEntryDynamicContent");if(dynamic)dynamic.style.display="block";const placeholder=$("marksEntryPlaceholder");if(placeholder)placeholder.style.display="none";}
  finally{loading=false;}
 }
 function renderRows(){
  const host=$("me_marks_container"),save=$( "iaMESaveCapture");if(!host)return;
  const dynamic=$("marksEntryDynamicContent"),placeholder=$("marksEntryPlaceholder");
  if(dynamic)dynamic.style.display=rows.length?"block":"none";if(placeholder)placeholder.style.display=rows.length?"none":"block";
  const program=$( "iaMEProgramSelect")?.value||"",type=$( "iaMEAssessmentType")?.value||"full",unit=$( "iaMEUnitSelect")?.value||"";
  const nursing=!isTVET(program),examMax=nursing?(type==="full"?70:100):100;
  const showCat1=type!=="exam_only",showCat2=type==="full"||type==="cats_only",showExam=type!=="cats_only"&&type!=="cat_only";
  const q=($( "meMarksSearch")?.value||"").trim().toLowerCase();
  const filtered=rows.map((r,index)=>({r,index})).filter(({r})=>!q||[r.student_name,r.admission_number].some(v=>String(v??"").toLowerCase().includes(q)));
  const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));page=Math.min(page,totalPages);
  const info=$( "meMarksPageInfo");if(info)info.textContent="Page "+page+" of "+totalPages+" · "+filtered.length+" students";
  const prev=$( "meMarksPrevPage"),next=$( "meMarksNextPage");if(prev)prev.disabled=page<=1;if(next)next.disabled=page>=totalPages;
  const published=rows.filter(r=>r.published).length,scored=rows.filter(r=>Number(r.final_score)>0);
  const average=scored.length?scored.reduce((a,r)=>a+Number(r.final_score||0),0)/scored.length:0;
  const passed=scored.filter(r=>Number(r.final_score)>=passThreshold(program)).length;
  const stats={"me_total_students":scored.length,"me_total_subjects":units.length,"me_pass_rate":scored.length?Math.round(passed/scored.length*100)+"%":"0%","me_class_avg":average.toFixed(1)+"%","me_at_risk":scored.length-passed,"me_published_count":published};
  Object.entries(stats).forEach(([id,value])=>{const el=$(id);if(el)el.textContent=String(value);});
  const selected=$("selectedProgramName");if(selected)selected.textContent=program||"None selected";
  const typeLabel=$("selectedProgramType");if(typeLabel)typeLabel.textContent=program?(nursing?"Nursing programme":"TVET programme"):"None selected";
  const label=$("autoAssessmentTypeLabel");if(label)label.textContent=type.replace(/_/g," ").toUpperCase();
  const unitLabel=$("me_column_subject_name");if(unitLabel)unitLabel.textContent=unit||"Current Unit";
  if(!rows.length){host.innerHTML='<div style="text-align:center;padding:42px 20px;color:#64748b"><i class="fas fa-users-slash" style="font-size:36px"></i><h3>No students found for this unit</h3><p>Check approved unit registrations, programme, block and academic year.</p></div>';if(save)save.disabled=true;return;}
  let html='<div id="meMarksStatus" role="status" style="padding:9px 12px;margin-bottom:12px;border-radius:7px;background:#f0fdf4;color:#16634a;font-size:12px">' + esc(lastNotice) + '</div><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px"><div><h3 style="margin:0;color:#0f172a">'+esc(unit)+'</h3><small style="color:#64748b">'+esc(program)+' · '+esc($( "iaMEBlockSelect")?.value||"")+' · '+esc($( "iaMEYearSelect")?.value||"")+' · '+rows.length+' students</small></div><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><input id="meMarksSearch" type="search" placeholder="Search learner or admission…" style="padding:9px 12px;border:1px solid #cbd5e1;border-radius:7px;min-width:190px"><button type="button" onclick="saveMarksEntry()" style="padding:9px 16px;background:#059669;color:#fff;border:0;border-radius:7px;font-weight:600;cursor:pointer">Save All Marks</button><button type="button" onclick="exportMarksEntry()" style="padding:9px 16px;background:#4C1D95;color:#fff;border:0;border-radius:7px;cursor:pointer">Export CSV</button><button type="button" onclick="loadMarksEntry()" style="padding:9px 16px;background:#64748b;color:#fff;border:0;border-radius:7px;cursor:pointer">Refresh</button></div></div>';
  html+='<div style="overflow-x:auto"><table id="me_marks_table" style="width:100%;border-collapse:collapse;font-size:13px;min-width:760px"><thead><tr style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff"><th style="padding:10px">#</th><th style="padding:10px;text-align:left">Admission</th><th style="padding:10px;text-align:left">Student name</th>';
  if(showCat1)html+='<th style="padding:10px">CAT 1 (0–30)</th>';if(showCat2)html+='<th style="padding:10px">CAT 2 (0–30)</th>';if(showExam)html+='<th style="padding:10px">Exam (0–'+examMax+')</th>';
  html+='<th style="padding:10px">Total %</th><th style="padding:10px">Grade</th><th style="padding:10px">Points</th><th style="padding:10px">Result</th><th style="padding:10px">Workflow</th></tr></thead><tbody>';
  filtered.slice((page-1)*pageSize,page*pageSize).forEach(({r,index},i)=>{
   const score=Number(r.final_score)||0,passed=score>=passThreshold(program)&&score>0,status=score<=0?"pending":passed?"pass":"fail",grade=gradeFor(score,program),points=grade==="A"?4:grade==="B"?3:grade==="C"?2:0,rating=grade==="A"?(nursing?"Distinction":"Mastery"):grade==="B"?(nursing?"Credit":"Proficient"):grade==="C"?(nursing?"Pass":"Competent"):(nursing?"Fail":"Not yet competent");
   const lock=!!r.published,cell='padding:8px;text-align:center;border-bottom:1px solid #e5e7eb';
   html+='<tr data-index="'+index+'" data-result-status="'+status+'" style="background:'+(status==="pass"?"#dcfce7":status==="fail"?"#fef9c3":"#fff")+'"><td style="'+cell+'">'+(i+1+(page-1)*pageSize)+'</td><td style="'+cell+';text-align:left">'+esc(r.admission_number)+'</td><td style="'+cell+';text-align:left">'+esc(r.student_name)+'</td>';
   const input=(key,max)=>'<input type="number" min="0" max="'+max+'" step="0.5" data-score="'+key+'" value="'+esc(r[key]??0)+'" '+(lock?"disabled":"")+' style="width:68px;padding:6px;border:1px solid #cbd5e1;border-radius:6px;text-align:center" />';
   if(showCat1)html+='<td style="'+cell+'">'+input("cat1_score",30)+'</td>';if(showCat2)html+='<td style="'+cell+'">'+input("cat2_score",30)+'</td>';if(showExam)html+='<td style="'+cell+'">'+input("exam_score",examMax)+'</td>';
   html+='<td data-final style="'+cell+';font-weight:700">'+(score>0?score.toFixed(1):"—")+'</td><td data-grade style="'+cell+';font-weight:700">'+(score>0?grade:"—")+'</td><td data-points style="'+cell+'">'+(score>0?points.toFixed(1):"—")+'</td><td data-rating style="'+cell+'">'+(score>0?rating.toUpperCase():"PENDING")+'</td><td style="'+cell+'">'+(lock?'<span style="color:#047857;font-weight:700">Published · locked</span>':esc(r.approval_status||"Draft"))+'</td></tr>';
  });
  html+='</tbody></table></div><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:12px;flex-wrap:wrap"><span id="meMarksPageInfo" style="font-size:12px;color:#64748b"></span><div><button id="meMarksPrevPage" type="button" style="padding:7px 12px;border:1px solid #cbd5e1;border-radius:6px;background:#fff">Previous</button> <button id="meMarksNextPage" type="button" style="padding:7px 12px;border:1px solid #cbd5e1;border-radius:6px;background:#fff">Next</button></div></div><div style="margin-top:10px;color:#64748b;font-size:12px">Green = pass · Yellow = below pass mark · Published marks are locked. Saving submits changes for approval; it does not publish results.</div>';
  host.innerHTML=html;
  host.querySelectorAll("[data-score]").forEach(input=>input.addEventListener("input",()=>updatePreview(Number(input.closest("tr").dataset.index))));
  if(save)save.disabled=!rows.some(r=>!r.published);
  const compat=$("iaMEEditorRows")?.closest(".ia-parity-tenant-controls");if(compat)compat.hidden=true;
 }
 function updatePreview(index){
  const row=rows[index],tr=$("me_marks_container")?.querySelector('tr[data-index="'+index+'"]');if(!row||!tr)return;
  const vals={};tr.querySelectorAll("[data-score]").forEach(input=>{const max=Number(input.max)||100;vals[input.dataset.score]=Math.min(max,Math.max(0,Number(input.value)||0));});
  const type=$("iaMEAssessmentType")?.value||row.assessment_type||"full",total=calculate(vals.cat1_score??row.cat1_score,vals.cat2_score??row.cat2_score,vals.exam_score??row.exam_score,type,row.program);
  row.cat1_score=vals.cat1_score??row.cat1_score;row.cat2_score=vals.cat2_score??row.cat2_score;row.exam_score=vals.exam_score??row.exam_score;row.assessment_type=type;row.final_score=total;row.grade=gradeFor(total,row.program);
  const grade=row.grade,points=grade==="A"?4:grade==="B"?3:grade==="C"?2:0,nursing=!isTVET(row.program),passed=total>=passThreshold(row.program)&&total>0;
  const rating=grade==="A"?(nursing?"DISTINCTION":"MASTERY"):grade==="B"?(nursing?"CREDIT":"PROFICIENT"):grade==="C"?(nursing?"PASS":"COMPETENT"):(nursing?"FAIL":"NOT YET COMPETENT");
  tr.querySelector("[data-final]").textContent=total>0?total.toFixed(1):"—";tr.querySelector("[data-grade]").textContent=total>0?grade:"—";tr.querySelector("[data-points]").textContent=total>0?points.toFixed(1):"—";tr.querySelector("[data-rating]").textContent=total>0?rating:"PENDING";
  tr.dataset.resultStatus=total<=0?"pending":passed?"pass":"fail";tr.style.background=total<=0?"#fff":passed?"#dcfce7":"#fef9c3";
 }
 function exportCaptureCsv(){if(!rows.length){say("Load students before exporting marks.",true);return;}const cols=["student_name","admission_number","program","block","subject_name","academic_year","assessment_type","cat1_score","cat2_score","exam_score","final_score","grade","retake_status","retake_score","final_grade","final_status","approval_status","published"];const csv=[cols.join(","),...rows.map(r=>cols.map(k=>'"'+String(r[k]??"").replace(/"/g,'""')+'"').join(","))].join("\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="Institution_Marks_Capture.csv";a.click();URL.revokeObjectURL(url);}
 async function saveMarks(){
  if(saving)return;const editable=rows.filter(r=>!r.published);if(!editable.length){say("There are no editable marks to save.",true);return;}
  if(!confirm("Save "+editable.length+" marks and submit them for approval? They will remain unpublished."))return;
  saving=true;const button=$("iaMESaveCapture")?.addEventListener("click",saveMarks);$("iaMEExportCapture")?.addEventListener("click",exportCaptureCsv);
  document.addEventListener("input",e=>{if(e.target.id==="meMarksSearch"){page=1;renderRows();}});
  document.addEventListener("click",e=>{if(e.target.id==="meMarksPrevPage"){page=Math.max(1,page-1);renderRows();}if(e.target.id==="meMarksNextPage"){page++;renderRows();}if(e.target.closest("#iaNav [data-view=marks-entry]")){if(!$("iaMEProgramSelect")?.options?.length||$("iaMEProgramSelect")?.options?.length<=1)loadPrograms();}});
  $("iaMEAssessmentType")?.value||"full";let saved=0,errors=[];
  try{
   for(let i=0;i<editable.length;i+=8){
    const batch=editable.slice(i,i+8);
    const outcomes=await Promise.all(batch.map(async r=>{
     const total=calculate(r.cat1_score,r.cat2_score,r.exam_score,type,r.program),grade=gradeFor(total,r.program);
     const retakeStatus=String(r.retake_status||"").trim().toLowerCase(),retakeScore=r.retake_score===null||r.retake_score===undefined||r.retake_score===""?null:Number(r.retake_score),passedRetake=["pass","passed","competent","competent/pass"].includes(retakeStatus);
     const patch={student_name:r.student_name,program:r.program,block:r.block,subject_name:r.subject_name,academic_year:r.academic_year,assessment_type:type,cat1_score:Number(r.cat1_score)||0,cat2_score:Number(r.cat2_score)||0,exam_score:Number(r.exam_score)||0,final_score:total,grade,retake_status:retakeStatus||null,retake_score:retakeScore,final_grade:passedRetake&&retakeScore!==null?gradeFor(retakeScore,r.program):(r.final_grade||grade),approval_status:"pending",approved_by:null,approved_at:null,rejection_reason:null,published:false,published_at:null,published_by:null,updated_at:now};
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
  $("iaMELoadStudents")?.addEventListener("click",loadStudents);
  $("iaMESaveCapture")?.addEventListener("click",saveMarks);$("iaMEExportCapture")?.addEventListener("click",exportCaptureCsv);$("iaMECaptureSearch")?.addEventListener("input",()=>{page=1;renderRows();});$("iaMEPrevPage")?.addEventListener("click",()=>{page=Math.max(1,page-1);renderRows();});$("iaMENextPage")?.addEventListener("click",()=>{page++;renderRows();});
  $("iaMEAssessmentType")?.addEventListener("change",()=>rows.forEach((r,i)=>updatePreview(i)));
  document.addEventListener("click",e=>{if(e.target.closest('#iaNav [data-view="marks-entry"]')){if(!$("iaMEProgramSelect")?.options?.length||$("iaMEProgramSelect")?.options?.length<=1)loadPrograms();}});
 }
 function wait(){api=window.CampusInstitutionAdmin;if(!api?.db||!api?.institutionId||!api?.user){setTimeout(wait,150);return;}bind();loadPrograms();}
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",wait,{once:true});else wait();
 window.InstitutionAdminMarksEntry={load:loadStudents,refresh:async()=>{if($("iaMEProgramSelect")?.value&&$("iaMEBlockSelect")?.value&&$("iaMEUnitSelect")?.value)return loadStudents();return loadPrograms();},loadBlocks,loadUnits,save:saveMarks,export:exportCaptureCsv};
 window.loadMEBlocks=loadBlocks;window.loadMEUnits=loadUnits;window.loadMarksEntry=loadStudents;window.saveMarksEntry=saveMarks;window.exportMarksEntry=exportCaptureCsv;
 const unavailable=name=>()=>say(name+" is not yet connected to the institution-scoped workflow.",true);
 window.publishCurrentUnitMarks=()=>say("Marks cannot be published from entry. Submit them for approval, then publish approved marks in Marks Approval.");
 window.openStudentPublishModal=unavailable("Student selection");window.showLecturerAssignmentModal=unavailable("Lecturer unit assignment");window.refreshAssignmentHistory=unavailable("Assignment history");window.clearAllAssignments=unavailable("Assignment clearing");window.resetUnitColumns=unavailable("Column reset");window.updateSelectedProgramDisplay=()=>{const p=$("iaMEProgramSelect")?.value||"";const n=$("selectedProgramName");if(n)n.textContent=p||"None selected";const t=$("selectedProgramType");if(t)t.textContent=p?(isTVET(p)?"TVET programme":"Nursing programme"):"None selected";};
})();