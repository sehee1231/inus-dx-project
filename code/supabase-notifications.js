(function (global) {
  'use strict';

  var LS_MENTION_INBOX = 'eduai_mention_inbox_v1';

  function safeParse(raw, fallback) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function getClient() {
    if (global.MoaAuth && global.MoaAuth.getClient) {
      return global.MoaAuth.getClient();
    }
    return null;
  }

  async function getCurrentUser() {
    if (global.MoaAuth && global.MoaAuth.getSessionUser) {
      return await global.MoaAuth.getSessionUser();
    }
    return null;
  }

  function writeLocalMention(fromUser, toUser, ctx) {
    var arr = safeParse(localStorage.getItem(LS_MENTION_INBOX), []);
    if (!Array.isArray(arr)) arr = [];
    arr.unshift({
      id: 'n-' + Date.now() + '-' + Math.floor(Math.random() * 1e9),
      at: new Date().toISOString(),
      read: false,
      toUser: toUser,
      fromUser: fromUser,
      postSlug: ctx.postSlug || '',
      postTitle: ctx.postTitle || '',
      snippet: String(ctx.snippet || '').slice(0, 160),
      source: ctx.source || 'post',
    });
    localStorage.setItem(LS_MENTION_INBOX, JSON.stringify(arr.slice(0, 300)));
  }

  async function mapMentionTargets(names) {
    var c = getClient();
    if (!c || !names || !names.length) return [];
    var cleaned = names
      .map(function (name) { return String(name || '').trim(); })
      .filter(function (name) { return !!name; });
    if (!cleaned.length) return [];

    var usernameRes = await c.from('profiles').select('id,username,display_name').in('username', cleaned);
    if (usernameRes.error) throw new Error(usernameRes.error.message);
    var targets = usernameRes.data || [];
    if (targets.length) return targets;

    var displayRes = await c.from('profiles').select('id,username,display_name').in('display_name', cleaned);
    if (displayRes.error) throw new Error(displayRes.error.message);
    return displayRes.data || [];
  }

  async function createMentionNotifications(opts) {
    var c = getClient();
    if (!c) return { inserted: 0, queuedEmails: 0, fallback: true };
    var user = await getCurrentUser();
    if (!user || !user.id || user.is_anonymous) {
      return { inserted: 0, queuedEmails: 0, fallback: true };
    }

    var names = Array.isArray(opts && opts.names) ? opts.names : [];
    if (!names.length) return { inserted: 0, queuedEmails: 0, fallback: false };

    var fromName = String((opts && opts.fromUserName) || '사용자');
    var ctx = {
      postSlug: String((opts && opts.postSlug) || ''),
      postTitle: String((opts && opts.postTitle) || ''),
      snippet: String((opts && opts.snippet) || '').slice(0, 160),
      source: String((opts && opts.source) || 'post'),
    };
    var emailAlso = !!(opts && opts.emailAlso);

    var targets = await mapMentionTargets(names);
    if (!targets.length) {
      names.forEach(function (toUser) {
        writeLocalMention(fromName, toUser, ctx);
      });
      return { inserted: 0, queuedEmails: 0, fallback: true };
    }

    var uniq = {};
    var recipients = [];
    targets.forEach(function (target) {
      if (!target || !target.id) return;
      if (target.id === user.id) return;
      if (uniq[target.id]) return;
      uniq[target.id] = true;
      recipients.push(target);
    });
    if (!recipients.length) return { inserted: 0, queuedEmails: 0, fallback: false };

    var rows = recipients.map(function (target) {
      var toLabel = target.username || target.display_name || '사용자';
      return {
        to_user_id: target.id,
        from_user_id: user.id,
        post_slug: ctx.postSlug || null,
        type: 'mention',
        message: fromName + '님이 @' + toLabel + ' 님을 멘션했습니다.',
      };
    });
    var ins = await c.from('notifications').insert(rows).select('id,to_user_id');
    if (ins.error) throw new Error(ins.error.message);

    var queued = 0;
    if (emailAlso && ins.data && ins.data.length) {
      var jobs = ins.data.map(function (row) {
        return {
          notification_id: row.id,
          to_user_id: row.to_user_id,
          template: 'mention',
          payload: {
            post_slug: ctx.postSlug || null,
            post_title: ctx.postTitle || '',
            snippet: ctx.snippet || '',
            source: ctx.source || 'post',
          },
        };
      });
      var q = await c.from('email_jobs').insert(jobs);
      if (!q.error) queued = jobs.length;
    }

    return { inserted: rows.length, queuedEmails: queued, fallback: false };
  }

  async function fetchMyNotifications(limit) {
    var c = getClient();
    var user = await getCurrentUser();
    if (!c || !user || !user.id) return [];
    var size = Math.max(1, Math.min(200, Number(limit) || 60));
    var res = await c
      .from('notifications')
      .select('id,to_user_id,from_user_id,post_slug,type,message,read,created_at')
      .eq('to_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(size);
    if (res.error) throw new Error(res.error.message);

    var rows = res.data || [];
    var fromIds = {};
    rows.forEach(function (row) {
      if (row && row.from_user_id) fromIds[row.from_user_id] = true;
    });
    var ids = Object.keys(fromIds);
    var profileById = {};
    if (ids.length) {
      var p = await c.from('profiles').select('id,username,display_name').in('id', ids);
      if (!p.error) {
        (p.data || []).forEach(function (item) {
          profileById[item.id] = item;
        });
      }
    }

    return rows.map(function (row) {
      var profile = profileById[row.from_user_id] || null;
      return {
        id: row.id,
        at: row.created_at,
        read: !!row.read,
        postSlug: row.post_slug || '',
        type: row.type || 'mention',
        message: row.message || '',
        fromUser: profile ? (profile.username || profile.display_name || '알 수 없음') : '알 수 없음',
      };
    });
  }

  async function markNotificationRead(id) {
    var c = getClient();
    if (!c || !id) return false;
    var res = await c.from('notifications').update({ read: true }).eq('id', id);
    return !res.error;
  }

  global.MoaNotifications = {
    createMentionNotifications: createMentionNotifications,
    fetchMyNotifications: fetchMyNotifications,
    markNotificationRead: markNotificationRead,
  };
})(typeof window !== 'undefined' ? window : this);
