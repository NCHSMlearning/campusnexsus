(function(){
'use strict';
function boot(){
 var form=document.getElementById('questionForm'),modal=document.getElementById('questionModal');
 if(!form||!modal||document.getElementById('adminPasteQuestionSet'))return;
 var box=document.createElement('section');box.id='adminPasteQuestionSet';box.style.cssText='margin-top:18px;padding:14px;border:1px solid #dbe3ef;border-radius:12px;background:#f8fafc';
 box.innerHTML='<h4 style="margin:0 0 6px;color:#0a3d62">Paste a complete question set</h4><p style="font-size:12px;color:#64748b">Number each question. MCQ: options A–D and Answer: B. Written: Type: Short answer or Type: Essay, followed by Marking key: and its scoring points.</p><textarea id="adminPasteQuestions" style="width:100%;min-height:170px;padding:10px;border:1px solid #cbd5e1;border-radius:8px" placeholder="1. Which ...? (2 marks)&#10;A. ...&#10;B. ...&#10;C. ...&#10;D. ...&#10;Answer: B&#10;&#10;2. Explain ... (8 marks)&#10;Type: Essay&#10;Marking key:&#10;- Point one (2 marks)&#10;- Point two (3 marks)"></textarea><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button type="button" id="adminParseQuestions" class="btn btn-primary">Preview pasted questions</button><button type="button" id="adminSavePastedQuestions" class="btn btn-success" disabled>Save all questions</button></div><div id="adminPastePreview" style="margin-top:10px;font-size:12px"></div>';
 form.parentNode.insertBefore(box,form.nextSibling);
 var parsed=[];
 function esc(v){return String(v||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
 function parse(src){
  var lines=String(src||'').replace(/\r\n?/g,'\n').split('\n'),parts=[],cur=[],start=/^\s*(?:Q(?:uestion)?\s*)?\d{1,3}\s*[).:-]\s+/i;
  lines.forEach(function(x){if(start.test(x)&&cur.some(function(y){return y.trim()})){parts.push(cur.join('\n'));cur=[]}cur.push(x)});if(cur.length)parts.push(cur.join('\n'));
  return parts.map(function(part){
   var stem=[],opts={},answer='',marks=1,key=[],inKey=false,type='';
   part.split('\n').map(function(x){return x.trim()}).filter(Boolean).forEach(function(line,i){
    var op=line.match(/^([A-D])\s*[).:-]\s*(.*)$/i),ans=line.match(/^(?:correct\s*)?answer\s*[:=-]\s*(.*)$/i),mk=line.match(/^(?:marking\s*(?:key|scheme)|rubric|expected\s*answer|model\s*answer)\s*[:=-]?\s*(.*)$/i),m=line.match(/\((\d+)\s*(?:marks?|pts?)\)/i),n=line.match(/^(\d+)\s*(?:marks?|pts?)$/i),ty=line.match(/^(?:type|question\s*type)\s*[:=-]\s*(mcq|short\s*answer|essay|long\s*answer)\s*$/i);
    if(mk){inKey=true;if(mk[1])key.push(mk[1])}else if(inKey)key.push(line);else if(op)opts[op[1].toUpperCase()]=op[2];else if(ans)answer=ans[1].trim();else if(n)marks=+n[1];else if(ty)type=ty[1].toLowerCase();else{var clean=line;if(i===0)clean=clean.replace(/^(?:Q(?:uestion)?\s*)?\d{1,3}\s*[).:-]\s*/i,'');if(m){marks=+m[1];clean=clean.replace(m[0],'').trim()}if(clean)stem.push(clean)}
   });
   var mcq=Object.keys(opts).length>0||/^[A-D]$/i.test(answer),qt=type==='essay'||type==='long answer'?'essay':type==='short answer'?'short_answer':mcq?'mcq':key.length?'essay':'short_answer',errors=[];
   if(qt==='mcq'){['A','B','C','D'].forEach(function(k){if(!opts[k])errors.push('Missing option '+k)});if(!answer||!opts[answer.toUpperCase()])errors.push('Missing or invalid answer key')}
   if(qt!=='mcq'&&!key.length)errors.push('Missing marking key');
   return {question_text:stem.join(' ').trim(),question_type:qt,marks:Math.max(1,Math.round(marks||1)),option_a:opts.A||'',option_b:opts.B||'',option_c:opts.C||'',option_d:opts.D||'',correct_answer:qt==='mcq'?answer.toUpperCase():'',marking_key:key.join('\n'),errors:errors};
  }).filter(function(q){return q.question_text});
 }
 document.getElementById('adminParseQuestions').onclick=function(){
  parsed=parse(document.getElementById('adminPasteQuestions').value);
  var bad=parsed.filter(function(q){return q.errors.length});
  document.getElementById('adminPastePreview').innerHTML=parsed.length?'<b>'+parsed.length+' detected · '+bad.length+' need correction</b>'+parsed.map(function(q,i){return '<div style="padding:8px;border-bottom:1px solid #e2e8f0"><b>'+(i+1)+'. '+esc(q.question_text)+'</b><div>'+esc(q.question_type)+' · '+q.marks+' marks</div>'+(q.marking_key?'<div><b>Marking key:</b> '+esc(q.marking_key).replace(/\n/g,' · ')+'</div>':'')+(q.errors.length?'<div style="color:#b91c1c">'+esc(q.errors.join('; '))+'</div>':'')+'</div>'}).join(''):'No numbered questions detected.';
  document.getElementById('adminSavePastedQuestions').disabled=!parsed.length||bad.length>0;
 };
 document.getElementById('adminSavePastedQuestions').onclick=async function(){
  var btn=this,examId=parseInt(document.getElementById('questionExamId').value||document.getElementById('questionExam')?.value,10);
  if(!examId){alert('Select an examination first.');return}
  btn.disabled=true;btn.textContent='Saving…';
  try{
   var db=window.sb||window.supabaseClient;if(!db)throw Error('Database connection unavailable.');
   var last=await db.from('exam_questions').select('question_number').eq('exam_id',examId).order('question_number',{ascending:false}).limit(1);
   if(last.error)throw last.error;var next=Number(last.data?.[0]?.question_number||0)+1;
   var user=await db.auth.getUser(),uid=user.data?.user?.id||null;
   var rows=parsed.map(function(q,i){if(q.errors.length)throw Error('Fix question '+(i+1)+': '+q.errors.join(', '));return {exam_id:examId,question_number:next+i,question_text:q.question_text,question_type:q.question_type,marks:q.marks,option_a:q.option_a,option_b:q.option_b,option_c:q.option_c,option_d:q.option_d,correct_answer:q.correct_answer,marking_key:q.marking_key||null,status:'approved',created_by:uid||'institution_admin',lecturer_id:uid}});
   var ins=await db.from('exam_questions').insert(rows);if(ins.error)throw ins.error;
   document.getElementById('adminPasteQuestions').value='';document.getElementById('adminPastePreview').textContent=rows.length+' questions saved.';parsed=[];btn.textContent='Saved';if(typeof loadQuestions==='function')await loadQuestions();
  }catch(e){console.error(e);alert('Could not save pasted questions: '+e.message);btn.disabled=false;btn.textContent='Save all questions'}
 };
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();