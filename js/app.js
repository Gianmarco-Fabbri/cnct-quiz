/* Start-up: load the saved state and the questions, wire the global events, render the first view. */
(function (CNCT) {
  'use strict';
  const { $ } = CNCT.util;
  const { store, data, ui, router, actions } = CNCT;

  // A saved session that refers to questions no longer in the bank is dropped.
  function dropInvalidSession() {
    const s = store.session;
    const valid = s && (s.kind === 'practice' || s.kind === 'exam') && Array.isArray(s.ids) && s.ids.every((id) => data.byId[id]);
    if (s && !valid) { store.session = null; store.saveSession(); }
  }

  async function start() {
    store.load();
    ui.applyTheme();
    try { await data.load(); } catch (e) { data.doc = null; }
    if (!data.doc) {
      $('#app').innerHTML = `<section class="card"><h1>Questions not found</h1><p><code>data/questions.js</code> is missing.
        Run <code>python3 prepare_site.py</code> in <code>ExamMaterial/scripts</code>.</p></section>`;
      return;
    }
    dropInvalidSession();
    if (data.isPublic()) { const link = $('.menu a[href="#/data"]'); if (link) link.textContent = 'Settings'; }

    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el || el.disabled || !$('#app').contains(el)) return;
      const handler = actions[el.dataset.action];
      if (handler) { e.preventDefault(); handler(el); }
    });
    document.addEventListener('keydown', CNCT.keyboard.onKey);
    $('#theme').onclick = ui.cycleTheme;
    $('#import-file').onchange = (e) => { const f = e.target.files[0]; if (f) CNCT.dataPage.importFile(f); };
    window.addEventListener('hashchange', router.render);
    // Another tab saved progress: reload it so that the two tabs do not overwrite each other.
    window.addEventListener('storage', (e) => { if (e.key === store.STATE_KEY) store.reloadState(); });
    router.render();
  }

  start();
})(window.CNCT = window.CNCT || {});
