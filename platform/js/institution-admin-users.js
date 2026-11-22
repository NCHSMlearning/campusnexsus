/* Campus Nexus — Institution User Management
 * Full-field institution directory modeled on Super Admin Manage Users.
 * Every read is tenant-scoped; no global Super Admin management RPC is used.
 */
(() => {
  'use strict';
  const state = { api:null, rows:[], tab:'all', search:'', role:'all', status:'all', program:'all', block:'all', page:0, pageSize:20, loading:false, selected:new Set() };
  const $ = id => document.getElementById(id);
  const norm = v => String(v ?? '').trim().toLowerCase();
  const label = v => String(v ?? 'Unknown').replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  const safe = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const val = v => v === null || v === undefined || v === '' ? '—' : String(v);
  const date = v => { if(!v)return '—'; const d=new Date(v); return Number.isNaN(d.getTime())?'—':d.toLocaleString(); };
  const roleOf = u => norm(u.role || u.role_id);
  const statusOf = u => norm(u.status || (u.approved === true ? 'approved' : 'pending'));
  const blockOf = u => [u.current_block || u.block, u.current_year || u.block_program_year, u.current_term].filter(Boolean).join(' / ') || '';
  const identityOf = u => u.admission_number || u.student_id || u.staff_id || u.id || '—';
  const message = (v,bad=false) => { const n=$('iaUsersMessage'); if(n){n.textContent=v||'';n.classList.toggle('error',!!bad);} };
  function filtered(){
    const q=norm(state.search);
    return state.rows.filter(u=>{
      const r=roleOf(u), s=statusOf(u), block=norm(blockOf(u));
      if(state.tab==='pending' && !['pending','submitted','awaiting_approval'].includes(s)) return false;
      if(state.tab==='students' && r!=='student') return false;
      if(state.tab==='lecturers' && !['lecturer','tutor','clinical_instructor'].includes(r)) return false;
      if(state.tab==='administrators' && !['institution_admin','director','finance_officer','registrar','hod','admin'].includes(r)) return false;
      if(state.role!=='all' && r!==state.role) return false;
      if(state.status!=='all' && s!==state.status) return false;
      if(state.program!=='all' && norm(u.program || u.department)!==norm(state.program)) return false;
      if(state.block!=='all' && block!==norm(state.block)) return false;
      if(q && ![identityOf(u),u.full_name,u.email,u.phone,u.role,u.program,u.department,u.admission_number,u.student_id,u.staff_id,u.intake_year,u.block,u.current_block,u.current_year,u.current_term].some(x=>norm(x).includes(q))) return false;
      return true;
    });
  }
  function populateFilter(id, values, title){
    const el=$(id); if(!el)return;
    const current=el.value||'all';
    el.replaceChildren(new Option(title,'all'));
    [...new Set(values.filter(Boolean).map(String))].sort((a,b)=>a.localeCompare(b)).forEach(v=>el.add(new Option(v,v)));
    el.value=[...el.options].some(o=>o.value===current)?current:'all';
  }
  function renderStats(){
    const all=state.rows, pending=all.filter(u=>['pending','submitted','awaiting_approval'].includes(statusOf(u)));
    const active=all.filter(u=>['active','approved'].includes(statusOf(u)));
    const disabled=all.filter(u=>u.login_enabled===false);
    $('iaUsersTotal').textContent=all.length.toLocaleString();
    $('iaUsersActive').textContent=active.length.toLocaleString();
    $('iaUsersPending').textContent=pending.length.toLocaleString();
    $('iaUsersDisabled').textContent=disabled.length.toLocaleString();
    $('iaUsersAllCount').textContent=all.length;
    $('iaUsersPendingCount').textContent=pending.length;
    const nav=$('iaUsersNavCount'); if(nav)nav.textContent=pending.length||all.length;
    populateFilter('iaUsersProgramFilter',all.map(u=>u.program||u.department),'All programmes');
    populateFilter('iaUsersBlockFilter',all.map(blockOf),'All blocks / years');
  }
  function cell(tr,value){
    const td=document.createElement('td'); td.textContent=val(value); tr.append(td); return td;
  }
  function render(){
    const data=filtered(), start=state.page*state.pageSize, page=data.slice(start,start+state.pageSize), body=$('iaUsersRows');
    if(!body)return;
    body.replaceChildren();
    if(!page.length){
      const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=10;td.className='ia-users-empty';td.textContent=state.loading?'Loading users…':'No users match this view or filter.';tr.append(td);body.append(tr);
    } else page.forEach(u=>{
      const tr=document.createElement('tr'), checkCell=document.createElement('td'), check=document.createElement('input');
      check.type='checkbox';check.checked=state.selected.has(u.id);check.setAttribute('aria-label','Select '+(u.full_name||u.email||'user'));
      check.addEventListener('change',()=>{if(check.checked)state.selected.add(u.id);else state.selected.delete(u.id);updateSelectAll();});
      checkCell.append(check);tr.append(checkCell);
      cell(tr,identityOf(u)); cell(tr,u.full_name); cell(tr,u.email);
      const roleCell=cell(tr,label(u.role||u.role_id)); roleCell.classList.add('ia-users-role-cell');
      cell(tr,u.program||u.department);
      cell(tr,u.intake_year);
      cell(tr,blockOf(u));
      const statusCell=cell(tr,label(u.status || (u.approved===true?'approved':'pending')));
      const badge=document.createElement('span');badge.className='ia-users-status status-'+statusOf(u).replace(/[^a-z0-9_-]/g,'');badge.textContent=label(u.status || (u.approved===true?'approved':'pending'));statusCell.replaceChildren(badge);
      const actions=document.createElement('td'), view=document.createElement('button');
      view.type='button';view.className='ia-users-review-btn';view.textContent='View';view.addEventListener('click',()=>showDetails(u));actions.append(view);tr.append(actions);
      body.append(tr);
    });
    const count=data.length;
    $('iaUsersResultCount').textContent=count+' matching '+(count===1?'account':'accounts');
    $('iaUsersPageInfo').textContent=count?('Showing '+(start+1)+'–'+Math.min(start+state.pageSize,count)+' of '+count):'No records';
    $('iaUsersPrev').disabled=state.page===0;
    $('iaUsersNext').disabled=start+state.pageSize>=count;
    $('iaUsersTableTitle').textContent=({all:'All institution users',pending:'Pending user approvals',students:'Student accounts',lecturers:'Lecturer accounts',administrators:'Institution administrators'})[state.tab];
    $('iaUsersTableDescription').textContent='Full account directory for this institution. User records and actions remain tenant-scoped.';
    document.querySelectorAll('[data-users-tab]').forEach(b=>{const on=b.dataset.usersTab===state.tab;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on));});
    updateSelectAll();
  }
  function updateSelectAll(){
    const master=$('iaUsersSelectAll');if(!master)return;
    const visible=filtered().slice(state.page*state.pageSize,(state.page+1)*state.pageSize);
    master.checked=visible.length>0&&visible.every(u=>state.selected.has(u.id));
    master.indeterminate=visible.some(u=>state.selected.has(u.id))&&!master.checked;
  }
  function showDetails(u){
    const dialog=$('iaUsersDialog'), body=$('iaUsersDialogBody');if(!dialog||!body)return;
    $('iaUsersDialogTitle').textContent=u.full_name||u.email||'User profile';
    body.replaceChildren();
    const summary=document.createElement('div');summary.className='ia-users-detail-summary';
    const avatar=document.createElement('span');avatar.className='ia-users-avatar large';avatar.textContent=(u.full_name||u.email||'U').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
    const meta=document.createElement('div'),nm=document.createElement('strong'),em=document.createElement('small');
    nm.textContent=u.full_name||'Name unavailable';em.textContent=label(u.role||u.role_id)+' · '+label(u.status);meta.append(nm,em);summary.append(avatar,meta);body.append(summary);
    const sections=[
      ['Personal & contact',[['Full name',u.full_name],['Email address',u.email],['Phone number',u.phone],['User ID',u.user_id],['Profile ID',u.id]]],
      ['Account & access',[['Role',u.role],['Role ID',u.role_id],['Account status',u.status],['Approved',u.approved],['Login access',u.login_enabled===false?'Disabled':'Enabled'],['Registered',date(u.created_at)],['Last updated',date(u.updated_at)]]],
      ['Academic & employment',[['Student ID',u.student_id],['Admission number',u.admission_number],['Staff ID',u.staff_id],['Programme',u.program],['Department',u.department],['Intake year',u.intake_year],['Current block',u.current_block||u.block],['Block / programme year',u.block_program_year],['Current year',u.current_year],['Current term',u.current_term]]],
      ['Institution',[['Institution ID',u.institution_id]]]
    ];
    sections.forEach(([heading,fields])=>{
      const section=document.createElement('section');section.className='ia-users-detail-section';
      const h=document.createElement('h3');h.textContent=heading;section.append(h);
      const grid=document.createElement('div');grid.className='ia-users-detail-grid';
      fields.forEach(([k,v])=>{const item=document.createElement('div'),dt=document.createElement('small'),dd=document.createElement('strong');dt.textContent=k;dd.textContent=val(v);item.append(dt,dd);grid.append(item);});
      section.append(grid);body.append(section);
    });
    if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
  }
  async function load(){
    if(state.loading)return;
    const api=window.CampusInstitutionAdmin;
    if(!api?.db||!api?.institutionId){message('Institution administrator session is not ready. Refresh the page.',true);return;}
    state.api=api;state.loading=true;message('Loading your institution user directory…');render();
    try{
      const columns='id,user_id,email,full_name,phone,role,role_id,student_id,admission_number,staff_id,program,department,status,approved,created_at,updated_at,current_block,block,block_program_year,current_year,current_term,intake_year,login_enabled,institution_id';
      const {data,error}=await api.db.from('consolidated_user_profiles_table').select(columns)
        .eq('institution_id',api.institutionId).order('created_at',{ascending:false}).limit(2000);
      if(error)throw error;
      state.rows=Array.isArray(data)?data:[];
      const institutionName=api.institution?.name||api.institution?.institution_name||'your institution';
      $('iaUsersInstitutionName').textContent=institutionName;
      state.selected.clear();renderStats();render();message('Directory refreshed '+new Date().toLocaleTimeString()+'.');
    }catch(e){console.error('[Institution User Management]',e);state.rows=[];renderStats();render();message(e.message||'Unable to load institution users.',true);}
    finally{state.loading=false;render();}
  }
  function bind(){
    document.querySelectorAll('[data-users-tab]').forEach(b=>b.addEventListener('click',()=>{state.tab=b.dataset.usersTab;state.page=0;render();}));
    $('iaUsersSearch')?.addEventListener('input',e=>{state.search=e.target.value;state.page=0;render();});
    $('iaUsersRoleFilter')?.addEventListener('change',e=>{state.role=e.target.value;state.page=0;render();});
    $('iaUsersStatusFilter')?.addEventListener('change',e=>{state.status=e.target.value;state.page=0;render();});
    $('iaUsersProgramFilter')?.addEventListener('change',e=>{state.program=e.target.value;state.page=0;render();});
    $('iaUsersBlockFilter')?.addEventListener('change',e=>{state.block=e.target.value;state.page=0;render();});
    $('iaUsersPageSize')?.addEventListener('change',e=>{state.pageSize=Math.max(1,Number(e.target.value)||20);state.page=0;render();});
    $('iaUsersSelectAll')?.addEventListener('change',e=>{const visible=filtered().slice(state.page*state.pageSize,(state.page+1)*state.pageSize);visible.forEach(u=>e.target.checked?state.selected.add(u.id):state.selected.delete(u.id));render();});
    $('iaUsersRefresh')?.addEventListener('click',load);
    $('iaUsersPrev')?.addEventListener('click',()=>{state.page=Math.max(0,state.page-1);render();});
    $('iaUsersNext')?.addEventListener('click',()=>{state.page++;render();});
    $('iaUsersDialog')?.addEventListener('click',e=>{if(e.target===$('iaUsersDialog'))$('iaUsersDialog').close();});
    document.querySelector('[data-users-close]')?.addEventListener('click',()=>$('iaUsersDialog').close());
  }
  function init(){
    if(!$('view-user-management'))return;
    bind();
    const attempt=()=>{const api=window.CampusInstitutionAdmin;if(api?.db&&api?.institutionId)load();else setTimeout(attempt,250);};
    attempt();
    document.querySelectorAll('[data-view="user-management"]').forEach(b=>b.addEventListener('click',()=>{if(!state.rows.length&&!state.loading)load();}));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
