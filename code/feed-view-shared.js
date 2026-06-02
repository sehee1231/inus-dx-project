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

  function clipText(s, maxLen) {
    s = String(s || '');
    var m = maxLen || 72;
    if (s.length > m) return s.slice(0, m - 1) + '…';
    return s;
  }

  function youtubeVideoId(url) {
    if (!url) return '';
    var u = String(url);
    var m = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
    m = u.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
    m = u.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
    m = u.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : '';
  }

  var youtubeThumbId = youtubeVideoId;

  var FEED_EXTERNAL_LINK_ATTR =
    ' target="_blank" rel="noopener noreferrer" data-feed-external="1" onclick="event.stopPropagation()"';

  var FEED_EXTERNAL_LINK_CLASS =
    'feed-card-external-link relative z-[3] inline-flex max-w-[min(100%,18rem)] cursor-pointer flex-col items-center gap-0.5 rounded-lg px-3 py-2 text-center transition hover:bg-zinc-800/70';

  function postDetailHref(slug) {
    return 'post-detail.html?slug=' + encodeURIComponent(String(slug || ''));
  }

  function cardOverlayHtml(slug) {
    return (
      '<a href="' +
      escUrlAttr(postDetailHref(slug)) +
      '" class="feed-card-overlay absolute inset-0 z-[1] rounded-t-xl" aria-label="글 상세 보기"></a>'
    );
  }

  /** URL 텍스트 링크만 새 탭. 호버·밑줄은 이 요소에만 적용 */
  function externalUrlLinkHtml(link, opts) {
    opts = opts || {};
    var url = String(link || '').trim();
    if (!url) return '';
    var heading = opts.heading || '관련 링크';
    var display = String(opts.display || url.replace(/^https?:\/\//i, ''));
    return (
      '<a href="' +
      escUrlAttr(url) +
      '"' +
      FEED_EXTERNAL_LINK_ATTR +
      ' class="' +
      FEED_EXTERNAL_LINK_CLASS +
      '">' +
      '<span class="text-2xs font-semibold text-sky-400 underline-offset-2 hover:underline">' +
      esc(heading) +
      '</span>' +
      '<span class="line-clamp-2 break-all text-2xs text-zinc-400">' +
      esc(clipText(display, 56)) +
      '</span></a>'
    );
  }

  function mediaBlockOpen(bgClass) {
    return (
      '<div class="relative z-[2] shrink-0 overflow-hidden border-t border-zinc-800/60 feed-card-media ' +
      (bgClass || 'bg-zinc-900/80') +
      '">'
    );
  }

  /** 미디어 박스 여백·썸네일 클릭 → 카드(글 상세). 가운데 URL 링크만 새 탭 */
  function linkPreviewMediaHtml(rawLink, labelEsc) {
    var link = String(rawLink || '').trim();
    if (!link) return feedVideoFallbackMediaHtml(labelEsc || '');
    var label = labelEsc || '';
    var yid = youtubeVideoId(link);
    if (yid) {
      return (
        mediaBlockOpen('bg-zinc-950') +
        (label
          ? '<span class="pointer-events-none absolute left-2 top-2 z-10 rounded-md bg-black/70 px-1.5 py-0.5 text-[0.625rem] font-medium text-zinc-200">' +
            label +
            '</span>'
          : '') +
        '<div class="relative min-h-[8rem]">' +
        '<img src="https://img.youtube.com/vi/' +
        escUrlAttr(yid) +
        '/hqdefault.jpg" alt="" class="min-h-[8rem] w-full object-cover" loading="lazy" />' +
        '<div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20"></div>' +
        '<span class="pointer-events-none absolute bottom-2 left-2 rounded bg-red-600 px-1.5 py-0.5 text-[0.625rem] font-semibold text-white">YouTube</span>' +
        '<div class="pointer-events-none absolute inset-0 flex items-center justify-center">' +
        '<span class="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-zinc-900 shadow-lg">' +
        '<svg class="ml-1 h-7 w-7" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span></div>' +
        '<div class="pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex justify-center bg-gradient-to-t from-zinc-950/95 via-zinc-950/70 to-transparent px-2 pb-2 pt-10">' +
        '<span class="pointer-events-auto">' +
        externalUrlLinkHtml(link, { heading: 'YouTube 열기' }) +
        '</span></div></div></div>'
      );
    }
    if (/\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i.test(link)) {
      return (
        mediaBlockOpen('bg-zinc-950') +
        '<div class="relative min-h-[8rem]">' +
        '<img src="' +
        escUrlAttr(link) +
        '" alt="" class="min-h-[8rem] w-full object-cover" loading="lazy" />' +
        '<span class="pointer-events-none absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[0.625rem] font-medium text-zinc-200">이미지</span>' +
        '<div class="pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex justify-center bg-gradient-to-t from-zinc-950/95 via-zinc-950/70 to-transparent px-2 pb-2 pt-10">' +
        '<span class="pointer-events-auto">' +
        externalUrlLinkHtml(link, { heading: '이미지 열기' }) +
        '</span></div></div></div>'
      );
    }
    if (/instagram\.com/i.test(link)) {
      return (
        mediaBlockOpen() +
        '<div class="flex min-h-[8rem] flex-col items-center justify-center px-3 py-4">' +
        externalUrlLinkHtml(link, { heading: '인스타 링크' }) +
        '</div></div>'
      );
    }
    return (
      mediaBlockOpen() +
      '<div class="flex min-h-[8rem] flex-col items-center justify-center px-3 py-4">' +
      externalUrlLinkHtml(link, { heading: '관련 링크' }) +
      '</div></div>'
    );
  }

  function feedVideoFallbackMediaHtml(labelEsc) {
    return (
      '<div class="relative z-[2] flex min-h-[8rem] shrink-0 items-center justify-center overflow-hidden border-t border-zinc-800/60 bg-gradient-to-br from-violet-800/90 to-indigo-950 feed-card-media">' +
      (labelEsc
        ? '<span class="pointer-events-none absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[0.625rem] font-medium text-zinc-200">' +
          labelEsc +
          '</span>'
        : '') +
      '<span class="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-zinc-900 shadow-lg">' +
      '<svg class="ml-1 h-7 w-7" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span></div>'
    );
  }

  /**
   * 상세 페이지 등에서 쓰는 간단 그리드 카드 (전체 카드와 유사한 톤)
   * @param {{ title?: string, slug: string, cat?: string, authorName?: string, link?: string, createdAt?: string, updatedAt?: string }} p
   */
  function relatedGridCardHtml(p) {
    var slug = encodeURIComponent(p.slug);
    var rawLink = String(p.link || '').trim();
    var yid = youtubeVideoId(rawLink);
    var label = catLabel(p.cat);
    var title = esc(p.title || '제목 없음');
    var when = formatPostDate(p.createdAt || p.updatedAt);
    var author = esc((p.authorName || '세희').trim() || '세희');
    var media;
    if (rawLink && yid) {
      media =
        '<div class="relative aspect-video overflow-hidden bg-zinc-950">' +
        '<img src="https://img.youtube.com/vi/' +
        escUrlAttr(yid) +
        '/hqdefault.jpg" alt="" class="h-full w-full object-cover" loading="lazy" />' +
        '<div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>' +
        '<span class="pointer-events-none absolute bottom-2 left-2 rounded bg-red-600 px-1.5 py-0.5 text-[0.625rem] font-semibold text-white">YouTube</span>' +
        '<div class="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-2 pb-2 pt-8">' +
        '<span class="pointer-events-auto">' +
        externalUrlLinkHtml(rawLink, { heading: 'YouTube 열기', display: clipText(rawLink.replace(/^https?:\/\//i, ''), 40) }) +
        '</span></div></div>';
    } else if (rawLink) {
      media =
        '<div class="relative flex aspect-video flex-col items-center justify-center bg-zinc-900/80 px-3 py-4">' +
        externalUrlLinkHtml(rawLink, { heading: '관련 링크', display: clipText(rawLink.replace(/^https?:\/\//i, ''), 40) }) +
        '</div>';
    } else {
      media =
        '<div class="relative flex aspect-video items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 text-2xs font-medium text-zinc-500">' +
        esc(label) +
        '</div>';
    }
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
      if (e.target.closest('button, a, video, input, textarea')) return;
      var href = card.getAttribute('data-feed-href');
      if (href) {
        window.location.href = href;
        return;
      }
      var la = card.querySelector('h2 a[href*="post-detail"], h3 a[href*="post-detail"]');
      if (la) window.location.href = la.getAttribute('href');
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
    linkPreviewMediaHtml: linkPreviewMediaHtml,
    externalUrlLinkHtml: externalUrlLinkHtml,
    feedVideoFallbackMediaHtml: feedVideoFallbackMediaHtml,
    cardOverlayHtml: cardOverlayHtml,
    postDetailHref: postDetailHref,
    youtubeVideoId: youtubeVideoId,
    clipText: clipText,
    bindFeedRowClick: bindFeedRowClick,
    VIEW_BTN_OFF: VIEW_BTN_OFF,
    VIEW_BTN_ON: VIEW_BTN_ON,
  };
})(typeof window !== 'undefined' ? window : this);
