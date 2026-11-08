/* The question bank: loading data/questions.js and the lookups the views use. */
(function (CNCT) {
  'use strict';

  // Lab questions (unit 10) count towards the unit the lab belongs to.
  const LAB_UNIT = { 'Lab 1': '03', 'Lab 2': '04', 'Lab 3': '08', 'Lab 4': '08' };

  const data = { doc: null, byId: {} };

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  // questions.js works over http and from file://; over http a query string avoids a stale cached copy.
  async function load() {
    if (!window.CNCT_DATA) {
      const fresh = /^https?:$/.test(location.protocol) ? '?v=' + Date.now() : '';
      await loadScript('data/questions.js' + fresh);
    }
    const doc = window.CNCT_DATA;
    if (!doc || !Array.isArray(doc.questions)) throw new Error('no question data');
    data.doc = doc;
    data.byId = {};
    doc.questions.forEach((q) => { data.byId[q.id] = q; });
    return doc;
  }

  // Exam simulations saved under an older name ("Random mock exam", "Mock exam 2") show with the current one.
  const sessionTitle = (t) => String(t || '').replace(/^(Random mock exam|Mock exam \d+)/, 'Exam simulation');
  const active = () => data.doc.questions.filter((q) => q.status !== 'removed');
  const unitIds = () => Object.keys(data.doc.units).sort(); // sorted: "10" would otherwise come before "01"
  const unitName = (u) => (data.doc.units[u] ? data.doc.units[u].name : u);
  const mockExamUnit = (q) => (q.unit === '10' ? LAB_UNIT[q.topic.slice(0, 5)] || '10' : q.unit);

  Object.assign(data, { load, sessionTitle, active, unitIds, unitName, mockExamUnit });
  CNCT.data = data;
})(window.CNCT = window.CNCT || {});
