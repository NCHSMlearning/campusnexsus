(function(){
'use strict';
const state={client:null,user:null,profile:null,exams:[]};
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const val=(...xs)=>xs.find(x=>x!==undefined&&x!==null&&String(x).trim()!=='');
const norm=v=>String(v??'').trim().toLowerCase();
const client=()=>window.db?.supabase||window.supabase||window.supabaseClient||null;
function notify(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>el.classList.remove('show'),3200)}
function isTvet(p){return /TVET|DIPLOMA|CERTIFICATE|ARTISAN/i.test(String(val(p.program_type,p.program,p.program_name,'')))}
function studentBlock(p){return String(val(p.block_term,p.block,p.term,p.year_of_study,'General'))}
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
 const examProgram=norm(val(exam.program_type,exam.target_program,''));
 const studentIntake=val(p.intake_year,p.intake,p.admission_year);
 const examIntake=exam.intake_year;
 if(exam.institution_id&&String(exam.institution_id)!==String(p.institution_id))return false;
 const programOk=!examProgram||['general','all'].includes(examProgram)||examProgram===studentProgram||(!isTvet(p)&&examProgram==='krchn')||(isTvet(p)&&examProgram==='tvet');
 const intakeOk=examIntake===undefined||examIntake===null||norm(examIntake)==='general'||String(examIntake)===String(studentIntake);
 return programOk&&intakeOk&&matchesBlock(exam,p);
}
function startsAt(exam){
 const date=val(exam.exam_date,exam.start_date,exam.scheduled_at);
 if(!date)return null;
 const time=val(exam.exam_start_time,exam.start_time);
 if(time&&/^\d{1,2}:\d{2}/.test(String(time))&&!String(date).includes('T'))return new Date(String(date).slice(0,10)+'T'+String(time).slice(0,5)+':00+03:00');
 const d=new Date(date);return Number.isNaN(d.getTime())?null:d;
}
function examState(exam){
 const status=norm(exam.status);
 if(['closed','expired','completed','cancelled'].includes(status))return 'closed';
 const start=startsAt(exam),duration=Number(exam.duration_minutes)||40;
 const now=Date.now();
 if(start){const end=start.getTime()+duration*60000;if(now<start.getTime())return 'upcoming';if(now<=end)return 'open';return 'closed'}
 if(['upcoming','scheduled','pending'].includes(status))return 'upcoming';
 if(['published','active','open','available'].includes(status))return 'open';
 return 'open';
}
function onlineHref(exam){const raw=val(exam.exam_link,exam.online_link,'');if(!raw)return '';try{const url=new URL(raw,location.origin);return ['http:','https:'].includes(url.protocol)?url.href:''}catch(_){return ''}}
function dateLabel(exam){const d=startsAt(exam);return d?d.toLocaleString('en-KE',{timeZone:'Africa/Nairobi',dateStyle:'medium',timeStyle:'short'})+' EAT':'Schedule to be confirmed'}
function render(){
 const q=norm($('search-input').value),filter=$('status-filter').value;
 const rows=state.exams.map(exam=>({exam,status:examState(exam)})).filter(x=>(filter==='all'||filter===x.status)&&(!q||norm([x.exam.title,x.exam.exam_name,x.exam.course_name,x.exam.unit_name,x.exam.exam_type].join(' ')).includes(q)));
 $('stat-total').textContent=state.exams.length;
 $('stat-upcoming').textContent=state.exams.filter(e=>examState(e)==='upcoming').length;
 $('stat-open').textContent=state.exams.filter(e=>examState(e)==='open'&&val(e.exam_link,e.online_link)).length;
 if(!rows.length){$('exam-panel').innerHTML='<div class="empty-state"><i class="fa-regular fa-calendar-xmark"></i><p>No examinations match this filter. Check again later or refresh the list.</p></div>';return}
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
async function loadExams(){
 $('exam-panel').innerHTML='<div class="loading-state"><span class="spinner"></span><p>Loading examinations assigned to you…</p></div>';
 const {data,error}=await state.client.from('exams').select('*, course:course_id(course_name)').eq('institution_id',state.profile.institution_id).order('exam_date',{ascending:true});
 if(error)throw error;
 state.exams=(data||[]).filter(e=>eligible(e,state.profile));
 render();
}
async function init(){
 state.client=client();if(!state.client)throw new Error('Student database connection is unavailable. Refresh and try again.');
 const {data,error}=await state.client.auth.getSession();const session=data?.session;
 if(error||!session?.user){location.replace('/examlogin.html?redirect='+encodeURIComponent(location.pathname));return}
 state.user=session.user;
 const profileResult=await state.client.from('consolidated_user_profiles_table').select('*').eq('user_id',session.user.id).maybeSingle();
 if(profileResult.error)throw profileResult.error;
 state.profile=profileResult.data;
 const p=state.profile,role=norm(p?.role),status=norm(p?.status);
 if(role!=='student'||!['approved','active'].includes(status)||p?.login_enabled===false||!p?.institution_id){location.replace('/examlogin.html?redirect='+encodeURIComponent(location.pathname));return}
 const name=val(p.full_name,p.name,p.student_name,session.user.user_metadata?.full_name,session.user.email,'Student');
 $('welcome-name').textContent=name;$('side-name').textContent=name;$('avatar').textContent=name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
 $('side-admission').textContent=val(p.admission_number,p.student_id,'Student account');
 $('student-meta').textContent=[val(p.program,p.program_name,'Programme not assigned'),studentBlock(p)!=='General'?studentBlock(p):'',val(p.intake_year,p.intake,'')].filter(Boolean).join(' • ');
 await loadExams();
}
$('refresh-btn').addEventListener('click',()=>loadExams().catch(e=>notify(e.message||'Could not refresh examinations.')));
$('search-input').addEventListener('input',render);$('status-filter').addEventListener('change',render);
$('logout-btn').addEventListener('click',async()=>{await state.client?.auth.signOut();location.replace('/examlogin.html')});
document.addEventListener('DOMContentLoaded',()=>init().catch(e=>{$('exam-panel').innerHTML='<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>'+esc(e.message||'Unable to load your examinations.')+'</p><button class="secondary-btn" onclick="location.reload()">Try again</button></div>'}));
})();