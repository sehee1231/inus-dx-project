(function (global) {
  'use strict';

  var PROJECT_URL = 'https://hwynvebtrivhojwdhoxb.supabase.co';
  var PUBLISHABLE_KEY = 'sb_publishable_QsxW_7X0vjjUt8ffpwxezA_9a6diH-g';

  var client = null;
  function getClient() {
    if (client) return client;
    if (!global.supabase || !global.supabase.createClient) return null;
    client = global.supabase.createClient(PROJECT_URL, PUBLISHABLE_KEY);
    return client;
  }

  function sameDirPage(file) {
    try {
      return new URL(String(file || ''), location.href).href;
    } catch (e) {
      return String(file || '');
    }
  }

  function toAbsAppPath(path) {
    var p = String(path || '');
    if (!p) return sameDirPage('project.html');
    if (p.charAt(0) === '/') return p;
    return '/' + p.replace(/^\.?\//, '');
  }

  function loginPath() {
    return sameDirPage('login.html') + '?next=' + encodeURIComponent(location.pathname + location.search + location.hash);
  }

  async function getSessionUser() {
    var c = getClient();
    if (!c) return null;
    var sessionRes = await c.auth.getSession();
    var su = sessionRes && sessionRes.data && sessionRes.data.session && sessionRes.data.session.user;
    if (su) return su;
    var res = await c.auth.getUser();
    if (res && res.data && res.data.user) return res.data.user;
    return null;
  }

  async function requireAuth() {
    var user = await getSessionUser();
    if (!user || user.is_anonymous) {
      if (user && user.is_anonymous) {
        try { await signOut(); } catch (e) {}
      }
      location.replace(loginPath());
      return null;
    }
    return user;
  }

  async function signOut() {
    var c = getClient();
    if (!c) return;
    await c.auth.signOut();
  }

  function mountLogoutButton(user) {
    if (!user || user.is_anonymous) return;
    if (location.pathname.indexOf('login.html') !== -1) return;
    if (document.getElementById('moa-logout-btn')) return;
    var btn = document.createElement('button');
    btn.id = 'moa-logout-btn';
    btn.type = 'button';
    btn.textContent = '로그아웃';
    btn.className = 'fixed right-4 top-4 z-[90] rounded-lg border border-zinc-700/90 bg-zinc-900/95 px-3 py-1.5 text-2xs font-semibold text-zinc-200 shadow-xl shadow-black/40 transition hover:border-zinc-500 hover:bg-zinc-800';
    btn.addEventListener('click', async function () {
      btn.disabled = true;
      try {
        await signOut();
      } catch (e) {}
      location.href = sameDirPage('login.html');
    });
    document.body.appendChild(btn);
  }

  function normalizeNextPath(raw) {
    var n = String(raw || '').trim();
    if (!n) return sameDirPage('project.html');
    try {
      if (/^https?:\/\//i.test(n)) {
        var u = new URL(n);
        return toAbsAppPath(u.pathname + (u.search || '') + (u.hash || ''));
      }
    } catch (e) {}
    return toAbsAppPath(n);
  }

  function isMissingApprovalStatusError(err) {
    var msg = err && err.message ? String(err.message) : '';
    return msg.indexOf('approval_status') !== -1;
  }

  async function getProfileByUserId(c, userId) {
    var withApproval = await c.from('profiles').select('id,username,display_name,role,approval_status').eq('id', userId).maybeSingle();
    if (!withApproval.error) return withApproval.data || null;
    if (!isMissingApprovalStatusError(withApproval.error)) throw new Error(withApproval.error.message);
    var legacy = await c.from('profiles').select('id,username,display_name,role').eq('id', userId).maybeSingle();
    if (legacy.error) throw new Error(legacy.error.message);
    if (!legacy.data) return null;
    legacy.data.approval_status = 'approved';
    return legacy.data;
  }

  async function ensureProfileRow(user, payload) {
    var c = getClient();
    if (!c || !user || !user.id) return null;
    var username = String(payload && payload.username || '').trim();
    var displayName = String(payload && payload.display_name || '').trim();
    var row = {
      id: user.id,
      username: username || null,
      display_name: displayName || username || null,
    };
    var up = await c.from('profiles').upsert(row, { onConflict: 'id' });
    if (up.error) throw new Error(up.error.message);
    return await getProfileByUserId(c, user.id);
  }

  async function ensureProfileRowIfMissing(user, payload) {
    var c = getClient();
    if (!c || !user || !user.id) return null;
    var chk = await c.from('profiles').select('id').eq('id', user.id).maybeSingle();
    if (chk.error) throw new Error(chk.error.message);
    if (chk.data) return chk.data;
    var email = String(user.email || '').trim();
    var base = email ? email.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 20) : 'user';
    if (!base) base = 'user';
    var auto = {
      username: base + '_' + String(user.id).replace(/-/g, '').slice(0, 8),
      display_name: email || base,
    };
    var hasCustom = payload && (String(payload.username || '').trim() || String(payload.display_name || '').trim());
    return ensureProfileRow(user, hasCustom ? payload : auto);
  }

  async function getMyProfile() {
    var c = getClient();
    var user = await getSessionUser();
    if (!c || !user || !user.id) return null;
    return await getProfileByUserId(c, user.id);
  }

  function isProfileApproved(profile) {
    if (!profile) return false;
    if (profile.role === 'admin') return true;
    var s = profile.approval_status;
    if (s === undefined || s === null || s === '') return true;
    return s === 'approved';
  }

  function approvalExemptPath() {
    if (typeof location === 'undefined') return true;
    var p = location.pathname || '';
    if (p.indexOf('login.html') !== -1) return true;
    if (p.indexOf('signup.html') !== -1) return true;
    if (p.indexOf('pending-approval.html') !== -1) return true;
    return false;
  }

  async function gateAuthOrRedirect() {
    if (approvalExemptPath()) return null;
    var user = await getSessionUser();
    if (user && !user.is_anonymous) return user;
    if (user && user.is_anonymous) {
      try { await signOut(); } catch (e) {}
    }
    var hasEntered = false;
    try {
      var entryKey = (global.MoaSiteEntry && global.MoaSiteEntry.enteredKey) || 'moa_site_entry_v2';
      hasEntered = !!localStorage.getItem(entryKey);
    } catch (e) {}
    var goLogin = hasEntered;
    var base = goLogin ? sameDirPage('login.html') : sameDirPage('signup.html');
    var nextQ = goLogin ? ('?next=' + encodeURIComponent(location.pathname + location.search + location.hash)) : '';
    location.replace(base + nextQ);
    return null;
  }

  async function gateApprovalOrRedirect() {
    if (approvalExemptPath()) return;
    var user = await gateAuthOrRedirect();
    if (!user) return;
    var profile;
    try {
      profile = await getMyProfile();
    } catch (e) {
      return;
    }
    if (isProfileApproved(profile)) return;
    var q = profile && profile.approval_status === 'rejected' ? '?reason=rejected' : '';
    location.replace(sameDirPage('pending-approval.html') + q);
  }

  function appendAdminLinkToNav(nav) {
    if (!nav || nav.querySelector('[data-admin-menu-link]')) return;
    var a = document.createElement('a');
    a.href = 'admin.html';
    a.setAttribute('data-admin-menu-link', '1');
    a.className = 'flex items-center gap-3 rounded-lg px-3 py-2 text-zinc-400 transition hover:bg-zinc-800/80 hover:text-zinc-100';
    a.innerHTML = '<svg class="h-5 w-5 shrink-0 opacity-80" fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3l7 4v5c0 4.2-2.7 8.1-7 9-4.3-.9-7-4.8-7-9V7l7-4zm0 6a2 2 0 100 4 2 2 0 000-4zm-3 8a3 3 0 016 0"/></svg>관리자';
    nav.appendChild(a);
  }

  async function mountAdminMenu() {
    if (location.pathname.indexOf('login.html') !== -1) return;
    if (location.pathname.indexOf('signup.html') !== -1) return;
    var user = await getSessionUser();
    if (!user || user.is_anonymous) return;
    var profile = null;
    try {
      profile = await getMyProfile();
    } catch (e) {
      console.warn('[MoaAuth] mountAdminMenu profile load failed:', e && e.message ? e.message : e);
      return;
    }
    if (!profile || !isProfileApproved(profile) || profile.role !== 'admin') return;
    var navs = document.querySelectorAll('aside nav, nav[aria-label="주 메뉴"], nav');
    navs.forEach(function (nav) {
      appendAdminLinkToNav(nav);
    });
  }

  async function updateMyPassword(newPassword) {
    var c = getClient();
    if (!c) throw new Error('연결할 수 없습니다.');
    var pw = String(newPassword || '');
    if (pw.length < 6) throw new Error('비밀번호는 6자 이상이어야 합니다.');
    var res = await c.auth.updateUser({ password: pw });
    if (res.error) throw new Error(res.error.message);
  }

  async function updateMyProfileName(displayName) {
    var c = getClient();
    var user = await getSessionUser();
    if (!c || !user || !user.id || user.is_anonymous) throw new Error('로그인이 필요합니다.');
    var clean = String(displayName || '').trim();
    if (!clean) throw new Error('이름을 입력해 주세요.');
    var slug = clean.replace(/[^\uac00-\ud7a3a-zA-Z0-9._-]/g, '').slice(0, 20);
    if (!slug) slug = 'user';
    var username = slug + '_' + String(user.id).replace(/-/g, '').slice(0, 8);
    var res = await c.from('profiles').update({ display_name: clean, username: username }).eq('id', user.id);
    if (res.error) throw new Error(res.error.message);
  }

  global.MoaAuth = {
    projectUrl: PROJECT_URL,
    getClient: getClient,
    getSessionUser: getSessionUser,
    requireAuth: requireAuth,
    signOut: signOut,
    ensureProfileRow: ensureProfileRow,
    ensureProfileRowIfMissing: ensureProfileRowIfMissing,
    getMyProfile: getMyProfile,
    isProfileApproved: isProfileApproved,
    gateApprovalOrRedirect: gateApprovalOrRedirect,
    updateMyPassword: updateMyPassword,
    updateMyProfileName: updateMyProfileName,
    normalizeNextPath: normalizeNextPath,
    mountLogoutButton: mountLogoutButton,
    mountAdminMenu: mountAdminMenu,
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
      gateApprovalOrRedirect().catch(function () {});
      mountAdminMenu().catch(function () {});
      var c = getClient();
      if (c && c.auth && c.auth.onAuthStateChange) {
        c.auth.onAuthStateChange(function () {
          gateApprovalOrRedirect().catch(function () {});
          mountAdminMenu().catch(function () {});
        });
      }
    });
  }

})(typeof window !== 'undefined' ? window : this);
