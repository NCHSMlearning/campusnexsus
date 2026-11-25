'use strict';
/*
 * CN-SEB management workspace. Reuses the existing Admin Exams navigation
 * and server-authorised Supabase RPCs; never trusts client-supplied roles.
 */
(function () {
  const titles = {
    cnsebOverview: ['Secure Browser Overview', 'Examination security and device monitoring'],
    cnsebDevices: ['Devices & Installations', 'Registered computers, app versions and enrollment'],
    cnsebSessions: ['Live Exam Sessions', 'Active secure examination sessions'],
    cnsebAlerts: ['Security Events', 'Secure Browser and device security incidents'],
    cnsebAudit: ['Device Audit Trail', 'Enrollment, update, revocation and administrator history']
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let client = null;
  let institutionId = null;
  let loading = false;

  function setWorkspaceTitle(tab) {
    const item = titles[tab];
    if (!item) return false;
    const title = document.getElementById('pageTitle');
    const subtitle = document.getElementById('pageSubtitle');
    if (title) title.textContent = item[0];
    if (subtitle) subtitle.textContent = item[1];
    return true;
  }
  function installNavigation() {
    if (typeof window.switchTab !== 'function' || window.switchTab.__cnsebWrapped) return false;
    const original = window.switchTab;
    const wrapped = function (tab) {
      original.call(this, tab);
      setWorkspaceTitle(tab);
      if (tab === 'cnsebDevices') loadDevices();
      if (tab === 'cnsebSessions') loadSessions();
    };
    wrapped.__cnsebWrapped = true;
    window.switchTab = wrapped;
    return true;
  }
  if (!installNavigation()) {
    let attempts = 0;
    const retry = window.setInterval(() => {
      attempts += 1;
      if (installNavigation() || attempts >= 30) window.clearInterval(retry);
    }, 100);
  }

  async function initialise() {
    client = window.sb || window.supabaseClient;
    if (!client?.auth) return;
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return;
    const { data: profile } = await client.from('consolidated_user_profiles_table')
      .select('institution_id,role').eq('user_id', user.id).maybeSingle();
    institutionId = profile?.institution_id || null;
    await Promise.all([loadDevices(), loadSessions()]);
  }

  function deviceHost() { return document.getElementById('cnsebDeviceTableHost'); }
  async function loadDevices() {
    const host = deviceHost();
    if (!host || !client) return;
    host.innerHTML = '<div class="cnseb-empty"><i class="fas fa-spinner fa-spin"></i><strong>Loading registered devices…</strong></div>';
    const { data, error } = await client.rpc('cnseb_admin_list_devices', { p_institution_id: institutionId });
    if (error) {
      host.innerHTML = '<div class="cnseb-empty"><i class="fas fa-triangle-exclamation"></i><strong>Could not load device registrations</strong><span>' + esc(error.message) + '</span></div>';
      return;
    }
    const rows = data?.devices || [];
    if (!rows.length) {
      host.innerHTML = '<div class="cnseb-empty"><i class="fas fa-laptop"></i><strong>No registered computers yet</strong><span>When a student launches CN-SEB from the signed-in portal, the installation will appear here for approval.</span></div>';
      return;
    }
    host.innerHTML = '<div style="overflow:auto"><table style="width:100%;min-width:850px;border-collapse:collapse"><thead><tr>' +
      ['Student','Computer','Platform','Version','Status','Last seen','Actions'].map(x=>'<th style="padding:11px;text-align:left;background:#f5f8fb;color:#476174;font-size:11px">'+x+'</th>').join('') +
      '</tr></thead><tbody>' + rows.map(d => {
        const status = String(d.approval_status || 'pending');
        const action = status === 'pending'
          ? '<button data-device-action="approved" data-device-id="'+esc(d.id)+'" class="cnseb-action">Approve</button> <button data-device-action="revoked" data-device-id="'+esc(d.id)+'" class="cnseb-action cnseb-danger">Reject</button>'
          : status === 'approved'
            ? '<button data-device-action="suspended" data-device-id="'+esc(d.id)+'" class="cnseb-action cnseb-warning">Suspend</button> <button data-device-action="revoked" data-device-id="'+esc(d.id)+'" class="cnseb-action cnseb-danger">Revoke</button>'
            : '<button data-device-action="approved" data-device-id="'+esc(d.id)+'" class="cnseb-action">Approve</button>';
        return '<tr><td style="padding:11px;border-bottom:1px solid #e8eef4"><b>'+esc(d.student_name||'Student')+'</b><small style="display:block;color:#8191a2">'+esc(d.student_id)+'</small></td>' +
          '<td style="padding:11px;border-bottom:1px solid #e8eef4">'+esc(d.device_name||'Windows computer')+'<small style="display:block;color:#8191a2">'+esc(d.device_details?.architecture||'')+'</small></td>' +
          '<td style="padding:11px;border-bottom:1px solid #e8eef4">'+esc(d.platform||'—')+'</td><td style="padding:11px;border-bottom:1px solid #e8eef4">'+esc(d.app_version||'—')+'</td>' +
          '<td style="padding:11px;border-bottom:1px solid #e8eef4"><b>'+esc(status.replace('_',' '))+'</b></td><td style="padding:11px;border-bottom:1px solid #e8eef4">'+esc(d.last_seen_at||d.first_registered||'—')+'</td>' +
          '<td style="padding:11px;border-bottom:1px solid #e8eef4;white-space:nowrap">'+action+'</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  async function loadSessions() {
    const host = document.getElementById('cnsebSessionTableHost');
    if (!host || !client) return;
    host.innerHTML = '<div class="cnseb-empty"><i class="fas fa-spinner fa-spin"></i><strong>Loading live sessions…</strong></div>';
    const rpc = institutionId ? 'get_cnseb_institution_monitor' : 'get_cnseb_superadmin_monitor';
    const args = institutionId ? { p_institution_id: institutionId } : { p_institution_id: null };
    const { data, error } = await client.rpc(rpc, args);
    if (error) {
      host.innerHTML = '<div class="cnseb-empty"><i class="fas fa-triangle-exclamation"></i><strong>Could not load live sessions</strong><span>'+esc(error.message)+'</span></div>';
      return;
    }
    const rows = data?.sessions || [];
    if (!rows.length) {
      host.innerHTML = '<div class="cnseb-empty"><i class="fas fa-desktop"></i><strong>No active or recent sessions</strong><span>Validated exam sessions will appear here while candidates are sitting examinations.</span></div>';
      return;
    }
    host.innerHTML = '<div style="overflow:auto"><table style="width:100%;min-width:650px;border-collapse:collapse"><thead><tr><th>Student</th><th>Exam</th><th>Started</th><th>Last heartbeat</th><th>Status</th></tr></thead><tbody>' +
      rows.map(s=>'<tr><td>'+esc(s.student_id)+'</td><td>'+esc(s.exam_title||s.exam_id)+'</td><td>'+esc(s.claimed_at||'—')+'</td><td>'+esc(s.last_heartbeat||'—')+'</td><td><b>'+(s.is_active?'Active':'Stale')+'</b></td></tr>').join('') +
      '</tbody></table></div>';
  }

  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-device-action][data-device-id]');
    if (!button || !client || button.disabled) return;
    const nextStatus = button.dataset.deviceAction;
    const promptText = nextStatus === 'approved' ? 'Approve this computer for secure examinations?' :
      nextStatus === 'suspended' ? 'Suspend this computer registration?' : 'Revoke this computer registration?';
    if (!window.confirm(promptText)) return;
    button.disabled = true;
    const { error } = await client.rpc('cnseb_admin_set_device_status', {
      p_device_id: button.dataset.deviceId, p_status: nextStatus
    });
    if (error) {
      window.alert('Device update failed: ' + error.message);
      button.disabled = false;
      return;
    }
    await loadDevices();
  });

  document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = '.cnseb-action{border:0;border-radius:7px;padding:7px 10px;background:#087f64;color:#fff;font-size:11px;font-weight:700;cursor:pointer}.cnseb-warning{background:#b7791f}.cnseb-danger{background:#a92d2d}.cnseb-action:disabled{opacity:.5;cursor:wait}';
    document.head.appendChild(style);
    const refresh = document.getElementById('cnsebDevicesRefresh');
    refresh?.addEventListener('click', loadDevices);
    document.getElementById('cnsebSessionsRefresh')?.addEventListener('click', loadSessions);
    initialise();
  });

  window.CampusNexusSecureBrowserWorkspace = Object.freeze({
    tabs: Object.keys(titles),
    open: function (tab) {
      if (!titles[tab] || typeof window.switchTab !== 'function') return false;
      window.switchTab(tab);
      return true;
    },
    refreshDevices: loadDevices,
    refreshSessions: loadSessions
  });
})();
