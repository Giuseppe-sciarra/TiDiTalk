'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   Annotazioni — disegno sullo schermo condiviso
   ───────────────────────────────────────────────────────────────────────────
   • Superficie = lo schermo condiviso di un peer (sid = socket id di chi presenta).
   • Coordinate normalizzate 0..1 sul CONTENUTO reale del video (object-fit:
     contain → si escludono le bande nere): il tratto resta allineato su
     qualsiasi dimensione di schermo, anche a chi presenta.
   • Strumenti: penna, evidenziatore, freccia, riquadro, cerchio, laser.
   • Il laser non lascia tratti: mostra a tutti un alone grande con scia e
     nome → è il "mouse ingrandito" del relatore.
   • Permessi (verificati anche dal server): chi presenta + organizzatori;
     gli ospiti solo se il disegno è aperto a tutti.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const TOOLS = [
    { id: 'pen', key: 'p', label: 'Penna', icon: '<path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20z"/><path d="M13.5 6.5l3 3"/>' },
    { id: 'hl', key: 'e', label: 'Evidenziatore', icon: '<path d="M9 15l-4 4h6l1.5-1.5"/><path d="M8.5 13.5l7-7a2 2 0 0 1 3 3l-7 7z"/><path d="M13 21h7"/>' },
    { id: 'arrow', key: 'a', label: 'Freccia', icon: '<path d="M5 19L19 5"/><path d="M10 5h9v9"/>' },
    { id: 'rect', key: 'r', label: 'Riquadro', icon: '<rect x="4" y="6" width="16" height="12" rx="1.5"/>' },
    { id: 'ellipse', key: 'o', label: 'Cerchio', icon: '<ellipse cx="12" cy="12" rx="8.5" ry="6.5"/>' },
    { id: 'laser', key: 'l', label: 'Puntatore laser: tutti vedono dove indichi', icon: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7.5" opacity=".45"/>' },
  ];
  const COLORS = ['#f0a44b', '#e5534b', '#4c8dff', '#3fb27f', '#ffffff', '#16140f'];
  const WIDTHS = [{ v: 3, label: 'Sottile' }, { v: 6, label: 'Medio' }, { v: 12, label: 'Spesso' }];

  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 10);
  const icon = (paths, size = 18) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

  class Annotator {
    constructor(socket) {
      this.socket = socket;
      this.selfId = null;
      this.isHost = false;
      this.surfaces = new Map();
      this.open = new Map();          // sid → disegno aperto a tutti
      this.pending = {};              // snapshot arrivato prima dell'attach
      this.tool = localStorage.getItem('tdt_ann_tool') || 'pen';
      this.color = localStorage.getItem('tdt_ann_color') || COLORS[0];
      this.width = parseInt(localStorage.getItem('tdt_ann_w') || '6', 10);
      this.drawSid = null;            // superficie su cui si sta disegnando (modalità attiva)
      this._bindSocket();
      this._bindKeys();
      this._buildToolbar();
      window.addEventListener('resize', () => this._resizeAll());
    }

    setSelf(selfId, isHost) { this.selfId = selfId; this.isHost = !!isHost; this._refreshUi(); }

    loadSnapshot(annotations, annOpen) {
      this.pending = annotations || {};
      for (const [sid, open] of Object.entries(annOpen || {})) this.open.set(sid, !!open);
      for (const [sid, list] of Object.entries(this.pending)) {
        const s = this.surfaces.get(sid);
        if (s) { s.strokes = list.slice(); this._render(s); delete this.pending[sid]; }
      }
      this._refreshUi();
    }

    // ── Permessi (specchio di quelli server) ───────────────────────────────
    canDraw(sid) {
      if (!sid || !this.surfaces.has(sid)) return false;
      if (sid === this.selfId || this.isHost) return true;
      return this.open.get(sid) === true;
    }
    canManage(sid) { return sid === this.selfId || this.isHost; }

    // ── Superfici ──────────────────────────────────────────────────────────
    attach(sid, host, video, opts = {}) {
      if (!sid || !host) return;
      this.detach(sid, true);
      const layer = document.createElement('div');
      layer.className = 'ann-layer';
      const svg = el('svg', { class: 'ann-svg' });
      const gStrokes = el('g', {}, svg);
      const gLive = el('g', {}, svg);
      const gPtr = el('g', {}, svg);
      layer.appendChild(svg);
      const cap = document.createElement('div');
      cap.className = 'ann-capture';
      layer.appendChild(cap);
      host.appendChild(layer);
      host.classList.add('ann-host');

      const s = {
        sid, host, video, layer, svg, gStrokes, gLive, gPtr, cap,
        strokes: (this.pending[sid] || []).slice(), live: new Map(), pointers: new Map(),
        rect: { x: 0, y: 0, w: 1, h: 1 }, ownerName: opts.ownerName || '',
      };
      delete this.pending[sid];
      this.surfaces.set(sid, s);

      {
        const chip = document.createElement('div');
        chip.className = 'presenter-chip';
        chip.innerHTML = `<span class="presenter-dot"></span><span>${sid === this.selfId ? 'Stai presentando' : esc(s.ownerName || 'Qualcuno') + ' presenta'}</span>`;
        host.appendChild(chip);
        s.chip = chip;
        const tools = document.createElement('div');
        tools.className = 'stage-tools';
        tools.innerHTML = `
          <button type="button" class="stage-btn" data-act="draw" data-tip="Disegna su questo schermo">${icon('<path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20z"/>', 16)}<span>Disegna</span></button>
          <button type="button" class="stage-btn" data-act="focus" data-tip="Ingrandisci a tutta pagina (Esc per uscire)">${icon('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', 16)}</button>`;
        tools.addEventListener('click', (e) => {
          const b = e.target.closest('[data-act]'); if (!b) return;
          e.stopPropagation();
          if (b.dataset.act === 'draw') this.toggleDraw(sid);
          if (b.dataset.act === 'focus') this.toggleFocus(host);
        });
        host.appendChild(tools);
        s.stageTools = tools;
        host.addEventListener('dblclick', s._dbl = (e) => { if (!this.drawSid) this.toggleFocus(host); });
      }

      this._bindDrawing(s);
      if (video) {
        s._onVid = () => this._resize(s);
        video.addEventListener('resize', s._onVid);
        video.addEventListener('loadedmetadata', s._onVid);
      }
      s.ro = new ResizeObserver(() => this._resize(s));
      s.ro.observe(host);
      this._resize(s);
      this._refreshUi();
    }

    detach(sid, silent) {
      const s = this.surfaces.get(sid);
      if (!s) return;
      if (this.drawSid === sid) this.setDraw(null);
      try { s.ro.disconnect(); } catch { }
      if (s.video && s._onVid) { s.video.removeEventListener('resize', s._onVid); s.video.removeEventListener('loadedmetadata', s._onVid); }
      if (s._dbl) s.host.removeEventListener('dblclick', s._dbl);
      s.layer.remove(); s.chip?.remove(); s.stageTools?.remove();
      s.host.classList.remove('ann-host', 'is-annotating');
      if (document.body.classList.contains('stage-focus') && s.host.classList.contains('focused')) this.toggleFocus(s.host);
      this.surfaces.delete(sid);
      if (!silent) this.open.delete(sid);
      this._refreshUi();
    }

    // Rettangolo del contenuto video reale dentro il tile (object-fit: contain)
    _contentRect(s) {
      const W = s.host.clientWidth, H = s.host.clientHeight;
      const vw = s.video?.videoWidth || 16, vh = s.video?.videoHeight || 9;
      const k = Math.min(W / vw, H / vh);
      const w = vw * k, h = vh * k;
      return { x: (W - w) / 2, y: (H - h) / 2, w: Math.max(1, w), h: Math.max(1, h) };
    }

    _resize(s) {
      const r = this._contentRect(s);
      const same = Math.abs(r.w - s.rect.w) < 0.5 && Math.abs(r.h - s.rect.h) < 0.5 && Math.abs(r.x - s.rect.x) < 0.5 && Math.abs(r.y - s.rect.y) < 0.5;
      s.rect = r;
      Object.assign(s.layer.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
      s.svg.setAttribute('viewBox', `0 0 ${r.w} ${r.h}`);
      if (!same) this._render(s);
      if (this.drawSid === s.sid) this._placeToolbar();
    }
    _resizeAll() { this.surfaces.forEach(s => this._resize(s)); }

    // ── Rendering ──────────────────────────────────────────────────────────
    _px(s, p) { return [p[0] * s.rect.w, p[1] * s.rect.h]; }
    _wpx(s, w) { return Math.max(1, w * s.rect.w / 1000); }

    _shape(s, st, parent) {
      const P = st.pts.map(p => this._px(s, p));
      const w = this._wpx(s, st.w);
      const common = { fill: 'none', stroke: st.color, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
      if (st.tool === 'pen' || st.tool === 'hl') {
        let d;
        if (P.length === 1) d = `M${P[0][0]} ${P[0][1]} l0.01 0`;
        else {
          d = `M${P[0][0]} ${P[0][1]}`;
          for (let i = 1; i < P.length - 1; i++) {
            const mx = (P[i][0] + P[i + 1][0]) / 2, my = (P[i][1] + P[i + 1][1]) / 2;
            d += ` Q${P[i][0]} ${P[i][1]} ${mx} ${my}`;
          }
          const L = P[P.length - 1]; d += ` L${L[0]} ${L[1]}`;
        }
        const a = { ...common, d };
        if (st.tool === 'hl') { a['stroke-width'] = w * 3.2; a['stroke-opacity'] = 0.38; a['stroke-linecap'] = 'butt'; }
        return el('path', a, parent);
      }
      const [a, b] = [P[0], P[P.length - 1]];
      if (st.tool === 'rect') {
        return el('rect', { ...common, x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), width: Math.abs(b[0] - a[0]), height: Math.abs(b[1] - a[1]), rx: w }, parent);
      }
      if (st.tool === 'ellipse') {
        return el('ellipse', { ...common, cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2, rx: Math.abs(b[0] - a[0]) / 2, ry: Math.abs(b[1] - a[1]) / 2 }, parent);
      }
      if (st.tool === 'arrow') {
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const head = Math.min(len * 0.45, Math.max(12, w * 4));
        const h1 = [b[0] - head * Math.cos(ang - 0.45), b[1] - head * Math.sin(ang - 0.45)];
        const h2 = [b[0] - head * Math.cos(ang + 0.45), b[1] - head * Math.sin(ang + 0.45)];
        return el('path', { ...common, d: `M${a[0]} ${a[1]} L${b[0]} ${b[1]} M${h1[0]} ${h1[1]} L${b[0]} ${b[1]} L${h2[0]} ${h2[1]}` }, parent);
      }
      return null;
    }

    _render(s) {
      s.gStrokes.textContent = '';
      for (const st of s.strokes) this._shape(s, st, s.gStrokes);
      this._renderLive(s);
    }
    _renderLive(s) {
      s.gLive.textContent = '';
      for (const st of s.live.values()) this._shape(s, st, s.gLive);
    }

    // ── Input disegno ──────────────────────────────────────────────────────
    _bindDrawing(s) {
      const cap = s.cap;
      let cur = null, lastSend = 0, sentIdx = 0, lastPtr = 0;
      const norm = (e) => {
        const b = cap.getBoundingClientRect();
        return [Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)), Math.max(0, Math.min(1, (e.clientY - b.top) / b.height))];
      };
      const shapeTool = (t) => t === 'arrow' || t === 'rect' || t === 'ellipse';
      const sendLive = (force) => {
        if (!cur) return;
        const now = performance.now();
        if (!force && now - lastSend < 45) return;
        lastSend = now;
        if (shapeTool(cur.tool)) {
          this._emit('annDraw', { sid: s.sid, id: cur.id, tool: cur.tool, color: cur.color, w: cur.w, pts: [cur.pts[0], cur.pts[cur.pts.length - 1]], live: true });
        } else {
          const from = Math.max(0, sentIdx - 1);
          const chunk = cur.pts.slice(from);
          if (chunk.length < 2 && sentIdx > 0) return;
          this._emit('annDraw', { sid: s.sid, id: cur.id, tool: cur.tool, color: cur.color, w: cur.w, pts: chunk, live: true, append: sentIdx > 0 });
          sentIdx = cur.pts.length;
        }
      };

      cap.addEventListener('pointerdown', (e) => {
        if (this.drawSid !== s.sid || (e.pointerType === 'mouse' && e.button !== 0)) return;
        e.preventDefault(); e.stopPropagation();
        cap.setPointerCapture(e.pointerId);
        const p = norm(e);
        if (this.tool === 'laser') { cur = { laser: true }; this._laser(s, p); return; }
        cur = { id: uid(), tool: this.tool, color: this.color, w: this.width, pts: [p] };
        sentIdx = 0; lastSend = 0;
        s.live.set('me', cur);
        this._renderLive(s);
      });
      cap.addEventListener('pointermove', (e) => {
        if (this.drawSid !== s.sid) return;
        const p = norm(e);
        if (this.tool === 'laser') {
          // il laser segue il mouse anche senza click: è un puntatore
          const now = performance.now();
          if (now - lastPtr > 33) { lastPtr = now; this._laser(s, p); }
          return;
        }
        if (!cur || cur.laser) return;
        e.preventDefault();
        const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        for (const ev of events) {
          const q = norm(ev);
          const last = cur.pts[cur.pts.length - 1];
          if (shapeTool(cur.tool)) { cur.pts[1] = q; continue; }
          if (Math.hypot(q[0] - last[0], q[1] - last[1]) > 0.0015) cur.pts.push(q);
        }
        this._renderLive(s);
        sendLive(false);
      });
      const end = (e) => {
        if (!cur) return;
        if (cur.laser) { cur = null; return; }
        const st = cur; cur = null;
        s.live.delete('me');
        if (shapeTool(st.tool) && st.pts.length < 2) st.pts.push(st.pts[0]);
        s.strokes.push({ ...st, peerId: this.selfId });
        this._render(s);
        // finale: in blocchi da 1000 punti (il server accetta max 1200 per messaggio)
        for (let i = 0; i < st.pts.length; i += 1000) {
          this._emit('annDraw', { sid: s.sid, id: st.id, tool: st.tool, color: st.color, w: st.w, pts: st.pts.slice(Math.max(0, i - (i ? 1 : 0)), i + 1000), append: i > 0 });
        }
      };
      cap.addEventListener('pointerup', end);
      cap.addEventListener('pointercancel', end);
      cap.addEventListener('pointerleave', (e) => {
        if (this.tool === 'laser' && this.drawSid === s.sid) this._emit('annPointer', { sid: s.sid, hide: true });
        if (cur && !cap.hasPointerCapture?.(e.pointerId)) end(e);
      });
      cap.addEventListener('click', (e) => e.stopPropagation());
      cap.addEventListener('dblclick', (e) => e.stopPropagation());
    }

    _laser(s, p) {
      this._emit('annPointer', { sid: s.sid, x: p[0], y: p[1], color: this.color });
      this._showPointer(s, { peerId: 'me', name: 'Tu', x: p[0], y: p[1], color: this.color });
    }

    _showPointer(s, d) {
      let ptr = s.pointers.get(d.peerId);
      if (d.hide) { if (ptr) { ptr.g.remove(); s.pointers.delete(d.peerId); } return; }
      if (!ptr) {
        const g = el('g', { class: 'ann-ptr' }, s.gPtr);
        const trail = el('polyline', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'ann-ptr-trail' }, g);
        const ring = el('circle', { r: 22, class: 'ann-ptr-ring' }, g);
        const dot = el('circle', { r: 9, class: 'ann-ptr-dot' }, g);
        const label = el('text', { class: 'ann-ptr-label', 'text-anchor': 'start' }, g);
        ptr = { g, trail, ring, dot, label, pts: [], timer: null };
        s.pointers.set(d.peerId, ptr);
      }
      const [x, y] = this._px(s, [d.x, d.y]);
      ptr.pts.push([x, y]); if (ptr.pts.length > 14) ptr.pts.shift();
      ptr.g.style.setProperty('--c', d.color || '#f0a44b');
      ptr.trail.setAttribute('points', ptr.pts.map(p => p.join(',')).join(' '));
      ptr.trail.setAttribute('stroke', d.color || '#f0a44b');
      for (const c of [ptr.ring, ptr.dot]) { c.setAttribute('cx', x); c.setAttribute('cy', y); }
      ptr.ring.setAttribute('stroke', d.color || '#f0a44b');
      ptr.dot.setAttribute('fill', d.color || '#f0a44b');
      ptr.label.setAttribute('x', x + 26); ptr.label.setAttribute('y', y - 18);
      ptr.label.textContent = d.peerId === 'me' ? '' : d.name;
      clearTimeout(ptr.timer);
      ptr.timer = setTimeout(() => { ptr.g.remove(); s.pointers.delete(d.peerId); }, 1600);
      if (d.peerId !== 'me') this._flagActivity(s, d.name);
    }

    _flagActivity(s, name) {
      s.host.classList.add('is-annotating');
      if (s.chip && name) s.chip.querySelector('span:last-child').textContent = `${name} sta indicando`;
      clearTimeout(s._actT);
      s._actT = setTimeout(() => {
        s.host.classList.remove('is-annotating');
        if (s.chip) s.chip.querySelector('span:last-child').textContent = s.sid === this.selfId ? 'Stai presentando' : `${s.ownerName || 'Qualcuno'} presenta`;
      }, 2200);
    }

    // ── Socket ─────────────────────────────────────────────────────────────
    _emit(ev, data) { try { this.socket?.emit(ev, data); } catch { } }

    _bindSocket() {
      const S = this.socket;
      S.on('annDraw', (st) => {
        const s = this.surfaces.get(st.sid);
        if (!s) {
          if (!st.live) (this.pending[st.sid] = this.pending[st.sid] || []).push(st);
          return;
        }
        const key = st.peerId + ':' + st.id;
        if (st.live) {
          const prev = s.live.get(key);
          if (prev && st.append && (st.tool === 'pen' || st.tool === 'hl')) prev.pts.push(...st.pts.slice(1));
          else s.live.set(key, { ...st, pts: st.pts.slice() });
          this._renderLive(s);
        } else {
          s.live.delete(key);
          const prev = st.append ? s.strokes.find(x => x.id === st.id && x.peerId === st.peerId) : null;
          if (prev) prev.pts.push(...st.pts.slice(1));
          else s.strokes.push(st);
          this._render(s);
        }
        this._flagActivity(s, st.name);
      });
      S.on('annPointer', (d) => { const s = this.surfaces.get(d.sid); if (s) this._showPointer(s, d); });
      S.on('annSync', ({ sid, strokes, by }) => {
        const s = this.surfaces.get(sid);
        if (s) { s.strokes = strokes || []; s.live.clear(); this._render(s); }
        else this.pending[sid] = strokes || [];
        if (by && !(strokes || []).length && typeof window.showToast === 'function') window.showToast(`${by} ha cancellato i disegni`, 2200);
      });
      S.on('annOpen', ({ sid, open, by }) => {
        this.open.set(sid, !!open);
        if (by && sid !== this.selfId && typeof window.showToast === 'function') {
          window.showToast(open ? `Ora tutti possono disegnare sullo schermo` : `Il disegno è tornato riservato a chi presenta`, 2600);
        }
        if (!this.canDraw(this.drawSid)) this.setDraw(null);
        this._refreshUi();
      });
    }

    // ── Modalità disegno + toolbar ─────────────────────────────────────────
    activeSid() {
      // priorità: lo schermo in primo piano (spotlight), altrimenti il primo disponibile
      const main = document.querySelector('.video-tile.spotlight-main.ann-host');
      for (const [sid, s] of this.surfaces) if (s.host === main) return sid;
      for (const sid of this.surfaces.keys()) return sid;
      return null;
    }

    toggleDraw(sid) {
      sid = sid || this.activeSid();
      if (this.drawSid && (!sid || this.drawSid === sid)) return this.setDraw(null);
      if (!sid) { window.showToast?.('Nessuno sta presentando: premi "Presenta" per condividere il tuo schermo.', 3500); return; }
      if (!this.canDraw(sid)) { window.showToast?.('Chi presenta non ha aperto il disegno a tutti', 3000); return; }
      this.setDraw(sid);
    }

    setDraw(sid) {
      const prev = this.surfaces.get(this.drawSid);
      if (prev) { prev.host.classList.remove('ann-drawing'); if (this.tool === 'laser') this._emit('annPointer', { sid: prev.sid, hide: true }); }
      this.drawSid = sid && this.surfaces.has(sid) ? sid : null;
      const s = this.surfaces.get(this.drawSid);
      if (s) s.host.classList.add('ann-drawing');
      this._refreshUi();
    }

    _buildToolbar() {
      const tb = document.createElement('div');
      tb.className = 'ann-toolbar hidden';
      tb.id = 'annToolbar';
      tb.innerHTML = `
        <div class="ann-group">${TOOLS.map(t => `<button type="button" class="ann-btn" data-tool="${t.id}" data-tip="${esc(t.label)}" data-tip-key="${t.key.toUpperCase()}">${icon(t.icon)}</button>`).join('')}</div>
        <div class="ann-sep"></div>
        <div class="ann-group ann-colors">${COLORS.map(c => `<button type="button" class="ann-color" data-color="${c}" style="--c:${c}" data-tip="Colore"></button>`).join('')}</div>
        <div class="ann-sep"></div>
        <div class="ann-group">${WIDTHS.map(w => `<button type="button" class="ann-btn ann-w" data-w="${w.v}" data-tip="${w.label}"><i style="--s:${Math.round(w.v / 1.6) + 2}px"></i></button>`).join('')}</div>
        <div class="ann-sep"></div>
        <div class="ann-group">
          <button type="button" class="ann-btn" data-act="undo" data-tip="Annulla il tuo ultimo tratto" data-tip-key="Ctrl+Z">${icon('<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>')}</button>
          <button type="button" class="ann-btn" data-act="clear" data-tip="Cancella tutti i disegni">${icon('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>')}</button>
          <button type="button" class="ann-btn ann-open" data-act="open" data-tip="Permetti a tutti di disegnare">${icon('<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 19c.8-3 3.2-4.5 6-4.5s5.2 1.5 6 4.5M15 14.6c2.6-.3 4.8 1 5.6 3.9"/>')}</button>
          <button type="button" class="ann-btn ann-close" data-act="close" data-tip="Smetti di disegnare" data-tip-key="Esc">${icon('<path d="M6 6l12 12M18 6L6 18"/>')}</button>
        </div>`;
      tb.addEventListener('pointerdown', (e) => e.stopPropagation());
      tb.addEventListener('click', (e) => {
        e.stopPropagation();
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.tool) this.setTool(b.dataset.tool);
        else if (b.dataset.color) { this.color = b.dataset.color; localStorage.setItem('tdt_ann_color', this.color); }
        else if (b.dataset.w) { this.width = +b.dataset.w; localStorage.setItem('tdt_ann_w', String(this.width)); }
        else if (b.dataset.act === 'undo') this.undo();
        else if (b.dataset.act === 'clear') this.clear();
        else if (b.dataset.act === 'open') this.toggleOpen();
        else if (b.dataset.act === 'close') this.setDraw(null);
        this._refreshUi();
      });
      document.body.appendChild(tb);
      this.toolbar = tb;
    }

    setTool(t) {
      if (!TOOLS.some(x => x.id === t)) return;
      const s = this.surfaces.get(this.drawSid);
      if (this.tool === 'laser' && t !== 'laser' && s) this._emit('annPointer', { sid: s.sid, hide: true });
      this.tool = t; localStorage.setItem('tdt_ann_tool', t);
      this._refreshUi();
    }
    undo() { if (this.drawSid) this._emit('annUndo', { sid: this.drawSid }); }
    clear() {
      const sid = this.drawSid; if (!sid) return;
      if (!this.canManage(sid)) { window.showToast?.('Solo chi presenta o un organizzatore può cancellare tutto. Usa Annulla per i tuoi tratti.', 3200); return; }
      if (!confirm('Cancellare tutti i disegni per tutti?')) return;
      this._emit('annClear', { sid });
    }
    toggleOpen() {
      const sid = this.drawSid; if (!sid || !this.canManage(sid)) return;
      const open = !this.open.get(sid);
      this.open.set(sid, open);
      this._emit('annSetOpen', { sid, open });
      window.showToast?.(open ? 'Ora tutti possono disegnare sul tuo schermo' : 'Disegno riservato a te e agli organizzatori', 2400);
    }

    toggleFocus(host) {
      const on = !document.body.classList.contains('stage-focus') || !host.classList.contains('focused');
      document.querySelectorAll('.video-tile.focused').forEach(t => t.classList.remove('focused'));
      document.body.classList.toggle('stage-focus', on);
      if (on) host.classList.add('focused');
      setTimeout(() => this._resizeAll(), 60);
    }

    _placeToolbar() {
      const s = this.surfaces.get(this.drawSid);
      const tb = this.toolbar;
      if (!s) return;
      if (tb.parentElement !== document.body) document.body.appendChild(tb);
      const r = s.host.getBoundingClientRect();
      const tr = tb.getBoundingClientRect();
      const top = Math.max(r.top + 12, Math.min(r.top + r.height / 2 - tr.height / 2, window.innerHeight - tr.height - 90));
      tb.style.top = Math.max(8, top) + 'px';
      tb.style.left = Math.max(8, Math.min(r.left + 12, window.innerWidth - tr.width - 8)) + 'px';
    }

    _refreshUi() {
      const tb = this.toolbar; if (!tb) return;
      const sid = this.drawSid;
      tb.classList.toggle('hidden', !sid);
      tb.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === this.tool));
      tb.querySelectorAll('[data-color]').forEach(b => b.classList.toggle('on', b.dataset.color === this.color));
      tb.querySelectorAll('[data-w]').forEach(b => b.classList.toggle('on', +b.dataset.w === this.width));
      const openBtn = tb.querySelector('[data-act="open"]');
      const manage = sid && this.canManage(sid);
      openBtn.classList.toggle('hidden', !manage);
      openBtn.classList.toggle('on', !!(sid && this.open.get(sid)));
      openBtn.dataset.tip = sid && this.open.get(sid) ? 'Tutti possono disegnare: premi per riservarlo a chi presenta' : 'Permetti a tutti di disegnare';
      tb.querySelector('[data-act="clear"]').classList.toggle('hidden', !(sid && this.canManage(sid)));
      document.body.classList.toggle('ann-mode', !!sid);
      if (sid) requestAnimationFrame(() => this._placeToolbar());

      // pulsante "Disegna" nella barra: visibile quando c'è uno schermo condiviso
      const screens = [...this.surfaces.keys()];
      const btn = document.getElementById('btnAnnotate');
      if (btn) {
        btn.classList.toggle('hidden', screens.length === 0);
        btn.classList.toggle('active', !!sid);
        const target = this.activeSid();
        const allowed = target && this.canDraw(target);
        btn.classList.toggle('locked', !!target && !allowed);
        btn.dataset.tip = !target ? 'Disegna: serve uno schermo condiviso'
          : allowed ? (sid ? 'Smetti di disegnare' : 'Disegna ed evidenzia sullo schermo condiviso')
            : 'Chi presenta non ha aperto il disegno a tutti';
      }
      this.surfaces.forEach((s) => {
        const b = s.stageTools?.querySelector('[data-act="draw"]');
        if (b) { b.classList.toggle('hidden', !this.canDraw(s.sid)); b.classList.toggle('on', this.drawSid === s.sid); }
      });
    }

    _bindKeys() {
      window.addEventListener('keydown', (e) => {
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        if (e.key === 'Escape' && document.body.classList.contains('stage-focus') && !this.drawSid) {
          document.querySelectorAll('.video-tile.focused').forEach(x => x.classList.remove('focused'));
          document.body.classList.remove('stage-focus'); setTimeout(() => this._resizeAll(), 60); return;
        }
        if (!this.drawSid) return;
        const k = e.key.toLowerCase();
        if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.stopPropagation(); this.undo(); return; }
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (k === 'escape') { e.stopPropagation(); this.setDraw(null); return; }
        const tool = TOOLS.find(x => x.key === k);
        if (tool) { e.preventDefault(); e.stopPropagation(); this.setTool(tool.id); }
      }, true);
    }

    /* ── Disegno su canvas 2D: serve alla registrazione ──────────────────
       rect = area (in pixel del canvas) dove è disegnato il contenuto del
       video condiviso. Le coordinate degli stroke sono 0..1 su quell'area. */
    hasSurface(sid) { return this.surfaces.has(sid); }

    drawOn(ctx, sid, rect) {
      const s = this.surfaces.get(sid);
      if (!s || !rect || rect.w <= 0) return;
      const P = (p) => [rect.x + p[0] * rect.w, rect.y + p[1] * rect.h];
      const all = [...s.strokes, ...s.live.values()];
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const st of all) {
        if (!Array.isArray(st.pts) || !st.pts.length) continue;
        const pts = st.pts.map(P);
        const w = Math.max(1, st.w * rect.w / 1000);
        ctx.globalAlpha = st.tool === 'hl' ? 0.38 : 1;
        ctx.strokeStyle = st.color;
        ctx.lineWidth = st.tool === 'hl' ? w * 3.2 : w;
        ctx.beginPath();
        if (st.tool === 'pen' || st.tool === 'hl') {
          ctx.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i < pts.length - 1; i++) {
            ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
          }
          const L = pts[pts.length - 1];
          ctx.lineTo(L[0], L[1]);
        } else {
          const a = pts[0], b = pts[pts.length - 1];
          if (st.tool === 'rect') ctx.rect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
          else if (st.tool === 'ellipse') ctx.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) / 2, Math.abs(b[1] - a[1]) / 2, 0, 0, Math.PI * 2);
          else if (st.tool === 'arrow') {
            const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
            const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
            const head = Math.min(len * 0.45, Math.max(12, w * 4));
            ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
            ctx.moveTo(b[0] - head * Math.cos(ang - 0.45), b[1] - head * Math.sin(ang - 0.45));
            ctx.lineTo(b[0], b[1]);
            ctx.lineTo(b[0] - head * Math.cos(ang + 0.45), b[1] - head * Math.sin(ang + 0.45));
          }
        }
        ctx.stroke();
      }
      // puntatori laser attivi (alone + nome), così nel video si vede dove si indicava
      ctx.globalAlpha = 1;
      for (const [peerId, ptr] of s.pointers) {
        const last = ptr.pts[ptr.pts.length - 1];
        if (!last) continue;
        const x = rect.x + (last[0] / Math.max(1, s.rect.w)) * rect.w;
        const y = rect.y + (last[1] / Math.max(1, s.rect.h)) * rect.h;
        const col = ptr.g.style.getPropertyValue('--c') || '#f0a44b';
        const r = Math.max(8, rect.w * 0.012);
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.28;
        ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        const name = ptr.label.textContent;
        if (name) {
          ctx.font = `600 ${Math.max(12, rect.w * 0.016)}px system-ui, sans-serif`;
          ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.6)';
          ctx.strokeText(name, x + r * 2.8, y - r);
          ctx.fillStyle = '#fff';
          ctx.fillText(name, x + r * 2.8, y - r);
        }
      }
      ctx.restore();
    }

  }

  window.Annotator = Annotator;
})();
