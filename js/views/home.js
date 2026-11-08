/* Home page: practice modes, overall progress, progress per unit and the weakest topics. */
(function (CNCT) {
  'use strict';
  const { $, escapeHtml, formatNumber, percent } = CNCT.util;
  const { store, data, progress } = CNCT;

  const barClass = (p) => (p >= 70 ? 'bar-good' : p >= 50 ? 'bar-mid' : 'bar-bad');

  function resumeHtml() {
    const s = store.session;
    if (!s) return '';
    const open = s.kind === 'exam' ? !s.submitted : s.index < s.ids.length && !s.stopped;
    if (!open) return '';
    const href = s.kind === 'exam' ? '#/mock' : '#/quiz';
    const where = s.kind === 'exam'
      ? `mock exam in progress, ${Object.keys(s.answers).length}/${s.ids.length} answered`
      : `question ${s.index + 1} of ${s.ids.length}`;
    return `<button class="mode resume" data-action="go" data-href="${href}"><strong>Resume: ${escapeHtml(s.title)}</strong>
      <span>${escapeHtml(where)}</span></button><div class="spacer"></div>`;
  }

  function unitTableHtml() {
    const stats = progress.unitStats();
    let h = `<div class="scroll" style="margin-top:14px"><table class="table" id="unit-table"><thead><tr><th>Unit</th>
      <th class="num">Questions</th><th class="num">Tried</th><th class="num">Correct</th><th style="width:28%">&nbsp;</th></tr></thead><tbody>`;
    data.unitIds().forEach((u) => {
      const s = stats[u];
      const p = percent(s.correct, s.tried);
      h += `<tr class="clickable" data-action="go" data-href="#/practice?unit=${u}" title="Practise on this unit">
        <td>${u} ${escapeHtml(data.unitName(u))}</td><td class="num">${s.total}</td><td class="num">${s.tried}</td>
        <td class="num">${p === null ? '—' : p + '%'}</td>
        <td>${p === null ? '' : `<div class="bar"><div class="${barClass(p)}" style="width:${p}%"></div></div>`}</td></tr>`;
    });
    return h + `</tbody></table></div><p class="muted" style="font-size:.85rem">"Correct" counts the last attempt of each question
      tried. Tap a unit to practise on it.</p>`;
  }

  function weakestTopicsHtml() {
    const topics = progress.weakestTopics(6);
    if (!topics.length) return '<p class="muted">Topics with at least 3 answers appear here, weakest first.</p>';
    let h = `<div class="scroll"><table class="table"><thead><tr><th>Topic</th><th>Unit</th><th class="num">Answers</th>
      <th class="num">Correct</th></tr></thead><tbody>`;
    topics.forEach((t) => {
      h += `<tr class="clickable" data-action="go" data-href="#/practice?unit=${t.unit}&topic=${encodeURIComponent(t.topic)}">
        <td>${escapeHtml(t.topic)}</td><td>${t.unit}</td><td class="num">${t.answers}</td><td class="num">${percent(t.correct, t.answers)}%</td></tr>`;
    });
    return h + '</tbody></table></div>';
  }

  function home() {
    const qs = data.active();
    const toReview = qs.filter((q) => progress.needsReview(q.id)).length;
    const flagged = qs.filter((q) => progress.isFlagged(q.id)).length;
    const examOnly = qs.filter((q) => q.origin === 'exam').length;
    const tried = qs.filter((q) => progress.attempts(q.id).length).length;
    const rightAtLast = qs.filter((q) => progress.lastCorrect(q.id) === true).length;
    const exams = store.state.mockExams;
    const best = exams.length ? Math.max(...exams.map((e) => e.score)) : null;
    const f = data.doc.exam_format;
    const pub = data.isPublic(); // public edition: no exam-only mode, no reports, no data file name

    $('#app').innerHTML = resumeHtml() + `<h1>Practise for the CNCT written exam</h1>
      <p class="muted">${f.questions} questions, +${formatNumber(f.correct, 0)} correct, ${formatNumber(f.wrong)} wrong, 0 blank.
        In the exam: 1 h 10 min including setup. ${qs.length} questions in the bank.</p>
      <div class="mode-grid">
        <button class="mode" data-action="go" data-href="#/practice"><strong>By unit or topic</strong><span>Choose unit, topic and how many questions</span></button>
        <button class="mode" data-action="go" data-href="#/exam"><strong>Mock exam</strong><span>30 questions weighted by CFU, timer and real scoring</span></button>
        <button class="mode" data-action="start-review" ${toReview ? '' : 'disabled'}><strong>Review mistakes (${toReview})</strong><span>A question leaves the review once you get it right twice in a row</span></button>
        ${pub ? '' : `<button class="mode" data-action="start-exam-questions"><strong>Exam questions only (${examOnly})</strong><span>The original questions of past exams</span></button>`}
        <button class="mode" data-action="start-flagged" ${flagged ? '' : 'disabled'}><strong>Flagged questions (${flagged})</strong><span>The ones you flagged with ☆</span></button>
      </div>
      <section class="card"><h2>Your progress</h2><div class="stats">
        <div class="stat"><b>${tried}/${qs.length}</b><span>questions tried</span></div>
        <div class="stat"><b>${tried ? percent(rightAtLast, tried) + '%' : '—'}</b><span>correct at the last attempt</span></div>
        <div class="stat"><b>${toReview}</b><span>to review</span></div>
        <div class="stat"><b>${exams.length ? formatNumber(exams[exams.length - 1].score) : '—'}</b><span>last mock exam${best !== null ? ' (best ' + formatNumber(best) + ')' : ''}</span></div>
      </div>${unitTableHtml()}</section>
      <section class="card"><h2>Weakest topics</h2>${weakestTopicsHtml()}</section>
      <section class="card"><h2>Data</h2><p class="muted">Your progress stays in this browser. Export it to move it to another device or to keep a copy.</p>
        <div class="actions"><button class="btn" data-action="export">Export progress</button><button class="btn" data-action="import">Import progress</button>
        <button class="btn" data-action="go" data-href="#/data">${pub ? 'Settings' : `Reports (${store.state.reports.length}) and settings`}</button></div></section>
      <footer class="page-footer">${pub ? '' : `Data: questions.json version ${escapeHtml(data.doc.version)} · `}Keys: <kbd>1</kbd>–<kbd>4</kbd> answer ·
        <kbd>0</kbd> don't know · <kbd>Enter</kbd> next · <kbd>S</kbd> flag</footer>`;
  }

  CNCT.views = CNCT.views || {};
  CNCT.views.home = home;
})(window.CNCT = window.CNCT || {});
