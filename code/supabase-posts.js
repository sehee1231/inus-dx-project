(function (global) {
  'use strict';

  var PROJECT_URL = 'https://hwynvebtrivhojwdhoxb.supabase.co';
  var PUBLISHABLE_KEY = 'sb_publishable_QsxW_7X0vjjUt8ffpwxezA_9a6diH-g';
  var TABLE = 'posts';
  var LS_POSTS = 'eduai_posts_v1';
  var LS_MIGRATED = 'eduai_posts_supabase_migrated_v1';

  var client = null;
  function getClient() {
    if (client) return client;
    if (!global.supabase || !global.supabase.createClient) return null;
    client = global.supabase.createClient(PROJECT_URL, PUBLISHABLE_KEY);
    return client;
  }

  function safeParse(raw, fallback) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function fromRow(row) {
    return {
      slug: row.slug,
      cat: row.cat || 'community',
      title: row.title || '',
      excerpt: row.excerpt || '',
      body: row.body || '',
      link: row.link || '',
      authorName: row.author_name || '세희',
      authorId: row.author_id || null,
      createdAt: row.created_at || '',
      updatedAt: row.updated_at || '',
    };
  }

  function toRow(post) {
    return {
      slug: post.slug,
      cat: post.cat || 'community',
      title: post.title || '',
      excerpt: post.excerpt || '',
      body: post.body || '',
      link: post.link || '',
      author_name: post.authorName || '세희',
      author_id: post.authorId || null,
      created_at: post.createdAt || new Date().toISOString(),
      updated_at: post.updatedAt || null,
    };
  }

  async function ensureUserId() {
    var c = getClient();
    if (!c) return null;
    var got = await c.auth.getUser();
    var u = got && got.data && got.data.user;
    if (u && u.id) return u.id;
    var sign = await c.auth.signInAnonymously();
    var su = sign && sign.data && (sign.data.user || (sign.data.session && sign.data.session.user));
    if (su && su.id) return su.id;
    var retry = await c.auth.getUser();
    var ru = retry && retry.data && retry.data.user;
    return ru && ru.id ? ru.id : null;
  }

  function loadLocalPosts() {
    var arr = safeParse(localStorage.getItem(LS_POSTS) || '[]', []);
    return Array.isArray(arr) ? arr : [];
  }

  function upsertLocalMirror(post) {
    var local = loadLocalPosts();
    var found = false;
    for (var i = 0; i < local.length; i++) {
      if (local[i] && local[i].slug === post.slug) {
        local[i] = post;
        found = true;
        break;
      }
    }
    if (!found) local.unshift(post);
    local.sort(function (a, b) {
      return String(b.createdAt || b.updatedAt || '').localeCompare(String(a.createdAt || a.updatedAt || ''));
    });
    localStorage.setItem(LS_POSTS, JSON.stringify(local));
  }

  async function fetchPosts() {
    var c = getClient();
    if (!c) return loadLocalPosts();
    var res = await c
      .from(TABLE)
      .select('slug,cat,title,excerpt,body,link,author_name,author_id,created_at,updated_at')
      .order('created_at', { ascending: false });
    if (res.error) {
      console.error('[MoaPostsDB] fetchPosts error:', res.error.message);
      return loadLocalPosts();
    }
    return (res.data || []).map(fromRow);
  }

  async function fetchPostBySlug(slug) {
    var c = getClient();
    if (!c) {
      var local = loadLocalPosts();
      for (var i = 0; i < local.length; i++) {
        if (local[i] && local[i].slug === slug) return local[i];
      }
      return null;
    }
    var res = await c
      .from(TABLE)
      .select('slug,cat,title,excerpt,body,link,author_name,author_id,created_at,updated_at')
      .eq('slug', slug)
      .maybeSingle();
    if (res.error) {
      console.error('[MoaPostsDB] fetchPostBySlug error:', res.error.message);
      return null;
    }
    return res.data ? fromRow(res.data) : null;
  }

  async function upsertPost(post) {
    var c = getClient();
    if (!c) {
      upsertLocalMirror(post);
      return post;
    }
    var uid = await ensureUserId();
    if (!uid) throw new Error('로그인 정보를 확인할 수 없습니다.');
    var existing = await c.from(TABLE).select('slug,author_id,created_at').eq('slug', post.slug).maybeSingle();
    if (existing.error && existing.error.code !== 'PGRST116') throw new Error(existing.error.message);
    var ex = existing.data || null;
    if (ex && ex.author_id && ex.author_id !== uid) {
      throw new Error('작성자만 수정할 수 있습니다.');
    }
    var row = toRow(post);
    row.author_id = ex && ex.author_id ? ex.author_id : uid;
    if (ex && ex.created_at && !row.created_at) row.created_at = ex.created_at;
    var res = await c.from(TABLE).upsert(row, { onConflict: 'slug' }).select('slug,cat,title,excerpt,body,link,author_name,author_id,created_at,updated_at').single();
    if (res.error) throw new Error(res.error.message);
    var normalized = fromRow(res.data);
    upsertLocalMirror(normalized);
    return normalized;
  }

  async function deletePostBySlug(slug) {
    var c = getClient();
    var local = loadLocalPosts().filter(function (p) {
      return p && p.slug !== slug;
    });
    localStorage.setItem(LS_POSTS, JSON.stringify(local));
    if (!c) return;
    var uid = await ensureUserId();
    if (!uid) throw new Error('로그인 정보를 확인할 수 없습니다.');
    var res = await c.from(TABLE).delete().eq('slug', slug).eq('author_id', uid);
    if (res.error) throw new Error(res.error.message);
  }

  async function migrateLocalPostsOnce() {
    console.log('[MIGRATE] start');
    if (localStorage.getItem(LS_MIGRATED) === 'done') {
      console.log('[MIGRATE] skipped: already done');
      return { migrated: 0, skipped: true, reason: 'already_done' };
    }
    var c = getClient();
    if (!c) {
      console.log('[MIGRATE] skipped: no supabase client');
      return { migrated: 0, skipped: true, reason: 'no_client' };
    }
    var uid = await ensureUserId();
    if (!uid) {
      console.log('[MIGRATE] skipped: no auth uid');
      return { migrated: 0, skipped: true, reason: 'no_uid' };
    }
    var local = loadLocalPosts().filter(function (p) {
      return p && p.slug;
    });
    console.log('[MIGRATE] local posts:', local.length);
    if (!local.length) {
      console.log('[MIGRATE] skipped: local empty');
      return { migrated: 0, skipped: true, reason: 'local_empty' };
    }

    var slugs = local.map(function (p) { return p.slug; });
    var existingRes = await c.from(TABLE).select('slug').in('slug', slugs);
    if (existingRes.error) {
      console.log('[MIGRATE] failed while reading existing slugs:', existingRes.error);
      throw new Error(existingRes.error.message);
    }
    var existingSet = {};
    (existingRes.data || []).forEach(function (r) { existingSet[r.slug] = true; });

    var missing = local.filter(function (p) {
      return !existingSet[p.slug];
    });
    console.log('[MIGRATE] missing posts to insert:', missing.length);

    if (missing.length) {
      var rows = missing.map(function (p) {
        var row = toRow(p);
        row.author_id = uid;
        return row;
      });
      var ins = await c.from(TABLE).insert(rows);
      if (ins.error) {
        console.log('[MIGRATE] insert failed:', ins.error);
        throw new Error(ins.error.message);
      }
      console.log('[MIGRATE] success. inserted:', rows.length);
      localStorage.setItem(LS_MIGRATED, 'done');
      return { migrated: rows.length, skipped: false, reason: 'inserted' };
    }

    console.log('[MIGRATE] nothing to insert, marked done');
    localStorage.setItem(LS_MIGRATED, 'done');
    return { migrated: 0, skipped: false, reason: 'no_missing' };
  }

  global.MoaPostsDB = {
    fetchPosts: fetchPosts,
    fetchPostBySlug: fetchPostBySlug,
    upsertPost: upsertPost,
    deletePostBySlug: deletePostBySlug,
    migrateLocalPostsOnce: migrateLocalPostsOnce,
    getCurrentUserId: ensureUserId,
  };
})(typeof window !== 'undefined' ? window : this);
