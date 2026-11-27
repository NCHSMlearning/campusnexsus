(function () {
  'use strict';
  function start() {
    var cap = window.Capacitor;
    var nativeApp = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
    if (!nativeApp || document.getElementById('cn-native-tabbar')) return;

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
    bar.appendChild(more);
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
