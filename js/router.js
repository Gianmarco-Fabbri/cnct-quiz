/* Hash routing: #/path?query picks a view. Every render stops the mock exam timer; the exam view restarts it. */
(function (CNCT) {
  'use strict';
  const { $$ } = CNCT.util;

  function current() {
    const h = location.hash.replace(/^#/, '') || '/';
    const [path, query] = h.split('?');
    return { path, params: new URLSearchParams(query || '') };
  }

  function routes() {
    const v = CNCT.views;
    return {
      '/': v.home, '/practice': v.practiceSetup, '/quiz': v.quiz, '/summary': v.summary,
      '/exam': v.examSetup, '/mock': v.mock, '/result': v.result, '/data': v.data,
    };
  }

  function render() {
    CNCT.exam.stopTimer();
    const { path, params } = current();
    $$('.menu a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + path));
    // #/question/ID opens a single question as a one-question practice (used by the links in the reports).
    if (path.indexOf('/question/') === 0) {
      const id = decodeURIComponent(path.split('/')[2] || '');
      if (CNCT.data.byId[id]) { CNCT.practice.start([id], 'Question ' + id, {}, true); return; }
    }
    (routes()[path] || CNCT.views.home)(params);
  }

  // replace: change the address without adding a history entry (used for redirects).
  function go(hash, replace) {
    if (location.hash === hash) { render(); return; }
    if (replace) { history.replaceState(null, '', hash); render(); } else location.hash = hash;
  }

  CNCT.actions.go = (el) => go(el.dataset.href);
  CNCT.router = { current, render, go };
})(window.CNCT = window.CNCT || {});
