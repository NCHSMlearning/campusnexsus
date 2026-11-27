(function () {
  'use strict';
  if (window.__CN_STUDENT_PROFILE_MENU__) return;
  window.__CN_STUDENT_PROFILE_MENU__ = true;

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  ready(function () {
    var root = document.getElementById('header-profile-dropdown');
    var trigger = root && root.querySelector('.profile-trigger');
    if (!root || !trigger) return;

    // The current student boot intentionally skips the legacy UIModule startup.
    // Bind the header menu independently so it remains available after auth restoration.
    trigger.setAttribute('role', 'button');
    trigger.setAttribute('tabindex', '0');
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-label', 'Open student account menu');

    var style = document.createElement('style');
    style.id = 'cn-student-profile-menu-styles';
    style.textContent = [
      '.cn-student-profile-menu{position:fixed;z-index:100000;display:none;width:min(264px,calc(100vw - 24px));max-height:min(420px,calc(100vh - 24px));overflow:auto;background:#fff;border:1px solid #e5eaf0;border-radius:15px;box-shadow:0 18px 48px rgba(12,35,58,.22);padding:7px;color:#172b43;font-family:Inter,Arial,sans-serif}',
      '.cn-student-profile-menu[aria-hidden="false"]{display:block}',
      '.cn-student-profile-menu .cn-menu-identity{display:flex;align-items:center;gap:11px;padding:12px 11px 13px;border-bottom:1px solid #edf1f5;margin-bottom:6px}',
      '.cn-student-profile-menu .cn-menu-identity img{width:40px;height:40px;border-radius:50%;object-fit:cover;background:#4c1d95;flex:0 0 40px}',
      '.cn-student-profile-menu .cn-menu-identity-copy{min-width:0;display:flex;flex-direction:column;gap:3px}',
      '.cn-student-profile-menu .cn-menu-identity-copy strong{font-size:13px;font-weight:800;color:#142b43;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.cn-student-profile-menu .cn-menu-identity-copy small{font-size:11px;color:#71839a}',
      '.cn-student-profile-menu button{width:100%;display:flex;align-items:center;gap:11px;border:0;background:transparent;color:#253b53;padding:11px 12px;border-radius:10px;text-align:left;font:600 13px Inter,Arial,sans-serif;cursor:pointer}',
      '.cn-student-profile-menu button i{width:18px;text-align:center;color:#637b95;font-size:14px}',
      '.cn-student-profile-menu button:hover,.cn-student-profile-menu button:focus-visible{background:#f1f6fb;outline:none}',
      '.cn-student-profile-menu button.cn-menu-logout{color:#c62828}',
      '.cn-student-profile-menu button.cn-menu-logout i{color:#c62828}',
      '.cn-student-profile-menu .cn-menu-divider{height:1px;background:#edf1f5;margin:5px 4px}',
      '#header-profile-dropdown .profile-trigger{cursor:pointer!important;user-select:none}',
      '#header-profile-dropdown .dropdown-icon{transition:transform .18s ease}',
      '#header-profile-dropdown.cn-menu-open .dropdown-icon{transform:rotate(180deg)}',
      '@media(prefers-reduced-motion:no-preference){.cn-student-profile-menu{transition:opacity .12s ease,transform .12s ease}.cn-student-profile-menu[aria-hidden="true"]{opacity:0;transform:translateY(-4px)}}'
    ].join('\n');
    document.head.appendChild(style);

    var menu = document.createElement('div');
    menu.className = 'cn-student-profile-menu';
    menu.id = 'cn-student-profile-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-hidden', 'true');
    menu.innerHTML = [
      '<div class="cn-menu-identity">',
        '<img id="cn-menu-profile-photo" alt="Student profile photo">',
        '<div class="cn-menu-identity-copy"><strong id="cn-menu-profile-name">Student</strong><small id="cn-menu-profile-program">Student account</small></div>',
      '</div>',
      '<button type="button" role="menuitem" data-action="profile"><i class="fas fa-user-circle" aria-hidden="true"></i><span>My Profile</span></button>',
      '<button type="button" role="menuitem" data-action="dashboard"><i class="fas fa-house" aria-hidden="true"></i><span>Dashboard</span></button>',
      '<div class="cn-menu-divider" role="separator"></div>',
      '<button type="button" role="menuitem" class="cn-menu-logout" data-action="logout"><i class="fas fa-right-from-bracket" aria-hidden="true"></i><span>Logout</span></button>'
    ].join('');
    document.body.appendChild(menu);

    function syncIdentity() {
      var name = (document.getElementById('header-user-name')?.textContent || '').trim();
      var role = (root.querySelector('.profile-role')?.textContent || 'Student').trim();
      var photo = document.getElementById('header-profile-photo');
      var nameNode = document.getElementById('cn-menu-profile-name');
      var roleNode = document.getElementById('cn-menu-profile-program');
      var menuPhoto = document.getElementById('cn-menu-profile-photo');
      if (nameNode) nameNode.textContent = name && name !== 'Loading...' ? name : 'Student';
      if (roleNode) roleNode.textContent = role;
      if (menuPhoto) menuPhoto.src = photo?.currentSrc || photo?.src || 'https://ui-avatars.com/api/?name=Student&background=4C1D95&color=fff&size=100';
    }

    function placeMenu() {
      var rect = root.getBoundingClientRect();
      menu.style.visibility = 'hidden';
      menu.setAttribute('aria-hidden', 'false');
      menu.style.display = 'block';
      var width = menu.offsetWidth || 264;
      var height = menu.offsetHeight || 210;
      var left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.right - width));
      var top = rect.bottom + 9;
      if (top + height > window.innerHeight - 12) top = Math.max(12, rect.top - height - 9);
      menu.style.left = left + 'px';
      menu.style.top = top + 'px';
      menu.style.visibility = 'visible';
    }

    function openMenu() {
      syncIdentity();
      root.classList.add('cn-menu-open');
      trigger.setAttribute('aria-expanded', 'true');
      trigger.setAttribute('aria-label', 'Close student account menu');
      placeMenu();
    }
    function closeMenu(returnFocus) {
      menu.setAttribute('aria-hidden', 'true');
      menu.style.display = 'none';
      menu.style.visibility = '';
      root.classList.remove('cn-menu-open');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-label', 'Open student account menu');
      if (returnFocus) trigger.focus();
    }
    function toggleMenu() {
      if (trigger.getAttribute('aria-expanded') === 'true') closeMenu(false);
      else openMenu();
    }

    trigger.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      toggleMenu();
    });
    trigger.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleMenu(); }
      if (event.key === 'ArrowDown') { event.preventDefault(); openMenu(); menu.querySelector('button')?.focus(); }
    });
    document.addEventListener('pointerdown', function (event) {
      if (trigger.getAttribute('aria-expanded') === 'true' && !root.contains(event.target) && !menu.contains(event.target)) closeMenu(false);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && trigger.getAttribute('aria-expanded') === 'true') closeMenu(true);
    });
    window.addEventListener('resize', function () { if (trigger.getAttribute('aria-expanded') === 'true') placeMenu(); });
    window.addEventListener('scroll', function () { if (trigger.getAttribute('aria-expanded') === 'true') placeMenu(); }, true);
    menu.addEventListener('click', async function (event) {
      var button = event.target.closest('button[data-action]');
      if (!button) return;
      event.preventDefault();
      var action = button.getAttribute('data-action');
      closeMenu(false);
      if (action === 'profile' || action === 'dashboard') {
        var tab = action === 'profile' ? 'profile' : 'dashboard';
        if (typeof window.showTab === 'function') window.showTab(tab);
        else if (typeof window.nchsmNavigateToTab === 'function') window.nchsmNavigateToTab(tab);
        else window.location.hash = tab;
        return;
      }
      if (action === 'logout') await logoutStudent(button);
    });

    async function logoutStudent(button) {
      var confirmed = true;
      if (window.Swal?.fire) {
        var result = await window.Swal.fire({
          title: 'Log out of Campus Nexus?',
          text: 'You will need to sign in again to access your student portal.',
          icon: 'question', showCancelButton: true,
          confirmButtonText: 'Yes, log out', cancelButtonText: 'Stay signed in',
          confirmButtonColor: '#c62828', cancelButtonColor: '#64748b'
        });
        confirmed = !!result.isConfirmed;
      } else { confirmed = window.confirm('Are you sure you want to log out?'); }
      if (!confirmed) return;
      button.disabled = true;
      button.querySelector('span').textContent = 'Signing out…';
      var client = [window.app?.supabase, window.db?.supabase, window.supabase, window.sb].find(function (candidate) {
        return candidate && candidate.auth && typeof candidate.auth.signOut === 'function';
      });
      try {
        if (!client) throw new Error('Your secure session is still initializing. Please wait a moment and try again.');
        var response = await client.auth.signOut({ scope: 'local' });
        if (response?.error) throw response.error;
        ['nchsm_current_tab', 'nchsm_last_tab', 'currentUserProfile', 'userProfilePhoto'].forEach(function (key) {
          try { localStorage.removeItem(key); } catch (_) {}
        });
        try { sessionStorage.removeItem('nchsm_current_tab'); } catch (_) {}
        window.location.replace('/login');
      } catch (error) {
        button.disabled = false;
        button.querySelector('span').textContent = 'Logout';
        if (window.Swal?.fire) await window.Swal.fire({ title: 'Unable to log out', text: error?.message || 'Please try again.', icon: 'error' });
        else window.alert(error?.message || 'Unable to log out. Please try again.');
      }
    }

    // The student boot updates the identity after session restoration.
    document.addEventListener('appReady', syncIdentity);
    document.addEventListener('profileUpdated', syncIdentity);
    syncIdentity();
  });
})();
