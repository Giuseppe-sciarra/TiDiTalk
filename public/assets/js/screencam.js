'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   TIDITALK 1.9.0 — Camera di chi presenta dentro lo schermo condiviso
   ───────────────────────────────────────────────────────────────────────────
   • Mentre qualcuno presenta con la videocamera accesa, la sua camera compare
     DENTRO il riquadro dello schermo: nell'angolo (finestrella da spostare
     col mouse o col dito, doppio clic = più grande / più piccola) oppure
     affiancata a destra. Il suo riquadro normale esce dalla fila, così non
     si vede due volte. «Nella fila» = com'era prima.
   • La scelta vale solo per chi guarda (localStorage), niente al server:
     usa lo stesso flusso della camera già ricevuto, nessuna banda in più.
   • Il tasto «Camera» sta tra gli strumenti dello schermo (in alto a destra,
     accanto a Disegna). Anche in Impostazioni → Aspetto.
   • Registrazione (recorder.js): la camera finisce dentro lo schermo nello
     stesso modo (recordCam), e il riquadro della persona non si ripete.
   • Agganci: layout.js before() toglie dalla fila i riquadri in embedded();
     room.js _desiredLayerForTile chiede la qualità giusta per la finestrella
     (boxFor); annotate.js _contentRect tiene conto della colonna affiancata
     (data-tsc-split sul riquadro) così i disegni restano al loro posto.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  const KEY = 'tdt_screencam', POS = 'tdt_screencam_pos', BIG = 'tdt_screencam_big';
  const MODES = ['pip', 'split', 'off'];
  const SPLIT = 0.26;         // parte del riquadro presa dalla camera affiancata
  const MIN_TILE_W = 300;     // schermo più stretto (fila, telefono piccolo): camera nella fila come prima
  const T = (s) => (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t(s) : s;
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) { } },
  };
  let mode = MODES.includes(ls.get(KEY, 'pip')) ? ls.get(KEY, 'pip') : 'pip';
  let pos = null;             // { x, y } = angolo in alto a sinistra della finestrella, in frazioni del riquadro
  try { const p = JSON.parse(ls.get(POS, 'null')); if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) pos = { x: p.x, y: p.y }; } catch (_) { }
  let big = ls.get(BIG, '0') === '1';
  let embedded = new Set();   // id dei riquadri persona che ora stanno dentro uno schermo ('local' o peerId)
  const boxes = new Map();    // id riquadro persona → .tsc-cam

  const svg = (d, s = 16) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICON = {
    cam: svg('<rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10.5l6-3.5v10l-6-3.5"/>'),
    pip: svg('<rect x="2.5" y="4.5" width="19" height="15" rx="2"/><rect x="12" y="11.5" width="7" height="5.5" rx="1" fill="currentColor" stroke="none"/>'),
    split: svg('<rect x="2.5" y="4.5" width="19" height="15" rx="2"/><path d="M15 4.5v15"/><rect x="16.5" y="9.5" width="3.5" height="5" rx=".8" fill="currentColor" stroke="none"/>'),
    off: svg('<rect x="2.5" y="4.5" width="19" height="11" rx="2"/><rect x="5" y="17.5" width="4" height="2.5" rx=".6"/><rect x="10" y="17.5" width="4" height="2.5" rx=".6"/><rect x="15" y="17.5" width="4" height="2.5" rx=".6"/>'),
    chev: svg('<path d="M7 10l5 5 5-5"/>', 12),
  };
  const LABEL = { pip: 'Nell\'angolo', split: 'Affiancata', off: 'Nella fila' };

  // ── Di chi è lo schermo e dov'è la sua camera ────────────────────────────
  function camFor(tile) {
    const pid = tile.dataset.peerId || '';
    if (pid === 'local-screen') {
      const v = document.getElementById('video-local');
      const off = typeof camOff !== 'undefined' && camOff; // eslint-disable-line no-undef
      if (!v || !v.srcObject || off || v.style.display === 'none') return null;
      return { id: 'local', video: v, local: true, name: typeof DISPLAY_NAME !== 'undefined' ? DISPLAY_NAME : '' }; // eslint-disable-line no-undef
    }
    if (!/-screen$/.test(pid)) return null;
    const id = pid.replace(/-screen$/, '');
    const p = (typeof peers !== 'undefined' && peers.get) ? peers.get(id) : null; // eslint-disable-line no-undef
    const v = document.getElementById('video-' + id);
    if (!p || p.videoOff || p.secondScreen || !v || !v.srcObject || v.style.display === 'none') return null;
    if (!v.srcObject.getVideoTracks().some(t => t.readyState === 'live')) return null;
    return { id, video: v, local: false, name: p.displayName || '' };
  }

  // ── Finestrella ──────────────────────────────────────────────────────────
  function place(box, tile) {
    if (mode !== 'pip') { box.style.left = box.style.top = ''; return; }
    const W = tile.clientWidth, H = tile.clientHeight;
    const bw = box.offsetWidth, bh = box.offsetHeight, m = 10;
    let x, y;
    if (pos) { x = pos.x * W; y = pos.y * H; }
    else {
      // prima volta: in basso a destra; se lì c'è la tua finestrella (telefono,
      // «Tu in una finestrella»), in alto a destra sotto gli strumenti dello schermo
      x = W - bw - m - 2; y = H - bh - m - 2;
      const tr = tile.getBoundingClientRect();
      const hit = (r) => r && r.width && !(tr.left + x + bw < r.left || tr.left + x > r.right || tr.top + y + bh < r.top || tr.top + y > r.bottom);
      const self = document.querySelector('#videoGrid .video-tile.local.lv-float');
      if (self && hit(self.getBoundingClientRect())) {
        const tools = tile.querySelector(':scope > .stage-tools');
        y = tools ? tools.offsetTop + tools.offsetHeight + 8 : 52;
      }
    }
    x = Math.round(Math.max(m, Math.min(W - bw - m, x)));
    y = Math.round(Math.max(m, Math.min(H - bh - m, y)));
    if (box.style.left !== x + 'px') box.style.left = x + 'px';
    if (box.style.top !== y + 'px') box.style.top = y + 'px';
  }
  function makeBox(tile) {
    const box = document.createElement('div');
    box.className = 'tsc-cam';
    box.setAttribute('data-i18n-skip', '');
    box.innerHTML = '<video autoplay muted playsinline></video><span class="tsc-name" translate="no"></span>';
    const v = box.querySelector('video');
    v.addEventListener('loadedmetadata', () => fitAspect(box));
    v.addEventListener('resize', () => fitAspect(box));
    // trascina (mouse e dito); un clic non sposta niente
    let drag = null;
    box.addEventListener('pointerdown', (e) => {
      if (mode !== 'pip' || e.button > 0) return;
      e.stopPropagation(); e.preventDefault();
      const t = box.parentElement; if (!t) return;
      drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: box.offsetLeft, y: box.offsetTop, moved: false };
      try { box.setPointerCapture(e.pointerId); } catch (_) { }
    });
    box.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag.moved = true; box.classList.add('tsc-dragging');
      const t = box.parentElement, m = 10;
      const x = Math.max(m, Math.min(t.clientWidth - box.offsetWidth - m, drag.x + dx));
      const y = Math.max(m, Math.min(t.clientHeight - box.offsetHeight - m, drag.y + dy));
      box.style.left = x + 'px'; box.style.top = y + 'px';
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const t = box.parentElement;
      if (drag.moved && t && t.clientWidth) {
        pos = { x: box.offsetLeft / t.clientWidth, y: box.offsetTop / t.clientHeight };
        ls.set(POS, JSON.stringify(pos));
      }
      box.classList.remove('tsc-dragging');
      drag = null;
    };
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);
    // doppio clic: più grande / più piccola (e non manda a tutta pagina lo schermo sotto)
    box.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (mode !== 'pip') return;
      big = !big; ls.set(BIG, big ? '1' : '0');
      document.querySelectorAll('.tsc-cam').forEach(b => { b.classList.toggle('tsc-big', big); const t = b.parentElement; if (t) place(b, t); });
      scheduleLayers();
    });
    box.addEventListener('click', (e) => e.stopPropagation());
    return box;
  }
  function fitAspect(box) {
    const v = box.querySelector('video');
    if (v && v.videoWidth && v.videoHeight) box.style.setProperty('--tsc-ar', (v.videoWidth / v.videoHeight).toFixed(4));
    const t = box.parentElement; if (t) place(box, t);
  }
  function removeBox(id) {
    const box = boxes.get(id); if (!box) return;
    boxes.delete(id);
    const t = box.parentElement;
    try { box.querySelector('video').srcObject = null; } catch (_) { }
    box.remove();
    if (t) { t.classList.remove('tsc-split', 'tsc-has-cam'); delete t.dataset.tscSplit; }
  }

  // ── Riallineamento: chiamato dal MutationObserver e ogni 700 ms ──────────
  let busy = false;
  function reconcile() {
    if (busy) return; busy = true;
    try {
      const grid = document.getElementById('videoGrid');
      const tiles = grid ? [...grid.querySelectorAll('.video-tile.screenshare')] : [];
      const next = new Set();
      for (const tile of tiles) {
        const c = camFor(tile);
        const room = tile.clientWidth >= MIN_TILE_W && !tile.classList.contains('spotlight-strip');
        // già messa dentro un altro schermo della stessa persona: una volta sola
        if (!c || mode === 'off' || !room || next.has(c.id)) {
          for (const [id, b] of boxes) if (b.parentElement === tile) removeBox(id);
          continue;
        }
        let box = boxes.get(c.id);
        if (box && box.parentElement !== tile) { removeBox(c.id); box = null; }
        if (!box) { box = makeBox(tile); boxes.set(c.id, box); tile.appendChild(box); }
        const v = box.querySelector('video');
        if (v.srcObject !== c.video.srcObject) { v.srcObject = c.video.srcObject; v.play?.().catch(() => { }); }
        box.classList.toggle('tsc-mirror', c.local && !document.body.classList.contains('tdt-nomirror'));
        box.classList.toggle('tsc-big', big);
        const nm = c.local ? T('Tu') : c.name, nEl = box.querySelector('.tsc-name');
        if (nEl.textContent !== nm) nEl.textContent = nm;
        tile.classList.add('tsc-has-cam');
        tile.classList.toggle('tsc-split', mode === 'split');
        if (mode === 'split') { if (tile.dataset.tscSplit !== String(SPLIT)) tile.dataset.tscSplit = String(SPLIT); }
        else if ('tscSplit' in tile.dataset) delete tile.dataset.tscSplit;
        place(box, tile);
        next.add(c.id);
      }
      for (const id of [...boxes.keys()]) if (!next.has(id)) removeBox(id);
      paintButtons();
      const changed = next.size !== embedded.size || [...next].some(id => !embedded.has(id));
      embedded = next;
      if (changed) {
        try { if (typeof updateGridLayout === 'function') updateGridLayout(); } catch (_) { } // eslint-disable-line no-undef
        // i disegni si riallineano alla colonna nuova
        try { window._annotator?._resizeAll?.(); } catch (_) { }
        scheduleLayers();
      }
    } finally { busy = false; }
  }
  function scheduleLayers() { try { if (typeof scheduleLayerUpdate === 'function') scheduleLayerUpdate(); } catch (_) { } } // eslint-disable-line no-undef

  // ── Tasto «Camera» tra gli strumenti dello schermo ───────────────────────
  let menu = null;
  function paintButtons() {
    document.querySelectorAll('#videoGrid .video-tile.screenshare').forEach(tile => {
      const tools = tile.querySelector(':scope > .stage-tools');
      let b = tile.querySelector('.tsc-btn');
      const show = !!tools && !!camFor(tile);
      if (!show) { if (b) b.remove(); return; }
      if (!b) {
        b = document.createElement('button');
        b.type = 'button'; b.className = 'stage-btn tsc-btn';
        b.setAttribute('aria-haspopup', 'menu');
        b.addEventListener('click', (e) => { e.stopPropagation(); openMenu(b); });
        b.addEventListener('dblclick', (e) => e.stopPropagation());
        tools.insertBefore(b, tools.firstChild);
      }
      const k = mode;
      if (b.dataset.mode !== k) {
        b.dataset.mode = k;
        b.innerHTML = ICON.cam + '<span>' + T('Camera') + '</span>' + ICON.chev;
        b.dataset.tip = T('Dove vedere la camera di chi presenta') + ': ' + T(LABEL[k]);
        b.setAttribute('aria-label', b.dataset.tip);
      }
    });
  }
  function closeMenu() {
    if (!menu) return;
    menu.remove(); menu = null;
    document.removeEventListener('pointerdown', onDoc, true);
    document.removeEventListener('keydown', onKey, true);
  }
  function onDoc(e) { if (menu && !menu.contains(e.target) && !e.target.closest('.tsc-btn')) closeMenu(); }
  function onKey(e) {
    if (!menu) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); const b = menu._btn; closeMenu(); b?.focus(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = [...menu.querySelectorAll('[role="menuitemradio"]')];
      const i = items.indexOf(document.activeElement);
      items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
    }
  }
  function openMenu(btn) {
    if (menu) { const same = menu._btn === btn; closeMenu(); if (same) return; }
    menu = document.createElement('div');
    menu.className = 'tsc-menu'; menu.setAttribute('role', 'menu');
    menu._btn = btn;
    const head = document.createElement('div'); head.className = 'tsc-menu-h'; head.textContent = T('Camera di chi presenta');
    menu.appendChild(head);
    for (const k of MODES) {
      const it = document.createElement('button');
      it.type = 'button'; it.className = 'tsc-item' + (k === mode ? ' on' : '');
      it.setAttribute('role', 'menuitemradio'); it.setAttribute('aria-checked', k === mode ? 'true' : 'false');
      it.innerHTML = `<span class="tsc-item-ico">${ICON[k]}</span><span class="tsc-item-l"></span>`;
      it.querySelector('.tsc-item-l').textContent = T(LABEL[k]);
      it.addEventListener('click', (e) => { e.stopPropagation(); setMode(k); closeMenu(); btn.focus(); });
      menu.appendChild(it);
    }
    document.body.appendChild(menu);
    const r = btn.getBoundingClientRect();
    const mw = menu.offsetWidth;
    menu.style.left = Math.max(8, Math.min(window.innerWidth - mw - 8, r.right - mw)) + 'px';
    menu.style.top = (r.bottom + 6) + 'px';
    (menu.querySelector('.tsc-item.on') || menu.querySelector('.tsc-item'))?.focus();
    document.addEventListener('pointerdown', onDoc, true);
    document.addEventListener('keydown', onKey, true);
  }

  function setMode(k) {
    if (!MODES.includes(k)) return;
    mode = k; ls.set(KEY, k);
    document.querySelectorAll('#videoGrid .video-tile.screenshare').forEach(t => { t.classList.remove('tsc-split'); delete t.dataset.tscSplit; });
    embedded = new Set([...embedded, '__force']); // forza il ricalcolo del layout
    reconcile();
    document.dispatchEvent(new CustomEvent('tdt:screencam', { detail: { mode } }));
  }

  // ── Per la registrazione (recorder.js) ───────────────────────────────────
  /** Per lo schermo di questo riquadro: { videoEl, mode, pos:{x,y}, big, id } oppure null. */
  function recordCam(screenTile) {
    if (!screenTile) return null;
    for (const [id, box] of boxes) {
      if (box.parentElement !== screenTile) continue;
      const v = box.querySelector('video');
      const W = screenTile.clientWidth || 1, H = screenTile.clientHeight || 1;
      return {
        id, videoEl: v, mode, big, mirror: box.classList.contains('tsc-mirror'),
        rect: { x: box.offsetLeft / W, y: box.offsetTop / H, w: box.offsetWidth / W, h: box.offsetHeight / H },
        split: mode === 'split' ? SPLIT : 0,
      };
    }
    return null;
  }

  // ── Avvio ────────────────────────────────────────────────────────────────
  function start() {
    const grid = document.getElementById('videoGrid');
    if (!grid) { setTimeout(start, 500); return; }
    let t = null;
    // solo i cambi che contano: riquadri e video che arrivano o vanno, classi dei
    // riquadri, video nascosti (camera spenta). I nostri elementi non contano.
    const ours = (n) => n && n.nodeType === 1 && !!n.closest?.('.tsc-cam, .tsc-btn');
    const relevant = (r) => {
      if (ours(r.target)) return false;
      if (r.type === 'childList') return [...r.addedNodes, ...r.removedNodes].some(n => n.nodeType === 1 && !ours(n) && !n.classList?.contains('tsc-cam') && !n.classList?.contains('tsc-btn'));
      if (r.attributeName === 'class') return !!r.target.classList?.contains('video-tile');
      return r.target.tagName === 'VIDEO';
    };
    new MutationObserver((recs) => { if (!recs.some(relevant)) return; clearTimeout(t); t = setTimeout(reconcile, 60); })
      .observe(grid, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
    setInterval(reconcile, 700);
    window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(reconcile, 120); });
    reconcile();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  window.TdtScreenCam = {
    embedded: () => [...embedded].filter(id => id !== '__force'),
    boxFor: (id) => boxes.get(id) || null,
    recordCam, setMode, getMode: () => mode, MODES, LABEL,
    refresh: reconcile,
  };
})();
