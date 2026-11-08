/* Practice: the filter page, the question-by-question session with immediate feedback, and the summary.
 * Session: { kind: 'practice', title, ids, index, orders, answers, review, created, stopped }.
 * orders[i] is the shuffled order of the option letters shown for question i; answers[i] is the chosen letter
 * ('?' for "don't know"). In review mode a question goes back in the queue until it is right twice in a row. */
(function (CNCT) {
  'use strict';
  const { $, escapeHtml, shuffle, percent } = CNCT.util;
  const { store, data, progress, ui, actions } = CNCT;
  const go = (hash, replace) => CNCT.router.go(hash, replace);
  const MAX_REVIEW_QUEUE = 400;

  // ---------------------------------------------------------------- filters
  function filter(o) {
    return data.active().filter((q) => (!o.unit || q.unit === o.unit) && (!o.topic || q.topic === o.topic) &&
      (!o.origin || q.origin === o.origin) && (
        o.which === 'all' || !o.which ||
        (o.which === 'unseen' && !progress.attempts(q.id).length) ||
        (o.which === 'review' && progress.needsReview(q.id)) ||
        (o.which === 'wrong' && progress.attempts(q.id).some((a) => !a[1])) ||
        (o.which === 'flagged' && progress.isFlagged(q.id)) ||
        (o.which === 'weak' && q.status === 'weak')));
  }
  // The public edition has no origin select (and no origin in its data).
  const readFilters = () => ({ unit: $('#f-unit').value, topic: $('#f-topic').value, origin: $('#f-origin') ? $('#f-origin').value : '', which: $('#f-which').value });

  function setup(params) {
    const unit = params.get('unit') || '';
    const topic = params.get('topic') || '';
    let h = `<h1>Practice by unit or topic</h1><section class="card"><div class="fields">
      <label class="field">Unit<select id="f-unit"><option value="">All units</option>`;
    data.unitIds().forEach((u) => { h += `<option value="${u}" ${u === unit ? 'selected' : ''}>${u} ${escapeHtml(data.unitName(u))}</option>`; });
    const pub = data.isPublic();
    h += `</select></label><label class="field">Topic<select id="f-topic"></select></label>
      ${pub ? '' : `<label class="field">Origin<select id="f-origin"><option value="">All</option><option value="exam">Exam questions only</option><option value="created">Created questions only</option></select></label>`}
      <label class="field">Which<select id="f-which"><option value="all">All</option><option value="unseen">Never tried</option><option value="review">To review</option>
        <option value="wrong">Wrong at least once</option><option value="flagged">Flagged</option>${pub ? '' : '<option value="weak">Weak only</option>'}</select></label>
      <label class="field">How many<select id="f-count"><option value="10">10</option><option value="20" selected>20</option><option value="30">30</option><option value="0">All</option></select></label>
      <label class="field">Order<select id="f-order"><option value="random">Random</option><option value="bank">As in the bank</option></select></label>
      </div><p id="f-matches" class="muted" style="margin-top:12px"></p>
      <div class="actions"><button class="btn primary" data-action="start-practice" id="f-start">Start</button></div></section>`;
    $('#app').innerHTML = h;
    const fillTopics = (selected) => {
      $('#f-topic').innerHTML = '<option value="">All topics</option>' +
        data.topicsOf($('#f-unit').value).map((t) => `<option ${t === selected ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('');
    };
    const count = () => {
      const n = filter(readFilters()).length;
      const wanted = Number($('#f-count').value);
      $('#f-matches').textContent = n ? `${n} questions match; you will use ${wanted ? Math.min(wanted, n) : n}.` : 'No question matches the filters.';
      $('#f-start').disabled = !n;
    };
    fillTopics(topic);
    $('#f-unit').onchange = () => { fillTopics(''); count(); };
    ['#f-topic', '#f-origin', '#f-which', '#f-count'].forEach((s) => { if ($(s)) $(s).onchange = count; });
    count();
  }

  // ---------------------------------------------------------------- session
  function start(ids, title, options, replace) {
    if (!ids.length) { ui.toast('No question matches.'); return; }
    store.session = { kind: 'practice', title, ids: ids.slice(), index: 0, orders: {}, answers: {}, review: !!(options && options.review), created: Date.now() };
    store.saveSession();
    go('#/quiz', replace);
  }
  const session = () => (store.session && store.session.kind === 'practice' ? store.session : null);
  const isOpen = (s) => s && s.index < s.ids.length && !s.stopped;

  function feedbackHtml(q, answer, showOutcome = true) {
    const correct = answer === q.answer;
    let h = '<div class="feedback" role="status">';
    if (showOutcome) {
      const label = answer === '?' ? 'No answer' : correct ? '✓ Correct' : '✗ Wrong';
      h += `<div class="outcome ${correct ? 'correct' : 'wrong'}">${label}</div>`;
    }
    h += `<p><b>Correct answer: ${q.answer})</b> ${escapeHtml(q.options[q.answer])}${q.no_correct_option ? ' <span class="muted">(the least wrong)</span>' : ''}</p>
      <p>${escapeHtml(q.explanation)}</p>`;
    // Public edition: outcome, answer, explanation and the question number, nothing else.
    if (data.isPublic()) return h + `<p class="muted" style="font-size:.85rem">Question ${escapeHtml(q.id)}</p></div>`;
    h += `<p><b>Slides:</b> ${data.referencesHtml(q.references)}</p>`;
    if (q.notes) h += `<p class="note ${q.status === 'weak' || q.no_correct_option ? '' : 'neutral'}"><b>Note:</b> ${escapeHtml(q.notes)}</p>`;
    if (q.original_text || q.original_options) {
      const opts = q.original_options || {};
      h += `<details><summary>Original Italian wording</summary>${q.original_text ? `<p>${escapeHtml(q.original_text)}</p>` : ''}
        ${Object.keys(opts).length ? '<ul>' + Object.keys(opts).map((k) => `<li>${k}) ${escapeHtml(opts[k])}</li>`).join('') + '</ul>' : ''}</details>`;
    }
    h += `<p>${data.badgesHtml(q)} <span class="muted" style="font-size:.85rem">bank no. ${escapeHtml(q.id)}</span></p>
      <div class="actions" style="margin-top:6px"><button class="btn small" data-action="report" data-id="${escapeHtml(q.id)}">Report a problem</button></div></div>`;
    return h;
  }

  function quiz() {
    const s = session();
    if (!s) { go('#/', true); return; }
    if (!isOpen(s)) { go('#/summary', true); return; }
    const i = s.index, id = s.ids[i], q = data.byId[id];
    if (!s.orders[i]) { s.orders[i] = shuffle(Object.keys(q.options)); store.saveSession(); }
    const order = s.orders[i];
    const answer = s.answers[i];
    const done = answer !== undefined;
    const right = Object.keys(s.answers).filter((k) => s.answers[k] === data.byId[s.ids[k]].answer).length;
    const flagged = progress.isFlagged(id);
    let h = `<div class="question-head"><span>${escapeHtml(s.title)} · question ${i + 1} of ${s.ids.length}</span>
      <span>correct ${right}/${Object.keys(s.answers).length}</span></div>
      <div class="progress"><div style="width:${(100 * i) / s.ids.length}%"></div></div>
      <section class="card" id="question" data-id="${escapeHtml(id)}">
      <div class="question-head"><span>${escapeHtml(q.unit)} ${escapeHtml(data.unitName(q.unit))} · ${escapeHtml(q.topic)}</span>
        <button class="flag ${flagged ? 'on' : ''}" data-action="flag" data-id="${escapeHtml(id)}" aria-pressed="${flagged}">${flagged ? '★ Flagged' : '☆ Flag'}</button></div>
      <div class="stem">${escapeHtml(q.text)}</div><div class="options">`;
    order.forEach((letter, k) => {
      let cls = '';
      if (done) { if (letter === q.answer) cls = 'correct'; else if (letter === answer) cls = 'wrong'; }
      h += `<button class="option ${cls}" data-action="answer" data-letter="${letter}" ${done ? 'disabled' : ''}><span class="key">${k + 1}</span>
        <span class="label">${escapeHtml(q.options[letter])}</span>${done ? `<span class="letter" title="${data.isPublic() ? 'Letter of this option' : 'Letter in the bank and in the answer key'}">${letter})</span>` : ''}</button>`;
    });
    h += '</div>';
    if (!done) {
      h += `<div class="actions"><button class="btn" data-action="answer" data-letter="?">Don't know</button><button class="btn" data-action="stop">Stop</button></div>
        <p class="shortcuts"><kbd>1</kbd>–<kbd>${order.length}</kbd> answer · <kbd>0</kbd> don't know (goes to review) · <kbd>S</kbd> flag</p>`;
    } else {
      h += feedbackHtml(q, answer);
      h += `<div class="actions"><button class="btn primary" data-action="next" id="next">${i + 1 < s.ids.length ? 'Next' : 'Finish'} ⏎</button>
        <button class="btn" data-action="stop">Stop</button></div>`;
    }
    $('#app').innerHTML = h + '</section>';
    if (done) { const fb = $('.feedback'); if (fb && fb.scrollIntoView) fb.scrollIntoView({ block: 'nearest' }); }
  }

  function answer(letter) {
    const s = session();
    if (!isOpen(s) || s.answers[s.index] !== undefined) return;
    const i = s.index, id = s.ids[i];
    s.answers[i] = letter;
    progress.addAttempt(id, letter === data.byId[id].answer, s.review ? 'review' : 'practice');
    if (s.review && progress.needsReview(id) && s.ids.indexOf(id, i + 1) < 0 && s.ids.length < MAX_REVIEW_QUEUE) s.ids.push(id);
    store.saveSession();
    quiz();
  }
  function next() {
    const s = session();
    if (!s || s.answers[s.index] === undefined) return;
    s.index++;
    store.saveSession();
    window.scrollTo(0, 0);
    quiz();
  }
  const isAnswered = () => { const s = session(); return !!(s && s.answers[s.index] !== undefined); };
  const currentOrder = () => { const s = session(); return (s && s.orders[s.index]) || []; };

  // ---------------------------------------------------------------- summary
  function summary() {
    const s = session();
    if (!s) { go('#/', true); return; }
    const positions = Object.keys(s.answers).map(Number).sort((a, b) => a - b);
    const right = positions.filter((k) => s.answers[k] === data.byId[s.ids[k]].answer);
    const wrong = positions.filter((k) => s.answers[k] !== data.byId[s.ids[k]].answer);
    const wrongIds = Array.from(new Set(wrong.map((k) => s.ids[k])));
    s.wrongIds = wrongIds;
    store.saveSession();
    let h = `<h1>${escapeHtml(s.title)}: done</h1><section class="card"><div class="stats">
      <div class="stat"><b>${positions.length}</b><span>answers</span></div>
      <div class="stat"><b>${right.length}</b><span>correct</span></div>
      <div class="stat"><b>${wrong.length}</b><span>wrong or "don't know"</span></div>
      <div class="stat"><b>${positions.length ? percent(right.length, positions.length) + '%' : '—'}</b><span>score</span></div></div>
      <div class="actions">${wrongIds.length ? `<button class="btn primary" data-action="redo-wrong">Redo the wrong ones (${wrongIds.length})</button>` : ''}
      <button class="btn" data-action="go" data-href="#/">Back to home</button></div></section>`;
    if (wrongIds.length) {
      h += '<section class="card"><h2>To review</h2>';
      wrongIds.forEach((id) => {
        const q = data.byId[id];
        h += `<div class="review-item"><a href="#/question/${escapeHtml(id)}">Question ${escapeHtml(id)}</a> · <span class="muted">${escapeHtml(q.topic)}</span>
          <p>${escapeHtml(q.text)}</p><p><b>${q.answer})</b> ${escapeHtml(q.options[q.answer])}</p></div>`;
      });
      h += '</section>';
    }
    $('#app').innerHTML = h;
  }

  // ---------------------------------------------------------------- actions
  const idsWhere = (pred) => shuffle(data.active().filter(pred).map((q) => q.id));
  Object.assign(actions, {
    'start-practice': () => {
      const o = readFilters();
      let ids = filter(o).map((q) => q.id);
      if ($('#f-order').value === 'random') ids = shuffle(ids);
      const n = Number($('#f-count').value);
      if (n) ids = ids.slice(0, n);
      start(ids, o.topic || (o.unit ? `Unit ${o.unit}` : 'Practice'), { review: o.which === 'review' });
    },
    'start-review': () => start(idsWhere((q) => progress.needsReview(q.id)), 'Review mistakes', { review: true }),
    'start-exam-questions': () => start(idsWhere((q) => q.origin === 'exam'), 'Exam questions'),
    'start-flagged': () => start(idsWhere((q) => progress.isFlagged(q.id)), 'Flagged questions'),
    'redo-wrong': () => start(shuffle((session() && session().wrongIds) || []), 'Redo the wrong ones'),
    answer: (el) => answer(el.dataset.letter),
    next,
    stop: () => { const s = session(); if (s) { s.stopped = true; store.saveSession(); } go('#/summary'); },
    flag: (el) => {
      const on = progress.toggleFlag(el.dataset.id);
      el.classList.toggle('on', on);
      el.setAttribute('aria-pressed', on);
      el.textContent = on ? '★ Flagged' : '☆ Flag';
    },
    report: (el) => ui.reportProblem(el.dataset.id),
  });

  CNCT.practice = { start, answer, next, feedbackHtml, isOpen: () => isOpen(session()), isAnswered, currentOrder };
  Object.assign(CNCT.views = CNCT.views || {}, { practiceSetup: setup, quiz, summary });
})(window.CNCT = window.CNCT || {});
