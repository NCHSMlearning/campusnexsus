/* Campus Nexus Institution Admin — tenant-scoped academic analytics.
 * Filters mirror the Super Admin analytics workspace; all source queries are tenant-bound.
 */
(() => {
 "use strict";
 const $=id=>document.getElementById(id);let api=null,rows=[],students=[],charts={};
 const db=()=>{if(!api?.db||!api?.institutionId)throw new Error("Institution session is not ready.");return api.db;};
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const score=r=>{const status=String(r.retake_status||"").trim().toUpperCase();if(["PASS","PASSED","COMPETENT","COMPETENT/PASS"].includes(status)){const n=Number(r.retake_score);if(Number.isFinite(n))return n;}const raw=r.final_score;if(raw===null||raw===undefined||raw==="")return null;const n=Number(raw);return Number.isFinite(n)?n:null;};
 const passThreshold=r=>String(r.program||"").trim().toUpperCase()==="KRCHN"?60:50;
 const gradeFor=(r,n)=>n===null?"PENDING":n>=75?"A":n>=65?"B":n>=passThreshold(r)?"C":"FAIL";
 function notice(msg,bad=false){const host=$("iaAnalyticsNotice");if(host){host.textContent=msg;host.style.color=bad?"#a12b2b":"#16634a";}}
 function populate(id,values,label){const el=$(id);if(!el)return;const old=el.value,opts=[...new Set(values.map(v=>String(v??"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));el.innerHTML='<option value="all">'+label+'</option>'+opts.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join("");if(opts.includes(old))el.value=old;}
 function filtered(){const p=$("iaAnalyticsProgram")?.value||"all",y=$("iaAnalyticsYear")?.value||"all",b=$("iaAnalyticsBlock")?.value||"all",intake=$("iaAnalyticsIntake")?.value||"all";
  const cohort=intake==="all"?null:new Set(students.filter(s=>String(s.intake_year||"")+"-"+String(s.intake_month||"").toLowerCase()===intake).flatMap(s=>[s.id,s.user_id,s.student_id,s.admission_number].filter(Boolean).map(String)));
  return rows.filter(r=>(p==="all"||(p==="tvet"?String(r.program||"").toUpperCase()!=="KRCHN":String(r.program||"").toLowerCase()===p.toLowerCase()))&&(y==="all"||String(r.academic_year||"")===y)&&(b==="all"||String(r.block||"")===b)&&(!cohort||[r.student_id,r.admission_number].filter(Boolean).some(v=>cohort.has(String(v)))));
 }
 function paint(){
  const records=filtered(),scored=records.map(r=>({row:r,value:score(r)})).filter(x=>x.value!==null),passed=scored.filter(x=>x.value>=passThreshold(x.row)).length,failed=scored.length-passed;
  const approved=records.filter(r=>String(r.approval_status||"").toLowerCase()==="approved"),pending=records.filter(r=>String(r.approval_status||"").toLowerCase()==="pending"),published=records.filter(r=>r.published===true&&String(r.approval_status||"").toLowerCase()==="approved");
  const avg=scored.length?scored.reduce((a,b)=>a+b,0)/scored.length:0,studentsCount=new Set(records.map(r=>r.admission_number||r.student_id).filter(Boolean)).size,unitsCount=new Set(records.map(r=>r.subject_name).filter(Boolean)).size;
  const values=[["iaAnalyticsMarks",records.length],["iaAnalyticsStudents",studentsCount],["iaAnalyticsUnits",unitsCount],["iaAnalyticsAverage",scored.length?avg.toFixed(1)+"%":"—"],["iaAnalyticsPassRate",scored.length?(passed/scored.length*100).toFixed(1)+"%":"—"],["iaAnalyticsAtRisk",failed],["iaAnalyticsPending",pending.length],["iaAnalyticsPublished",published.length]];
  values.forEach(([id,v])=>{if($(id))$(id).textContent=typeof v==="number"?v.toLocaleString("en-KE"):v;});
  if(!window.Chart){notice("Charts could not load. Summary figures are still available.",true);return;}
  const gradeCounts={},blockCounts={},programCounts={},unitScores={};
  records.forEach(r=>{const n=score(r),grade=gradeFor(r,n),block=r.block||"Not specified",program=r.program||"Unspecified",unit=r.subject_name||"Unspecified";gradeCounts[grade]=(gradeCounts[grade]||0)+1;blockCounts[block]=(blockCounts[block]||0)+1;programCounts[program]=(programCounts[program]||0)+1;if(n!==null)(unitScores[unit]??=[]).push(n);});
  const draw=(id,key,data,type="bar")=>{const el=$(id);if(!el)return;if(charts[key])charts[key].destroy();charts[key]=new Chart(el,{type,data:{labels:Object.keys(data),datasets:[{label:key==="grades"?"Marks by grade":key==="blocks"?"Marks by block":"Marks",data:Object.values(data),borderWidth:1}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:type==="doughnut",position:"bottom"}},scales:type==="doughnut"?{}:{y:{beginAtZero:true,ticks:{precision:0}}}}});};
  const drawSeries=(id,key,labels,datasets,type="bar",stacked=false)=>{const el=$(id);if(!el)return;if(charts[key])charts[key].destroy();charts[key]=new Chart(el,{type,data:{labels,datasets:datasets.map(d=>({...d,borderWidth:1}))},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:datasets.length>1||type==="doughnut",position:"bottom"}},scales:type==="doughnut"?{}:{x:{stacked},y:{stacked,beginAtZero:true,ticks:{precision:0}}}}});};
  draw("iaAnalyticsGradeChart","grades",gradeCounts,"doughnut");draw("iaAnalyticsBlockChart","blocks",blockCounts);draw("iaAnalyticsProgramChart","programs",programCounts);
  const profileByKey=new Map();students.forEach(p=>[p.user_id,p.student_id,p.admission_number].filter(Boolean).forEach(k=>profileByKey.set(String(k),p)));
  const genderCounts={},assessmentCounts={},gradeByAssessment={};
  records.forEach(r=>{const type=r.assessment_type||"Unspecified",n=score(r),grade=gradeFor(r,n),profile=profileByKey.get(String(r.student_id||""))||profileByKey.get(String(r.admission_number||""))||{},gender=String(profile.gender||"").toUpperCase();const genderLabel=gender==="M"?"Male":gender==="F"?"Female":"Not specified";genderCounts[genderLabel]=(genderCounts[genderLabel]||0)+1;assessmentCounts[type]=(assessmentCounts[type]||0)+1;gradeByAssessment[type]??={};gradeByAssessment[type][grade]=(gradeByAssessment[type][grade]||0)+1;});
  const unitRank=Object.entries(unitScores).map(([unit,scores])=>({unit,average:scores.reduce((a,b)=>a+b,0)/scores.length,count:scores.length})).sort((a,b)=>b.average-a.average).slice(0,12);
  drawSeries("iaAnalyticsSubjectChart","subjects",unitRank.map(x=>x.unit),[{label:"Average score (%)",data:unitRank.map(x=>Number(x.average.toFixed(1)))}]);
  draw("iaAnalyticsGenderChart","gender",genderCounts,"doughnut");
  draw("iaAnalyticsAssessmentChart","assessment",assessmentCounts,"doughnut");
  const assessmentLabels=Object.keys(gradeByAssessment),gradeLabels=["A","B","C","FAIL","PENDING"];
  drawSeries("iaAnalyticsGradeByAssessmentChart","gradeByAssessment",assessmentLabels,gradeLabels.map(g=>({label:g,data:assessmentLabels.map(t=>gradeByAssessment[t]?.[g]||0)})),"bar",true);
  drawSeries("iaAnalyticsUnitChart","unitRanking",unitRank.map(x=>x.unit),[{label:"Average score (%)",data:unitRank.map(x=>Number(x.average.toFixed(1)))}]);
  const body=$("iaAnalyticsUnitRows");if(body){const ranked=Object.entries(unitScores).map(([unit,s])=>({unit,count:s.length,average:s.reduce((a,b)=>a+b,0)/s.length})).sort((a,b)=>b.average-a.average).slice(0,20);body.innerHTML=ranked.length?ranked.map(x=>"<tr><td>"+esc(x.unit)+"</td><td>"+x.count+"</td><td>"+x.average.toFixed(1)+"%</td></tr>").join(""):'<tr><td colspan="3" class="ia-empty">No scored unit marks available.</td></tr>';}
  const stamp=$("iaMarksAnalyticsUpdated");if(stamp)stamp.textContent=records.length+" records · refreshed just now";
 }
 function exportCsv(){const data=filtered();if(!data.length){notice("No academic marks match the current analytics filters.",true);return;}const cols=["student_id","admission_number","program","academic_year","block","subject_name","assessment_type","final_score","retake_status","retake_score","grade","final_grade","analytics_score","analytics_grade","analytics_status","approval_status","published"];const csv=[cols.join(","),...data.map(r=>{const values={...r,analytics_score:score(r),analytics_grade:gradeFor(r,score(r)),analytics_status:score(r)===null?"PENDING":score(r)>=passThreshold(r)?"PASS":"FAIL"};return cols.map(k=>'"'+String(values[k]??"").replace(/"/g,'""')+'"').join(",");})].join("\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="Institution_Academic_Analytics.csv";a.click();URL.revokeObjectURL(url);}
 function printReport(){window.print();}
 async function load(){try{api=window.CampusInstitutionAdmin;if(!api?.institutionId)return;notice("Loading institution academic analytics…");
  const [marks,profileRows]=await Promise.all([
   db().from("student_marks").select("id,student_id,admission_number,program,block,subject_name,final_score,grade,final_grade,approval_status,published,academic_year,retake_status,retake_score,created_at").eq("institution_id",api.institutionId).order("created_at",{ascending:false}).limit(10000),
   db().from("consolidated_user_profiles_table").select("id,user_id,student_id,admission_number,program,intake_year,intake_month,gender").eq("institution_id",api.institutionId).eq("role","student").limit(10000)
  ]);
  if(marks.error)throw marks.error;rows=marks.data||[];students=profileRows.error?[]:(profileRows.data||[]);
  populate("iaAnalyticsProgram",rows.map(r=>r.program),"All programmes");populate("iaAnalyticsYear",rows.map(r=>r.academic_year),"All academic years");populate("iaAnalyticsBlock",rows.map(r=>r.block),"All blocks / terms");
  const intakes=students.map(s=>s.intake_year&&s.intake_month?String(s.intake_year)+"-"+String(s.intake_month).toLowerCase():null).filter(Boolean);populate("iaAnalyticsIntake",intakes,"All intakes");
  paint();notice("Analytics loaded for "+(api.institution?.name||"this institution")+".");
 }catch(e){console.error("[Institution analytics]",e);notice("Analytics could not be loaded: "+e.message,true);}}
 function init(){["iaAnalyticsProgram","iaAnalyticsYear","iaAnalyticsIntake","iaAnalyticsBlock"].forEach(id=>$(id)?.addEventListener("change",paint));document.addEventListener("click",e=>{const nav=e.target.closest('#iaNav [data-view="reports"]');if(nav)setTimeout(load,100);});$("iaAnalyticsRefresh")?.addEventListener("click",load);$("iaAnalyticsExport")?.addEventListener("click",exportCsv);$("iaAnalyticsPrint")?.addEventListener("click",printReport);api=window.CampusInstitutionAdmin;if(api?.institutionId&&$("view-reports")?.classList.contains("active"))load();}
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
 window.InstitutionAdminAnalytics={refresh:load,export:exportCsv,print:printReport};
})();