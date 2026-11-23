/* Mandatory school-code gate for Campus Nexus shared login. */
(function () {
  "use strict";
  const SUPABASE_URL = "https://irahplkvocaakjxuisto.supabase.co";
  const KEY = "sb_publishable_5Cg5FFudf03UnmOXGNGMHQ_uK9S-uQX";
  const $ = id => document.getElementById(id);
  let selected = null, busy = false;

  function mount() {
    if ($("cnSchoolGate")) return;
    const css = document.createElement("style");
    css.id = "cnSchoolGateStyles";
    css.textContent = `
      #cnSchoolGate{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:18px;background:linear-gradient(135deg,#092b49f2,#0f766eeF);backdrop-filter:blur(10px);font-family:Inter,system-ui,sans-serif}
      #cnSchoolGate *{box-sizing:border-box}#cnSchoolGate .card{width:min(100%,420px);padding:clamp(22px,5vw,32px);border-radius:22px;background:#fff;box-shadow:0 28px 90px #00142666;text-align:center}
      #cnSchoolGate .mark{width:64px;height:64px;margin:0 auto 18px;border-radius:17px;display:grid;place-items:center;background:#0b4965;color:#fff;font-size:19px;font-weight:850;overflow:hidden}
      #cnSchoolGate .mark img{width:100%;height:100%;padding:7px;object-fit:contain;background:#fff}
      #cnSchoolGate h1{margin:0 0 9px;color:#102a43;font-size:clamp(21px,5vw,26px);font-weight:800}
      #cnSchoolGate .intro{margin:0 0 23px;color:#64748b;font-size:13px;line-height:1.65}
      #cnSchoolGate label{display:block;margin:0 0 8px;text-align:left;color:#334e68;font-size:12px;font-weight:750}
      #cnSchoolGate input{width:100%;height:52px;padding:0 15px;border:1px solid #cbd5e1;border-radius:11px;color:#102a43;font:700 19px Inter,system-ui,sans-serif;letter-spacing:.18em;text-align:center;outline:none}
      #cnSchoolGate input:focus{border-color:#0f8b8d;box-shadow:0 0 0 4px #0f8b8d20}
      #cnSchoolGate button{width:100%;min-height:49px;margin-top:14px;border:0;border-radius:11px;background:#0f766e;color:#fff;font:750 13px Inter,system-ui,sans-serif;cursor:pointer}
      #cnSchoolGate button:disabled{opacity:.6;cursor:wait}
      #cnSchoolGate .status{min-height:20px;margin:12px 0 0;color:#64748b;font-size:12px;line-height:1.5}
      #cnSchoolGate .status.error{color:#b42318}
      #cnSchoolGate .school{display:none;align-items:center;gap:12px;margin-top:18px;padding:13px;border:1px solid #dce7ef;border-radius:13px;text-align:left;background:#f8fafc}
      #cnSchoolGate .school.show{display:flex}#cnSchoolGate .school img,#cnSchoolGate .school .monogram{width:48px;height:48px;flex:0 0 48px;border-radius:10px;object-fit:contain;background:#fff;padding:4px}
      #cnSchoolGate .school strong{display:block;color:#102a43;font-size:13px;line-height:1.35}#cnSchoolGate .school small{display:block;margin-top:4px;color:#64748b;font-size:10px}
      #cnSchoolGate .continue{display:none;background:#102a43}#cnSchoolGate .continue.show{display:block}
      @media(max-width:480px){#cnSchoolGate{padding:14px}#cnSchoolGate .card{border-radius:18px}}
    `;
    document.head.append(css);
    const gate = document.createElement("section");
    gate.id = "cnSchoolGate";
    gate.setAttribute("role","dialog");gate.setAttribute("aria-modal","true");gate.setAttribute("aria-labelledby","cnGateTitle");
    gate.innerHTML = '<div class="card"><div class="mark" id="cnGateMark">CN</div><h1 id="cnGateTitle">Welcome to Campus Nexus</h1><form id="cnGateForm" novalidate><label for="cnGateCode">Institution school code</label><input id="cnGateCode" name="school_code" type="text" inputmode="numeric" autocomplete="organization" maxlength="3" pattern="[0-9]{3}" placeholder="School code" required><button id="cnGateVerify" type="submit">Continue</button></form><div class="school" id="cnGateSchool"><div id="cnGateLogo"></div><div><strong id="cnGateName"></strong><small id="cnGateCodeLabel"></small></div></div><p class="status" id="cnGateStatus" role="status" aria-live="polite"></p><button type="button" class="continue" id="cnGateContinue">Continue to sign in</button></div>';
    document.body.append(gate);document.body.style.overflow="hidden";
    $("cnGateCode").addEventListener("input",()=>{$("cnGateCode").value=$("cnGateCode").value.replace(/\D/g,"").slice(0,3);selected=null;$("cnGateSchool").classList.remove("show");$("cnGateContinue").classList.remove("show");say("");});
    $("cnGateForm").addEventListener("submit",verify);$("cnGateContinue").addEventListener("click",continueLogin);
  }
  function say(message,error){const el=$("cnGateStatus");el.textContent=message||"";el.classList.toggle("error",!!error);}
  async function verify(event){
    event?.preventDefault();if(busy)return;
    const code=$("cnGateCode").value.trim();
    if(!/^\d{3}$/.test(code)){say("Enter the 3-digit school code provided by your institution.",true);$("cnGateCode").focus();return;}
    busy=true;const button=$("cnGateVerify");button.disabled=true;button.textContent="Verifying school…";say("Checking the school code against Campus Nexus…");
    try{
      if(!window.supabase?.createClient)throw new Error("Secure school lookup is unavailable. Refresh and try again.");
      const client=window.cnSchoolGateClient||(window.cnSchoolGateClient=window.supabase.createClient(SUPABASE_URL,KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:"cn-school-code-gate"}}));
      const {data,error}=await client.rpc("resolve_institution_registration_context",{p_code:code,p_host:null});
      if(error)throw new Error("We could not verify that school code. Please try again.");
      const found=Array.isArray(data)?data[0]:data;
      if(!found?.institution_id||!found?.school_code)throw new Error("That school code was not recognised or the institution is inactive. Check the code with your school.");
      selected=found;const name=String(found.institution_name||"Your Institution");
      $("cnGateName").textContent=name;$("cnGateCodeLabel").textContent="School code: "+found.school_code;
      const logo=$("cnGateLogo");logo.replaceChildren();
      if(found.logo_url&&/^https:\/\//i.test(found.logo_url)){const img=document.createElement("img");img.src=found.logo_url;img.alt=name+" logo";logo.append(img);$("cnGateMark").replaceChildren(img.cloneNode(true));}
      else{const initials=name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"IN";const mark=document.createElement("span");mark.className="monogram";mark.textContent=initials;mark.style.cssText="display:grid;place-items:center;background:#0b4965;color:#fff;font-weight:800";logo.append(mark);$("cnGateMark").textContent=initials;}
      const primary=/^#[0-9a-f]{3,8}$/i.test(found.primary_color||"")?found.primary_color:"#0b4965";
      const secondary=/^#[0-9a-f]{3,8}$/i.test(found.secondary_color||"")?found.secondary_color:"#0f766e";
      document.documentElement.style.setProperty("--nchsm-navy",primary);document.documentElement.style.setProperty("--institution-primary",primary);document.documentElement.style.setProperty("--institution-secondary",secondary);
      $("cnSchoolGate").style.background="linear-gradient(135deg,"+primary+"ed,"+secondary+"e8)";
      $("cnGateSchool").classList.add("show");$("cnGateContinue").classList.add("show");button.textContent="Verified";say("");
    }catch(error){selected=null;$("cnGateSchool").classList.remove("show");$("cnGateContinue").classList.remove("show");button.textContent="Verify school";say(error?.message||"School code verification failed.",true);}
    finally{busy=false;button.disabled=false;}
  }
  function continueLogin(){
    if(!selected){say("Enter a valid school code first.",true);return;}
    const code=String(selected.school_code||$("cnGateCode").value).trim();
    try{sessionStorage.setItem("campus_nexus_school_code",code);sessionStorage.setItem("campus_nexus_institution_context",JSON.stringify({institution_id:selected.institution_id,institution_name:selected.institution_name,school_code:code}));}catch(_){}
    const nextUrl = new window.URL(window.location.href);
    nextUrl.searchParams.set("school_code", code);
    nextUrl.searchParams.delete("institution_code");
    window.history.replaceState({}, document.title, nextUrl.pathname + nextUrl.search + nextUrl.hash);

    const gate = $("cnSchoolGate");
    if (gate) gate.remove();
    const gateStyles = $("cnSchoolGateStyles");
    if (gateStyles) gateStyles.remove();
    document.body.style.overflow = "";

    // Explicitly reveal the existing login interface before focusing it.
    const loginForm = $("loginForm");
    const loginCard = loginForm?.closest(".login-card");
    const mainContent = loginForm?.closest(".main-content");
    [loginForm, loginCard, mainContent].filter(Boolean).forEach(el => {
      el.hidden = false;
      el.removeAttribute("aria-hidden");
      el.style.removeProperty("display");
      el.style.removeProperty("visibility");
      el.style.removeProperty("opacity");
    });
    const field = $("email");
    if (field) setTimeout(() => field.focus(), 120);
    const branding = document.createElement("script");
    branding.src = "/platform/js/institution-login-branding.js?v=20261123-tenant-branding-v4";
    branding.async = true;
    document.head.appendChild(branding);
    dispatchEvent(new CustomEvent("campusnexus:school-selected",{detail:{institutionId:selected.institution_id,schoolCode:code}}));
  }
  function init(){
    mount();
    document.addEventListener("submit",event=>{if(event.target?.id==="loginForm"&&!selected){event.preventDefault();event.stopImmediatePropagation();say("Enter your school code to continue.",true);}},true);
    const params=new URLSearchParams(location.search);let code=(params.get("school_code")||"").trim();
    if(!code){try{code=sessionStorage.getItem("campus_nexus_school_code")||"";}catch(_){}}
    if(/^\d{3}$/.test(code)){$("cnGateCode").value=code;verify();}
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();