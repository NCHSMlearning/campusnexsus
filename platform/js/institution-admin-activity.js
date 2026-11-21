/* Campus Nexus Institution Admin — tenant-scoped read-only activity log. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  let api = null, records = [];
  const dateLabel = value => value ? new Date(value).toLocaleString("en-KE",{dateStyle:"medium",timeStyle:"short"}) : "—";
  const notify = (message,error=false) => {const host=$("iaNotice");if(!host)return;host.hidden=false;host.textContent=message;host.style.background=error?"#fff0ef":"#eaf8f2";host.style.color=error?"#a12b2b":"#16634a";};
  const detailsText = value => {if(value===null||value===undefined)return "—";if(typeof value==="string")return value;try{return JSON.stringify(value);}catch(_){return String(value);}};
  function filtered(){const q=($("iaActivitySearch")?.value||"").trim().toLowerCase();if(!q)return records;return records.filter(r=>[r.action,r.entity_type,r.entity_id,r.actor_user_id,detailsText(r.details)].some(v=>String(v??"").toLowerCase().includes(q)));}
  function render(){
    const rows=filtered(),body=$("iaActivityRows");if(!body)return;
    const today=new Date().toLocaleDateString("en-CA");
    $("iaActivityTotal").textContent=records.length.toLocaleString("en-KE");
    $("iaActivityToday").textContent=records.filter(r=>r.created_at&&new Date(r.created_at).toLocaleDateString("en-CA")===today).length.toLocaleString("en-KE");
    $("iaActivityActors").textContent=new Set(records.map(r=>r.actor_user_id).filter(Boolean)).size.toLocaleString("en-KE");
    body.replaceChildren();
    if(!rows.length){const tr=document.createElement("tr"),td=document.createElement("td");td.colSpan=6;td.className="ia-empty";td.textContent=records.length?"No activity matches your search.":"No activity has been recorded for this institution yet.";tr.append(td);body.append(tr);return;}
    rows.forEach(r=>{const tr=document.createElement("tr");[dateLabel(r.created_at),r.action,r.entity_type,r.entity_id,r.actor_user_id,detailsText(r.details)].forEach((value,index)=>{const td=document.createElement("td");td.textContent=value||"—";if(index===5){td.style.maxWidth="360px";td.style.whiteSpace="normal";td.style.overflowWrap="anywhere";}if(index===4&&value&&value!=="—")td.textContent=String(value).slice(0,8)+"…";tr.append(td);});body.append(tr);});
  }
  async function load(){
    if(!api?.db||!api?.institutionId){notify("Your institution session is not ready. Please refresh the page.",true);return;}
    const body=$("iaActivityRows");if(body){body.replaceChildren();const tr=document.createElement("tr"),td=document.createElement("td");td.colSpan=6;td.className="ia-empty";td.textContent="Loading institution activity…";tr.append(td);body.append(tr);}
    try{const {data,error}=await api.db.from("platform_audit_logs").select("id,actor_user_id,institution_id,action,entity_type,entity_id,details,created_at").eq("institution_id",api.institutionId).order("created_at",{ascending:false}).limit(300);if(error)throw error;records=data||[];render();}
    catch(error){console.error("[Institution activity]",error);notify("Unable to load institution activity: "+error.message,true);}
  }
  function exportCsv(){const rows=filtered();if(!rows.length){notify("There are no activity records to export.",true);return;}const quote=v=>'"'+String(v??"").replace(/"/g,'""')+'"';const csv=[["Date & time","Action","Record type","Record ID","Actor user ID","Details"].map(quote).join(","),...rows.map(r=>[r.created_at,r.action,r.entity_type,r.entity_id,r.actor_user_id,detailsText(r.details)].map(quote).join(","))].join("\r\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"})),a=document.createElement("a");a.href=url;a.download="institution-activity-"+new Date().toISOString().slice(0,10)+".csv";a.click();URL.revokeObjectURL(url);}
  function wait(){api=window.CampusInstitutionAdmin;if(!api?.db||!api?.institutionId){setTimeout(wait,150);return;}$("iaActivitySearch")?.addEventListener("input",render);$("iaActivityRefresh")?.addEventListener("click",load);$("iaActivityExport")?.addEventListener("click",exportCsv);document.querySelectorAll('#iaNav [data-view="activity"]').forEach(b=>b.addEventListener("click",()=>setTimeout(load,100)));}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",wait,{once:true});else wait();
})();