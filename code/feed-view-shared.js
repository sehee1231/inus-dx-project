(function (global) {
  var LS_VIEW = 'eduai_feed_view_v1';
  var CAT_LABEL = {
    planning: '기획',
    design: '디자인',
    development: '개발',
    curriculum: '커리큘럼',
    video: '영상',
    prompt: '프롬프트',
    output: '결과물',
    insight: '인사이트',
    community: '커뮤니티',
  };

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function escUrlAttr(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;');
  }

  function formatPostDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.';
  }

  function listCatBadgeClass(cat) {
    var keys = {
      planning: 'list-cat-planning',
      design: 'list-cat-design',
      development: 'list-cat-development',
      curriculum: 'list-cat-curriculum',
      video: 'list-cat-video',
      prompt: 'list-cat-prompt',
      output: 'list-cat-output',
      insight: 'list-cat-insight',
      community: 'list-cat-community',
    };
    var suffix = keys[cat] || 'list-cat-fallback';
    return 'list-cat-badge ' + suffix;
  }

  function catLabel(cat) {
    return CAT_LABEL[cat] || '커뮤니티';
  }

  function getView() {
    try {
      var v = localStorage.getItem(LS_VIEW);
      return v === 'list' ? 'list' : 'grid';
    } catch (e) {
      return 'grid';
    }
  }

  function setView(mode, persist) {
    var m = mode === 'list' ? 'list' : 'grid';
    if (persist) {
      try {
        localStorage.setItem(LS_VIEW, m);
      } catch (e) {}
    }
    return m;
  }

  function resolveViewFromUrl(searchParams) {
    if (!searchParams || !searchParams.get) return null;
    var vp = searchParams.get('view');
    if (vp === 'list') return 'list';
    if (vp === 'grid' || vp === 'feed') return 'grid';
    return null;
  }

  function migrateBrowseViewKey() {
    try {
      var old = localStorage.getItem('eduai_browse_view');
      if (old === 'list' || old === 'feed') {
        localStorage.setItem(LS_VIEW, old === 'list' ? 'list' : 'grid');
        localStorage.removeItem('eduai_browse_view');
      }
    } catch (e) {}
  }

  var VIEW_BTN_OFF =
    'view-btn inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/80 text-zinc-400 shadow-sm transition hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-100';
  var VIEW_BTN_ON =
    'view-btn inline-flex h-10 w-10 items-center justify-center rounded-xl border border-sky-600 bg-sky-600 text-white shadow-md shadow-sky-900/30 transition';

  function syncToggleButtons(mode, btnGrid, btnList) {
    if (btnGrid) {
      btnGrid.className = mode === 'grid' ? VIEW_BTN_ON : VIEW_BTN_OFF;
      btnGrid.setAttribute('aria-pressed', mode === 'grid' ? 'true' : 'false');
    }
    if (btnList) {
      btnList.className = mode === 'list' ? VIEW_BTN_ON : VIEW_BTN_OFF;
      btnList.setAttribute('aria-pressed', mode === 'list' ? 'true' : 'false');
    }
  }

  var FEED_GRID_CLASS =
    'feed feed-all feed--grid grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4';
  var FEED_LIST_CLASS = 'feed feed-all feed--list flex flex-col gap-3';

  function applyFeedRootClass(el, mode) {
    if (!el) return;
    el.className = mode === 'list' ? FEED_LIST_CLASS : FEED_GRID_CLASS;
  }

  /**
   * @param {{ title?: string, slug: string, cat?: string, authorName?: string, createdAt?: string, updatedAt?: string }} p
   */
  function postListRowHtml(p) {
    var label = catLabel(p.cat);
    var slug = encodeURIComponent(p.slug);
    var t = esc(p.title || '제목 없음');
    var dateStr = formatPostDate(p.createdAt || p.updatedAt);
    var badgeCls = listCatBadgeClass(p.cat);
    var iso = p.createdAt || p.updatedAt || '';
    var rawAuthor = String((p.authorName || '세희').trim() || '세희');
    var authorEsc = esc(rawAuthor);
    var initialSource = rawAuthor.length ? rawAuthor : '세';
    var initialEsc = esc(initialSource.slice(0, 1));
    return (
      '<article data-feed-href="post-detail.html?slug=' +
      slug +
      '" class="post-list-item cursor-pointer rounded-xl border border-zinc-800/90 bg-zinc-900/75 px-6 py-5 shadow-lg shadow-black/25 ring-1 ring-white/[0.05] transition hover:border-zinc-700 hover:bg-zinc-900">' +
      '<div class="flex flex-col gap-3">' +
      '<div class="flex flex-wrap gap-2">' +
      '<span class="' +
      badgeCls +
      '">' +
      esc(label) +
      '</span>' +
      '</div>' +
      '<h2 class="text-[1.05rem] font-semibold leading-snug text-zinc-100 sm:text-[1.12rem]">' +
      t +
      '</h2>' +
      '<div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">' +
      '<span class="inline-flex items-center gap-1.5">' +
      '<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-sky-700 text-[0.5625rem] font-semibold leading-none text-white opacity-95 shadow-inner shadow-black/25">' +
      initialEsc +
      '</span>' +
      '<span class="font-medium text-zinc-500">' +
      authorEsc +
      '</span>' +
      '</span>' +
      '<span class="inline-flex items-center gap-1.5 text-zinc-500">' +
      '<svg class="h-3.5 w-3.5 shrink-0 text-zinc-600" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>' +
      '<time class="tabular-nums text-zinc-500" datetime="' +
      escUrlAttr(iso) +
      '">' +
      esc(dateStr || '방금') +
      '</time>' +
      '</span>' +
      '</div></div></article>'
    );
  }

  function youtubeThumbId(link) {
    var u = String(link || '');
    var m = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : '';
  }

  /**
   * 상세 페이지 등에서 쓰는 간단 그리드 카드 (전체 카드와 유사한 톤)
   * @param {{ title?: string, slug: string, cat?: string, authorName?: string, link?: string, createdAt?: string, updatedAt?: string }} p
   */
  function relatedGridCardHtml(p) {
    var slug = encodeURIComponent(p.slug);
    var yid = youtubeThumbId(p.link);
    var label = catLabel(p.cat);
    var title = esc(p.title || '제목 없음');
    var when = formatPostDate(p.createdAt || p.updatedAt);
    var author = esc((p.authorName || '세희').trim() || '세희');
    var media = yid
      ? '<div class="relative aspect-video overflow-hidden bg-zinc-950"><img src="https://img.youtube.com/vi/' +
        escUrlAttr(yid) +
        '/hqdefault.jpg" alt="" class="h-full w-full object-cover" loading="lazy" /><div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div><span class="pointer-events-none absolute bottom-2 left-2 rounded bg-red-600 px-1.5 py-0.5 text-[0.625rem] font-semibold text-white">YouTube</span></div>'
      : '<div class="relative flex aspect-video items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 text-2xs font-medium text-zinc-500">' +
        esc(label) +
        '</div>';
    return (
      '<article data-feed-href="post-detail.html?slug=' +
      slug +
      '" class="related-mini-card group cursor-pointer overflow-hidden rounded-xl border border-zinc-800/90 bg-zinc-900/50 shadow-lg shadow-black/25 ring-1 ring-white/[0.04] transition hover:border-zinc-600 hover:bg-zinc-900/70">' +
      media +
      '<div class="border-t border-zinc-800/80 p-3">' +
      '<h3 class="line-clamp-2 text-sm font-semibold leading-snug text-zinc-100">' +
      title +
      '</h3>' +
      '<p class="mt-1.5 text-2xs text-zinc-500">' +
      author +
      ' · ' +
      esc(when || '방금') +
      '</p>' +
      '</div></article>'
    );
  }

  function bindFeedRowClick(root) {
    if (!root) return;
    if (root.dataset.feedRowBound) return;
    root.dataset.feedRowBound = '1';
    root.addEventListener('click', function (e) {
      var card = e.target.closest('.post-card, .post-list-item, .related-mini-card');
      if (!card || !root.contains(card)) return;
      if (card.classList.contains('post-card--video')) return;
      if (e.target.closest('button, a, video, input, textarea')) return;
      var href = card.getAttribute('data-feed-href');
      if (href) window.location.href = href;
    });
  }

  global.MoaFeedView = {
    LS_VIEW: LS_VIEW,
    getView: getView,
    setView: setView,
    resolveViewFromUrl: resolveViewFromUrl,
    migrateBrowseViewKey: migrateBrowseViewKey,
    syncToggleButtons: syncToggleButtons,
    applyFeedRootClass: applyFeedRootClass,
    FEED_GRID_CLASS: FEED_GRID_CLASS,
    FEED_LIST_CLASS: FEED_LIST_CLASS,
    catLabel: catLabel,
    postListRowHtml: postListRowHtml,
    relatedGridCardHtml: relatedGridCardHtml,
    bindFeedRowClick: bindFeedRowClick,
    VIEW_BTN_OFF: VIEW_BTN_OFF,
    VIEW_BTN_ON: VIEW_BTN_ON,
  };
})(typeof window !== 'undefined' ? window : this);
