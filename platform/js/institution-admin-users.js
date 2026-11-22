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
  const blockOf = u => [u.current_block || u.block, u.current_year || u.year_of_study, u.current_term].filter(Boolean).join(' / ') || '';
  const identityOf = u => u.admission_number || u.student_id || u.staff_id || u.id || '—';
  const message = (v,bad=false) => { const n=$('iaUsersMessage'); if(n){n.textContent=v||'';n.classList.toggle('error',!!bad);} };
  function filtered(){
    const q=norm(state.search);
    return state.rows.filter(u=>{
      const r=roleOf(u), s=statusOf(u), block=norm(blockOf(u));
      if(state.tab==='pending' && !['pending','pending_application','submitted','awaiting_approval'].includes(s)) return false;
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
      const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=9;td.className='ia-users-empty';td.textContent=state.loading?'Loading users…':'No users match this view or filter.';tr.append(td);body.append(tr);
    } else page.forEach(u=>{
      const tr=document.createElement('tr'), checkCell=document.createElement('td'), check=document.createElement('input');
      check.type='checkbox';check.checked=state.selected.has(u.id);check.setAttribute('aria-label','Select '+(u.full_name||u.email||'user'));
      check.addEventListener('change',()=>{if(check.checked)state.selected.add(u.id);else state.selected.delete(u.id);updateSelectAll();});
      checkCell.append(check);tr.append(checkCell);
      const nameCell=document.createElement('td');nameCell.className='ia-users-person-cell';
      const person=document.createElement('div');person.className='ia-users-person';
      const avatar=document.createElement('span');avatar.className='ia-users-table-avatar';
      const initials=(u.full_name||u.email||'U').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();avatar.textContent=initials;
      const personMeta=document.createElement('span');personMeta.className='ia-users-person-meta';
      const personName=document.createElement('strong');personName.textContent=u.full_name||'Name unavailable';
      const personId=document.createElement('small');personId.textContent=identityOf(u);
      personMeta.append(personName,personId);person.append(avatar,personMeta);nameCell.append(person);tr.append(nameCell);
      resolveUserPhoto(u.profile_photo_url||u.passport_url,u.user_id).then(url=>{
        if(!url||!avatar.isConnected)return;
        const img=document.createElement('img');img.src=url;img.alt='';img.referrerPolicy='no-referrer';
        img.onerror=()=>{img.remove();avatar.textContent=initials;};avatar.replaceChildren(img);
      }).catch(()=>{});
      cell(tr,u.email);
      const roleCell=cell(tr,label(u.role||u.role_id)); roleCell.classList.add('ia-users-role-cell');
      const roleBadge=document.createElement('span');roleBadge.className='ia-users-role-badge role-'+String(u.role||u.role_id||'user').toLowerCase().replace(/[^a-z0-9_-]/g,'');roleBadge.textContent=label(u.role||u.role_id);roleCell.replaceChildren(roleBadge);
      cell(tr,u.program||u.department);
      cell(tr,u.intake_year);
      cell(tr,blockOf(u));
      const statusCell=cell(tr,label(u.status || (u.approved===true?'approved':'pending')));
      const badge=document.createElement('span');badge.className='ia-users-status status-'+statusOf(u).replace(/[^a-z0-9_-]/g,'');badge.textContent=label(u.status || (u.approved===true?'approved':'pending'));statusCell.replaceChildren(badge);
      const actions=document.createElement('td'), view=document.createElement('button'), edit=document.createElement('button');
      view.type='button';view.className='ia-users-review-btn';view.textContent='View';view.addEventListener('click',()=>showDetails(u));
      edit.type='button';edit.className='ia-users-review-btn ia-users-edit-btn';edit.textContent='Edit';edit.addEventListener('click',()=>openEditForm(u));
      if(state.tab==='pending' && ['pending','pending_application','submitted','awaiting_approval'].includes(statusOf(u))){
        const approve=document.createElement('button');approve.type='button';approve.className='ia-users-review-btn ia-users-edit-btn';approve.textContent='Approve';approve.addEventListener('click',()=>approvePendingUser(u,approve));actions.append(approve);
      }
      actions.append(view,edit);tr.append(actions);
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
  async function resolveUserPhoto(photoValue,userId){
    if(!photoValue)return null;
    const value=String(photoValue);
    if(/^https?:\/\//i.test(value))return value;
    const client=state.api?.db||window.CampusInstitutionAdmin?.db;
    if(!client?.storage)return null;
    let bucket='user-documents',path=value;
    const match=value.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?.*)?$/);
    if(match){bucket=decodeURIComponent(match[1]);path=decodeURIComponent(match[2]);}
    else if(value.startsWith('user-documents/'))path=value.slice('user-documents/'.length);
    else if(value.startsWith('passports/')){bucket='passports';path=value.slice('passports/'.length);}
    const result=await client.storage.from(bucket).createSignedUrl(path,3600);
    if(result.error){console.warn('[Institution users] Profile photo URL unavailable:',result.error.message);return null;}
    return result.data?.signedUrl||null;
  }
  async function uploadUserProfilePhoto(file,user){
    const api=state.api||window.CampusInstitutionAdmin,client=api?.db;
    if(!client||!api?.institutionId||!user?.user_id)throw new Error('Institution session is not ready. Refresh and try again.');
    if(!file||!/^image\/(jpeg|png|webp)$/i.test(file.type))throw new Error('Choose a JPG, PNG or WebP image.');
    if(file.size>2*1024*1024)throw new Error('Profile photo must be 2 MB or smaller.');
    const ext=({ 'image/jpeg':'jpg','image/png':'png','image/webp':'webp'})[file.type]||'jpg';
    const path='profiles/'+user.user_id+'/photo-'+Date.now()+'.'+ext;
    const uploaded=await client.storage.from('user-documents').upload(path,file,{upsert:false,contentType:file.type,cacheControl:'3600'});
    if(uploaded.error)throw uploaded.error;
    const update=await client.from('consolidated_user_profiles_table')
      .update({profile_photo_url:path,passport_url:path,updated_at:new Date().toISOString()})
      .eq('user_id',user.user_id).eq('institution_id',api.institutionId).select('user_id');
    if(update.error||!update.data?.length){
      await client.storage.from('user-documents').remove([path]);
      throw update.error||new Error('The profile photo could not be saved for this institution user.');
    }
    user.profile_photo_url=path;user.passport_url=path;
    const row=state.rows.find(x=>x.user_id===user.user_id);if(row){row.profile_photo_url=path;row.passport_url=path;}
    return await resolveUserPhoto(path,user.user_id);
  }
  function showDetails(u){
    const dialog=$('iaUsersDialog'), body=$('iaUsersDialogBody');if(!dialog||!body)return;
    $('iaUsersDialogTitle').textContent=u.full_name||u.email||'User profile';
    body.replaceChildren();
    const summary=document.createElement('div');summary.className='ia-users-detail-summary';
    const avatar=document.createElement('span');avatar.className='ia-users-avatar large';
    const initials=(u.full_name||u.email||'U').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
    avatar.textContent=initials;
    resolveUserPhoto(u.profile_photo_url||u.passport_url,u.user_id).then(url=>{
      if(!url||!avatar.isConnected)return;
      const img=document.createElement('img');img.src=url;img.alt='Profile photo';img.referrerPolicy='no-referrer';
      img.onerror=()=>{img.remove();avatar.textContent=initials;};avatar.replaceChildren(img);
    }).catch(()=>{});
    summary.classList.add('ia-users-profile-hero');
    const meta=document.createElement('div');meta.className='ia-users-profile-meta';
    const nm=document.createElement('strong'),em=document.createElement('small');
    nm.textContent=u.full_name||'Name unavailable';
    em.textContent=u.email||'No email address';
    const chips=document.createElement('div');chips.className='ia-users-profile-chips';
    [[label(u.role||u.role_id),'role'],[label(u.status||statusOf(u)),'status'],[u.login_enabled===false?'Login disabled':'Login enabled','access']].forEach(([text,type])=>{const chip=document.createElement('span');chip.className='ia-users-profile-chip '+type;chip.textContent=text;chips.append(chip);});
    meta.append(nm,em,chips);summary.append(avatar,meta);body.append(summary);
    const sections=[
      ['Personal information',[['Full name',u.full_name],['Email address',u.email],['Phone',u.phone],['Alternative phone',u.alt_phone],['Gender',u.gender],['Date of birth',u.date_of_birth],['National ID',u.national_id],['Address',u.address],['Profile photo',u.profile_photo_url?'Uploaded':'Not uploaded']]],
      ['Guardian / parent information',[['Guardian name',u.guardian_name],['Guardian phone',u.guardian_phone],['Parent email',u.parent_email],['Parent address',u.parent_address]]],
      ['Academic & employment information',[['Role',u.role],['Role ID',u.role_id],['Student ID',u.student_id],['Admission number',u.admission_number],['Staff ID',u.staff_id],['Programme',u.program],['Programme type',u.program_type],['Department',u.department],['Intake month',u.intake_month],['Intake year',u.intake_year],['Admission year',u.admission_year],['Admission date',u.admission_date],['Current block',u.current_block||u.block],['Year of study',u.year_of_study],['Block progress',u.block_progress],['Employment date',u.employment_date],['Qualifications',u.qualifications],['Specialization',u.specialization],['Professional bio',u.professional_bio]]],
      ['Documents',[['KCSE document status',u.doc_kcse],['ID document status',u.doc_id],['Passport / ID document URL',u.passport_url]]],
      ['Account status & access',[['Account status',u.status],['Login access',u.login_enabled===false?'Disabled':'Enabled'],['Username',u.username],['Last login',date(u.last_login)],['Last activity',date(u.last_activity)],['Login count',u.login_count],['Two-factor authentication',u.two_factor_enabled?'Enabled':'Disabled'],['Registered',date(u.created_at)],['Last updated',date(u.updated_at)],['User ID',u.user_id],['Profile ID',u.id],['Institution ID',u.institution_id]]]
    ];
    sections.forEach(([heading,fields])=>{
      const section=document.createElement('section');section.className='ia-users-detail-section';
      const h=document.createElement('h3');h.textContent=heading;section.append(h);
      const grid=document.createElement('div');grid.className='ia-users-detail-grid';
      fields.forEach(([k,v])=>{const item=document.createElement('div'),dt=document.createElement('small'),dd=document.createElement('strong');dt.textContent=k;dd.textContent=val(v);item.append(dt,dd);grid.append(item);});
      section.append(grid);body.append(section);
    });
    // Put the complete user profile into the same premium two-panel layout
    // as the editor, with navigation across every information category.
    const profileShell=document.createElement('div');profileShell.className='ia-users-view-shell';
    const profileSide=document.createElement('aside');profileSide.className='ia-users-view-sidebar';
    const profileMain=document.createElement('div');profileMain.className='ia-users-view-main';
    const profileIdentity=document.createElement('div');profileIdentity.className='ia-users-view-identity';
    const identityAvatar=avatar.cloneNode(true);profileIdentity.append(identityAvatar);
    resolveUserPhoto(u.profile_photo_url||u.passport_url,u.user_id).then(url=>{
      if(!url||!identityAvatar.isConnected)return;
      const img=document.createElement('img');img.src=url;img.alt='Profile photo';img.referrerPolicy='no-referrer';
      img.onerror=()=>{img.remove();identityAvatar.textContent=(u.full_name||u.email||'U').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();};
      identityAvatar.replaceChildren(img);
    }).catch(()=>{});
    const identityName=document.createElement('strong');identityName.textContent=u.full_name||'Name unavailable';
    const identityCode=document.createElement('small');identityCode.textContent=identityOf(u);
    profileIdentity.append(identityName,identityCode);
    const profileNav=document.createElement('nav');profileNav.className='ia-users-view-nav';profileNav.setAttribute('aria-label','User profile sections');
    const viewIcons=['fa-user','fa-people-roof','fa-graduation-cap','fa-folder-open','fa-shield-halved','fa-clock-rotate-left'];
    sections.forEach(([heading],index)=>{
      const section=body.querySelectorAll('.ia-users-detail-section')[index];
      if(!section)return;
      const nav=document.createElement('button');nav.type='button';nav.className='ia-users-view-nav-item'+(index===0?' is-active':'');
      nav.innerHTML='<i class="fa-solid '+viewIcons[index]+'"></i><span>'+safe(heading)+'</span>';
      nav.addEventListener('click',()=>{profileNav.querySelectorAll('button').forEach(x=>x.classList.toggle('is-active',x===nav));section.scrollIntoView({behavior:'smooth',block:'start'});});
      profileNav.append(nav);
    });
    profileSide.append(profileIdentity,profileNav);
    const profileHeading=document.createElement('div');profileHeading.className='ia-users-view-heading';
    profileHeading.innerHTML='<span class="ia-users-eyebrow">USER PROFILE</span><h3>Account overview</h3><p>Complete personal, academic, document and access information.</p>';
    profileMain.append(profileHeading);
    const detailSections=[...body.querySelectorAll('.ia-users-detail-section')];
    detailSections.forEach(section=>profileMain.append(section));
    const historySection=document.createElement('section');historySection.className='ia-users-detail-section ia-users-view-history';
    const historyHeading=document.createElement('h3');historyHeading.textContent='Academic history';historySection.append(historyHeading);
    const historyHost=document.createElement('div');historyHost.id='iaUsersAcademicHistory';historyHost.className='ia-users-history';historyHost.textContent='Loading academic history…';historySection.append(historyHost);profileMain.append(historySection);
    const historyNav=document.createElement('button');historyNav.type='button';historyNav.className='ia-users-view-nav-item';historyNav.innerHTML='<i class="fa-solid fa-clock-rotate-left"></i><span>Academic history</span>';
    historyNav.addEventListener('click',()=>{profileNav.querySelectorAll('button').forEach(x=>x.classList.toggle('is-active',x===historyNav));historySection.scrollIntoView({behavior:'smooth',block:'start'});});
    profileNav.append(historyNav);
    loadAcademicHistory(u).catch(error=>{historyHost.textContent=error.message||'Unable to load academic history.';});
    const editButton=document.createElement('button');editButton.type='button';editButton.className='ia-users-review-btn ia-users-edit-btn';editButton.innerHTML='<i class="fa-solid fa-user-pen"></i> Edit user details';editButton.addEventListener('click',()=>openEditForm(u));
    profileMain.append(editButton);profileShell.append(profileSide,profileMain);body.replaceChildren(profileShell);
    if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
  }
  function openEditForm(u){
    const dialog=$('iaUsersDialog'),body=$('iaUsersDialogBody');if(!dialog||!body)return;
    $('iaUsersDialogTitle').textContent='Edit user profile';
    const field=(key,label,type='text',value=u[key]??'',opts=null,attrs='')=>{
      const id='iaEdit_'+key, v=String(value??'');
      let control='';
      if(type==='select')control='<select id="'+id+'" name="'+key+'" '+attrs+'>'+opts.map(([x,t])=>'<option value="'+safe(x)+'" '+(String(x)===v?'selected':'')+'>'+safe(t)+'</option>').join('')+'</select>';
      else if(type==='textarea')control='<textarea id="'+id+'" name="'+key+'" rows="3" '+attrs+'>'+safe(v)+'</textarea>';
      else control='<input id="'+id+'" name="'+key+'" type="'+type+'" value="'+safe(v)+'" '+attrs+'>';
      return '<label class="ia-users-edit-field"><span>'+safe(label)+'</span>'+control+'</label>';
    };
    const roles=[['student','Student'],['lecturer','Lecturer']];
    if(u.role&&!roles.some(x=>x[0]===u.role))roles.push([u.role,label(u.role)+' (current role)']);
    const statusOptions=[['pending','Pending approval'],['approved','Approved'],['blocked','Blocked'],['inactive','Inactive']];
    const profileFields=[
      ['full_name','Full name','text'],['email','Email address','email'],['phone','Phone number','tel'],['alt_phone','Alternative phone','tel'],
      ['gender','Gender','select',[['','Select gender'],['Male','Male'],['Female','Female'],['Other','Other']]],
      ['date_of_birth','Date of birth','date'],['national_id','National ID','text'],['address','Address','text'],
      ['guardian_name','Guardian name','text'],['guardian_phone','Guardian phone','tel'],['parent_email','Parent / guardian email','email'],['parent_address','Parent / guardian address','text'],
      ['student_id','Student / staff ID','text'],['admission_number','Admission number','text'],['staff_id','Staff ID','text'],
      ['program','Programme','select',[['DCHN','DCHN'],['KCHN','KCHN'],['TVET','TVET course'],['KRCHN','KRCHN (legacy)']]],
      ['program_type','Programme type','select',[['Nursing','Nursing'],['TVET','TVET'],['Other','Other']]],
      ['department','Department','text'],['intake_year','Intake year','select',[]],['intake_month','Intake month','select',[['','Select intake month'],...['January','February','March','April','May','June','July','August','September','October','November','December'].map(x=>[x,x])]],
      ['block','Block / Term','select',[]],['current_block','Current Block / Term','select',[]],['year_of_study','Year of study','select',[['','Select year of study'],['Year 1','Year 1'],['Year 2','Year 2'],['Year 3','Year 3'],['Year 4','Year 4']]],['admission_date','Admission date','date'],['admission_year','Admission year','select',[]],['employment_date','Employment date','date'],
      ['doc_kcse','KCSE document status','select',[['pending','Pending'],['uploaded','Uploaded'],['verified','Verified'],['rejected','Rejected']]],
      ['doc_id','ID / passport document status','select',[['pending','Pending'],['uploaded','Uploaded'],['verified','Verified'],['rejected','Rejected']]],
      ['profile_photo_url','Profile photo URL','url'],['passport_url','Passport / ID document URL','url'],
      ['qualifications','Qualifications','textarea'],['specialization','Specialization','text'],['professional_bio','Professional bio','textarea']
    ];
    const groups=[
      ['Personal information',profileFields.slice(0,8)],
      ['Guardian / parent information',profileFields.slice(8,12)],
      ['Academic & employment information',profileFields.slice(12,26)],
      ['Documents & professional profile',profileFields.slice(26)]
    ];
    const currentStatus=statusOf(u);
    const statusValue=['approved','active'].includes(currentStatus)?'approved':(['pending','pending_application','submitted','awaiting_approval'].includes(currentStatus)?'pending':(currentStatus==='blocked'?'blocked':'inactive'));
    let html='<form id="iaUsersEditForm" class="ia-users-edit-form"><input type="hidden" name="user_id" value="'+safe(u.user_id||'')+'"><div class="ia-users-edit-hero"><span class="ia-users-edit-hero-icon"><i class="fa-solid fa-user-pen"></i></span><div><strong>Update user profile</strong><small>Manage personal details, academic placement, documents and account access</small></div><span class="ia-users-edit-id">'+safe(identityOf(u))+'</span></div>';
    groups.forEach(([heading,fields])=>{
      const sectionIcons={'Personal information':'fa-user','Guardian / parent information':'fa-people-roof','Academic & employment information':'fa-graduation-cap','Documents & professional profile':'fa-folder-open'};
      html+='<section class="ia-users-edit-section"><h3><span class="ia-users-section-icon"><i class="fa-solid '+(sectionIcons[heading]||'fa-layer-group')+'"></i></span><span>'+heading+'<small>Review and update '+heading.toLowerCase()+'</small></span></h3><div class="ia-users-edit-grid">';
      fields.forEach(([key,title,type,options])=>{
        if(key==='email') html+='<label class="ia-users-edit-field"><span>Email address / login email</span><div class="ia-users-email-edit"><input id="iaEdit_email" name="email" type="email" value="'+safe(u.email||'')+'" required><button type="button" id="iaUsersEmailUpdate">Update login email</button></div><small class="ia-users-edit-hint">Updates the authentication login and institution profile together.</small></label>';
        else if(type==='select')html+=field(key,title,type,u[key],options);
        else html+=field(key,title,type,u[key],null);
      });
      html+='</div></section>';
    });
    html+='<section class="ia-users-edit-section ia-users-access-section"><h3>Account permissions & access</h3><div class="ia-users-edit-grid">';
    html+=field('role','User role','select',u.role,roles);
    html+=field('status','Account status','select',statusValue,statusOptions);
    html+=field('login_enabled','Login access','select',u.login_enabled===false?'false':'true',[['true','Enabled'],['false','Disabled']]);
    html+='</div><p class="ia-users-edit-hint">Blocked or inactive accounts should have login disabled. Approving an account enables login unless you explicitly switch it off.</p></section>';
    html+='<section class="ia-users-edit-section"><h3>Academic history</h3><div id="iaUsersAcademicHistory" class="ia-users-history">Loading academic history…</div></section><div class="ia-users-edit-actions"><button type="submit" class="ia-users-save-btn">Save changes</button><button type="button" class="ia-users-cancel-btn" id="iaUsersEditCancel">Cancel</button></div><div class="ia-users-password-reset"><button type="button" id="iaUsersSendReset">Send password reset link</button><span>Uses the secure Supabase recovery flow; no password is stored in this form.</span></div><p id="iaUsersEditFeedback" role="status"></p></form>';
    body.innerHTML=html;
    // Premium multi-stage editor: retain every existing field and action while
    // presenting each complete section as its own navigable stage.
    const editForm=$('iaUsersEditForm');
    // The editor is a multi-stage form. Native browser validation can block a
    // submit when an invalid required field is inside a hidden stage, without
    // firing the submit handler. Save is validated explicitly in saveUserEdit.
    editForm.noValidate=true;
    const formSections=[...editForm.querySelectorAll(':scope > .ia-users-edit-section')];
    const historySection=formSections.find(section=>section.querySelector('#iaUsersAcademicHistory'))||null;
    const accessSection=formSections.find(section=>section.classList.contains('ia-users-access-section'))||null;
    const ordinarySections=formSections.filter(section=>section!==historySection&&section!==accessSection);
    const stageDefinitions=[
      {title:'Personal Information',sub:'Identity and personal details',icon:'fa-user'},
      {title:'Guardian & Contact',sub:'Emergency and family contacts',icon:'fa-address-book'},
      {title:'Academic Information',sub:'Programme, intake and progression',icon:'fa-graduation-cap'},
      {title:'Documents & Professional',sub:'Verification and qualifications',icon:'fa-folder-open'},
      {title:'Account & Access',sub:'Role, status and permissions',icon:'fa-shield-halved'},
      {title:'Academic History',sub:'Units, grades and attendance',icon:'fa-clock-rotate-left'}
    ];
    const shell=document.createElement('div');shell.className='ia-users-edit-shell';
    const sidebar=document.createElement('aside');sidebar.className='ia-users-edit-sidebar';
    sidebar.innerHTML='<div class="ia-users-edit-brand"><span><i class="fa-solid fa-graduation-cap"></i></span><div><b>CAMPUS <em>NEXUS</em></b><small>USER PROFILE MANAGEMENT</small></div></div><div class="ia-users-edit-progress"><span id="iaUsersEditProgress"></span></div><nav class="ia-users-edit-nav" aria-label="Edit user sections"></nav><div class="ia-users-edit-sidebar-note"><i class="fa-solid fa-lock"></i><span>Changes are saved securely to this institution profile.</span></div>';
    const workspace=document.createElement('div');workspace.className='ia-users-edit-workspace';
    const mainHeading=document.createElement('div');mainHeading.className='ia-users-edit-main-heading';
    mainHeading.innerHTML='<div><span class="ia-users-eyebrow">ACCOUNT MANAGEMENT</span><h3>Update user profile</h3><p>Review each section and save all changes when complete.</p></div><span class="ia-users-stage-indicator" id="iaUsersEditStageIndicator">01 / 06</span>';
    const stageHost=document.createElement('div');stageHost.className='ia-users-edit-stage-host';
    const stageNodes=[];
    const allStageSections=[ordinarySections[0],ordinarySections[1],ordinarySections[2],ordinarySections[3],accessSection,historySection];
    stageDefinitions.forEach((definition,index)=>{
      const panel=document.createElement('section');panel.className='ia-users-edit-stage';panel.hidden=index!==0;
      const section=allStageSections[index];
      if(section){
        section.classList.add('ia-users-edit-section');
        panel.appendChild(section);
      }else{
        const empty=document.createElement('div');empty.className='ia-users-stage-empty';empty.textContent='No additional information is available for this section.';panel.appendChild(empty);
      }
      stageHost.appendChild(panel);stageNodes.push(panel);
      const nav=document.createElement('button');nav.type='button';nav.className='ia-users-edit-nav-item';nav.dataset.stage=String(index);
      nav.innerHTML='<span class="ia-users-edit-nav-icon"><i class="fa-solid '+definition.icon+'"></i></span><span><b>'+definition.title+'</b><small>'+definition.sub+'</small></span><i class="fa-solid fa-check ia-users-stage-check"></i>';
      sidebar.querySelector('.ia-users-edit-nav').appendChild(nav);
    });
    const controls=editForm.querySelector('.ia-users-edit-actions');
    const saveControl=controls?.querySelector('.ia-users-save-btn');
    const cancelControl=controls?.querySelector('#iaUsersEditCancel');
    const passwordReset=editForm.querySelector('.ia-users-password-reset');
    const feedbackNode=$('iaUsersEditFeedback');
    const formHero=editForm.querySelector('.ia-users-edit-hero');
    if(formHero){
      const photoCard=document.createElement('div');photoCard.className='ia-users-photo-editor';
      const photoFrame=document.createElement('div');photoFrame.className='ia-users-photo-frame';
      const photoInitials=(u.full_name||u.email||'U').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
      photoFrame.textContent=photoInitials;
      const photoImage=document.createElement('img');photoImage.alt='User profile photo';photoImage.hidden=true;
      photoFrame.append(photoImage);
      const photoInfo=document.createElement('div');photoInfo.className='ia-users-photo-info';
      photoInfo.innerHTML='<strong>Profile photo</strong><small>Use a clear JPG, PNG or WebP image. Maximum size 2 MB.</small>';
      const photoActions=document.createElement('div');photoActions.className='ia-users-photo-actions';
      const choosePhoto=document.createElement('button');choosePhoto.type='button';choosePhoto.className='ia-users-photo-choose';choosePhoto.innerHTML='<i class="fa-solid fa-camera"></i> Change photo';
      const photoInput=document.createElement('input');photoInput.type='file';photoInput.accept='image/jpeg,image/png,image/webp';photoInput.hidden=true;photoInput.id='iaUsersProfilePhotoInput';
      const photoStatus=document.createElement('small');photoStatus.className='ia-users-photo-status';photoStatus.setAttribute('role','status');
      choosePhoto.addEventListener('click',()=>photoInput.click());
      photoInput.addEventListener('change',async()=>{
        const file=photoInput.files?.[0];if(!file)return;
        if(!/^image\/(jpeg|png|webp)$/i.test(file.type)||file.size>2*1024*1024){photoStatus.textContent='Choose JPG, PNG or WebP up to 2 MB.';photoStatus.className='ia-users-photo-status error';photoInput.value='';return;}
        const preview=URL.createObjectURL(file);photoImage.src=preview;photoImage.hidden=false;photoFrame.firstChild?.nodeType===3&&photoFrame.firstChild.remove();
        choosePhoto.disabled=true;choosePhoto.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Uploading…';photoStatus.textContent='Uploading and saving profile photo…';
        try{
          const signed=await uploadUserProfilePhoto(file,u);
          if(signed){photoImage.src=signed;photoImage.hidden=false;}
          photoStatus.textContent='Profile photo updated successfully.';photoStatus.className='ia-users-photo-status success';
        }catch(error){photoImage.hidden=true;photoImage.removeAttribute('src');photoFrame.textContent=photoInitials;photoStatus.textContent=error.message||'Photo upload failed.';photoStatus.className='ia-users-photo-status error';}
        finally{choosePhoto.disabled=false;choosePhoto.innerHTML='<i class="fa-solid fa-camera"></i> Change photo';photoInput.value='';}
      });
      resolveUserPhoto(u.profile_photo_url||u.passport_url,u.user_id).then(url=>{if(url){photoImage.src=url;photoImage.hidden=false;photoFrame.childNodes.forEach(n=>{if(n.nodeType===3)n.remove();});}});
      photoActions.append(choosePhoto,photoInput,photoStatus);photoInfo.append(photoActions);
      photoCard.append(photoFrame,photoInfo);
      workspace.append(photoCard,formHero);
    }
    workspace.append(mainHeading,stageHost);
    const footer=document.createElement('div');footer.className='ia-users-edit-footer';
    const previous=document.createElement('button');previous.type='button';previous.className='ia-users-edit-prev';previous.innerHTML='<i class="fa-solid fa-arrow-left"></i> Previous';
    const next=document.createElement('button');next.type='button';next.className='ia-users-edit-next';next.innerHTML='Next section <i class="fa-solid fa-arrow-right"></i>';
    const count=document.createElement('span');count.className='ia-users-edit-step-count';count.textContent='Section 1 of 6';
    footer.append(previous,count,next);
    if(cancelControl){cancelControl.classList.add('ia-users-edit-cancel');footer.append(cancelControl);}
    if(saveControl){
      saveControl.classList.add('ia-users-edit-save');
      saveControl.type='button';
      saveControl.addEventListener('click',event=>{
        event.preventDefault();
        if(saveControl.dataset.saving==='true')return;
        saveUserEdit({preventDefault(){},currentTarget:editForm},u);
      });
      footer.append(saveControl);
    }
    if(controls)controls.replaceChildren(footer);
    workspace.append(controls||footer);
    if(passwordReset)workspace.append(passwordReset);
    if(feedbackNode)workspace.append(feedbackNode);
    shell.append(sidebar,workspace);
    editForm.replaceChildren(shell);
    let activeStage=0;
    const renderStage=()=>{
      stageNodes.forEach((panel,index)=>{panel.hidden=index!==activeStage;});
      sidebar.querySelectorAll('.ia-users-edit-nav-item').forEach((button,index)=>{
        button.classList.toggle('is-active',index===activeStage);
        button.classList.toggle('is-complete',index<activeStage);
        button.setAttribute('aria-current',index===activeStage?'step':'false');
      });
      $('iaUsersEditProgress').style.width=((activeStage+1)/stageDefinitions.length*100)+'%';
      $('iaUsersEditStageIndicator').textContent=String(activeStage+1).padStart(2,'0')+' / '+String(stageDefinitions.length).padStart(2,'0');
      count.textContent='Section '+(activeStage+1)+' of '+stageDefinitions.length;
      previous.disabled=activeStage===0;
      next.innerHTML=activeStage===stageDefinitions.length-1?'Review & Save <i class="fa-solid fa-check"></i>':'Next section <i class="fa-solid fa-arrow-right"></i>';
      next.classList.toggle('is-review',activeStage===stageDefinitions.length-1);
      const firstInput=stageNodes[activeStage].querySelector('input,select,textarea');
      if(firstInput)firstInput.focus({preventScroll:true});
    };
    const moveStage=index=>{if(index<0||index>=stageNodes.length)return;activeStage=index;renderStage();};
    sidebar.querySelectorAll('.ia-users-edit-nav-item').forEach(button=>button.addEventListener('click',()=>moveStage(Number(button.dataset.stage))));
    previous.addEventListener('click',()=>moveStage(activeStage-1));
    next.addEventListener('click',()=>{
      if(activeStage<stageNodes.length-1)moveStage(activeStage+1);
      else {
        if(saveControl)saveControl.click();
        else saveUserEdit({preventDefault(){},currentTarget:editForm},u);
      }
    });
    renderStage();
    // Academic dropdowns: use consistent programme, block/term and year choices.
    const currentYear=new Date().getFullYear();
    const yearOptions=Array.from({length:currentYear-2014+6},(_,i)=>String(currentYear+5-i));
    const setOptions=(id,options,current,placeholder)=>{
      const select=$(id);if(!select)return;
      const value=String(current??'');
      select.replaceChildren(new Option(placeholder||'Select…',''));
      options.forEach(item=>select.add(new Option(item.label||item.value,item.value)));
      if(value&&!options.some(item=>String(item.value)===value))select.add(new Option(value+' (current)',value));
      select.value=value;
    };
    const programme=$('iaEdit_program');
    const block=$('iaEdit_block');
    const currentBlock=$('iaEdit_current_block');
    const studyYear=$('iaEdit_year_of_study');
    const intakeYear=$('iaEdit_intake_year');
    const admissionYear=$('iaEdit_admission_year');
    const programmeOptions=[['DCHN','DCHN'],['KCHN','KCHN'],['TVET','TVET course']];
    if(u.program&&!programmeOptions.some(x=>x[0]===String(u.program)))programmeOptions.push([String(u.program),String(u.program)+' (current)']);
    setOptions('iaEdit_program',programmeOptions.map(([value,label])=>({value,label})),u.program,'Select programme');
    setOptions('iaEdit_intake_year',yearOptions.map(value=>({value,label:value})),u.intake_year,'Select intake year');
    setOptions('iaEdit_admission_year',yearOptions.map(value=>({value,label:value})),u.admission_year,'Select admission year');
    setOptions('iaEdit_year_of_study',['Year 1','Year 2','Year 3','Year 4'].map(value=>({value,label:value})),u.year_of_study,'Select year of study');
    const updateAcademicChoices=(preferred)=>{
      const code=String(programme?.value||'').trim().toUpperCase();
      const tvet=code==='TVET'||(!['DCHN','KCHN'].includes(code)&&String($('iaEdit_program_type')?.value||u.program_type||'').toUpperCase()==='TVET');
      const levels=tvet?['Term 1','Term 2','Term 3']:['Block 1','Block 2','Block 3','Block 4','Block 5','Block 6'];
      const options=levels.map(value=>({value,label:value}));
      const selected=preferred??(block?.value||currentBlock?.value||u.current_block||u.block||'');
      setOptions('iaEdit_block',options,selected,'Select '+(tvet?'term':'block'));
      setOptions('iaEdit_current_block',options,selected,'Select current '+(tvet?'term':'block'));
      const blockLabel=block?.closest('.ia-users-edit-field')?.querySelector('span');
      const currentLabel=currentBlock?.closest('.ia-users-edit-field')?.querySelector('span');
      if(blockLabel)blockLabel.textContent=tvet?'Term':'Block';
      if(currentLabel)currentLabel.textContent=tvet?'Current term':'Current block';
    };
    block?.addEventListener('change',()=>{if(currentBlock)currentBlock.value=block.value;});
    currentBlock?.addEventListener('change',()=>{if(block)block.value=currentBlock.value;});
    updateAcademicChoices();
    programme?.addEventListener('change',()=>{
      const tvet=programme.value.toUpperCase()==='TVET';
      const type=$('iaEdit_program_type');if(type)type.value=tvet?'TVET':'Nursing';
      updateAcademicChoices('');
    });
    $('iaUsersEditCancel').addEventListener('click',()=>showDetails(u));
    $('iaUsersEmailUpdate').addEventListener('click',async()=>{
      const button=$('iaUsersEmailUpdate'),input=$('iaEdit_email'),nextEmail=String(input.value||'').trim().toLowerCase();
      if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(nextEmail)){feedback.textContent='Enter a valid email address.';feedback.className='error';return;}
      if(nextEmail===String(u.email||'').toLowerCase()){feedback.textContent='This is already the current email address.';feedback.className='';return;}
      button.disabled=true;button.textContent='Updating…';feedback.textContent='';
      try{
        const client=state.api?.db||window.CampusInstitutionAdmin?.db;
        const {data:sessionData,error:sessionError}=await client.auth.getSession();
        if(sessionError||!sessionData?.session)throw new Error('Your session has expired. Sign in again.');
        const response=await fetch('https://irahplkvocaakjxuisto.supabase.co/functions/v1/admin-update-institution-user-email',{
          method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+sessionData.session.access_token},
          body:JSON.stringify({userId:u.user_id,newEmail:nextEmail})
        });
        const result=await response.json();
        if(!response.ok)throw new Error(result.error||'Email update failed.');
        u.email=nextEmail;const row=state.rows.find(x=>x.user_id===u.user_id);if(row)row.email=nextEmail;
        input.value=nextEmail;feedback.textContent='Login email updated successfully.';feedback.className='';
        message('Login email updated successfully.');
      }catch(err){feedback.textContent=err.message||'Unable to update login email.';feedback.className='error';}
      finally{button.disabled=false;button.textContent='Update login email';}
    });
    $('iaUsersSendReset').addEventListener('click',async()=>{const b=$('iaUsersSendReset');b.disabled=true;b.textContent='Sending…';try{const client=state.api?.db||window.CampusInstitutionAdmin?.db;if(!u.email)throw new Error('This account has no email address.');const {error}=await client.auth.resetPasswordForEmail(u.email);if(error)throw error;b.textContent='Reset link sent';}catch(err){b.disabled=false;b.textContent='Send password reset link';feedback.textContent=err.message||'Unable to send password reset link.';feedback.className='error';}});
    $('iaEdit_status').addEventListener('change',e=>{
      if(e.target.value==='blocked'||e.target.value==='inactive')$('iaEdit_login_enabled').value='false';
      else if(e.target.value==='approved')$('iaEdit_login_enabled').value='true';
    });
    $('iaUsersEditForm').addEventListener('submit',e=>saveUserEdit(e,u));
    loadAcademicHistory(u).catch(error=>{const host=$('iaUsersAcademicHistory');if(host)host.textContent=error.message||'Unable to load academic history.';});
    if(typeof dialog.showModal==='function'&&!dialog.open)dialog.showModal();else dialog.setAttribute('open','');
  }
  async function approvePendingUser(user,button){
    const api=state.api||window.CampusInstitutionAdmin;
    if(!api?.db||!api?.institutionId){message('Institution administrator session expired. Sign in again.',true);return;}
    if(!user?.user_id||!['pending','pending_application','submitted','awaiting_approval'].includes(statusOf(user))){message('This account is no longer pending. Refresh the directory.',true);return;}
    button.disabled=true;const oldLabel=button.textContent;button.textContent='Approving…';
    try{
      const {data,error}=await api.db.rpc('review_institution_registration',{p_user_id:user.user_id,p_decision:'approve',p_reason:null});
      if(error)throw error;
      const result=Array.isArray(data)?data[0]:data;
      if(!result||result.success!==true||result.status!=='approved'||result.login_enabled!==true)
        throw new Error(result?.message||'The account approval could not be completed.');
      const {data:emailData,error:emailError}=await api.db.functions.invoke('registration-approved-email',{body:{user_id:user.user_id}});
      await load();
      if(emailError)message('Account approved successfully, but the approval email could not be sent: '+(emailError.message||'email service error')+'.',true);
      else if(emailData?.success===false)message('Account approved successfully, but the approval email was not sent: '+(emailData.message||'email service unavailable')+'.',true);
      else message('Account approved successfully. Approval email notification accepted for delivery.');
    }catch(error){console.error('[Institution user approval]',error);message(error.message||'Unable to approve this account.',true);button.disabled=false;button.textContent=oldLabel;}
  }
  async function loadAcademicHistory(user){
    const host=$('iaUsersAcademicHistory');if(!host)return;
    host.textContent='Loading academic history…';
    const client=state.api?.db||window.CampusInstitutionAdmin?.db;
    const id=user.user_id;
    if(!client||!id){host.textContent='Academic history is unavailable for this account.';return;}
    const [regs,grades,attendance]=await Promise.all([
      client.from('student_unit_registrations').select('unit_code,unit_name,status,reg_type,submitted_date').eq('student_id',id).order('submitted_date',{ascending:false}).limit(20),
      client.from('exam_grades').select('total_score,graded_at,subject_name,exams:exam_id(unit_code,course_name,block_term,exam_name)').eq('student_id',id).order('graded_at',{ascending:false}).limit(20),
      client.from('geo_attendance_logs').select('check_in_time,session_type,target_name,is_verified').eq('student_id',id).order('check_in_time',{ascending:false}).limit(10)
    ]);
    host.replaceChildren();
    const addGroup=(title,rows,renderRow)=>{
      const section=document.createElement('div');section.className='ia-users-history-group';
      const heading=document.createElement('strong');heading.textContent=title+' ('+(rows?.data?.length||0)+')';section.append(heading);
      if(rows?.error){const p=document.createElement('p');p.textContent='Not available with current institution permissions.';section.append(p);}
      else if(!rows?.data?.length){const p=document.createElement('p');p.textContent='No records found.';section.append(p);}
      else rows.data.forEach(row=>{const line=document.createElement('div');line.className='ia-users-history-row';line.textContent=renderRow(row);section.append(line);});
      host.append(section);
    };
    addGroup('Registered units',regs,r=>[r.unit_code,r.unit_name,r.reg_type,r.status,r.submitted_date?new Date(r.submitted_date).toLocaleDateString():null].filter(Boolean).join(' · '));
    addGroup('Exam grades',grades,r=>{const ex=r.exams||{};return [ex.unit_code||ex.course_name||r.subject_name,ex.exam_name,r.total_score==null?null:String(r.total_score)+'%',r.graded_at?new Date(r.graded_at).toLocaleDateString():null].filter(Boolean).join(' · ');});
    addGroup('Attendance',attendance,r=>[r.target_name,r.session_type,r.is_verified?'Verified':'Unverified',r.check_in_time?new Date(r.check_in_time).toLocaleString():null].filter(Boolean).join(' · '));
  }
  async function saveUserEdit(event,user){
    event.preventDefault();
    const form=event.currentTarget,button=form.querySelector('.ia-users-edit-save')||form.querySelector('.ia-users-save-btn')||form.querySelector('[type="submit"]'),feedback=$('iaUsersEditFeedback');
    if(button.dataset.saving==='true')return;
    button.dataset.saving='true';button.disabled=true;button.textContent='Saving…';
    if(feedback){feedback.textContent='';feedback.className='';}
    try{
      const api=state.api||window.CampusInstitutionAdmin;
      if(!api?.db||!api?.institutionId)throw new Error('Institution session expired. Sign in again.');
      const get=name=>form.elements.namedItem(name)?.value??null;
      const payload={
        full_name:get('full_name'),phone:get('phone'),alt_phone:get('alt_phone'),gender:get('gender'),date_of_birth:get('date_of_birth')||null,
        national_id:get('national_id'),address:get('address'),guardian_name:get('guardian_name'),guardian_phone:get('guardian_phone'),
        parent_email:get('parent_email'),parent_address:get('parent_address'),student_id:get('student_id'),admission_number:get('admission_number'),
        staff_id:get('staff_id'),program:get('program'),program_type:get('program_type'),department:get('department'),
        intake_year:get('intake_year'),intake_month:get('intake_month'),block:get('block'),current_block:get('current_block')||get('block'),
        year_of_study:get('year_of_study'),admission_date:get('admission_date')||null,admission_year:get('admission_year'),
        employment_date:get('employment_date')||null,doc_kcse:get('doc_kcse'),doc_id:get('doc_id'),
        profile_photo_url:user.profile_photo_url||get('profile_photo_url'),passport_url:user.passport_url||get('passport_url'),qualifications:get('qualifications'),
        specialization:get('specialization'),professional_bio:get('professional_bio'),role:get('role'),status:get('status'),
        login_enabled:get('login_enabled')==='true',updated_at:new Date().toISOString()
      };
      if(!payload.full_name?.trim())throw new Error('Full name is required.');
      if(['blocked','inactive'].includes(payload.status))payload.login_enabled=false;
      const approving = payload.status === 'approved' && !['approved','active'].includes(statusOf(user));
      if(approving){
        const {data:review,error:reviewError}=await api.db.rpc('review_institution_registration',{
          p_user_id:user.user_id,p_decision:'approve',p_reason:null
        });
        if(reviewError)throw reviewError;
        const result=Array.isArray(review)?review[0]:review;
        if(!result || result.success!==true || result.status!=='approved' || result.login_enabled!==true)
          throw new Error(result?.message||'The account approval could not be completed.');
      }
      const profileUpdate={...payload};
      if(approving){delete profileUpdate.status;delete profileUpdate.login_enabled;}
      const {data,error}=await api.db.from('consolidated_user_profiles_table').update(profileUpdate)
        .eq('user_id',user.user_id).eq('institution_id',api.institutionId).select('id,user_id');
      if(error)throw new Error([error.message,error.details,error.hint,error.code?'Code: '+error.code:null].filter(Boolean).join(' · '));
      if(!data?.length)throw new Error('The database did not confirm an updated row. Your institution session or update permission may have expired. No changes were confirmed.');
      Object.assign(user,payload);
      const editedEmail=String(get('email')||'').trim().toLowerCase();
      let emailNotice='';
      if(editedEmail&&editedEmail!==String(user.email||'').trim().toLowerCase()){
        try{
          const {data:sessionData,error:sessionError}=await api.db.auth.getSession();
          if(sessionError||!sessionData?.session)throw new Error('Session expired before login email could be updated.');
          const response=await fetch('https://irahplkvocaakjxuisto.supabase.co/functions/v1/admin-update-institution-user-email',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+sessionData.session.access_token},body:JSON.stringify({userId:user.user_id,newEmail:editedEmail})});
          const result=await response.json();if(!response.ok)throw new Error(result.error||'Login email update failed.');
          user.email=editedEmail;const row=state.rows.find(x=>x.user_id===user.user_id);if(row)row.email=editedEmail;
        }catch(emailError){emailNotice=' Profile details were saved, but the login email was not changed: '+(emailError.message||'email update failed')+'.';}
      }
      if(approving){
        const {data:emailData,error:emailError}=await api.db.functions.invoke('registration-approved-email',{body:{user_id:user.user_id}});
        if(emailError)emailNotice=' Account approved, but the approval email could not be sent: '+(emailError.message||'email service error')+'.';
        else if(emailData?.success===false)emailNotice=' Account approved, but the approval email was not sent: '+(emailData.message||'email service unavailable')+'.';
        else emailNotice=' Approval email notification accepted for delivery.';
      }
      await load();
      showDetails(state.rows.find(x=>x.user_id===user.user_id)||user);
      message('User profile updated successfully.'+emailNotice,!!emailNotice);
    }catch(error){
      console.error('[Institution user edit]',error);
      feedback.textContent=error.message||'Unable to save user details.';
      feedback.className='error';
    }finally{button.dataset.saving='false';button.disabled=false;button.textContent='Save changes';}
  }
  async function load(){
    if(state.loading)return;
    const api=window.CampusInstitutionAdmin;
    if(!api?.db||!api?.institutionId){message('Institution administrator session is not ready. Refresh the page.',true);return;}
    state.api=api;state.loading=true;message('Loading your institution user directory…');render();
    try{
      const columns='id,user_id,email,full_name,phone,alt_phone,date_of_birth,gender,national_id,address,profile_photo_url,role,role_id,student_id,admission_number,staff_id,program,program_type,department,status,created_at,updated_at,current_block,block,block_program_year,block_progress,intake_year,intake_month,admission_year,admission_date,employment_date,year_of_study,login_enabled,username,last_login,last_activity,login_count,two_factor_enabled,guardian_name,guardian_phone,parent_email,parent_address,qualifications,specialization,professional_bio,doc_kcse,doc_id,passport_url,institution_id';
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
    let attempts=0;const attempt=()=>{const api=window.CampusInstitutionAdmin;if(api?.db&&api?.institutionId){load();return;}if(++attempts<80)setTimeout(attempt,250);else message('Institution administrator session is not ready. Refresh the page and sign in again.',true);};attempt();
    document.querySelectorAll('[data-view="user-management"]').forEach(b=>b.addEventListener('click',()=>{if(!state.rows.length&&!state.loading)load();}));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
