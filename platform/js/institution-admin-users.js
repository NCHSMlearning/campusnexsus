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
      const actions=document.createElement('td'), view=document.createElement('button'), edit=document.createElement('button');
      view.type='button';view.className='ia-users-review-btn';view.textContent='View';view.addEventListener('click',()=>showDetails(u));
      edit.type='button';edit.className='ia-users-review-btn ia-users-edit-btn';edit.textContent='Edit';edit.addEventListener('click',()=>openEditForm(u));
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
  function showDetails(u){
    const dialog=$('iaUsersDialog'), body=$('iaUsersDialogBody');if(!dialog||!body)return;
    $('iaUsersDialogTitle').textContent=u.full_name||u.email||'User profile';
    body.replaceChildren();
    const summary=document.createElement('div');summary.className='ia-users-detail-summary';
    const avatar=document.createElement('span');avatar.className='ia-users-avatar large';avatar.textContent=(u.full_name||u.email||'U').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
    const meta=document.createElement('div'),nm=document.createElement('strong'),em=document.createElement('small');
    nm.textContent=u.full_name||'Name unavailable';em.textContent=label(u.role||u.role_id)+' · '+label(u.status);meta.append(nm,em);summary.append(avatar,meta);body.append(summary);
    const sections=[
      ['Personal information',[['Full name',u.full_name],['Email address',u.email],['Phone',u.phone],['Alternative phone',u.alt_phone],['Gender',u.gender],['Date of birth',u.date_of_birth],['National ID',u.national_id],['Address',u.address],['Profile photo URL',u.profile_photo_url]]],
      ['Guardian / parent information',[['Guardian name',u.guardian_name],['Guardian phone',u.guardian_phone],['Parent email',u.parent_email],['Parent address',u.parent_address]]],
      ['Academic & employment information',[['Role',u.role],['Role ID',u.role_id],['Student ID',u.student_id],['Admission number',u.admission_number],['Staff ID',u.staff_id],['Programme',u.program],['Programme type',u.program_type],['Department',u.department],['Intake month',u.intake_month],['Intake year',u.intake_year],['Admission year',u.admission_year],['Admission date',u.admission_date],['Current block',u.current_block||u.block],['Block / programme year',u.block_program_year],['Block progress',u.block_progress],['Employment date',u.employment_date],['Qualifications',u.qualifications],['Specialization',u.specialization],['Professional bio',u.professional_bio]]],
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
    const editButton=document.createElement('button');editButton.type='button';editButton.className='ia-users-review-btn ia-users-edit-btn';editButton.textContent='Edit user details';editButton.addEventListener('click',()=>openEditForm(u));body.append(editButton);
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
    const statusOptions=[['approved','Approved'],['blocked','Blocked'],['inactive','Inactive']];
    const profileFields=[
      ['full_name','Full name','text'],['email','Email address','email'],['phone','Phone number','tel'],['alt_phone','Alternative phone','tel'],
      ['gender','Gender','select',[['','Select gender'],['Male','Male'],['Female','Female'],['Other','Other']]],
      ['date_of_birth','Date of birth','date'],['national_id','National ID','text'],['address','Address','text'],
      ['guardian_name','Guardian name','text'],['guardian_phone','Guardian phone','tel'],['parent_email','Parent / guardian email','email'],['parent_address','Parent / guardian address','text'],
      ['student_id','Student / staff ID','text'],['admission_number','Admission number','text'],['staff_id','Staff ID','text'],
      ['program','Programme','select',[['DCHN','DCHN'],['KCHN','KCHN'],['TVET','TVET course'],['KRCHN','KRCHN (legacy)']]],
      ['program_type','Programme type','select',[['Nursing','Nursing'],['TVET','TVET'],['Other','Other']]],
      ['department','Department','text'],['intake_year','Intake year','select',[]],['intake_month','Intake month','select',[['','Select intake month'],...['January','February','March','April','May','June','July','August','September','October','November','December'].map(x=>[x,x])]],
      ['block','Block / Term','select',[]],['current_block','Current Block / Term','select',[]],['block_program_year','Year of study','select',[]],['admission_date','Admission date','date'],['admission_year','Admission year','select',[]],['employment_date','Employment date','date'],
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
    const statusValue=['approved','active'].includes(currentStatus)?'approved':(currentStatus==='blocked'?'blocked':'inactive');
    let html='<form id="iaUsersEditForm" class="ia-users-edit-form"><input type="hidden" name="user_id" value="'+safe(u.user_id||'')+'">';
    groups.forEach(([heading,fields])=>{
      html+='<section class="ia-users-edit-section"><h3>'+heading+'</h3><div class="ia-users-edit-grid">';
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
    const studyYear=$('iaEdit_block_program_year');
    const intakeYear=$('iaEdit_intake_year');
    const admissionYear=$('iaEdit_admission_year');
    const programmeOptions=[['DCHN','DCHN'],['KCHN','KCHN'],['TVET','TVET course']];
    if(u.program&&!programmeOptions.some(x=>x[0]===String(u.program)))programmeOptions.push([String(u.program),String(u.program)+' (current)']);
    setOptions('iaEdit_program',programmeOptions.map(([value,label])=>({value,label})),u.program,'Select programme');
    setOptions('iaEdit_intake_year',yearOptions.map(value=>({value,label:value})),u.intake_year,'Select intake year');
    setOptions('iaEdit_admission_year',yearOptions.map(value=>({value,label:value})),u.admission_year,'Select admission year');
    setOptions('iaEdit_block_program_year',['Year 1','Year 2','Year 3','Year 4'].map(value=>({value,label:value})),u.block_program_year,'Select year of study');
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
    const form=event.currentTarget,button=form.querySelector('[type="submit"]'),feedback=$('iaUsersEditFeedback');
    button.disabled=true;button.textContent='Saving…';feedback.textContent='';
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
        block_program_year:get('block_program_year'),admission_date:get('admission_date')||null,admission_year:get('admission_year'),
        employment_date:get('employment_date')||null,doc_kcse:get('doc_kcse'),doc_id:get('doc_id'),
        profile_photo_url:get('profile_photo_url'),passport_url:get('passport_url'),qualifications:get('qualifications'),
        specialization:get('specialization'),professional_bio:get('professional_bio'),role:get('role'),status:get('status'),
        login_enabled:get('login_enabled')==='true',updated_at:new Date().toISOString()
      };
      if(!payload.full_name?.trim())throw new Error('Full name is required.');
      if(['blocked','inactive'].includes(payload.status))payload.login_enabled=false;
      const {data,error}=await api.db.from('consolidated_user_profiles_table').update(payload)
        .eq('user_id',user.user_id).eq('institution_id',api.institutionId).select('id,user_id');
      if(error)throw error;
      if(!data?.length)throw new Error('No matching user was updated. Check your institution permissions and enabled modules.');
      Object.assign(user,payload);
      await load();
      showDetails(state.rows.find(x=>x.user_id===user.user_id)||user);
      message('User profile updated successfully.');
    }catch(error){
      console.error('[Institution user edit]',error);
      feedback.textContent=error.message||'Unable to save user details.';
      feedback.className='error';
    }finally{button.disabled=false;button.textContent='Save all changes';}
  }
  async function load(){
    if(state.loading)return;
    const api=window.CampusInstitutionAdmin;
    if(!api?.db||!api?.institutionId){message('Institution administrator session is not ready. Refresh the page.',true);return;}
    state.api=api;state.loading=true;message('Loading your institution user directory…');render();
    try{
      const columns='id,user_id,email,full_name,phone,alt_phone,date_of_birth,gender,national_id,address,profile_photo_url,role,role_id,student_id,admission_number,staff_id,program,program_type,department,status,created_at,updated_at,current_block,block,block_program_year,block_progress,intake_year,intake_month,admission_year,admission_date,employment_date,login_enabled,username,last_login,last_activity,login_count,two_factor_enabled,guardian_name,guardian_phone,parent_email,parent_address,qualifications,specialization,professional_bio,institution_id';
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
