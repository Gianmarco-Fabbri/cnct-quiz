/* Random exam simulations weighted like the official guide: 30 questions, 5 per CFU.
 * Whole quotas add up to 28; the 2 remaining slots go to two of the units whose quota ends in .5. */
(function (CNCT) {
  'use strict';
  const { shuffle } = CNCT.util;
  const { data, progress } = CNCT;

  const BASE_QUOTAS = { '01': 6, '02': 3, '03': 6, '04': 3, '05': 2, cloud: 6, '07': 1, '09': 1 };
  const HALF_SLOT_UNITS = ['04', 'cloud', '07', '09'];
  const MAX_WEAK = 2;

  // Quotas per unit for one exam; "cloud" (06 + 08) is split in half, with the odd slot drawn at random.
  function drawQuotas() {
    const quotas = Object.assign({}, BASE_QUOTAS);
    shuffle(HALF_SLOT_UNITS).slice(0, 2).forEach((u) => { quotas[u]++; });
    const cloud = quotas.cloud;
    delete quotas.cloud;
    quotas['06'] = Math.floor(cloud / 2) + (cloud % 2 && Math.random() < 0.5 ? 1 : 0);
    quotas['08'] = cloud - quotas['06'];
    return quotas;
  }

  // Interleaves the topics so that one exam does not pick three questions on the same topic.
  function roundRobin(pool) {
    const groups = new Map();
    pool.forEach((q) => { if (!groups.has(q.topic)) groups.set(q.topic, []); groups.get(q.topic).push(q); });
    const lists = Array.from(groups.values());
    const out = [];
    while (lists.some((l) => l.length)) lists.forEach((l) => { if (l.length) out.push(l.shift()); });
    return out;
  }

  // Returns 30 question ids in random order. preferUnseen puts the questions never tried first.
  function generate(preferUnseen) {
    const quotas = drawQuotas();
    const usable = data.active().filter((q) => !q.no_correct_option);
    const chosen = [];
    let weak = 0;
    Object.keys(quotas).forEach((unit) => {
      let pool = shuffle(usable.filter((q) => data.mockExamUnit(q) === unit));
      if (preferUnseen) {
        const unseen = (q) => !progress.attempts(q.id).length;
        pool = pool.filter(unseen).concat(pool.filter((q) => !unseen(q)));
      }
      let taken = 0;
      for (const q of roundRobin(pool)) {
        if (taken >= quotas[unit]) break;
        if (q.status === 'weak' && weak >= MAX_WEAK) continue;
        if (q.duplicate_of && chosen.some((c) => c.id === q.duplicate_of)) continue;
        chosen.push(q);
        taken++;
        if (q.status === 'weak') weak++;
      }
    });
    return shuffle(chosen).map((q) => q.id);
  }

  // Score with the exam rules: +1 correct, -0.33 wrong, 0 blank.
  function score(ids, answers) {
    const f = data.doc.exam_format;
    const r = { correct: 0, wrong: 0, blank: 0 };
    ids.forEach((id, k) => {
      const a = answers[k];
      if (!a) r.blank++;
      else if (a === data.byId[id].answer) r.correct++;
      else r.wrong++;
    });
    r.score = Math.round((r.correct * f.correct + r.wrong * f.wrong) * 100) / 100;
    return r;
  }

  // Lab bonus: 0.5 per lab attended (max 2), only if the written score reaches the threshold.
  function labBonus(writtenScore, labs) {
    const b = data.doc.exam_format.lab_bonus;
    return writtenScore >= b.written_threshold ? Math.min(b.max, labs * b.per_lab) : 0;
  }

  CNCT.mockExam = { generate, score, labBonus, MAX_WEAK };
})(window.CNCT = window.CNCT || {});
