/* Campus Nexus Super Admin — Marks Approval
 * Uses the existing student_marks records; approval and publication remain separate.
 */
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const state={db:null,rows:[],filtered:[],busy:false};
  const safe=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const db=()=>state.db||(state.db=window.sb||window.supabaseClient||window.supabase||window.client||null);
  const status=r=>String(r.approval_status||(r.published?"published":"draft")).toLowerCase();
  const note=(msg,bad=false)=>{const host=$("marksApprovalTableContainer");if(host){const n=$("saApprovalNotice")||document.createElement("div");n.id="saApprovalNotice";n.className="ia-notice";n.textContent=msg;n.style.cssText="padding:10px 14px;margin:0 0 12px;border-radius:8px;background:"+(bad?"#fff0ef":"#eaf8f2")+";color:"+(bad?"#a12b2b":"#16634a");if(!n.parentNode)host.prepend(n);}};
  const date=v=>v?new Date(v).toLocaleString("en-KE",{dateStyle:"medium",timeStyle:"short"}):"—";
  async function audit(action,row,description){try{await db().rpc("log_marks_security_event",{p_action:action,p_target_table:"student_marks",p_target_id:row?.id||null,p_description:description,p_status:"success",p_details:{institution_id:row?.institution_id||null,page_path:location.pathname}});}catch(e){console.warn("[Super Admin marks approval] audit:",e.message);}}
  function filtered(){const q=($("marksApprovalSearch")?.value||"").trim().toLowerCase(),sub=$("marksApprovalSubjectFilter")?.value||"all",block=$("marksApprovalBlockFilter")?.value||"all";state.filtered=state.rows.filter(r=>status(r)==="pending"&&!r.published&&(!q||[r.student_name,r.admission_number,r.program,r.block,r.subject_name,r.institution_id].some(v=>String(v??"").toLowerCase().includes(q)))&&(sub==="all"||String(r.subject_name||"")===sub)&&(block==="all"||String(r.block||"")===block));render();}
  function render(){
    const rows=state.filtered,host=$("marksApprovalTableContainer");if(!host)return;
    const today=new Date().toISOString().slice(0,10);
    $("pendingMarksCount")&&($("pendingMarksCount").textContent=String(rows.length));
    $("marksFilterCount")&&($("marksFilterCount").textContent=String(rows.length));
    $("approvedMarksToday")&&($("approvedMarksToday").textContent=String(state.rows.filter(r=>status(r)==="approved"&&String(r.approved_at||"").slice(0,10)===today).length));
    $("rejectedMarksCount")&&($("rejectedMarksCount").textContent=String(state.rows.filter(r=>status(r)==="rejected").length));
    $("pendingSubjectsCount")&&($("pendingSubjectsCount").textContent=String(new Set(rows.map(r=>r.subject_name).filter(Boolean)).size));
    if(!rows.length){host.innerHTML='<div style="padding:36px;text-align:center;color:#64748b">No marks are currently awaiting approval.</div>';return;}
    host.innerHTML='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:950px"><thead><tr><th>Student</th><th>Admission no.</th><th>Institution</th><th>Programme</th><th>Block</th><th>Unit</th><th>Final score</th><th>Submitted</th><th>Action</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+safe(r.student_name||"—")+'</td><td>'+safe(r.admission_number||"—")+'</td><td>'+safe(r.institution_name||r.institution_id||"—")+'</td><td>'+safe(r.program||"—")+'</td><td>'+safe(r.block||"—")+'</td><td>'+safe(r.subject_name||"—")+'</td><td>'+safe(r.final_score??"—")+'</td><td>'+safe(date(r.submitted_at||r.created_at))+'</td><td><button class="btn-action" data-sa-approve="'+safe(r.id)+'" style="background:#059669;color:#fff;border:0;border-radius:6px;padding:7px 10px">Approve</button> <button class="btn-action" data-sa-reject="'+safe(r.id)+'" style="background:#dc2626;color:#fff;border:0;border-radius:6px;padding:7px 10px">Reject</button></td></tr>').join("")+'</tbody></table></div>';
  }
  async function load(){
    const client=db();if(!client?.from){note("Supabase is not ready. Refresh the dashboard after signing in.",true);return;}
    const host=$("marksApprovalTableContainer");if(host)host.innerHTML='<div style="padding:35px;text-align:center;color:#64748b">Loading marks submitted for approval…</div>';
    try{
      let q=client.from("student_marks").select("id,student_id,student_name,admission_number,program,block,subject_name,assessment_type,cat1_score,cat2_score,exam_score,final_score,grade,final_grade,academic_year,approval_status,published,submitted_at,approved_at,created_at,institution_id").order("created_at",{ascending:false}).limit(5000);
      const {data,error}=await q;if(error)throw error;state.rows=data||[];
      const subjects=[...new Set(state.rows.filter(r=>status(r)==="pending"&&!r.published).map(r=>r.subject_name).filter(Boolean))].sort();
      const blocks=[...new Set(state.rows.filter(r=>status(r)==="pending"&&!r.published).map(r=>r.block).filter(Boolean))].sort();
      const fill=(id,values,label)=>{const el=$(id);if(!el)return;const old=el.value;el.innerHTML='<option value="all">All '+label+'</option>'+values.map(v=>'<option value="'+safe(v)+'">'+safe(v)+'</option>').join("");if(values.includes(old))el.value=old;};
      fill("marksApprovalSubjectFilter",subjects,"Subjects");fill("marksApprovalBlockFilter",blocks,"Blocks");
      filtered();note("Marks approval records refreshed.");
    }catch(e){console.error("[Super Admin marks approval]",e);if(host)host.innerHTML='<div style="padding:28px;color:#b91c1c">Unable to load marks approval: '+safe(e.message)+'</div>';}
  }
  async function update(id,action){
    if(state.busy)return;const row=state.rows.find(r=>String(r.id)===String(id));if(!row||status(row)!=="pending"||row.published)return;
    let patch={};
    if(action==="approve"){if(!confirm("Approve marks for "+(row.student_name||row.admission_number||"this student")+" — "+(row.subject_name||"this unit")+"?"))return;patch={approval_status:"approved",approved_by:(await db().auth.getUser()).data?.user?.id||null,approved_at:new Date().toISOString(),rejection_reason:null};}
    else{const reason=prompt("Enter a reason for rejecting these marks:");if(!reason?.trim())return;patch={approval_status:"rejected",rejection_reason:reason.trim(),approved_by:(await db().auth.getUser()).data?.user?.id||null,approved_at:new Date().toISOString()};}
    state.busy=true;try{const {data,error}=await db().from("student_marks").update(patch).eq("id",row.id).eq("published",false).select("id").maybeSingle();if(error)throw error;if(!data)throw new Error("No record was updated. Check approval permissions and record status.");await audit(action==="approve"?"superadmin_approve_marks":"superadmin_reject_marks",row,"Super Admin "+action+"d marks.");note(action==="approve"?"Marks approved.":"Marks rejected.");await load();}catch(e){note("Could not "+action+" marks: "+e.message,true);}finally{state.busy=false;}
  }
  async function bulk(action){
    const pending=state.filtered.filter(r=>status(r)==="pending"&&!r.published);if(!pending.length){note("There are no filtered pending marks to "+action+".",true);return;}
    if(!confirm(action==="approve"?"Approve all "+pending.length+" filtered pending marks?":"Reject all "+pending.length+" filtered pending marks?"))return;
    let reason=null;if(action==="reject"){reason=prompt("Enter the reason for rejecting these marks:");if(!reason?.trim())return;}
    state.busy=true;try{const auth=await db().auth.getUser();const patch=action==="approve"?{approval_status:"approved",approved_by:auth.data?.user?.id||null,approved_at:new Date().toISOString(),rejection_reason:null}:{approval_status:"rejected",rejection_reason:reason.trim(),approved_by:auth.data?.user?.id||null,approved_at:new Date().toISOString()};const ids=pending.map(r=>r.id);const {data,error}=await db().from("student_marks").update(patch).in("id",ids).eq("published",false).select("id");if(error)throw error;if((data||[]).length!==ids.length)throw new Error("Only "+(data||[]).length+" of "+ids.length+" records were updated. Please refresh and review remaining records.");await audit("superadmin_bulk_"+action+"_marks",null,"Bulk "+action+" of "+ids.length+" marks.");note(ids.length+" marks "+(action==="approve"?"approved.":"rejected."));await load();}catch(e){note("Bulk action failed: "+e.message,true);}finally{state.busy=false;}
  }
  function init(){
    $("marksApprovalSearch")?.addEventListener("input",filtered);$("marksApprovalSubjectFilter")?.addEventListener("change",filtered);$("marksApprovalBlockFilter")?.addEventListener("change",filtered);
    $("marksApprovalTableContainer")?.addEventListener("click",e=>{const a=e.target.closest("[data-sa-approve]"),r=e.target.closest("[data-sa-reject]");if(a)update(a.dataset.saApprove,"approve");if(r)update(r.dataset.saReject,"reject");});
    document.querySelectorAll('[data-tab="marks-approval"]').forEach(el=>el.addEventListener("click",()=>setTimeout(load,120)));
    if(typeof window.loadMarksApprovals!=="function")window.loadMarksApprovals=load;
    if(typeof window.approveAllPendingMarks!=="function")window.approveAllPendingMarks=()=>bulk("approve");
    if(typeof window.rejectAllPendingMarks!=="function")window.rejectAllPendingMarks=()=>bulk("reject");
    if($("marks-approval")?.classList.contains("active"))load();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
  window.SuperAdminMarksApproval={refresh:load};
})();