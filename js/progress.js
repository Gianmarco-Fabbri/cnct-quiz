/* Per-question progress: attempts, flags, the review rule and the statistics shown on the home page.
 * An attempt is [timestamp, 1 if correct else 0, mode], with mode 'practice', 'review' or 'exam'. */
(function (CNCT) {
  'use strict';
  const { store, data } = CNCT;

  const record = (id) => store.state.questions[id] || (store.state.questions[id] = { attempts: [], flagged: false });
  const attempts = (id) => (store.state.questions[id] && store.state.questions[id].attempts) || [];
  const isFlagged = (id) => !!(store.state.questions[id] && store.state.questions[id].flagged);

  function addAttempt(id, correct, mode, save = true) {
    record(id).attempts.push([Date.now(), correct ? 1 : 0, mode]);
    if (save) store.save();
  }
  // A question answered wrongly stays in review until it has been answered correctly twice in a row.
  function needsReview(id) {
    const a = attempts(id);
    let lastWrong = -1;
    a.forEach((x, i) => { if (!x[1]) lastWrong = i; });
    return lastWrong >= 0 && a.length - 1 - lastWrong < 2;
  }
  const lastCorrect = (id) => { const a = attempts(id); return a.length ? !!a[a.length - 1][1] : null; };
  function toggleFlag(id) { const r = record(id); r.flagged = !r.flagged; store.save(); return r.flagged; }

  // Per unit: questions, questions tried, questions right at the last attempt.
  function unitStats() {
    const out = {};
    data.unitIds().forEach((u) => { out[u] = { total: 0, tried: 0, correct: 0 }; });
    data.active().forEach((q) => {
      const s = out[q.unit];
      s.total++;
      const last = lastCorrect(q.id);
      if (last !== null) { s.tried++; if (last) s.correct++; }
    });
    return out;
  }
  // Topics with at least 3 answers, weakest first.
  function weakestTopics(n) {
    const byTopic = {};
    data.active().forEach((q) => {
      const a = attempts(q.id);
      if (!a.length) return;
      const t = byTopic[q.topic] || (byTopic[q.topic] = { topic: q.topic, unit: q.unit, answers: 0, correct: 0 });
      a.forEach((x) => { t.answers++; t.correct += x[1]; });
    });
    return Object.values(byTopic).filter((t) => t.answers >= 3)
      .sort((a, b) => a.correct / a.answers - b.correct / b.answers || b.answers - a.answers).slice(0, n);
  }

  CNCT.progress = { record, attempts, isFlagged, addAttempt, needsReview, lastCorrect, toggleFlag, unitStats, weakestTopics };
})(window.CNCT = window.CNCT || {});
