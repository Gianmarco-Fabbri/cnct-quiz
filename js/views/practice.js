/* Practice: the setup page (any set of units, how many questions), the question-by-question session with immediate
 * feedback, and the summary.
 * Session: { kind: 'practice', title, ids, index, orders, answers, review, created, stopped }.
 * orders[i] is the shuffled order of the option letters shown for question i; answers[i] is the chosen letter
 * ('?' for "don't know"). In review mode a question goes back in the queue until it is right twice in a row. */
(function (CNCT) {
  'use strict';
  const { $, $$, escapeHtml, shuffle, percent } = CNCT.util;
  const { store, data, progress, ui, actions } = CNCT;
  const go = (hash, replace) => CNCT.router.go(hash, replace);
  const MAX_REVIEW_QUEUE = 400;
  const MAX_COUNT = 60;

  // ---------------------------------------------------------------- setup
  // Any set of units; 10, 20 or 30 questions or a custom number up to MAX_COUNT; always in random order.
  function readSetup() {
    const units = $$('input[name="f-units"]:checked').map((el) => el.value);
    const choice = ($('input[name="f-count"]:checked') || {}).value;
    const custom = Number($('#f-custom').value);
    const count = choice === 'custom' ? (Number.isInteger(custom) && custom >= 1 && custom <= MAX_COUNT ? custom : null) : Number(choice);
    return { units, count, pool: data.active().filter((q) => units.includes(q.unit)) };
  }
  function updateCount() {
    const { units, count, pool } = readSetup();
    let message;
    if (!units.length) message = 'Choose at least one unit.';
    else if (!count) message = `Enter a number from 1 to ${MAX_COUNT}.`;
    else message = `${pool.length} questions in the chosen units; you will get ${Math.min(count, pool.length)}, in random order.`;
    $('#f-matches').textContent = message;
    $('#f-start').disabled = !units.length || !count || !pool.length;
  }
  // #/practice?unit=03 (from the unit table of the home page) starts with that unit only; otherwise all are checked.
  function setup(params) {
    const chosen = (params.get('unit') || '').split(',').filter((u) => data.doc.units[u]);
    let h = `<h1>Practice by unit</h1><section class="card">
      <div class="question-head"><h2 style="margin:0">Units</h2><span class="actions" style="margin:0">
        <button class="btn small" data-action="units-all">All</button><button class="btn small" data-action="units-none">None</button></span></div>
      <div class="unit-choices">`;
    data.unitIds().forEach((u) => {
      const n = data.active().filter((q) => q.unit === u).length;
      h += `<label class="choice"><input type="checkbox" name="f-units" value="${u}" ${!chosen.length || chosen.includes(u) ? 'checked' : ''}>
        <span>${u} ${escapeHtml(data.unitName(u))} <span class="muted">(${n})</span></span></label>`;
    });
    h += '</div><h2 style="margin-top:16px">Questions</h2><div class="count-choices">';
    [10, 20, 30].forEach((n) => {
      h += `<label class="choice"><input type="radio" name="f-count" value="${n}" ${n === 20 ? 'checked' : ''}><span>${n}</span></label>`;
    });
    h += `<label class="choice"><input type="radio" name="f-count" value="custom"><span>Custom</span>
        <input type="number" id="f-custom" min="1" max="${MAX_COUNT}" step="1" inputmode="numeric" placeholder="1–${MAX_COUNT}" aria-label="Number of questions, from 1 to ${MAX_COUNT}"></label></div>
      <p id="f-matches" class="muted" style="margin-top:12px"></p>
      <div class="actions"><button class="btn primary" data-action="start-practice" id="f-start">Start</button></div></section>`;
    $('#app').innerHTML = h;
    $$('input[name="f-units"], input[name="f-count"]').forEach((el) => { el.onchange = updateCount; });
    const custom = $('#f-custom');
    custom.onfocus = () => { $('input[name="f-count"][value="custom"]').checked = true; updateCount(); };
    custom.oninput = updateCount;
    updateCount();
  }
  function startFromSetup() {
    const { units, count, pool } = readSetup();
    if (!units.length || !count) return;
    const all = units.length === data.unitIds().length;
    const title = all ? 'All units' : units.length === 1 ? `Unit ${units[0]}` : `Units ${units.join(', ')}`;
    start(shuffle(pool.map((q) => q.id)).slice(0, count), title);
  }
  const setUnits = (on) => { $$('input[name="f-units"]').forEach((el) => { el.checked = on; }); updateCount(); };

  // ---------------------------------------------------------------- session
  function start(ids, title, options, replace) {
    if (!ids.length) { ui.toast('No question matches.'); return; }
    store.session = { kind: 'practice', title, ids: ids.slice(), index: 0, orders: {}, answers: {}, review: !!(options && options.review), created: Date.now() };
    store.saveSession();
    go('#/quiz', replace);
  }
  const session = () => (store.session && store.session.kind === 'practice' ? store.session : null);
  const isOpen = (s) => s && s.index < s.ids.length && !s.stopped;

  // After an answer: outcome, correct answer, explanation and the question number, nothing else.
  function feedbackHtml(q, answer, showOutcome = true) {
    const correct = answer === q.answer;
    let h = '<div class="feedback" role="status">';
    if (showOutcome) {
      const label = answer === '?' ? 'No answer' : correct ? '✓ Correct' : '✗ Wrong';
      h += `<div class="outcome ${correct ? 'correct' : 'wrong'}">${label}</div>`;
    }
    return h + `<p><b>Correct answer: ${q.answer})</b> ${escapeHtml(q.options[q.answer])}${q.no_correct_option ? ' <span class="muted">(the least wrong)</span>' : ''}</p>
      <p>${escapeHtml(q.explanation)}</p><p class="muted" style="font-size:.85rem">Question ${escapeHtml(q.id)}</p></div>`;
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
        <span class="label">${escapeHtml(q.options[letter])}</span>${done ? `<span class="letter" title="Letter of this option">${letter})</span>` : ''}</button>`;
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
    'start-practice': startFromSetup,
    'units-all': () => setUnits(true),
    'units-none': () => setUnits(false),
    'start-review': () => start(idsWhere((q) => progress.needsReview(q.id)), 'Review mistakes', { review: true }),
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
  });

  CNCT.practice = { start, answer, next, feedbackHtml, isOpen: () => isOpen(session()), isAnswered, currentOrder };
  Object.assign(CNCT.views = CNCT.views || {}, { practiceSetup: setup, quiz, summary });
})(window.CNCT = window.CNCT || {});
