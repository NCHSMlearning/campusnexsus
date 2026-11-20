(function(){
'use strict';
const form=document.getElementById('examLoginForm'),email=document.getElementById('email'),password=document.getElementById('password'),button=document.getElementById('submitBtn'),message=document.getElementById('message');
const show=(text,type='error')=>{message.textContent=text;message.className='message '+type};
const nextPath=()=>{const p=new URLSearchParams(location.search).get('redirect');return p&&p.startsWith('/')&&!p.startsWith('//')?p:'/studentexam.html'};
document.getElementById('togglePassword').addEventListener('click',()=>{const visible=password.type==='password';password.type=visible?'text':'password';document.getElementById('togglePassword').textContent=visible?'Hide':'Show'});
async function clientReady(){const c=window.sb||window.supabaseClient;if(c&&typeof c.auth?.signInWithPassword==='function')return c;throw new Error('The sign-in service is unavailable. Refresh this page and try again.')}
form.addEventListener('submit',async e=>{
 e.preventDefault();message.className='message';button.disabled=true;button.textContent='Signing in…';
 try{
  const client=await clientReady();
  const {data,error}=await client.auth.signInWithPassword({email:email.value.trim(),password:password.value});
  if(error)throw error;
  if(!data?.user)throw new Error('Sign-in could not be completed. Please try again.');
  const {data:profile,error:profileError}=await client.from('consolidated_user_profiles_table').select('*').eq('user_id',data.user.id).maybeSingle();
  if(profileError)throw profileError;
  if(!profile)throw new Error('No Campus Nexus student profile is linked to this account. Contact your institution administrator.');
  const role=String(profile.role||'').trim().toLowerCase(),status=String(profile.status||'').trim().toLowerCase();
  if(role!=='student'){await client.auth.signOut();throw new Error('This login is for student examination accounts only. Please use the appropriate portal.')}
  if(!['approved','active'].includes(status)||profile.login_enabled===false){await client.auth.signOut();throw new Error('Your student account is awaiting approval or has been disabled. Contact your institution administrator.')}
  if(!profile.institution_id){await client.auth.signOut();throw new Error('Your student account is not linked to an institution. Contact your institution administrator.')}
  show('Sign-in successful. Opening your examinations…','info');location.replace(nextPath());
 }catch(err){show(err?.message||'Unable to sign in. Check your details and try again.');button.disabled=false;button.textContent='Sign in to examinations'}
});
const existing=window.sb||window.supabaseClient;
if(existing?.auth?.getSession){existing.auth.getSession().then(async({data})=>{if(!data?.session?.user)return;const {data:p}=await existing.from('consolidated_user_profiles_table').select('role,status,login_enabled,institution_id').eq('user_id',data.session.user.id).maybeSingle();if(p&&String(p.role).toLowerCase()==='student'&&['approved','active'].includes(String(p.status).toLowerCase())&&p.login_enabled!==false&&p.institution_id)location.replace(nextPath())}).catch(()=>{})}
})();