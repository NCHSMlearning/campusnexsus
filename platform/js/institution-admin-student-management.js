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
      body.innerHTML=list.length?list.map(r=>'<tr><td><input class="sm-checkbox admissions-checkbox" type="checkbox" data-id="'+esc(r.id)+'"></td><td><strong>'+esc(r.applicant_name)+'</strong><small style="display:block;color:#64748b">'+esc(r.application_number||"")+'</small><small style="display:block;color:#64748b">'+esc(r.email||"")+'</small></td><td>'+esc(r.programme||"—")+'</td><td>'+esc(r.student_type||"New")+'</td><td>'+date(r.created_at)+'</td><td>—</td><td>'+statusPill(r.status)+'</td><td>'+(String(r.status).toLowerCase()==="received"||String(r.status).toLowerCase()==="submitted"||String(r.status).toLowerCase()==="reviewing"?'<button type="button" data-admission-action="approved" data-id="'+esc(r.id)+'">Approve</button> <button type="button" data-admission-action="rejected" data-id="'+esc(r.id)+'">Reject</button>':'—')+'</td></tr>').join(""):'<tr><td colspan="8" style="padding:45px;text-align:center;color:#64748b">No admissions applications recorded for this institution.</td></tr>';
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
      body.innerHTML=list.length?list.map(r=>'<tr><td><input class="session-reports-checkbox" type="checkbox" data-id="'+esc(r.id)+'"></td><td><strong>'+esc(r.student_name||"Unknown student")+'</strong><small style="display:block;color:#64748b">'+esc(r.student_id||"")+'</small></td><td>'+esc(r.program||"—")+'</td><td>'+esc(r.session||"—")+'</td><td>'+esc(r.status||"Continuing")+'</td><td>'+date(r.submitted_at)+'</td><td>'+statusPill(r.approval_status||"pending")+'</td><td>'+(String(r.approval_status||"pending").toLowerCase()==="pending"?'<button type="button" class="sm-report-action" style="background:#0d6efd;color:#fff;border:0;border-radius:6px;padding:7px 12px;font-weight:600;cursor:pointer;margin-right:4px" data-session-report-action="approved" data-id="'+esc(r.id)+'"><i class="fas fa-check"></i> Approve</button> <button type="button" class="sm-report-action" style="background:#dc3545;color:#fff;border:0;border-radius:6px;padding:7px 12px;font-weight:600;cursor:pointer" data-session-report-action="rejected" data-id="'+esc(r.id)+'"><i class="fas fa-times"></i> Reject</button>':'—')+'</td></tr>').join(""):'<tr><td colspan="8" style="padding:45px;text-align:center;color:#64748b">No session reports found for this institution.</td></tr>';
      updateCounts();
    } catch(e) { console.error("[Institution Student Management] Session reports:",e); body.innerHTML='<tr><td colspan="8" style="padding:35px;text-align:center;color:#b91c1c">Could not load session reports: '+esc(e.message)+'</td></tr>'; }
  }
  async function sendSessionReportDecisionEmail(report, profile, decision) {
    const client=db();
    if(!client?.functions?.invoke)return {sent:false,reason:"Campus Nexus notification service is unavailable."};
    const result=await client.functions.invoke("session-report-notification",{
      body:{report_id:report.id,decision}
    });
    if(result.error)return {sent:false,reason:result.error.message||"Notification service request failed."};
    if(!result.data?.success)return {sent:false,reason:result.data?.error||"Email provider did not accept the notification."};
    return {sent:true,recipient:result.data.recipient||profile?.email||null};
  }

  async function decideReport(id, decision, confirmUser=true) {
    if(confirmUser&&!window.confirm((decision==="approved"?"Approve":"Reject")+" this student's session report?"))return false;
    const client=db(), institutionId=tenant();
    if(!client||!institutionId)throw new Error("Institution session is not ready.");
    const reportResult=await client.from("session_reports").select("*").eq("id",id).eq("institution_id",institutionId).maybeSingle();
    if(reportResult.error)throw reportResult.error;
    const report=reportResult.data;
    if(!report)throw new Error("Session report not found in this institution.");
    if(String(report.approval_status||"pending").toLowerCase()!=="pending")throw new Error("This report has already been reviewed.");
    let previousProfile=null, profilePatch=null;
    if(report.student_id) {
      const profileResult=await client.from("consolidated_user_profiles_table")
        .select("*")
        .eq("institution_id",institutionId).eq("student_id",report.student_id).maybeSingle();
      if(profileResult.error)throw profileResult.error;
      previousProfile=profileResult.data;
      if(!previousProfile)throw new Error("The matching student profile was not found in this institution. The report remains pending.");
    }
    if(decision==="approved"&&previousProfile&&report.session) {
      const session=String(report.session).trim(), patch={updated_at:new Date().toISOString()};
      if(/semester/i.test(session)){patch.current_semester=session;patch.semester=session;}
      else if(/term/i.test(session)){patch.current_term=session;patch.term=session;}
      else if(/block/i.test(session)||/introductory/i.test(session)||/fqe/i.test(session)){patch.current_block=session;patch.block=session;}
      else throw new Error("The reported academic period could not be identified as a semester, term or block. The report remains pending.");
      let profileUpdate=await client.from("consolidated_user_profiles_table").update(patch)
        .eq("user_id",previousProfile.user_id).eq("institution_id",institutionId).select("user_id");
      if(profileUpdate.error) {
        // Some older institution schemas have only the canonical current_* column.
        const canonical={updated_at:patch.updated_at};
        if(/semester/i.test(session)) canonical.current_semester=session;
        else if(/term/i.test(session)) canonical.current_term=session;
        else canonical.current_block=session;
        profileUpdate=await client.from("consolidated_user_profiles_table").update(canonical)
          .eq("user_id",previousProfile.user_id).eq("institution_id",institutionId).select("user_id");
        if(profileUpdate.error)throw profileUpdate.error;
        profilePatch=canonical;
      } else profilePatch=patch;
      if(!profileUpdate.data?.length)throw new Error("Student profile could not be updated. The report remains pending.");
    }
    const result=await client.from("session_reports").update({
      approval_status:decision,approved_at:new Date().toISOString(),
      approved_by:api()?.user?.id||"institution_admin",updated_at:new Date().toISOString()
    }).eq("id",id).eq("institution_id",institutionId).eq("approval_status","pending").select("id");
    if(result.error||!result.data?.length) {
      if(previousProfile&&profilePatch){
        const rollback={updated_at:new Date().toISOString()};
        ["current_block","block","current_semester","semester","current_term","term","intake_year","admission_year"].forEach(k=>{if(Object.prototype.hasOwnProperty.call(profilePatch,k))rollback[k]=previousProfile[k]??null;});
        const undo=await client.from("consolidated_user_profiles_table").update(rollback).eq("user_id",previousProfile.user_id).eq("institution_id",institutionId);
        if(undo.error)console.error("[Student Management] Profile rollback failed:",undo.error);
      }
      if(result.error)throw result.error;
      throw new Error("The report was already reviewed or could not be updated. No approval was recorded.");
    }
    await loadSessionReportsAdmin();
    const emailResult=await sendSessionReportDecisionEmail(report,previousProfile,decision);
    if(emailResult.sent) notify("Session report "+decision+(decision==="approved"?" and student academic period updated.":"; notification email sent."),"success");
    else notify("Session report "+decision+" successfully, but email was not sent: "+emailResult.reason,"warning");
    return true;
  }
  $("smSessionReportsBody")?.addEventListener("click",event=>{
    const button=event.target.closest("[data-session-report-action]");
    if(!button)return;
    const id=button.dataset.id, decision=button.dataset.sessionReportAction;
    if(!id||!["approved","rejected"].includes(decision))return;
    button.disabled=true; button.textContent=decision==="approved"?"Approving…":"Rejecting…";
    decideReport(id,decision).catch(error=>notify(error.message,"error")).finally(()=>{button.disabled=false;});
  });
  $("smSelectAllSessionReports")?.addEventListener("change",event=>{
    const checked=event.target.checked;
    $("smSessionReportsBody")?.querySelectorAll(".session-reports-checkbox").forEach(box=>{box.checked=checked;});
    const count=selected("session-reports").length;
    if($("smSessionReportsSelectedCount"))$("smSessionReportsSelectedCount").textContent=String(count);
  });
  $("smSessionReportsBody")?.addEventListener("change",event=>{
    if(event.target.matches(".session-reports-checkbox")){
      const boxes=[...($("smSessionReportsBody")?.querySelectorAll(".session-reports-checkbox")||[])];
      const selectedCount=boxes.filter(box=>box.checked).length;
      const master=$("smSelectAllSessionReports");
      if(master){master.checked=boxes.length>0&&selectedCount===boxes.length;master.indeterminate=selectedCount>0&&selectedCount<boxes.length;}
      if($("smSessionReportsSelectedCount"))$("smSessionReportsSelectedCount").textContent=String(selectedCount);
    }
  });
  /* Legacy count listener */
  $("smSessionReportsBody")?.addEventListener("change",event=>{
    if(!event.target.matches(".session-reports-checkbox"))return;
    const count=selected("session-reports").length;
    if($("smSessionReportsSelectedCount"))$("smSessionReportsSelectedCount").textContent=String(count);
  });
  window.approveSessionReportAdmin=(id)=>decideReport(id,"approved").catch(e=>notify(e.message,"error"));
  window.rejectSessionReportAdmin=(id)=>decideReport(id,"rejected").catch(e=>notify(e.message,"error"));
  window.bulkApproveSessionReports=async()=>{const ids=selected("session-reports");if(!ids.length)return notify("Select at least one session report.","warning");if(!confirm("Approve "+ids.length+" selected session reports?"))return;let ok=0;for(const id of ids){try{if(await decideReport(id,"approved",false))ok++;}catch(e){console.error(e);}}notify(ok+" of "+ids.length+" reports approved.");await loadSessionReportsAdmin();};
  window.bulkRejectSessionReports=async()=>{const ids=selected("session-reports");if(!ids.length)return notify("Select at least one session report.","warning");if(!confirm("Reject "+ids.length+" selected session reports?"))return;let ok=0;for(const id of ids){try{if(await decideReport(id,"rejected",false))ok++;}catch(e){console.error(e);}}notify(ok+" of "+ids.length+" reports rejected.");await loadSessionReportsAdmin();};
  async function setAdmissionStatus(id,status){const r=await db().from("institution_admissions").update({status,updated_at:new Date().toISOString()}).eq("id",id).eq("institution_id",tenant()).select("id");if(r.error)throw r.error;if(!r.data?.length)throw new Error("Admission record not found for this institution.");await loadAdmissions();notify("Admission marked "+status+".");}
  $("smAdmissionsBody")?.addEventListener("click",event=>{const button=event.target.closest("[data-admission-action]");if(button)setAdmissionStatus(button.dataset.id,button.dataset.admissionAction).catch(e=>notify(e.message,"error"));});
  async function updateSelected(type,status){const ids=selected(type);if(!ids.length)return notify("Select at least one record.","warning");if(!confirm(status.charAt(0).toUpperCase()+status.slice(1)+" "+ids.length+" selected records?"))return;const table=type==="admissions"?"institution_admissions":"student_requests";const r=await db().from(table).update({status,updated_at:new Date().toISOString()}).eq("institution_id",tenant()).in("id",ids).select("id");if(r.error)return notify(r.error.message,"error");notify((r.data||[]).length+" record(s) updated.");if(type==="admissions")await loadAdmissions();else if(type==="change-program")await loadRequests("change_program");else await loadRequests("readmission");}
  window.bulkApproveSM=type=>updateSelected(type||"admissions","approved");
  window.bulkRejectSM=type=>updateSelected(type||"admissions","rejected");
  window.bulkReviewSM=type=>updateSelected(type||"admissions","reviewing");
  window.loadAdmissions=loadAdmissions;
  window.loadChangeProgramRequests=()=>loadRequests("change_program");
  window.loadReadmissionRequests=()=>loadRequests("readmission");
  window.loadSessionReportsAdmin=loadSessionReportsAdmin;
  async function loadSMHistory(){
    const body=$("smHistoryBody");if(!body)return;
    body.innerHTML='<tr><td colspan="8" style="padding:30px;text-align:center">Loading institution request history…</td></tr>';
    try{
      const [admissions,requests,reports]=await Promise.all([
        rows("institution_admissions"),rows("student_requests"),rows("session_reports","submitted_at")
      ]);
      const entries=[
        ...admissions.map(r=>({id:r.id,kind:"Admission",person:r.applicant_name||r.student_name||r.email||"Applicant",reference:r.application_number||r.admission_number||"—",detail:r.programme||r.program||"Admission application",status:r.status||"received",created:r.updated_at||r.created_at,reason:r.notes||r.reason||"—"})),
        ...requests.map(r=>({id:r.id,kind:String(r.request_type||"Student request").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase()),person:r.student_name||r.full_name||r.student_id||"Student",reference:r.student_id||"—",detail:r.requested_program||r.current_program||r.program||r.session||"Student request",status:r.status||"pending",created:r.updated_at||r.created_at,reason:r.reason||r.remarks||"—"})),
        ...reports.map(r=>({id:r.id,kind:"Session report",person:r.student_name||r.student_id||"Student",reference:r.student_id||"—",detail:r.session||r.program||"Academic period",status:r.approval_status||"pending",created:r.updated_at||r.submitted_at||r.created_at,reason:r.remarks||r.comments||"—"}))
      ];
      const kind=$("smHistoryType")?.value||"all",status=$("smHistoryStatus")?.value||"all",from=$("smHistoryDateFrom")?.value||"",to=$("smHistoryDateTo")?.value||"";
      const filtered=entries.filter(r=>{
        const k=r.kind.toLowerCase().replace(/\s+/g,"-");
        const matchesKind=kind==="all"||kind==="all_requests"||k.includes(String(kind).toLowerCase().replace(/_/g,"-"))||(kind==="requests"&&k!=="admission");
        const st=String(r.status).toLowerCase();
        const d=r.created?new Date(r.created):null,day=d&&!Number.isNaN(d.getTime())?d.toISOString().slice(0,10):"";
        return matchesKind&&(status==="all"||st===String(status).toLowerCase())&&(!from||day>=from)&&(!to||day<=to);
      }).sort((a,b)=>new Date(b.created||0)-new Date(a.created||0));
      state.history=filtered;
      body.innerHTML=filtered.length?filtered.map(r=>'<tr><td>'+esc(r.kind)+'</td><td><strong>'+esc(r.person)+'</strong></td><td>'+esc(r.reference)+'</td><td>'+esc(r.detail)+'</td><td>'+statusPill(r.status)+'</td><td>'+date(r.created)+'</td><td>'+esc(r.reason)+'</td><td>'+esc(String(r.id).slice(0,8))+'</td></tr>').join(""):'<tr><td colspan="8" style="padding:40px;text-align:center;color:#64748b">No institution request history matches these filters.</td></tr>';
    }catch(e){console.error("[Institution Student Management] History:",e);body.innerHTML='<tr><td colspan="8" style="padding:35px;text-align:center;color:#b91c1c">Could not load institution history: '+esc(e.message)+'</td></tr>';}
  }
  window.loadSMHistory=loadSMHistory;
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
  const bootStudentManagement=()=>{if($("smAdmissionsBody"))window.refreshStudentManagement();};
  document.querySelectorAll('#iaNav [data-view="students"],[data-open-view="students"]').forEach(link=>link.addEventListener("click",()=>{window.refreshStudentManagement();}));
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bootStudentManagement,{once:true});else bootStudentManagement();
})();