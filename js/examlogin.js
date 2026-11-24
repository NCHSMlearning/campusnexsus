(function(){
'use strict';
const $=id=>document.getElementById(id);
const form=$('examLoginForm'),email=$('email'),password=$('password'),schoolCode=$('schoolCode'),button=$('submitBtn'),loadButton=$('loadSchoolBtn'),message=$('message'),schoolStatus=$('schoolStatus');
let selectedInstitution=null;
const schoolField=schoolCode.closest('.field');
const schoolModal=document.createElement('div');
schoolModal.className='school-code-modal';schoolModal.id='schoolCodeModal';
schoolModal.innerHTML='<section class="school-code-dialog" role="dialog" aria-modal="true" aria-labelledby="schoolPromptTitle"><div class="school-prompt-icon">⌂</div><h2 id="schoolPromptTitle">Welcome to your examination portal</h2><p>Enter your institution school code to load its name and logo before signing in.</p><div id="schoolPromptField"></div></section>';
document.body.appendChild(schoolModal);
document.getElementById('schoolPromptField').appendChild(schoolField);
form.style.display='none';
const show=(text,type='error')=>{message.textContent=text;message.className='message '+type};
const nextPath=(role)=>{const p=new URLSearchParams(location.search).get('redirect');if(role==='student')return p&&p.startsWith('/')&&!p.startsWith('//')?p:'/studentexam.html';if(['lecturer','instructor','teacher'].includes(role))return '/lecturerexams/';return '/adminexams/';};
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
 if(/^#[0-9a-f]{3,8}$/i.test(institution.primary_color||''))document.documentElement.style.setProperty('--navy',institution.primary_color);
 if(/^#[0-9a-f]{3,8}$/i.test(institution.secondary_color||''))document.documentElement.style.setProperty('--teal',institution.secondary_color);
 document.title=name+' Examination Login';
 schoolStatus.textContent='Institution loaded. Sign in with your Campus Nexus account.';
 schoolStatus.style.color='#176c68';
 form.style.display='block';schoolModal.classList.add('is-hidden');
}
async function loadSchool(){
 const code=schoolCode.value.trim().toUpperCase();
 selectedInstitution=null;
 if(!/^[A-Z0-9_-]{3,30}$/.test(code)){schoolStatus.textContent='Enter a valid school code (letters and numbers).';schoolStatus.style.color='#a52b2b';return}
 loadButton.disabled=true;loadButton.textContent='Loading…';schoolStatus.textContent='Looking up your institution…';
 try{
  const client=clientReady();
  const result=await client.rpc('lookup_exam_institution',{p_school_code:code});
  if(result.error)throw result.error;
  const rows=result.data||[];
  if(!rows.length)throw new Error('No institution was found for that school code. Check the code and try again.');
  if(rows.length>1)throw new Error('This code matches more than one institution. Contact Campus Nexus support.');
  const institution=rows[0];
  if(String(institution.status||'').toLowerCase()==='suspended')throw new Error('This institution portal is currently suspended. Contact your institution administrator.');
  paintInstitution(institution);
 }catch(error){schoolStatus.textContent=error.message||'Unable to load institution.';schoolStatus.style.color='#a52b2b';}
 finally{loadButton.disabled=false;loadButton.textContent='Load school'}
}
$('togglePassword').addEventListener('click',()=>{const visible=password.type==='password';password.type=visible?'text':'password';$('togglePassword').textContent=visible?'Hide':'Show'});
loadButton.addEventListener('click',loadSchool);
const suppliedCode=new URLSearchParams(location.search).get('school_code');
if(suppliedCode){schoolCode.value=suppliedCode;loadSchool();}else{schoolCode.focus();}
schoolCode.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();loadSchool()}});
schoolCode.addEventListener('input',()=>{if(selectedInstitution&&schoolCode.value.trim().toUpperCase()!==String(selectedInstitution.school_code||selectedInstitution.short_code||'').toUpperCase()){selectedInstitution=null;schoolStatus.textContent='Load the school again after changing its code.';schoolStatus.style.color='#a52b2b'}});
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
   location.replace('/adminexams/');
   return;
  }
  throw new Error('This account is not authorised for the examination portal. Use your institution administrator or student login.');
 }catch(error){show(error?.message||'Unable to sign in. Check your details and try again.');button.disabled=false;button.textContent='Sign in to examinations'}
});
})();