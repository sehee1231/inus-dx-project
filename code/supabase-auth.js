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

  function toAbsAppPath(path) {
    var p = String(path || '');
    if (!p) return '/code/project.html';
    if (p.indexOf('/code/') === 0 || p.indexOf('/login.html') === 0) return p;
    if (p.charAt(0) === '/') return '/code' + p;
    return '/code/' + p.replace(/^\.?\//, '');
  }

  function loginPath() {
    return '/login.html?next=' + encodeURIComponent(location.pathname + location.search + location.hash);
  }

  async function getSessionUser() {
    var c = getClient();
    if (!c) return null;
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
    if (location.pathname.indexOf('/login.html') !== -1) return;
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
      location.href = '/code/login.html';
    });
    document.body.appendChild(btn);
  }

  function normalizeNextPath(raw) {
    var n = String(raw || '').trim();
    if (!n) return '/code/project.html';
    try {
      if (/^https?:\/\//i.test(n)) {
        var u = new URL(n);
        return toAbsAppPath(u.pathname + (u.search || '') + (u.hash || ''));
      }
    } catch (e) {}
    return toAbsAppPath(n);
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
    var res = await c.from('profiles').upsert(row, { onConflict: 'id' }).select('id,username,display_name,role').single();
    if (res.error) throw new Error(res.error.message);
    return res.data;
  }

  async function getMyProfile() {
    var c = getClient();
    var user = await getSessionUser();
    if (!c || !user || !user.id) return null;
    var res = await c.from('profiles').select('id,username,display_name,role').eq('id', user.id).maybeSingle();
    if (res.error) throw new Error(res.error.message);
    return res.data || null;
  }

  global.MoaAuth = {
    getClient: getClient,
    getSessionUser: getSessionUser,
    requireAuth: requireAuth,
    signOut: signOut,
    ensureProfileRow: ensureProfileRow,
    getMyProfile: getMyProfile,
    normalizeNextPath: normalizeNextPath,
    mountLogoutButton: mountLogoutButton,
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
      getSessionUser().then(function (u) {
        if (u && !u.is_anonymous) mountLogoutButton(u);
      }).catch(function () {});
    });
  }
})(typeof window !== 'undefined' ? window : this);
