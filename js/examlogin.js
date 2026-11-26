(function(){
'use strict';
const $=id=>document.getElementById(id);
const form=$('examLoginForm'),email=$('email'),password=$('password'),schoolCode=$('schoolCode'),button=$('submitBtn'),loadButton=$('loadSchoolBtn'),message=$('message'),schoolStatus=$('schoolStatus');
let selectedInstitution=null;
const credentialsPanel=$('loginCredentialsPanel');
const schoolCodeField=$('schoolCodeField');
credentialsPanel.hidden=true;
form.style.display='block';
const show=(text,type='error')=>{message.textContent=text;message.className='message '+type};
const nextPath=(role)=>{
 const params=new URLSearchParams(location.search),p=params.get('redirect');
 if(role==='student'&&p&&p.startsWith('/')&&!p.startsWith('//')&&!p.includes('\\\\')){
  try{const target=new URL(p,location.origin);if(target.origin===location.origin&&['/studentexam','/studentexam.html','/exam.html','/exam','/exam/'].includes(target.pathname))return target.pathname+target.search;}catch(_){}
 }
 if(role==='student')return '/studentexam.html';
 if(['lecturer','instructor','teacher'].includes(role))return '/platform/lecturerexams.html';
 // One institution-admin examination workspace is served at /exams.
 return '/exams';
};
function clientReady(){const c=window.examSupabase;if(c&&typeof c.auth?.signInWithPassword==='function')return c;throw new Error(window.__EXAM_CONFIG_ERROR__||'The examination sign-in service is unavailable. Refresh and try again.')}
function initials(name){return String(name||'School').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'SC'}
function paintInstitution(institution){
 selectedInstitution=institution;
 const name=String(institution.name||'Your Institution');
 $('schoolName').textContent=name;
 $('schoolPortalLabel').textContent='Examination Portal';
 $('schoolCodeBadge').textContent='SCHOOL CODE: '+(institution.school_code||institution.short_code||schoolCode.value.trim().toUpperCase());
 $('schoolCodeBadge').hidden=false;
 const logo=$('schoolLogo');
 logo.replaceChildren();
 if(institution.logo_url&&/^https:\/\//i.test(institution.logo_url)){
  const img=document.createElement('img');img.src=institution.logo_url;img.alt=name+' logo';
  img.onerror=()=>{logo.textContent=initials(name)};logo.appendChild(img);
 }else{logo.textContent=initials(name)}
 const source=institution.brand_colors&&typeof institution.brand_colors==='object'?institution.brand_colors:[];
 const named=!Array.isArray(source)?source:{};
 const values=Array.isArray(source)?source:[named.primary,named.secondary,named.accent1||named.accent||named.gold||named.tertiary,named.accent2,named.accent3,named.accent4];
 const defaults=['#082f49','#0f766e','#d4a017','#2563eb','#7c3aed','#db2777'];
 const colors=defaults.map((fallback,index)=>{let value=index===0?(institution.primary_color||values[index]):index===1?(institution.secondary_color||values[index]):values[index];if(typeof value!=='string')return fallback;if(/^#[0-9a-f]{3}$/i.test(value))value='#'+value.slice(1).split('').map(ch=>ch+ch).join('');return /^#[0-9a-f]{6}$/i.test(value)?value:fallback;});
 colors.forEach((color,index)=>document.documentElement.style.setProperty('--cn-institution-color-'+(index+1),color));
 document.documentElement.style.setProperty('--navy',colors[0]);document.documentElement.style.setProperty('--teal',colors[1]);document.documentElement.style.setProperty('--gold',colors[2]);
 document.documentElement.style.setProperty('--cn-brand-primary',colors[0]);document.documentElement.style.setProperty('--cn-brand-secondary',colors[1]);document.documentElement.style.setProperty('--cn-brand-accent',colors[2]);document.documentElement.style.setProperty('--cn-brand-accent-2',colors[3]);document.documentElement.style.setProperty('--cn-brand-accent-3',colors[4]);document.documentElement.style.setProperty('--cn-brand-accent-4',colors[5]);
 let theme=document.getElementById('cn-exam-login-institution-theme');if(!theme){theme=document.createElement('style');theme.id='cn-exam-login-institution-theme';document.head.appendChild(theme);}
 theme.textContent=
  ':root{--navy:'+colors[0]+';--teal:'+colors[1]+';--gold:'+colors[2]+';--cn-login-primary:'+colors[0]+';--cn-login-secondary:'+colors[1]+';--cn-login-accent:'+colors[2]+'}'+
  '.exam-login-visual{background:linear-gradient(145deg,'+colors[0]+' 0%,'+colors[1]+' 58%,'+colors[0]+' 100%)!important}'+
  '.exam-visual-mark{background:'+colors[2]+'!important;color:'+colors[0]+'!important}'+
  '.exam-visual-kicker,.exam-visual-copy h2 em{color:'+colors[2]+'!important}'+
  '.exam-visual-features span{border-color:'+colors[3]+'88!important}'+
  '.brand-mark{background:linear-gradient(135deg,'+colors[1]+','+colors[0]+')!important;border-color:'+colors[2]+'!important;color:#fff!important}'+
  '.brand h1{color:'+colors[0]+'!important}.brand p{color:#52677b!important}'+
  '.brand .school-code{background:'+colors[1]+'18!important;color:'+colors[1]+'!important;border-color:'+colors[1]+'44!important}'+
  '.submit,#loadSchoolBtn{background:linear-gradient(135deg,'+colors[1]+','+colors[0]+')!important}'+
  '.card{border-top:4px solid '+colors[2]+'}.field input:focus{border-color:'+colors[2]+'!important;box-shadow:0 0 0 3px '+colors[2]+'22!important}.foot a{color:'+colors[3]+'!important}';
 document.title=name+' Examination Login';
 schoolStatus.textContent='Verified: '+name+'. Your institution is ready. Sign in below.';
 schoolStatus.style.color='#14745f';
 schoolCodeField.classList.add('is-verified');
 schoolCode.readOnly=true;
 loadButton.disabled=true;loadButton.textContent='School loaded';
 credentialsPanel.hidden=false;
 $('examLoginTitle').textContent='Welcome back';
 $('examLoginIntro').textContent='Sign in with your registered Campus Nexus account. You will be directed to the correct examination dashboard for your role.';
 email.focus();
}
async function loadSchool(){
 const code=schoolCode.value.trim().toUpperCase();
 selectedInstitution=null;
 if(!/^[A-Z0-9_-]{3,30}$/.test(code)){schoolStatus.textContent='Enter a valid school code (letters and numbers).';schoolStatus.style.color='#a52b2b';return}
 loadButton.disabled=true;loadButton.textContent='Connecting…';schoolStatus.textContent='Securely connecting to Campus Nexus…';schoolStatus.style.color='#718096';
 try{
  const client=clientReady();
  let result;
  // A transient mobile-network interruption should not immediately fail the
  // institution lookup. This RPC is read-only, so one bounded retry is safe.
  for(let attempt=0;attempt<2;attempt++){
   try{
    result=await client.rpc('lookup_exam_institution',{p_school_code:code});
    break;
   }catch(networkError){
    const message=String(networkError?.message||networkError||'');
    const isNetworkFailure=networkError instanceof TypeError || /failed to fetch|networkerror|load failed|fetch failed/i.test(message);
    if(!isNetworkFailure||attempt===1)throw networkError;
    schoolStatus.textContent='Connection interrupted. Retrying securely…';
    await new Promise(resolve=>setTimeout(resolve,850));
   }
  }
  if(result?.error)throw result.error;
  const rows=result?.data||[];
  if(!rows.length)throw new Error('No institution was found for that school code. Check the code and try again.');
  if(rows.length>1)throw new Error('This code matches more than one institution. Contact Campus Nexus support.');
  const institution=rows[0];
  if(String(institution.status||'').toLowerCase()==='suspended')throw new Error('This institution portal is currently suspended. Contact your institution administrator.');
  paintInstitution(institution);
 }catch(error){
  const detail=String(error?.message||error||'');
  const networkFailure=error instanceof TypeError || /failed to fetch|networkerror|load failed|fetch failed/i.test(detail);
  schoolStatus.textContent=networkFailure
   ? 'Campus Nexus could not be reached. Check your internet connection, disable any data-saving/VPN blocker temporarily, then tap Continue to retry. Your school code is still saved.'
   : (detail||'Unable to load institution. Please try again.');
  schoolStatus.style.color='#a52b2b';
  if(!networkFailure)console.error('[Exam Login] Institution lookup failed:',error);
 }finally{
  loadButton.disabled=false;
  loadButton.textContent='Continue';
 }
}
$('togglePassword').addEventListener('click',()=>{const visible=password.type==='password';password.type=visible?'text':'password';$('togglePassword').textContent=visible?'Hide':'Show'});
loadButton.addEventListener('click',loadSchool);
const suppliedCode=new URLSearchParams(location.search).get('school_code');
if(suppliedCode){schoolCode.value=suppliedCode;loadSchool();}else{schoolCode.focus();}
schoolCode.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();loadSchool()}});
schoolCode.addEventListener('input',()=>{
 if(selectedInstitution){
  selectedInstitution=null;
  schoolCode.readOnly=false;
  loadButton.disabled=false;loadButton.textContent='Continue';
  schoolCodeField.classList.remove('is-verified');
  credentialsPanel.hidden=true;
  $('examLoginTitle').textContent='Welcome to your examination portal';
  $('examLoginIntro').textContent='Enter your institution school code to securely load your school identity and continue to the correct examination sign-in.';
  schoolStatus.textContent='Load the school again after changing its code.';
  schoolStatus.style.color='#a52b2b';
 }
});
form.addEventListener('submit',async e=>{
 e.preventDefault();message.className='message';
 if(!selectedInstitution){show('Enter your school code and select Load school before signing in.');return}
 button.disabled=true;button.textContent='Signing in…';
 try{
  const client=clientReady();
  const {data,error}=await client.auth.signInWithPassword({email:email.value.trim(),password:password.value});
  if(error)throw error;
  if(!data?.user)throw new Error('Sign-in could not be completed. Please try again.');
  localStorage.setItem('currentUserId',data.user.id);
  localStorage.setItem('studentEmail',email.value.trim());
  const [{data:profile,error:profileError},{data:memberships,error:membershipError},{data:isSuper,error:superError}]=await Promise.all([
   client.from('consolidated_user_profiles_table').select('role,status,login_enabled,institution_id,full_name,email').eq('user_id',data.user.id).maybeSingle(),
   client.from('institution_users').select('institution_id,role,status').eq('user_id',data.user.id).eq('role','institution_admin').eq('status','active'),
   client.rpc('is_current_user_superadmin')
  ]);
  if(profileError)throw profileError;
  // Membership lookup is an additional verification path; an RLS denial must not
  // block an institution_admin whose active profile is already linked to this school.
  if(!profile)throw new Error('No account profile is linked to this login. Contact your institution administrator.');
  const accountRole=String(profile.role||'').trim().toLowerCase();
  const accountStatus=String(profile.status||'').trim().toLowerCase();
  if(!['approved','active'].includes(accountStatus)||profile.login_enabled===false)throw new Error('Your account is awaiting approval or has been disabled.');
  const isInstitutionAdmin=(memberships||[]).some(m=>String(m.institution_id)===String(selectedInstitution.id)) || (accountRole==='institution_admin' && String(profile.institution_id)===String(selectedInstitution.id));
  const isPlatformAdmin=isSuper===true || ['superadmin','super_admin','platform_admin'].includes(accountRole);
  if(accountRole==='student'){
   if(String(profile.institution_id)!==String(selectedInstitution.id))throw new Error('This student account does not belong to '+selectedInstitution.name+'. Check the school code.');
   show('Sign-in successful. Opening your examinations…','info');
   location.replace(nextPath('student'));
   return;
  }
  if(['lecturer','instructor','teacher'].includes(accountRole)){
   if(String(profile.institution_id)!==String(selectedInstitution.id))throw new Error('This lecturer account does not belong to '+selectedInstitution.name+'. Check the school code.');
   const lecturerVerification={user_id:data.user.id,role:accountRole,institution_id:profile.institution_id,full_name:profile.full_name||data.user.user_metadata?.full_name||'',email:profile.email||data.user.email||'',institution_name:selectedInstitution.name||'',school_code:selectedInstitution.school_code||selectedInstitution.short_code||'',verified_at:Date.now()};
   sessionStorage.setItem('campusNexusExamLecturerAuth',JSON.stringify(lecturerVerification));
   localStorage.setItem('campusNexusExamLecturerAuth',JSON.stringify(lecturerVerification));
   show('Lecturer verified. Opening the lecturer examination dashboard…','info');
   location.replace(nextPath(accountRole));
   return;
  }
  if(isInstitutionAdmin||isPlatformAdmin){
   // Carry the role verification into this tab so the dashboard does not
   // repeat profile/membership reads that may be blocked by dashboard RLS.
   const matchedMembership=(memberships||[]).find(m=>String(m.institution_id)===String(selectedInstitution.id));
   const adminVerification={user_id:data.user.id,role:isPlatformAdmin?'superadmin':'institution_admin',institution_id:isInstitutionAdmin?(matchedMembership?.institution_id||profile.institution_id||selectedInstitution.id):(profile.institution_id||null),full_name:profile.full_name||data.user.user_metadata?.full_name||'',email:profile.email||data.user.email||'',institution_name:selectedInstitution.name||'',school_code:selectedInstitution.school_code||selectedInstitution.short_code||'',verified_at:Date.now()};
   // Keep the verified hand-off available if the browser opens /adminexams/ in a fresh tab.
   sessionStorage.setItem('campusNexusExamAdminAuth',JSON.stringify(adminVerification));
   localStorage.setItem('campusNexusExamAdminAuth',JSON.stringify(adminVerification));
   show('Administrator verified. Opening the examination dashboard…','info');
   location.replace('/adminexams');
   return;
  }
  throw new Error('This account is not authorised for the examination portal. Use your institution administrator or student login.');
 }catch(error){show(error?.message||'Unable to sign in. Check your details and try again.');button.disabled=false;button.textContent='Sign in to examinations'}
});
})();