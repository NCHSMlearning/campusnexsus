// NCHSM SIDEBAR SEARCH — surgical HTML enhancement
(function(){
'use strict';
function initSidebarSearch(){
 const input=document.getElementById('sidebarPortalSearch'),clear=document.getElementById('sidebarSearchClear'),results=document.getElementById('sidebarSearchResults'),empty=document.getElementById('sidebarSearchEmpty'),nav=document.querySelector('.sidebar-nav-premium');
 if(!input||!clear||!results||!empty||!nav||input.dataset.bound==='1')return;
 input.dataset.bound='1';
 const getItems=()=>Array.from(nav.querySelectorAll('a[data-tab]')).map(a=>({a,label:(a.querySelector('.nav-text')?.textContent||a.textContent||'').replace(/\s+/g,' ').trim(),tab:a.getAttribute('data-tab')})).filter(x=>x.label);
 const close=()=>{results.hidden=true;results.innerHTML='';empty.hidden=true;};
 const render=()=>{const q=input.value.trim().toLowerCase();clear.style.display=q?'block':'none';if(!q){close();return;}const m=getItems().filter(x=>x.label.toLowerCase().includes(q)).slice(0,8);results.innerHTML='';empty.hidden=m.length>0;if(!m.length){results.hidden=true;return;}m.forEach(x=>{const b=document.createElement('button');b.type='button';b.className='sidebar-search-result';b.setAttribute('role','option');b.textContent=x.label;b.onclick=()=>{input.value='';clear.style.display='none';close();if(typeof window.nchsmNavigateToTab==='function')window.nchsmNavigateToTab(x.tab);else if(typeof window.showTab==='function')window.showTab(x.tab);else x.a.click();};results.appendChild(b);});results.hidden=false;};
 input.addEventListener('input',render);clear.addEventListener('click',()=>{input.value='';clear.style.display='none';close();input.focus();});input.addEventListener('keydown',e=>{if(e.key==='Escape'){input.value='';clear.style.display='none';close();input.blur();}else if(e.key==='Enter'){const b=results.querySelector('.sidebar-search-result');if(b){e.preventDefault();b.click();}}});document.addEventListener('click',e=>{if(!e.target.closest('#sidebarSearchWrap'))close();});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initSidebarSearch,{once:true});else initSidebarSearch();document.addEventListener('appReady',initSidebarSearch);
})();

// NCHSM SIDEBAR FOOTER CONTROLS — surgical HTML enhancement
(function () {
  'use strict';

  function getSupabaseClient() {
    const candidates = [
      window.sb,
      window.supabaseClient,
      window.db && window.db.supabase,
      window.NCHSMLogin && window.NCHSMLogin.supabase
    ];
    return candidates.find(c => c && typeof c.from === 'function' && c.auth && typeof c.auth.signOut === 'function') || null;
  }

  const applyPortalTheme = window.setTheme || function (theme) {
    const dark = theme === 'dark' || theme === 'dark-mode';
    document.body.classList.toggle('dark-mode', dark);
    document.body.setAttribute('data-theme', dark ? 'dark' : 'purple');
    try { localStorage.setItem('nchsm_theme', dark ? 'dark' : 'purple'); } catch (_) {}
  };

  function initSidebarFooterControls() {
    const refresh = document.getElementById('sidebarRefreshBtn');
    const theme = document.getElementById('sidebarThemeBtn');
    const logout = document.getElementById('sidebarLogoutBtn');
    if (!refresh || !theme || !logout || refresh.dataset.nchsmBound === '1') return;

    refresh.dataset.nchsmBound = '1';
    theme.dataset.nchsmBound = '1';
    logout.dataset.nchsmBound = '1';

    theme.addEventListener('click', function (e) {
      e.preventDefault();
      applyPortalTheme(document.body.classList.contains('dark-mode') ? 'purple' : 'dark');
    });

    refresh.addEventListener('click', async function (e) {
      e.preventDefault();
      const old = refresh.innerHTML;
      refresh.disabled = true;
      refresh.innerHTML = '<i class="fas fa-sync-alt fa-spin" aria-hidden="true"></i>';
      try {
        if (typeof window.refreshDashboard === 'function') {
          await window.refreshDashboard(true);
        } else if (window.dashboardModule && typeof window.dashboardModule.refreshAll === 'function') {
          await window.dashboardModule.refreshAll();
        } else {
          window.location.reload();
          return;
        }
      } catch (err) {
        console.warn('Dashboard refresh failed:', err);
        window.location.reload();
        return;
      } finally {
        refresh.disabled = false;
        refresh.innerHTML = old;
      }
    });

    logout.addEventListener('click', async function (e) {
      e.preventDefault();
      const proceed = async function () {
        logout.disabled = true;
        const client = getSupabaseClient();
        try {
          if (client) await client.auth.signOut();
          else if (window.db && typeof window.db.logout === 'function') await window.db.logout();
          try { sessionStorage.clear(); } catch (_) {}
          window.location.href = '/login';
        } catch (err) {
          console.error('Logout failed:', err);
          logout.disabled = false;
          if (window.Swal) Swal.fire({ icon:'error', title:'Logout failed', text:'Please try again.' });
          else alert('Logout failed. Please try again.');
        }
      };
      if (window.Swal) {
        const result = await Swal.fire({
          icon: 'question', title: 'Sign out?', text: 'You will be returned to the login page.',
          showCancelButton: true, confirmButtonText: 'Logout', cancelButtonText: 'Stay',
          confirmButtonColor: '#4C1D95'
        });
        if (result.isConfirmed) await proceed();
      } else if (confirm('Are you sure you want to logout?')) {
        await proceed();
      }
    });

    let saved = 'purple';
    try { saved = localStorage.getItem('nchsm_theme') || 'purple'; } catch (_) {}
    applyPortalTheme(saved === 'dark' ? 'dark' : 'purple');
  }

  window.nchsmApplyTheme = applyPortalTheme;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSidebarFooterControls);
  else initSidebarFooterControls();
  document.addEventListener('appReady', initSidebarFooterControls);
  new MutationObserver(initSidebarFooterControls).observe(document.body, { childList:true, subtree:true });
})();
