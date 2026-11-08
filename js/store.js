/* Persistent state in localStorage: per-question progress, problem reports, finished mock exams and settings,
 * plus the session in progress (a practice run or a mock exam).
 * Data saved by the earlier Italian version of the site (cnct2026.stato.v1) is converted once, on first load. */
(function (CNCT) {
  'use strict';

  const STATE_KEY = 'cnct2026.state.v1';
  const SESSION_KEY = 'cnct2026.session.v1';
  const LEGACY_STATE_KEY = 'cnct2026.stato.v1';
  const LEGACY_SESSION_KEY = 'cnct2026.sessione.v1';
  const EXPORT_APP = 'cnct-quiz';

  const store = { state: null, session: null, STATE_KEY, SESSION_KEY };

  function read(key) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  let warned = false;
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) {
      if (!warned) { warned = true; CNCT.ui.toast('This browser does not save your progress (private browsing?). Use "Export" to keep it.'); }
      return false;
    }
  }
  function remove(key) { try { localStorage.removeItem(key); } catch (e) { /* nothing to do */ } }

  function emptyState() {
    return { version: 1, questions: {}, reports: [], mockExams: [], settings: { theme: 'auto', duration: 60, labs: 0 } };
  }
  function normalize(s) {
    const v = emptyState();
    if (!s || typeof s !== 'object') return v;
    v.questions = s.questions && typeof s.questions === 'object' ? s.questions : {};
    v.reports = Array.isArray(s.reports) ? s.reports : [];
    v.mockExams = Array.isArray(s.mockExams) ? s.mockExams : [];
    v.settings = Object.assign(v.settings, s.settings || {});
    return v;
  }

  // ---- conversion from the Italian version
  const LEGACY_MODES = { pratica: 'practice', ripasso: 'review', sim: 'exam' };
  const LEGACY_THEMES = { auto: 'auto', chiaro: 'light', scuro: 'dark' };
  const legacyTitle = (t) => String(t || '').replace(/^Simulazione casuale$/, 'Random mock exam').replace(/^Simulazione (\d+)$/, 'Mock exam $1');
  function fromLegacy(old) {
    const s = emptyState();
    if (!old || typeof old !== 'object') return s;
    Object.keys(old.domande || {}).forEach((id) => {
      const x = old.domande[id] || {};
      s.questions[id] = { attempts: (x.t || []).map(([t, ok, mode]) => [t, ok, LEGACY_MODES[mode] || mode]), flagged: !!x.s };
    });
    s.reports = (old.segnalazioni || []).map((x) => ({ id: x.id, t: x.t, text: x.testo, dataVersion: x.versione_dati }));
    s.mockExams = (old.simulazioni || []).map((x) => ({
      t: x.t, title: legacyTitle(x.titolo), score: x.punteggio, correct: x.giuste, wrong: x.sbagliate, blank: x.nonDate,
      durationSec: x.durataSec, ids: x.ids, answers: x.risposte,
    }));
    const old_ = old.impostazioni || {};
    s.settings = { theme: LEGACY_THEMES[old_.tema] || 'auto', duration: old_.durata || 60, labs: old_.lab || 0 };
    return s;
  }

  function load() {
    let saved = read(STATE_KEY);
    if (!saved) {
      const legacy = read(LEGACY_STATE_KEY);
      if (legacy) {
        saved = fromLegacy(legacy);
        if (write(STATE_KEY, saved)) remove(LEGACY_STATE_KEY);
      }
    }
    remove(LEGACY_SESSION_KEY); // a session left open in the Italian version is not carried over
    store.state = normalize(saved);
    store.session = read(SESSION_KEY);
  }
  const reloadState = () => { store.state = normalize(read(STATE_KEY)); };
  const save = () => write(STATE_KEY, store.state);
  const saveSession = () => (store.session ? write(SESSION_KEY, store.session) : remove(SESSION_KEY));
  function reset() { store.state = emptyState(); store.session = null; save(); saveSession(); }

  // ---- export and import
  const exportPayload = (dataVersion) => ({ app: EXPORT_APP, exported: new Date().toISOString(), dataVersion, state: store.state });
  // Accepts the current export format and the one of the Italian version.
  function parseExport(json) {
    if (json && json.app === EXPORT_APP && json.state && typeof json.state.questions === 'object') return normalize(json.state);
    if (json && json.app === 'cnct2026' && json.stato && typeof json.stato.domande === 'object') return normalize(fromLegacy(json.stato));
    return null;
  }
  // Adds the imported data to the current state without duplicating attempts, reports or mock exams.
  function merge(incoming) {
    let added = 0;
    const questions = store.state.questions;
    Object.keys(incoming.questions).forEach((id) => {
      const x = incoming.questions[id];
      if (!x || !Array.isArray(x.attempts)) return;
      const r = questions[id] || (questions[id] = { attempts: [], flagged: false });
      const seen = new Set(r.attempts.map((a) => a.join(':')));
      x.attempts.forEach((a) => { const k = a.join(':'); if (!seen.has(k)) { r.attempts.push(a); seen.add(k); added++; } });
      r.attempts.sort((p, q) => p[0] - q[0]);
      r.flagged = r.flagged || !!x.flagged;
    });
    const reportKeys = new Set(store.state.reports.map((x) => x.id + ':' + x.t));
    incoming.reports.forEach((x) => { if (!reportKeys.has(x.id + ':' + x.t)) store.state.reports.push(x); });
    const examKeys = new Set(store.state.mockExams.map((x) => x.t));
    incoming.mockExams.forEach((x) => { if (!examKeys.has(x.t)) store.state.mockExams.push(x); });
    store.state.mockExams.sort((p, q) => p.t - q.t);
    save();
    return added;
  }

  Object.assign(store, { load, reloadState, save, saveSession, reset, emptyState, normalize, fromLegacy, exportPayload, parseExport, merge });
  CNCT.store = store;
})(window.CNCT = window.CNCT || {});
