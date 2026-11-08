/* Mock exam: the setup page with the history, the timed exam and the result with the correction.
 * Session: { kind: 'exam', title, ids, index, orders, answers, doubts, start, duration, submitted, result }.
 * As in the real exam, answers can be changed or cleared until submission and solutions appear only at the end. */
(function (CNCT) {
  'use strict';
  const { $, escapeHtml, shuffle, formatNumber, formatDate, formatClock, shortOnMobile } = CNCT.util;
  const { store, data, progress, ui, mockExam, actions } = CNCT;
  const go = (hash, replace) => CNCT.router.go(hash, replace);
  const LOW_TIME_MS = 5 * 60000;

  let timer = null;
  const stopTimer = () => { clearInterval(timer); timer = null; };

  const session = () => (store.session && store.session.kind === 'exam' ? store.session : null);
  const isRunning = () => { const s = session(); return !!(s && !s.submitted); };
  const remainingMs = (s) => s.start + s.duration * 60000 - Date.now();

  // ---------------------------------------------------------------- setup
  function historyHtml() {
    const done = store.state.mockExams.slice().reverse().slice(0, 20);
    if (!done.length) return '';
    let h = `<section class="card"><h2>Mock exams taken</h2><div class="scroll"><table class="table"><thead><tr><th>Date</th><th>Exam</th>
      <th class="num">Score</th><th class="num">C / W / B</th><th class="num hide-mobile">Time</th></tr></thead><tbody>`;
    done.forEach((x) => {
      h += `<tr><td>${formatDate(x.t)}</td><td>${escapeHtml(x.title)}</td><td class="num"><b>${formatNumber(x.score)}</b></td>
        <td class="num">${x.correct} / ${x.wrong} / ${x.blank}</td><td class="num hide-mobile">${formatClock(x.durationSec)}</td></tr>`;
    });
    return h + '</tbody></table></div><p class="muted" style="font-size:.85rem">C correct, W wrong, B blank.</p></section>';
  }

  function setup() {
    const duration = store.state.settings.duration || 60;
    const f = data.doc.exam_format;
    let h = `<h1>Mock exam</h1><section class="card">
      <p>${f.questions} questions, +${formatNumber(f.correct, 0)} correct, ${formatNumber(f.wrong)} wrong, 0 blank. You can leave questions blank,
        go back and change an answer until you submit. Solutions appear only at the end, as in the exam.</p>
      <h2 style="margin-top:12px">Questions</h2><div class="choices">`;
    // The public edition has only the random mock exam: no radio, and no fixed mock exams in its data.
    if (data.isPublic()) h += `<p>${f.questions} new random questions at every attempt, with the topic weights of the real exam.</p>`;
    else {
      h += `<label class="choice"><input type="radio" name="exam-type" value="random" checked><span><b>New random mock exam</b><br>
          <span class="muted">30 questions weighted by CFU, with the quotas of the official guide; never a question without a correct option,
          at most ${mockExam.MAX_WEAK} weak ones.</span></span></label>`;
    }
    (data.doc.mock_exams || []).forEach((exam, k) => {
      h += `<label class="choice"><input type="radio" name="exam-type" value="${k}"><span><b>${escapeHtml(exam.name)}</b><br>
        <span class="muted">The same questions as the <a href="${escapeHtml(data.mockExamPdfUrl(exam))}" target="_blank" rel="noopener" data-pdf>PDF</a>,
        with the options shuffled.</span></span></label>`;
    });
    h += `</div><label class="choice" style="margin-top:8px"><input type="checkbox" id="prefer-unseen" checked>
        <span>${data.isPublic() ? 'Pick first' : 'In the random mock exam, pick first'} the questions you have never tried</span></label>
      <h2 style="margin-top:12px">Time</h2><div class="choices">
        <label class="choice"><input type="radio" name="duration" value="60" ${duration === 60 ? 'checked' : ''}><span><b>60 minutes</b> <span class="muted">(for practice)</span></span></label>
        <label class="choice"><input type="radio" name="duration" value="70" ${duration === 70 ? 'checked' : ''}><span><b>70 minutes</b> <span class="muted">(as in the exam, setup included)</span></span></label>
      </div><div class="actions"><button class="btn primary" data-action="start-exam" id="start-exam">Start the mock exam</button></div></section>`;
    $('#app').innerHTML = h + historyHtml();
  }

  function start(ids, title, duration) {
    const orders = {};
    ids.forEach((id, k) => { orders[k] = shuffle(Object.keys(data.byId[id].options)); });
    store.session = { kind: 'exam', title, ids: ids.slice(), index: 0, orders, answers: {}, doubts: {}, start: Date.now(), duration, submitted: false };
    store.saveSession();
    go('#/mock');
  }

  // ---------------------------------------------------------------- running exam
  function render() {
    const s = session();
    if (!s) { go('#/', true); return; }
    if (s.submitted) { go('#/result', true); return; }
    if (remainingMs(s) <= 0) { submit(true); return; }
    const i = s.index, id = s.ids[i], q = data.byId[id], order = s.orders[i], chosen = s.answers[i];
    const answered = Object.keys(s.answers).length;
    let h = `<div class="exam-bar"><span class="timer" id="timer" aria-label="Time left">${formatClock(remainingMs(s) / 1000)}</span>
      <span class="muted">${answered}/${s.ids.length} answered</span>
      <button class="btn primary small" data-action="submit-exam">Submit</button></div>
      <section class="card" id="question" data-id="${escapeHtml(id)}"><div class="question-head"><span>Question ${i + 1} of ${s.ids.length}</span>
      <button class="flag ${s.doubts[i] ? 'on' : ''}" data-action="doubt" aria-pressed="${!!s.doubts[i]}">${s.doubts[i] ? '● Unsure' : '○ Unsure'}</button></div>
      <div class="stem">${escapeHtml(q.text)}</div><div class="options">`;
    order.forEach((letter, k) => {
      h += `<button class="option ${chosen === letter ? 'chosen' : ''}" data-action="choose" data-letter="${letter}" aria-pressed="${chosen === letter}">
        <span class="key">${k + 1}</span><span class="label">${escapeHtml(q.options[letter])}</span></button>`;
    });
    h += `</div><div class="actions"><button class="btn" data-action="move" data-to="${i - 1}" ${i === 0 ? 'disabled' : ''}>← Previous</button>
      <button class="btn" data-action="clear-answer" ${chosen ? '' : 'disabled'}>Clear answer</button>
      <button class="btn primary" data-action="move" data-to="${i + 1}" ${i + 1 >= s.ids.length ? 'disabled' : ''}>Next →</button></div>
      <div class="navigator" aria-label="Go to question">`;
    s.ids.forEach((_, k) => {
      const cls = [s.answers[k] ? 'answered' : '', k === i ? 'current' : '', s.doubts[k] ? 'doubt' : ''].join(' ').trim();
      h += `<button class="${cls}" data-action="move" data-to="${k}" aria-label="Question ${k + 1}">${k + 1}</button>`;
    });
    h += `</div><p class="shortcuts"><kbd>1</kbd>–<kbd>${order.length}</kbd> choose (again to clear) · <kbd>0</kbd> clear · <kbd>Enter</kbd>/<kbd>→</kbd> next ·
      <kbd>←</kbd> previous · <kbd>D</kbd> unsure</p></section>`;
    $('#app').innerHTML = h;
    stopTimer();
    timer = setInterval(tick, 500);
  }
  function tick() {
    const s = session();
    if (!s || s.submitted) { stopTimer(); return; }
    const ms = remainingMs(s);
    if (ms <= 0) { stopTimer(); submit(true); return; }
    const el = $('#timer');
    if (el) { el.textContent = formatClock(ms / 1000); el.classList.toggle('low', ms < LOW_TIME_MS); }
  }

  function choose(letter) {
    const s = session();
    if (!isRunning()) return;
    if (s.answers[s.index] === letter) delete s.answers[s.index]; else s.answers[s.index] = letter;
    store.saveSession();
    render();
  }
  function clearAnswer() { const s = session(); if (!isRunning()) return; delete s.answers[s.index]; store.saveSession(); render(); }
  function move(k) {
    const s = session();
    if (!isRunning() || k < 0 || k >= s.ids.length) return;
    s.index = k;
    store.saveSession();
    render();
  }
  function toggleDoubt() { const s = session(); if (!isRunning()) return; s.doubts[s.index] = !s.doubts[s.index]; store.saveSession(); render(); }

  function askSubmit() {
    const s = session();
    const missing = s.ids.length - Object.keys(s.answers).length;
    ui.confirm(missing ? `${missing} answers missing: they count 0. Submit anyway?` : 'Submit the mock exam?', 'Submit', () => submit(false));
  }
  function submit(auto) {
    stopTimer();
    const s = session();
    if (!s || s.submitted) return;
    ui.closeModal(); // e.g. the time ran out while the confirmation was open
    const r = mockExam.score(s.ids, s.answers);
    s.ids.forEach((id, k) => { if (s.answers[k]) progress.addAttempt(id, s.answers[k] === data.byId[id].answer, 'exam', false); });
    r.durationSec = Math.min(s.duration * 60, Math.round((Date.now() - s.start) / 1000));
    r.auto = !!auto;
    s.submitted = true;
    s.result = r;
    store.state.mockExams.push({ t: Date.now(), title: s.title, score: r.score, correct: r.correct, wrong: r.wrong, blank: r.blank,
      durationSec: r.durationSec, ids: s.ids, answers: s.ids.map((_, k) => s.answers[k] || null) });
    store.save();
    store.saveSession();
    go('#/result', true);
    if (auto) ui.toast('Time is up: mock exam submitted.');
  }

  // ---------------------------------------------------------------- result
  function result(params) {
    const s = session();
    if (!s || !s.submitted) { go('#/', true); return; }
    const r = s.result, f = data.doc.exam_format, threshold = f.lab_bonus.written_threshold;
    const labs = Number(store.state.settings.labs || 0);
    const bonus = mockExam.labBonus(r.score, labs);
    const showAll = params.get('all') === '1';
    const perUnit = {};
    s.ids.forEach((id, k) => {
      const q = data.byId[id], a = s.answers[k];
      const u = perUnit[q.unit] || (perUnit[q.unit] = { total: 0, correct: 0, wrong: 0, blank: 0 });
      u.total++;
      if (!a) u.blank++; else if (a === q.answer) u.correct++; else u.wrong++;
    });
    let h = `<h1>${escapeHtml(s.title)}: result</h1><section class="card">
      <div class="score ${r.score >= threshold ? 'pass' : 'fail'}" id="score">${formatNumber(r.score)} <span class="out-of">/ ${f.questions}</span></div>
      <p>${r.score >= threshold ? `Pass (at least ${threshold}).` : `Below ${threshold}: fail.`} ${r.auto ? 'Submitted when the time ran out.' : ''}</p>
      <div class="stats"><div class="stat"><b>${r.correct}</b><span>correct (+${formatNumber(r.correct * f.correct)})</span></div>
        <div class="stat"><b>${r.wrong}</b><span>wrong (${formatNumber(r.wrong * f.wrong)})</span></div>
        <div class="stat"><b>${r.blank}</b><span>blank (0)</span></div>
        <div class="stat"><b>${formatClock(r.durationSec)}</b><span>time used of ${s.duration}:00</span></div></div>
      <p style="margin-top:12px"><label>Labs attended: <select id="labs" class="inline">${[0, 1, 2, 3, 4].map((n) => `<option ${n === labs ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        → bonus ${formatNumber(bonus, 1)} (only with a written score of at least ${threshold}). <b>Total: ${formatNumber(r.score + bonus)} / ${f.max_written_score}.</b>
        <span class="muted">With 27 or more you can ask for the oral exam; 32 = 30 cum laude.</span></p>
      <div class="scroll"><table class="table" style="margin-top:8px"><thead><tr><th>Unit</th><th class="num">${shortOnMobile('Questions', 'Q')}</th>
        <th class="num">${shortOnMobile('Correct', 'C')}</th><th class="num">${shortOnMobile('Wrong', 'W')}</th><th class="num">${shortOnMobile('Blank', 'B')}</th></tr></thead><tbody>`;
    Object.keys(perUnit).sort().forEach((u) => {
      const x = perUnit[u];
      h += `<tr><td>${u} ${escapeHtml(data.unitName(u))}</td><td class="num">${x.total}</td><td class="num">${x.correct}</td><td class="num">${x.wrong}</td><td class="num">${x.blank}</td></tr>`;
    });
    const mistakes = r.wrong + r.blank;
    h += `</tbody></table></div><div class="actions">${mistakes ? `<button class="btn primary" data-action="practise-exam-mistakes">Practise the mistakes (${mistakes})</button>` : ''}
      <button class="btn" data-action="go" data-href="#/exam">New mock exam</button><button class="btn" data-action="go" data-href="#/">Home</button></div></section>
      <section class="card"><div class="question-head"><h2 style="margin:0">Correction</h2>
        <a href="#/result${showAll ? '' : '?all=1'}">${showAll ? 'Mistakes and blanks only' : 'Show all'}</a></div>`;
    s.ids.forEach((id, k) => {
      const q = data.byId[id], a = s.answers[k];
      const st = !a ? 'blank' : a === q.answer ? 'correct' : 'wrong';
      if (!showAll && st === 'correct') return;
      const label = { correct: '✓ correct', wrong: '✗ wrong', blank: '– blank' }[st];
      h += `<div class="review-item"><div><span class="status ${st}">${k + 1}. ${label}</span> <span class="muted">· ${escapeHtml(q.unit)} ${escapeHtml(q.topic)}</span></div>
        <p>${escapeHtml(q.text)}</p>${st === 'wrong' ? `<p><b>Your answer: ${a})</b> ${escapeHtml(q.options[a])}</p>` : ''}
        ${CNCT.practice.feedbackHtml(q, a || '?', false)}</div>`;
    });
    if (!showAll && !mistakes) h += '<p>All correct.</p>';
    $('#app').innerHTML = h + '</section>';
    $('#labs').onchange = (e) => { store.state.settings.labs = Number(e.target.value); store.save(); result(CNCT.router.current().params); };
  }

  // ---------------------------------------------------------------- actions
  Object.assign(actions, {
    'start-exam': () => {
      const type = ($('input[name="exam-type"]:checked') || {}).value || 'random';
      const duration = Number(($('input[name="duration"]:checked') || {}).value || 60);
      store.state.settings.duration = duration;
      store.save();
      if (type === 'random') start(mockExam.generate($('#prefer-unseen').checked), 'Random mock exam', duration);
      else { const exam = data.doc.mock_exams[Number(type)]; start(exam.questions, exam.name, duration); }
    },
    choose: (el) => choose(el.dataset.letter),
    move: (el) => move(Number(el.dataset.to)),
    'clear-answer': clearAnswer,
    doubt: toggleDoubt,
    'submit-exam': askSubmit,
    'practise-exam-mistakes': () => {
      const s = session();
      CNCT.practice.start(s.ids.filter((id, k) => s.answers[k] !== data.byId[id].answer), 'Mock exam mistakes');
    },
  });

  CNCT.exam = { start, submit, choose, clearAnswer, move, toggleDoubt, stopTimer, isRunning, session };
  Object.assign(CNCT.views = CNCT.views || {}, { examSetup: setup, mock: render, result });
})(window.CNCT = window.CNCT || {});
