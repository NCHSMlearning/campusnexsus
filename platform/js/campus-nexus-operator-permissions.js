/* Campus Nexus — Platform Operator Permissions Centre */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const state = { client:null, candidates:[], grants:[], institutions:[], selected:null, ready:false };
  const permissions = [
    ['institutions.view','View institutions'],['institutions.manage','Manage institutions'],
    ['users.view','View platform users'],['users.manage','Manage platform users'],
    ['billing.view','View billing'],['billing.manage','Manage billing'],
    ['security.view','View security controls'],['audit.view','View audit logs'],
    ['platform.settings.manage','Manage platform settings']
  ];
  const message = (value, error=false) => {
    const el=$('cnOperatorMessage'); if(el){el.textContent=value||'';el.classList.toggle('is-error',error);}
  };
  const esc = (value) => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function access(){
    const client=window.sb||window.supabase||window.supabaseClient;
    if(!client?.auth||!client.rpc) throw new Error('Database session is not ready.');
    const {data,error}=await client.auth.getUser(); if(error||!data?.user) throw new Error('Sign in again to manage platform permissions.');
    const check=await client.rpc('is_current_user_superadmin'); if(check.error) throw check.error;
    if(check.data!==true) throw new Error('Only the primary platform superadmin can manage operator permissions.');
    state.client=client;
  }
  async function loadInstitutions(){
    const {data,error}=await state.client.from('institutions').select('id,name,short_code').order('name');
    if(error) throw error; state.institutions=data||[];
    const sel=$('cnOperatorScope'); sel.replaceChildren(new Option('All institutions (global scope)',''));
    state.institutions.forEach(i=>sel.add(new Option(i.name+(i.short_code?' · '+i.short_code:''),i.id)));
  }
  async function search(){
    const q=$('cnOperatorSearch').value.trim();
    const {data,error}=await state.client.rpc('platform_operator_user_search',{p_search:q||null});
    if(error) throw error; state.candidates=Array.isArray(data)?data:[];
    const sel=$('cnOperatorCandidate'); sel.replaceChildren(new Option('Select a user account',''));
    state.candidates.forEach(u=>sel.add(new Option((u.full_name||'Name unavailable')+' — '+(u.email||u.user_id)+' · '+(u.role||'profile'),u.user_id)));
    message(state.candidates.length?'Choose an account, then assign only the required permissions.':'No matching profile found. Try another name or email.');
  }
  async function loadGrants(){
    const {data,error}=await state.client.rpc('platform_operator_permissions_directory');
    if(error) throw error; state.grants=Array.isArray(data)?data:[];
    renderGrants();
  }
  function renderGrants(){
    const host=$('cnOperatorGrantRows'); host.replaceChildren();
    if(!state.grants.length){const p=document.createElement('p');p.className='cn-op-empty';p.textContent='No active platform operator permissions have been granted.';host.append(p);return;}
    state.grants.forEach(g=>{
      const row=document.createElement('article'); row.className='cn-op-grant';
      const info=document.createElement('div');
      const who=document.createElement('strong'); who.textContent=g.full_name||g.email||g.user_id;
      const detail=document.createElement('small'); detail.textContent=(g.email||'')+' · '+g.permission_key+' · '+(g.institution_name||'All institutions');
      info.append(who,detail);
      const revoke=document.createElement('button'); revoke.type='button'; revoke.className='cn-op-revoke'; revoke.textContent='Revoke';
      revoke.addEventListener('click',()=>manage(g.user_id,g.permission_key,g.institution_id,'revoke',revoke));
      row.append(info,revoke);host.append(row);
    });
  }
  async function manage(userId,key,institutionId,action,button){
    const verb=action==='grant'?'Grant':'Revoke';
    const label=permissions.find(x=>x[0]===key)?.[1]||key;
    if(!window.confirm(verb+' "'+label+'" '+(institutionId?'for the selected institution':'across all institutions')+'?'))return;
    const original=button.textContent;button.disabled=true;button.textContent='Saving…';
    try{
      const {data,error}=await state.client.rpc('platform_manage_operator_permission',{
        p_user_id:userId,p_permission_key:key,p_institution_id:institutionId||null,p_action:action,
        p_note:$('cnOperatorNote').value.trim()||null
      });
      if(error)throw error;if(!data?.success)throw new Error(data?.message||'Permission change not confirmed.');
      message(data.message);await loadGrants();
    }catch(e){message(e.message||'Could not update permission.',true);}
    finally{button.disabled=false;button.textContent=original;}
  }
  async function init(){
    if(state.ready)return;state.ready=true;
    try{
      await access();await loadInstitutions();await search();await loadGrants();
      $('cnOperatorSearch').addEventListener('keydown',e=>{if(e.key==='Enter')search().catch(e=>message(e.message,true));});
      $('cnOperatorSearchButton').addEventListener('click',()=>search().catch(e=>message(e.message,true)));
      $('cnOperatorGrant').addEventListener('click',()=>{
        const userId=$('cnOperatorCandidate').value,key=$('cnOperatorPermission').value,scope=$('cnOperatorScope').value;
        if(!userId){message('Select a user account first.',true);return;}
        manage(userId,key,scope,'grant',$('cnOperatorGrant')).catch(e=>message(e.message,true));
      });
      $('cnOperatorRefresh').addEventListener('click',()=>loadGrants().catch(e=>message(e.message,true)));
    }catch(e){message(e.message||'Unable to initialise permissions centre.',true);}
  }
  window.loadPlatformOperatorPermissions=init;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();