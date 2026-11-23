/* Campus Nexus Institution Admin — tenant-scoped geo attendance
 * Resolves the institution's own students first, then loads only their geo logs.
 */
(() => {
 "use strict";
 const $=id=>document.getElementById(id);let api=null,records=[],students=[];
 const db=()=>{if(!api?.db||!api?.institutionId)throw new Error("Institution session is not ready.");return api.db;};
 const esc=v=>String(v??"—").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const date=v=>v?new Date(v).toLocaleString("en-KE",{dateStyle:"medium",timeStyle:"short"}):"—";
 const day=()=>new Date().toISOString().slice(0,10);
 function message(v,bad=false){const el=$("iaAttendanceNotice");if(el){el.textContent=v;el.style.color=bad?"#a12b2b":"#16634a";}}
 function filtered(){const q=($("iaAttendanceSearch")?.value||"").toLowerCase().trim(),st=$("iaAttendanceStatus")?.value||"all",type=$("iaAttendanceType")?.value||"all";return records.filter(r=>(!q||[r.student_name,r.student_id,r.registration_number,r.program,r.target_name,r.session_type].some(v=>String(v??"").toLowerCase().includes(q)))&&(st==="all"||(st==="verified"?(r.is_verified===true||String(r.attendance_status).toLowerCase()==="present"):(r.is_verified!==true&&String(r.attendance_status).toLowerCase()!=="present")))&&(type==="all"||String(r.session_type||r.location_type||"").toLowerCase()===type));}
 function render(){
  const all=filtered(),today=all.filter(r=>String(r.check_in_time||r.created_at||"").slice(0,10)===day()),history=all.filter(r=>String(r.check_in_time||r.created_at||"").slice(0,10)!==day());
  [["iaAttendanceTotal",all.length],["iaAttendanceToday",today.length],["iaAttendanceVerified",all.filter(r=>r.is_verified===true||String(r.attendance_status).toLowerCase()==="present").length],["iaAttendancePending",all.filter(r=>r.is_verified!==true&&String(r.attendance_status).toLowerCase()!=="present").length]].forEach(([id,v])=>{if($(id))$(id).textContent=Number(v).toLocaleString("en-KE");});
  const fill=(id,rows)=>{const body=$(id);if(!body)return;body.innerHTML=rows.length?rows.map(r=>'<tr><td>'+esc(date(r.check_in_time||r.created_at))+'</td><td>'+esc(r.student_name||r.student_id||"—")+'</td><td>'+esc(r.registration_number||r.student_id||"—")+'</td><td>'+esc(r.program||"—")+'</td><td>'+esc(r.session_type||r.location_type||"—")+'</td><td>'+esc(r.target_name||"—")+'</td><td>'+esc(r.distance_meters==null?"—":Math.round(Number(r.distance_meters))+" m")+'</td><td><span class="ia-status">'+esc(r.attendance_status||(r.is_verified?"Present":"Pending"))+'</span></td></tr>').join(""):'<tr><td colspan="8" class="ia-empty">No attendance records found.</td></tr>';};
  fill("iaAttendanceTodayRows",today);fill("iaAttendanceHistoryRows",history);
 }
 async function load(){
  api=window.CampusInstitutionAdmin;if(!api?.institutionId)return;
  try{message("Loading institution attendance…");
   const st=await db().from("students").select("id,admission_number,full_name").eq("institution_id",api.institutionId).limit(10000);if(st.error)throw st.error;students=st.data||[];
   const admissions=[...new Set(students.map(x=>x.admission_number).filter(Boolean))];
   if(!admissions.length){records=[];render();message("No registered students were found for this institution.");return;}
   let logs=[];for(let i=0;i<admissions.length;i+=150){const batch=admissions.slice(i,i+150);const r=await db().from("geo_attendance_logs").select("*").in("student_id",batch).order("check_in_time",{ascending:false}).limit(5000);if(r.error)throw r.error;logs.push(...(r.data||[]));}
   records=logs.sort((a,b)=>new Date(b.check_in_time||b.created_at||0)-new Date(a.check_in_time||a.created_at||0));render();message("Loaded "+records.length+" geo-attendance records for "+(api.institution?.name||"this institution")+".");
  }catch(e){console.error("[Institution attendance]",e);message("Attendance could not be loaded: "+e.message,true);}
 }
 function exportCsv(){const rows=filtered();if(!rows.length){message("No attendance records to export.",true);return;}const cols=["student_name","student_id","program","session_type","target_name","check_in_time","attendance_status","is_verified","distance_meters"];const csv=[cols.join(","),...rows.map(r=>cols.map(k=>'"'+String(r[k]??"").replace(/"/g,'""')+'"').join(","))].join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="Institution_Attendance.csv";a.click();URL.revokeObjectURL(a.href);}
 function init(){["iaAttendanceSearch","iaAttendanceStatus","iaAttendanceType"].forEach(id=>$(id)?.addEventListener(id==="iaAttendanceSearch"?"input":"change",render));$("iaAttendanceRefresh")?.addEventListener("click",load);$("iaAttendanceExport")?.addEventListener("click",exportCsv);document.addEventListener("click",e=>{if(e.target.closest('#iaNav [data-view="attendance"]'))setTimeout(load,100);});api=window.CampusInstitutionAdmin;if(api?.institutionId&&$("view-attendance")?.classList.contains("active"))load();}
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
 window.InstitutionAdminAttendance={refresh:load,export:exportCsv};
})();