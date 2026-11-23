/* Campus Nexus Institution Admin — tenant-scoped results governance.
 * Reads and updates only student_marks for the verified active institution.
 * Approval is separate from publication; no automatic grade calculation.
 */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  let api = null, records = [], control = null, busy = false;
  const escText = value => String(value ?? "—");
  const statusOf = row => String(row.approval_status || (row.published ? "published" : "draft")).toLowerCase();
  const notify = (message, error=false) => {
    if (typeof window.showNotification === "function") window.showNotification(message, error ? "error" : "success");
    else if (typeof window.showFeedback === "function") window.showFeedback(message, error ? "error" : "success");
    else { const host=$("iaNotice"); if(host){host.hidden=false;host.textContent=message;host.style.background=error?"#fff0ef":"#eaf8f2";host.style.color=error?"#a12b2b":"#16634a";} }
  };
  const db = () => {
    if (!api?.db || !api?.institutionId || !api?.user?.id) throw new Error("Your institution administrator session is not ready.");
    return api.db;
  };
  const tenant = () => api.institutionId;
  const cell = (tr, value) => { const td=document.createElement("td"); td.textContent=escText(value); tr.append(td); return td; };
  const empty = (id, colspan, message) => {
    const body=$(id); if(!body)return;
    const tr=document.createElement("tr"),td=document.createElement("td");
    td.colSpan=colspan;td.className="ia-empty";td.textContent=message;tr.append(td);body.replaceChildren(tr);
  };
  const dateLabel = value => value ? new Date(value).toLocaleString("en-KE",{dateStyle:"medium",timeStyle:"short"}) : "—";
  const filtered = inputId => {
    const q=($(inputId)?.value||"").trim().toLowerCase();
    return records.filter(r=>[r.student_name,r.admission_number,r.program,r.block,r.subject_name,r.academic_year,r.grade,r.approval_status].some(v=>String(v??"").toLowerCase().includes(q)));
  };
  async function audit(action,row,description) {
    try { await db().rpc("log_marks_security_event",{p_action:action,p_target_table:"student_marks",p_target_id:row?.id||null,p_description:description||action,p_status:"success",p_details:{institution_id:tenant(),page_path:location.pathname}}); }
    catch(e) { console.warn("[Institution marks audit]",e); }
  }
  async function loadRecords() {
    const {data,error}=await db().from("student_marks")
      .select("id,student_id,student_name,admission_number,program,block,subject_name,assessment_type,cat1_score,cat2_score,exam_score,final_score,grade,final_grade,academic_year,approval_status,published,submitted_at,approved_at,published_at")
      .eq("institution_id",tenant()).order("created_at",{ascending:false}).limit(5000);
    if(error)throw error;
    records=data||[];
    paint();
  }
  function paint() {
    const pending=records.filter(r=>statusOf(r)==="pending"&&!r.published);
    const approved=records.filter(r=>statusOf(r)==="approved"&&!r.published);
    const published=records.filter(r=>!!r.published);
    const units=new Set(records.map(r=>r.subject_name).filter(Boolean));
    [["iaMECount",records.length],["iaMEPending",pending.length],["iaMEApproved",records.filter(r=>statusOf(r)==="approved").length],["iaMEPublished",published.length],
     ["iaMAPending",pending.length],["iaMAApproved",records.filter(r=>statusOf(r)==="approved").length],["iaMARejected",records.filter(r=>statusOf(r)==="rejected").length],["iaMAUnits",units.size],
     ["iaPMCount",published.length],["iaPMStudents",new Set(published.map(r=>r.admission_number||r.student_id).filter(Boolean)).size],["iaPMUnits",new Set(published.map(r=>r.subject_name).filter(Boolean)).size]
    ].forEach(([id,value])=>{if($(id))$(id).textContent=Number(value).toLocaleString("en-KE");});
    const all=filtered("iaMESearch");renderRegister(all);
    renderApproval(pending.filter(r=>matches(r,"iaMASearch")));
    renderPublishQueue(approved);
    renderPublished(published.filter(r=>matches(r,"iaPMSearch")));
  }
  function matches(row,inputId) {
    const q=($(inputId)?.value||"").trim().toLowerCase();
    return !q||[row.student_name,row.admission_number,row.program,row.block,row.subject_name,row.academic_year,row.grade].some(v=>String(v??"").toLowerCase().includes(q));
  }
  function renderRegister(rows) {
    const body=$("iaMarksEntryRows");if(!body)return;
    if(!rows.length){empty("iaMarksEntryRows",12,"No marks records found for this institution.");return;}
    body.replaceChildren();
    rows.forEach(r=>{const tr=document.createElement("tr");
      [r.student_name,r.admission_number,r.program,r.block,r.subject_name,r.academic_year,r.cat1_score,r.cat2_score,r.exam_score,r.final_score,r.final_grade||r.grade,statusOf(r).replace(/_/g," ")].forEach(v=>cell(tr,v));
      body.append(tr);
    });
  }
  function renderApproval(rows) {
    const body=$("iaMarksApprovalRows");if(!body)return;
    if(!rows.length){empty("iaMarksApprovalRows",8,"There are no marks awaiting approval.");return;}
    body.replaceChildren();
    rows.forEach(r=>{const tr=document.createElement("tr");
      [r.student_name,r.admission_number,r.program,r.block,r.subject_name,r.final_score,dateLabel(r.submitted_at)].forEach(v=>cell(tr,v));
      const td=document.createElement("td");
      const approve=document.createElement("button");approve.type="button";approve.className="ia-primary-btn";approve.textContent="Approve";approve.dataset.markAction="approve";approve.dataset.id=r.id;
      const reject=document.createElement("button");reject.type="button";reject.className="ia-danger-btn";reject.textContent="Reject";reject.dataset.markAction="reject";reject.dataset.id=r.id;
      td.append(approve,reject);tr.append(td);body.append(tr);
    });
  }
  function renderPublishQueue(rows) {
    const body=$("iaReadyToPublishRows");if(!body)return;
    if(!rows.length){empty("iaReadyToPublishRows",9,"No approved unpublished results are ready for release.");return;}
    body.replaceChildren();
    rows.forEach(r=>{const tr=document.createElement("tr");
      [r.student_name,r.admission_number,r.program,r.block,r.subject_name,r.academic_year,r.final_score,r.final_grade||r.grade].forEach(v=>cell(tr,v));
      const td=document.createElement("td"),button=document.createElement("button");
      button.type="button";button.className="ia-primary-btn";button.textContent="Publish";button.dataset.markAction="publish";button.dataset.id=r.id;td.append(button);tr.append(td);body.append(tr);
    });
  }
  function renderPublished(rows) {
    const body=$("iaPublishedMarksRows");if(!body)return;
    if(!rows.length){empty("iaPublishedMarksRows",9,"No published results are available for this institution.");return;}
    body.replaceChildren();
    rows.forEach(r=>{const tr=document.createElement("tr");
      [r.student_name,r.admission_number,r.program,r.block,r.subject_name,r.academic_year,r.final_score,r.final_grade||r.grade,dateLabel(r.published_at)].forEach(v=>cell(tr,v));
      body.append(tr);
    });
  }
  async function updateMark(id,action) {
    if(busy)return;
    const row=records.find(r=>String(r.id)===String(id));if(!row)return;
    let patch={};
    if(action==="approve") {
      if(statusOf(row)!=="pending"||row.published)return;
      if(!confirm("Approve marks for "+(row.student_name||row.admission_number||"this student")+" — "+(row.subject_name||"this unit")+"?"))return;
      patch={approval_status:"approved",approved_by:api.user.id,approved_at:new Date().toISOString(),rejection_reason:null};
    } else if(action==="reject") {
      if(statusOf(row)!=="pending"||row.published)return;
      const reason=prompt("Enter the reason for rejecting these marks:");
      if(!reason||!reason.trim())return;
      patch={approval_status:"rejected",rejection_reason:reason.trim(),approved_by:api.user.id,approved_at:new Date().toISOString()};
    } else if(action==="publish") {
      if(statusOf(row)!=="approved"||row.published)return;
      if(!confirm("Publish this approved result to the student? This action releases the result."))return;
      patch={published:true,published_at:new Date().toISOString(),published_by:api.user.id};
    } else return;
    busy=true;
    try {
      let updateQuery=db().from("student_marks").update(patch).eq("id",row.id).eq("institution_id",tenant());
      if(action==="approve"||action==="reject")updateQuery=updateQuery.eq("approval_status","pending").eq("published",false);
      if(action==="publish")updateQuery=updateQuery.eq("approval_status","approved").eq("published",false);
      const {data:updated,error}=await updateQuery.select("id").maybeSingle();
      if(error)throw error;
      if(!updated)throw new Error("No record was updated. It may have changed already or your institution permissions do not allow this action.");
      await audit(action==="approve"?"institution_admin_approve_marks":action==="reject"?"institution_admin_reject_marks":"institution_admin_publish_marks",row,"Institution administrator "+action+"d marks.");
      notify(action==="approve"?"Marks approved.":action==="reject"?"Marks rejected.":"Result published.");
      await loadRecords();
    } catch(e) { notify("Unable to "+action+" marks: "+e.message,true); }
    finally {busy=false;}
  }
  async function bulkApproval(action) {
    if(busy)return;
    const pending=filtered("iaMASearch").filter(r=>statusOf(r)==="pending"&&!r.published);
    if(!pending.length){notify("There are no pending marks matching the current search.",true);return;}
    if(!confirm(action==="approve"?"Approve all "+pending.length+" pending marks for this institution?":"Reject all "+pending.length+" pending marks for this institution?"))return;
    let reason="";
    if(action==="reject"){reason=prompt("Enter a reason for rejecting these marks:")||"";if(!reason.trim())return;}
    busy=true;
    try{
      const ids=pending.map(r=>r.id);
      const patch=action==="approve"
        ?{approval_status:"approved",approved_by:api.user.id,approved_at:new Date().toISOString(),rejection_reason:null}
        :{approval_status:"rejected",rejection_reason:reason.trim(),approved_by:api.user.id,approved_at:new Date().toISOString()};
      const {data,error}=await db().from("student_marks").update(patch).in("id",ids).eq("institution_id",tenant()).eq("published",false).select("id");
      if(error)throw error;
      if((data||[]).length!==ids.length)throw new Error("Only "+(data||[]).length+" of "+ids.length+" records were updated. Refresh and review the remaining records.");
      await audit("institution_admin_bulk_"+action+"_marks",null,"Institution administrator bulk "+action+" of "+ids.length+" marks.");
      notify(ids.length+" marks "+(action==="approve"?"approved.":"rejected."));
      await loadRecords();
    }catch(e){notify("Bulk "+action+" failed: "+e.message,true);}
    finally{busy=false;}
  }
  async function loadControl() {
    const host=$("iaEntryControlContent");if(!host)return;
    const {data,error}=await db().from("institution_mark_entry_controls").select("id,institution_id,is_open,reason,updated_by,updated_at").eq("institution_id",tenant()).maybeSingle();
    if(error)throw error;control=data||null;renderControl();
  }
  function renderControl() {
    const host=$("iaEntryControlContent");if(!host)return;host.replaceChildren();
    const isOpen=control?!!control.is_open:false;
    const status=document.createElement("p");status.className="ia-entry-control-status";status.textContent=control?(isOpen?"Mark entry is OPEN for this institution.":"Mark entry is CLOSED for this institution."):"No institution entry-control record exists yet.";
    const reason=document.createElement("textarea");reason.id="iaEntryControlReason";reason.rows=3;reason.placeholder="Reason / notice for lecturers (optional)";reason.value=control?.reason||"";
    reason.className="ia-module-search";reason.style.width="100%";reason.style.margin="12px 0";
    const button=document.createElement("button");button.type="button";button.className=isOpen?"ia-danger-btn":"ia-primary-btn";button.textContent=isOpen?"Close mark entry":"Open mark entry";button.addEventListener("click",saveControl);
    const updated=document.createElement("small");updated.textContent=control?.updated_at?"Last updated "+dateLabel(control.updated_at):"";
    host.append(status,reason,button,updated);
  }
  async function saveControl() {
    const reason=$("iaEntryControlReason")?.value.trim()||"";
    const payload={institution_id:tenant(),is_open:!control?.is_open,reason,updated_by:api.user.id,updated_at:new Date().toISOString()};
    const q=control?db().from("institution_mark_entry_controls").update(payload).eq("id",control.id).eq("institution_id",tenant()):db().from("institution_mark_entry_controls").insert(payload);
    const {error}=await q;if(error){notify("Could not update mark-entry control: "+error.message,true);return;}
    await loadControl();notify(control?.is_open?"Mark entry is now open.":"Mark entry is now closed.");
  }
  async function load(view) {
    try { if(view==="entry-control")await loadControl(); else await loadRecords(); }
    catch(e) { console.error("[Institution results]",e);notify("Unable to load "+view+": "+e.message,true); }
  }
  function bind() {
    ["iaMESearch","iaMASearch","iaPMSearch"].forEach(id=>$(id)?.addEventListener("input",paint));
    $("iaApproveAllPending")?.addEventListener("click",()=>bulkApproval("approve"));
    $("iaRejectAllPending")?.addEventListener("click",()=>bulkApproval("reject"));
    document.querySelectorAll("[data-marks-refresh]").forEach(b=>b.addEventListener("click",()=>load(b.dataset.marksRefresh==="control"?"entry-control":"marks")));
    document.addEventListener("click",e=>{
      const action=e.target.closest("[data-mark-action]");
      if(action)updateMark(action.dataset.id,action.dataset.markAction);
      const nav=e.target.closest("#iaNav [data-view]");
      if(nav&&["marks-entry","marks-approval","published-marks","entry-control"].includes(nav.dataset.view))setTimeout(()=>load(nav.dataset.view),120);
    });
  }
  function wait() {
    api=window.CampusInstitutionAdmin;
    if(!api?.db||!api?.institutionId||!api?.user){setTimeout(wait,150);return;}
    bind();
    document.querySelectorAll("#iaNav [data-view]").forEach(b=>{
      const module=b.dataset.module;
      if(module&&api.modules instanceof Set&&!api.modules.has(module))b.hidden=true;
    });
    const initial=document.querySelector(".ia-view.active")?.id;
    if(initial==="view-marks-entry"||initial==="view-marks-approval"||initial==="view-published-marks"||initial==="view-entry-control")load(initial.replace("view-",""));
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",wait,{once:true});else wait();
})();