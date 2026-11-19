/* Campus Nexus — Global User Management
 * Platform-wide directory. Cross-institution data is delivered only by
 * server-side SECURITY DEFINER RPCs guarded by the primary platform admin.
 * Institution membership controls are available; global Auth account controls remain server-managed.
 */
(() => {
  'use strict';

  const state = {
    client: null, authorized: false, initialized: false, loading: false,
    rows: [], stats: {}, institutions: [], total: 0, offset: 0, limit: 50
  };
  const $ = (id) => document.getElementById(id);
  const roleLabel = (value) => String(value || 'unassigned')
    .replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const dateLabel = (value) => {
    if (!value) return 'Never / unavailable';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unavailable' : date.toLocaleString();
  };
  const stateLabel = (value) => roleLabel(value || 'unknown');

  async function verifyAccess() {
    const client = window.sb || window.supabase || window.supabaseClient;
    if (!client?.auth || typeof client.rpc !== 'function') {
      throw new Error('The authenticated database client is not ready.');
    }
    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError || !authData?.user) throw new Error('Your session has expired. Sign in again.');
    const { data, error } = await client.rpc('is_current_user_superadmin');
    if (error) throw error;
    if (data !== true) throw new Error('Global User Management is restricted to the Campus Nexus Platform Super Admin.');
    state.client = client;
    state.authorized = true;
    return client;
  }

  function setMessage(message, isError = false) {
    const node = $('cnGlobalUsersMessage');
    if (!node) return;
    node.textContent = message || '';
    node.classList.toggle('is-error', !!isError);
  }

  function renderStats(stats) {
    const host = $('cnGlobalUserStats');
    if (!host) return;
    const items = [
      ['Total accounts', stats.total_users, 'Auth accounts across the platform'],
      ['Active accounts', stats.active_users, 'Linked and enabled accounts'],
      ['Students', stats.students, 'Student profiles'],
      ['Lecturers', stats.lecturers, 'Lecturer profiles'],
      ['Institution admins', stats.institution_admins, 'Active administrator assignments'],
      ['Platform roles', stats.platform_roles, 'Superadmin / operator profile roles'],
      ['Missing profiles', stats.missing_profiles, 'Auth accounts without a Campus Nexus profile'],
      ['Orphan profiles', stats.orphan_profiles, 'Profiles without a matching Auth account'],
      ['Login disabled', stats.login_disabled, 'Profiles with login access disabled']
    ];
    host.replaceChildren();
    items.forEach(([label, value, note]) => {
      const card = document.createElement('article');
      card.className = 'cn-gu-stat';
      const title = document.createElement('span');
      title.textContent = label;
      const number = document.createElement('strong');
      number.textContent = Number(value || 0).toLocaleString();
      const detail = document.createElement('small');
      detail.textContent = note;
      card.append(title, number, detail);
      host.appendChild(card);
    });
  }

  function renderRows() {
    const body = $('cnGlobalUsersRows');
    if (!body) return;
    body.replaceChildren();
    if (!state.rows.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 7;
      td.className = 'cn-gu-empty';
      td.textContent = 'No accounts match the selected filters.';
      tr.appendChild(td);
      body.appendChild(tr);
    } else {
      state.rows.forEach((user, index) => {
        const tr = document.createElement('tr');
        const nameCell = document.createElement('td');
        const name = document.createElement('strong');
        name.textContent = user.full_name || (user.account_state === 'missing_profile' ? 'Profile not created' : 'Name unavailable');
        const email = document.createElement('small');
        email.textContent = user.email || 'No email address';
        nameCell.append(name, email);

        const role = document.createElement('td');
        role.textContent = roleLabel(user.role);
        const institution = document.createElement('td');
        institution.textContent = user.institution_name || 'Unassigned';
        const status = document.createElement('td');
        const badge = document.createElement('span');
        badge.className = 'cn-gu-status cn-gu-status-' + String(user.account_state || 'unknown').replace(/[^a-z0-9_-]/gi, '');
        badge.textContent = stateLabel(user.account_state);
        status.appendChild(badge);
        const lastLogin = document.createElement('td');
        lastLogin.textContent = dateLabel(user.last_sign_in_at);
        const security = document.createElement('td');
        security.textContent = (user.email_confirmed ? 'Email verified' : 'Email unverified') + ' · ' +
          (user.two_factor_enabled ? '2FA on' : '2FA off');
        const action = document.createElement('td');
        const view = document.createElement('button');
        view.type = 'button';
        view.className = 'cn-gu-view';
        view.textContent = 'View';
        view.addEventListener('click', () => showDetails(user));
        action.appendChild(view);
        tr.append(nameCell, role, institution, status, lastLogin, security, action);
        body.appendChild(tr);
      });
    }

    const start = state.total ? state.offset + 1 : 0;
    const end = Math.min(state.offset + state.rows.length, state.total);
    const count = $('cnGlobalUsersCount');
    if (count) count.textContent = 'Showing ' + start + '–' + end + ' of ' + state.total + ' matching records';
    const page = $('cnGlobalUsersPage');
    if (page) page.textContent = state.total ? ('Page ' + (Math.floor(state.offset / state.limit) + 1) + ' of ' + Math.ceil(state.total / state.limit)) : 'Page 0 of 0';
    const previous = $('cnGlobalUsersPrev');
    const next = $('cnGlobalUsersNext');
    if (previous) previous.disabled = state.offset <= 0 || state.loading;
    if (next) next.disabled = state.offset + state.limit >= state.total || state.loading;
  }

  function showDetails(user) {
    const dialog = $('cnGlobalUserDialog');
    if (!dialog) return;
    dialog.replaceChildren();
    const header = document.createElement('div');
    header.className = 'cn-gu-dialog-head';
    const title = document.createElement('h3');
    title.textContent = user.full_name || user.email || 'User account';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'cn-gu-close';
    close.textContent = 'Close';
    close.addEventListener('click', () => dialog.close());
    header.append(title, close);
    const grid = document.createElement('dl');
    grid.className = 'cn-gu-detail-grid';
    const fields = [
      ['Email', user.email], ['Role', roleLabel(user.role)],
      ['Institution', user.institution_name], ['Account state', stateLabel(user.account_state)],
      ['Program', user.program], ['Department', user.department],
      ['Student / admission ID', user.student_id], ['Created', dateLabel(user.created_at)],
      ['Last sign-in', dateLabel(user.last_sign_in_at)],
      ['Email verified', user.email_confirmed ? 'Yes' : 'No'],
      ['Two-factor authentication', user.two_factor_enabled ? 'Enabled' : 'Not enabled'],
      ['Login enabled', user.login_enabled === false ? 'No' : (user.login_enabled === true ? 'Yes' : 'Profile unavailable')]
    ];
    fields.forEach(([label, value]) => {
      const wrapper = document.createElement('div');
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = value == null || value === '' ? '—' : String(value);
      wrapper.append(dt, dd);
      grid.appendChild(wrapper);
    });
    dialog.append(header, grid);

    const isPlatformAccount = ['superadmin', 'platform_operator'].includes(String(user.role || '').toLowerCase());
    if (user.user_id && user.institution_id && !isPlatformAccount) {
      const controls = document.createElement('section');
      controls.className = 'cn-gu-management';
      const heading = document.createElement('h4');
      heading.textContent = 'Institution membership controls';
      const description = document.createElement('p');
      description.textContent = 'These actions affect this institution only. They do not disable the person’s global sign-in or memberships at other institutions.';
      const roleLabelNode = document.createElement('label');
      roleLabelNode.textContent = 'Institution role';
      roleLabelNode.htmlFor = 'cnGlobalUserRoleEdit';
      const roleSelect = document.createElement('select');
      roleSelect.id = 'cnGlobalUserRoleEdit';
      const allowedRoles = [
        ['student','Student'], ['lecturer','Lecturer'], ['institution_admin','Institution administrator'],
        ['finance_officer','Finance officer'], ['director','Director'], ['applicant','Applicant']
      ];
      allowedRoles.forEach(([value,label]) => roleSelect.add(new Option(label,value)));
      const roleIsSupported = allowedRoles.some(([value]) => value === user.role);
      if (roleIsSupported) {
        roleSelect.value = user.role;
      } else {
        const legacyRole = new Option(roleLabel(user.role) + ' (requires role mapping)', user.role || '');
        legacyRole.selected = true;
        legacyRole.disabled = true;
        roleSelect.add(legacyRole, 0);
      }
      const saveRole = document.createElement('button');
      saveRole.type = 'button';
      saveRole.className = 'cn-gu-action-btn primary';
      saveRole.textContent = 'Save role';
      saveRole.disabled = !roleIsSupported;
      saveRole.title = roleIsSupported ? 'Save institution role' : 'This legacy role must be mapped before it can be changed here';
      saveRole.addEventListener('click', () => applyMembershipAction(user,'set_role',roleSelect.value,saveRole));
      const statusActions = document.createElement('div');
      statusActions.className = 'cn-gu-status-actions';
      const suspend = document.createElement('button');
      suspend.type = 'button';
      suspend.className = 'cn-gu-action-btn danger';
      suspend.textContent = 'Suspend membership';
      suspend.addEventListener('click', () => applyMembershipAction(user,'set_status','suspended',suspend));
      const activate = document.createElement('button');
      activate.type = 'button';
      activate.className = 'cn-gu-action-btn';
      activate.textContent = 'Reactivate membership';
      activate.addEventListener('click', () => applyMembershipAction(user,'set_status','active',activate));
      statusActions.append(suspend,activate);
      const feedback = document.createElement('p');
      feedback.className = 'cn-gu-action-feedback';
      feedback.id = 'cnGlobalUserActionFeedback';
      controls.append(heading,description,roleLabelNode,roleSelect,saveRole,statusActions,feedback);
      dialog.appendChild(controls);
    } else {
      const note = document.createElement('p');
      note.className = 'cn-gu-dialog-note';
      note.textContent = isPlatformAccount
        ? 'Platform-level accounts are protected from institution membership changes.'
        : 'This account has no manageable institution membership.';
      dialog.appendChild(note);
    }

    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  async function applyMembershipAction(user, action, value, button) {
    if (!state.authorized || !state.client) {
      setMessage('Your platform administrator session is not available. Sign in again.', true);
      return;
    }
    const prompts = {
      set_status: value === 'suspended'
        ? 'Suspend this user’s membership in ' + (user.institution_name || 'the selected institution') + '?'
        : 'Reactivate this user’s membership in ' + (user.institution_name || 'the selected institution') + '?',
      set_role: 'Change this user’s role in ' + (user.institution_name || 'the selected institution') + ' to ' + roleLabel(value) + '?'
    };
    if (!window.confirm(prompts[action] || 'Apply this institution membership change?')) return;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Saving…';
    const feedback = $('cnGlobalUserActionFeedback');
    if (feedback) feedback.textContent = '';
    try {
      const { data, error } = await state.client.rpc('platform_manage_institution_user', {
        p_user_id: user.user_id,
        p_institution_id: user.institution_id,
        p_action: action,
        p_value: value,
        p_context: { source: 'global_user_management', user_agent: navigator.userAgent }
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || 'The membership change was not confirmed.');
      if (typeof $('cnGlobalUserDialog')?.close === 'function') $('cnGlobalUserDialog').close();
      setMessage(data.message || 'Institution membership updated.');
      await load();
    } catch (error) {
      console.error('[Campus Nexus membership control]', error);
      if (feedback) feedback.textContent = error.message || 'Unable to update institution membership.';
      setMessage(error.message || 'Unable to update institution membership.', true);
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  function populateInstitutions() {
    const select = $('cnGlobalUsersInstitution');
    if (!select) return;
    const current = select.value || 'all';
    select.replaceChildren(new Option('All institutions', 'all'));
    state.institutions.forEach((institution) => {
      select.add(new Option(institution.name + (institution.short_code ? ' · ' + institution.short_code : ''), institution.id));
    });
    select.value = [...select.options].some((option) => option.value === current) ? current : 'all';
  }

  async function loadInstitutions() {
    const { data, error } = await state.client
      .from('institutions')
      .select('id,name,short_code')
      .order('name', { ascending: true });
    if (error) throw error;
    state.institutions = Array.isArray(data) ? data : [];
    populateInstitutions();
  }

  async function load() {
    if (state.loading) return;
    state.loading = true;
    setMessage('Loading the global user directory…');
    renderRows();
    try {
      if (!state.authorized) await verifyAccess();
      const institution = $('cnGlobalUsersInstitution')?.value || 'all';
      const role = $('cnGlobalUsersRole')?.value || 'all';
      const status = $('cnGlobalUsersStatus')?.value || 'all';
      const search = $('cnGlobalUsersSearch')?.value?.trim() || '';
      const institutionId = institution === 'all' ? null : institution;
      const [statsResult, usersResult] = await Promise.all([
        state.client.rpc('platform_global_user_stats', { p_institution_id: institutionId }),
        state.client.rpc('platform_global_user_directory', {
          p_search: search || null,
          p_institution_id: institutionId,
          p_role: role === 'all' ? null : role,
          p_status: status === 'all' ? null : status,
          p_limit: state.limit,
          p_offset: state.offset
        })
      ]);
      if (statsResult.error) throw statsResult.error;
      if (usersResult.error) throw usersResult.error;
      state.stats = statsResult.data || {};
      state.rows = Array.isArray(usersResult.data) ? usersResult.data : [];
      state.total = Number(state.rows[0]?.total_count || 0);
      renderStats(state.stats);
      renderRows();
      setMessage('Secure directory updated ' + new Date().toLocaleTimeString() + '.');
    } catch (error) {
      console.error('[Campus Nexus Global Users]', error);
      state.rows = [];
      state.total = 0;
      renderRows();
      setMessage(error.message || 'Unable to load the global user directory.', true);
    } finally {
      state.loading = false;
      renderRows();
    }
  }

  function bindControls() {
    $('cnGlobalUsersRefresh')?.addEventListener('click', () => load());
    $('cnGlobalUsersInstitution')?.addEventListener('change', () => { state.offset = 0; load(); });
    $('cnGlobalUsersRole')?.addEventListener('change', () => { state.offset = 0; load(); });
    $('cnGlobalUsersStatus')?.addEventListener('change', () => { state.offset = 0; load(); });
    $('cnGlobalUsersSearch')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { state.offset = 0; load(); }
    });
    $('cnGlobalUsersSearchButton')?.addEventListener('click', () => { state.offset = 0; load(); });
    $('cnGlobalUsersPrev')?.addEventListener('click', () => {
      state.offset = Math.max(0, state.offset - state.limit);
      load();
    });
    $('cnGlobalUsersNext')?.addEventListener('click', () => {
      if (state.offset + state.limit < state.total) {
        state.offset += state.limit;
        load();
      }
    });
    $('cnGlobalUsersExport')?.addEventListener('click', exportCurrentPage);
  }

  function exportCurrentPage() {
    if (!state.rows.length) return;
    const columns = [
      ['full_name','Full name'], ['email','Email'], ['role','Role'],
      ['institution_name','Institution'], ['account_state','Account state'],
      ['program','Program'], ['department','Department'], ['student_id','Student ID'],
      ['created_at','Created at'], ['last_sign_in_at','Last sign-in'],
      ['email_confirmed','Email verified'], ['two_factor_enabled','2FA enabled']
    ];
    const quote = (value) => {
      let text = String(value ?? '');
      if (/^[=+@-]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    };
    const csv = [
      columns.map(([, label]) => quote(label)).join(','),
      ...state.rows.map((row) => columns.map(([key]) => quote(row[key])).join(','))
    ].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'campus-nexus-users-page-' + (Math.floor(state.offset / state.limit) + 1) + '-' + new Date().toISOString().slice(0,10) + '.csv';
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage('Exported the current filtered page.');
  }

  async function init() {
    if (state.initialized) return;
    state.initialized = true;
    const nav = document.querySelector('#mainNav a[data-tab="global-users"]');
    if (nav) nav.style.display = 'none';
    try {
      await verifyAccess();
      if (nav) nav.style.display = 'flex';
      bindControls();
      await loadInstitutions();
    } catch (error) {
      if (nav) nav.style.display = 'none';
      if (error.message === 'The authenticated database client is not ready.') {
        window.addEventListener('load', () => initRetry(), { once: true });
      } else {
        console.warn('[Campus Nexus Global Users] Access not enabled:', error.message);
      }
    }
  }

  async function initRetry() {
    try {
      await verifyAccess();
      const nav = document.querySelector('#mainNav a[data-tab="global-users"]');
      if (nav) nav.style.display = '';
      bindControls();
      await loadInstitutions();
    } catch (error) {
      console.warn('[Campus Nexus Global Users] Access not enabled:', error.message);
    }
  }

  window.loadGlobalUserManagement = load;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
