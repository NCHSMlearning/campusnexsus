/* Primary Super Admin — Academic Data Access Control
 * Owner identity is verified by Supabase Auth; every read/write is also authorised
 * by database RPCs that enforce private.is_primary_superadmin().
 */
(function () {
  'use strict';
  if (window.NCHSMPrimaryAcademicAccess) return;

  const OWNER_EMAIL = 'tiongikevin99@gmail.com';
  const TAB_ID = 'entry-control';
  const STYLE_ID = 'nchsm-owner-access-style';
  const PERMISSIONS = [
    ['view_marks','View student marks'],
    ['edit_marks','Edit / enter marks'],
    ['approve_marks','Approve / reject marks'],
    ['publish_marks','Publish / release results'],
    ['export_marks','Export marks'],
    ['view_gpa','View GPA'],
    ['generate_transcripts','Generate transcripts'],
    ['delete_marks','Delete marks']
  ];
  let ownerVerified = false;
  let currentUser = null;
  let accessState = null;
  let loading = false;

  const getClient = () => window.sb || window.supabaseClient || window.NCHSMLogin?.supabase || null;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const setStatus = (message, error) => {
    const el = document.getElementById('oaStatus');
    if (el) { el.textContent = message || ''; el.style.color = error ? '#b42318' : '#137044'; }
  };

  async function verifyOwner() {
    const db = getClient();
    if (!db?.auth?.getUser || !db?.rpc) return false;
    const { data, error } = await db.auth.getUser();
    if (error || !data?.user?.email) return false;
    currentUser = data.user;
    ownerVerified = String(data.user.email).trim().toLowerCase() === OWNER_EMAIL;
    return ownerVerified;
  }

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #nchsmOwnerAccessPanel{display:none;position:fixed;z-index:9500;inset:0 0 0 260px;background:#f3f6fb;overflow:auto;padding:28px;box-sizing:border-box}
      #nchsmOwnerAccessPanel.is-open{display:block}
      #nchsmOwnerAccessPanel .oa-wrap{max-width:1280px;margin:0 auto}
      #nchsmOwnerAccessPanel .oa-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:22px}
      #nchsmOwnerAccessPanel h1{font-size:25px;color:#102b46;margin:0 0 7px}
      #nchsmOwnerAccessPanel p{color:#64748b;line-height:1.55}
      #nchsmOwnerAccessPanel .oa-card{background:#fff;border:1px solid #e3eaf2;border-radius:16px;padding:20px;margin:0 0 16px;box-shadow:0 5px 18px rgba(15,35,60,.045)}
      #nchsmOwnerAccessPanel .oa-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}
      #nchsmOwnerAccessPanel .oa-pill{display:inline-flex;align-items:center;padding:5px 10px;border-radius:999px;background:#e9f8ef;color:#137044;font-size:11px;font-weight:800}
      #nchsmOwnerAccessPanel .oa-btn{border:0;border-radius:9px;padding:10px 14px;background:#0c4770;color:white;font-weight:700;cursor:pointer}
      #nchsmOwnerAccessPanel .oa-btn:disabled{opacity:.55;cursor:wait}
      #nchsmOwnerAccessPanel .oa-btn.secondary{background:#e8eef5;color:#17344f}
      #nchsmOwnerAccessPanel .oa-table-wrap{overflow:auto}
      #nchsmOwnerAccessPanel table{width:100%;border-collapse:collapse;font-size:12px;min-width:900px}
      #nchsmOwnerAccessPanel th,#nchsmOwnerAccessPanel td{text-align:left;padding:11px;border-bottom:1px solid #edf1f5;vertical-align:middle}
      #nchsmOwnerAccessPanel th{color:#52657a;background:#f8fafc;white-space:nowrap}
      #nchsmOwnerAccessPanel td:first-child{min-width:190px}
      #nchsmOwnerAccessPanel .oa-check{width:17px;height:17px;accent-color:#087b8b}
      #nchsmOwnerAccessPanel .oa-toggle{display:flex;align-items:center;gap:12px;font-weight:800;color:#102b46}
      #nchsmOwnerAccessPanel .oa-toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
      #nchsmOwnerAccessPanel .oa-audit{display:grid;gap:9px}
      #nchsmOwnerAccessPanel .oa-audit-item{padding:10px 12px;border:1px solid #edf1f5;border-radius:10px;font-size:12px}
      #nchsmOwnerAccessPanel .oa-audit-item small{display:block;color:#64748b;margin-top:4px}
      @media(max-width:800px){#nchsmOwnerAccessPanel{inset:0;padding:16px}#nchsmOwnerAccessPanel .oa-grid{grid-template-columns:1fr}#nchsmOwnerAccessPanel h1{font-size:21px}#nchsmOwnerAccessPanel .oa-card{padding:15px}}
    `;
    document.head.appendChild(style);
  }

  function ensurePanel() {
    let panel = document.getElementById('nchsmOwnerAccessPanel');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'nchsmOwnerAccessPanel';
    panel.setAttribute('aria-label', 'Academic Data Access Control');
    panel.innerHTML = `
      <div class="oa-wrap">
        <header class="oa-head">
          <div><div style="font-size:11px;font-weight:800;letter-spacing:1.4px;color:#0b7890;margin-bottom:8px">PRIMARY OWNER CONSOLE</div>
            <h1>Academic Data Access Control</h1>
            <p>Set the academic permissions of additional Super Admin accounts. Institution administrators do not receive platform-wide authority.</p>
          </div>
          <button class="oa-btn secondary" id="oaClose" type="button">Back to dashboard</button>
        </header>
        <div class="oa-card">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
            <div><strong style="color:#102b46">Primary owner identity</strong><p id="oaOwnerEmail" style="margin:5px 0 0"></p></div>
            <span class="oa-pill">Verified session</span>
          </div>
        </div>
        <div class="oa-card">
          <label class="oa-toggle"><input class="oa-check" type="checkbox" id="oaPolicyEnabled"> Enable additional Super Admin academic access</label>
          <p style="margin-bottom:0">When disabled, additional Super Admin accounts are blocked from academic marks operations. The primary owner remains unrestricted. Database permissions enforce this setting.</p>
        </div>
        <div class="oa-card">
          <div class="oa-toolbar" style="justify-content:space-between;margin-bottom:14px">
            <div><strong style="color:#102b46">Additional Super Admin permissions</strong><p style="margin:5px 0 0">Only authenticated accounts with the Super Admin profile role are listed.</p></div>
            <button class="oa-btn secondary" id="oaRefresh" type="button">Refresh</button>
          </div>
          <div class="oa-table-wrap"><table><thead><tr><th>Administrator</th>${PERMISSIONS.map(([,label])=>'<th>'+esc(label)+'</th>').join('')}</tr></thead><tbody id="oaAdminRows"><tr><td colspan="9">Loading access settings…</td></tr></tbody></table></div>
          <div class="oa-toolbar" style="justify-content:space-between;margin-top:16px">
            <span id="oaStatus" role="status" style="font-size:12px;color:#64748b">Loading secure settings…</span>
            <button class="oa-btn" id="oaSave" type="button">Save access policy</button>
          </div>
        </div>
        <div class="oa-card">
          <div class="oa-toolbar" style="justify-content:space-between;margin-bottom:10px">
            <div><strong style="color:#102b46">Policy change audit trail</strong><p style="margin:5px 0 0">Database-recorded changes to academic access permissions.</p></div>
          </div>
          <div id="oaAuditRows" class="oa-audit"><div class="oa-audit-item">Loading audit history…</div></div>
        </div>
        <div class="oa-card" style="border-left:4px solid #d49b28"><strong style="color:#102b46">Security boundary</strong><p style="margin-bottom:0">The browser only displays controls. Supabase RPC authorization, Row Level Security and database triggers enforce permissions. Only the primary platform owner can change this policy.</p></div>
      </div>`;
    document.body.appendChild(panel);
    panel.querySelector('#oaClose').addEventListener('click', closePanel);
    panel.querySelector('#oaRefresh').addEventListener('click', loadAccess);
    panel.querySelector('#oaSave').addEventListener('click', saveAccess);
    return panel;
  }

  function renderAccess(data) {
    accessState = data || {enabled:false,admins:[],audit:[]};
    const master = document.getElementById('oaPolicyEnabled');
    if (master) master.checked = !!accessState.enabled;
    const body = document.getElementById('oaAdminRows');
    if (!body) return;
    body.replaceChildren();
    const admins = Array.isArray(accessState.admins) ? accessState.admins : [];
    if (!admins.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 9;
      td.textContent = 'No additional Super Admin accounts found.';
      tr.appendChild(td); body.appendChild(tr);
    } else {
      admins.forEach(admin => {
        const tr = document.createElement('tr');
        const identity = document.createElement('td');
        const name = document.createElement('strong');
        name.textContent = admin.full_name || 'Name unavailable';
        const email = document.createElement('small');
        email.style.display = 'block'; email.style.color = '#64748b';
        email.textContent = admin.email || admin.user_id;
        identity.append(name,email); tr.appendChild(identity);
        PERMISSIONS.forEach(([key]) => {
          const td = document.createElement('td');
          const input = document.createElement('input');
          input.type = 'checkbox'; input.className = 'oa-check';
          input.dataset.userId = admin.user_id; input.dataset.permission = key;
          input.checked = !!admin.permissions?.[key];
          input.setAttribute('aria-label', (admin.email || admin.full_name || 'Administrator') + ': ' + key);
          td.appendChild(input); tr.appendChild(td);
        });
        body.appendChild(tr);
      });
    }
    renderAudit(accessState.audit || []);
  }

  function renderAudit(items) {
    const host = document.getElementById('oaAuditRows');
    if (!host) return;
    host.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('div'); empty.className = 'oa-audit-item';
      empty.textContent = 'No policy changes have been recorded yet.'; host.appendChild(empty); return;
    }
    items.forEach(item => {
      const row = document.createElement('div'); row.className = 'oa-audit-item';
      const action = document.createElement('strong');
      action.textContent = item.action || 'Academic access policy updated';
      const detail = document.createElement('small');
      const actor = item.actor_email || item.actor_user_id || 'Unknown owner';
      detail.textContent = actor + ' · ' + (item.created_at ? new Date(item.created_at).toLocaleString() : 'Time unavailable');
      row.append(action,detail); host.appendChild(row);
    });
  }

  async function loadAccess() {
    if (loading) return;
    if (!(await verifyOwner())) { setStatus('Primary owner verification failed. Sign in with the authorised account.', true); closePanel(); return; }
    const db = getClient();
    loading = true;
    const refresh = document.getElementById('oaRefresh');
    if (refresh) refresh.disabled = true;
    setStatus('Loading permissions from the secure database…');
    try {
      const {data,error} = await db.rpc('get_superadmin_academic_access');
      if (error) throw error;
      renderAccess(data || {});
      setStatus('Access policy loaded from Supabase.');
    } catch (error) {
      console.error('[Primary Academic Access] Load failed:', error);
      setStatus(error.message || 'Unable to load academic access settings.', true);
    } finally {
      loading = false;
      if (refresh) refresh.disabled = false;
    }
  }

  async function saveAccess() {
    if (loading) return;
    if (!(await verifyOwner())) { setStatus('Primary owner verification failed.', true); closePanel(); return; }
    const db = getClient();
    const enabled = !!document.getElementById('oaPolicyEnabled')?.checked;
    const admins = Array.isArray(accessState?.admins) ? accessState.admins : [];
    const permissions = admins.map(admin => {
      const item = {user_id:admin.user_id};
      PERMISSIONS.forEach(([key]) => {
        const input = document.querySelector('#oaAdminRows input[data-user-id="'+CSS.escape(admin.user_id)+'"][data-permission="'+key+'"]');
        item[key] = !!input?.checked;
      });
      return item;
    });
    const save = document.getElementById('oaSave');
    loading = true;
    if (save) { save.disabled = true; save.textContent = 'Saving…'; }
    setStatus('Saving policy through the authorised database function…');
    try {
      const {data,error} = await db.rpc('save_superadmin_academic_access', {
        p_enabled:enabled, p_permissions:permissions
      });
      if (error) throw error;
      renderAccess(data || {});
      setStatus('Academic access policy saved and audit recorded.');
    } catch (error) {
      console.error('[Primary Academic Access] Save failed:', error);
      setStatus(error.message || 'Policy could not be saved.', true);
    } finally {
      loading = false;
      if (save) { save.disabled = false; save.textContent = 'Save access policy'; }
    }
  }

  function ensureNav() {
    const nav = document.querySelector('#mainNav, #sidebar .nav, #sidebar nav ul, #sidebar .sidebar-menu');
    if (!nav || document.getElementById('nchsmOwnerAccessNav')) return;
    const li = document.createElement('li');
    li.id = 'nchsmOwnerAccessNav';
    li.innerHTML = '<a href="#entry-control" data-tab="entry-control" style="display:flex;align-items:center;gap:10px"><i class="fas fa-user-shield"></i><span>Academic Data Access</span></a>';
    li.querySelector('a').addEventListener('click', async event => {
      event.preventDefault();
      if (!(await verifyOwner())) { li.remove(); closePanel(); return; }
      openPanel();
    });
    nav.appendChild(li);
  }

  async function openPanel() {
    if (!(await verifyOwner())) return;
    addStyles();
    const panel = ensurePanel();
    ensureNav();
    panel.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    const email = document.getElementById('oaOwnerEmail');
    if (email) email.textContent = currentUser.email;
    history.replaceState(null, '', '#entry-control');
    await loadAccess();
  }

  function closePanel() {
    document.getElementById('nchsmOwnerAccessPanel')?.classList.remove('is-open');
    document.body.style.overflow = '';
    if (location.hash === '#entry-control') history.replaceState(null, '', location.pathname + location.search);
    document.querySelector('#nchsmOwnerAccessNav a')?.classList.remove('active');
  }

  async function init() {
    if (!(await verifyOwner())) {
      document.getElementById('nchsmOwnerAccessNav')?.remove();
      return;
    }
    addStyles(); ensurePanel(); ensureNav();
    if (location.hash === '#entry-control') openPanel();
  }

  window.NCHSMPrimaryAcademicAccess = {open:openPanel,close:closePanel,refresh:loadAccess,verifyOwner};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 500), {once:true});
  else setTimeout(init, 500);
  window.addEventListener('hashchange', () => {
    if (location.hash === '#entry-control') openPanel();
    else closePanel();
  });
})();