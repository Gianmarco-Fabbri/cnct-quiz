/* Small helpers shared by every module: DOM lookup, escaping, shuffling, formatting,
 * and the table of click actions that the views fill in (see app.js). */
(function (CNCT) {
  'use strict';

  const LOCALE = 'en-GB';

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const formatNumber = (n, digits = 2) => Number(n).toLocaleString(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const percent = (part, total) => (total ? Math.round((100 * part) / total) : null);
  const formatDate = (t) => new Date(t).toLocaleString(LOCALE, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  function formatClock(seconds) {
    const s = Math.max(0, Math.round(seconds));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }
  const today = () => new Date().toISOString().slice(0, 10);
  // Full table header on wide screens, abbreviation on phones.
  const shortOnMobile = (long, short) => `<span class="long">${long}</span><abbr class="short" title="${long}">${short}</abbr>`;

  CNCT.util = { $, $$, escapeHtml, shuffle, formatNumber, percent, formatDate, formatClock, today, shortOnMobile };
  // Click handlers by name: an element with data-action="x" runs CNCT.actions.x(element).
  CNCT.actions = CNCT.actions || {};
})(window.CNCT = window.CNCT || {});
