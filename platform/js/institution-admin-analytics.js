/* Campus Nexus Institution Admin — tenant-scoped academic analytics */
(() => {
 "use strict";
 const $=id=>document.getElementById(id);let api=null,rows=[],charts={};
 const db=()=>{if(!api?.db||!api?.institutionId)throw new Error("Institution session is not ready.");return api.db;};
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 function notice(msg,bad=false){const host=$("iaAnalyticsNotice");if(host){host.textContent=msg;host.style.color=bad?"#a12b2b":"#16634a";}}
 function paint(){
  const records=rows,approved=records.filter(r=>String(r.approval_status||"").toLowerCase()==="approved"),pending=records.filter(r=>String(r.approval_status||"").toLowerCase()==="pending"),published=records.filter(r=>r.published===true);
  const avg=records.length?records.reduce((n,r)=>n+(Number(r.final_score)||0),0)/records.filter(r=>r.final_score!==null&&r.final_score!==undefined&&r.final_score!=="").length||0:0;
  const uniqueStudents=new Set(records.map(r=>r.student_id||r.admission_number).filter(Boolean)).size,uniqueUnits=new Set(records.map(r=>r.subject_name).filter(Boolean)).size;
  const values=[["iaAnalyticsMarks",records.length],["iaAnalyticsStudents",uniqueStudents],["iaAnalyticsUnits",uniqueUnits],["iaAnalyticsAverage",avg.toFixed(1)+"%"],["iaAnalyticsPending",pending.length],["iaAnalyticsPublished",published.length]];
  values.forEach(([id,v])=>{if($(id))$(id).textContent=Number.isFinite(Number(v))?Number(v).toLocaleString("en-KE"):v;});
  const grades={};records.forEach(r=>{const g=String(r.final_grade||r.grade||"Ungraded");grades[g]=(grades[g]||0)+1;});
  const blocks={};records.forEach(r=>{const b=String(r.block||"Not specified");blocks[b]=(blocks[b]||0)+1;});
  if(!window.Chart){notice("Charts could not load. The summary figures are still available.",true);return;}
  const draw=(id,key,data,type="bar")=>{const el=$(id);if(!el)return;if(charts[key])charts[key].destroy();charts[key]=new Chart(el,{type,data:{labels:Object.keys(data),datasets:[{label:key==="grades"?"Marks by grade":"Marks by block",data:Object.values(data),borderWidth:1}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0}}}}});};
  draw("iaAnalyticsGradeChart","grades",grades);draw("iaAnalyticsBlockChart","blocks",blocks);
  const body=$("iaAnalyticsUnitRows");if(body){const units={};records.forEach(r=>{const k=r.subject_name||"Unspecified";(units[k]??=[]).push(Number(r.final_score)||0);});const ranked=Object.entries(units).map(([unit,scores])=>({unit,count:scores.length,average:scores.reduce((a,b)=>a+b,0)/scores.length})).sort((a,b)=>b.average-a.average).slice(0,15);body.innerHTML=ranked.length?ranked.map(x=>"<tr><td>"+esc(x.unit)+"</td><td>"+x.count+"</td><td>"+x.average.toFixed(1)+"%</td></tr>").join(""):'<tr><td colspan="3" class="ia-empty">No unit marks available.</td></tr>';}
 }
 async function load(){try{api=window.CampusInstitutionAdmin;if(!api?.institutionId)return;notice("Updating institution analytics…");const {data,error}=await db().from("student_marks").select("id,student_id,admission_number,program,block,subject_name,final_score,grade,final_grade,approval_status,published,academic_year,created_at").eq("institution_id",api.institutionId).order("created_at",{ascending:false}).limit(5000);if(error)throw error;rows=data||[];paint();notice("Analytics refreshed for "+(api.institution?.name||"this institution")+".");}catch(e){console.error("[Institution analytics]",e);notice("Analytics could not be loaded: "+e.message,true);}}
 function init(){document.addEventListener("click",e=>{const nav=e.target.closest('#iaNav [data-view="reports"]');if(nav)setTimeout(load,100);});$("iaAnalyticsRefresh")?.addEventListener("click",load);api=window.CampusInstitutionAdmin;if(api?.institutionId&&$("view-reports")?.classList.contains("active"))load();}
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
 window.InstitutionAdminAnalytics={refresh:load};
})();