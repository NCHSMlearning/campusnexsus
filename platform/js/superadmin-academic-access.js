/* Primary Super Admin — Academic Data Access Control
 * Loaded by superadmin-profile.js and superadmin-published-marks.js.
 * Identity is verified against the active Supabase Auth user; local storage is never trusted.
 */
(function () {
  'use strict';
  if (window.NCHSMPrimaryAcademicAccess) return;

  const OWNER_EMAIL = 'tiongikevin99@gmail.com';
  const TAB_ID = 'entry-control';
  const STYLE_ID = 'nchsm-owner-access-style';
  let ownerVerified = false;
  let currentUser = null;

  const getClient = () => window.sb || window.supabaseClient || window.NCHSMLogin?.supabase || null;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function verifyOwner() {
    const db = getClient();
    if (!db?.auth?.getUser) return false;
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
      #nchsmOwnerAccessPanel .oa-wrap{max-width:1180px;margin:0 auto}
      #nchsmOwnerAccessPanel .oa-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:22px}
      #nchsmOwnerAccessPanel h1{font-size:25px;color:#102b46;margin:0 0 7px}
      #nchsmOwnerAccessPanel p{color:#64748b;line-height:1.55}
      #nchsmOwnerAccessPanel .oa-card{background:#fff;border:1px solid #e3eaf2;border-radius:16px;padding:20px;margin:0 0 16px;box-shadow:0 5px 18px rgba(15,35,60,.045)}
      #nchsmOwnerAccessPanel .oa-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}
      #nchsmOwnerAccessPanel .oa-pill{display:inline-flex;align-items:center;padding:5px 10px;border-radius:999px;background:#e9f8ef;color:#137044;font-size:11px;font-weight:800}
      #nchsmOwnerAccessPanel .oa-btn{border:0;border-radius:9px;padding:10px 14px;background:#0c4770;color:white;font-weight:700;cursor:pointer}
      #nchsmOwnerAccessPanel .oa-table-wrap{overflow:auto}
      #nchsmOwnerAccessPanel table{width:100%;border-collapse:collapse;font-size:12px;min-width:620px}
      #nchsmOwnerAccessPanel th,#nchsmOwnerAccessPanel td{text-align:left;padding:11px;border-bottom:1px solid #edf1f5}
      #nchsmOwnerAccessPanel th{color:#52657a;background:#f8fafc}
      #nchsmOwnerAccessNav a{color:inherit}
      @media(max-width:800px){#nchsmOwnerAccessPanel{inset:0;padding:18px}#nchsmOwnerAccessPanel .oa-grid{grid-template-columns:1fr}#nchsmOwnerAccessPanel h1{font-size:21px}}
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
            <p>Govern access to marks, results publication, exports and academic records across Campus Nexus.</p>
          </div>
          <button class="oa-btn" id="oaClose" type="button">Back to dashboard</button>
        </header>
        <div class="oa-card">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
            <div><strong style="color:#102b46">Primary Super Admin identity</strong><p id="oaOwnerEmail" style="margin:5px 0 0"></p></div>
            <span class="oa-pill">Verified owner session</span>
          </div>
        </div>
        <div class="oa-grid">
          <div class="oa-card"><strong style="color:#102b46">Marks visibility governance</strong><p>Control which administrator roles may view student marks. This console is reserved for the primary owner account.</p><div style="font-size:12px;color:#64748b">Access policy is enforced by authenticated database permissions. This page does not grant access by itself.</div></div>
          <div class="oa-card"><strong style="color:#102b46">Results & publication governance</strong><p>Review marks publication, approval, editing and export activity. Changes to academic records must remain auditable.</p><div style="font-size:12px;color:#64748b">Use the dedicated marks and results modules for authorised operations.</div></div>
        </div>
        <div class="oa-card">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px">
            <div><strong style="color:#102b46">Academic access audit trail</strong><p style="margin:5px 0 0">Recent recorded marks and results access events.</p></div>
            <button class="oa-btn" id="oaRefresh" type="button">Refresh audit trail</button>
          </div>
          <div id="oaAuditStatus" role="status" style="font-size:12px;color:#64748b;margin-bottom:10px">Loading audit records…</div>
          <div class="oa-table-wrap"><table><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Details</th></tr></thead><tbody id="oaAuditRows"><tr><td colspan="4">Loading…</td></tr></tbody></table></div>
        </div>
        <div class="oa-card" style="border-left:4px solid #d49b28"><strong style="color:#102b46">Security boundary</strong><p style="margin-bottom:0">The owner-only tab is hidden unless Supabase confirms this signed-in account. Database Row Level Security and server-side role checks remain the authority for sensitive data; hiding a navigation item is not an access-control mechanism.</p></div>
      </div>`;
    document.body.appendChild(panel);
    panel.querySelector('#oaClose').addEventListener('click', closePanel);
    panel.querySelector('#oaRefresh').addEventListener('click', loadAudit);
    return panel;
  }

  function ensureNav() {
    const nav = document.querySelector('#mainNav, #sidebar .nav, #sidebar nav ul, #sidebar .sidebar-menu');
    if (!nav || document.getElementById('nchsmOwnerAccessNav')) return;
    const li = document.createElement('li');
    li.id = 'nchsmOwnerAccessNav';
    li.innerHTML = '<a href="#entry-control" data-tab="entry-control" style="display:flex;align-items:center;gap:10px"><i class="fas fa-user-shield"></i><span>Academic Data Access</span></a>';
    const link = li.querySelector('a');
    link.addEventListener('click', async event => {
      event.preventDefault();
      if (!(await verifyOwner())) { li.remove(); closePanel(); return; }
      openPanel();
    });
    nav.appendChild(li);
  }

  async function loadAudit() {
    const status = document.getElementById('oaAuditStatus');
    const rows = document.getElementById('oaAuditRows');
    if (!status || !rows) return;
    if (!(await verifyOwner())) { status.textContent = 'Owner session could not be verified.'; rows.innerHTML = ''; closePanel(); return; }
    const db = getClient();
    status.textContent = 'Loading recorded audit events…';
    rows.innerHTML = '<tr><td colspan="4">Loading…</td></tr>';
    try {
      const { data, error } = await db.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      const events = (data || []).filter(item => {
        const action = String(item.action || item.event_type || item.activity || '').toLowerCase();
        const description = String(item.description || item.details || '').toLowerCase();
        return /mark|result|grade|transcript|academic|publish|export/.test(action + ' ' + description);
      });
      if (!events.length) {
        rows.innerHTML = '<tr><td colspan="4">No academic access events were returned by the audit log.</td></tr>';
      } else {
        rows.innerHTML = events.map(item => {
          const when = item.created_at || item.timestamp || item.logged_at;
          const actor = item.user_email || item.actor_email || item.email || item.user_id || 'Unknown';
          const action = item.action || item.event_type || item.activity || 'Academic activity';
          const detail = item.description || item.details || item.metadata || '';
          return '<tr><td>' + esc(when ? new Date(when).toLocaleString() : '—') + '</td><td>' + esc(actor) + '</td><td>' + esc(action) + '</td><td>' + esc(typeof detail === 'object' ? JSON.stringify(detail) : detail) + '</td></tr>';
        }).join('');
      }
      status.textContent = 'Showing ' + events.length + ' matching events from the latest audit records.';
    } catch (error) {
      console.error('[Primary Academic Access] Audit load failed:', error);
      status.textContent = 'Audit records could not be loaded: ' + (error.message || 'Unknown database error') + '. Check audit_logs permissions/schema.';
      rows.innerHTML = '<tr><td colspan="4">Audit trail unavailable.</td></tr>';
    }
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
    await loadAudit();
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
    addStyles();
    ensurePanel();
    ensureNav();
    if (location.hash === '#entry-control') openPanel();
  }

  window.NCHSMPrimaryAcademicAccess = { open: openPanel, close: closePanel, refresh: loadAudit, verifyOwner };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 500), { once: true });
  else setTimeout(init, 500);
  window.addEventListener('hashchange', () => {
    if (location.hash === '#entry-control') openPanel();
    else closePanel();
  });
})();