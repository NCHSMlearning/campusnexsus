/* Campus Nexus shared WebRTC proctor viewer.
 * The student exam client remains the media publisher; this utility only
 * subscribes to its existing signalling channel and never stores video.
 */
(() => {
  "use strict";
  let active = null;
  const esc = value => String(value ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  function close() {
    if (!active) return;
    const old = active;
    active = null;
    old.timers.forEach(clearTimeout);
    try { old.channel?.send({type:"broadcast",event:"viewer-stop",payload:{studentId:old.studentId,examId:String(old.examId),viewerId:old.viewerId}}); } catch (_) {}
    try { old.peer?.close(); } catch (_) {}
    try { old.client.removeChannel(old.channel); } catch (_) {}
    try { old.video?.pause(); old.video.srcObject = null; } catch (_) {}
    old.modal?.remove();
  }
  async function open({client,studentId,examId,studentName="Student",examName="Examination"}) {
    if (!client?.channel || !studentId || !examId) throw new Error("A valid authenticated client, student and examination are required.");
    close();
    const state = active = {
      client, studentId:String(studentId), examId:Number(examId),
      viewerId:"campusnexus-"+Date.now()+"-"+Math.random().toString(36).slice(2,9),
      channel:null, peer:null, timers:[], queuedIce:[], attempts:0,
      modal:null, video:null, closed:false
    };
    const modal = document.createElement("div");
    modal.style.cssText="position:fixed;inset:0;z-index:2147483000;background:rgba(2,12,27,.88);display:flex;align-items:center;justify-content:center;padding:16px";
    modal.innerHTML='<section style="width:min(980px,100%);max-height:94vh;overflow:auto;background:#fff;border-radius:16px;color:#10243a;box-shadow:0 24px 80px #0008"><header style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;background:#0b2942;color:#fff"><div><b>Live examination camera</b><div style="font-size:12px;color:#cbd5e1;margin-top:4px">'+esc(studentName)+' · '+esc(examName)+'</div></div><button type="button" data-close style="border:0;background:transparent;color:#fff;font-size:26px;cursor:pointer" aria-label="Close">&times;</button></header><div style="padding:16px"><div data-status role="status" style="font-size:12px;color:#64748b;margin-bottom:10px">Connecting to student camera…</div><video autoplay muted playsinline style="width:100%;max-height:68vh;min-height:240px;object-fit:contain;background:#050b14;border-radius:12px"></video><p style="font-size:11px;color:#64748b;margin:10px 0 0">Live video is streamed directly from the active examination session. It is not a stored recording.</p></div></section>';
    document.body.appendChild(modal); state.modal=modal; state.video=modal.querySelector("video");
    const status=modal.querySelector("[data-status]");
    const setStatus=t=>{if(active===state&&status)status.textContent=t;};
    modal.querySelector("[data-close]").addEventListener("click",close);
    modal.addEventListener("click",e=>{if(e.target===modal)close();});
    const channelName="nchsm-proctor-live:"+state.examId+":"+state.studentId;
    state.channel=client.channel(channelName,{config:{broadcast:{self:false,ack:false}}});
    state.channel
      .on("broadcast",{event:"offer"},async ({payload})=>{
        if(active!==state||!payload||String(payload.studentId)!==state.studentId||String(payload.examId)!==String(state.examId)||payload.viewerId!==state.viewerId||!payload.offer)return;
        if(state.peer&&state.peer.remoteDescription)return;
        const pc=state.peer=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});
        pc.ontrack=async event=>{
          if(active!==state)return;
          let stream=event.streams?.[0];
          if(!stream){stream=state.video.srcObject instanceof MediaStream?state.video.srcObject:new MediaStream();if(!stream.getTracks().some(t=>t.id===event.track.id))stream.addTrack(event.track);}
          state.video.srcObject=stream;
          try{await state.video.play();setStatus("LIVE · receiving student camera");}catch(_){setStatus("Camera connected. Select the video to start playback.");}
        };
        pc.onicecandidate=event=>{if(!event.candidate||active!==state)return;state.channel.send({type:"broadcast",event:"ice-candidate",payload:{studentId:state.studentId,examId:String(state.examId),viewerId:state.viewerId,candidate:event.candidate.toJSON()}}).catch(()=>{});};
        pc.onconnectionstatechange=()=>{if(active!==state)return;setStatus(pc.connectionState==="connected"?"LIVE · receiving student camera":pc.connectionState==="failed"||pc.connectionState==="disconnected"?"Connection interrupted · retrying":"Connecting · "+pc.connectionState);};
        try{
          await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
          for(const candidate of state.queuedIce.splice(0)){try{await pc.addIceCandidate(candidate);}catch(_){}}
          const answer=await pc.createAnswer();await pc.setLocalDescription(answer);
          if(active!==state)return;
          await state.channel.send({type:"broadcast",event:"answer",payload:{studentId:state.studentId,examId:String(state.examId),viewerId:state.viewerId,answer:pc.localDescription}});
        }catch(error){setStatus("Could not establish live video: "+(error.message||"connection error"));}
      })
      .on("broadcast",{event:"ice-candidate"},async ({payload})=>{
        if(active!==state||payload?.viewerId!==state.viewerId||!payload.candidate)return;
        try{const candidate=new RTCIceCandidate(payload.candidate);if(!state.peer?.remoteDescription)state.queuedIce.push(candidate);else await state.peer.addIceCandidate(candidate);}catch(_){}
      })
      .subscribe(channelStatus=>{
        if(active!==state)return;
        if(channelStatus!=="SUBSCRIBED"){if(["CHANNEL_ERROR","TIMED_OUT"].includes(channelStatus))setStatus("Secure signalling unavailable. Check connection and permissions.");return;}
        const request=async()=>{
          if(active!==state||state.attempts>=6||state.peer?.connectionState==="connected")return;
          state.attempts++;
          try{await state.channel.send({type:"broadcast",event:"viewer-request",payload:{studentId:state.studentId,examId:String(state.examId),viewerId:state.viewerId,requestedAt:new Date().toISOString()}});}catch(_){}
          if(state.attempts<6)state.timers.push(setTimeout(request,2500));
        };
        request();
        state.timers.push(setTimeout(()=>{if(active===state&&!state.video.srcObject)setStatus("No live video response. The student may have closed the exam or camera permission may be unavailable.");},16000));
      });
  }
  window.CNSEBLiveViewer={open,close};
})();