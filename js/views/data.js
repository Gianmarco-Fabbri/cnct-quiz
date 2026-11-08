/* Settings page: export, import and reset of the progress, and the settings (theme, labs attended).
 * Also holds the export/import actions used by the home page. */
(function (CNCT) {
  'use strict';
  const { $, today } = CNCT.util;
  const { store, progress, ui, actions } = CNCT;

  function render() {
    const tried = Object.keys(store.state.questions).filter((id) => progress.attempts(id).length).length;
    const exams = store.state.mockExams.length;
    $('#app').innerHTML = `<h1>Progress and settings</h1><section class="card"><h2>Progress</h2>
      <p>${tried} question${tried === 1 ? '' : 's'} tried, ${exams} exam simulation${exams === 1 ? '' : 's'}. They stay in this browser:
        export them to move them to another device or to keep a copy.</p>
      <div class="actions"><button class="btn primary" data-action="export">Export progress (JSON)</button>
        <button class="btn" data-action="import">Import progress</button><button class="btn danger" data-action="reset">Reset progress</button></div>
      <p class="muted" style="font-size:.88rem">Importing merges the data: attempts already present are not duplicated.</p></section>
      <section class="card"><h2>Settings</h2><div class="fields">
      <label class="field">Theme<select id="s-theme"><option value="auto">Automatic (as the system)</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
      <label class="field">Labs attended (for the total with the bonus)<select id="s-labs">${[0, 1, 2, 3, 4].map((n) => `<option>${n}</option>`).join('')}</select></label></div></section>`;
    const settings = store.state.settings;
    $('#s-theme').value = settings.theme;
    $('#s-labs').value = String(settings.labs || 0);
    $('#s-theme').onchange = (e) => { settings.theme = e.target.value; store.save(); ui.applyTheme(); };
    $('#s-labs').onchange = (e) => { settings.labs = Number(e.target.value); store.save(); };
  }

  function exportProgress() {
    ui.download(`cnct-progress-${today()}.json`, store.exportPayload(CNCT.data.doc.version));
    ui.toast('Progress exported.');
  }
  function importFile(file) {
    file.text().then((text) => {
      let json;
      try { json = JSON.parse(text); } catch (e) { ui.toast('Invalid file: it is not JSON.'); return; }
      const incoming = store.parseExport(json);
      if (!incoming) { ui.toast('This file does not contain CNCT Quiz progress.'); return; }
      const added = store.merge(incoming);
      ui.toast(`Import done: ${added} attempts added.`);
      CNCT.router.render();
    });
  }

  Object.assign(actions, {
    export: exportProgress,
    import: () => { const input = $('#import-file'); input.value = ''; input.click(); },
    reset: () => ui.confirm('Delete all the progress and exam simulations saved in this browser? Export them first if you want a copy.', 'Reset', () => {
      store.reset();
      ui.applyTheme();
      ui.toast('Progress reset.');
      CNCT.router.go('#/');
    }),
  });

  CNCT.dataPage = { importFile, exportProgress };
  Object.assign(CNCT.views = CNCT.views || {}, { data: render });
})(window.CNCT = window.CNCT || {});
