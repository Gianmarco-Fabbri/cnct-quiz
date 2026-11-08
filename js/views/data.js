/* Data page: export, import and reset of the progress, the list of problem reports, settings and information.
 * Also holds the export/import actions used by the home page. */
(function (CNCT) {
  'use strict';
  const { $, escapeHtml, formatDate, today } = CNCT.util;
  const { store, data, progress, ui, actions } = CNCT;

  // The public edition shows only the progress and the settings: no reports, no About, nothing about the Mac
  // or the Italian version.
  function progressHtml(pub) {
    const tried = Object.keys(store.state.questions).filter((id) => progress.attempts(id).length).length;
    return `<section class="card"><h2>Progress</h2>
      <p>${tried} questions tried, ${store.state.mockExams.length} ${data.term('exams')}${pub ? '' : `, ${store.state.reports.length} reports`}. They stay in this browser:
        ${pub ? 'export them to move them to another device' : 'export them to move them (for example from the Mac to the iPhone)'} or to keep a copy.</p>
      <div class="actions"><button class="btn primary" data-action="export">Export progress (JSON)</button>
        <button class="btn" data-action="import">Import progress</button><button class="btn danger" data-action="reset">Reset progress</button></div>
      <p class="muted" style="font-size:.88rem">Importing merges the data: attempts already present are not duplicated.${pub ? '' : `
        Files exported by the earlier Italian version are accepted too.`}</p></section>`;
  }

  function reportsHtml() {
    const reports = store.state.reports.slice().reverse();
    let h = `<section class="card"><h2>Reports (${reports.length})</h2>`;
    if (reports.length) {
      h += '<div class="actions" style="margin-top:0;margin-bottom:8px"><button class="btn" data-action="export-reports">Export reports (JSON)</button></div>';
      reports.forEach((x) => {
        const q = data.byId[x.id];
        h += `<div class="review-item"><a href="#/question/${escapeHtml(x.id)}">Question ${escapeHtml(x.id)}</a> · <span class="muted">${formatDate(x.t)}</span>
          <p>${escapeHtml(x.text)}</p>${q ? `<p class="muted" style="font-size:.88rem">${escapeHtml(q.text.slice(0, 140))}${q.text.length > 140 ? '…' : ''}</p>` : ''}
          <button class="btn small danger" data-action="delete-report" data-t="${x.t}">Delete</button></div>`;
      });
    } else h += '<p class="muted">None yet. After each answer you find the "Report a problem" button.</p>';
    return h + '</section>';
  }

  // The public edition has no duration setting: its exam simulation always lasts as the exam.
  const settingsHtml = (pub) => `<section class="card"><h2>Settings</h2><div class="fields">
      <label class="field">Theme<select id="s-theme"><option value="auto">Automatic (as the system)</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
      ${pub ? '' : `<label class="field">Default mock exam duration<select id="s-duration"><option value="60">60 minutes</option><option value="70">70 minutes (as in the exam)</option></select></label>`}
      <label class="field">Labs attended (for the total with the bonus)<select id="s-labs">${[0, 1, 2, 3, 4].map((n) => `<option>${n}</option>`).join('')}</select></label></div></section>`;

  const aboutHtml = () => `<section class="card"><h2>About</h2><p>Bank: ${data.active().length} questions (version ${escapeHtml(data.doc.version)}). 2026/27 slides for units 01–07;
        2025/26 slides for 08 and 09, not yet published this year. Slide links open the PDFs in the ExamMaterial folder at the cited page.</p>
      <p class="muted">From an iPhone: on the Mac run <kbd>python3 -m http.server 8000 --bind 0.0.0.0</kbd> in the CNCT folder and open
        <kbd>http://Mac-IP:8000/site/</kbd> (find the IP with <kbd>ipconfig getifaddr en0</kbd>).</p></section>`;

  function render() {
    const pub = data.isPublic();
    const h = pub
      ? '<h1>Progress and settings</h1>' + progressHtml(true) + settingsHtml(true)
      : '<h1>Data and settings</h1>' + progressHtml(false) + reportsHtml() + settingsHtml(false) + aboutHtml();
    $('#app').innerHTML = h;
    const settings = store.state.settings;
    $('#s-theme').value = settings.theme;
    if ($('#s-duration')) $('#s-duration').value = String(settings.duration || 60);
    $('#s-labs').value = String(settings.labs || 0);
    $('#s-theme').onchange = (e) => { settings.theme = e.target.value; store.save(); ui.applyTheme(); };
    if ($('#s-duration')) $('#s-duration').onchange = (e) => { settings.duration = Number(e.target.value); store.save(); };
    $('#s-labs').onchange = (e) => { settings.labs = Number(e.target.value); store.save(); };
  }

  function exportProgress() {
    ui.download(`cnct-progress-${today()}.json`, store.exportPayload(data.doc.version));
    ui.toast('Progress exported.');
  }
  function exportReports() {
    ui.download(`cnct-reports-${today()}.json`, {
      app: 'cnct-quiz', exported: new Date().toISOString(), dataVersion: data.doc.version,
      reports: store.state.reports.map((x) => {
        const q = data.byId[x.id];
        return { id: x.id, date: new Date(x.t).toISOString(), text: x.text, question: q ? q.text : null, keyAnswer: q ? q.answer : null };
      }),
    });
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
    'export-reports': exportReports,
    import: () => { const input = $('#import-file'); input.value = ''; input.click(); },
    reset: () => ui.confirm(data.isPublic()
      ? 'Delete all the progress and exam simulations saved in this browser? Export them first if you want a copy.'
      : 'Delete all the progress, mock exams and reports saved in this browser? Export them first if you want a copy.', 'Reset', () => {
      store.reset();
      ui.applyTheme();
      ui.toast('Progress reset.');
      CNCT.router.go('#/');
    }),
    'delete-report': (el) => {
      store.state.reports = store.state.reports.filter((x) => String(x.t) !== el.dataset.t);
      store.save();
      render();
    },
  });

  CNCT.dataPage = { importFile, exportProgress, exportReports };
  Object.assign(CNCT.views = CNCT.views || {}, { data: render });
})(window.CNCT = window.CNCT || {});
