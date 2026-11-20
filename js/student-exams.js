(function(){
'use strict';
const ZERO_QUESTION='00000000-0000-0000-0000-000000000000';
const state={client:null,user:null,profile:null,exams:[],grades:[],released:new Set(),publishedMarks:[],tab:'exams'};
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const val=(...values)=>values.find(v=>v!==undefined&&v!==null&&String(v).trim()!=='');
const norm=v=>String(v??'').trim().toLowerCase();
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),3200)}
function getClient(){return window.db?.supabase||window.supabase||window.supabaseClient||null}
function getBlock(p){return val(p.block_term,p.block,p.term,p.year_of_study,'General')}
function isTvet(p){return /TVET|DIPLOMA|CERTIFICATE|ARTISAN/i.test(String(val(p.program_type,p.program,'')))}
function matchesBlock(exam,profile){
 const eb=String(val(exam.block,exam.block_term,exam.term,'General'));
 const sb=String(getBlock(profile));
 if(['general','all'].includes(norm(eb))||norm(sb)==='general')return true;
 if(norm(eb)===norm(sb))return true;
 const en=eb.match(/\\d+/),sn=sb.match(/\\d+/);
 if(en&&sn&&en[0]===sn[0])return true;
 if(isTvet(profile)){const ey=eb.match(/year\\s*(\\d+)/i),sy=sb.match(/year\\s*(\\d+)/i),et=eb.match(/term\\s*(\\d+)/i),st=sb.match(/term\\s*(\\d+)/i);return !!(ey&&sy&&ey[1]===sy[1]&&((et&&st&&et[1]===st[1])||(!et&&!st)))}
 return eb.toLowerCase().includes(sb.toLowerCase())||sb.toLowerCase().includes(eb.toLowerCase());
}
function eligible(exam,p){
 const program=String(val(p.program,p.program_name,p.program_type,''));
 const ep=String(val(exam.program_type,exam.target_program,''));
 const intake=val(p.intake_year,p.intake,p.admission_year);
 const examIntake=exam.intake_year;
 const institution=p.institution_id;
 if(exam.institution_id&&institution&&String(exam.institution_id)!==String(institution))return false;
 const programOk=!ep||['general','all','tvet'].includes(norm(ep))||norm(ep)===norm(program)||(!isTvet(p)&&norm(ep)==='krchn');
 const intakeOk=examIntake===undefined||examIntake===null||String(examIntake).toLowerCase()==='general'||String(examIntake)===String(intake);
 return programOk&&intakeOk&&matchesBlock(exam,p);
}
function examDate(exam){return val(exam.exam_date,exam.start_date,exam.scheduled_at,exam.created_at)}
function examStatus(exam,grade){
 if(grade)return 'completed';
 const now=Date.now(),start=examDate(exam)?new Date(examDate(exam)).getTime():0;
 const end=val(exam.end_date,exam.close_at,exam.deadline)?new Date(val(exam.end_date,exam.close_at,exam.deadline)).getTime():0;
 if(start&&start>now)return 'upcoming';
 if(end&&end<now)return 'closed';
 return 'open';
}
function fmtDate(value){if(!value)return 'Date not set';const d=new Date(value);return isNaN(d)?'Date not set':d.toLocaleString('en-KE',{timeZone:'Africa/Nairobi',dateStyle:'medium',timeStyle:'short'})+' EAT'}
function gradeFor(exam){return state.grades.filter(g=>String(g.exam_id)===String(exam.id)).sort((a,b)=>new Date(val(b.updated_at,b.graded_at,b.created_at,0))-new Date(val(a.updated_at,a.graded_at,a.created_at,0)))[0]||null}
function released(grade){return !!grade&&(state.released.has(String(grade.id))||['released','published','approved'].includes(norm(grade.result_status))||grade.is_released===true)}
function scoreFor(exam,g){if(!g)return null;const type=norm(exam.exam_type);let score=val(g.marks,g.total_score,g.score,g.cat_1_score,g.cat_2_score);let total=val(exam.marks_out_of,exam.total_marks,exam.total_marks_available,100);if(type.includes('cat'))total=val(exam.marks_out_of,30);else if(['exam','final','end_term'].includes(type))total=val(exam.marks_out_of,70);const n=Number(score);return Number.isFinite(n)?{score:n,total:Number(total)||100}:null}
function resultStatus(g){return released(g)?'Released':String(val(g.result_status,'Pending review')).replace(/_/g,' ')}
function setStats(list){const statuses=list.map(x=>x.status);$('stat-available').textContent=list.length;$('stat-pending').textContent=statuses.filter(s=>s==='upcoming'||s==='open').length;$('stat-completed').textContent=statuses.filter(s=>s==='completed').length;$('stat-released').textContent=list.filter(x=>x.grade&&released(x.grade)).length}
function renderExams(){
 const q=norm($('search-input').value),filter=$('status-filter').value;
 const list=state.exams.map(exam=>({exam,grade:gradeFor(exam),status:examStatus(exam,gradeFor(exam))})).filter(x=>(filter==='all'||filter===x.status||filter==='completed'&&x.status==='completed')&&(!q||norm([x.exam.title,x.exam.exam_name,x.exam.course_name,x.exam.unit_name,x.exam.exam_type].join(' ')).includes(q)));
 setStats(state.exams.map(exam=>({status:examStatus(exam,gradeFor(exam)),grade:gradeFor(exam)})));
 if(!list.length){$('exam-panel').innerHTML='<div class="empty-state"><i class="fa-regular fa-folder-open"></i><p>No assessments match this view.</p></div>';return}
 $('exam-panel').innerHTML='<div class="exam-grid">'+list.map(({exam,grade,status})=>{
  const title=val(exam.title,exam.exam_name,exam.name,'Examination'),unit=val(exam.course_name,exam.unit_name,exam.subject_name,exam.course?.course_name,'Assessment');
  const statusText=status==='open'?'Available now':status==='upcoming'?'Upcoming':status==='closed'?'Closed':'Attempt recorded';
  const badge=status==='open'?'open':status==='upcoming'?'upcoming':'completed';
  const canStart=status==='open'&&!grade&&!!val(exam.exam_link,exam.online_link);
  const action=canStart?'<button class="primary-btn" data-start="'+esc(exam.id)+'">Start examination <i class="fa-solid fa-arrow-up-right-from-square"></i></button>':grade?'<button class="secondary-btn" data-result="'+esc(exam.id)+'">View result</button>':'<button class="secondary-btn" disabled>'+ (status==='upcoming'?'Not yet open':status==='closed'?'Window closed':'Unavailable')+'</button>';
  const gradeLabel=grade?(released(grade)?'Result released':'Submitted · awaiting review'):'No attempt recorded';
  return '<article class="exam-card"><div class="exam-card-top"><div><h3>'+esc(title)+'</h3><div class="exam-unit">'+esc(unit)+'</div></div><span class="status '+badge+'">'+statusText+'</span></div><div class="exam-meta"><span><i class="fa-regular fa-calendar"></i>'+esc(fmtDate(examDate(exam)))+'</span><span><i class="fa-solid fa-layer-group"></i>'+esc(val(exam.exam_type,'Assessment'))+'</span></div><div class="exam-actions"><span class="exam-date">'+esc(gradeLabel)+'</span>'+action+'</div></article>';
 }).join('')+'</div>';
}
function renderResults(){
 const rows=state.exams.map(exam=>({exam,grade:gradeFor(exam)})).filter(x=>x.grade);
 $('results-body').innerHTML=rows.length?rows.map(({exam,grade})=>{const sc=scoreFor(exam,grade),isReleased=released(grade);return '<tr><td><strong>'+esc(val(exam.title,exam.exam_name,exam.name,'Assessment'))+'</strong><br>'+esc(val(exam.course_name,exam.unit_name,''))+'</td><td>'+esc(val(exam.exam_type,'—'))+'</td><td>'+ (isReleased&&sc?esc(sc.score+' / '+sc.total):'—')+'</td><td><span class="status '+(isReleased?'released':'upcoming')+'">'+esc(resultStatus(grade))+'</span></td><td>'+esc(fmtDate(val(grade.graded_at,grade.updated_at,grade.created_at)))+'</td></tr>'}).join(''):'<tr><td colspan="5" class="empty-cell">No examination attempts have been recorded yet.</td></tr>';
 const releasedRows=rows.filter(x=>released(x.grade)).length;
 $('results-summary').innerHTML='<span class="summary-chip">Attempts recorded <b>'+rows.length+'</b></span><span class="summary-chip">Results released <b>'+releasedRows+'</b></span><span class="summary-chip">Awaiting review <b>'+(rows.length-releasedRows)+'</b></span>';
 const marks=state.publishedMarks;
 $('marks-body').innerHTML=marks.length?marks.map(m=>'<tr><td><strong>'+esc(val(m.unit_code,m.course_code,m.subject_code,'—'))+'</strong></td><td>'+esc(val(m.subject_name,m.unit_name,m.course_name,'—'))+'</td><td>'+esc(val(m.marks,m.score,m.total_marks,'—'))+'</td><td>'+esc(val(m.grade,m.letter_grade,'—'))+'</td><td><span class="status released">Published · approved</span></td></tr>').join(''):'<tr><td colspan="5" class="empty-cell">No published academic marks are currently available.</td></tr>';
}
function setTab(tab){state.tab=tab;document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));$('exam-filters').hidden=tab!=='exams';$('exam-panel').hidden=tab!=='exams';$('results-panel').hidden=tab!=='results';if(tab==='results')renderResults()}
async function loadAll(){
 const client=state.client;const p=state.profile;const user=state.user;
 $('exam-panel').innerHTML='<div class="loading-state"><span class="spinner"></span><p>Refreshing your assessments…</p></div>';
 const [examsRes,gradesRes,releasedRes]=await Promise.all([
  client.from('exams').select('*, course:course_id(course_name)').order('exam_date',{ascending:true}),
  client.from('exam_grades').select('*').eq('student_id',user.id).eq('question_id',ZERO_QUESTION),
  client.from('released_exam_results').select('result_id'),
  ]);
 if(examsRes.error)throw examsRes.error;
 state.grades=gradesRes.error?[]:(gradesRes.data||[]);
 const attemptedExamIds=new Set(state.grades.map(g=>String(g.exam_id)));
 state.exams=(examsRes.data||[]).filter(e=>(e.exam_link||e.online_link)&&(eligible(e,p)||attemptedExamIds.has(String(e.id))));
 state.released=new Set((releasedRes.data||[]).map(r=>String(r.result_id)));
 const admission=String(val(p.admission_number,p.student_id,'')).trim();
 let marks=[];
 if(admission){const res=await client.from('student_marks').select('*').eq('admission_number',admission).eq('published',true).eq('approval_status','approved').order('published_at',{ascending:false});if(!res.error)marks=res.data||[]}
 if(!marks.length){const res=await client.from('student_marks').select('*').eq('student_id',user.id).eq('published',true).eq('approval_status','approved').order('published_at',{ascending:false});if(!res.error)marks=res.data||[]}
 state.publishedMarks=marks.filter(m=>m.published===true&&norm(m.approval_status)==='approved');
 renderExams();if(state.tab==='results')renderResults();
}
async function startExam(id){
 const exam=state.exams.find(e=>String(e.id)===String(id));if(!exam)return;
 if(gradeFor(exam)){toast('An attempt is already recorded for this assessment.');return}
 const url=val(exam.exam_link,exam.online_link);if(!url){toast('The examination link has not been configured.');return}
 const target=new URL(url,location.origin);target.searchParams.set('user_id',state.user.id);target.searchParams.set('exam_id',id);
 $('modal-exam-title').textContent=val(exam.title,exam.exam_name,'Examination');
 $('exam-frame').src=target.href;$('exam-modal').classList.add('open');$('exam-modal').setAttribute('aria-hidden','false');document.body.classList.add('modal-open');
}
function closeExam(){const frame=$('exam-frame');if(frame.src&&frame.src!=='about:blank'){if(!confirm('Close the examination window? The exam system may automatically submit an active attempt when its window is closed.'))return;frame.src='about:blank'}$('exam-modal').classList.remove('open');$('exam-modal').setAttribute('aria-hidden','true');document.body.classList.remove('modal-open')}
async function init(){
 const client=getClient();if(!client)throw new Error('Student database connection could not be initialized. Please refresh.');
 state.client=client;
 const {data:sessionData,error:sessionError}=await client.auth.getSession();
 const session=sessionData?.session;if(sessionError||!session?.user){const back=location.pathname+location.search+location.hash;location.replace('/login.html?redirect='+encodeURIComponent(back));return}
 state.user=session.user;
 const {data:profile,error}=await client.from('consolidated_user_profiles_table').select('*').eq('user_id',session.user.id).maybeSingle();
 if(error)throw error;state.profile=profile;
 const role=norm(profile?.role),status=norm(profile?.status);
 if(role!=='student'||!['approved','active'].includes(status)||profile?.login_enabled===false||!profile?.institution_id){location.replace('/login.html?redirect='+encodeURIComponent(location.pathname));return}
 const name=val(profile.full_name,profile.name,profile.student_name,session.user.user_metadata?.full_name,session.user.email,'Student');
 $('welcome-name').textContent=name;$('side-name').textContent=name;$('avatar').textContent=name.split(/\\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
 $('side-admission').textContent=val(profile.admission_number,profile.student_id,'Student account');
 $('student-meta').textContent=[val(profile.program,profile.program_name,'Programme not assigned'),getBlock(profile)!=='General'?getBlock(profile):'',val(profile.intake_year,profile.intake,'')].filter(Boolean).join(' • ');
 await loadAll();
}
document.addEventListener('click',e=>{const start=e.target.closest('[data-start]'),result=e.target.closest('[data-result]'),tab=e.target.closest('[data-tab]');if(start)startExam(start.dataset.start);if(result){setTab('results')}if(tab)setTab(tab.dataset.tab)});
$('refresh-btn').addEventListener('click',()=>loadAll().catch(e=>toast(e.message||'Could not refresh assessments.')));
$('search-input').addEventListener('input',renderExams);$('status-filter').addEventListener('change',renderExams);
$('close-exam').addEventListener('click',closeExam);
$('logout-btn').addEventListener('click',async()=>{await state.client?.auth.signOut();location.replace('/login.html')});
window.addEventListener('message',event=>{if(event.data?.type==='exam_completed'||event.data?.event==='exam_completed'){toast('Your submission was received. Refreshing your examination status…');setTimeout(()=>{closeExam();loadAll().catch(()=>{})},1200)}});
document.addEventListener('DOMContentLoaded',()=>init().catch(error=>{$('exam-panel').innerHTML='<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>'+esc(error.message||'Unable to load your student examination dashboard.')+'</p><button class="secondary-btn" onclick="location.reload()">Try again</button></div>'}));
})();