/* Shared interface pieces: toast messages, the modal dialog, confirmations, the "report a problem" dialog,
 * file downloads and the light/dark theme. */
(function (CNCT) {
  'use strict';
  const { $, escapeHtml } = CNCT.util;

  function toast(text) {
    const el = $('#toast');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.hidden = true; }, 3800);
  }

  function closeModal() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; m.onclick = null; }
  // onChoice(value, modalElement) runs when an element with data-modal="value" is clicked.
  function openModal(html, onChoice) {
    const m = $('#modal');
    m.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true">${html}</div>`;
    m.hidden = false;
    m.onclick = (e) => {
      if (e.target === m) { closeModal(); return; }
      const b = e.target.closest('[data-modal]');
      if (b) onChoice(b.dataset.modal, m);
    };
    const focus = $('textarea', m) || $('[data-modal="yes"]', m);
    if (focus) focus.focus();
  }
  const isModalOpen = () => !$('#modal').hidden;

  function confirm(text, label, onYes) {
    openModal(`<p>${escapeHtml(text)}</p><div class="actions"><button class="btn" data-modal="no">Cancel</button>
      <button class="btn primary" data-modal="yes">${escapeHtml(label)}</button></div>`,
    (choice) => { closeModal(); if (choice === 'yes') onYes(); });
  }

  function reportProblem(id) {
    const q = CNCT.data.byId[id];
    openModal(`<h2>Report a problem · question ${escapeHtml(id)}</h2>
      <p class="muted">${escapeHtml(q.text.slice(0, 160))}${q.text.length > 160 ? '…' : ''}</p>
      <label class="field">What is wrong? (It stays in this browser; you find it in Data and export it with your progress.)
      <textarea id="report-text" placeholder="E.g. the cited slide does not say this; I think b is also correct…"></textarea></label>
      <div class="actions"><button class="btn" data-modal="no">Cancel</button><button class="btn primary" data-modal="yes">Save report</button></div>`,
    (choice, box) => {
      if (choice === 'no') { closeModal(); return; }
      const text = $('#report-text', box).value.trim();
      if (!text) { toast('Write first what is wrong.'); return; }
      CNCT.store.state.reports.push({ id, t: Date.now(), text, dataVersion: CNCT.data.doc.version });
      CNCT.store.save();
      closeModal();
      toast('Report saved. You find it in Data.');
    });
  }

  function download(fileName, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  const THEMES = ['auto', 'light', 'dark'];
  const THEME_ICON = { auto: '◐', light: '☀︎', dark: '☾' };
  function applyTheme() {
    const t = CNCT.store.state.settings.theme;
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
    const b = $('#theme');
    b.textContent = THEME_ICON[t] || THEME_ICON.auto;
    b.title = `Theme: ${t} (click to change)`;
    b.setAttribute('aria-label', `Theme: ${t}. Change theme`);
  }
  function cycleTheme() {
    const s = CNCT.store.state.settings;
    s.theme = THEMES[(THEMES.indexOf(s.theme) + 1) % THEMES.length];
    CNCT.store.save();
    applyTheme();
    toast('Theme: ' + s.theme);
  }

  CNCT.ui = { toast, openModal, closeModal, isModalOpen, confirm, reportProblem, download, applyTheme, cycleTheme, THEMES };
})(window.CNCT = window.CNCT || {});
