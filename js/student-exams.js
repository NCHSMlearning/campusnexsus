(function(){
'use strict';
const state={client:null,user:null,profile:null,exams:[],announcements:[],history:[],dashboardStats:null};
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const val=(...xs)=>xs.find(x=>x!==undefined&&x!==null&&String(x).trim()!=='');
const norm=v=>String(v??'').trim().toLowerCase();
// Reuse the persistent Supabase client, never the CDN namespace.
const client=()=>[window.examSupabase,window.sb,window.supabaseClient,window.db?.supabase].find(c=>c&&typeof c.from==='function'&&typeof c.auth?.getSession==='function')||null;
function activateModule(id,updateHash=true){
 const allowed=['dashboard','examinations','timetable','announcements','exam-history','exam-support'];
 const active=allowed.includes(id)?id:'examinations';
 document.querySelectorAll('.module-view').forEach(section=>{const on=section.id===active;section.classList.toggle('active',on);section.hidden=!on;});
 document.querySelectorAll('.exam-nav a[data-module]').forEach(link=>{const on=link.dataset.module===active;link.classList.toggle('active',on);if(on)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
 const labels={dashboard:'Student Dashboard',examinations:'Examination Centre',timetable:'Examination Timetable',announcements:'Institution Announcements','exam-history':'Examination History','exam-support':'Examination Support'};
 const heading=document.querySelector('.header-left>div>b');if(heading)heading.textContent=labels[active];
 const hero=document.querySelector('.hero');if(hero)hero.hidden=true;
 if(updateHash&&location.hash!=='#'+active)history.replaceState(null,'','#'+active);
 window.scrollTo({top:0,behavior:'smooth'});
}
function notify(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>el.classList.remove('show'),3200)}
function isTvet(p){return /TVET|DIPLOMA|CERTIFICATE|ARTISAN/i.test(String(val(p.program_type,p.program,p.program_name,'')))}
function studentBlock(p){return String(val(p.current_block,p.block_term,p.block,p.term,p.year_of_study,'General'))}
function matchesBlock(exam,p){
 const eb=String(val(exam.block,exam.block_term,exam.term,'General')),sb=studentBlock(p);
 if(['general','all'].includes(norm(eb))||norm(sb)==='general'||norm(eb)===norm(sb))return true;
 if(isTvet(p)){const ey=eb.match(/year\s*(\d+)/i),sy=sb.match(/year\s*(\d+)/i),et=eb.match(/term\s*(\d+)/i),st=sb.match(/term\s*(\d+)/i);return !!(ey&&sy&&ey[1]===sy[1]&&((et&&st&&et[1]===st[1])||(!et&&!st)))}
 const en=eb.match(/\d+/),sn=sb.match(/\d+/);
 if(en&&sn&&en[0]===sn[0])return true;
 return eb.toLowerCase().includes(sb.toLowerCase())||sb.toLowerCase().includes(eb.toLowerCase());
}
function eligible(exam,p){
 const studentProgram=norm(val(p.program,p.program_name,p.program_type,''));
 const examProgram=norm(val(exam.target_program,exam.program_type,''));
 const studentIntake=val(p.intake_year,p.intake,p.admission_year);
 const examIntake=exam.intake_year;
 if(exam.institution_id&&String(exam.institution_id)!==String(p.institution_id))return false;
 const programOk=!examProgram||['general','all'].includes(examProgram)||examProgram===studentProgram||(!isTvet(p)&&examProgram==='krchn')||(isTvet(p)&&examProgram==='tvet');
 const intakeOk=examIntake===undefined||examIntake===null||norm(examIntake)==='general'||String(examIntake)===String(studentIntake);
 const approval=norm(exam.approval_status);
 const approved=approval==='approved'&&exam.is_published===true;
 const notDraft=!['draft','cancelled','rejected'].includes(norm(exam.status));
 return approved&&notDraft&&programOk&&intakeOk&&matchesBlock(exam,p);
}
function startsAt(exam){
 const date=val(exam.start_time,exam.exam_date,exam.start_date,exam.scheduled_at);
 if(!date)return null;
 const time=val(exam.exam_start_time);
 if(time&&/^\d{1,2}:\d{2}/.test(String(time))&&!String(date).includes('T'))return new Date(String(date).slice(0,10)+'T'+String(time).slice(0,5)+':00+03:00');
 const d=new Date(date);return Number.isNaN(d.getTime())?null:d;
}
function examState(exam){
 const status=norm(exam.status);
 if(['closed','expired','completed','cancelled'].includes(status))return 'closed';
 const start=startsAt(exam),duration=Number(exam.duration_minutes)||40;
 const now=Date.now();
 const explicitEnd=val(exam.end_time);
 const endAt=explicitEnd?new Date(explicitEnd):null;
 if(start){const end=endAt&&!Number.isNaN(endAt.getTime())?endAt.getTime():start.getTime()+duration*60000;if(now<start.getTime())return 'upcoming';if(now<=end)return 'open';return 'closed'}
 if(['upcoming','scheduled','pending'].includes(status))return 'upcoming';
 if(['published','active','open','available'].includes(status))return 'open';
 return 'open';
}
function onlineHref(exam){const raw=val(exam.exam_link,exam.online_link,'');if(!raw)return '';try{const url=new URL(raw,location.origin);return ['http:','https:'].includes(url.protocol)?url.href:''}catch(_){return ''}}
function dateLabel(exam){const d=startsAt(exam);return d?d.toLocaleString('en-KE',{timeZone:'Africa/Nairobi',dateStyle:'medium',timeStyle:'short'})+' EAT':'Schedule to be confirmed'}
function renderDashboard(){
 const counts={upcoming:0,open:0,closed:0};
 state.exams.forEach(e=>{const s=examState(e);if(counts[s]!==undefined)counts[s]++;});
 const stats=state.dashboardStats||{};
 const completed=Number(stats.submitted??state.history.filter(a=>!!a.submitted_at).length);
 const totalCount=Number(stats.total??state.exams.length);
 const upcoming=Number(stats.upcoming??counts.upcoming),open=Number(stats.open??state.exams.filter(e=>examState(e)==='open'&&val(e.exam_link,e.online_link)).length),closed=Number(stats.closed??counts.closed);
 $('stat-total').textContent=totalCount;$('stat-upcoming').textContent=upcoming;$('stat-open').textContent=open;$('stat-completed').textContent=completed;
 const total=Math.max(totalCount,1);
 $('status-chart').innerHTML=[['Available now',open,'#16835b'],['Upcoming',upcoming,'#c58a25'],['Closed',closed,'#71849a']].map(([label,n,color])=>'<div class="chart-bar-row"><span>'+label+'</span><div class="chart-track"><i style="width:'+Math.min(100,Math.round(n/total*100))+'%;background:'+color+'"></i></div><b>'+n+'</b></div>').join('')+(totalCount?'':'<p class="chart-empty">No approved examinations are assigned to your programme yet.</p>');
 const serverActivity=Array.isArray(stats.activity)?stats.activity:null;
 const days=[];for(let i=6;i>=0;i--){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-i);const key=d.toLocaleDateString('en-CA');const serverDay=serverActivity?.find(x=>String(x.day).slice(0,10)===key);const count=serverDay?Number(serverDay.count):state.history.filter(a=>{const raw=a.submitted_at||a.started_at;return raw&&new Date(raw).toLocaleDateString('en-CA')===key;}).length;days.push({label:d.toLocaleDateString('en',{weekday:'short'}),count});}
 const max=Math.max(...days.map(x=>x.count),1);
 $('activity-chart').innerHTML='<div class="activity-bars">'+days.map(d=>'<div class="activity-column"><b>'+d.count+'</b><i style="height:'+Math.max(5,d.count/max*100)+'%"></i><small>'+d.label+'</small></div>').join('')+'</div><div class="chart-footnote">Last 7 days · '+completed+' submitted in total</div>';
}
function render(){
 const q=norm($('search-input').value),filter=$('status-filter').value;
 const rows=state.exams.map(exam=>({exam,status:examState(exam)})).filter(x=>(filter==='all'||filter===x.status)&&(!q||norm([x.exam.title,x.exam.exam_name,x.exam.course_name,x.exam.unit_name,x.exam.exam_type].join(' ')).includes(q)));
 renderDashboard();
 if(!rows.length){$('exam-panel').innerHTML='<div class="empty-state"><i class="fa-regular fa-calendar-xmark"></i><p>'+(state.exams.length?'No examinations match this filter.':'No approved and published examinations have been assigned to your programme, intake and block yet.')+'</p></div>';return}
 $('exam-panel').innerHTML='<div class="exam-grid">'+rows.map(({exam,status})=>{
  const title=val(exam.title,exam.exam_name,exam.name,'Examination');
  const unit=val(exam.course_name,exam.unit_name,exam.subject_name,exam.course?.course_name,'General assessment');
  const link=onlineHref(exam);
  const badge=status==='open'?'open':status==='upcoming'?'upcoming':'completed';
  const label=status==='open'?'Available now':status==='upcoming'?'Upcoming':'Closed';
  const action=status==='open'&&link?'<a class="primary-btn" href="'+esc(link)+'" target="_blank" rel="noopener noreferrer">Start Online Examination <i class="fa-solid fa-arrow-up-right-from-square"></i></a>':status==='open'?'<button class="secondary-btn" disabled>Online link not yet added</button>':status==='upcoming'?'<button class="secondary-btn" disabled>Opens at scheduled time</button>':'<button class="secondary-btn" disabled>Examination closed</button>';
  return '<article class="exam-card"><div class="exam-card-top"><div><h3>'+esc(title)+'</h3><div class="exam-unit">'+esc(unit)+'</div></div><span class="status '+badge+'">'+label+'</span></div><div class="exam-meta"><span><i class="fa-regular fa-calendar"></i>'+esc(dateLabel(exam))+'</span><span><i class="fa-solid fa-layer-group"></i>'+esc(val(exam.exam_type,'Examination'))+'</span><span><i class="fa-regular fa-hourglass-half"></i>'+esc((Number(exam.duration_minutes)||40)+' minutes')+'</span></div><div class="exam-actions"><span class="exam-date">'+esc(val(exam.block_term,exam.block,exam.term,'All blocks'))+' · '+esc(val(exam.intake_year,'All intakes'))+'</span>'+action+'</div></article>';
 }).join('')+'</div>';
}
async function loadDashboardStats(){
 const {data,error}=await state.client.rpc('get_student_exam_dashboard_stats');
 if(error)throw error;
 state.dashboardStats=Array.isArray(data)?data[0]:data;
 renderDashboard();
}
async function loadExams(){
 $('refresh-btn').disabled=true;
 $('exam-panel').innerHTML='<div class="loading-state"><span class="spinner"></span><p>Loading examinations assigned to you…</p></div>';
 try {
  const request=state.client.from('exams').select('*').eq('institution_id',state.profile.institution_id).order('exam_date',{ascending:true,nullsFirst:false});
  const {data,error}=await Promise.race([request,{then:(_,reject)=>setTimeout(()=>reject(new Error('Examination records are taking too long to load. Check your connection and tap Refresh.')),12000)}]);
  if(error)throw error;
  state.exams=(data||[]).filter(e=>eligible(e,state.profile));
  render();
 } finally { $('refresh-btn').disabled=false; }
}

function renderTimetable(){
 const upcoming=state.exams.filter(e=>examState(e)==='upcoming'||examState(e)==='open').sort((a,b)=>(startsAt(a)?.getTime()||0)-(startsAt(b)?.getTime()||0));
 $('timetable-panel').innerHTML=upcoming.length?'<div class="portal-list">'+upcoming.map(e=>'<article class="portal-list-item"><div class="portal-list-icon"><i class="fa-regular fa-calendar-check"></i></div><div class="portal-list-copy"><b>'+esc(val(e.title,e.exam_name,e.name,'Examination'))+'</b><small>'+esc(val(e.course_name,e.unit_name,e.course_code,'Assessment'))+' · '+esc(val(e.block_term,e.block,'All blocks'))+'</small></div><div class="portal-list-date">'+esc(dateLabel(e))+'</div></article>').join('')+'</div>':'<div class="empty-state"><i class="fa-regular fa-calendar"></i><p>No upcoming examinations have been scheduled for you.</p></div>';
}
async function loadAnnouncements(){
 const panel=$('announcements-panel');panel.innerHTML='<div class="loading-state"><span class="spinner"></span><p>Loading announcements…</p></div>';
 const {data,error}=await state.client.rpc('get_student_exam_announcements');
 if(error)throw error;state.announcements=data||[];
 panel.innerHTML=state.announcements.length?'<div class="portal-list">'+state.announcements.map(a=>'<article class="portal-list-item announcement-item"><div class="portal-list-icon"><i class="fa-solid fa-bullhorn"></i></div><div class="portal-list-copy"><b>'+esc(a.title)+'</b><p>'+esc(a.message)+'</p><small>'+esc(a.created_at?new Date(a.created_at).toLocaleString('en-KE',{dateStyle:'medium',timeStyle:'short'}):'')+'</small></div></article>').join('')+'</div>':'<div class="empty-state"><i class="fa-regular fa-bell"></i><p>There are no current announcements for your class.</p></div>';
}
async function loadHistory(){
 const panel=$('history-panel');panel.innerHTML='<div class="loading-state"><span class="spinner"></span><p>Loading your examination history…</p></div>';
 const {data,error}=await state.client.from('exam_attempts').select('id,exam_id,attempt_number,status,started_at,submitted_at').eq('student_id',state.user.id).order('started_at',{ascending:false}).limit(30);
 if(error)throw error;state.history=data||[];renderDashboard();
 panel.innerHTML=state.history.length?'<div class="portal-list">'+state.history.map(a=>{const e=state.exams.find(x=>String(x.id)===String(a.exam_id));return '<article class="portal-list-item"><div class="portal-list-icon"><i class="fa-solid fa-file-circle-check"></i></div><div class="portal-list-copy"><b>'+esc(val(e?.title,e?.exam_name,'Examination'))+'</b><small>Attempt '+esc(a.attempt_number)+' · '+esc(a.submitted_at?'Submitted':'In progress')+'</small></div><div class="portal-list-date">'+esc(a.submitted_at?new Date(a.submitted_at).toLocaleString('en-KE',{dateStyle:'medium',timeStyle:'short'}):a.started_at?new Date(a.started_at).toLocaleString('en-KE',{dateStyle:'medium',timeStyle:'short'}):'')+'</div></article>'}).join('')+'</div>':'<div class="empty-state"><i class="fa-regular fa-folder-open"></i><p>You have no examination attempts yet.</p></div>';
}
async function submitSupport(event){
 event.preventDefault();const btn=$('support-submit'),feedback=$('support-feedback');btn.disabled=true;feedback.textContent='Submitting your request…';
 try{const {data,error}=await state.client.rpc('submit_student_exam_support_ticket',{p_subject:$('support-subject').value.trim(),p_description:$('support-description').value.trim(),p_category:$('support-category').value});
 if(error)throw error;const ticket=Array.isArray(data)?data[0]?.ticket_number:data?.ticket_number;feedback.textContent='Your request was submitted. Ticket reference: '+(ticket||'created');$('exam-support-form').reset();notify('Support request submitted successfully.');}
 catch(e){feedback.textContent=e.message||'Could not submit your request. Please try again.';}
 finally{btn.disabled=false;}
}
async function init(){
 // Use the already-persisted Supabase client directly. Do not run the
 // legacy database bootstrap here; it can delay page startup unnecessarily.
 state.client=client();
 if(!state.client)throw new Error(window.__EXAM_CONFIG_ERROR__||'Student database connection is unavailable. Please refresh this page.');
 const {data,error}=await state.client.auth.getSession();
 if(error)throw error;
 const session=data?.session;
 if(!session?.user){location.replace('/examlogin.html?redirect='+encodeURIComponent('/studentexam.html'));return}
 state.user=session.user;
 const profileResult=await state.client.from('consolidated_user_profiles_table').select('user_id,full_name,role,status,login_enabled,institution_id,admission_number,student_id,program,program_type,current_block,block,intake_year,intake_month,admission_year').eq('user_id',session.user.id).maybeSingle();
 if(profileResult.error)throw profileResult.error;
 state.profile=profileResult.data;
 const p=state.profile,role=norm(p?.role),status=norm(p?.status);
 if(!p||role!=='student'||!['approved','active'].includes(status)||p?.login_enabled===false||!p?.institution_id){
  throw new Error('Your account is signed in, but it is not currently approved for the student examination centre. Please contact your institution administrator.');
 }
 // Institution branding is optional: never let a branding lookup prevent the exam dashboard from opening.
 try {
  const institutionResult=await state.client.rpc('get_my_exam_institution');
  if(institutionResult.error)throw institutionResult.error;
  const institution=Array.isArray(institutionResult.data)?institutionResult.data[0]:institutionResult.data;
  if(!institution)throw new Error('Your institution profile could not be loaded. Please contact your institution administrator.');
  const institutionName=val(institution.name,'Your Institution');
  $('institution-name').textContent=institutionName;
  $('institution-header-name').textContent=institutionName+'  ›  STUDENT EXAMINATION CENTRE';
  $('institution-portal-label').textContent=val(institution.school_code,institution.short_code,'STUDENT PORTAL').toUpperCase();
  const logo=$('institution-logo'),fallback=$('institution-logo-fallback');
  if(institution.logo_url&&/^https:\/\//i.test(institution.logo_url)){
   logo.src=institution.logo_url;logo.alt=institutionName+' logo';logo.hidden=false;fallback.hidden=true;
   logo.onerror=()=>{logo.hidden=true;fallback.hidden=false;};
  }else{logo.hidden=true;fallback.hidden=false;}
  const primary=typeof institution.primary_color==='string'&&/^#[0-9a-f]{3,8}$/i.test(institution.primary_color)?institution.primary_color:'#082f55';
  const secondary=typeof institution.secondary_color==='string'&&/^#[0-9a-f]{3,8}$/i.test(institution.secondary_color)?institution.secondary_color:'#0c8990';
  document.documentElement.style.setProperty('--navy',primary);
  document.documentElement.style.setProperty('--navy2',secondary);
  document.documentElement.style.setProperty('--teal',secondary);
  document.title=institutionName+' | Student Examinations';
 
 } catch(brandingError) {
  console.warn('Institution branding could not be loaded; continuing with examination dashboard.',brandingError);
  $('institution-name').textContent='Student Portal';
  $('institution-header-name').textContent='STUDENT PORTAL  ›  STUDENT EXAMINATION CENTRE';
  $('institution-portal-label').textContent='STUDENT PORTAL';
 }
 const name=val(p.full_name,p.name,p.student_name,session.user.user_metadata?.full_name,session.user.email,'Student');
 // Keep the dashboard resilient when optional profile labels are not present in this page layout.
 const setText=(id,value)=>{const node=$(id);if(node)node.textContent=String(value??'');};
 setText('welcome-name',name);
 setText('side-name',name);
 setText('avatar',name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase());
 setText('side-admission',val(p.admission_number,p.student_id,'Student account'));
 setText('student-meta',[val(p.program,p.program_name,'Programme not assigned'),studentBlock(p)!=='General'?studentBlock(p):'',val(p.intake_year,p.intake,'')].filter(Boolean).join(' • '));
 await loadDashboardStats().catch(e=>{console.warn('Dashboard statistics RPC unavailable; using student-visible records.',e);});
 await loadExams().catch(e=>{console.error('Student examination list failed:',e);$('exam-panel').innerHTML='<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>Examination list could not be loaded. Your dashboard statistics are shown where available.</p></div>';});
 renderTimetable();renderDashboard();
 loadAnnouncements().catch(e=>{$('announcements-panel').innerHTML='<div class="empty-state"><p>Announcements are temporarily unavailable.</p></div>';console.warn(e)});
 loadHistory().catch(e=>{$('history-panel').innerHTML='<div class="empty-state"><p>Examination history is temporarily unavailable.</p></div>';console.warn(e)});
}
document.querySelectorAll('.exam-nav a[data-module]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();activateModule(link.dataset.module);document.getElementById('exam-sidebar').classList.remove('show');document.getElementById('mobile-scrim').classList.remove('show');}));
window.addEventListener('hashchange',()=>activateModule(location.hash.slice(1),false));
activateModule(location.hash.slice(1)||'dashboard',false);
$('refresh-btn').addEventListener('click',()=>loadExams().then(renderTimetable).catch(e=>notify(e.message||'Could not refresh examinations.')));
$('refresh-announcements').addEventListener('click',()=>loadAnnouncements().catch(e=>notify(e.message||'Could not load announcements.')));
$('refresh-history').addEventListener('click',()=>loadHistory().catch(e=>notify(e.message||'Could not load examination history.')));
$('exam-support-form').addEventListener('submit',submitSupport);
$('search-input').addEventListener('input',render);$('status-filter').addEventListener('change',render);
$('logout-btn').addEventListener('click',async()=>{try{if(state.client)await state.client.auth.signOut({scope:'local'})}finally{location.replace('/examlogin.html')}});
document.addEventListener('DOMContentLoaded',()=>init().catch(e=>{$('exam-panel').innerHTML='<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>'+esc(e.message||'Unable to load your examinations.')+'</p><button class="secondary-btn" onclick="location.reload()">Try again</button></div>'}));
})();