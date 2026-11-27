(function () {
  'use strict';
  function start() {
    var cap = window.Capacitor;
    var nativeApp = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
    var query = new URLSearchParams(window.location.search);
    var appMode = nativeApp;
    var appModeCookie = /(?:^|;\\s*)cn_android_app_mode=1(?:;|$)/.test(document.cookie || '');
    try {
      if (query.get('source') === 'android-app') {
        localStorage.setItem('cn_android_app_mode', '1');
        document.cookie = 'cn_android_app_mode=1; Max-Age=31536000; Path=/; SameSite=Lax; Secure';
        appMode = true;
      } else if (localStorage.getItem('cn_android_app_mode') === '1' || appModeCookie) {
        appMode = true;
      }
    } catch (_) {
      appMode = nativeApp || query.get('source') === 'android-app' || appModeCookie;
    }

    if (!appMode || document.getElementById('cn-native-tabbar')) return;

    // Touch-first pull-to-refresh for the Campus Nexus app shell.
    // It only arms at the top of the page and ignores form controls and active exams.
    (function installPullToRefresh() {
      if (!('ontouchstart' in window) || document.getElementById('cn-pull-refresh')) return;
      var style = document.createElement('style');
      style.id = 'cn-pull-refresh-style';
      style.textContent = [
        '#cn-pull-refresh{position:fixed;z-index:2147483646;top:calc(env(safe-area-inset-top) + 7px);left:50%;transform:translate(-50%,-150%);opacity:0;display:flex;align-items:center;gap:9px;padding:10px 16px;border-radius:999px;background:#092541;color:#fff;box-shadow:0 8px 24px rgba(5,25,45,.2);font:700 12px Inter,system-ui,sans-serif;pointer-events:none;transition:transform .16s ease,opacity .16s ease}',
        '#cn-pull-refresh.visible{opacity:1;transform:translate(-50%,0)}',
        '#cn-pull-refresh .cn-pull-icon{width:17px;height:17px;display:grid;place-items:center;font-size:17px;line-height:1}',
        '#cn-pull-refresh.refreshing .cn-pull-icon{animation:cn-pull-spin .7s linear infinite}',
        '@keyframes cn-pull-spin{to{transform:rotate(360deg)}}',
        '@media(prefers-reduced-motion:reduce){#cn-pull-refresh,#cn-pull-refresh .cn-pull-icon{transition:none;animation:none}}'
      ].join('');
      document.head.appendChild(style);
      var indicator = document.createElement('div');
      indicator.id = 'cn-pull-refresh';
      indicator.setAttribute('role','status');
      indicator.setAttribute('aria-live','polite');
      indicator.innerHTML = '<span class="cn-pull-icon" aria-hidden="true">↓</span><span class="cn-pull-label">Pull down to refresh</span>';
      document.body.appendChild(indicator);

      var startX = 0, startY = 0, distance = 0, tracking = false, pulling = false, hapticDone = false, refreshing = false;
      var label = indicator.querySelector('.cn-pull-label');
      var icon = indicator.querySelector('.cn-pull-icon');
      var threshold = 88;
      function pageAtTop() {
        var root = document.scrollingElement || document.documentElement;
        return (window.scrollY || root.scrollTop || 0) <= 1;
      }
      function blockedTarget(target) {
        if (!target || !target.closest) return false;
        return !!target.closest('input,textarea,select,button,a,[contenteditable="true"],[data-no-pull-refresh],.exam-taking,.exam-interface,[data-exam-active="true"]');
      }
      function hide() {
        indicator.classList.remove('visible','refreshing');
        indicator.style.transform = '';
        label.textContent = 'Pull down to refresh';
        icon.textContent = '↓';
        distance = 0; tracking = false; pulling = false; hapticDone = false;
      }
      function haptic() {
        try { if (navigator.vibrate) navigator.vibrate(22); } catch (_) {}
      }
      window.addEventListener('touchstart', function(e) {
        if (refreshing || !e.touches || e.touches.length !== 1 || !pageAtTop() || blockedTarget(e.target)) {
          tracking = false; return;
        }
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        distance = 0; tracking = true; pulling = false; hapticDone = false;
      }, {passive:true});
      window.addEventListener('touchmove', function(e) {
        if (!tracking || refreshing || !e.touches || e.touches.length !== 1) return;
        var dx = e.touches[0].clientX - startX;
        var dy = e.touches[0].clientY - startY;
        if (!pulling && (Math.abs(dx) > Math.abs(dy) || dy < 5)) {
          if (Math.abs(dx) > 12 || dy < -8) tracking = false;
          return;
        }
        if (!pageAtTop() || dy <= 0) { hide(); return; }
        if (dy > 8) {
          pulling = true;
          e.preventDefault();
          distance = Math.min(125, dy * 0.52);
          indicator.classList.add('visible');
          indicator.style.transform = 'translate(-50%,' + Math.max(0, distance - 55) + 'px)';
          if (dy >= threshold) {
            label.textContent = 'Release to refresh';
            icon.textContent = '↻';
            if (!hapticDone) { haptic(); hapticDone = true; }
          } else {
            label.textContent = 'Pull down to refresh';
            icon.textContent = '↓';
          }
        }
      }, {passive:false});
      window.addEventListener('touchend', function() {
        if (!tracking && !pulling) return;
        if (pulling && distance >= threshold * 0.52) {
          refreshing = true;
          indicator.classList.add('visible','refreshing');
          indicator.style.transform = 'translate(-50%,0)';
          label.textContent = 'Refreshing…';
          icon.textContent = '⟳';
          if (!hapticDone) haptic();
          try { if (navigator.vibrate) navigator.vibrate([18,35,18]); } catch (_) {}
          window.setTimeout(function(){ window.location.reload(); }, 180);
        } else {
          hide();
        }
      }, {passive:true});
      window.addEventListener('touchcancel', hide, {passive:true});
    })();

    // Dedicated native shell for the student examination centre. Reuse its
    // existing module links and handlers; this is navigation/UI only.
    var examApp = document.querySelector('.exam-app');
    var examSidebar = document.getElementById('exam-sidebar');
    if (examApp && examSidebar) {
      document.documentElement.classList.add('cn-native-exam-app');
      document.body.classList.add('cn-native-exam-app');
      var viewport = document.querySelector('meta[name="viewport"]');
      if (viewport && !/viewport-fit=cover/.test(viewport.content)) viewport.content += ',viewport-fit=cover';

      var nativeStyle = document.createElement('style');
      nativeStyle.id = 'cn-native-exam-style';
      nativeStyle.textContent = [
        'html.cn-native-exam-app,body.cn-native-exam-app{min-height:100%;overscroll-behavior-y:contain;background:#f2f6fb;-webkit-tap-highlight-color:transparent}',
        'body.cn-native-exam-app{padding:0!important;margin:0!important}',
        'body.cn-native-exam-app .exam-main-wrap{margin-left:0!important;min-height:100dvh;padding-bottom:calc(76px + env(safe-area-inset-bottom))}',
        'body.cn-native-exam-app .exam-sidebar{z-index:1201!important;top:env(safe-area-inset-top)!important;bottom:0!important;height:auto!important;width:min(86vw,320px)!important;padding-top:20px!important;transform:translateX(-110%)!important;visibility:hidden;transition:transform .24s ease,visibility .24s ease;box-shadow:16px 0 42px rgba(3,24,44,.28)!important}',
        'body.cn-native-exam-app .exam-sidebar.show{transform:translateX(0)!important;visibility:visible}',
        'body.cn-native-exam-app .mobile-scrim{z-index:1200!important}',
        'body.cn-native-exam-app .mobile-scrim.show{position:fixed!important;inset:0!important;background:rgba(4,20,37,.48)!important;backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}',
        'body.cn-native-exam-app .exam-header{position:sticky!important;top:0!important;z-index:110!important;height:calc(64px + env(safe-area-inset-top))!important;padding:env(safe-area-inset-top) 15px 0!important;background:rgba(255,255,255,.94)!important;border-bottom:1px solid rgba(216,228,239,.9)!important;box-shadow:0 4px 18px rgba(13,47,78,.045);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}',
        'body.cn-native-exam-app .header-left{gap:11px!important;min-width:0}',
        'body.cn-native-exam-app .header-kicker{font-size:8px!important;letter-spacing:1.05px!important;max-width:54vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        'body.cn-native-exam-app .header-left>div>b{font-size:14px!important;font-weight:800!important;margin-top:3px!important}',
        'body.cn-native-exam-app .mobile-toggle{display:grid!important;place-items:center;width:42px!important;height:42px!important;border:1px solid #e4eaf1!important;border-radius:14px!important;background:#f8fafd!important;color:#d41468!important;font-size:16px}',
        'body.cn-native-exam-app .secure-top{display:grid!important;place-items:center;width:38px;height:38px;padding:0!important;font-size:0!important;border:1px solid #dcefe8!important;background:#f0faf5!important}',
        'body.cn-native-exam-app .secure-top i{font-size:14px!important;margin:0!important}',
        'body.cn-native-exam-app .header-avatar{display:none!important}',
        'body.cn-native-exam-app .exam-main{width:100%!important;max-width:none!important;margin:0!important;padding:17px 14px calc(24px + env(safe-area-inset-bottom))!important}',
        'body.cn-native-exam-app .module-view{scroll-margin-top:78px}',
        'body.cn-native-exam-app .dashboard-welcome{border-radius:23px!important;box-shadow:0 13px 32px rgba(18,49,78,.13)!important}',
        'body.cn-native-exam-app .stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important;margin:13px 0 22px!important}',
        'body.cn-native-exam-app .stat-card{min-height:132px!important;border-radius:19px!important;padding:15px!important;box-shadow:0 5px 18px rgba(17,48,77,.055)!important}',
        'body.cn-native-exam-app .stat-card:active,body.cn-native-exam-app .dashboard-exam-tabs button:active,body.cn-native-exam-app .exam-card:active{transform:scale(.985)}',
        'body.cn-native-exam-app .stat-icon{width:43px!important;height:43px!important;border-radius:15px!important;margin-bottom:10px!important}',
        'body.cn-native-exam-app .stat-card small{font-size:10px!important;line-height:1.35!important;font-weight:750!important}',
        'body.cn-native-exam-app .stat-card strong{font-size:27px!important;margin:5px 0!important}',
        'body.cn-native-exam-app .stat-card span{font-size:9px!important}',
        'body.cn-native-exam-app .dashboard-exams-head{gap:12px!important;align-items:flex-end!important}',
        'body.cn-native-exam-app .dashboard-exam-tabs{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}',
        'body.cn-native-exam-app .dashboard-exam-tabs button{min-height:48px!important;border-radius:14px!important;font-size:11px!important}',
        'body.cn-native-exam-app .content-card,body.cn-native-exam-app .dashboard-panel,body.cn-native-exam-app .stat-card{border-color:#e4eaf1!important}',
        'body.cn-native-exam-app button,body.cn-native-exam-app a{touch-action:manipulation}',
        'body.cn-native-exam-app button{min-height:42px}',
        'body.cn-native-exam-app input,body.cn-native-exam-app select,body.cn-native-exam-app textarea{font-size:16px!important}',
        'body.cn-native-exam-app .exam-footer{display:none!important}',
        'body.cn-native-exam-app #toast{bottom:calc(82px + env(safe-area-inset-bottom))!important;z-index:1300!important}',
        '#cn-native-tabbar{position:fixed!important;z-index:1000!important;left:0!important;right:0!important;bottom:0!important;display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;align-items:stretch!important;gap:3px!important;padding:7px 8px calc(7px + env(safe-area-inset-bottom))!important;background:rgba(255,255,255,.97)!important;border-top:1px solid #e3eaf1!important;box-shadow:0 -8px 28px rgba(8,35,61,.10)!important;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);font-family:Inter,system-ui,sans-serif}',
        '#cn-native-tabbar .cn-tab{position:relative!important;min-width:0!important;min-height:54px!important;border:0!important;border-radius:14px!important;background:transparent!important;color:#8492a4!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:4px!important;font:700 9px Inter,system-ui,sans-serif!important;text-decoration:none!important;cursor:pointer!important}',
        '#cn-native-tabbar .cn-tab svg{width:21px!important;height:21px!important;stroke:currentColor!important;fill:none!important;stroke-width:1.9!important;stroke-linecap:round!important;stroke-linejoin:round!important}',
        '#cn-native-tabbar .cn-tab.active{color:#d41468!important;background:#fff0f6!important}',
        '#cn-native-tabbar .cn-tab.active:before{content:"";position:absolute;top:0;left:35%;right:35%;height:3px;border-radius:0 0 5px 5px;background:#d41468}',
        '#cn-native-tabbar .cn-tab:focus-visible{outline:3px solid #55b9e8;outline-offset:2px}',
        '#cn-native-tabbar .cn-tab span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '@media(min-width:681px){body.cn-native-exam-app .exam-main{padding-left:22px!important;padding-right:22px!important}#cn-native-tabbar{max-width:640px!important;left:50%!important;right:auto!important;transform:translateX(-50%)!important;bottom:10px!important;border:1px solid #e3eaf1!important;border-radius:20px!important;padding-bottom:7px!important}}',
        '@media(max-width:380px){body.cn-native-exam-app .exam-main{padding-left:10px!important;padding-right:10px!important}body.cn-native-exam-app .stat-card{padding:12px!important;min-height:122px!important}#cn-native-tabbar .cn-tab{font-size:8px!important}}'
      ].join('');
      document.head.appendChild(nativeStyle);

      var examLinks = Array.from(examSidebar.querySelectorAll('.exam-nav a[data-module]'));
      var tabs = [
        {module:'dashboard',label:'Home',icon:'<svg viewBox="0 0 24 24"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>'},
        {module:'examinations',label:'Exams',icon:'<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>'},
        {module:'timetable',label:'Timetable',icon:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h3"/></svg>'},
        {module:'exam-history',label:'Results',icon:'<svg viewBox="0 0 24 24"><path d="M4 19V5M4 19h17"/><path d="m7 15 4-4 3 2 6-7"/></svg>'},
        {module:'profile',label:'Profile',icon:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>'}
      ];
      var bar = document.createElement('nav');
      bar.id = 'cn-native-tabbar';
      bar.setAttribute('aria-label','Campus Nexus app navigation');
      var tabNodes = {};
      function activeModule(){
        var current = document.querySelector('.module-view.active');
        return current ? current.id : (location.hash || '#dashboard').slice(1);
      }
      function syncTabs(){
        var active = activeModule();
        tabs.forEach(function(t){
          var node = tabNodes[t.module];
          if(!node)return;
          var on = active === t.module;
          node.classList.toggle('active',on);
          if(on)node.setAttribute('aria-current','page');else node.removeAttribute('aria-current');
        });
      }
      tabs.forEach(function(t){
        var node=document.createElement('button');
        node.type='button';node.className='cn-tab';node.dataset.module=t.module;
        node.setAttribute('aria-label',t.label);
        node.innerHTML=t.icon+'<span></span>';
        node.querySelector('span').textContent=t.label;
        node.addEventListener('click',function(){
          var original=examLinks.find(function(a){return a.dataset.module===t.module;});
          if(original)original.click();
          else location.hash='#'+t.module;
          syncTabs();
          window.scrollTo({top:0,behavior:'smooth'});
        });
        tabNodes[t.module]=node;bar.appendChild(node);
      });
      document.body.appendChild(bar);
      syncTabs();
      window.addEventListener('hashchange',syncTabs);
      var observer=new MutationObserver(syncTabs);
      examSidebar.querySelector('.exam-nav') && observer.observe(examSidebar.querySelector('.exam-nav'),{subtree:true,attributes:true,attributeFilter:['class']});
      document.querySelectorAll('.module-view').forEach(function(section){
        observer.observe(section,{attributes:true,attributeFilter:['class','hidden']});
      });

      // Keep the existing institution menu for secondary destinations.
      var scrim=document.getElementById('mobile-scrim');
      var toggle=document.getElementById('mobile-toggle');
      if(toggle){
        toggle.setAttribute('aria-label','Open app menu');
      }
      if(scrim)scrim.addEventListener('click',function(){examSidebar.classList.remove('show');});
      examSidebar.querySelectorAll('.exam-nav a').forEach(function(a){
        a.addEventListener('click',function(){
          examSidebar.classList.remove('show');
          if(scrim)scrim.classList.remove('show');
        });
      });
      var appPlugin=window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
      if(appPlugin && typeof appPlugin.addListener==='function'){
        appPlugin.addListener('backButton',function(){
          if(examSidebar.classList.contains('show')){if(toggle)toggle.click();return;}
          var active=activeModule();
          if(active!=='dashboard'){
            var dashboardLink=examLinks.find(function(a){return a.dataset.module==='dashboard';});
            if(dashboardLink)dashboardLink.click();else location.hash='#dashboard';
            syncTabs();
          }else if(typeof appPlugin.exitApp==='function'){appPlugin.exitApp();}
        });
      }
      return;
    }

    // Role-aware mobile app shell for lecturer and institution-admin portals.
    var iaNav = document.getElementById('iaNav');
    var lecturerNav = document.getElementById('mainNav');
    var roleNav = iaNav || lecturerNav;
    if (roleNav) {
      var isInstitutionAdmin = !!iaNav;
      var roleBodyClass = isInstitutionAdmin ? 'cn-native-institution-app' : 'cn-native-lecturer-app';
      document.documentElement.classList.add('cn-native-app', roleBodyClass);
      document.body.classList.add('cn-native-app', roleBodyClass);
      var roleMeta = document.querySelector('meta[name="viewport"]');
      if (roleMeta && !/viewport-fit=cover/.test(roleMeta.content)) roleMeta.content += ',viewport-fit=cover';
      var roleStyle = document.createElement('style');
      roleStyle.id = 'cn-native-role-style';
      roleStyle.textContent = [
        'html.cn-native-app,body.cn-native-app{min-height:100%;overscroll-behavior-y:contain;-webkit-tap-highlight-color:transparent;background:#f2f6fb}',
        'body.cn-native-app{margin:0!important;padding-bottom:calc(78px + env(safe-area-inset-bottom))!important}',
        'body.cn-native-app .ia-sidebar,body.cn-native-app #sidebar{position:fixed!important;z-index:1201!important;top:env(safe-area-inset-top)!important;bottom:0!important;height:auto!important;max-height:none!important;width:min(86vw,320px)!important;overflow-y:auto!important;transform:translateX(-110%);visibility:hidden;transition:transform .24s ease,visibility .24s ease;box-shadow:16px 0 42px rgba(3,24,44,.25)!important}',
        'body.cn-native-app .ia-sidebar.cn-app-open,body.cn-native-app #sidebar.cn-app-open{transform:translateX(0)!important;visibility:visible}',
        'body.cn-native-app .ia-main,body.cn-native-app .ia-content,body.cn-native-app main{margin-left:0!important;width:100%!important;max-width:none!important}',
        'body.cn-native-app .ia-main{padding-left:14px!important;padding-right:14px!important}',
        'body.cn-native-app .ia-topbar,body.cn-native-app .topbar,body.cn-native-app header{scroll-margin-top:env(safe-area-inset-top)}',
        'body.cn-native-app button,body.cn-native-app a{touch-action:manipulation}',
        'body.cn-native-app input,body.cn-native-app select,body.cn-native-app textarea{font-size:16px!important}',
        'body.cn-native-app .ia-view,body.cn-native-app [data-view-panel]{scroll-margin-top:76px}',
        'body.cn-native-app .ia-nav-item,body.cn-native-app #mainNav a[data-tab]{min-height:46px}',
        '#cn-native-tabbar{position:fixed!important;z-index:2147483000!important;left:0!important;right:0!important;bottom:0!important;display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;align-items:stretch!important;gap:3px!important;padding:7px 8px calc(7px + env(safe-area-inset-bottom))!important;background:rgba(255,255,255,.97)!important;border-top:1px solid #e3eaf1!important;box-shadow:0 -8px 28px rgba(8,35,61,.10)!important;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);font-family:Inter,system-ui,sans-serif}',
        '#cn-native-tabbar .cn-tab{position:relative!important;min-width:0!important;min-height:54px!important;border:0!important;border-radius:14px!important;background:transparent!important;color:#8492a4!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:4px!important;font:700 9px Inter,system-ui,sans-serif!important;text-decoration:none!important;cursor:pointer!important}',
        '#cn-native-tabbar .cn-tab svg{width:21px!important;height:21px!important;stroke:currentColor!important;fill:none!important;stroke-width:1.9!important;stroke-linecap:round!important;stroke-linejoin:round!important}',
        '#cn-native-tabbar .cn-tab.active{color:#d41468!important;background:#fff0f6!important}',
        '#cn-native-tabbar .cn-tab span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '#cn-native-tabbar .cn-tab:focus-visible{outline:3px solid #55b9e8;outline-offset:2px}',
        '#cn-native-menu-scrim{position:fixed!important;z-index:1200!important;inset:0!important;background:rgba(3,18,34,.45)!important;backdrop-filter:blur(3px);display:none}',
        '#cn-native-menu-scrim.show{display:block!important}',
        '@media(min-width:681px){#cn-native-tabbar{max-width:640px!important;left:50%!important;right:auto!important;transform:translateX(-50%)!important;bottom:10px!important;border:1px solid #e3eaf1!important;border-radius:20px!important;padding-bottom:7px!important}}',
        '@media(max-width:380px){#cn-native-tabbar .cn-tab{font-size:8px!important}}'
      ].join('');
      document.head.appendChild(roleStyle);

      var configs = isInstitutionAdmin ? [
        {key:'overview',label:'Home',icon:'<svg viewBox="0 0 24 24"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>'},
        {key:'students',label:'Students',icon:'<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>'},
        {key:'staff',label:'Staff',icon:'<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM20 8v6M17 11h6"/></svg>'},
        {key:'exams',label:'Exams',icon:'<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>'},
        {key:'reports',label:'Reports',icon:'<svg viewBox="0 0 24 24"><path d="M4 19V5M4 19h17M7 15l4-4 3 2 6-7"/></svg>'}
      ] : [
        {key:'dashboard',label:'Home',icon:'<svg viewBox="0 0 24 24"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>'},
        {key:'my-courses',label:'Classes',icon:'<svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21zM4 5.5v13A2.5 2.5 0 0 1 6.5 16H20"/></svg>'},
        {key:'my-students',label:'Students',icon:'<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM20 21v-2a4 4 0 0 0-3-3.87"/></svg>'},
        {key:'cats',label:'Assess',icon:'<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>'},
        {key:'profile',label:'Profile',icon:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>'}
      ];
      var tabBar = document.createElement('nav');
      tabBar.id = 'cn-native-tabbar';
      tabBar.setAttribute('aria-label', 'Campus Nexus app navigation');
      var scrim = document.createElement('div');
      scrim.id = 'cn-native-menu-scrim';
      document.body.appendChild(scrim);
      var drawer = isInstitutionAdmin ? document.getElementById('iaSidebar') : document.getElementById('sidebar');
      function findRoleControl(key) {
        return isInstitutionAdmin
          ? roleNav.querySelector('.ia-nav-item[data-view="' + key + '"]')
          : roleNav.querySelector('a[data-tab="' + key + '"]');
      }
      function syncRoleTabs() {
        configs.forEach(function(item) {
          var control = findRoleControl(item.key);
          var active = !!control && (control.classList.contains('active') || control.getAttribute('aria-current') === 'page');
          var tab = tabBar.querySelector('[data-key="' + item.key + '"]');
          if (tab) tab.classList.toggle('active', active);
        });
      }
      configs.forEach(function(item) {
        var tab = document.createElement('button');
        tab.type = 'button'; tab.className = 'cn-tab'; tab.dataset.key = item.key;
        tab.innerHTML = item.icon + '<span></span>';
        tab.querySelector('span').textContent = item.label;
        tab.addEventListener('click', function() {
          var control = findRoleControl(item.key);
          if (control) control.click();
          syncRoleTabs();
          window.scrollTo({top:0,behavior:'smooth'});
        });
        tabBar.appendChild(tab);
      });
      var more = document.createElement('button');
      more.type = 'button'; more.className = 'cn-tab'; more.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span>More</span>';
      more.addEventListener('click', function() {
        if (!drawer) return;
        var opened = drawer.classList.toggle('cn-app-open');
        scrim.classList.toggle('show', opened);
        more.setAttribute('aria-expanded', String(opened));
      });
      // Keep five destinations plus a More entry by replacing the fifth tab on narrow role layouts.
      if (!isInstitutionAdmin) {
        var profileTab = tabBar.lastElementChild;
        if (profileTab) tabBar.removeChild(profileTab);
      } else {
        var reportsTab = tabBar.lastElementChild;
        if (reportsTab) tabBar.removeChild(reportsTab);
      }
      tabBar.appendChild(more);
      document.body.appendChild(tabBar);
      scrim.addEventListener('click', function() {
        if (drawer) drawer.classList.remove('cn-app-open');
        scrim.classList.remove('show');
      });
      roleNav.addEventListener('click', function(event) {
        var control = event.target.closest(isInstitutionAdmin ? '.ia-nav-item' : 'a[data-tab]');
        if (control) {
          window.setTimeout(syncRoleTabs, 0);
          if (drawer) drawer.classList.remove('cn-app-open');
          scrim.classList.remove('show');
        }
      });
      var roleObserver = new MutationObserver(syncRoleTabs);
      roleObserver.observe(roleNav, {subtree:true,attributes:true,attributeFilter:['class','aria-current']});
      syncRoleTabs();
      return;
    }

    document.documentElement.classList.add('cn-native-app');
    document.body.classList.add('cn-native-app');
    var meta = document.querySelector('meta[name="viewport"]');
    if (meta && !/viewport-fit=cover/.test(meta.content)) meta.content += ',viewport-fit=cover';

    var style = document.createElement('style');
    style.id = 'cn-native-app-style';
    style.textContent = [
      'html.cn-native-app,body.cn-native-app{min-height:100%;overscroll-behavior-y:contain}',
      'body.cn-native-app{padding-bottom:calc(82px + env(safe-area-inset-bottom))!important}',
      '#cn-native-tabbar{position:fixed;z-index:2147483000;left:0;right:0;bottom:0;display:flex;align-items:stretch;justify-content:space-around;gap:4px;padding:9px 10px calc(9px + env(safe-area-inset-bottom));background:rgba(255,255,255,.97);border-top:1px solid #dfe8f1;box-shadow:0 -8px 28px rgba(8,35,61,.10);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);font-family:Inter,system-ui,sans-serif}',
      '#cn-native-tabbar .cn-tab{flex:1;min-width:0;min-height:52px;border:0;border-radius:13px;background:transparent;color:#728197;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font:700 10px Inter,system-ui,sans-serif;text-decoration:none;cursor:pointer;-webkit-tap-highlight-color:transparent}',
      '#cn-native-tabbar .cn-tab svg{width:21px;height:21px;stroke:currentColor;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}',
      '#cn-native-tabbar .cn-tab.active{color:#d41468;background:#fff0f6}',
      '#cn-native-tabbar .cn-tab:focus-visible{outline:3px solid #55b9e8;outline-offset:2px}',
      '#cn-native-tabbar .cn-tab span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '#cn-native-menu-scrim{position:fixed;z-index:2147482998;inset:0;background:rgba(3,18,34,.38);display:none}',
      '#cn-native-menu-scrim.show{display:block}',
      '@media(min-width:900px){#cn-native-tabbar{max-width:620px;left:50%;right:auto;transform:translateX(-50%);bottom:12px;border:1px solid #dfe8f1;border-radius:20px;padding-bottom:9px}}'
    ].join('');
    document.head.appendChild(style);

    var sidebar = document.querySelector('.sidebar-premium.sidebar,.sidebar,[role="navigation"].sidebar');
    var links = sidebar ? Array.from(sidebar.querySelectorAll('a')) : [];
    function labelOf(a) {
      var n = a.querySelector('.nav-text') || a.querySelector('[class*="nav-text"]');
      return (n ? n.textContent : (a.getAttribute('aria-label') || a.textContent || '')).replace(/\s+/g,' ').trim();
    }
    function findLink(patterns) {
      return links.find(function (a) {
        var label = labelOf(a);
        return label && patterns.some(function (p) { return p.test(label); }) &&
          !/logout|sign out|delete|support|help/i.test(label);
      }) || null;
    }
    function currentPath() { return location.pathname.replace(/\/$/,'') || '/'; }
    var path = currentPath();
    var isStudent = /student/i.test(path) || !!findLink([/my units/i]);
    var isLecturer = /lecturer/i.test(path);
    if (isStudent) {
      style.textContent += [
        'body.cn-native-app #mobile-menu-toggle,body.cn-native-app .mobile-nav-toggle{display:none!important}',
        'body.cn-native-app #main-header{padding-top:calc(10px + env(safe-area-inset-top))!important}',
        'body.cn-native-app #app-content{padding-bottom:calc(92px + env(safe-area-inset-bottom))!important}',
        'body.cn-native-app #cn-native-tabbar{min-height:68px!important}',
        'body.cn-native-app .main-content,body.cn-native-app #main-content{padding-bottom:18px!important}'
      ].join('');
    }
    var home = findLink([/dashboard/i,/^home$/i]) || (isStudent ? null : null);
    var learning = findLink([/my units/i,/courses/i,/learning/i,/lms/i]);
    var exams = findLink([/exams?.*results/i,/examination/i,/^exams?$/i]);
    var profile = findLink([/^profile$/i,/my account/i,/account settings/i]);

    function routeButton(title, icon, link, fallback, activeTest) {
      if (!link && !fallback) return null;
      var b = document.createElement(link && link.getAttribute('href') && link.getAttribute('href') !== '#' ? 'a' : 'button');
      b.className = 'cn-tab';
      b.setAttribute('aria-label', title);
      if (b.tagName === 'A') b.href = link.getAttribute('href');
      else b.type = 'button';
      b.innerHTML = icon + '<span></span>';
      b.querySelector('span').textContent = title;
      if (activeTest && activeTest()) b.classList.add('active');
      b.addEventListener('click', function (ev) {
        if (link) {
          var href = link.getAttribute('href') || '';
          if (href === '#' || href.indexOf('javascript:') === 0 || link.hasAttribute('data-tab')) {
            ev.preventDefault();
            link.click();
          }
        } else if (fallback) {
          ev.preventDefault();
          location.href = fallback;
        }
      });
      return b;
    }
    var icons = {
      home:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>',
      learning:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 8 9-5 9 5-9 5z"/><path d="m5 12 7 4 7-4M5 16l7 4 7-4"/></svg>',
      exams:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>',
      profile:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
      menu:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>'
    };
    var bar = document.createElement('nav');
    bar.id = 'cn-native-tabbar';
    bar.setAttribute('aria-label','Campus Nexus app navigation');

    var homeFallback = isStudent ? '/platform/student.html' : null;
    var examsFallback = isStudent ? '/platform/student-exams.html' : null;
    var items = [
      routeButton('Home',icons.home,home,homeFallback,function(){return /student\.html$/.test(path) || /dashboard/i.test(path)}),
      routeButton(isLecturer?'Classes':'Learning',icons.learning,learning,null,function(){return !!learning && (learning.getAttribute('href')===path || learning.classList.contains('active'))}),
      routeButton('Exams',icons.exams,exams,examsFallback,function(){return /exam/i.test(path)}),
      routeButton('Profile',icons.profile,profile,null,function(){return !!profile && profile.classList.contains('active')})
    ].filter(Boolean);

    items.forEach(function (item) { bar.appendChild(item); });
    var more = document.createElement('button');
    more.type='button';more.className='cn-tab';more.setAttribute('aria-label','Open app menu');
    more.innerHTML=icons.menu+'<span>More</span>';
    more.addEventListener('click',function(){
      if (!sidebar) return;
      var open = sidebar.classList.toggle('active');
      document.body.classList.toggle('nchsm-nav-open',open);
      scrim.classList.toggle('show',open);
    });
    if (sidebar) bar.appendChild(more);
    if (!items.length && !sidebar) return;
    var scrim=document.createElement('div');
    scrim.id='cn-native-menu-scrim';
    scrim.addEventListener('click',function(){
      if(sidebar) sidebar.classList.remove('active');
      document.body.classList.remove('nchsm-nav-open');
      scrim.classList.remove('show');
    });
    document.body.appendChild(scrim);
    document.body.appendChild(bar);
    document.addEventListener('click',function(e){
      if(e.target.closest('.sidebar-premium a,.sidebar a')) {
        if(sidebar) sidebar.classList.remove('active');
        document.body.classList.remove('nchsm-nav-open');
        scrim.classList.remove('show');
      }
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
