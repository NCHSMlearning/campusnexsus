/* Campus Nexus — Institution User Management
 * Tenant-scoped directory. All rows are read through the authenticated
 * institution admin client and are filtered to the current institution.
 */
(() => {
  'use strict';
  const state = { api:null, rows:[], tab:'all', search:'', role:'all', status:'all', page:0, pageSize:20, loading:false };
  const $ = (id) => document.getElementById(id);
  const label = (v) => String(v || 'Unknown').replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  const date = (v) => { if(!v) return '—'; const d=new Date(v); return Number.isNaN(d.getTime())?'—':d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}); };
  const role = (v) => String(v||'').toLowerCase();
  const status = (v) => String(v||'pending').toLowerCase();
  const message = (v, bad=false) => { const n=$('iaUsersMessage'); if(n){n.textContent=v||'';n.classList.toggle('error',!!bad);} };
  const safe = (v) => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function filtered(){
    const q=state.search.trim().toLowerCase();
    return state.rows.filter(u=>{
      const r=role(u.role), s=status(u.status);
      if(state.tab==='pending' && s!=='pending') return false;
      if(state.tab==='students' && r!=='student') return false;
      if(state.tab==='lecturers' && r!=='lecturer') return false;
      if(state.tab==='administrators' && !['institution_admin','director','finance_officer','registrar','hod'].includes(r)) return false;
      if(state.role!=='all' && r!==state.role) return false;
      if(state.status!=='all' && s!==state.status) return false;
      if(q && ![u.full_name,u.email,u.student_id,u.admission_number,u.staff_id,u.program,u.department].some(v=>String(v||'').toLowerCase().includes(q))) return false;
      return true;
    });
  }
  function renderStats(){
    const all=state.rows;
    const active=all.filter(u=>['active','approved'].includes(status(u.status)));
    const pending=all.filter(u=>status(u.status)==='pending');
    const disabled=all.filter(u=>u.login_enabled===false);
    $('iaUsersTotal').textContent=all.length.toLocaleString();
    $('iaUsersActive').textContent=active.length.toLocaleString();
    $('iaUsersPending').textContent=pending.length.toLocaleString();
    $('iaUsersDisabled').textContent=disabled.length.toLocaleString();
    $('iaUsersAllCount').textContent=all.length;
    $('iaUsersPendingCount').textContent=pending.length;
    const nav=$('iaUsersNavCount'); if(nav) nav.textContent=pending.length||all.length;
  }
  function render(){
    const data=filtered(), start=state.page*state.pageSize, page=data.slice(start,start+state.pageSize), body=$('iaUsersRows');
    body.replaceChildren();
    if(!page.length){
      const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=7;td.className='ia-users-empty';td.textContent=state.loading?'Loading users…':'No users match this view or filter.';tr.append(td);body.append(tr);
    } else page.forEach(u=>{
      const tr=document.createElement('tr'), name=document.createElement('td');name.className='ia-users-person';
      const avatar=document.createElement('span');avatar.className='ia-users-avatar';avatar.textContent=(u.full_name||u.email||'U').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
      const info=document.createElement('span');info.className='ia-users-person-info';
      const strong=document.createElement('strong');strong.textContent=u.full_name||'Name unavailable';
      const small=document.createElement('small');small.textContent=u.email||'No email address';
      info.append(strong,small);name.append(avatar,info);
      const roleCell=document.createElement('td');const roleBadge=document.createElement('span');roleBadge.className='ia-users-role';roleBadge.textContent=label(u.role);roleCell.append(roleBadge);
      const program=document.createElement('td');program.textContent=u.program||u.department||'—';
      const stateCell=document.createElement('td');const badge=document.createElement('span');badge.className='ia-users-status status-'+status(u.status).replace(/[^a-z0-9_-]/g,'');badge.textContent=label(u.status);stateCell.append(badge);
      const access=document.createElement('td');const accessBadge=document.createElement('span');accessBadge.className='ia-users-access '+(u.login_enabled===false?'off':'on');accessBadge.innerHTML='<i class="fa-solid '+(u.login_enabled===false?'fa-lock':'fa-check')+'"></i> '+(u.login_enabled===false?'Disabled':'Enabled');access.append(accessBadge);
      const created=document.createElement('td');created.textContent=date(u.created_at);
      const action=document.createElement('td');const btn=document.createElement('button');btn.type='button';btn.className='ia-users-review-btn';btn.textContent=status(u.status)==='pending'?'Review':'View';btn.addEventListener('click',()=>showDetails(u));action.append(btn);
      tr.append(name,roleCell,program,stateCell,access,created,action);body.append(tr);
    });
    $('iaUsersResultCount').textContent=data.length+' matching '+(data.length===1?'account':'accounts');
    $('iaUsersPageInfo').textContent=data.length?('Showing '+(start+1)+'–'+Math.min(start+state.pageSize,data.length)+' of '+data.length):'No records';
    $('iaUsersPrev').disabled=state.page===0;
    $('iaUsersNext').disabled=start+state.pageSize>=data.length;
    $('iaUsersTableTitle').textContent=({all:'All institution users',pending:'Pending user approvals',students:'Student accounts',lecturers:'Lecturer accounts',administrators:'Institution administrators'})[state.tab];
    $('iaUsersTableDescription').textContent=state.tab==='pending'?'Review newly registered accounts awaiting institutional approval.':'A consolidated, institution-only view of user accounts and access status.';
    document.querySelectorAll('[data-users-tab]').forEach(b=>{const on=b.dataset.usersTab===state.tab;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on));});
  }
  function showDetails(u){
    const dialog=$('iaUsersDialog'), body=$('iaUsersDialogBody');if(!dialog||!body)return;
    $('iaUsersDialogTitle').textContent=u.full_name||u.email||'User profile';
    const fields=[
      ['Email address',u.email],['User role',label(u.role)],['Account status',label(u.status)],
      ['Login access',u.login_enabled===false?'Disabled':'Enabled'],['Phone',u.phone],
      ['Admission / student ID',u.admission_number||u.student_id],['Staff ID',u.staff_id],
      ['Programme',u.program],['Department',u.department],['Current block',u.current_block||u.block],
      ['Intake year',u.intake_year],['Registered',u.created_at?new Date(u.created_at).toLocaleString():'—']
    ];
    body.replaceChildren();
    const summary=document.createElement('div');summary.className='ia-users-detail-summary';
    const avatar=document.createElement('span');avatar.className='ia-users-avatar large';avatar.textContent=(u.full_name||u.email||'U').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
    const meta=document.createElement('div');const nm=document.createElement('strong');nm.textContent=u.full_name||'Name unavailable';const em=document.createElement('small');em.textContent=label(u.role)+' · '+label(u.status);meta.append(nm,em);summary.append(avatar,meta);body.append(summary);
    const grid=document.createElement('div');grid.className='ia-users-detail-grid';
    fields.forEach(([k,v])=>{const item=document.createElement('div');const dt=document.createElement('small');dt.textContent=k;const dd=document.createElement('strong');dd.textContent=v==null||v===''?'—':String(v);item.append(dt,dd);grid.append(item);});
    body.append(grid);
    if(status(u.status)==='pending'){const note=document.createElement('p');note.className='ia-users-review-note';note.innerHTML='<i class="fa-solid fa-circle-info"></i> This account is awaiting institutional review. Approval controls are managed through the institution approval workflow.';body.append(note);}
    if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
  }
  async function load(){
    if(state.loading)return;
    const api=window.CampusInstitutionAdmin;
    if(!api?.db||!api?.institutionId){message('Institution administrator session is not ready. Refresh the page.',true);return;}
    state.api=api;state.loading=true;message('Loading your institution user directory…');render();
    try{
      const {data,error}=await api.db.from('consolidated_user_profiles_table')
        .select('id,user_id,email,full_name,phone,role,role_id,student_id,admission_number,staff_id,program,department,status,created_at,current_block,block,intake_year,login_enabled,institution_id')
        .eq('institution_id',api.institutionId).order('created_at',{ascending:false}).limit(1500);
      if(error)throw error;
      state.rows=Array.isArray(data)?data:[];
      const institutionName=api.institution?.name||api.institution?.institution_name||'your institution';
      $('iaUsersInstitutionName').textContent=institutionName;
      renderStats();render();message('Directory refreshed '+new Date().toLocaleTimeString()+'.');
    }catch(e){console.error('[Institution User Management]',e);state.rows=[];renderStats();render();message(e.message||'Unable to load institution users.',true);}
    finally{state.loading=false;render();}
  }
  function bind(){
    document.querySelectorAll('[data-users-tab]').forEach(b=>b.addEventListener('click',()=>{state.tab=b.dataset.usersTab;state.page=0;render();}));
    $('iaUsersSearch')?.addEventListener('input',e=>{state.search=e.target.value;state.page=0;render();});
    $('iaUsersRoleFilter')?.addEventListener('change',e=>{state.role=e.target.value;state.page=0;render();});
    $('iaUsersStatusFilter')?.addEventListener('change',e=>{state.status=e.target.value;state.page=0;render();});
    $('iaUsersRefresh')?.addEventListener('click',load);
    $('iaUsersPrev')?.addEventListener('click',()=>{state.page=Math.max(0,state.page-1);render();});
    $('iaUsersNext')?.addEventListener('click',()=>{state.page++;render();});
    $('iaUsersDialog')?.addEventListener('click',e=>{if(e.target===$('iaUsersDialog'))$('iaUsersDialog').close();});
    document.querySelector('[data-users-close]')?.addEventListener('click',()=>$('iaUsersDialog').close());
  }
  function init(){
    if(!$('view-user-management'))return;
    bind();
    const api=window.CampusInstitutionAdmin;
    if(api?.db&&api?.institutionId)load();
    else {
      let tries=0;const wait=()=>{const ready=window.CampusInstitutionAdmin;if(ready?.db&&ready?.institutionId){load();return;}if(++tries<80)setTimeout(wait,250);else message('Institution user management could not connect. Refresh the page.',true);};wait();
    }
    document.querySelectorAll('[data-view="user-management"]').forEach(b=>b.addEventListener('click',()=>{if(!state.rows.length)load();}));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
