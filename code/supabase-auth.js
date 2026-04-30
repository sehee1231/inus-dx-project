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

  function loginPath() {
    return 'login.html?next=' + encodeURIComponent(location.pathname + location.search + location.hash);
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
    if (!user) {
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
  };
})(typeof window !== 'undefined' ? window : this);
