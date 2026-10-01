'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   Tooltip + scorciatoie + mini-guida
   ───────────────────────────────────────────────────────────────────────────
   • Qualsiasi elemento con data-tip (o title, convertito al volo) mostra un
     tooltip curato. data-tip-key="M" aggiunge la scorciatoia.
   • Da telefono: pressione lunga su un pulsante = tooltip (niente click).
   • data-key="m" su un pulsante: premendo M (fuori dai campi di testo) il
     pulsante viene cliccato.
   • TdtTour.start(steps): guida a fumetti, una volta sola per browser.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let tip, cur = null, showT = null, lastHide = 0, suppressClick = false;

  function ensure() {
    if (tip) return tip;
    tip = document.createElement('div');
    tip.className = 'tdt-tip';
    tip.setAttribute('role', 'tooltip');
    document.body.appendChild(tip);
    return tip;
  }

  function targetOf(node) {
    const t = node?.closest?.('[data-tip],[title]');
    if (!t || t.closest('.tdt-tip')) return null;
    if (t.hasAttribute('title')) {
      // title nativo → data-tip (evita il doppio tooltip del browser)
      if (!t.dataset.tip) t.dataset.tip = t.getAttribute('title');
      t.setAttribute('aria-label', t.getAttribute('aria-label') || t.getAttribute('title'));
      t.removeAttribute('title');
    }
    return t.dataset.tip ? t : null;
  }

  function show(t) {
    const txt = t.dataset.tip;
    if (!txt || t.classList.contains('hidden') || t.offsetParent === null && getComputedStyle(t).position !== 'fixed') return;
    const key = t.dataset.tipKey || (t.dataset.key ? t.dataset.key.toUpperCase() : '');
    const el = ensure();
    el.innerHTML = esc(txt) + (key ? ` <kbd>${esc(key)}</kbd>` : '');
    el.classList.remove('below');
    el.style.left = '0px'; el.style.top = '0px';
    el.classList.add('on');
    const r = t.getBoundingClientRect();
    const tr = el.getBoundingClientRect();
    const side = t.dataset.tipSide;
    let x, y;
    if (side === 'right') { x = r.right + 10; y = r.top + r.height / 2 - tr.height / 2; }
    else if (side === 'left') { x = r.left - tr.width - 10; y = r.top + r.height / 2 - tr.height / 2; }
    else {
      x = r.left + r.width / 2 - tr.width / 2;
      y = r.top - tr.height - 10;
      if (y < 6) { y = r.bottom + 10; el.classList.add('below'); }
    }
    x = Math.max(6, Math.min(x, window.innerWidth - tr.width - 6));
    y = Math.max(6, Math.min(y, window.innerHeight - tr.height - 6));
    el.style.left = x + 'px'; el.style.top = y + 'px';
    cur = t;
  }
  function hide() {
    clearTimeout(showT);
    if (tip && cur) { tip.classList.remove('on'); lastHide = Date.now(); }
    cur = null;
  }

  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const t = targetOf(e.target);
    if (t === cur) return;
    hide();
    if (!t) return;
    const quick = Date.now() - lastHide < 400; // passando da un pulsante all'altro: subito
    showT = setTimeout(() => show(t), quick ? 30 : 380);
  });
  document.addEventListener('pointerout', (e) => {
    if (!cur) { clearTimeout(showT); return; }
    if (!e.relatedTarget || !cur.contains(e.relatedTarget)) hide();
  });
  document.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') hide(); }, true);
  window.addEventListener('scroll', hide, true);
  window.addEventListener('blur', hide);
  document.addEventListener('focusin', (e) => {
    const t = targetOf(e.target);
    if (t && e.target.matches(':focus-visible')) show(t);
  });
  document.addEventListener('focusout', hide);

  // pressione lunga su touch
  let lpT = null;
  document.addEventListener('touchstart', (e) => {
    const t = targetOf(e.target); if (!t) return;
    clearTimeout(lpT);
    lpT = setTimeout(() => {
      show(t); suppressClick = true;
      if (navigator.vibrate) try { navigator.vibrate(8); } catch { }
      setTimeout(hide, 2200);
    }, 480);
  }, { passive: true });
  ['touchend', 'touchmove', 'touchcancel'].forEach(ev => document.addEventListener(ev, () => clearTimeout(lpT), { passive: true }));
  document.addEventListener('click', (e) => {
    if (suppressClick) { suppressClick = false; e.preventDefault(); e.stopPropagation(); }
  }, true);

  // ── Scorciatoie ────────────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (document.querySelector('.tdt-tour.on')) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : '';
    if (!k) return;
    const btn = [...document.querySelectorAll(`[data-key="${CSS.escape(k)}"]`)]
      .find(b => !b.disabled && !b.classList.contains('hidden') && b.offsetParent !== null);
    if (btn) { e.preventDefault(); btn.click(); btn.classList.add('key-flash'); setTimeout(() => btn.classList.remove('key-flash'), 220); }
  });

  // ── Mini-guida ─────────────────────────────────────────────────────────
  const TdtTour = {
    start(steps, { storageKey = 'tdt_tour_v1', force = false } = {}) {
      try { if (!force && localStorage.getItem(storageKey)) return; } catch { }
      const list = steps.filter(s => { const el = document.querySelector(s.el); return el && !el.classList.contains('hidden') && el.offsetParent !== null; });
      if (!list.length) return;
      let i = 0;
      const root = document.createElement('div');
      root.className = 'tdt-tour on';
      root.innerHTML = '<div class="tdt-tour-ring"></div><div class="tdt-tour-card" role="dialog" aria-live="polite"></div>';
      document.body.appendChild(root);
      const ring = root.querySelector('.tdt-tour-ring');
      const card = root.querySelector('.tdt-tour-card');
      const done = () => {
        try { localStorage.setItem(storageKey, '1'); } catch { }
        root.classList.remove('on');
        window.removeEventListener('resize', place);
        setTimeout(() => root.remove(), 250);
      };
      function place() {
        const s = list[i];
        const el = document.querySelector(s.el);
        if (!el) return done();
        const r = el.getBoundingClientRect();
        const pad = 8;
        Object.assign(ring.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
        card.innerHTML = `
          <div class="tdt-tour-step">${i + 1} di ${list.length}</div>
          <div class="tdt-tour-title">${esc(s.title)}</div>
          <div class="tdt-tour-text">${esc(s.text)}</div>
          <div class="tdt-tour-actions">
            <button type="button" class="tdt-tour-skip">${i === list.length - 1 ? '' : 'Salta'}</button>
            <button type="button" class="tdt-tour-next">${i === list.length - 1 ? 'Ho capito' : 'Avanti'}</button>
          </div>`;
        const cr = card.getBoundingClientRect();
        let x = r.left + r.width / 2 - cr.width / 2;
        let y = r.top - cr.height - 22;
        if (y < 10) y = r.bottom + 22;
        x = Math.max(10, Math.min(x, window.innerWidth - cr.width - 10));
        Object.assign(card.style, { left: x + 'px', top: y + 'px' });
        card.querySelector('.tdt-tour-next').onclick = () => { i++; i >= list.length ? done() : place(); };
        const sk = card.querySelector('.tdt-tour-skip');
        if (sk.textContent) sk.onclick = done; else sk.style.visibility = 'hidden';
      }
      window.addEventListener('resize', place);
      root.addEventListener('keydown', (e) => { if (e.key === 'Escape') done(); });
      place();
      setTimeout(() => card.querySelector('.tdt-tour-next')?.focus(), 50);
    },
  };
  window.TdtTour = TdtTour;
  window.tdtTip = { show, hide };
})();
