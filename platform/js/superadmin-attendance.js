/* Campus Nexus Super Admin — Attendance records and geo verification */
(() => {
 "use strict";
 const $=id=>document.getElementById(id), state={db:null,rows:[],history:[]};
 const db=()=>state.db||(state.db=window.sb||window.supabaseClient||window.supabase||window.client||null);
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const fmt=v=>v?new Date(v).toLocaleString("en-KE",{dateStyle:"medium",timeStyle:"short"}):"—";
 const today=()=>new Date().toISOString().slice(0,10);
 function note(msg,bad=false){let el=$("saAttendanceNotice");if(!el){el=document.createElement("div");el.id="saAttendanceNotice";el.style.cssText="padding:10px 14px;border-radius:8px;margin:0 0 14px";$("attendance")?.prepend(el);}if(el){el.textContent=msg;el.style.background=bad?"#fff0ef":"#eaf8f2";el.style.color=bad?"#a12b2b":"#16634a";}}
 function matches(r){const q=($("attendance_search")?.value||"").trim().toLowerCase(),p=($("attendance_program_filter")?.value||"all").toLowerCase(),t=($("attendance_type_filter")?.value||"all").toLowerCase(),s=($("attendance_status_filter")?.value||"all").toLowerCase();return (!q||[r.student_name,r.student_id,r.registration_number,r.program,r.target_name,r.location_address,r.institution_id].some(v=>String(v??"").toLowerCase().includes(q)))&&(p==="all"||String(r.program||"").toLowerCase().includes(p==="krchn"?"krchn":p))&&(t==="all"||String(r.session_type||r.location_type||"").toLowerCase()===t)&&(s==="all"||(s==="verified"?r.is_verified===true||String(r.attendance_status||"").toLowerCase()==="present":r.is_verified!==true&&String(r.attendance_status||"").toLowerCase()!=="present"));}
 function render(){
  const rows=state.rows.filter(matches),tod=rows.filter(r=>String(r.check_in_time||r.created_at||"").slice(0,10)===today()),past=rows.filter(r=>String(r.check_in_time||r.created_at||"").slice(0,10)!==today());
  $("attendanceTotalCount")&&($("attendanceTotalCount").textContent=String(rows.length));$("todayCount")&&($("todayCount").textContent=String(tod.length));$("pastCount")&&($("pastCount").textContent=String(past.length));
  const fill=(id,arr)=>{const body=$(id);if(!body)return;body.innerHTML=arr.length?arr.map(r=>'<tr><td>'+esc(r.student_name||r.student_id||"—")+'</td><td>'+esc(r.session_type||r.location_type||"—")+'</td><td>'+esc(r.program||"—")+'</td><td>'+esc(r.target_name||"—")+'</td><td>'+esc(r.location_address||"—")+'</td><td>'+esc(fmt(r.check_in_time||r.created_at))+'</td><td>'+esc(r.latitude!=null&&r.longitude!=null?Number(r.latitude).toFixed(5)+", "+Number(r.longitude).toFixed(5):"—")+'</td><td>'+esc(r.attendance_status|| (r.is_verified?"Verified":"Pending"))+'</td><td>'+esc(r.institution_id||"—")+'</td></tr>').join(""):'<tr><td colspan="9" style="padding:28px;text-align:center;color:#64748b">No attendance records found.</td></tr>';};
  fill("attendance-table-body",tod);const pastBody=$("past-attendance-table-body");if(pastBody)pastBody.innerHTML=past.length?past.map(r=>"<tr><td>"+esc(r.student_name||r.student_id||"—")+"</td><td>"+esc(r.session_type||r.location_type||"—")+"</td><td>"+esc(r.program||"—")+"</td><td>"+esc(r.target_name||"—")+"</td><td>"+esc(fmt(r.check_in_time||r.created_at))+"</td><td>"+esc(r.attendance_status||(r.is_verified?"Verified":"Pending"))+"</td><td>"+esc(r.institution_id||"—")+"</td></tr>").join(""):"<tr><td colspan=\"7\" style=\"padding:28px;text-align:center;color:#64748b\">No attendance history found.</td></tr>";
 }
 async function load(){
  const client=db();if(!client?.from){note("Supabase client is not ready.",true);return;}
  try{
   const [geo,manual,students]=await Promise.all([
    client.from("geo_attendance_logs").select("*").order("check_in_time",{ascending:false}).limit(5000),
    client.from("attendance").select("id,student_id,date,timestamp,course_or_rotation,status,marked_by,institution_id").order("timestamp",{ascending:false}).limit(5000),
    client.from("students").select("id,full_name,admission_number,course,institution_id").limit(10000)
   ]);
   if(geo.error)throw geo.error;
   if(manual.error)console.warn("[Super Admin attendance] Manual attendance history unavailable:",manual.error.message);
   if(students.error)console.warn("[Super Admin attendance] Student directory unavailable:",students.error.message);
   const directory=students.data||[];
   const byId=new Map(directory.map(x=>[String(x.id),x]));
   const options=$("att_student_id");
   if(options){const oldValue=options.value;options.innerHTML='<option value="">-- Select Student --</option>'+directory.map(x=>'<option value="'+esc(x.id)+'" data-institution="'+esc(x.institution_id||"")+'">'+esc(x.full_name||x.admission_number||x.id)+' · '+esc(x.admission_number||"")+'</option>').join("");if(directory.some(x=>String(x.id)===oldValue))options.value=oldValue;}
   const geoRows=geo.data||[];
   const manualRows=(manual.data||[]).map(x=>{const student=byId.get(String(x.student_id))||{};return{id:"manual-"+x.id,student_name:student.full_name||student.admission_number||x.student_id,student_id:student.admission_number||x.student_id,program:student.course||"",session_type:"Manual",target_name:x.course_or_rotation||"Manual check-in",check_in_time:x.timestamp||x.date,attendance_status:x.status||"Present",is_verified:String(x.status||"").toLowerCase()==="present",institution_id:x.institution_id||student.institution_id||"",verification_source:"Manual attendance",_manual:true};});
   state.rows=[...geoRows,...manualRows].sort((a,b)=>new Date(b.check_in_time||b.created_at||0)-new Date(a.check_in_time||a.created_at||0));
   render();note("Attendance refreshed · "+state.rows.length+" geo and manual records loaded.");
  }catch(e){console.error("[Super Admin attendance]",e);note("Unable to load attendance records: "+e.message,true);}
 }
 function exportRows(rows,name){if(!rows.length){note("There are no records to export.",true);return;}const cols=["student_name","student_id","registration_number","program","session_type","target_name","check_in_time","attendance_status","is_verified","distance_meters","accuracy_m","latitude","longitude","institution_id"];const csv=[cols.join(","),...rows.map(r=>cols.map(k=>'"'+String(r[k]??"").replace(/"/g,'""')+'"').join(","))].join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));a.download=name;a.click();URL.revokeObjectURL(a.href);}
 function init(){
  $("attendance_search")?.addEventListener("input",render);["attendance_program_filter","attendance_type_filter","attendance_status_filter"].forEach(id=>$(id)?.addEventListener("change",render));
  if(typeof window.refreshAttendance!=="function")window.refreshAttendance=load;
  window.exportAllAttendance=()=>exportRows(state.rows.filter(matches),"Super_Admin_Attendance.csv");
  window.filterAttendance=render;window.resetAttendanceFilters=()=>{["attendance_search","attendance_program_filter","attendance_type_filter","attendance_status_filter"].forEach((id,i)=>{const el=$(id);if(el)el.value=i===0?"":"all";});render();};
  window.adminCheckIn=()=>note("Administrator self check-in is not available from the student geo-attendance register. Use your staff attendance workflow.",true);
  document.querySelectorAll('[data-tab="attendance"]').forEach(el=>el.addEventListener("click",()=>setTimeout(load,120)));
  const form=$("manual-attendance-form");form?.addEventListener("submit",async e=>{
   e.preventDefault();const studentId=$("att_student_id")?.value;if(!studentId){note("Select a student first.",true);return;}
   const studentOption=$("att_student_id").selectedOptions[0],institutionId=studentOption?.dataset.institution||null;
   const dateValue=$("att_date")?.value||today(),timeValue=$("att_time")?.value||"12:00";
   const session=$("att_session_type")?.value||"classroom",department=$("att_department")?.value||"",locationValue=$("att_location")?.value||"";
   const courseLabel=[department,session,locationValue].filter(Boolean).join(" · ");
   try{const auth=await db().auth.getUser();if(auth.error)throw auth.error;
    const payload={student_id:studentId,date:dateValue,timestamp:new Date(dateValue+"T"+timeValue+":00").toISOString(),course_or_rotation:courseLabel,status:"Present",marked_by:auth.data?.user?.id||null,institution_id:institutionId};
    const {error}=await db().from("attendance").insert(payload);if(error)throw error;
    note("Manual attendance recorded successfully.");form.reset();if($("att_date"))$("att_date").value=today();await load();
   }catch(err){note("Manual attendance could not be recorded: "+err.message,true);}
  });
  if($("attendance")?.classList.contains("active"))load();
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
 window.SuperAdminAttendance={refresh:load,export:()=>exportRows(state.rows,"Super_Admin_Attendance.csv")};
})();