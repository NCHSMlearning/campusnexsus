(function(){
'use strict';
const $=id=>document.getElementById(id);
const form=$('examLoginForm'),email=$('email'),password=$('password'),schoolCode=$('schoolCode'),button=$('submitBtn'),loadButton=$('loadSchoolBtn'),message=$('message'),schoolStatus=$('schoolStatus');
let selectedInstitution=null;
const show=(text,type='error')=>{message.textContent=text;message.className='message '+type};
const nextPath=()=>{const p=new URLSearchParams(location.search).get('redirect');return p&&p.startsWith('/')&&!p.startsWith('//')?p:'/studentexam.html'};
function clientReady(){const c=window.examSupabase;if(c&&typeof c.auth?.signInWithPassword==='function')return c;throw new Error(window.__EXAM_CONFIG_ERROR__||'The examination sign-in service is unavailable. Refresh and try again.')}
function initials(name){return String(name||'School').trim().split(/\\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'SC'}
function paintInstitution(institution){
 selectedInstitution=institution;
 const name=String(institution.name||'Your Institution');
 $('schoolName').textContent=name;
 $('schoolPortalLabel').textContent='Student Examination Portal';
 $('schoolCodeBadge').textContent='SCHOOL CODE: '+(institution.school_code||institution.short_code||schoolCode.value.trim().toUpperCase());
 $('schoolCodeBadge').hidden=false;
 const logo=$('schoolLogo');
 logo.replaceChildren();
 if(institution.logo_url&&/^https:\\/\\//i.test(institution.logo_url)){
  const img=document.createElement('img');img.src=institution.logo_url;img.alt=name+' logo';
  img.onerror=()=>{logo.textContent=initials(name)};logo.appendChild(img);
 }else{logo.textContent=initials(name)}
 if(/^#[0-9a-f]{3,8}$/i.test(institution.primary_color||''))document.documentElement.style.setProperty('--navy',institution.primary_color);
 if(/^#[0-9a-f]{3,8}$/i.test(institution.secondary_color||''))document.documentElement.style.setProperty('--teal',institution.secondary_color);
 document.title=name+' Student Examination Login';
 schoolStatus.textContent='Institution loaded. Sign in with your registered student account.';
 schoolStatus.style.color='#176c68';
}
async function loadSchool(){
 const code=schoolCode.value.trim().toUpperCase();
 selectedInstitution=null;
 if(!/^[A-Z0-9_-]{3,30}$/.test(code)){schoolStatus.textContent='Enter a valid school code (letters and numbers).';schoolStatus.style.color='#a52b2b';return}
 loadButton.disabled=true;loadButton.textContent='Loading…';schoolStatus.textContent='Looking up your institution…';
 try{
  const client=clientReady();
  const result=await client.from('institutions').select('id,name,school_code,short_code,logo_url,primary_color,secondary_color,status').or('school_code.ilike.'+code+',short_code.ilike.'+code).limit(2);
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
  const {data:profile,error:profileError}=await client.from('consolidated_user_profiles_table').select('role,status,login_enabled,institution_id').eq('user_id',data.user.id).maybeSingle();
  if(profileError)throw profileError;
  if(!profile)throw new Error('No student profile is linked to this account. Contact your institution administrator.');
  if(String(profile.role||'').trim().toLowerCase()!=='student')throw new Error('This login is for student examination accounts only.');
  if(!['approved','active'].includes(String(profile.status||'').trim().toLowerCase())||profile.login_enabled===false)throw new Error('Your student account is awaiting approval or has been disabled.');
  if(String(profile.institution_id)!==String(selectedInstitution.id))throw new Error('This student account does not belong to '+selectedInstitution.name+'. Check the school code.');
  show('Sign-in successful. Opening your examinations…','info');
  location.replace(nextPath()+'?v=20261120-standalone');
 }catch(error){show(error?.message||'Unable to sign in. Check your details and try again.');button.disabled=false;button.textContent='Sign in to examinations'}
});
})();