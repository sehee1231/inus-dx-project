(function (global) {
  'use strict';
  /** 가입·로그인 성공 시에만 설정. 이 값이 없으면 피드 등으로 바로 들어갈 수 없음 */
  var KEY = 'moa_site_entry_v2';

  function pageHref(filename) {
    try {
      return new URL(String(filename || ''), location.href).href;
    } catch (e) {
      return String(filename || '');
    }
  }

  function isAuthGatePage() {
    var p = location.pathname || '';
    return (
      p.indexOf('login.html') !== -1 ||
      p.indexOf('signup.html') !== -1 ||
      p.indexOf('pending-approval.html') !== -1
    );
  }

  function redirectIfFirstVisit() {
    try {
      if (isAuthGatePage()) return;
      if (localStorage.getItem(KEY)) return;
      location.replace(pageHref('signup.html'));
    } catch (e) {}
  }

  function markEnteredAfterAuth() {
    try {
      localStorage.setItem(KEY, '1');
    } catch (e) {}
  }

  global.MoaSiteEntry = {
    redirectIfFirstVisit: redirectIfFirstVisit,
    markEnteredAfterAuth: markEnteredAfterAuth,
    pageHref: pageHref,
    enteredKey: KEY,
  };
})(typeof window !== 'undefined' ? window : this);
