/* Campus Nexus Institution Admin — tenant-scoped geo attendance
 * Resolves the institution's own students first, then loads only their geo logs.
 */
(() => {
 "use strict";
 const $=id=>document.getElementById(id);let api=null,records=[],students=[];
 const db=()=>{if(!api?.db||!api?.institutionId)throw new Error("Institution session is not ready.");return api.db;};
 const esc=v=>String(v??"—").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const date=v=>v?new Date(v).toLocaleString("en-KE",{dateStyle:"medium",timeStyle:"short"}):"—";
 const day=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Nairobi",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const dayOf=value=>value?new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Nairobi",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(value)):"";
 function message(v,bad=false){const el=$("iaAttendanceNotice");if(el){el.textContent=v;el.style.color=bad?"#a12b2b":"#16634a";}}
 function filtered(){const q=($("iaAttendanceSearch")?.value||"").toLowerCase().trim(),st=$("iaAttendanceStatus")?.value||"all",type=$("iaAttendanceType")?.value||"all",program=$("iaAttendanceProgram")?.value||"all";return records.filter(r=>(!q||[r.student_name,r.student_id,r.registration_number,r.program,r.target_name,r.session_type].some(v=>String(v??"").toLowerCase().includes(q)))&&(program==="all"||(program==="krchn"?String(r.program||"").toUpperCase()==="KRCHN":String(r.program||"").toUpperCase()!=="KRCHN"))&&(st==="all"||(st==="verified"?(r.is_verified===true||String(r.attendance_status).toLowerCase()==="present"):(r.is_verified!==true&&String(r.attendance_status).toLowerCase()!=="present")))&&(type==="all"||String(r.session_type||r.location_type||"").toLowerCase()===type));}
 function render(){
  const all=filtered(),today=all.filter(r=>dayOf(r.check_in_time||r.created_at)===day()),history=all.filter(r=>dayOf(r.check_in_time||r.created_at)!==day());
  [["iaAttendanceTotal",all.length],["iaAttendanceToday",today.length],["iaAttendanceVerified",all.filter(r=>r.is_verified===true||String(r.attendance_status).toLowerCase()==="present").length],["iaAttendancePending",all.filter(r=>r.is_verified!==true&&String(r.attendance_status).toLowerCase()!=="present").length]].forEach(([id,v])=>{if($(id))$(id).textContent=Number(v).toLocaleString("en-KE");});
  const fill=(id,rows)=>{const body=$(id);if(!body)return;body.innerHTML=rows.length?rows.map(r=>'<tr><td>'+esc(date(r.check_in_time||r.created_at))+'</td><td>'+esc(r.student_name||r.student_id||"—")+'</td><td>'+esc(r.registration_number||r.student_id||"—")+'</td><td>'+esc(r.program||"—")+'</td><td>'+esc(r.session_type||r.location_type||"—")+'</td><td>'+esc(r.target_name||"—")+'</td><td>'+esc(r.distance_meters==null?"—":Math.round(Number(r.distance_meters))+" m")+'</td><td><span class="ia-status">'+esc(r.attendance_status||(r.is_verified?"Present":"Pending"))+'</span></td></tr>').join(""):'<tr><td colspan="8" class="ia-empty">No attendance records found.</td></tr>';};
  fill("iaAttendanceTodayRows",today);fill("iaAttendanceHistoryRows",history);
 }
 async function load(){
  api=window.CampusInstitutionAdmin;if(!api?.institutionId)return;
  try{message("Loading institution attendance…");
   const st=await db().from("students").select("id,admission_number,full_name,course").eq("institution_id",api.institutionId).limit(10000);if(st.error)throw st.error;students=st.data||[];
   const studentSelect=$("iaAttStudent");if(studentSelect){const previous=studentSelect.value;studentSelect.innerHTML='<option value="">Select student</option>'+students.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.full_name||x.admission_number||x.id)+' · '+esc(x.admission_number||"")+'</option>').join("");if(students.some(x=>String(x.id)===previous))studentSelect.value=previous;}
   // Geo logs may identify a learner by students.id, admission number,
   // consolidated profile user_id or profile student_id. Resolve all aliases
   // from institution-scoped source records before querying geo logs.
   const profileResult=await db().from("consolidated_user_profiles_table").select("user_id,student_id,admission_number,full_name,program,institution_id").eq("institution_id",api.institutionId).eq("role","student").limit(10000);
   if(profileResult.error)console.warn("[Institution attendance] Profile aliases unavailable:",profileResult.error.message);
   const profiles=profileResult.data||[];
   const studentKeys=[...new Set([...students.flatMap(x=>[x.id,x.admission_number]),...profiles.flatMap(x=>[x.student_id,x.admission_number])].filter(Boolean).map(String))];
   const userIds=[...new Set([...students.map(x=>x.id),...profiles.map(x=>x.user_id)].filter(Boolean).map(String))];
   let logs=[];
   for(let i=0;i<studentKeys.length;i+=150){
    const batch=studentKeys.slice(i,i+150);
    const r=await db().from("geo_attendance_logs").select("*").in("student_id",batch).eq("institution_id",api.institutionId).order("check_in_time",{ascending:false}).limit(5000);
    if(r.error)throw r.error;logs.push(...(r.data||[]));
   }
   for(let i=0;i<userIds.length;i+=150){
    const batch=userIds.slice(i,i+150);
    const r=await db().from("geo_attendance_logs").select("*").in("user_id",batch).eq("institution_id",api.institutionId).order("check_in_time",{ascending:false}).limit(5000);
    if(r.error)throw r.error;logs.push(...(r.data||[]));
   }
   // Always query the institution_id-scoped manual attendance table, even when
   // the institution has no student identifiers and therefore no geo-log batch.
   const manual=await db().from("attendance").select("id,student_id,date,timestamp,course_or_rotation,status,marked_by,institution_id").eq("institution_id",api.institutionId).order("timestamp",{ascending:false}).limit(5000);
   if(manual.error)console.warn("[Institution attendance] Manual attendance history unavailable:",manual.error.message);
   const byStudentKey=new Map(),profileByKey=new Map();
   students.forEach(x=>{[x.id,x.admission_number].filter(Boolean).forEach(k=>byStudentKey.set(String(k),x));});
   profiles.forEach(p=>{[p.user_id,p.student_id,p.admission_number].filter(Boolean).forEach(k=>profileByKey.set(String(k),p));});
   const enrichedLogs=[...new Map(logs.map(x=>[String(x.id||x.student_id)+":"+String(x.check_in_time||x.created_at||""),x])).values()].map(x=>{const st=byStudentKey.get(String(x.student_id||x.user_id))||{},p=profileByKey.get(String(x.student_id||x.user_id))||{};return{...x,student_name:x.student_name||st.full_name||p.full_name||x.student_id,registration_number:x.registration_number||st.admission_number||p.admission_number||x.student_id,program:x.program||st.course||p.program||""};});
   const manualRows=(manual.data||[]).map(x=>{const st=byStudentKey.get(String(x.student_id))||{},p=profileByKey.get(String(x.student_id))||{};return{id:"manual-"+x.id,student_name:st.full_name||p.full_name||st.admission_number||x.student_id,student_id:st.admission_number||p.admission_number||x.student_id,registration_number:st.admission_number||p.admission_number||"",program:st.course||p.program||"",session_type:"Manual",location_type:"manual",target_name:x.course_or_rotation||"Manual check-in",check_in_time:x.timestamp||x.date,attendance_status:x.status||"Present",is_verified:String(x.status||"").toLowerCase()==="present",institution_id:api.institutionId,_manual:true};});
   records=[...enrichedLogs,...manualRows].sort((a,b)=>new Date(b.check_in_time||b.created_at||0)-new Date(a.check_in_time||a.created_at||0));
   render();message("Loaded "+records.length+" geo and manual attendance records for "+(api.institution?.name||"this institution")+".");
  }catch(e){console.error("[Institution attendance]",e);message("Attendance could not be loaded: "+e.message,true);}
 }
 function exportCsv(){const rows=filtered();if(!rows.length){message("No attendance records to export.",true);return;}const cols=["student_name","student_id","registration_number","program","session_type","target_name","check_in_time","attendance_status","is_verified","distance_meters","accuracy_m","latitude","longitude","institution_id"];const csv=[cols.join(","),...rows.map(r=>cols.map(k=>'"'+String(r[k]??"").replace(/"/g,'""')+'"').join(","))].join("\n");const a=document.createElement("a");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));a.href=url;a.download="Institution_Attendance.csv";a.click();URL.revokeObjectURL(url);}
 function resetFilters(){["iaAttendanceSearch","iaAttendanceProgram","iaAttendanceStatus","iaAttendanceType"].forEach((id,i)=>{const el=$(id);if(el)el.value=i===0?"":"all";});render();}
 function printAttendance(){window.print();}
 async function recordManual(event){
  event.preventDefault();if(!api?.user?.id)return;
  const studentId=$("iaAttStudent")?.value;if(!studentId){message("Select a student first.",true);return;}
  const dateValue=$("iaAttDate")?.value||day(),timeValue=$("iaAttTime")?.value||"12:00";
  const session=$("iaAttSession")?.value||"classroom",target=$("iaAttTarget")?.value.trim()||"";
  const payload={institution_id:api.institutionId,student_id:studentId,date:dateValue,timestamp:new Date(dateValue+"T"+timeValue+":00").toISOString(),course_or_rotation:[session,target].filter(Boolean).join(" · "),status:"Present",marked_by:api.user.id};
  try{const {error}=await db().from("attendance").insert(payload);if(error)throw error;message("Manual attendance recorded.");$("iaManualAttendanceForm")?.reset();if($("iaAttDate"))$("iaAttDate").value=day();await load();}catch(e){message("Manual attendance could not be recorded: "+e.message,true);}
 }
 function init(){["iaAttendanceSearch","iaAttendanceProgram","iaAttendanceStatus","iaAttendanceType"].forEach(id=>$(id)?.addEventListener(id==="iaAttendanceSearch"?"input":"change",render));$("iaAttendanceRefresh")?.addEventListener("click",load);$("iaAttendanceExport")?.addEventListener("click",exportCsv);$("iaAttendanceReset")?.addEventListener("click",resetFilters);$("iaAttendancePrint")?.addEventListener("click",printAttendance);document.addEventListener("click",e=>{if(e.target.closest('#iaNav [data-view="attendance"]'))setTimeout(load,100);});$("iaManualAttendanceForm")?.addEventListener("submit",recordManual);if($("iaAttDate"))$("iaAttDate").value=day();api=window.CampusInstitutionAdmin;if(api?.institutionId&&$("view-attendance")?.classList.contains("active"))load();}
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
 window.InstitutionAdminAttendance={refresh:load,export:exportCsv,reset:resetFilters,print:printAttendance};
})();