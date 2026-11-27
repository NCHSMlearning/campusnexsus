/* Campus Nexus — institution-scoped academic structure resolver.
 * Programme structure is always read using institution_id + program_code.
 * program_blocks remains the compatible storage for Blocks, Semesters and Terms.
 */
(function(global){
 'use strict';
 const cache=new Map(),clean=v=>String(v??'').trim(),valid=c=>c&&typeof c.from==='function';
 const normalizeType=v=>{const s=clean(v).toLowerCase().replace(/[_-]+/g,' ');return /semester/.test(s)?'Semester':/term/.test(s)?'Term':'Block';};
 const labels=v=>{const singular=normalizeType(v);return {type:singular,singular,plural:singular==='Block'?'Blocks':singular==='Semester'?'Semesters':'Terms',lower:singular.toLowerCase(),pluralLower:singular==='Block'?'blocks':singular==='Semester'?'semesters':'terms'};};
 async function resolve(client,institutionId,programCode,options){
  if(!valid(client))throw Error('Academic structure database client is unavailable.');
  const institution=clean(institutionId),code=clean(programCode);
  if(!institution||!code)throw Error('Institution and programme are required to load academic structure.');
  const key=institution+'|'+code.toLowerCase();
  if(!options?.refresh&&cache.has(key))return cache.get(key);
  const task=(async()=>{
   let {data:program,error}=await client.from('programs').select('id,institution_id,program_code,program_name,structure_type,status').eq('institution_id',institution).ilike('program_code',code).maybeSingle();
   if(error)throw error;
   // Legacy student profiles may use an older programme code (e.g. KRCHN)
   // while this institution's catalogue uses its sole configured code (e.g. DCHN).
   // Only apply this fallback when exactly one active programme exists for the tenant.
   if(!program){
    const {data:activePrograms,error:fallbackError}=await client.from('programs').select('id,institution_id,program_code,program_name,structure_type,status').eq('institution_id',institution).eq('status','active');
    if(fallbackError)throw fallbackError;
    if((activePrograms||[]).length===1)program=activePrograms[0];
   }
   if(!program)return {...labels('Block'),program:null,periods:[],institutionId:institution,programCode:code};
   const meta=labels(program.structure_type);
   const {data:rows,error:periodError}=await client.from('program_blocks').select('id,block_name,block_sequence,status').eq('institution_id',institution).eq('program_id',program.id).eq('status','active').order('block_sequence',{ascending:true});
   if(periodError)throw periodError;
   return {...meta,program,periods:(rows||[]).map(x=>({id:x.id,name:clean(x.block_name),sequence:x.block_sequence})).filter(x=>x.name),institutionId:institution,programCode:program.program_code};
  })();
  cache.set(key,task);
  try{const result=await task;cache.set(key,result);return result;}catch(error){cache.delete(key);throw error;}
 }
 function fillSelect(select,structure,placeholder,selected){
  if(!select||!structure)return;
  const previous=selected!==undefined?String(selected):String(select.value||'');
  select.replaceChildren();const first=document.createElement('option');first.value='';first.textContent=placeholder||('Select '+structure.lower);select.append(first);
  structure.periods.forEach(p=>{const o=document.createElement('option');o.value=p.name;o.textContent=p.name;select.append(o);});
  if(previous&&[...select.options].some(o=>o.value===previous))select.value=previous;
 }
 function applyLabels(root,structure){
  if(!root||!structure)return;
  root.querySelectorAll('[data-academic-period-label]').forEach(el=>{el.textContent=el.getAttribute('data-academic-period-label')==='plural'?structure.plural:structure.singular;});
  root.querySelectorAll('[data-academic-period-placeholder]').forEach(el=>el.setAttribute('placeholder','Select '+structure.lower));
  root.querySelectorAll('[data-academic-period-all]').forEach(el=>{el.textContent='All '+structure.pluralLower;});
  root.dataset.academicStructure=structure.type;
 }
 async function resolveCurrent(client,programCode){
  let profile=global.currentUserProfile||global.app?.user||global.lecturerProfile||global.CURRENT_USER_PROFILE||null;
  if(!profile&&valid(client)){const {data:{user}}=await client.auth.getUser();if(user?.id){const {data,error}=await client.from('consolidated_user_profiles_table').select('institution_id,program,department,role').eq('user_id',user.id).maybeSingle();if(error)throw error;profile=data;}}
  if(!profile)throw Error('Signed-in profile is unavailable for academic structure lookup.');
  return resolve(client,profile.institution_id||global.CURRENT_INSTITUTION_ID||global.currentInstitutionId,programCode||profile.program||profile.department);
 }
 global.CampusAcademicStructure={resolve,resolveCurrent,fillSelect,applyLabels,labels,clearCache(){cache.clear();}};
})(window);