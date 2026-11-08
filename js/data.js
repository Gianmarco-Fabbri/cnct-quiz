/* The question bank: loading data/questions.js, lookups, and the HTML for slide references and badges.
 * Slides, labs and practice PDFs are not copied into the site: links point to ../ExamMaterial/.
 * The public edition (GitHub Pages, written by export_public_site.py) has "public": true in its data and no
 * references, notes or origin: isPublic() switches the views to the quiz-only version. */
(function (CNCT) {
  'use strict';
  const { escapeHtml } = CNCT.util;

  const MATERIAL = '../ExamMaterial/';
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

  const isPublic = () => !!(data.doc && data.doc.public);
  // Names that differ in the public edition, which says "exam simulation" instead of "mock exam".
  const TERMS = {
    local: { exam: 'mock exam', Exam: 'Mock exam', exams: 'mock exams', Exams: 'Mock exams' },
    public: { exam: 'exam simulation', Exam: 'Exam simulation', exams: 'exam simulations', Exams: 'Exam simulations' },
  };
  const term = (key) => TERMS[isPublic() ? 'public' : 'local'][key];
  // Mock exams saved before the rename keep their old title in localStorage: show them with the new name.
  const sessionTitle = (t) => (isPublic() && t === 'Random mock exam' ? 'Exam simulation' : t);
  const active = () => data.doc.questions.filter((q) => q.status !== 'removed');
  const unitIds = () => Object.keys(data.doc.units).sort(); // sorted: "10" would otherwise come before "01"
  const unitName = (u) => (data.doc.units[u] ? data.doc.units[u].name : u);
  const mockExamUnit = (q) => (q.unit === '10' ? LAB_UNIT[q.topic.slice(0, 5)] || '10' : q.unit);
  const topicsOf = (unit) => Array.from(new Set(active().filter((q) => !unit || q.unit === unit).map((q) => q.topic)))
    .sort((a, b) => a.localeCompare(b, 'en'));

  function pageRanges(pages) {
    const p = Array.from(new Set(pages)).sort((a, b) => a - b);
    const out = [];
    for (let i = 0; i < p.length;) {
      let j = i;
      while (j + 1 < p.length && p[j + 1] === p[j] + 1) j++;
      out.push([p[i], p[j]]);
      i = j + 1;
    }
    return out;
  }
  const materialUrl = (relPath) => MATERIAL + relPath.split('/').map(encodeURIComponent).join('/');
  const pdfUrl = (pdf, page) => materialUrl(pdf) + '#page=' + page;
  const mockExamPdfUrl = (exam) => materialUrl('Practice/CNCT ' + exam.name.replace('Mock exam', 'Mock Exam') + ' 2026-27.pdf');

  function referencesHtml(refs) {
    return refs.map((r) => {
      const name = r.pdf.split('/').pop();
      const links = pageRanges(r.pages).map(([a, b]) =>
        `<a href="${escapeHtml(pdfUrl(r.pdf, a))}" target="_blank" rel="noopener" data-pdf>${a === b ? a : a + '-' + b}</a>`);
      const old = r.pdf.indexOf('Slides-2025_26') === 0 ? ' <span class="badge old-slides">2025/26 slides</span>' : '';
      return `<span class="ref">${escapeHtml(name)}, p. ${links.join(', ')}${r.section ? ' (' + escapeHtml(r.section) + ')' : ''}</span>${old}`;
    }).join('; ');
  }
  function badgesHtml(q) {
    let s = q.origin === 'exam' ? '<span class="badge exam">exam</span>' : '<span class="badge created">created</span>';
    if (q.status === 'weak') s += '<span class="badge weak">weak</span>';
    if (q.new_2026) s += '<span class="badge new">new 2026/27</span>';
    if (q.no_correct_option) s += '<span class="badge weak">no correct option</span>';
    return s;
  }

  Object.assign(data, { load, isPublic, term, sessionTitle, active, unitIds, unitName, mockExamUnit, topicsOf, pdfUrl, mockExamPdfUrl, referencesHtml, badgesHtml });
  CNCT.data = data;
})(window.CNCT = window.CNCT || {});
