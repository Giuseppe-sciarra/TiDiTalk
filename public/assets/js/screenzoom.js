'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   TIDITALK 1.8.2 — Zoom sullo schermo condiviso (solo per chi guarda)
   ───────────────────────────────────────────────────────────────────────────
   • Su ogni schermo condiviso da un ALTRO: barra «− 140% +  Adatta  ⧉»,
     Ctrl/⌘ + rotellina e pizzico (trackpad, touch) centrati sul punto del
     cursore, trascinamento quando è ingrandito, minimappa nell'angolo con la
     zona visibile (clic, trascina o frecce per spostarsi). Ctrl/⌘ + più, meno
     e 0 solo quando il mouse è sopra lo schermo: altrove resta lo zoom del
     browser. Lo zoom vale solo per te: niente arriva al server.
   • Come: il <video> e il livello del disegno di annotate.js finiscono in un
     contenitore (.sz-stage) ingrandito con una CSS transform. Il disegno resta
     allineato al contenuto da sé: annotate.js misura i punti con
     getBoundingClientRect, che tiene conto della transform. Il laser viene
     disegnato in scala inversa (surface.viewScale) per non diventare enorme.
   • Registrazione, «Salva immagine» e finestra mobile leggono il <video>
     (fotogrammi interi) e le coordinate normalizzate: non vedono lo zoom.
   • «Apri in una nuova finestra»: /screen-window (screen.html) aperta con
     window.open; quella pagina chiede lo stream a questa (window.opener) e lo
     mette nel suo <video>: stesso flusso, nessun secondo consumer. I disegni
     li ridisegna su un canvas con Annotator.drawOn della pagina principale.
   • Nessun aggancio in room.js: un MutationObserver su #videoGrid trova i
     riquadri .screenshare degli altri (data-peer-id «<sid>-screen»).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  const POPUP = document.documentElement.dataset.szPopup === '1';
  const MIN = 1, MAX = 4;
  const STEPS = [1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const IS_MAC = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');
  const MOD = IS_MAC ? '⌘' : 'Ctrl';
  const svg = (p, s = 16) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const ICON = {
    out: svg('<path d="M5.5 12h13"/>'),
    in: svg('<path d="M12 5.5v13M5.5 12h13"/>'),
    fit: svg('<path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15"/>'),
    win: svg('<path d="M10.5 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-4.5"/><path d="M14 3.5h6.5V10M20.5 3.5L12 12"/>'),
    back: svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>'),
    away: svg('<rect x="2.5" y="4" width="12" height="9" rx="1.6"/><rect x="9.5" y="10" width="12" height="9" rx="1.6"/>', 30),
  };
  const toast = (m, d) => { try { if (typeof showToast === 'function') showToast(m, d); else window.showToast?.(m, d); } catch (_) { } };
  let hovered = null; // riquadro sotto il mouse: lì valgono Ctrl/⌘ + più/meno/0

  class Zoomer {
    constructor(host, video, o) {
      this.host = host; this.video = video; this.sid = (o && o.sid) || '';
      this.z = 1; this.tx = 0; this.ty = 0;
      this.touches = new Map(); this.drag = null; this.pinch = null; this.moved = false; this._eat = false;
      this.popupWin = null;
      host.classList.add('sz-host');
      const stage = this.stage = document.createElement('div');
      stage.className = 'sz-stage';
      host.insertBefore(stage, host.firstChild);
      stage.appendChild(video);
      this.adopt();
      this._buildBar();
      this._buildMap();
      if (!POPUP) this._buildNote();
      this._bind();
      this.ro = new ResizeObserver(() => this.apply(false));
      this.ro.observe(host);
      this._onVid = () => { this._aspect(); this.apply(false); };
      video.addEventListener('loadedmetadata', this._onVid);
      video.addEventListener('resize', this._onVid);
      this._aspect();
      this.apply(false);
    }

    // il livello del disegno (annotate.js) va dentro al contenitore ingrandito
    adopt() { this.host.querySelectorAll(':scope > .ann-layer, :scope > .sz-pop-ann').forEach(n => this.stage.appendChild(n)); }

    active() {
      const h = this.host;
      return h.isConnected && !h.classList.contains('spotlight-strip') && !h.classList.contains('sz-popped');
    }

    // contenuto reale del video nel riquadro (object-fit: contain), coordinate del riquadro
    rect() {
      const W = this.host.clientWidth, H = this.host.clientHeight;
      const vw = this.video.videoWidth || 16, vh = this.video.videoHeight || 9;
      const k = Math.min(W / vw, H / vh), w = vw * k, h = vh * k;
      return { W, H, x: (W - w) / 2, y: (H - h) / 2, w: Math.max(1, w), h: Math.max(1, h) };
    }
    pt(e) {
      const b = this.host.getBoundingClientRect();
      return { x: e.clientX - b.left - this.host.clientLeft, y: e.clientY - b.top - this.host.clientTop };
    }

    // ── zoom e spostamento ──────────────────────────────────────────────
    apply(anim) {
      const r = this.rect();
      if (r.W <= 0 || r.H <= 0) return;
      this.z = clamp(this.z, MIN, MAX);
      if (this.z < MIN + 1e-3) this.z = MIN;
      const z = this.z, cw = r.w * z, ch = r.h * z;
      // il contenuto copre il riquadro senza lasciare vuoti; più piccolo: centrato
      this.tx = cw <= r.W + 0.5 ? (r.W - cw) / 2 - z * r.x : clamp(this.tx, r.W - z * (r.x + r.w), -z * r.x);
      this.ty = ch <= r.H + 0.5 ? (r.H - ch) / 2 - z * r.y : clamp(this.ty, r.H - z * (r.y + r.h), -z * r.y);
      const st = this.stage.style;
      st.transition = anim ? 'transform .22s cubic-bezier(.2,.8,.2,1)' : 'none';
      st.transform = `translate(${this.tx}px, ${this.ty}px) scale(${z})`;
      const zoomed = z > 1.001;
      this.host.classList.toggle('sz-zoomed', zoomed);
      this.pct.textContent = Math.round(z * 100) + '%';
      this.bOut.disabled = !zoomed;
      this.bIn.disabled = z >= MAX - 1e-3;
      this.bFit.disabled = !zoomed;
      const v = this.view(r);
      Object.assign(this.mapView.style, { left: v.u0 * 100 + '%', top: v.v0 * 100 + '%', width: (v.u1 - v.u0) * 100 + '%', height: (v.v1 - v.v0) * 100 + '%' });
      if (!POPUP) {
        // annotate.js: il laser resta della stessa misura anche da ingrandito
        try { const s = window._annotator?.surfaces?.get(this.sid); if (s) s.viewScale = z; } catch (_) { }
      } else this._placeCanvas(r);
      this._mapLoop(zoomed && !this.host.classList.contains('sz-popped'));
    }
    // zona visibile, in coordinate 0..1 del contenuto
    view(r = this.rect()) {
      const z = this.z;
      const u = (q) => clamp(((q - this.tx) / z - r.x) / r.w, 0, 1);
      const v = (q) => clamp(((q - this.ty) / z - r.y) / r.h, 0, 1);
      return { u0: u(0), u1: u(r.W), v0: v(0), v1: v(r.H) };
    }
    zoomAt(nz, cx, cy, anim) {
      nz = clamp(nz, MIN, MAX);
      const px = (cx - this.tx) / this.z, py = (cy - this.ty) / this.z; // punto del contenuto sotto il cursore
      this.z = nz; this.tx = cx - nz * px; this.ty = cy - nz * py;       // … resta sotto il cursore
      this.apply(anim);
    }
    centerOn(u, v, anim) {
      const r = this.rect();
      this.tx = r.W / 2 - this.z * (r.x + u * r.w);
      this.ty = r.H / 2 - this.z * (r.y + v * r.h);
      this.apply(anim);
    }
    step(d) {
      const z = this.z;
      return d > 0 ? (STEPS.find(s => s > z + 0.01) || MAX) : ([...STEPS].reverse().find(s => s < z - 0.01) || MIN);
    }
    cmd(a) {
      const r = this.rect();
      if (a === 'in') this.zoomAt(this.step(1), r.W / 2, r.H / 2, true);
      else if (a === 'out') this.zoomAt(this.step(-1), r.W / 2, r.H / 2, true);
      else if (a === 'fit') { this.z = MIN; this.apply(true); }
      else if (a === 'win') Main.openWindow(this);
      else if (a === 'back') { try { window.opener?.focus(); } catch (_) { } window.close(); }
    }

    // ── comandi ─────────────────────────────────────────────────────────
    _buildBar() {
      const b = this.bar = document.createElement('div');
      b.className = 'sz-bar';
      b.setAttribute('role', 'toolbar');
      b.setAttribute('aria-label', 'Zoom dello schermo condiviso');
      b.innerHTML = `
        <button type="button" class="sz-btn" data-z="out" aria-label="Riduci" data-tip="Riduci" data-tip-key="${MOD} −">${ICON.out}</button>
        <output class="sz-pct" translate="no" data-tip="${IS_MAC ? 'Zoom solo per te: ⌘ + rotellina o pizzico per ingrandire, trascina per spostarti' : 'Zoom solo per te: Ctrl + rotellina o pizzico per ingrandire, trascina per spostarti'}">100%</output>
        <button type="button" class="sz-btn" data-z="in" aria-label="Ingrandisci" data-tip="Ingrandisci" data-tip-key="${MOD} +">${ICON.in}</button>
        <span class="sz-sep" aria-hidden="true"></span>
        <button type="button" class="sz-btn sz-fit" data-z="fit" aria-label="Adatta: vedi tutto lo schermo" data-tip="Adatta: vedi tutto lo schermo" data-tip-key="${MOD} 0">${ICON.fit}<span class="sz-lbl">Adatta</span></button>
        ${POPUP
          ? `<span class="sz-sep" aria-hidden="true"></span><button type="button" class="sz-btn sz-back" data-z="back" aria-label="Riporta nella riunione" data-tip="Chiudi questa finestra: lo schermo torna nella riunione">${ICON.back}<span class="sz-lbl">Riporta nella riunione</span></button>`
          : `<span class="sz-sep sz-win-sep" aria-hidden="true"></span><button type="button" class="sz-btn sz-win" data-z="win" aria-label="Apri in una nuova finestra" data-tip="Apri in una nuova finestra, da mettere sul secondo schermo">${ICON.win}</button>`}`;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const btn = e.target.closest('[data-z]');
        if (btn && !btn.disabled) this.cmd(btn.dataset.z);
      });
      ['dblclick', 'pointerdown'].forEach(t => b.addEventListener(t, e => e.stopPropagation()));
      this.host.appendChild(b);
      this.pct = b.querySelector('.sz-pct');
      this.bOut = b.querySelector('[data-z="out"]');
      this.bIn = b.querySelector('[data-z="in"]');
      this.bFit = b.querySelector('[data-z="fit"]');
    }

    // ── minimappa ───────────────────────────────────────────────────────
    _buildMap() {
      const m = this.map = document.createElement('div');
      m.className = 'sz-map';
      m.tabIndex = 0;
      m.setAttribute('role', 'button');
      m.setAttribute('aria-label', 'Minimappa: clicca o trascina per scegliere la zona da vedere, oppure usa le frecce');
      m.dataset.tip = 'Clicca o trascina per scegliere la zona da vedere';
      m.innerHTML = '<canvas width="192" height="108" aria-hidden="true"></canvas><div class="sz-map-view" aria-hidden="true"></div>';
      this.mapCv = m.querySelector('canvas');
      this.mapView = m.querySelector('.sz-map-view');
      let dragging = false;
      const at = (e) => {
        const b = m.getBoundingClientRect();
        this.centerOn(clamp((e.clientX - b.left) / b.width, 0, 1), clamp((e.clientY - b.top) / b.height, 0, 1), false);
      };
      m.addEventListener('pointerdown', (e) => {
        e.stopPropagation(); e.preventDefault();
        dragging = true; m.classList.add('sz-map-drag');
        try { m.setPointerCapture(e.pointerId); } catch (_) { }
        at(e);
      });
      m.addEventListener('pointermove', (e) => { if (dragging) { e.stopPropagation(); at(e); } });
      const up = () => { dragging = false; m.classList.remove('sz-map-drag'); };
      m.addEventListener('pointerup', up);
      m.addEventListener('pointercancel', up);
      ['click', 'dblclick'].forEach(t => m.addEventListener(t, e => e.stopPropagation()));
      m.addEventListener('keydown', (e) => {
        const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
        if (!d) return;
        e.preventDefault(); e.stopPropagation();
        const r = this.rect();
        this.tx -= d[0] * r.W * 0.15; this.ty -= d[1] * r.H * 0.15;
        this.apply(true);
      });
      this.host.appendChild(m);
    }
    _aspect() {
      const vw = this.video.videoWidth || 16, vh = this.video.videoHeight || 9;
      this.map.style.aspectRatio = `${vw} / ${vh}`;
      this.mapCv.width = 192; this.mapCv.height = Math.max(20, Math.round(192 * vh / vw));
    }
    _ann() { try { return POPUP ? window.opener?._annotator : window._annotator; } catch (_) { return null; } }
    _thumb() {
      const v = this.video, cv = this.mapCv;
      if (!v.videoWidth) return;
      const ctx = cv.getContext('2d');
      try { ctx.drawImage(v, 0, 0, cv.width, cv.height); } catch (_) { return; }
      const ann = this._ann();
      if (ann && ann.hasSurface?.(this.sid) && !ann.hiddenAll) {
        try { ann.drawOn(ctx, this.sid, { x: 0, y: 0, w: cv.width, h: cv.height }); } catch (_) { }
      }
    }
    _mapLoop(on) {
      if (on && !this._mapT) { this._thumb(); this._mapT = setInterval(() => this._thumb(), 400); }
      else if (!on && this._mapT) { clearInterval(this._mapT); this._mapT = 0; }
    }

    // ── mouse, rotellina, touch ─────────────────────────────────────────
    _bind() {
      const h = this.host;
      const isUi = (t) => !!(t && t.closest && t.closest('.sz-bar, .sz-map, .stage-tools, .sz-popped-note, button, textarea, input'));
      h.addEventListener('wheel', (e) => {
        if (!this.active()) return;
        const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
        if (e.ctrlKey || e.metaKey) {
          // Ctrl/⌘ + rotellina, e il pizzico del trackpad (Chrome, Edge, Firefox lo mandano così)
          e.preventDefault();
          const d = e.deltaY * k;
          const f = Math.abs(d) >= 50 ? (d < 0 ? 1.2 : 1 / 1.2) : Math.exp(-d * 0.01);
          const p = this.pt(e);
          this.zoomAt(this.z * f, p.x, p.y, false);
        } else if (this.z > 1.001) {
          // ingrandito: la rotellina (o due dita sul trackpad) sposta la vista
          e.preventDefault();
          let dx = e.deltaX * k, dy = e.deltaY * k;
          if (e.shiftKey && !dx) { dx = dy; dy = 0; }
          this.tx -= dx; this.ty -= dy;
          this.apply(false);
        }
      }, { passive: false });

      h.addEventListener('pointerdown', (e) => {
        if (!this.active() || isUi(e.target)) return;
        const drawing = h.classList.contains('ann-drawing');
        if (e.pointerType === 'touch') {
          this.touches.set(e.pointerId, this.pt(e));
          if (drawing) return;
          if (this.touches.size >= 2) { this.drag = null; this._beginPinch(); e.preventDefault(); return; }
          if (this.z > 1.001) this._beginDrag(e, false);
          return;
        }
        // tasto centrale: sposta anche mentre disegni; sinistro: sposta quando è ingrandito
        const middle = e.button === 1;
        if (!(middle || (e.button === 0 && !drawing && this.z > 1.001))) return;
        if (middle) { e.preventDefault(); e.stopPropagation(); }
        this._beginDrag(e, true);
      }, true);
      h.addEventListener('pointermove', (e) => this._move(e));
      h.addEventListener('pointerup', (e) => this._up(e));
      h.addEventListener('pointercancel', (e) => this._up(e));
      // dopo uno spostamento il clic non deve «fissare» il riquadro (room.js)
      h.addEventListener('click', (e) => { if (this._eat) { this._eat = false; e.stopPropagation(); e.preventDefault(); } }, true);
      h.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });
      h.addEventListener('pointerenter', () => { hovered = this; });
      h.addEventListener('pointerleave', () => { if (hovered === this && !POPUP) hovered = null; });
      // Safari su Mac: il pizzico del trackpad arriva come gesture*, non come wheel
      let g0 = null;
      h.addEventListener('gesturestart', (e) => {
        if (!this.active() || this.touches.size >= 2) return;
        e.preventDefault(); g0 = { z: this.z, p: this.pt(e) };
      });
      h.addEventListener('gesturechange', (e) => {
        if (!g0 || this.touches.size >= 2) return;
        e.preventDefault(); this.zoomAt(g0.z * e.scale, g0.p.x, g0.p.y, false);
      });
      h.addEventListener('gestureend', () => { g0 = null; });
    }
    _beginDrag(e, capture) {
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, tx: this.tx, ty: this.ty };
      this.moved = false;
      if (capture) { try { this.host.setPointerCapture(e.pointerId); } catch (_) { } }
      this.host.classList.add('sz-panning');
    }
    _beginPinch() {
      const [a, b] = [...this.touches.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, z: this.z, tx: this.tx, ty: this.ty };
      this.moved = true;
    }
    _move(e) {
      if (e.pointerType === 'touch' && this.touches.has(e.pointerId)) {
        this.touches.set(e.pointerId, this.pt(e));
        if (this.pinch && this.touches.size >= 2) {
          // pizzico: ingrandisce attorno al punto tra le dita e segue le dita
          const [a, b] = [...this.touches.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y) || 1, m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          const P = this.pinch, nz = clamp(P.z * d / P.d, MIN, MAX);
          const px = (P.m.x - P.tx) / P.z, py = (P.m.y - P.ty) / P.z;
          this.z = nz; this.tx = m.x - nz * px; this.ty = m.y - nz * py;
          this.apply(false);
          e.preventDefault();
          return;
        }
      }
      const D = this.drag;
      if (!D || D.id !== e.pointerId) return;
      const dx = e.clientX - D.x, dy = e.clientY - D.y;
      if (!this.moved && Math.hypot(dx, dy) < 4) return;
      this.moved = true;
      this.tx = D.tx + dx; this.ty = D.ty + dy;
      this.apply(false);
    }
    _up(e) {
      if (e.pointerType === 'touch') { this.touches.delete(e.pointerId); if (this.touches.size < 2) this.pinch = null; }
      if (this.drag && this.drag.id === e.pointerId) { this.drag = null; this.host.classList.remove('sz-panning'); }
      if (this.moved && !this.touches.size) {
        this.moved = false; this._eat = true;
        setTimeout(() => { this._eat = false; }, 350);
      }
    }

    // ── finestra separata (lato riunione) ───────────────────────────────
    _buildNote() {
      const n = this.note = document.createElement('div');
      n.className = 'sz-popped-note';
      n.innerHTML = `<span class="sz-pn-ico">${ICON.away}</span><b>Lo schermo condiviso è aperto in un'altra finestra</b>
        <div class="sz-pn-actions"><button type="button" class="sz-pn-btn" data-p="focus">Mostra la finestra</button><button type="button" class="sz-pn-btn sz-pn-primary" data-p="back">Riporta qui</button></div>`;
      n.addEventListener('click', (e) => {
        e.stopPropagation();
        const b = e.target.closest('[data-p]');
        if (!b) return;
        if (b.dataset.p === 'focus') { try { this.popupWin?.focus(); } catch (_) { } }
        else this.closePopup();
      });
      ['dblclick', 'pointerdown'].forEach(t => n.addEventListener(t, e => e.stopPropagation()));
      this.host.appendChild(n);
    }
    name() {
      try { const p = typeof peers !== 'undefined' ? peers.get(this.sid) : null; if (p && p.displayName) return p.displayName; } catch (_) { }
      return (this.host.querySelector('.tile-name-always')?.textContent || '').replace(/^Schermo di\s*/, '');
    }
    setPopup(win) {
      this.popupWin = win;
      this.z = MIN;
      this.host.classList.add('sz-popped');
      this.apply(false);
      if (!this._popT) this._popT = setInterval(() => this._popCheck(), 800);
    }
    _popCheck() {
      const w = this.popupWin;
      let closed = true;
      try { closed = !w || w.closed; } catch (_) { }
      if (closed) { this.clearPopup(); return; }
      // flusso rinnovato (nuovo consumer dopo una riconnessione): lo passo alla finestra
      try {
        const s = this.video.srcObject, P = w.TdtScreenZoomPopup;
        if (s && P && P.stream() !== s) P.setStream(s);
      } catch (_) { }
    }
    clearPopup() {
      clearInterval(this._popT); this._popT = 0;
      this.popupWin = null;
      this.host.classList.remove('sz-popped');
      this.apply(false);
    }
    closePopup() {
      const w = this.popupWin;
      this.clearPopup();
      try { if (w && !w.closed) w.close(); } catch (_) { }
    }
    destroy() {
      // presentazione finita (o chi presentava è uscito): lo dico alla finestra separata
      try { this.popupWin?.TdtScreenZoomPopup?.ended(); } catch (_) { }
      clearInterval(this._popT); this._popT = 0;
      this._mapLoop(false);
      try { this.ro.disconnect(); } catch (_) { }
      if (hovered === this) hovered = null;
    }

    // ── finestra separata (lato finestra): canvas dei disegni sul contenuto ─
    _placeCanvas(r) {
      const cv = this.stage.querySelector('.sz-pop-ann');
      if (!cv) return;
      Object.assign(cv.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
      // risoluzione che segue lo zoom: i tratti restano nitidi anche al 400%
      const k = Math.min(2, window.devicePixelRatio || 1) * this.z;
      const w = Math.min(4096, Math.round(r.w * k)), h = Math.min(4096, Math.round(r.h * k));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; this.onCanvas?.(); } // ridimensionare svuota il canvas: ridisegno subito
    }
  }

  // ── tastiera: Ctrl/⌘ + più, meno, 0 solo sopra lo schermo condiviso ──────
  window.addEventListener('keydown', (e) => {
    const z = hovered;
    if (!z || !z.active() || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    const mod = e.ctrlKey || e.metaKey;
    if (!mod && !POPUP) return; // nella finestra separata bastano anche + − 0
    const k = e.key, c = e.code;
    let act = null;
    if (k === '+' || k === '=' || c === 'NumpadAdd') act = 'in';
    else if (k === '-' || k === '_' || c === 'NumpadSubtract') act = 'out';
    else if (k === '0' || c === 'Numpad0' || c === 'Digit0') act = 'fit';
    if (!act) return;
    e.preventDefault(); e.stopPropagation();
    z.cmd(act);
  }, true);

  // ═════════════════════════════════════════════════════════════════════════
  // Pagina della riunione
  // ═════════════════════════════════════════════════════════════════════════
  const Main = {
    list: new Map(), // riquadro → Zoomer
    find(sid) { for (const z of this.list.values()) if (z.sid === sid && z.host.isConnected) return z; return null; },
    scan() {
      const grid = document.getElementById('videoGrid');
      if (!grid) return;
      grid.querySelectorAll('.video-tile.screenshare').forEach(host => {
        const pid = host.dataset.peerId || '';
        if (host.classList.contains('local') || !/-screen$/.test(pid)) return; // il tuo schermo: niente zoom
        let z = this.list.get(host);
        if (!z) {
          const v = host.querySelector('video');
          if (!v) return;
          z = new Zoomer(host, v, { sid: pid.replace(/-screen$/, '') });
          this.list.set(host, z);
        } else z.adopt();
        // finito nella fila in alto: torna intero
        if (host.classList.contains('spotlight-strip') && z.z > 1) { z.z = MIN; z.apply(false); }
      });
      for (const [host, z] of this.list) if (!host.isConnected) { z.destroy(); this.list.delete(host); }
    },
    openWindow(z) {
      try { if (z.popupWin && !z.popupWin.closed) { z.popupWin.focus(); return; } } catch (_) { }
      const aw = screen.availWidth || 1440, ah = screen.availHeight || 900;
      const w = Math.round(Math.min(1600, aw * 0.8)), h = Math.round(Math.min(1000, ah * 0.8));
      let win = null;
      try {
        win = window.open('/screen-window?sid=' + encodeURIComponent(z.sid), 'tdt_screen_' + z.sid.replace(/[^\w]/g, '').slice(0, 24), `popup=yes,width=${w},height=${h}`);
      } catch (_) { win = null; }
      const blocked = () => toast('Il browser ha bloccato la nuova finestra. Consenti le finestre popup per questo sito (icona nella barra degli indirizzi) e riprova.', 6500);
      if (!win) { blocked(); return; }
      z._hello = false;
      z.setPopup(win);
      // alcuni browser restituiscono una finestra già chiusa invece di null
      setTimeout(() => { let c = false; try { c = win.closed; } catch (_) { } if (c && !z._hello) blocked(); }, 1500);
    },
  };

  // chiamate dalla finestra separata (stessa origine)
  window.TdtScreenZoom = {
    _hello(sid, win) {
      const z = Main.find(sid);
      if (!z || !z.video.srcObject) return null;
      z._hello = true;
      if (z.popupWin !== win) z.setPopup(win);
      return { stream: z.video.srcObject, name: z.name() };
    },
    _bye(sid, win) { const z = Main.find(sid); if (z && z.popupWin === win) z.clearPopup(); },
    _list: () => [...Main.list.values()],
  };

  function bootMain() {
    const grid = document.getElementById('videoGrid');
    if (!grid) return;
    // una sola scansione ogni tanto anche se la griglia cambia spesso (nomi, indicatori)
    let scanT = 0;
    new MutationObserver(() => { if (!scanT) scanT = setTimeout(() => { scanT = 0; Main.scan(); }, 120); }).observe(grid, { childList: true, subtree: true });
    Main.scan();
    // si esce o si ricarica la riunione: le finestre separate si chiudono
    window.addEventListener('pagehide', () => {
      Main.list.forEach(z => { try { if (z.popupWin && !z.popupWin.closed) z.popupWin.close(); } catch (_) { } });
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // Finestra separata (screen.html)
  // ═════════════════════════════════════════════════════════════════════════
  function bootPopup() {
    const host = document.getElementById('szHost');
    const video = host.querySelector('video');
    const cv = host.querySelector('.sz-pop-ann');
    const msg = document.getElementById('szMsg');
    const chip = document.getElementById('szChip');
    const sid = new URLSearchParams(location.search).get('sid') || '';
    const baseTitle = document.title.replace(/^[^·]*·\s*/, '');
    const z = new Zoomer(host, video, { sid });
    hovered = z; // qui la tastiera vale sempre
    let cur = null, state = '', closeT = 0;
    const api = () => { try { const o = window.opener; return o && !o.closed && o.TdtScreenZoom ? o.TdtScreenZoom : null; } catch (_) { return null; } };
    const TEXT = {
      wait: ['Collegamento allo schermo condiviso…', ''],
      ended: ['La presentazione è finita', 'Questa finestra si chiude da sola tra pochi secondi.'],
      lost: ['Questa finestra non è più collegata alla riunione', 'Riapri lo schermo dalla riunione con «Apri in una nuova finestra».'],
    };
    function show(st) {
      state = st;
      const live = st === 'live';
      host.classList.toggle('sz-off', !live);
      msg.classList.toggle('hidden', live);
      if (!live) {
        msg.querySelector('b').textContent = TEXT[st][0];
        msg.querySelector('span').textContent = TEXT[st][1];
        msg.querySelector('button').classList.toggle('hidden', st === 'wait');
      }
      if (st === 'ended' && !closeT) closeT = setTimeout(() => window.close(), 6000);
    }
    function setStream(s) {
      cur = s;
      // lo stesso MediaStream della riunione; se il browser non lo accetta da
      // un'altra finestra, un MediaStream nuovo con le STESSE tracce (nessun consumer in più)
      try { video.srcObject = s; } catch (_) { try { video.srcObject = new MediaStream(s.getVideoTracks()); } catch (__) { } }
      video.play?.().catch(() => { });
      clearTimeout(closeT); closeT = 0;
      show('live');
    }
    function connect() {
      const a = api();
      if (!a) { show('lost'); return; }
      const info = a._hello(sid, window);
      if (!info || !info.stream) { show('ended'); return; }
      const label = info.name ? `Schermo di ${info.name}` : 'Schermo condiviso';
      chip.querySelector('span:last-child').textContent = label;
      document.title = `${label} · ${baseTitle}`;
      setStream(info.stream);
    }
    window.TdtScreenZoomPopup = {
      stream: () => cur,
      setStream,
      ended() { cur = null; try { video.srcObject = null; } catch (_) { } show('ended'); },
    };
    msg.querySelector('button').addEventListener('click', () => window.close());
    window.addEventListener('pagehide', () => { try { api()?._bye(sid, window); } catch (_) { } });
    // il tema cambiato nella riunione vale anche qui
    window.addEventListener('storage', (e) => { if (e.key === 'tdt_theme' && e.newValue) window.TdtTheme?.apply(e.newValue, false); });
    setInterval(() => {
      let gone = true;
      try { gone = !window.opener || window.opener.closed; } catch (_) { }
      if (gone) { show('lost'); window.close(); return; }
      if (state === 'live') {
        const t = cur && cur.getVideoTracks ? cur.getVideoTracks()[0] : null;
        if (!t || t.readyState === 'ended') { cur = null; show('ended'); }
      } else if (state === 'lost' && api()) connect();
    }, 1000);

    // disegni e laser: li ridisegna la riunione (drawOn) su questo canvas
    const ctx = cv.getContext('2d');
    const drawAnn = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      if (state !== 'live') return;
      let ann = null;
      try { ann = window.opener?._annotator; } catch (_) { }
      if (!ann || !ann.hasSurface?.(sid) || ann.hiddenAll) return;
      try { ann.drawOn(ctx, sid, { x: 0, y: 0, w: cv.width, h: cv.height }); } catch (_) { }
    };
    z.onCanvas = drawAnn;
    let last = 0;
    const loop = (t) => {
      requestAnimationFrame(loop);
      if (t - last < 45) return;
      last = t;
      drawAnn();
    };
    requestAnimationFrame(loop);
    show('wait');
    connect();
  }

  const boot = POPUP ? bootPopup : bootMain;
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();
