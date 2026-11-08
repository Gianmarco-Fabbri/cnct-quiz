/* Keyboard shortcuts.
 * Practice: 1–n answer, 0 don't know, Enter next, S flag.
 * Exam simulation: 1–n choose (again to clear), 0 or Backspace clear, Enter or → next, ← previous, D unsure.
 * Summary: Enter goes home. Escape closes a dialog. */
(function (CNCT) {
  'use strict';
  const { $ } = CNCT.util;

  function onKey(e) {
    const { ui, store, router, practice, exam } = CNCT;
    if (ui.isModalOpen()) { if (e.key === 'Escape') ui.closeModal(); return; }
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Enter' && (tag === 'button' || tag === 'a')) return; // Enter on a focused button activates that button
    const { path } = router.current();
    const n = /^[0-9]$/.test(e.key) ? Number(e.key) : null;
    const handled = () => e.preventDefault();

    if (path === '/quiz' && practice.isOpen()) {
      const answered = practice.isAnswered();
      const order = practice.currentOrder();
      if (!answered && n !== null && n >= 1 && n <= order.length) { handled(); practice.answer(order[n - 1]); }
      else if (!answered && n === 0) { handled(); practice.answer('?'); }
      else if (answered && e.key === 'Enter') { handled(); practice.next(); }
      else if (e.key === 's' || e.key === 'S') { handled(); const b = $('[data-action="flag"]'); if (b) CNCT.actions.flag(b); }
    } else if (path === '/mock' && exam.isRunning()) {
      const s = store.session;
      const order = s.orders[s.index];
      if (n !== null && n >= 1 && n <= order.length) { handled(); exam.choose(order[n - 1]); }
      else if (n === 0 || e.key === 'Backspace') { handled(); exam.clearAnswer(); }
      else if (e.key === 'Enter' || e.key === 'ArrowRight') { handled(); exam.move(s.index + 1); }
      else if (e.key === 'ArrowLeft') { handled(); exam.move(s.index - 1); }
      else if (e.key === 'd' || e.key === 'D') { handled(); exam.toggleDoubt(); }
    } else if (path === '/summary' && e.key === 'Enter') { handled(); router.go('#/'); }
  }

  CNCT.keyboard = { onKey };
})(window.CNCT = window.CNCT || {});
