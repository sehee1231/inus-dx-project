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
    if (!p) return '/project.html';
    if (p.charAt(0) === '/') return p;
    return '/' + p.replace(/^\.?\//, '');
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
      location.href = '/login.html';
    });
    document.body.appendChild(btn);
  }

  function normalizeNextPath(raw) {
    var n = String(raw || '').trim();
    if (!n) return '/project.html';
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
    if (location.pathname.indexOf('/login.html') !== -1) return;
    var user = await getSessionUser();
    if (!user || user.is_anonymous) return;
    var profile = null;
    try {
      profile = await getMyProfile();
    } catch (e) {
      return;
    }
    if (!profile || profile.role !== 'admin') return;
    var navs = document.querySelectorAll('aside nav, nav[aria-label="주 메뉴"], nav');
    navs.forEach(function (nav) {
      appendAdminLinkToNav(nav);
    });
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
    mountAdminMenu: mountAdminMenu,
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
      mountAdminMenu().catch(function () {});
    });
  }

})(typeof window !== 'undefined' ? window : this);
