'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   TIDITALK 1.8.0 — «Vista»: come vedi le persone (solo per te)
   ───────────────────────────────────────────────────────────────────────────
   Il tasto Vista apre un pannello con:
     • Automatico / Griglia / In evidenza / Barra laterale
     • numero massimo di riquadri (2–25; sul telefono 2–8): oltre compare «+N»
       che apre la lista Persone
     • «Nascondi chi ha la videocamera spenta» con l'avviso di chi è nascosto
     • il tuo riquadro: nella griglia, in finestrella trascinabile o nascosto
   Tutto resta in questo browser (localStorage), niente arriva al server.

   Come si aggancia a room.js (che resta il padrone del layout):
     • updateGridLayout() chiama TdtLayout.before(grid) PRIMA di applySpotlight
       e TdtLayout.after(grid) alla fine.
     • before() marca con .lv-out i riquadri da togliere dal layout (nascosti,
       oltre il massimo, la tua finestrella) e decide _spotlightOverride /
       _spotlightPeer in base alla vista scelta; applySpotlight e
       fitGridToViewport ignorano i riquadri .lv-out.
     • «+N» è un .video-tile (.lv-more) senza data-peer-id: il layout lo tratta
       come un riquadro qualsiasi, mai come riquadro grande.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  const KEY = 'tdt_layout_v1';
  const MODES = ['auto', 'grid', 'spotlight', 'sidebar'];
  const SELF = ['grid', 'float', 'hidden'];
  const DESK_MAX = 25, PHONE_MAX = 8;
  const DEF = { mode: 'auto', maxDesk: 16, maxPhone: 6, hide: false, self: 'grid', corner: 'br' };

  const isPhone = () => window.matchMedia('(max-width: 640px)').matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ── stato salvato ─────────────────────────────────────────────────────────
  let S = Object.assign({}, DEF);
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object') {
      if (MODES.includes(raw.mode)) S.mode = raw.mode;
      if (SELF.includes(raw.self)) S.self = raw.self;
      if (['tl', 'tr', 'bl', 'br'].includes(raw.corner)) S.corner = raw.corner;
      if (Number.isFinite(raw.maxDesk)) S.maxDesk = clamp(Math.round(raw.maxDesk), 2, DESK_MAX);
      if (Number.isFinite(raw.maxPhone)) S.maxPhone = clamp(Math.round(raw.maxPhone), 2, PHONE_MAX);
      S.hide = raw.hide === true;
    }
  } catch (_) { /* privata o bloccata: valori predefiniti */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) { } }

  // valori effettivi su questo schermo (sul telefono niente barra laterale)
  function eff() {
    const phone = isPhone();
    return {
      phone,
      mode: phone && S.mode === 'sidebar' ? 'auto' : S.mode,
      max: phone ? S.maxPhone : S.maxDesk,
      hide: S.hide,
      self: S.self,
    };
  }

  // ── accesso sicuro ai globali di room.js ─────────────────────────────────
  const G = {
    peers: () => (typeof peers !== 'undefined' ? peers : new Map()),
    tiles: () => (typeof peerTiles !== 'undefined' ? peerTiles : new Map()),
    speaking: (id) => (typeof speakingStates !== 'undefined' ? !!speakingStates.get(id) : false),
    relayout: () => { if (typeof updateGridLayout === 'function') updateGridLayout(); },
    getPeer: () => (typeof _spotlightPeer !== 'undefined' ? _spotlightPeer : null),
    setPeer: (v) => { if (typeof _spotlightPeer !== 'undefined') _spotlightPeer = v; },
    setOverride: (v) => { if (typeof _spotlightOverride !== 'undefined') _spotlightOverride = v; },
    initials: (n) => (typeof getInitials === 'function' ? getInitials(n) : '?'),
    color: (id) => (typeof getAvatarColor === 'function' ? getAvatarColor(id) : '#607d8b'),
    toast: (m, d) => { if (typeof showToast === 'function') showToast(m, d); },
  };

  // ── memoria di chi ha parlato (per «+N» e per «In evidenza») ──────────────
  const lastSpeak = new Map();
  let lvPin = null;            // riquadro fissato da te (clic sul riquadro)
  let lvAutoId = null;         // In evidenza: chi parla, messo grande da qui
  let lastHidden = [];         // nomi nascosti per videocamera spenta
  let overflowIds = new Set(); // riquadri oltre il massimo
  let phoneGrid = false;
  let relayT = null, lastRelay = 0, pend = false;

  function schedule(delay = 120) {
    clearTimeout(relayT);
    relayT = setTimeout(() => G.relayout(), delay);
  }
  // al massimo un relayout ogni `gap` ms: chi parla cambia spesso
  function throttled(gap) {
    if (pend) return;
    pend = true;
    setTimeout(() => { pend = false; G.relayout(); }, Math.max(150, gap - (Date.now() - lastRelay)));
  }

  // ── «Fissa»: clic su un riquadro = grande per te, di nuovo clic = sblocca ─
  window.togglePin = function (peerId) {
    if (!peerId) return;
    if (lvPin === peerId) { lvPin = null; G.setPeer(null); }
    else { lvPin = peerId; G.setPeer(peerId); }
    lvAutoId = null;
    G.relayout();
  };
  window.toggleLocalPin = function () { window.togglePin('local'); };

  // ── riquadro «+N» ─────────────────────────────────────────────────────────
  let moreEl = null;
  function ensureMore(grid) {
    if (moreEl && moreEl.isConnected) return moreEl;
    moreEl = document.createElement('div');
    moreEl.className = 'video-tile lv-more';
    moreEl.setAttribute('role', 'button');
    moreEl.tabIndex = 0;
    moreEl.innerHTML = '<div class="lv-more-in"><div class="lv-more-avs" aria-hidden="true"></div><b class="lv-more-n" translate="no"></b><span class="lv-more-lbl"></span></div>';
    grid.appendChild(moreEl);
    return moreEl;
  }
  function removeMore() { if (moreEl) { moreEl.remove(); moreEl = null; } }
  function fillMore(el, over) {
    const n = over.length;
    el.querySelector('.lv-more-n').textContent = '+' + n;
    el.querySelector('.lv-more-lbl').textContent = n === 1 ? 'altra persona' : 'altre persone';
    el.setAttribute('aria-label', 'Vedi tutte le persone');
    el.dataset.tip = 'Vedi tutte le persone';
    const avs = el.querySelector('.lv-more-avs');
    avs.textContent = '';
    over.slice(0, 3).forEach(t => {
      const id = t.dataset.peerId;
      const s = document.createElement('span');
      s.style.background = G.color(id);
      s.innerHTML = G.initials(nameOf(t)); // getInitials restituisce testo già sanificato
      avs.appendChild(s);
    });
  }
  function openPeople() {
    if (typeof participantList !== 'undefined' && participantList?.open) return;
    document.getElementById('btnParticipants')?.click();
  }

  function nameOf(t) {
    const id = t.dataset.peerId;
    if (id === 'local') return (typeof DISPLAY_NAME !== 'undefined' ? DISPLAY_NAME : '') || 'Tu';
    return G.peers().get(id)?.displayName || t.querySelector('.tile-name-always')?.textContent || '';
  }

  // ── prima del layout di room.js ───────────────────────────────────────────
  function before(grid) {
    lastRelay = Date.now();
    const e = eff();
    const all = [...grid.querySelectorAll('.video-tile')];
    const self = G.tiles().get('local') || null;
    const hasScreen = all.some(t => t.classList.contains('screenshare'));

    all.forEach(t => {
      if (t.classList.contains('lv-out')) {
        t.classList.remove('lv-out', 'lv-hide', 'lv-float', 'lv-over');
      }
    });

    // fissato da te: se nel frattempo è cambiato il riquadro grande (clic
    // sulla fila o presentazione partita) il «fissa» lo segue o si scioglie
    let cur = G.getPeer();
    if (lvPin && !grid.querySelector(`[data-peer-id="${CSS.escape(lvPin)}"]`)) { if (cur === lvPin) G.setPeer(null); lvPin = null; cur = G.getPeer(); }
    if (lvPin && cur && cur !== lvPin) lvPin = /-screen$/.test(cur) ? null : cur;
    if (lvPin && !cur) lvPin = null;
    // il riquadro grande messo da «In evidenza» si scioglie fuori da quella vista
    if (lvAutoId && (e.mode !== 'spotlight' || lvPin || hasScreen)) {
      if (G.getPeer() === lvAutoId) G.setPeer(null);
      lvAutoId = null;
    }
    // la tua finestrella o il tuo riquadro nascosto non possono essere il grande
    if (self && e.self !== 'grid' && G.getPeer() === 'local') { G.setPeer(null); if (lvPin === 'local') lvPin = null; }
    cur = G.getPeer();

    const people = all.filter(t => !t.classList.contains('screenshare') && !t.classList.contains('lv-more'));
    const out = (t, ...cls) => {
      t.classList.add('lv-out', ...cls);
      t.classList.remove('spotlight-main', 'spotlight-strip');
      // misure in linea lasciate dalla griglia o dalla fila (fitGridToViewport)
      if (t.dataset.fit || t.dataset.stripFit) {
        ['width', 'height', 'max-width', 'max-height', 'flex', 'aspect-ratio'].forEach(k => t.style.removeProperty(k));
        delete t.dataset.fit; delete t.dataset.stripFit;
      }
    };

    // 1) videocamera spenta (mai chi è grande/fissato, mai tu)
    const hidden = [];
    if (e.hide) {
      people.forEach(t => {
        const id = t.dataset.peerId;
        if (!id || t === self || id === cur) return;
        const p = G.peers().get(id);
        if (p && p.videoOff) { out(t, 'lv-hide'); hidden.push(p.displayName || nameOf(t)); }
      });
    }
    lastHidden = hidden;
    if (hidden.length) grid.dataset.lvNote = '1'; else delete grid.dataset.lvNote;

    // 2) il tuo riquadro
    let cand = people.filter(t => !t.classList.contains('lv-out'));
    const others = cand.some(t => t !== self) || hasScreen;
    if (self && others) {
      if (e.self === 'hidden') out(self, 'lv-hide');
      else if (e.self === 'float') out(self, 'lv-float');
    }
    if (self && !self.classList.contains('lv-float')) {
      self.style.removeProperty('transform'); self.style.removeProperty('transition');
    }
    if (self) self.dataset.lvCorner = S.corner;
    cand = cand.filter(t => !t.classList.contains('lv-out'));

    // 3) massimo dei riquadri (In evidenza mostra comunque un riquadro solo)
    overflowIds = new Set();
    if (e.mode !== 'spotlight' && cand.length > e.max) {
      const now = Date.now();
      const score = (t) => {
        const id = t.dataset.peerId, p = G.peers().get(id);
        let s = 0;
        if (id === cur) s += 1000;
        if (t === self) s += 60;
        if (p?.handRaised) s += 50;
        if (G.speaking(id)) s += 40;
        const ls = lastSpeak.get(id);
        if (ls) s += 30 * Math.max(0, 1 - (now - ls) / 120000);
        if (p && !p.videoOff) s += 10;
        return s;
      };
      const ranked = cand.map((t, i) => ({ t, s: score(t), i })).sort((a, b) => b.s - a.s || a.i - b.i).map(x => x.t);
      const keep = ranked.slice(0, Math.max(1, e.max - 1));
      // almeno un'altra persona resta in vista (con 2 riquadri: lei + «+N»)
      if (!keep.some(t => t !== self)) {
        const firstOther = ranked.find(t => t !== self);
        if (firstOther) keep[keep.indexOf(self)] = firstOther;
      }
      const over = cand.filter(t => !keep.includes(t));
      over.forEach(t => { out(t, 'lv-hide', 'lv-over'); overflowIds.add(t.dataset.peerId); });
      fillMore(ensureMore(grid), over);
      cand = keep;
    } else removeMore();

    // 4) vista → regole di room.js
    const pinned = !!(lvPin && G.getPeer() === lvPin);
    if (pinned) G.setOverride(true);
    else G.setOverride({ auto: null, grid: false, sidebar: true, spotlight: true }[e.mode]);
    if (e.mode === 'spotlight' && !pinned && !hasScreen) {
      // grande chi ha parlato per ultimo (fra chi è in vista), altrimenti il primo
      const remote = cand.filter(t => t !== self && t.dataset.peerId);
      const best = remote.map(t => ({ id: t.dataset.peerId, at: lastSpeak.get(t.dataset.peerId) || 0 }))
        .sort((a, b) => b.at - a.at)[0];
      const curPeer = G.getPeer();
      const curOk = curPeer && remote.some(t => t.dataset.peerId === curPeer);
      if (best && (best.at || !curOk)) { G.setPeer(best.id); lvAutoId = best.id; }
    }
    // riquadro grande diventato invisibile → room.js sceglie da solo
    const mainId = G.getPeer();
    if (mainId) {
      const mt = grid.querySelector(`[data-peer-id="${CSS.escape(mainId)}"]`);
      if (!mt || mt.classList.contains('lv-out')) { G.setPeer(null); if (lvPin === mainId) lvPin = null; }
    }
    phoneGrid = e.phone && e.mode === 'grid' && !pinned && !hasScreen;
    grid.dataset.lvMode = pinned && e.mode !== 'spotlight' ? 'pin' : e.mode;
    if (self) bindDrag(self);
  }

  // ── dopo il layout di room.js ─────────────────────────────────────────────
  function after(grid) {
    // «+N» sempre in fondo (alla fila o alla griglia)
    if (moreEl && moreEl.isConnected) {
      const col = grid.querySelector('.spotlight-col');
      (moreEl.classList.contains('spotlight-strip') && col ? col : grid).appendChild(moreEl);
      moreEl.onclick = null;
    }
    const self = G.tiles().get('local');
    if (self && self.classList.contains('lv-out')) self.onclick = null;

    // telefono, Griglia: 1 colonna fino a 3 persone, poi 2
    if (phoneGrid && grid.dataset.spotlight !== 'true') {
      const n = grid.querySelectorAll(':scope > .video-tile:not(.lv-out)').length || 1;
      const cols = n <= 3 ? 1 : 2;
      grid.dataset.lvPgrid = '1';
      grid.style.setProperty('--lv-cols', cols);
      grid.style.setProperty('--lv-rows', Math.ceil(n / cols));
    } else if (grid.dataset.lvPgrid) {
      delete grid.dataset.lvPgrid;
      grid.style.removeProperty('--lv-cols'); grid.style.removeProperty('--lv-rows');
    }

    renderNote(grid);
    floatBounds();
    document.getElementById('btnLayout')?.classList.toggle('active', isOpen());
    if (isOpen()) syncPanel();
  }

  // ── avviso: chi è nascosto perché ha la videocamera spenta ────────────────
  let noteEl = null;
  function renderNote(grid) {
    if (!lastHidden.length) {
      if (noteEl) { noteEl.remove(); noteEl = null; }
      return;
    }
    if (!noteEl || !noteEl.isConnected) {
      noteEl = document.createElement('div');
      noteEl.className = 'lv-note';
      noteEl.setAttribute('role', 'status');
      noteEl.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M15.5 12.5v3a2.5 2.5 0 0 1-2.5 2.5H5a2.5 2.5 0 0 1-2.5-2.5v-7A2.5 2.5 0 0 1 5 6h1.5M10.5 6H13a2.5 2.5 0 0 1 2.5 2.5v1l6-3.5v10"/></svg><span class="lv-note-lead">Chi ha la videocamera spenta è nascosto:</span><span class="lv-note-short">Nascosti:</span><b class="lv-note-names" translate="no"></b><span class="lv-note-more"></span><button type="button" class="lv-note-btn">Mostra</button>`;
      noteEl.querySelector('.lv-note-btn').addEventListener('click', (ev) => {
        ev.stopPropagation();
        S.hide = false; save(); G.relayout();
      });
      document.body.appendChild(noteEl);
    }
    const n = lastHidden.length;
    const shown = n <= 3 ? lastHidden : lastHidden.slice(0, 2);
    const names = noteEl.querySelector('.lv-note-names');
    names.textContent = shown.join(', ');
    names.dataset.tip = lastHidden.join(', ');
    noteEl.querySelector('.lv-note-more').textContent = n > 3 ? `e altri ${n - 2}` : '';
  }

  // ── finestrella: limiti dentro l'area dei video, trascinamento agli angoli ─
  function floatBounds() {
    const g = document.getElementById('videoGrid');
    if (!g) return;
    const r = g.getBoundingClientRect();
    const st = document.documentElement.style;
    const m = isPhone() ? 8 : 14;
    st.setProperty('--lv-ft', Math.round(r.top + m) + 'px');
    st.setProperty('--lv-fl', Math.round(r.left + m) + 'px');
    st.setProperty('--lv-fr', Math.round(window.innerWidth - r.right + m) + 'px');
    // in fondo lascia lo spazio dell'avviso, se c'è
    // con l'avviso la griglia lascia libera una fascia in fondo (vedi layout.css)
    const noteH = g.dataset.lvNote ? 44 : 0;
    st.setProperty('--lv-fb', Math.round(window.innerHeight - r.bottom + m + noteH) + 'px');
    st.setProperty('--lv-gcx', Math.round(r.left + r.width / 2) + 'px');
    st.setProperty('--lv-gb', Math.round(window.innerHeight - r.bottom + (isPhone() ? 4 : 8)) + 'px');
  }
  window.addEventListener('resize', () => requestAnimationFrame(floatBounds));
  document.addEventListener('DOMContentLoaded', () => {
    const g = document.getElementById('videoGrid');
    if (g && window.ResizeObserver) new ResizeObserver(() => requestAnimationFrame(floatBounds)).observe(g);
  });

  const dragBound = new WeakSet();
  function bindDrag(tile) {
    if (dragBound.has(tile)) return;
    dragBound.add(tile);
    let st = null;
    tile.addEventListener('pointerdown', (ev) => {
      if (!tile.classList.contains('lv-float') || ev.button !== 0 || ev.target.closest('button')) return;
      st = { x: ev.clientX, y: ev.clientY, id: ev.pointerId, moved: false, r: tile.getBoundingClientRect() };
      try { tile.setPointerCapture(ev.pointerId); } catch (_) { }
    });
    tile.addEventListener('pointermove', (ev) => {
      if (!st || ev.pointerId !== st.id) return;
      const dx = ev.clientX - st.x, dy = ev.clientY - st.y;
      if (!st.moved && Math.hypot(dx, dy) < 6) return;
      st.moved = true;
      tile.classList.add('lv-dragging');
      tile.style.transition = 'none';
      tile.style.transform = `translate(${dx}px, ${dy}px)`;
      ev.preventDefault();
    });
    const end = (ev) => {
      if (!st || ev.pointerId !== st.id) return;
      const s = st; st = null;
      try { tile.releasePointerCapture(ev.pointerId); } catch (_) { }
      if (!s.moved) return;
      const dx = ev.clientX - s.x, dy = ev.clientY - s.y;
      const cx = s.r.left + s.r.width / 2 + dx, cy = s.r.top + s.r.height / 2 + dy;
      const g = document.getElementById('videoGrid').getBoundingClientRect();
      const corner = (cy < g.top + g.height / 2 ? 't' : 'b') + (cx < g.left + g.width / 2 ? 'l' : 'r');
      // FLIP: dal punto in cui l'hai lasciata all'angolo, con un'animazione
      const from = tile.getBoundingClientRect();
      tile.style.transform = '';
      tile.dataset.lvCorner = corner;
      S.corner = corner; save();
      const to = tile.getBoundingClientRect();
      tile.style.transform = `translate(${from.left - to.left}px, ${from.top - to.top}px)`;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        tile.style.transition = 'transform .32s cubic-bezier(.2,.8,.2,1)';
        tile.style.transform = '';
        setTimeout(() => { tile.style.removeProperty('transition'); tile.classList.remove('lv-dragging'); }, 360);
      }));
    };
    tile.addEventListener('pointerup', end);
    tile.addEventListener('pointercancel', end);
    // dopo un trascinamento il clic non deve fare altro
    tile.addEventListener('click', (ev) => { if (tile.classList.contains('lv-dragging')) { ev.stopPropagation(); ev.preventDefault(); } }, true);
  }

  // ── pannello ──────────────────────────────────────────────────────────────
  const ICO = {
    x: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    // illustrazioni disegnate a mano: cornice + riquadri, colore dal tema
    auto: '<svg viewBox="0 0 72 44" aria-hidden="true"><rect class="f" x="1" y="1" width="70" height="42" rx="6"/><rect class="t" x="6" y="6" width="28" height="15" rx="3"/><rect class="t" x="38" y="6" width="28" height="15" rx="3"/><rect class="t" x="6" y="23" width="28" height="15" rx="3"/><rect class="t" x="38" y="23" width="28" height="15" rx="3"/><path class="a" d="M52 25.5l1.6 3.9 3.9 1.6-3.9 1.6-1.6 3.9-1.6-3.9-3.9-1.6 3.9-1.6z"/></svg>',
    grid: '<svg viewBox="0 0 72 44" aria-hidden="true"><rect class="f" x="1" y="1" width="70" height="42" rx="6"/><rect class="t" x="6" y="6" width="18" height="15" rx="3"/><rect class="t" x="27" y="6" width="18" height="15" rx="3"/><rect class="t" x="48" y="6" width="18" height="15" rx="3"/><rect class="t" x="6" y="23" width="18" height="15" rx="3"/><rect class="t" x="27" y="23" width="18" height="15" rx="3"/><rect class="t" x="48" y="23" width="18" height="15" rx="3"/></svg>',
    spotlight: '<svg viewBox="0 0 72 44" aria-hidden="true"><rect class="f" x="1" y="1" width="70" height="42" rx="6"/><rect class="t" x="6" y="6" width="60" height="32" rx="4"/><circle class="a" cx="36" cy="18" r="5"/><path class="a" d="M27 32c1.4-4.2 4.8-6.3 9-6.3s7.6 2.1 9 6.3z"/></svg>',
    sidebar: '<svg viewBox="0 0 72 44" aria-hidden="true"><rect class="f" x="1" y="1" width="70" height="42" rx="6"/><rect class="t" x="6" y="6" width="43" height="32" rx="4"/><rect class="t" x="52" y="6" width="14" height="9.5" rx="2.5"/><rect class="t" x="52" y="17.25" width="14" height="9.5" rx="2.5"/><rect class="t" x="52" y="28.5" width="14" height="9.5" rx="2.5"/><circle class="a" cx="27.5" cy="18" r="4.5"/><path class="a" d="M19.5 31c1.3-3.8 4.3-5.6 8-5.6s6.7 1.8 8 5.6z"/></svg>',
  };
  const MODE_LBL = { auto: 'Automatico', grid: 'Griglia', spotlight: 'In evidenza', sidebar: 'Barra laterale' };
  const MODE_HINT = {
    auto: 'Griglia finché siete in 4, poi una persona in grande e le altre di lato.',
    autoPhone: 'Una persona in grande e le altre in fila sotto.',
    grid: 'Tutti uguali, uno accanto all\'altro.',
    spotlight: 'Un riquadro solo, a tutto schermo: chi parla o lo schermo condiviso.',
    sidebar: 'Una persona in grande, le altre in colonna a destra.',
  };
  const SELF_LBL = { grid: 'Nella griglia', float: 'Finestrella', hidden: 'Nascosto' };
  const SELF_HINT = {
    grid: 'Ti vedi insieme agli altri.',
    float: 'Sempre in un angolo: trascinala dove ti dà meno fastidio.',
    hidden: 'Non ti vedi, ma gli altri ti vedono come sempre.',
  };

  let panel = null, scrim = null, open = false;
  const isOpen = () => open;

  function build() {
    scrim = document.createElement('div');
    scrim.className = 'lv-scrim hidden';
    scrim.addEventListener('click', () => close());
    panel = document.createElement('div');
    panel.className = 'lv-panel hidden';
    panel.id = 'lvPanel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-labelledby', 'lvTitle');
    panel.innerHTML = `
      <div class="lv-grab" aria-hidden="true"></div>
      <div class="lv-head">
        <div><h3 id="lvTitle">Vista</h3><p class="lv-sub">Solo per te · resta salvata in questo browser</p></div>
        <button type="button" class="btn-icon lv-x" aria-label="Chiudi" data-tip="Chiudi">${ICO.x}</button>
      </div>
      <div class="lv-modes" role="radiogroup" aria-label="Disposizione">
        ${MODES.map(m => `<button type="button" class="lv-mode" role="radio" data-mode="${m}" aria-checked="false">${ICO[m]}<span>${MODE_LBL[m]}</span></button>`).join('')}
      </div>
      <p class="lv-hint lv-mode-hint" id="lvModeHint"></p>
      <div class="lv-sec lv-max">
        <div class="lv-row"><label class="lv-lbl" for="lvMax">Riquadri al massimo</label><output class="lv-out-n" id="lvMaxOut" for="lvMax" translate="no"></output></div>
        <input type="range" id="lvMax" min="2" step="1">
        <div class="lv-scale" aria-hidden="true" translate="no"><span>2</span><span id="lvMaxTop"></span></div>
        <p class="lv-hint" id="lvMaxHint"></p>
      </div>
      <div class="lv-sec">
        <label class="cs-switch lv-switch"><input type="checkbox" id="lvHide"><span class="dp-track"></span><span class="cs-sw-txt"><span>Nascondi chi ha la videocamera spenta</span><small>Un avviso ti dice chi non vedi. Chi hai fissato resta in vista.</small></span></label>
      </div>
      <div class="lv-sec">
        <div class="lv-lbl" id="lvSelfLbl">Il tuo riquadro</div>
        <div class="lv-seg" role="radiogroup" aria-labelledby="lvSelfLbl">
          ${SELF.map(v => `<button type="button" role="radio" data-self="${v}" aria-checked="false">${SELF_LBL[v]}</button>`).join('')}
        </div>
        <p class="lv-hint" id="lvSelfHint"></p>
      </div>`;
    document.body.appendChild(scrim);
    document.body.appendChild(panel);

    panel.querySelector('.lv-x').addEventListener('click', () => close(true));
    panel.querySelector('.lv-modes').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-mode]'); if (!b) return;
      setMode(b.dataset.mode);
    });
    panel.querySelector('.lv-seg').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-self]'); if (!b) return;
      if (S.self === b.dataset.self) return;
      S.self = b.dataset.self; save(); G.relayout(); syncPanel();
    });
    const range = panel.querySelector('#lvMax');
    let rT = null;
    range.addEventListener('input', () => {
      const v = clamp(parseInt(range.value, 10) || 2, 2, isPhone() ? PHONE_MAX : DESK_MAX);
      if (isPhone()) S.maxPhone = v; else S.maxDesk = v;
      panel.querySelector('#lvMaxOut').textContent = v;
      paintRange(range);
      clearTimeout(rT); rT = setTimeout(() => { save(); G.relayout(); }, 60);
    });
    panel.querySelector('#lvHide').addEventListener('change', (ev) => {
      S.hide = ev.target.checked; save(); G.relayout();
    });
    // frecce nei gruppi a scelta singola, come un radiogroup vero
    panel.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') { ev.stopPropagation(); close(true); return; }
      const grp = ev.target.closest('[role="radiogroup"]');
      if (!grp || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(ev.key)) return;
      const items = [...grp.querySelectorAll('[role="radio"]')].filter(b => b.offsetParent !== null);
      const i = items.indexOf(ev.target); if (i < 0) return;
      const nx = items[(i + (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length];
      ev.preventDefault(); nx.focus(); nx.click();
    });
  }

  function paintRange(r) {
    const min = +r.min, max = +r.max, v = +r.value;
    r.style.setProperty('--lv-p', ((v - min) / (max - min) * 100).toFixed(1) + '%');
  }

  function syncPanel() {
    if (!panel) return;
    const e = eff();
    panel.classList.toggle('lv-phone', e.phone);
    panel.querySelectorAll('.lv-mode').forEach(b => {
      const on = b.dataset.mode === e.mode;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
      b.hidden = e.phone && b.dataset.mode === 'sidebar';
    });
    panel.querySelector('#lvModeHint').textContent = e.phone && e.mode === 'auto' ? MODE_HINT.autoPhone : MODE_HINT[e.mode];
    const range = panel.querySelector('#lvMax');
    const top = e.phone ? PHONE_MAX : DESK_MAX;
    range.max = top; range.value = e.max;
    range.disabled = e.mode === 'spotlight';
    panel.querySelector('.lv-max').classList.toggle('is-off', range.disabled);
    panel.querySelector('#lvMaxTop').textContent = top;
    panel.querySelector('#lvMaxOut').textContent = e.max;
    panel.querySelector('#lvMaxHint').textContent = range.disabled
      ? 'In evidenza c\'è un riquadro solo: il massimo non serve.'
      : 'Oltre il massimo compare «+N», che apre la lista delle persone.';
    paintRange(range);
    panel.querySelector('#lvHide').checked = S.hide;
    panel.querySelectorAll('.lv-seg [data-self]').forEach(b => {
      const on = b.dataset.self === S.self;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    panel.querySelector('#lvSelfHint').textContent = SELF_HINT[S.self];
  }

  function place() {
    if (!panel || isPhone()) { panel?.style.removeProperty('right'); panel?.style.removeProperty('bottom'); return; }
    const b = document.getElementById('btnLayout');
    const r = b?.getBoundingClientRect();
    if (!r || !r.width) { panel.style.right = '16px'; panel.style.bottom = '96px'; return; }
    const w = panel.offsetWidth || 340;
    const right = clamp(window.innerWidth - r.right - 40, 12, Math.max(12, window.innerWidth - w - 12));
    panel.style.right = right + 'px';
    panel.style.bottom = Math.round(window.innerHeight - r.top + 10) + 'px';
  }

  function openPanel() {
    if (!panel) build();
    document.getElementById('emojiPicker')?.classList.add('hidden');
    window.closeMoreMenu?.();
    syncPanel();
    panel.classList.remove('hidden');
    scrim.classList.toggle('hidden', !isPhone());
    open = true;
    place();
    const b = document.getElementById('btnLayout');
    b?.classList.add('active'); b?.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => panel.querySelector('.lv-mode.on')?.focus({ preventScroll: true }));
  }
  function close(focusBtn) {
    if (!open) return;
    open = false;
    panel?.classList.add('hidden');
    scrim?.classList.add('hidden');
    const b = document.getElementById('btnLayout');
    b?.classList.remove('active'); b?.setAttribute('aria-expanded', 'false');
    if (focusBtn) b?.focus({ preventScroll: true });
  }
  function toggle() { open ? close(true) : openPanel(); }

  function setMode(m) {
    if (!MODES.includes(m)) return;
    S.mode = m; save();
    lvPin = null; G.setPeer(/-screen$/.test(G.getPeer() || '') ? G.getPeer() : null);
    G.relayout();
    syncPanel();
  }

  // ── collegamenti ──────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);
  if (document.readyState !== 'loading') init();
  let inited = false;
  function init() {
    if (inited) return; inited = true;
    const b = document.getElementById('btnLayout');
    if (b) {
      b.setAttribute('aria-haspopup', 'dialog');
      b.setAttribute('aria-expanded', 'false');
      b.setAttribute('aria-controls', 'lvPanel');
      b.addEventListener('click', (ev) => { ev.stopPropagation(); toggle(); });
    }
    // «+N»: apre la lista Persone (prima dei clic messi da room.js sui riquadri)
    const g = document.getElementById('videoGrid');
    g?.addEventListener('click', (ev) => {
      if (!ev.target.closest('.lv-more')) return;
      ev.stopPropagation(); ev.preventDefault(); openPeople();
    }, true);
    g?.addEventListener('keydown', (ev) => {
      if (!ev.target.classList?.contains('lv-more') || (ev.key !== 'Enter' && ev.key !== ' ')) return;
      ev.preventDefault(); openPeople();
    });
    document.addEventListener('pointerdown', (ev) => {
      if (!open || isPhone()) return;
      if (panel.contains(ev.target) || document.getElementById('btnLayout')?.contains(ev.target)) return;
      close();
    }, true);
    document.addEventListener('keydown', (ev) => { if (open && ev.key === 'Escape') close(true); });
    window.addEventListener('resize', () => {
      if (!open) return;
      scrim.classList.toggle('hidden', !isPhone());
      syncPanel(); place();
    });
  }

  window.TdtLayout = {
    before, after,
    // chiamato da setSpeaking: chi parla torna in vista / diventa grande
    speaking(peerId, on) {
      if (!on || !peerId || peerId === 'local') return;
      lastSpeak.set(peerId, Date.now());
      const e = eff();
      if (overflowIds.has(peerId)) throttled(2500);
      else if (e.mode === 'spotlight' && !lvPin && G.getPeer() !== peerId) throttled(1500);
    },
    // chiamato da setTileVideo: la videocamera di qualcuno si accende/spegne
    videoChanged() { if (S.hide || overflowIds.size) schedule(150); },
    phoneGrid: () => eff().phone && eff().mode === 'grid' && !lvPin,
    setMode, open: openPanel, close, get state() { return Object.assign({}, S); },
  };
})();
