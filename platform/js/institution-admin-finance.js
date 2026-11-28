(() => {
"use strict";
const $ = id => document.getElementById(id);
const money = value => new Intl.NumberFormat("en-KE",{style:"currency",currency:"KES",maximumFractionDigits:2}).format(Number(value)||0);
const escape = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let api, accounts=[], payments=[];
function build(){
 const nav=document.getElementById("iaNav");
 if(!nav || document.querySelector('[data-view="finance"]')) return;
 const group=document.createElement("div");group.className="ia-nav-group ia-finance-nav-group";
 const toggle=document.createElement("button");toggle.type="button";toggle.className="ia-nav-label ia-nav-group-toggle";toggle.setAttribute("aria-expanded","false");toggle.innerHTML='<span>FINANCE & ACCOUNTS</span><i class="fa-solid fa-chevron-down" aria-hidden="true"></i>';
 const items=document.createElement("div");items.className="ia-nav-group-items";
 const item=document.createElement("button");item.type="button";item.className="ia-nav-item";item.dataset.view="finance";item.dataset.module="finance";item.innerHTML='<i class="fa-solid fa-wallet"></i><span>Finance & payments</span>';
 items.append(item);group.append(toggle,items);
 const adminGroup=[...nav.querySelectorAll(".ia-nav-group")].find(g=>g.querySelector('[data-view="settings"]'));
 if(adminGroup)nav.insertBefore(group,adminGroup);else nav.append(group);
 toggle.addEventListener("click",()=>{const open=!group.classList.contains("open");group.classList.toggle("open",open);toggle.setAttribute("aria-expanded",String(open));});
 const view=document.createElement("section");view.className="ia-view";view.id="view-finance";
 view.innerHTML='<div class="ia-page-heading"><div><span class="ia-eyebrow">INSTITUTION OPERATIONS</span><h1>Finance & payments</h1><p>Student fee accounts and recorded payments for this institution.</p></div><button class="ia-secondary-btn" id="iaFinanceRefresh"><i class="fa-solid fa-rotate"></i> Refresh</button></div><div class="ia-stat-grid ia-report-grid"><article class="ia-stat-card"><small>Student accounts</small><strong id="iaFinanceStudents">—</strong></article><article class="ia-stat-card"><small>Total fees due</small><strong id="iaFinanceDue">—</strong></article><article class="ia-stat-card"><small>Total received</small><strong id="iaFinancePaid">—</strong></article><article class="ia-stat-card"><small>Outstanding balance</small><strong id="iaFinanceBalance">—</strong></article></div><div class="ia-panel ia-table-panel"><div class="ia-panel-head"><div><h2>Student fee accounts</h2><p>Account list is filtered by the verified institution assignment.</p></div><input id="iaFinanceSearch" class="ia-module-search" type="search" placeholder="Search student, admission no. or programme"></div><div class="ia-table-scroll"><table><thead><tr><th>Student</th><th>Admission / display ID</th><th>Programme</th><th>Intake</th><th>Period</th><th>Fees due</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead><tbody id="iaFinanceRows"><tr><td colspan="9" class="ia-empty">Loading finance records…</td></tr></tbody></table></div></div><div class="ia-panel ia-table-panel" style="margin-top:18px"><div class="ia-panel-head"><div><h2>Recent payments</h2><p>Payments linked to this institution's student accounts.</p></div></div><div class="ia-table-scroll"><table><thead><tr><th>Payment date</th><th>Student</th><th>Amount</th><th>Method</th><th>Reference</th><th>Period</th><th>Status</th></tr></thead><tbody id="iaFinancePaymentRows"><tr><td colspan="7" class="ia-empty">Loading payments…</td></tr></tbody></table></div></div>';
 const main=document.querySelector("#iaApp main")||document.querySelector("#iaApp .ia-main")||document.querySelector("#iaApp");
 main.append(view);
 const activate=()=>{document.querySelectorAll(".ia-view").forEach(x=>x.classList.toggle("active",x===view));document.querySelectorAll(".ia-nav-item").forEach(x=>x.classList.toggle("active",x===item));group.classList.add("open");toggle.setAttribute("aria-expanded","true");document.getElementById("iaSidebar")?.classList.remove("open");document.getElementById("iaScrim")?.classList.remove("show");};
 item.addEventListener("click",()=>{activate();load();});
 $("iaFinanceRefresh")?.addEventListener("click",load);
 $("iaFinanceSearch")?.addEventListener("input",renderAccounts);
 const menuSearch=$("iaSidebarSearch");
 menuSearch?.addEventListener("input",()=>{const q=(menuSearch.value||"").trim().toLowerCase();item.hidden=!!q&&!("finance payments fees accounts".includes(q));group.hidden=!!q&&item.hidden;});
 const originalRefresh=api.refresh;
 if(typeof originalRefresh==="function"&&!api.__financeRefreshWrapped){api.refresh=async()=>{await originalRefresh();if(view.classList.contains("active"))await load();};api.__financeRefreshWrapped=true;}
}
function renderAccounts(){
 const q=($("iaFinanceSearch")?.value||"").trim().toLowerCase();
 const list=accounts.filter(x=>[x.student_name,x.student_email,x.display_id,x.program,x.intake,x.current_block].some(v=>String(v||"").toLowerCase().includes(q)));
 const body=$("iaFinanceRows");body.replaceChildren();
 if(!list.length){body.innerHTML='<tr><td colspan="9" class="ia-empty">No student fee accounts found.</td></tr>';return;}
 list.forEach(x=>{const tr=document.createElement("tr");const vals=[x.student_name,x.display_id||"—",x.program,x.intake||x.intake_year,x.current_period||x.current_block,money(x.total_due??x.total_fees_due),money(x.total_paid),money(x.balance??x.outstanding),x.payment_status||x.account_status||"—"];vals.forEach(v=>{const td=document.createElement("td");td.textContent=v??"—";tr.append(td);});body.append(tr);});
}
function renderPayments(){
 const body=$("iaFinancePaymentRows");body.replaceChildren();
 if(!payments.length){body.innerHTML='<tr><td colspan="7" class="ia-empty">No payment records are available for these student accounts.</td></tr>';return;}
 payments.forEach(x=>{const tr=document.createElement("tr");[x.payment_date||x.created_at,x.student_name,money(x.amount),x.payment_method,x.reference_number,x.period,x.status].forEach(v=>{const td=document.createElement("td");td.textContent=v??"—";tr.append(td);});body.append(tr);});
}
async function load(){
 const notice=$("iaNotice");
 try{
  $("iaFinanceRows").innerHTML='<tr><td colspan="9" class="ia-empty">Loading finance records…</td></tr>';
  const a=await api.db.from("finance_student_accounts").select("id,student_id,student_name,student_email,program,intake_year,intake,current_block,current_period,total_due,total_fees_due,total_paid,balance,outstanding,payment_status,account_status,display_id").eq("institution_id",api.institutionId).order("student_name").limit(2000);
  if(a.error)throw a.error;accounts=a.data||[];
  const ids=[...new Set(accounts.map(x=>x.student_id).filter(Boolean))];
  payments=[];
  if(ids.length){const p=await api.db.from("finance_student_payments").select("payment_id,student_id,student_name,amount,payment_method,reference_number,payment_date,period,status,created_at").in("student_id",ids).order("payment_date",{ascending:false}).limit(100);if(p.error)throw p.error;payments=p.data||[];}
  const sum=(key,fallback)=>accounts.reduce((n,x)=>n+Number(x[key]??x[fallback]??0),0);
  $("iaFinanceStudents").textContent=accounts.length.toLocaleString();
  $("iaFinanceDue").textContent=money(sum("total_due","total_fees_due"));
  $("iaFinancePaid").textContent=money(sum("total_paid","total_paid"));
  $("iaFinanceBalance").textContent=money(accounts.reduce((n,x)=>n+Number(x.balance??x.outstanding??0),0));
  renderAccounts();renderPayments();
  if(notice){notice.hidden=true;}
 }catch(e){console.error("[Institution Finance]",e);if(notice){notice.hidden=false;notice.textContent="Finance records could not be loaded: "+(e.message||"Unknown error");notice.style.background="#fff0ef";notice.style.color="#a12b2b";}}
}
function wait(){api=window.CampusInstitutionAdmin;if(!api?.db||!api?.institutionId){setTimeout(wait,200);return;}if(!api.modules?.has?.("finance"))return;build();}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",wait,{once:true});else wait();
})();