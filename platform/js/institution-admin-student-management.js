/* Campus Nexus — Institution-scoped Student Management
 * Connects the legacy Student Management workspace to tenant-owned records.
 * Every data operation is constrained by the authenticated institution ID.
 */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const state = { admissions:[], changes:[], readmissions:[], reports:[], history:[], activeTab:"admissions", loading:false };
  const api = () => window.CampusInstitutionAdmin;
  const db = () => api()?.db;
  const tenant = () => api()?.institutionId;
  const notify = (message, type="success") => {
    if (typeof window.showNotification === "function") window.showNotification(message, type);
    else if (typeof window.showFeedback === "function") window.showFeedback(message, type);
    else console.info("[Student Management]", message);
  };
  const failRow = (id, message, cols=8) => { const el=$(id); if(el) el.innerHTML='<tr><td colspan="'+cols+'" style="padding:34px;text-align:center;color:#b91c1c">'+esc(message)+' <button onclick="load'+(id==="smSessionReportsBody"?"SessionReportsAdmin":"Admissions")+'()">Retry</button></td></tr>'; };
  async function rows(table, order="created_at") {
    if (!db() || !tenant()) throw new Error("Institution session is not ready. Refresh the dashboard and try again.");
    let q=db().from(table).select("*").eq("institution_id",tenant());
    if(order) q=q.order(order,{ascending:false});
    const result=await q;
    if(result.error) throw result.error;
    return result.data||[];
  }
  function date(value) { return value ? new Date(value).toLocaleString("en-KE",{dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Nairobi"}) : "—"; }
  function statusPill(value) {
    const s=String(value||"pending").toLowerCase();
    const colors={pending:["#fef3c7","#92400e"],submitted:["#dbeafe","#1d4ed8"],received:["#dbeafe","#1d4ed8"],reviewing:["#ede9fe","#6d28d9"],approved:["#dcfce7","#166534"],rejected:["#fee2e2","#991b1b"],active:["#dcfce7","#166534"]};
    const c=colors[s]||["#e2e8f0","#475569"];
    return '<span style="display:inline-block;padding:4px 9px;border-radius:20px;background:'+c[0]+';color:'+c[1]+';font-size:11px;font-weight:700">'+esc(s.charAt(0).toUpperCase()+s.slice(1))+'</span>';
  }
  function selected(type) {
    const suffix=type==="admissions"?"Admissions":type==="change-program"?"Change":type==="readmission"?"Readmission":"SessionReports";
    const body=type==="admissions"?"smAdmissionsBody":type==="change-program"?"smChangeProgramBody":type==="readmission"?"smReadmissionBody":"smSessionReportsBody";
    return [...($(body)?.querySelectorAll('input[type="checkbox"]:checked')||[])].map(x=>x.dataset.id).filter(Boolean);
  }
  function updateCounts() {
    const pending=state.reports.filter(r=>(r.approval_status||"pending")==="pending").length;
    const vals={
      smTotalRequests:state.admissions.length+state.changes.length+state.readmissions.length+state.reports.length,
      smChangeProgramCount:state.changes.filter(x=>["pending","submitted","reviewing"].includes(String(x.status||"").toLowerCase())).length,
      smReadmissionCount:state.readmissions.filter(x=>["pending","submitted","reviewing"].includes(String(x.status||"").toLowerCase())).length,
      smSessionReportsCount:pending,
      smRejectedCount:[...state.admissions,...state.changes,...state.readmissions,...state.reports].filter(x=>String(x.status||x.approval_status||"").toLowerCase()==="rejected").length,
      smSessionReportsTotal:state.reports.length, smSessionReportsPending:pending,
      smSessionReportsApproved:state.reports.filter(x=>x.approval_status==="approved").length,
      smSessionReportsRejected:state.reports.filter(x=>x.approval_status==="rejected").length
    };
    Object.entries(vals).forEach(([id,v])=>{if($(id))$(id).textContent=String(v);});
    if($("smSessionReportsBadge"))$("smSessionReportsBadge").textContent=String(pending);
    if($("smAdmissionsBadge"))$("smAdmissionsBadge").textContent=String(state.admissions.length);
    if($("smChangePendingBadge"))$("smChangePendingBadge").textContent=String(vals.smChangeProgramCount);
    if($("smReadmissionBadge"))$("smReadmissionBadge").textContent=String(vals.smReadmissionCount);
  }
  async function loadAdmissions() {
    const body=$("smAdmissionsBody"); if(!body)return;
    body.innerHTML='<tr><td colspan="8" style="padding:36px;text-align:center">Loading this institution\'s admissions…</td></tr>';
    try {
      state.admissions=await rows("institution_admissions");
      const q=($("smAdmissionsSearch")?.value||"").toLowerCase();
      const status=$("smAdmissionsStatusFilter")?.value||"all";
      const program=$("smAdmissionsProgramFilter")?.value||"all";
      const list=state.admissions.filter(r=>(!q||[r.applicant_name,r.application_number,r.email,r.phone,r.programme].some(v=>String(v||"").toLowerCase().includes(q)))&&(status==="all"||String(r.status).toLowerCase()===status)&&(program==="all"||r.programme===program));
      body.innerHTML=list.length?list.map(r=>'<tr><td><input class="sm-checkbox admissions-checkbox" type="checkbox" data-id="'+esc(r.id)+'"></td><td><strong>'+esc(r.applicant_name)+'</strong><small style="display:block;color:#64748b">'+esc(r.application_number||"")+'</small></td><td>'+esc(r.programme||"—")+'</td><td>'+esc(r.student_type||"New")+'</td><td>'+date(r.created_at)+'</td><td>—</td><td>'+statusPill(r.status)+'</td><td>'+esc(r.email||"")+'</td></tr>').join(""):'<tr><td colspan="8" style="padding:45px;text-align:center;color:#64748b">No admissions applications recorded for this institution.</td></tr>';
      updateCounts();
    } catch(e) { console.error("[Institution Student Management] Admissions:",e); body.innerHTML='<tr><td colspan="8" style="padding:35px;text-align:center;color:#b91c1c">Could not load institution admissions: '+esc(e.message)+'</td></tr>'; }
  }
  async function loadRequests(kind) {
    const isChange=kind==="change_program", bodyId=isChange?"smChangeProgramBody":"smReadmissionBody", body=$(bodyId);
    if(!body)return;
    body.innerHTML='<tr><td colspan="8" style="padding:30px;text-align:center">Loading institution requests…</td></tr>';
    try {
      const all=await rows("student_requests");
      const list=all.filter(r=>String(r.request_type||"").toLowerCase()===(isChange?"change_program":"readmission"));
      if(isChange)state.changes=list;else state.readmissions=list;
      body.innerHTML=list.length?list.map(r=>'<tr><td><input class="sm-checkbox '+(isChange?"change-checkbox":"readmission-checkbox")+'" type="checkbox" data-id="'+esc(r.id)+'"></td><td>'+esc(r.student_name||r.full_name||r.student_id)+'</td><td>'+esc(r.current_program||r.program||"—")+'</td><td>'+esc(r.requested_program||r.request_type||"—")+'</td><td>'+date(r.created_at)+'</td><td>'+statusPill(r.status)+'</td><td>'+esc(r.reason||r.remarks||"—")+'</td><td>'+statusPill(r.status)+'</td></tr>').join(""):'<tr><td colspan="8" style="padding:40px;text-align:center;color:#64748b">No '+(isChange?"change-of-program":"readmission")+' requests for this institution.</td></tr>';
      updateCounts();
    } catch(e) { console.error("[Institution Student Management] Requests:",e); body.innerHTML='<tr><td colspan="8" style="padding:35px;text-align:center;color:#b91c1c">Could not load requests: '+esc(e.message)+'</td></tr>'; }
  }
  async function loadSessionReportsAdmin() {
    const body=$("smSessionReportsBody"); if(!body)return;
    body.innerHTML='<tr><td colspan="8" style="padding:36px;text-align:center">Loading session reports for this institution…</td></tr>';
    try {
      state.reports=await rows("session_reports","submitted_at");
      const q=($("smSessionReportSearch")?.value||"").toLowerCase();
      const status=$("smSessionReportStatusFilter")?.value||"all";
      const type=$("smSessionReportTypeFilter")?.value||"all";
      const list=state.reports.filter(r=>(!q||[r.student_name,r.student_id,r.program,r.session].some(v=>String(v||"").toLowerCase().includes(q)))&&(status==="all"||String(r.approval_status||"pending").toLowerCase()===status)&&(type==="all"||String(r.program_type||"").toLowerCase()===type.toLowerCase()));
      body.innerHTML=list.length?list.map(r=>'<tr><td><input class="session-reports-checkbox" type="checkbox" data-id="'+esc(r.id)+'"></td><td><strong>'+esc(r.student_name||"Unknown student")+'</strong><small style="display:block;color:#64748b">'+esc(r.student_id||"")+'</small></td><td>'+esc(r.program||"—")+'</td><td>'+esc(r.session||"—")+'</td><td>'+esc(r.status||"Continuing")+'</td><td>'+date(r.submitted_at)+'</td><td>'+statusPill(r.approval_status||"pending")+'</td><td>'+(String(r.approval_status||"pending").toLowerCase()==="pending"?'<button onclick="approveSessionReportAdmin(\''+esc(r.id)+'\')">Approve</button> <button onclick="rejectSessionReportAdmin(\''+esc(r.id)+'\')">Reject</button>':'—')+'</td></tr>').join(""):'<tr><td colspan="8" style="padding:45px;text-align:center;color:#64748b">No session reports found for this institution.</td></tr>';
      updateCounts();
    } catch(e) { console.error("[Institution Student Management] Session reports:",e); body.innerHTML='<tr><td colspan="8" style="padding:35px;text-align:center;color:#b91c1c">Could not load session reports: '+esc(e.message)+'</td></tr>'; }
  }
  async function decideReport(id, decision, confirmUser=true) {
    if(confirmUser&&!window.confirm((decision==="approved"?"Approve":"Reject")+" this student's session report?"))return false;
    const client=db(), institutionId=tenant();
    if(!client||!institutionId)throw new Error("Institution session is not ready.");
    const found=state.reports.find(r=>String(r.id)===String(id));
    const result=await client.from("session_reports").update({approval_status:decision,approved_at:new Date().toISOString(),approved_by:api()?.user?.id||"institution_admin",updated_at:new Date().toISOString()}).eq("id",id).eq("institution_id",institutionId).eq("approval_status","pending").select("id");
    if(result.error)throw result.error;
    if(!result.data?.length)throw new Error("The report was not updated. It may already have been reviewed or is outside this institution.");
    if(decision==="approved"&&found?.student_id&&found?.session) {
      let profileQuery=client.from("consolidated_user_profiles_table").select("user_id,student_id,program,current_block,block,current_year,current_term,intake_year,admission_year").eq("institution_id",institutionId).eq("student_id",found.student_id);
      const profile=await profileQuery.maybeSingle();
      if(profile.error)throw profile.error;
      if(profile.data) {
        const patch={current_block:found.session,block:found.session,updated_at:new Date().toISOString()};
        if(found.academic_year){const start=String(found.academic_year).split("/")[0];if(start&&!profile.data.intake_year)patch.intake_year=start;if(start&&!profile.data.admission_year)patch.admission_year=start;}
        const upd=await client.from("consolidated_user_profiles_table").update(patch).eq("user_id",profile.data.user_id).eq("institution_id",institutionId);
        if(upd.error)throw upd.error;
      } else {
        notify("Report approved, but no matching student profile was found to synchronize the current session. Please verify the student's profile.", "warning");
      }
    }
    await loadSessionReportsAdmin(); notify("Session report "+decision+".");
    return true;
  }
  window.approveSessionReportAdmin=(id)=>decideReport(id,"approved").catch(e=>notify(e.message,"error"));
  window.rejectSessionReportAdmin=(id)=>decideReport(id,"rejected").catch(e=>notify(e.message,"error"));
  window.bulkApproveSessionReports=async()=>{const ids=selected("session-reports");if(!ids.length)return notify("Select at least one session report.","warning");if(!confirm("Approve "+ids.length+" selected session reports?"))return;let ok=0;for(const id of ids){try{if(await decideReport(id,"approved",false))ok++;}catch(e){console.error(e);}}notify(ok+" of "+ids.length+" reports approved.");await loadSessionReportsAdmin();};
  window.bulkRejectSessionReports=async()=>{const ids=selected("session-reports");if(!ids.length)return notify("Select at least one session report.","warning");if(!confirm("Reject "+ids.length+" selected session reports?"))return;let ok=0;for(const id of ids){try{if(await decideReport(id,"rejected",false))ok++;}catch(e){console.error(e);}}notify(ok+" of "+ids.length+" reports rejected.");await loadSessionReportsAdmin();};
  window.bulkApproveSM=window.bulkRejectSM=window.bulkReviewSM=async(type)=>{const ids=selected(type||"admissions");if(!ids.length)return notify("Select at least one request.","warning");notify("Bulk admission and programme-request decisions are not enabled for this legacy request queue. Use the institution Admissions workspace for applicant decisions.","warning");};
  window.loadAdmissions=loadAdmissions;
  window.loadChangeProgramRequests=()=>loadRequests("change_program");
  window.loadReadmissionRequests=()=>loadRequests("readmission");
  window.loadSessionReportsAdmin=loadSessionReportsAdmin;
  window.loadSMHistory=async()=>{const body=$("smHistoryBody");if(body)body.innerHTML='<tr><td colspan="8" style="padding:30px;text-align:center">History is available through the institution request and session-report tabs.</td></tr>';};
  window.refreshStudentManagement=async()=>{await Promise.all([loadAdmissions(),loadRequests("change_program"),loadRequests("readmission"),loadSessionReportsAdmin()]);};
  window.exportStudentRequests=()=>{const table=$("view-students")?.querySelector(".sm-tab-content:not([style*='display: none']) table");if(!table)return notify("Open a Student Management tab before exporting.","warning");const csv=[...table.querySelectorAll("tr")].map(tr=>[...tr.children].map(td=>'"'+(td.innerText||"").replace(/"/g,'""').replace(/\s+/g," ").trim()+'"').join(",")).join("\r\n");const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="institution-student-management.csv";a.click();URL.revokeObjectURL(url);};
  window.showSMSubTab=id=>{
    const map={"admissions":"smAdmissionsTab","change-program":"smChangeProgramTab","readmission":"smReadmissionTab","session-reports":"smSessionReportsTab","history":"smHistoryTab","new-request":"smNewRequestTab"};
    const target=$(map[id]||id);if(!target)return;
    document.querySelectorAll("#view-students .sm-tab-content").forEach(el=>el.style.display="none");
    target.style.display="block";
    document.querySelectorAll("#view-students .sm-tab-btn").forEach(el=>{el.classList.remove("active");el.style.background="transparent";el.style.color="#334155";});
    const active=$("smTab"+({"admissions":"Admissions","change-program":"ChangeProgram","readmission":"Readmission","session-reports":"SessionReports","history":"History","new-request":"NewRequest"}[id]||""));
    if(active){active.classList.add("active");active.style.background="linear-gradient(135deg,#0A3D62,#1a6f9f)";active.style.color="white";}
    const loaders={"admissions":loadAdmissions,"change-program":()=>loadRequests("change_program"),"readmission":()=>loadRequests("readmission"),"session-reports":loadSessionReportsAdmin,"history":window.loadSMHistory};
    loaders[id]?.();
  };
  window.filterSMRequests=type=>{const bodyId=type==="admissions"?"smAdmissionsBody":type==="change-program"?"smChangeProgramBody":type==="readmission"?"smReadmissionBody":"smSessionReportsBody";if(type==="admissions")loadAdmissions();else if(type==="change-program")loadRequests("change_program");else if(type==="readmission")loadRequests("readmission");else loadSessionReportsAdmin();};
  window.toggleAllSMCheckboxes=type=>{const suffix=type==="admissions"?"Admissions":type==="change-program"?"Change":type==="readmission"?"Readmission":"SessionReports";const master=$("smSelectAll"+suffix);const bodyId=type==="admissions"?"smAdmissionsBody":type==="change-program"?"smChangeProgramBody":type==="readmission"?"smReadmissionBody":"smSessionReportsBody";$(bodyId)?.querySelectorAll('input[type="checkbox"]').forEach(cb=>cb.checked=!!master?.checked);};
  window.refreshStudentDirectory=()=>{window.CampusInstitutionAdmin?.refresh?.();};
  document.addEventListener("DOMContentLoaded",()=>{const body=$("smAdmissionsBody");if(body)window.refreshStudentManagement();});
  if($("smAdmissionsBody"))window.refreshStudentManagement();
})();