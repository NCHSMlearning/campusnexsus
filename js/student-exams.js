 (function(){
'use strict';
const state={client:null,user:null,profile:null,exams:[],announcements:[],history:[],examResults:{},resultRealtimeChannel:null,dashboardStats:null,marks:[],supportTickets:[],academicSummary:null};
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const val=(...xs)=>xs.find(x=>x!==undefined&&x!==null&&String(x).trim()!=='');
const norm=v=>String(v??'').trim().toLowerCase();
// Reuse the persistent Supabase client, never the CDN namespace.
const client=()=>[window.examSupabase,window.sb,window.supabaseClient,window.db?.supabase].find(c=>c&&typeof c.from==='function'&&typeof c.auth?.getSession==='function')||null;
function activateModule(id,updateHash=true){
 const allowed=['dashboard','examinations','timetable','announcements','exam-history','exam-support','profile'];
 const active=allowed.includes(id)?id:'examinations';
 document.querySelectorAll('.module-view').forEach(section=>{const on=section.id===active;section.classList.toggle('active',on);section.hidden=!on;});
document.querySelectorAll('.exam-nav a[data-module]').forEach(link=>{const on=link.dataset.module===active;link.classList.toggle('active',on);if(on)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
 const labels={dashboard:'Student Dashboard',examinations:'Examination Centre',timetable:'Examination Timetable',announcements:'Institution Announcements','exam-history':'Examination History','exam-support':'Examination Support',profile:'My Student Profile'};
 const heading=document.querySelector('.header-left>div>b');if(heading)heading.textContent=labels[active];
 const hero=document.querySelector('.hero');if(hero)hero.hidden=true;
 if(updateHash&&location.hash!=='#'+active)history.replaceState(null,'','#'+active);
 window.scrollTo({top:0,behavior:'smooth'});
}
function renderStudentProfile(){
 const p=state.profile||{},user=state.user||{};
 const fullName=val(p.full_name,p.name,p.student_name,user.user_metadata?.full_name,user.email,'Student');
 const pairs=[['Full name',fullName],['Email address',user.email],['Admission number',val(p.admission_number,p.student_id)],['Student ID',p.student_id],['Programme',val(p.program,p.program_name,p.program_type)],['Programme type',p.program_type],['Intake year',val(p.intake_year,p.intake,p.admission_year)],['Intake month',p.intake_month],['Current block / term',val(p.current_block,p.block_term,p.block,p.term)],['Year of study',p.year_of_study],['Phone number',val(p.phone_number,p.phone,p.mobile_number)],['Date of birth',val(p.date_of_birth,p.dob)],['Gender',p.gender],['Account status',p.status],['Login enabled',p.login_enabled===true?'Enabled':p.login_enabled===false?'Disabled':null]].filter(x=>x[1]!==undefined&&x[1]!==null&&String(x[1]).trim()!=='');
 const initials=fullName.split(/\\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
 const set=(id,v)=>{const el=$(id);if(el)el.textContent=String(v??'');};
 set('profile-avatar',initials||'ST');set('profile-full-name',fullName);set('profile-subtitle',[val(p.admission_number,p.student_id,'Student account'),val(p.program,p.program_name,'Programme not assigned')].filter(Boolean).join(' · '));set('profile-status',val(p.status,'Account active'));
 const content=$('student-profile-content');if(content)content.innerHTML='<div class="student-profile-grid">'+pairs.map(([label,value])=>'<article class="student-profile-field"><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong></article>').join('')+'</div>';
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
function parseKenyaDateTime(value){
 if(!value)return null;
 let raw=String(value).trim();
 // A timestamp without an offset represents Kenya local time, not browser-local time.
 if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(raw))raw+='+03:00';
 const parsed=new Date(raw);return Number.isNaN(parsed.getTime())?null:parsed;
}
function startsAt(exam){
 // The admin form's date + time fields are the canonical schedule entered
 // in Kenya time. Prefer them over legacy start_time values that may have
 // been converted to UTC before being stored in a timestamp-without-zone column.
 const date=val(exam.exam_date,exam.start_date);
 const time=val(exam.exam_start_time);
 if(date&&time){
  const localTime=String(time).slice(0,5);
  const fromAdmin=parseKenyaDateTime(String(date).slice(0,10)+'T'+localTime+':00+03:00');
  if(fromAdmin)return fromAdmin;
 }
 const primary=val(exam.start_time,exam.scheduled_at);
 if(primary){const parsed=parseKenyaDateTime(primary);if(parsed)return parsed;}
 return null;
}
function examState(exam){
 const status=norm(exam.status);
 if(['closed','expired','completed','cancelled'].includes(status))return 'closed';
 const start=startsAt(exam),duration=Number(exam.duration_minutes)||40;
 const now=Date.now();
 // Duration is authoritative for the student countdown/window. Older end_time
 // values may be UTC-naive database timestamps and can differ by three hours.
 if(start){const end=start.getTime()+duration*60000;if(now<start.getTime())return 'upcoming';if(now<=end)return 'open';return 'closed'}
 if(['upcoming','scheduled','pending'].includes(status))return 'upcoming';
 if(['published','active','open','available'].includes(status))return 'open';
 return 'open';
}
// Build the same launch URL contract used by the legacy NCHSM examination portal.
 // The URL stored by the lecturer/admin remains the destination; the exam and
 // signed-in student identifiers are appended without replacing existing query parameters.
 // exam.js independently verifies Supabase Auth and never trusts user_id for identity.
function onlineHref(exam){
 const raw=val(exam.exam_link,exam.online_link,'');
 if(!raw||!exam?.id)return '';
 try{
  const url=new URL(raw,location.origin);
  if(!['http:','https:'].includes(url.protocol))return '';
  url.searchParams.set('exam_id',String(exam.id));
  if(state.user?.id)url.searchParams.set('user_id',String(state.user.id));
  // A retake URL is emitted only while the database sentinel holds a
  // single-use administrator authorization for this student and exam.
  const authorization=state.examResults[String(exam.id)]?.summary||{};
  const authorized=authorization.result_status==='RESET_FOR_RETAKE'&&authorization.allow_retake===true&&authorization.retake_unlocked===true;
  if(authorized)url.searchParams.set('retake','true');else url.searchParams.delete('retake');
  return url.href;
 }catch(_){return ''}
}
function dateLabel(exam){const d=startsAt(exam);return d?d.toLocaleString('en-KE',{timeZone:'Africa/Nairobi',dateStyle:'medium',timeStyle:'short'})+' Kenya time (UTC+3)':'Schedule to be confirmed'}
let examCountdownTicker=null;
function countdownText(target){
 const left=Math.max(0,Number(target)-Date.now());
 const days=Math.floor(left/86400000),hours=Math.floor(left%86400000/3600000),minutes=Math.floor(left%3600000/60000),seconds=Math.floor(left%60000/1000);
 return days>0?days+'d '+hours+'h '+minutes+'m':hours>0?hours+'h '+minutes+'m '+seconds+'s':minutes+'m '+seconds+'s';
}
function startExamCountdownTicker(){
 if(examCountdownTicker)return;
 examCountdownTicker=setInterval(()=>{
  let becameAvailable=false;
  document.querySelectorAll('.exam-countdown[data-start]').forEach(node=>{
   const target=Number(node.dataset.start);
   if(!Number.isFinite(target))return;
   if(target<=Date.now()){node.textContent='Scheduled start reached';becameAvailable=true;}
   else node.textContent=countdownText(target);
  });
  if(becameAvailable)render();
 },1000);
}
function renderDailyWelcome(){
 const now=new Date(),hour=Number(new Intl.DateTimeFormat('en-KE',{timeZone:'Africa/Nairobi',hour:'2-digit',hourCycle:'h23'}).format(now));
 const greeting=hour>=5&&hour<12?'Good morning':hour>=12&&hour<17?'Good afternoon':hour>=17&&hour<21?'Good evening':'Good night';
 const day=new Intl.DateTimeFormat('en-KE',{timeZone:'Africa/Nairobi',weekday:'long'}).format(now);
 const quotes={
  Monday:'Start where you are. Use what you have. Do what you can.',
  Tuesday:'Progress is built one focused step at a time.',
  Wednesday:'Stay curious, keep practising, and trust your preparation.',
  Thursday:'Consistency turns effort into achievement.',
  Friday:'Finish the week proud of the work you have put in.',
  Saturday:'Make time to learn something that moves you forward.',
  Sunday:'Rest, reflect, and prepare for a stronger week ahead.'
 };
 const greetingNode=$('greeting-label'),quoteNode=$('daily-quote'),dateNode=$('today-date');
 if(greetingNode)greetingNode.textContent=greeting;
 if(quoteNode)quoteNode.textContent='“'+quotes[day]+'”';
 if(dateNode)dateNode.textContent=now.toLocaleDateString('en-KE',{timeZone:'Africa/Nairobi',weekday:'long',day:'numeric',month:'long',year:'numeric'});
 const icon=document.querySelector('.dashboard-welcome-icon i');
 if(icon)icon.className=hour>=5&&hour<17?'fa-solid fa-sun':hour<19?'fa-solid fa-cloud-sun':'fa-solid fa-moon';
}
async function loadAcademicSummary(){
 const panel=$('gpa-trend');
 if(panel)panel.innerHTML='<div class="loading-state"><span class="spinner"></span><p>Loading published academic results…</p></div>';
 const {data,error}=await state.client.from('student_marks')
  .select('id,subject_name,block,final_score,grade,points,program,academic_year,retake_score,retake_status,published,approval_status')
  .eq('student_id',state.user.id).eq('published',true).eq('approval_status','approved')
  .order('academic_year',{ascending:true});
 if(error)throw error;
 state.marks=data||[];
 const unitsResult=await state.client.from('units_catalog').select('unit_name,unit_code,credits,program,institution_id')
  .eq('institution_id',state.profile.institution_id);
 const units=unitsResult.error?[]:(unitsResult.data||[]);
 let catalogCreditMatches=0;
 const creditFor=m=>{
  const key=norm(m.subject_name);
  const match=units.find(u=>norm(u.unit_name)===key||norm(u.unit_code)===key);
  if(match&&Number(match.credits)>0){catalogCreditMatches++;return Number(match.credits);}
  return 1;
 };
 const rows=state.marks.filter(m=>m.points!==null&&m.points!==undefined&&m.final_score!==null&&m.final_score!==undefined&&Number.isFinite(Number(m.points))&&Number.isFinite(Number(m.final_score)));
 const enriched=rows.map(m=>({mark:m,credits:creditFor(m),score:Number(m.final_score),points:Number(m.points)}));
 const credits=enriched.reduce((s,x)=>s+x.credits,0),weighted=enriched.reduce((s,x)=>s+x.points*x.credits,0),scoreTotal=enriched.reduce((s,x)=>s+x.score,0);
 const gpa=credits?weighted/credits:null;
 state.academicSummary={credits,weighted,gpa,average:enriched.length?scoreTotal/enriched.length:null,units:enriched.length};
 const set=(id,v)=>{const n=$(id);if(n)n.textContent=v;};
 set('cumulative-gpa',gpa===null?'—':gpa.toFixed(2)+' / 4.00');
 set('gpa-units',String(enriched.length));
 set('gpa-average',enriched.length?(scoreTotal/enriched.length).toFixed(1)+'%':'—');
 set('gpa-points',credits?weighted.toFixed(2):'—');
 set('gpa-credit-note',enriched.length?(catalogCreditMatches===enriched.length?credits+' catalog credit units counted':'Unit-weighted · '+catalogCreditMatches+' of '+enriched.length+' units matched to credit values'):'No published results available yet');
 if(!enriched.length){if(panel)panel.innerHTML='<p class="chart-empty">Your cumulative GPA will appear here when your results are published and approved.</p>';return;}
 const groups=new Map();
 enriched.forEach(x=>{const label=String(val(x.mark.block,x.mark.academic_year,'Unspecified block'));const g=groups.get(label)||{weighted:0,credits:0};g.weighted+=x.points*x.credits;g.credits+=x.credits;groups.set(label,g);});
 const entries=[...groups.entries()];
 const max=4;
 if(panel)panel.innerHTML='<div class="gpa-bars">'+entries.map(([label,g])=>{const value=g.weighted/g.credits;return '<div class="gpa-bar-item"><div class="gpa-bar-value">'+value.toFixed(2)+'</div><div class="gpa-bar-track"><i style="height:'+Math.max(3,value/max*100)+'%"></i></div><small>'+esc(label)+'</small></div>';}).join('')+'</div><div class="chart-footnote">Weighted GPA · '+credits+' credits across '+enriched.length+' published units</div>';
}

let dashboardExamFilter='upcoming',dashboardCalendarOffset=0;
function examAttemptState(exam){
 const result=state.examResults[String(exam.id)]||{},attempt=result.attempt,summary=result.summary||{};
 const resetAuthorized=summary.result_status==='RESET_FOR_RETAKE'&&summary.allow_retake===true&&summary.retake_unlocked===true;
 if(resetAuthorized)return 'retake_authorized';
 const submitted=!!attempt?.submitted_at||['submitted','completed','graded','released','pending_review'].includes(norm(attempt?.status));
 if(!submitted)return examState(exam);
 const released=summary.is_released===true||summary.released===true||summary.published===true||['released','published'].includes(norm(summary.result_status));
 return released?'released':'pending_release';
}
function showStudentExamResult(examId){
 const exam=state.exams.find(e=>String(e.id)===String(examId)),result=state.examResults[String(examId)]||{},attempt=result.attempt,summary=result.summary||{};
 if(!attempt?.id||!(summary.is_released===true||summary.released===true||summary.published===true||['released','published'].includes(norm(summary.result_status)))){notify('Your result is not yet released by the administrator.');return;}
 let modal=document.getElementById('student-exam-result-modal');
 if(!modal){modal=document.createElement('div');modal.id='student-exam-result-modal';modal.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.68);display:flex;align-items:center;justify-content:center;padding:16px;';modal.innerHTML='<section style="background:#fff;width:min(100%,1000px);max-height:90vh;overflow:auto;border-radius:14px;padding:20px;"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;"><h2 id="student-result-title" style="margin:0;color:#0f172a;">Examination result</h2><button type="button" id="student-result-close" style="border:0;background:#e2e8f0;border-radius:8px;padding:9px 12px;cursor:pointer;">Close</button></div><div id="student-result-content" style="margin-top:16px;">Loading result details…</div></section>';document.body.appendChild(modal);modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();});modal.querySelector('#student-result-close').addEventListener('click',()=>modal.remove());}
 const content=modal.querySelector('#student-result-content'),title=modal.querySelector('#student-result-title');title.textContent=val(exam?.title,exam?.exam_name,'Examination')+' · Released result';content.textContent='Loading your detailed result…';
 (async()=>{try{
  const [questionsResult,answersResult]=await Promise.all([state.client.from('exam_questions').select('*').eq('exam_id',examId).order('question_number',{ascending:true}),state.client.from('exam_grades').select('*').eq('student_id',state.user.id).eq('exam_id',examId).eq('attempt_id',attempt.id).neq('question_id','00000000-0000-0000-0000-000000000000').order('updated_at',{ascending:false})]);
  if(questionsResult.error)throw questionsResult.error;if(answersResult.error)throw answersResult.error;
  const answerMap=new Map();(answersResult.data||[]).forEach(row=>{const k=String(row.question_id);if(!answerMap.has(k))answerMap.set(k,row);});
  const clean=x=>String(x??'').trim().toUpperCase().replace(/[()\s.\-_:]/g,'');
  const match=(v,l,t)=>!!clean(v)&&(clean(v)===clean(l)||clean(v)===clean(t)||clean(v)==='OPTION'+clean(l));
  const rows=(questionsResult.data||[]).map((q,i)=>{const row=answerMap.get(String(q.id))||{},selected=val(row.selected_answer,row.student_answer,row.answer,row.response,row.answer_text,row.selected_option,''),correct=val(q.correct_answer,q.answer_key,q.answer,''),options=[['A',q.option_a],['B',q.option_b],['C',q.option_c],['D',q.option_d],['E',q.option_e]].filter(x=>x[1]!=null&&String(x[1]).trim()!==''),selectedOption=options.find(([l,t])=>match(selected,l,t)),correctOption=options.find(([l,t])=>match(correct,l,t)),isAnswered=String(selected??'').trim()!=='',isCorrect=isAnswered&&options.length>0&&options.some(([l,t])=>match(selected,l,t)&&match(correct,l,t)),max=Number(q.marks??1)||1,marks=options.length?(isCorrect?max:0):Number(row.marks??row.marks_obtained??0);return {number:q.question_number??i+1,text:q.question_text||q.question||'',selected:selectedOption?selectedOption[0]+'. '+selectedOption[1]:selected,correct:correctOption?correctOption[0]+'. '+correctOption[1]:correct,isAnswered,isCorrect,marks,max,options};});
  const earned=rows.reduce((n,r)=>n+r.marks,0),possible=rows.reduce((n,r)=>n+r.max,0),allMcq=rows.length>0&&rows.every(r=>r.options.length>0),score=allMcq?earned:val(summary.total_score,summary.score,summary.marks,earned),total=allMcq?possible:val(summary.total_marks,possible);
  let html='<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;"><div style="background:#eff6ff;padding:14px;border-radius:10px;"><small>Final score</small><h2 style="margin:4px 0;">'+esc(score)+' / '+esc(total)+'</h2></div><div style="background:#f0fdf4;padding:14px;border-radius:10px;"><small>Percentage</small><h2 style="margin:4px 0;">'+esc((allMcq?(Number(total)?(Number(score)/Number(total)*100).toFixed(1):'0.0'):val(summary.percentage,(Number(total)?(Number(score)/Number(total)*100).toFixed(1):'0.0'))))+'%</h2></div><div style="background:#f8fafc;padding:14px;border-radius:10px;"><small>Correct answers</small><h2 style="margin:4px 0;">'+rows.filter(r=>r.isCorrect).length+' / '+rows.length+'</h2></div></div>';
  html+='<div style="overflow:auto;"><table style="width:100%;min-width:720px;border-collapse:collapse;font-size:14px;"><thead><tr style="background:#f1f5f9;"><th style="padding:10px;text-align:left;">Question</th><th style="padding:10px;text-align:left;">Your answer</th><th style="padding:10px;text-align:left;">Correct answer</th><th style="padding:10px;">Marks</th><th style="padding:10px;">Result</th></tr></thead><tbody>'+rows.map(r=>'<tr style="border-bottom:1px solid #e2e8f0;vertical-align:top;"><td style="padding:12px;"><b>Q'+esc(r.number)+'. '+esc(r.text)+'</b>'+r.options.map(([l,t])=>'<div style="color:#64748b;margin-top:3px;">'+l+'. '+esc(t)+'</div>').join('')+'</td><td style="padding:12px;">'+(r.isAnswered?esc(r.selected):'Not answered')+'</td><td style="padding:12px;">'+esc(r.correct||'—')+'</td><td style="padding:12px;text-align:center;">'+esc(r.marks)+' / '+esc(r.max)+'</td><td style="padding:12px;text-align:center;color:'+(r.isCorrect?'#15803d':'#b91c1c')+';font-weight:700;">'+(r.isCorrect?'Correct':r.isAnswered?'Incorrect':'Unanswered')+'</td></tr>').join('')+'</tbody></table></div>';content.innerHTML=html;
 }catch(error){content.innerHTML='<p style="color:#b91c1c;">Unable to load detailed result: '+esc(error.message||error)+'</p>';}})();
}
window.showStudentExamResult=showStudentExamResult;
function dashboardExamCard(exam,status){
 const title=val(exam.title,exam.exam_name,exam.name,'Examination'),unit=val(exam.course_name,exam.unit_name,exam.subject_name,exam.course?.course_name,'General assessment'),link=onlineHref(exam),start=startsAt(exam),isOnline=!!link;
 const badge=status==='open'?'open':status==='upcoming'?'upcoming':'completed',label=status==='pending_release'?'Completed · Pending admin release':status==='released'?'Result released':status==='open'?'Available now':status==='upcoming'?'Upcoming':'Closed';
 const action=status==='retake_authorized'?'<a class="dashboard-exam-action online-action" href="'+esc(link)+'" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-rotate-right"></i> Start authorized retake</a>':status==='pending_release'?'<div class="dashboard-exam-closed"><i class="fa-solid fa-hourglass-half"></i><span><b>Exam submitted</b><small>Pending admin release. Your score is not yet available.</small></span></div>':status==='released'?'<button type="button" class="dashboard-exam-action online-action" onclick="showStudentExamResult('+Number(exam.id)+')"><i class="fa-solid fa-square-poll-vertical"></i> View score &amp; answers</button>':isOnline&&status==='open'?'<a class="dashboard-exam-action online-action" href="'+esc(link)+'" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-circle-play"></i> Enter Online Exam</a>':isOnline&&status==='upcoming'?'<button class="dashboard-exam-action locked-action" disabled><i class="fa-solid fa-lock"></i> Opens at '+esc(start?start.toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit',timeZone:'Africa/Nairobi'}):'scheduled time')+'</button>':status==='closed'?'<div class="dashboard-exam-closed"><i class="fa-solid fa-circle-check"></i><span><b>Examination closed</b><small>This examination is no longer available.</small></span></div>':'';
 const countdown=status==='upcoming'&&start?'<div class="dashboard-countdown"><span>Starts in:</span><div class="countdown-units"><b class="exam-countdown" data-start="'+start.getTime()+'">'+countdownText(start.getTime())+'</b></div></div>':'';
 const mode=isOnline?'<span class="exam-type-chip chip-online"><i class="fa-solid fa-shield-halved"></i> Online Exam</span>':'<span class="exam-type-chip chip-physical"><i class="fa-solid fa-clipboard-check"></i> Physical Exam</span>';
 return '<article class="dashboard-exam-card '+(isOnline?'online-card':'physical-card')+' '+(status==='upcoming'?'is-upcoming':'')+'"><div class="dashboard-exam-illustration"><i class="'+(isOnline?'fa-solid fa-laptop':'fa-solid fa-building-columns')+'"></i></div><div class="dashboard-exam-main"><div class="dashboard-exam-heading"><h3>'+esc(title)+'</h3>'+mode+'<span class="status '+badge+'">'+label+'</span></div><p class="dashboard-exam-unit">'+esc(unit)+'</p><div class="dashboard-exam-meta"><span><i class="fa-regular fa-calendar"></i>'+esc(dateLabel(exam))+'</span><span><i class="fa-regular fa-clock"></i>'+esc(start?start.toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit',timeZone:'Africa/Nairobi'}):'Time TBA')+' Kenya time (UTC+3)</span><span><i class="fa-regular fa-hourglass-half"></i> '+esc((Number(exam.duration_minutes)||40)+' minutes')+'</span><span><i class="fa-solid fa-layer-group"></i> '+esc(val(exam.block_term,exam.block,exam.term,'All blocks'))+'</span></div>'+countdown+action+'</div></article>';
}
function renderDashboardCalendar(){
 const host=$('dashboard-calendar');if(!host)return;
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Nairobi',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).reduce((out,p)=>{if(p.type!=='literal')out[p.type]=p.value;return out;},{});
 const currentYear=Number(parts.year),currentMonth=Number(parts.month)-1,todayDay=Number(parts.day);
 const base=new Date(Date.UTC(currentYear,currentMonth+dashboardCalendarOffset,1,12));
 const year=base.getUTCFullYear(),month=base.getUTCMonth();
 $('calendar-month-label').textContent=new Intl.DateTimeFormat('en-KE',{timeZone:'Africa/Nairobi',month:'long',year:'numeric'}).format(base);
 const firstDay=new Date(Date.UTC(year,month,1)).getUTCDay(),daysInMonth=new Date(Date.UTC(year,month+1,0)).getUTCDate(),events={};
 state.exams.forEach(exam=>{const start=startsAt(exam);if(!start)return;const localParts=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Nairobi',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(start).reduce((out,p)=>{if(p.type!=='literal')out[p.type]=p.value;return out;},{});const key=Number(localParts.year)+'-'+(Number(localParts.month)-1)+'-'+Number(localParts.day),status=examState(exam);events[key]=status==='closed'?'completed':status;});
 let cells='<div class="calendar-weekdays">'+['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x=>'<span>'+x+'</span>').join('')+'</div><div class="calendar-days">';
 const offset=(firstDay+6)%7;for(let i=0;i<offset;i++)cells+='<span class="calendar-day empty"></span>';
 for(let d=1;d<=daysInMonth;d++){const status=events[year+'-'+month+'-'+d]||'',isToday=d===todayDay&&month===currentMonth&&year===currentYear;cells+='<span class="calendar-day '+(status?'has-'+status:'')+(isToday?' is-today':'')+'">'+d+'</span>';}
 const total=offset+daysInMonth;for(let i=total;i%7!==0;i++)cells+='<span class="calendar-day empty"></span>';
 host.innerHTML=cells+'</div>';
}
function renderDashboard(){
 const counts={upcoming:0,open:0,closed:0,pending_release:0,released:0,retake_authorized:0};state.exams.forEach(e=>{const s=examAttemptState(e);if(counts[s]!==undefined)counts[s]++;else if(s==='closed')counts.closed++;});
 const stats=state.dashboardStats||{},completed=state.history.filter(a=>!!a.submitted_at||['submitted','completed','graded','released'].includes(norm(a.status))).length,totalCount=Math.max(Number(stats.total||0),state.exams.length);
 const upcoming=counts.upcoming,open=counts.open,closed=counts.closed+counts.pending_release+counts.released;
 $('stat-total').textContent=totalCount;$('stat-upcoming').textContent=upcoming;$('stat-open').textContent=open;$('stat-completed').textContent=completed;
 $('tab-upcoming-count').textContent=counts.upcoming;$('tab-open-count').textContent=counts.open;$('tab-closed-count').textContent=counts.closed+counts.pending_release+counts.released;$('tab-all-count').textContent=state.exams.length;
 document.querySelectorAll('[data-exam-filter]').forEach(b=>b.classList.toggle('active',b.dataset.examFilter===dashboardExamFilter));
 const filtered=state.exams.map(exam=>({exam,status:examAttemptState(exam)})).filter(x=>dashboardExamFilter==='all'||(dashboardExamFilter==='closed'?['closed','pending_release','released','retake_authorized'].includes(x.status):x.status===dashboardExamFilter)).sort((a,b)=>(startsAt(a.exam)?.getTime()||0)-(startsAt(b.exam)?.getTime()||0));
 $('dashboard-exams').innerHTML=filtered.length?filtered.map(x=>dashboardExamCard(x.exam,x.status)).join(''):'<div class="dashboard-empty"><i class="fa-regular fa-calendar-xmark"></i><b>No examinations in this category</b><span>Try another examination tab or check back later.</span></div>';
 const total=Math.max(totalCount,1),done=closed,percent=Math.round(done/total*100);
 $('status-chart').innerHTML='<div class="progress-donut" style="--progress:'+percent+'%"><div><b>'+percent+'%</b><small>Completed</small></div></div><div class="progress-legend"><span><i class="legend-dot done"></i>Completed <b>'+done+' ('+Math.round(done/total*100)+'%)</b></span><span><i class="legend-dot waiting"></i>Upcoming <b>'+upcoming+' ('+Math.round(upcoming/total*100)+'%)</b></span><span><i class="legend-dot ready"></i>Available Now <b>'+open+' ('+Math.round(open/total*100)+'%)</b></span></div>';
 const activity=[...state.history].sort((a,b)=>new Date(b.submitted_at||b.started_at||0)-new Date(a.submitted_at||a.started_at||0)).slice(0,4);
 $('activity-chart').innerHTML=activity.length?'<div class="dashboard-activity-list">'+activity.map(a=>{const submitted=!!a.submitted_at,exam=state.exams.find(x=>String(x.id)===String(a.exam_id)),title=val(a.exam_title,a.title,exam?.title,exam?.exam_name,'Examination'),when=a.submitted_at||a.started_at;return '<div class="dashboard-activity-row"><span class="activity-icon '+(submitted?'submitted':'scheduled')+'"><i class="'+(submitted?'fa-solid fa-check':'fa-regular fa-calendar-check')+'"></i></span><span class="activity-copy"><b>'+esc(title)+(submitted?' – Attempt submitted':' – Attempt started')+'</b><small>'+esc(when?new Date(when).toLocaleString('en-KE',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Africa/Nairobi'}):'Recent activity')+' Kenya time (UTC+3)</small></span></div>';}).join('')+'</div>':'<div class="dashboard-empty compact"><i class="fa-solid fa-clock-rotate-left"></i><b>No recent activity yet</b><span>Your submitted examination attempts will appear here.</span></div>';
 renderDashboardCalendar();
}
function render(){
 const q=norm($('search-input').value),filter=$('status-filter').value;
 const rows=state.exams.map(exam=>({exam,status:examState(exam)})).filter(x=>(filter==='all'||filter===x.status)&&(!q||norm([x.exam.title,x.exam.exam_name,x.exam.course_name,x.exam.unit_name,x.exam.exam_type].join(' ')).includes(q)));
 renderDashboard();
 if(!rows.length){$('exam-panel').innerHTML='<div class="empty-state"><i class="fa-regular fa-calendar-xmark"></i><p>'+(state.exams.length?'No examinations match this filter.':'No approved and published examinations have been assigned to your programme, intake and block yet.')+'</p></div>';return}
 $('exam-panel').innerHTML='<div class="exam-grid">'+rows.map(({exam,status})=>{
  const title=val(exam.title,exam.exam_name,exam.name,'Examination');
  const unit=val(exam.course_name,exam.unit_name,exam.subject_name,exam.course?.course_name,'General assessment');
  const link=onlineHref(exam),start=startsAt(exam),isOnline=!!link;
  const badge=status==='open'?'open':status==='upcoming'?'upcoming':'completed';
  const label=status==='retake_authorized'?'Admin-authorized retake':status==='pending_release'?'Completed · Pending admin release':status==='released'?'Result released':status==='open'?'Available now':status==='upcoming'?'Upcoming':'Closed';
  const countdown=status==='upcoming'&&start?'<div class="exam-countdown-panel"><span class="countdown-label"><i class="fa-regular fa-clock"></i> Starts in</span><strong class="exam-countdown" data-start="'+start.getTime()+'">'+countdownText(start.getTime())+'</strong></div>':'';
  const action=status==='retake_authorized'?'<a class="dashboard-exam-action online-action" href="'+esc(link)+'" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-rotate-right"></i> Start authorized retake</a>':status==='pending_release'?'<span class="exam-closed-note"><i class="fa-solid fa-hourglass-half"></i> Submitted · Pending admin release</span>':status==='released'?'<button type="button" class="primary-btn" onclick="showStudentExamResult('+Number(exam.id)+')"><i class="fa-solid fa-square-poll-vertical"></i> View score &amp; detailed answers</button>':isOnline&&status==='open'?'<a class="primary-btn" href="'+esc(link)+'" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-laptop"></i> Enter Online Exam <i class="fa-solid fa-arrow-up-right-from-square"></i></a>':isOnline&&status==='upcoming'?'<button class="secondary-btn online-pending" disabled><i class="fa-solid fa-lock"></i> Online exam · Not open yet</button>':status==='closed'?'<span class="exam-closed-note"><i class="fa-solid fa-circle-check"></i> Examination closed</span>':'';
  const mode=isOnline?'<span class="exam-mode online"><i class="fa-solid fa-wifi"></i> Online examination</span>':'<span class="exam-mode venue"><i class="fa-solid fa-building-columns"></i> Scheduled examination</span>';
  return '<article class="exam-card '+(status==='upcoming'?'is-upcoming':'')+'"><div class="exam-card-top"><div class="exam-title-wrap"><div class="exam-card-kicker">ASSESSMENT</div><h3>'+esc(title)+'</h3><div class="exam-unit">'+esc(unit)+'</div></div><span class="status '+badge+'">'+label+'</span></div><div class="exam-mode-row">'+mode+'</div><div class="exam-meta"><span><i class="fa-regular fa-calendar"></i>'+esc(dateLabel(exam))+'</span><span><i class="fa-solid fa-layer-group"></i>'+esc(val(exam.exam_type,'Examination'))+'</span><span><i class="fa-regular fa-hourglass-half"></i>'+esc((Number(exam.duration_minutes)||40)+' minutes')+'</span></div>'+countdown+'<div class="exam-actions"><span class="exam-date">'+esc(val(exam.block_term,exam.block,exam.term,'All blocks'))+' · '+esc(val(exam.intake_year,'All intakes'))+'</span>'+action+'</div></article>';
 }).join('')+'</div>';
 startExamCountdownTicker();
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
  const examIds=state.exams.map(e=>e.id);state.examResults={};
  if(examIds.length){
   const [attemptsResult,summaryResult,releasedResult]=await Promise.all([
    state.client.from('exam_attempts').select('id,exam_id,attempt_number,status,started_at,submitted_at,updated_at').eq('student_id',state.user.id).in('exam_id',examIds).order('attempt_number',{ascending:false}),
    state.client.from('exam_grades').select('id,exam_id,attempt_id,marks,total_score,score,total_marks,percentage,result_status,released,published,allow_retake,retake_unlocked,released_at,published_at,updated_at,question_id').eq('student_id',state.user.id).in('exam_id',examIds).eq('question_id','00000000-0000-0000-0000-000000000000').order('updated_at',{ascending:false}),
    state.client.from('released_exam_results').select('result_id,exam_id,released_at').eq('student_id',String(state.user.id)).in('exam_id',examIds)
   ]);
   if(attemptsResult.error)console.warn('Student exam attempt status lookup:',attemptsResult.error.message);
   if(summaryResult.error)console.warn('Student exam release status lookup:',summaryResult.error.message);
   if(releasedResult.error)console.warn('Student released-result lookup:',releasedResult.error.message);
   const releasedIds=new Set((releasedResult.data||[]).map(r=>String(r.result_id)));
   state.history=attemptsResult.data||[];const latestAttempts={},latestSummaries={};
   (summaryResult.data||[]).forEach(g=>{if(releasedIds.has(String(g.id)))g.is_released=true;const k=String(g.exam_id);if(!latestSummaries[k]||new Date(g.updated_at||0)>new Date(latestSummaries[k].updated_at||0))latestSummaries[k]=g;});
   state.history.forEach(a=>{const k=String(a.exam_id);if(!latestAttempts[k]||Number(a.attempt_number||1)>Number(latestAttempts[k].attempt_number||1))latestAttempts[k]=a;});
   Object.keys(latestAttempts).forEach(k=>{state.examResults[k]={attempt:latestAttempts[k],summary:latestSummaries[k]||null};});
   Object.keys(latestSummaries).forEach(k=>{if(!state.examResults[k])state.examResults[k]={attempt:null,summary:latestSummaries[k]};});
  }else{state.history=[];}
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

async function loadSupportTickets(){
 const panel=$('support-ticket-list');if(!panel)return;
 panel.innerHTML='<div class="loading-state"><span class="spinner"></span><p>Loading your support requests…</p></div>';
 const {data,error}=await state.client.from('support_tickets')
  .select('id,ticket_number,subject,category,status,priority,created_at,updated_at,resolution_notes')
  .eq('student_id',state.user.id).order('created_at',{ascending:false}).limit(30);
 if(error)throw error;
 state.supportTickets=data||[];
 if(!state.supportTickets.length){panel.innerHTML='<div class="empty-state"><i class="fa-regular fa-life-ring"></i><p>You have not submitted any support tickets yet.</p></div>';return;}
 panel.innerHTML='<div class="ticket-table-wrap"><table class="ticket-table"><thead><tr><th>Ticket</th><th>Issue</th><th>Date submitted</th><th>Status</th></tr></thead><tbody>'+state.supportTickets.map(t=>'<tr><td><b>'+esc(t.ticket_number||'—')+'</b></td><td><strong>'+esc(t.subject)+'</strong><small>'+esc(t.category||'General support')+(t.resolution_notes?' · '+esc(t.resolution_notes):'')+'</small></td><td>'+esc(t.created_at?new Date(t.created_at).toLocaleDateString('en-KE',{timeZone:'Africa/Nairobi'}):'—')+'</td><td><span class="ticket-status '+esc(norm(t.status).replace(/[^a-z0-9_-]/g,''))+'">'+esc(t.status||'Open')+'</span></td></tr>').join('')+'</tbody></table></div>';
}
async function submitSupport(event){
 event.preventDefault();const btn=$('support-submit'),feedback=$('support-feedback');btn.disabled=true;feedback.textContent='Submitting your request…';
 try{const {data,error}=await state.client.rpc('submit_student_exam_support_ticket',{p_subject:$('support-subject').value.trim(),p_description:$('support-description').value.trim(),p_category:$('support-category').value});
 if(error)throw error;const ticket=Array.isArray(data)?data[0]?.ticket_number:data?.ticket_number;feedback.textContent='Your request was submitted. Ticket reference: '+(ticket||'created');$('exam-support-form').reset();await loadSupportTickets();notify('Support request submitted successfully.');}
 catch(e){feedback.textContent=e.message||'Could not submit your request. Please try again.';}
 finally{btn.disabled=false;}
}
function subscribeStudentResultUpdates(){
 if(!state.client||!state.user?.id||state.resultRealtimeChannel)return;
 const studentId=String(state.user.id);
 state.resultRealtimeChannel=state.client.channel('student-exam-results-'+studentId)
  .on('postgres_changes',{event:'*',schema:'public',table:'released_exam_results',filter:'student_id=eq.'+studentId},async()=>{
   await loadExams().catch(e=>console.warn('Could not refresh released exam status:',e));
   await loadAcademicSummary().catch(e=>console.warn('Could not refresh published GPA metrics:',e));
   renderTimetable();renderDashboard();
  })
  .on('postgres_changes',{event:'*',schema:'public',table:'student_marks',filter:'student_id=eq.'+studentId},()=>{
   loadAcademicSummary().catch(e=>console.warn('Could not refresh academic metrics:',e));
  })
  .subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')console.warn('Student result live updates are temporarily unavailable:',status);});
}
async function init(){
 // Use the already-persisted Supabase client directly. Do not run the
 // legacy database bootstrap here; it can delay page startup unnecessarily.
 state.client=client();
 if(!state.client)throw new Error(window.__EXAM_CONFIG_ERROR__||'Student database connection is unavailable. Please refresh this page.');
 const {data,error}=await state.client.auth.getSession();
 if(error)throw error;
 const session=data?.session;
 if(!session?.user){location.replace('/examlogin?redirect='+encodeURIComponent('/studentexam'));return}
 state.user=session.user;
 const profileResult=await state.client.from('consolidated_user_profiles_table').select('*').eq('user_id',session.user.id).maybeSingle();
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
 renderStudentProfile();
 renderDailyWelcome();
 await loadDashboardStats().catch(e=>{console.warn('Dashboard statistics RPC unavailable; using student-visible records.',e);});
 await loadAcademicSummary().catch(e=>{console.warn('Published academic summary unavailable:',e);const n=$('gpa-trend');if(n)n.innerHTML='<p class="chart-empty">Academic summary is temporarily unavailable.</p>';});
 await loadExams().catch(e=>{console.error('Student examination list failed:',e);$('exam-panel').innerHTML='<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>Examination list could not be loaded. Your dashboard statistics are shown where available.</p></div>';});
 subscribeStudentResultUpdates();
 renderTimetable();renderDashboard();
 loadAnnouncements().catch(e=>{$('announcements-panel').innerHTML='<div class="empty-state"><p>Announcements are temporarily unavailable.</p></div>';console.warn(e)});
 loadHistory().catch(e=>{$('history-panel').innerHTML='<div class="empty-state"><p>Examination history is temporarily unavailable.</p></div>';console.warn(e)});
 loadSupportTickets().catch(e=>{const n=$('support-ticket-list');if(n)n.innerHTML='<div class="empty-state"><p>Your support tickets are temporarily unavailable.</p></div>';console.warn(e)});
}
document.querySelectorAll('.exam-nav a[data-module]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();activateModule(link.dataset.module);document.getElementById('exam-sidebar').classList.remove('show');document.getElementById('mobile-scrim').classList.remove('show');}));
window.addEventListener('hashchange',()=>activateModule(location.hash.slice(1),false));
activateModule(location.hash.slice(1)||'dashboard',false);
document.querySelectorAll('[data-exam-filter]').forEach(button=>button.addEventListener('click',()=>{dashboardExamFilter=button.dataset.examFilter;renderDashboard();}));
$('calendar-prev')?.addEventListener('click',()=>{dashboardCalendarOffset--;renderDashboardCalendar();});
$('calendar-next')?.addEventListener('click',()=>{dashboardCalendarOffset++;renderDashboardCalendar();});
document.querySelectorAll('[data-open-module]').forEach(button=>button.addEventListener('click',()=>activateModule(button.dataset.openModule)));

$('refresh-btn').addEventListener('click',()=>loadExams().then(renderTimetable).catch(e=>notify(e.message||'Could not refresh examinations.')));
$('refresh-announcements').addEventListener('click',()=>loadAnnouncements().catch(e=>notify(e.message||'Could not load announcements.')));
$('refresh-history').addEventListener('click',()=>loadHistory().catch(e=>notify(e.message||'Could not load examination history.')));
 $('refresh-tickets')?.addEventListener('click',()=>loadSupportTickets().catch(e=>notify(e.message||'Could not load support tickets.')));
 $('profile-refresh')?.addEventListener('click',async()=>{try{const {data,error}=await state.client.from('consolidated_user_profiles_table').select('*').eq('user_id',state.user.id).maybeSingle();if(error)throw error;if(!data)throw new Error('Your student profile record was not found.');state.profile={...state.profile,...data};renderStudentProfile();notify('Profile refreshed.');}catch(e){notify(e.message||'Could not refresh your profile.');}});
 $('profile-back')?.addEventListener('click',()=>activateModule('dashboard'));
$('exam-support-form').addEventListener('submit',submitSupport);
$('search-input').addEventListener('input',render);$('status-filter').addEventListener('change',render);
$('logout-btn').addEventListener('click',async()=>{const btn=$('logout-btn');if(btn)btn.disabled=true;try{if(state.client){const {error}=await state.client.auth.signOut({scope:'local'});if(error)console.warn('Exam portal sign-out warning:',error.message)}}finally{try{localStorage.removeItem('currentUserId');localStorage.removeItem('studentEmail')}catch(_){}location.replace('/examlogin')}});
document.addEventListener('DOMContentLoaded',()=>init().catch(e=>{$('exam-panel').innerHTML='<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>'+esc(e.message||'Unable to load your examinations.')+'</p><button class="secondary-btn" onclick="location.reload()">Try again</button></div>'}));
})();
