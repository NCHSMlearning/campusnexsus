/* Tenant-safe adapters for the original Super Admin academic section controls.
 * All data work is delegated to the Institution Admin modules, which scope reads/writes
 * to CampusInstitutionAdmin.institutionId.
 */
(() => {
  "use strict";
  const notify = (message, error=false) => {
    if (typeof window.showNotification === "function") window.showNotification(message, error ? "error" : "success");
    else if (typeof window.showFeedback === "function") window.showFeedback(message, error ? "error" : "success");
    else console.info("[Campus Nexus]", message);
  };
  const click = id => document.getElementById(id)?.click();
  const change = id => document.getElementById(id)?.dispatchEvent(new Event("change", {bubbles:true}));
  window.refreshMarksData = async () => { await window.InstitutionAdminMarksEntry?.refresh?.(); await window.InstitutionAdminResults?.refresh?.(); };
  window.exportAllMarksData = () => window.InstitutionAdminMarksEntry?.export?.();
  window.loadMEBlocks = () => {};
  window.loadMEUnits = () => {};
  window.loadMarksEntry = () => click("iaMELoadStudents");
  window.loadMarksApprovals = () => window.InstitutionAdminResults?.refresh?.();
  window.approveAllPendingMarks = () => window.InstitutionAdminResults?.approveAll?.();
  window.rejectAllPendingMarks = () => window.InstitutionAdminResults?.rejectAll?.();
  window.filterMarksApprovals = () => {};
  window.refreshAnalytics = window.loadAnalyticsData = () => window.InstitutionAdminAnalytics?.refresh?.();
  window.exportAnalyticsReport = window.exportConsolidatedMarksheet = () => window.InstitutionAdminAnalytics?.export?.();
  window.printConsolidatedMarksheet = () => window.InstitutionAdminAnalytics?.print?.();
  window.renderConsolidatedMarksheet = () => window.InstitutionAdminAnalytics?.refresh?.();
  window.scrollToSection = id => document.getElementById(id)?.scrollIntoView({behavior:"smooth",block:"start"});
  window.filterAnalytics = window.filterAnalyticsTable = () => window.InstitutionAdminAnalytics?.refresh?.();
  window.updateAnalyticsMetric = () => window.InstitutionAdminAnalytics?.refresh?.();
  window.refreshAttendance = () => window.InstitutionAdminAttendance?.refresh?.();
  window.exportAllAttendance = () => window.InstitutionAdminAttendance?.export?.();
  window.resetAttendanceFilters = () => window.InstitutionAdminAttendance?.reset?.();
  window.filterAttendance = () => {};
  window.adminCheckIn = event => { if(event) event.preventDefault(); return false; };
  window.toggleAttendanceFields = () => {};
  window.exportTableToCSV = () => window.InstitutionAdminAttendance?.export?.();

  // Route legacy page controls to the existing tenant-scoped Institution Admin modules.
  const openTenantView = key => {
    const nav = document.querySelector('[data-view="' + key + '"]');
    if (nav) nav.click();
    else notify("This institution workspace is not available.", true);
  };
  const csvFromTable = (bodyId, filename) => {
    const body = document.getElementById(bodyId);
    if (!body) return notify("There are no institution records to export yet.", true);
    const rows = [...body.closest("table").querySelectorAll("tr")].map(tr =>
      [...tr.children].map(td => '"' + (td.innerText || "").replace(/"/g, '""').replace(/\s+/g, " ").trim() + '"').join(",")
    );
    const blob = new Blob([rows.join("\r\n")], {type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url);
  };
  window.refreshStudentManagement = () => openTenantView("students");
  window.exportStudentRequests = () => csvFromTable("iaStudents","institution-students.csv");
  window.showSMSubTab = id => {
    const target = document.getElementById(id);
    if (!target) return;
    const root = document.getElementById("view-students");
    root?.querySelectorAll("[id^='sm'][role='tabpanel'],.sm-tab-panel").forEach(el=>el.hidden=true);
    target.hidden=false;
  };
  window.loadAdmissions = () => openTenantView("admissions");
  window.loadChangeProgramRequests = window.loadReadmissionRequests = window.loadSessionReportsAdmin = window.loadSMHistory = () =>
    notify("Student request workflows are not yet connected to this institution's request records.", true);
  window.bulkApproveSM = window.bulkRejectSM = window.bulkReviewSM =
  window.bulkApproveSessionReports = window.bulkRejectSessionReports = () =>
    notify("Bulk request decisions are disabled until institution-scoped request records are connected.", true);
  window.loadExams = () => openTenantView("exams");
  window.exportExamsToCSV = () => csvFromTable("iaExams","institution-examinations.csv");
  window.showExamTab = id => {
    const target=document.getElementById(id); if(!target)return;
    document.querySelectorAll("#view-exams [id$='Tab']").forEach(el=>el.hidden=true);
    target.hidden=false;
  };
  window.searchStudentsForNotification = () => notify("Student notification targeting is handled by the institution communication module.");
  const timetableApi=()=>{const api=window.CampusInstitutionAdmin;if(!api?.db||!api?.institutionId)throw new Error("Institution session is not ready. Refresh and sign in again.");return api;};
  const timetableEsc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let institutionCalendarEvents=[];
  async function loadInstitutionCalendar(){
    const api=timetableApi();
    const {data,error}=await api.db.from("calendar_events").select("id,event_name,title,event_date,type,description,target_program,target_block,target_intake_year,venue,start_time,end_time,organizer,location").eq("institution_id",api.institutionId).order("event_date",{ascending:true}).limit(3000);
    if(error)throw error;
    institutionCalendarEvents=data||[];
    const body=document.getElementById("iaTimetable");
    if(body)body.innerHTML=institutionCalendarEvents.length?institutionCalendarEvents.map(e=>{const d=e.event_date?new Date(e.event_date):null;const desc=String(e.description||"");const time=(e.start_time||"—")+" - "+(e.end_time||"—");const venue=e.venue||e.location||"—";return '<tr><td>'+timetableEsc(e.event_name||e.title)+'</td><td>'+timetableEsc(d&&!Number.isNaN(d.getTime())?d.toLocaleDateString("en-KE"):"—")+'</td><td>'+timetableEsc(time.split(/[-–]/)[0]?.trim()||"—")+'</td><td>'+timetableEsc(time.split(/[-–]/)[1]?.trim()||"—")+'</td><td>'+timetableEsc(e.target_program||"All programmes")+'</td><td>'+timetableEsc(e.target_block||"All blocks")+'</td><td>'+timetableEsc(e.type||"—")+'</td><td>'+timetableEsc(e.organizer||"—")+'</td><td>'+timetableEsc(venue)+'</td><td><button type="button" class="ia-danger-btn" data-calendar-delete="'+timetableEsc(e.id)+'">Delete</button></td></tr>';}).join(""):'<tr><td colspan="10" class="ia-empty">No timetable events have been created for this institution.</td></tr>';
    const upcoming=document.getElementById("upcomingEventsBody");
    if(upcoming)upcoming.innerHTML=institutionCalendarEvents.length?institutionCalendarEvents.map(e=>'<tr><td>'+timetableEsc(e.event_date||"—")+'</td><td>'+timetableEsc(e.event_name||"—")+'</td><td>'+timetableEsc(e.type||"—")+'</td><td>'+timetableEsc(e.target_program||"All programmes")+'</td><td>'+timetableEsc(e.target_block||"All blocks")+'</td><td>'+timetableEsc(e.description||"—")+'</td><td><button type="button" class="ia-danger-btn" data-calendar-delete="'+timetableEsc(e.id)+'">Delete</button></td></tr>').join(""):'<tr><td colspan="7" class="ia-empty">No sessions have been scheduled.</td></tr>';
    return institutionCalendarEvents;
  }
  async function timetablePrograms(){
    const api=timetableApi();
    const {data,error}=await api.db.from("programs").select("id,program_code,program_name,category,structure_type,status").eq("institution_id",api.institutionId).eq("status","active").order("program_name");
    if(error)throw error;return data||[];
  }
  async function fillPeriodOptions(programCode,selectIds){
    const api=timetableApi(),programs=await timetablePrograms();
    const selected=String(programCode||"").trim();
    let matches=programs.filter(p=>selected==="General"||selected==="TVET"?(selected==="General"||String(p.category||"").toUpperCase()!=="KRCHN"):String(p.program_code||"").toLowerCase()===selected.toLowerCase());
    if(selected==="KRCHN")matches=programs.filter(p=>String(p.category||"").toUpperCase()==="KRCHN"||String(p.program_code||"").toUpperCase()==="KRCHN");
    const options=[];
    for(const p of matches){const {data,error}=await api.db.from("program_blocks").select("block_name,block_sequence,status").eq("institution_id",api.institutionId).eq("program_id",p.id).eq("status","active").order("block_sequence");if(error)throw error;(data||[]).forEach(b=>{if(!options.some(x=>x.value===b.block_name))options.push({value:b.block_name,label:matches.length>1?p.program_code+" · "+b.block_name:b.block_name});});}
    selectIds.forEach(id=>{const el=document.getElementById(id);if(!el)return;const old=el.value;el.replaceChildren(new Option("-- Select Block / Term --",""));options.forEach(o=>el.add(new Option(o.label,o.value)));if([...el.options].some(o=>o.value===old))el.value=old;});
    return options;
  }
  window.updateTimetableBlocks=async()=>{
    try{
      const api=timetableApi(),programs=await timetablePrograms(),programSelect=document.getElementById("adminTimetableProgram"),weekly=document.getElementById("weeklyProgram");
      [programSelect,weekly].filter(Boolean).forEach(el=>{const old=el.value;el.replaceChildren(new Option("-- Select Programme --",""));programs.forEach(p=>el.add(new Option(p.program_code+" — "+p.program_name,p.program_code)));if([...el.options].some(o=>o.value===old))el.value=old;});
      const code=programSelect?.value||"";
      if(code){const structure=await window.CampusAcademicStructure?.resolve?.(api.db,api.institutionId,code,{refresh:true});const options=structure?.periods||[];["adminTimetableBlock","previewBlockSelect"].forEach(id=>{const el=document.getElementById(id);if(!el)return;const old=el.value;el.replaceChildren(new Option("-- Select Block / Term --",""));options.forEach(p=>el.add(new Option(p.name,p.name)));if([...el.options].some(o=>o.value===old))el.value=old;});}
    }catch(error){notify("Unable to load institution programme blocks: "+error.message,true);}
  };
  window.updateBlockTermOptions=(programId,blockId)=>fillPeriodOptions(document.getElementById(programId)?.value,[blockId]).catch(e=>notify("Unable to load programme blocks: "+e.message,true));
  window.refreshCalendarData=async()=>{openTenantView("timetable");try{await loadInstitutionCalendar();}catch(e){notify("Unable to load institution timetable: "+e.message,true);}};
  window.exportTimetableData=async()=>{
    try{const rows=await loadInstitutionCalendar();const cols=["event_name","event_date","type","target_program","target_block","target_intake_year","description"];const csv=[cols.join(","),...rows.map(r=>cols.map(k=>'"'+String(r[k]??"").replace(/"/g,'""')+'"').join(","))].join("\r\n");const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="institution-timetable.csv";a.click();URL.revokeObjectURL(url);}catch(e){notify("Timetable export failed: "+e.message,true);}
  };
  window.previewTimetable=async()=>{
    try{const rows=await loadInstitutionCalendar(),program=document.getElementById("adminTimetableProgram")?.value,block=document.getElementById("previewBlockSelect")?.value;const filtered=rows.filter(r=>(!program||r.target_program===program||r.target_program==="General")&&(!block||r.target_block===block));const host=document.getElementById("adminTimetablePreview")||document.getElementById("fullCalendarDisplay");if(host){host.innerHTML=filtered.length?'<div class="ia-panel"><h3>Timetable preview</h3>'+filtered.map(e=>'<p><strong>'+timetableEsc(e.event_name)+'</strong> · '+timetableEsc(e.event_date)+' · '+timetableEsc(e.target_block||"All blocks")+'</p>').join("")+'</div>':'<p class="ia-empty">No matching timetable events for this programme and block.</p>';}}catch(e){notify("Timetable preview failed: "+e.message,true);}
  };
  window.downloadTimetableTemplate=()=>{
    const csv="day_of_week,week_number,start_time,end_time,session_name,course_name,lecturer_name,venue,is_holiday,is_exam\r\nMonday,1,08:00,10:30,Lecture,Medical Surgical Nursing,Name,Main Hall,FALSE,FALSE\r\n";
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="campus-nexus-timetable-template.csv";a.click();URL.revokeObjectURL(url);
  };
  window.showUploadMethod=method=>{
    ["excel","single","bulk"].forEach(k=>{const panel=document.getElementById(k==="excel"?"excelUploadMethod":k==="single"?"singleEventMethod":"bulkScheduleMethod"),button=document.getElementById(k==="excel"?"excelTabBtn":k==="single"?"singleTabBtn":"bulkTabBtn");if(panel)panel.hidden=k!==method;if(button){button.classList.toggle("active",k===method);button.setAttribute("aria-pressed",String(k===method));}});
  };
  window.addSingleEvent=async()=>{
    try{const api=timetableApi(),title=document.getElementById("singleEventTitle")?.value.trim(),date=document.getElementById("singleEventDate")?.value,program=document.getElementById("singleEventProgram")?.value||"General",block=document.getElementById("singleEventBlock")?.value||null,type=document.getElementById("singleEventType")?.value||"Class",start=document.getElementById("singleEventStart")?.value,end=document.getElementById("singleEventEnd")?.value,venue=document.getElementById("singleEventVenue")?.value.trim(),details=document.getElementById("singleEventDetails")?.value.trim();if(!title||!date)throw new Error("Session title and date are required.");const description=[details,start||end?"Time: "+(start||"—")+" - "+(end||"—"):"",venue?"Venue: "+venue:""].filter(Boolean).join(" | ");const {error}=await api.db.from("calendar_events").insert({institution_id:api.institutionId,event_name:title,title,event_date:new Date(date+"T12:00:00").toISOString(),type,description,target_program:program,target_block:block||"General",target_intake_year:null,start_time:start||null,end_time:end||null,venue:venue||null,location:venue||null});if(error)throw error;notify("Timetable session saved.");await loadInstitutionCalendar();}catch(e){notify("Unable to save session: "+e.message,true);}
  };
  window.createWeeklySchedule=async()=>{
    try{const api=timetableApi(),day=String(document.getElementById("weeklyDay")?.value||"").toLowerCase(),start=document.getElementById("weeklyStartDate")?.value,end=document.getElementById("weeklyEndDate")?.value,fromTime=document.getElementById("weeklyStartTime")?.value,toTime=document.getElementById("weeklyEndTime")?.value,course=document.getElementById("weeklyCourse")?.value.trim(),venue=document.getElementById("weeklyVenue")?.value.trim(),program=document.getElementById("weeklyProgram")?.value,block=document.getElementById("weeklyBlock")?.value;if(!day||!start||!end||!course||!program||!block)throw new Error("Select day, date range, programme, block and unit.");if(new Date(end)<new Date(start))throw new Error("End date must be on or after start date.");const rows=[];for(let d=new Date(start+"T12:00:00");d<=new Date(end+"T12:00:00");d.setDate(d.getDate()+1)){if(d.toLocaleDateString("en-US",{weekday:"long"}).toLowerCase()===day){const date=d.toISOString().slice(0,10);rows.push({institution_id:api.institutionId,event_name:course,title:course,event_date:new Date(date+"T12:00:00").toISOString(),type:"Class",description:["Time: "+(fromTime||"—")+" - "+(toTime||"—"),venue?"Venue: "+venue:""].filter(Boolean).join(" | "),target_program:program,target_block:block,target_intake_year:null,start_time:fromTime||null,end_time:toTime||null,venue:venue||null,location:venue||null});}}if(!rows.length)throw new Error("No matching "+day+" dates fall within the selected date range.");const {error}=await api.db.from("calendar_events").insert(rows);if(error)throw error;notify(rows.length+" weekly session(s) created.");await loadInstitutionCalendar();}catch(e){notify("Weekly schedule could not be created: "+e.message,true);}
  };
  window.uploadTimetableToSupabase=async()=>{
    try{const api=timetableApi(),file=document.getElementById("adminTimetableFile")?.files?.[0]||document.getElementById("bulkExcelFile")?.files?.[0];if(!file)throw new Error("Choose a CSV timetable file first.");if(!/\.csv$/i.test(file.name))throw new Error("This importer currently accepts CSV only. Export the Excel sheet as CSV using the supplied template.");const text=await file.text(),lines=text.split(/\r?\n/).filter(Boolean);if(lines.length<2)throw new Error("The CSV contains no timetable rows.");const parseLine=line=>{const out=[];let v="",quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'&&line[i+1]==='"'&&quoted){v+='"';i++;}else if(c==='"')quoted=!quoted;else if(c===","&&!quoted){out.push(v.trim());v="";}else v+=c;}out.push(v.trim());return out;};const headers=parseLine(lines[0]).map(x=>x.toLowerCase());const index=k=>headers.indexOf(k);const required=["day_of_week","week_number","start_time","end_time","session_name","course_name","lecturer_name","venue","is_holiday","is_exam"];const missing=required.filter(k=>index(k)<0);if(missing.length)throw new Error("CSV is missing columns: "+missing.join(", "));const program=document.getElementById("adminTimetableProgram")?.value,block=document.getElementById("adminTimetableBlock")?.value;if(!program||!block)throw new Error("Select the institution programme and block before uploading.");const anchor=document.getElementById("weeklyStartDate")?.value;if(!anchor)throw new Error("Select a start date in the weekly schedule section to anchor the CSV week numbers.");const monday=new Date(anchor+"T12:00:00");monday.setDate(monday.getDate()-((monday.getDay()+6)%7));const dayIndex={monday:0,tuesday:1,wednesday:2,thursday:3,friday:4,saturday:5,sunday:6};const rows=lines.slice(1).map(line=>parseLine(line)).filter(c=>c.some(Boolean)).map(c=>{const week=Math.max(1,Number(c[index("week_number")])||1),day=dayIndex[String(c[index("day_of_week")]||"").toLowerCase()];if(day===undefined)throw new Error("Invalid day_of_week in CSV.");const d=new Date(monday);d.setDate(d.getDate()+(week-1)*7+day);const session=c[index("session_name")]||c[index("course_name")];const desc=["Time: "+c[index("start_time")]+" - "+c[index("end_time")],"Course: "+c[index("course_name")],"Lecturer: "+c[index("lecturer_name")],"Venue: "+c[index("venue")],"Holiday: "+c[index("is_holiday")],"Exam: "+c[index("is_exam")]].join(" | ");return{institution_id:api.institutionId,event_name:session,title:session,event_date:new Date(d.toISOString().slice(0,10)+"T12:00:00").toISOString(),type:String(c[index("is_exam")]).toLowerCase()==="true"?"Examination":"Class",description:desc,target_program:program,target_block:block,target_intake_year:null,start_time:c[index("start_time")]||null,end_time:c[index("end_time")]||null,venue:c[index("venue")]||null,location:c[index("venue")]||null,organizer:c[index("lecturer_name")]||null};});if(!rows.length)throw new Error("No valid timetable rows found.");const {error}=await api.db.from("calendar_events").insert(rows);if(error)throw error;notify(rows.length+" timetable rows uploaded.");await loadInstitutionCalendar();}catch(e){notify("Timetable upload failed: "+e.message,true);}
  };
  window.clearTimetableBlock=async()=>{
    try{const api=timetableApi(),program=document.getElementById("adminTimetableProgram")?.value,block=document.getElementById("adminTimetableBlock")?.value;if(!program||!block)throw new Error("Select a programme and block before clearing.");if(!confirm("Delete all timetable events for "+program+" · "+block+" in this institution?"))return;const {error}=await api.db.from("calendar_events").delete().eq("institution_id",api.institutionId).eq("target_program",program).eq("target_block",block);if(error)throw error;notify("Selected institution timetable block cleared.");await loadInstitutionCalendar();}catch(e){notify("Unable to clear timetable block: "+e.message,true);}
  };
  document.addEventListener("click",async e=>{const btn=e.target.closest("[data-calendar-delete]");if(!btn)return;const api=timetableApi();if(!confirm("Delete this timetable event?"))return;btn.disabled=true;try{const {error}=await api.db.from("calendar_events").delete().eq("id",btn.dataset.calendarDelete).eq("institution_id",api.institutionId);if(error)throw error;notify("Timetable event deleted.");await loadInstitutionCalendar();}catch(err){notify("Unable to delete event: "+err.message,true);}finally{btn.disabled=false;}});
  document.addEventListener("click",e=>{if(e.target.closest('[data-view="timetable"]'))setTimeout(()=>{loadInstitutionCalendar().catch(err=>notify("Unable to load timetable: "+err.message,true));window.updateTimetableBlocks?.();},120);});

  window.filterSMRequests = type => {
    const prefix = type==="admissions"?"smAdmissions":type==="change-program"?"smChange":type==="readmission"?"smReadmission":"smSessionReport";
    const bodyId = type==="admissions"?"smAdmissionsBody":type==="change-program"?"smChangeProgramBody":type==="readmission"?"smReadmissionBody":"smSessionReportsBody";
    const q=(document.getElementById(prefix+"Search")?.value||"").toLowerCase();
    const status=document.getElementById(prefix+"StatusFilter")?.value||"all";
    document.getElementById(bodyId)?.querySelectorAll("tr").forEach(tr=>{
      const text=(tr.innerText||"").toLowerCase();
      const matchStatus=status==="all"||text.includes(status.toLowerCase());
      tr.hidden=!(text.includes(q)&&matchStatus);
    });
  };
  window.toggleAllSMCheckboxes = type => {
    const suffix=type==="admissions"?"Admissions":type==="change-program"?"Change":type==="readmission"?"Readmission":"SessionReports";
    const master=document.getElementById("smSelectAll"+suffix);
    const bodyId=type==="admissions"?"smAdmissionsBody":type==="change-program"?"smChangeProgramBody":type==="readmission"?"smReadmissionBody":"smSessionReportsBody";
    document.getElementById(bodyId)?.querySelectorAll('input[type="checkbox"]').forEach(cb=>{cb.checked=!!master?.checked;});
  };
  window.toggleSMRequestFields = () => {
    const type=document.querySelector('input[name="requestType"]:checked')?.value||"change-program";
    const current=document.getElementById("smCurrentProgramSection"), previous=document.getElementById("smPreviousProgramSection");
    if(current)current.hidden=type!=="change-program";
    if(previous)previous.hidden=type!=="readmission";
  };
  window.filterExamsTable = () => {
    const q=(document.getElementById("exam-search")?.value||"").toLowerCase();
    const program=(document.getElementById("exam_filter_program")?.value||"").toLowerCase();
    const status=(document.getElementById("exam_filter_status")?.value||"").toLowerCase();
    document.getElementById("exams-table-body")?.querySelectorAll("tr").forEach(tr=>{
      const text=(tr.innerText||"").toLowerCase();
      tr.hidden=!(text.includes(q)&&(!program||text.includes(program))&&(!status||text.includes(status)));
    });
  };
  window.refreshStudentDirectory = () => openTenantView("students");
  // These legacy controls are not allowed to run Super Admin-wide handlers in a tenant session.
  window.openStudentPublishModal = () => notify("Student result publication is managed in the institution's Published Marks module.");
  window.publishCurrentUnitMarks = () => notify("Use the institution's Published Marks module to release approved results.");
  window.showLecturerAssignmentModal = window.refreshAssignmentHistory = window.clearAllAssignments = window.resetUnitColumns = () =>
    notify("This legacy control is not enabled in the institution-scoped workflow yet.", true);
})();