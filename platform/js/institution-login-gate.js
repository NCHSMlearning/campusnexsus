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
      #cnSchoolGate{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;overflow:auto;padding:28px 22px;background:radial-gradient(ellipse at 16% 18%,rgba(0,191,255,.38),transparent 34%),radial-gradient(ellipse at 84% 82%,rgba(179,54,255,.34),transparent 38%),radial-gradient(ellipse at 50% 48%,#254fca 0%,#142b83 48%,#07163f 100%);font-family:Inter,system-ui,sans-serif}
      #cnSchoolGate:before{content:"";position:absolute;inset:0;background:linear-gradient(135deg,rgba(13,28,91,.16),rgba(99,45,198,.18));backdrop-filter:blur(2px);pointer-events:none}
      #cnSchoolGate:after{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;background-image:url("/images/campus-nexus-original-logo.webp?v=1");background-repeat:no-repeat;background-position:center;background-size:min(76vw,680px) auto;opacity:.105;filter:drop-shadow(0 12px 35px rgba(0,0,0,.16))}
      #cnSchoolGate *{box-sizing:border-box}
      #cnSchoolGate .shell{position:relative;z-index:1;width:min(100%,1000px);display:flex;flex-direction:column;align-items:center}
      #cnSchoolGate .brand{display:flex;align-items:center;justify-content:center;gap:15px;margin:0 0 28px;color:#102d79;text-shadow:0 1px 16px #fff9}
      #cnSchoolGate .brand img{width:76px;height:76px;object-fit:contain;filter:drop-shadow(0 5px 12px #182b6a33)}
      #cnSchoolGate .brand-name{font-size:clamp(25px,4vw,40px);font-weight:850;letter-spacing:-1.5px;line-height:1}
      #cnSchoolGate .brand-name span{color:#7118c9}
      #cnSchoolGate .brand small{display:block;margin-top:7px;font-size:10px;letter-spacing:3px;font-weight:750;text-transform:uppercase;color:#243d77}
      #cnSchoolGate .layout{width:100%;display:grid;grid-template-columns:minmax(0,1fr) 230px;gap:20px;align-items:center}
      #cnSchoolGate .card{width:100%;padding:clamp(26px,5vw,54px);border:1px solid rgba(255,255,255,.8);border-radius:34px;background:linear-gradient(135deg,rgba(255,255,255,.78),rgba(255,255,255,.57));box-shadow:0 24px 80px rgba(16,35,100,.25),inset 0 1px 0 #fff;backdrop-filter:blur(24px);text-align:center}
      #cnSchoolGate h1{margin:0 0 9px;color:#0b1c43;font-size:clamp(27px,4.2vw,43px);font-weight:850;letter-spacing:-1.4px}
      #cnSchoolGate h1 span{color:#5620bd}
      #cnSchoolGate .intro{margin:0 0 34px;color:#385078;font-size:clamp(14px,2vw,19px)}
      #cnSchoolGate label{display:block;position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
      #cnSchoolGate .entry{display:flex;align-items:center;gap:15px;width:100%;height:66px;padding:0 22px;border:2px solid #6c38ed;border-radius:22px;background:rgba(255,255,255,.65);box-shadow:0 0 0 4px rgba(117,75,246,.08),0 8px 28px rgba(83,53,196,.13)}
      #cnSchoolGate .entry .building{font-size:25px;color:#142e7a}
      #cnSchoolGate .entry input{width:100%;height:100%;min-width:0;border:0;outline:0;background:transparent;color:#12234b;font:650 18px Inter,system-ui,sans-serif;letter-spacing:.12em}
      #cnSchoolGate .entry input::placeholder{color:#64769b;letter-spacing:0;font-weight:500}
      #cnSchoolGate button{width:100%;min-height:62px;margin-top:24px;border:0;border-radius:20px;background:linear-gradient(100deg,#078cf3 0%,#3336e8 50%,#a000e8 100%);color:#fff;font:800 19px Inter,system-ui,sans-serif;cursor:pointer;box-shadow:0 10px 26px rgba(80,47,220,.28);transition:transform .2s,filter .2s}
      #cnSchoolGate button:hover{transform:translateY(-2px);filter:brightness(1.06)}
      #cnSchoolGate button:disabled{opacity:.72;cursor:wait;transform:none}
      #cnSchoolGate .status{min-height:20px;margin:13px 0 0;color:#465b80;font-size:12px;line-height:1.5}
      #cnSchoolGate .status.error{color:#b42318}
      #cnSchoolGate .school{display:none;align-items:center;gap:12px;margin-top:18px;padding:13px;border:1px solid #dce7ef;border-radius:13px;text-align:left;background:rgba(255,255,255,.7)}
      #cnSchoolGate .school.show{display:flex}
      #cnSchoolGate .school img,#cnSchoolGate .school .monogram{width:48px;height:48px;flex:0 0 48px;border-radius:10px;object-fit:contain;background:#fff;padding:4px}
      #cnSchoolGate .school strong{display:block;color:#102a43;font-size:13px;line-height:1.35}
      #cnSchoolGate .school small{display:block;margin-top:4px;color:#64748b;font-size:10px}
      #cnSchoolGate .continue{display:none}
      #cnSchoolGate .continue.show{display:block}
      #cnSchoolGate .roles{display:grid;grid-template-columns:repeat(4,1fr);margin-top:34px;padding-top:26px;border-top:1px solid rgba(70,88,145,.18)}
      #cnSchoolGate .role{padding:0 8px;color:#182e79;font-size:12px;font-weight:700}
      #cnSchoolGate .role+.role{border-left:1px solid rgba(70,88,145,.2)}
      #cnSchoolGate .role b{display:block;margin-bottom:8px;font-size:24px;font-weight:500}
      #cnSchoolGate .loader{padding:25px 18px;border:1px solid rgba(255,255,255,.9);border-radius:25px;background:linear-gradient(145deg,rgba(255,255,255,.82),rgba(255,255,255,.58));box-shadow:0 15px 45px rgba(20,25,95,.2),0 0 24px rgba(173,85,255,.22);backdrop-filter:blur(20px);text-align:center;color:#14234b}
      #cnSchoolGate .loader-mark{font-size:35px;margin-bottom:12px}
      #cnSchoolGate .loader strong{display:block;font-size:14px}
      #cnSchoolGate .spinner{width:48px;height:48px;margin:17px auto 10px;border:6px solid rgba(116,79,226,.2);border-top-color:#165bea;border-right-color:#a02be7;border-radius:50%;animation:cnGateSpin .85s linear infinite}
      #cnSchoolGate .loader small{color:#596a8e}
      #cnSchoolGate .loader .loader-copy{font-size:12px;color:#596a8e;margin-top:5px}
      #cnSchoolGate .loader.busy{animation:cnGatePulse 1.8s ease-in-out infinite}
      #cnSchoolGate .powered{margin:27px 0 0;color:#10254c;font-size:14px;text-shadow:0 1px 12px #fff}
      #cnSchoolGate .powered strong{font-weight:850}
      @keyframes cnGateSpin{to{transform:rotate(360deg)}}
      @keyframes cnGatePulse{50%{box-shadow:0 15px 50px rgba(20,25,95,.25),0 0 34px rgba(173,85,255,.42)}}
      @media(max-width:700px){#cnSchoolGate{padding:18px 14px}#cnSchoolGate .brand{margin-bottom:22px}#cnSchoolGate .brand img{width:58px;height:58px}#cnSchoolGate .layout{grid-template-columns:1fr}#cnSchoolGate .loader{display:none}#cnSchoolGate .card{border-radius:25px;padding:28px 20px}#cnSchoolGate .roles{margin-top:26px;padding-top:20px}#cnSchoolGate .role{font-size:10px;padding:0 3px}#cnSchoolGate .role b{font-size:21px}}
      @media(prefers-reduced-motion:reduce){#cnSchoolGate .spinner{animation:none}#cnSchoolGate .loader.busy{animation:none}}
    `;
    document.head.append(css);
    const gate = document.createElement("section");
    gate.id = "cnSchoolGate";
    gate.setAttribute("role","dialog");gate.setAttribute("aria-modal","true");gate.setAttribute("aria-labelledby","cnGateTitle");
    gate.innerHTML = '<div class="shell"><div class="brand"><img src="/images/campus-nexus-original-logo.webp?v=1" alt="Campus Nexus"><div><div class="brand-name">Campus <span>Nexus</span></div><small>Academic Management Platform</small></div></div><div class="layout"><div class="card"><h1 id="cnGateTitle">Welcome to <span>Campus Nexus</span></h1><p class="intro">Login to your institutional portal</p><form id="cnGateForm" novalidate><label for="cnGateCode">Institution code</label><div class="entry"><span class="building" aria-hidden="true">⌂</span><input id="cnGateCode" name="school_code" type="text" inputmode="numeric" autocomplete="off" maxlength="3" pattern="[0-9]{3}" placeholder="Enter your institution code" required></div><button id="cnGateVerify" type="submit">Continue <span aria-hidden="true">→</span></button></form><div class="school" id="cnGateSchool"><div id="cnGateLogo"></div><div><strong id="cnGateName"></strong><small id="cnGateCodeLabel"></small></div></div><p class="status" id="cnGateStatus" role="status" aria-live="polite"></p><button type="button" class="continue" id="cnGateContinue">Continue to sign in →</button><div class="roles"><div class="role"><b>♧</b>Students</div><div class="role"><b>♙</b>Lecturers</div><div class="role"><b>⚙</b>Administrators</div><div class="role"><b>▥</b>Institutions</div></div></div><aside class="loader" id="cnGateLoader"><div class="loader-mark">🎓</div><strong id="cnGateLoaderTitle">Your campus, one secure portal</strong><div class="spinner"></div><small id="cnGateLoaderText">Ready when you are</small><div class="loader-copy">Protected institutional access</div></aside></div><div class="powered">Powered by <strong>Campus Nexus</strong></div></div>';
    document.body.append(gate);document.body.style.overflow="hidden";
    $("cnGateCode").addEventListener("input",()=>{$("cnGateCode").value=$("cnGateCode").value.replace(/\D/g,"").slice(0,3);selected=null;$("cnGateSchool").classList.remove("show");$("cnGateContinue").classList.remove("show");say("");});
    $("cnGateForm").addEventListener("submit",verify);$("cnGateContinue").addEventListener("click",continueLogin);
    document.body.append(gate);document.body.style.overflow="hidden";
    $("cnGateCode").addEventListener("input",()=>{$("cnGateCode").value=$("cnGateCode").value.replace(/\D/g,"").slice(0,3);selected=null;$("cnGateSchool").classList.remove("show");$("cnGateContinue").classList.remove("show");say("");});
    $("cnGateForm").addEventListener("submit",verify);$("cnGateContinue").addEventListener("click",continueLogin);
  }
  function say(message,error){const el=$("cnGateStatus");el.textContent=message||"";el.classList.toggle("error",!!error);}
  async function verify(event){
    event?.preventDefault();if(busy)return;
    const code=$("cnGateCode").value.trim();
    if(!/^\d{3}$/.test(code)){say("Enter the 3-digit school code provided by your institution.",true);$("cnGateCode").focus();return;}
    busy=true;const button=$("cnGateVerify");button.disabled=true;button.textContent="Verifying…";$("cnGateLoader").classList.add("busy");$("cnGateLoaderTitle").textContent="Verifying institution…";$("cnGateLoaderText").textContent="Please wait while we securely check your school code.";say("");
    try{
      if(!window.supabase?.createClient)throw new Error("Secure school lookup is unavailable. Refresh and try again.");
      const client=window.cnSchoolGateClient||(window.cnSchoolGateClient=window.supabase.createClient(SUPABASE_URL,KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:"cn-school-code-gate"}}));
      const {data,error}=await client.rpc("resolve_institution_registration_context",{p_code:code,p_host:null});
      if(error)throw new Error("We could not verify that school code. Please try again.");
      const found=Array.isArray(data)?data[0]:data;
      if(!found?.institution_id||!found?.school_code)throw new Error("That school code was not recognised or the institution is inactive. Check the code with your school.");
      selected=found;const name=String(found.institution_name||"Your Institution");
      $("cnGateName").textContent=name;$("cnGateCodeLabel").textContent="School code: "+found.school_code;
      const logo=$("cnGateLogo");
      if(!logo) throw new Error("The institution confirmation panel could not be loaded. Refresh the page and try again.");
      logo.replaceChildren();
      if(found.logo_url&&/^https:\/\//i.test(found.logo_url)){
        const img=document.createElement("img");img.src=found.logo_url;img.alt=name+" logo";logo.append(img);
      } else {
        const initials=name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"IN";
        const mark=document.createElement("span");mark.className="monogram";mark.textContent=initials;
        mark.style.cssText="display:grid;place-items:center;background:#0b4965;color:#fff;font-weight:800";
        logo.append(mark);
      }
      const primary=/^#[0-9a-f]{3,8}$/i.test(found.primary_color||"")?found.primary_color:"#0b4965";
      const secondary=/^#[0-9a-f]{3,8}$/i.test(found.secondary_color||"")?found.secondary_color:"#0f766e";
      document.documentElement.style.setProperty("--nchsm-navy",primary);document.documentElement.style.setProperty("--institution-primary",primary);document.documentElement.style.setProperty("--institution-secondary",secondary);
      $("cnSchoolGate").style.background="linear-gradient(135deg,"+primary+"ed,"+secondary+"e8)";
      $("cnGateSchool").classList.add("show");$("cnGateContinue").classList.add("show");button.textContent="Verified";$("cnGateLoader").classList.remove("busy");$("cnGateLoaderTitle").textContent="Institution verified";$("cnGateLoaderText").textContent="Your secure sign-in is ready.";say("");
    }catch(error){selected=null;$("cnGateSchool").classList.remove("show");$("cnGateContinue").classList.remove("show");button.textContent="Continue →";$("cnGateLoader").classList.remove("busy");$("cnGateLoaderTitle").textContent="Ready when you are";$("cnGateLoaderText").textContent="Check the code and try again.";say(error?.message||"School code verification failed.",true);}
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