/* ═══════════════════════════════════════════════════════════════════════════
   1.8.3 — Riquadri: voce e camera spenta (idea 15)
   · indicatore tondo in alto a destra: 3 barrette che seguono il volume di chi
     parla, microfono barrato per chi è muto (lo stato «muto» lo legge il CSS dal
     badge già esistente, qui non serve saperlo)
   · bordo pieno del colore d'accento attorno a chi parla (solo CSS)
   · camera spenta: sfondo e cerchio del colore dell'avatar, onde quando parla
   Agganci in room.js: createTile → tile(), setSpeaking → speaking(),
   analisi del proprio microfono → volLocal(), evento 'activeSpeaker' → volDb().
   Il ciclo che muove le barrette gira SOLO mentre qualcuno parla (~12 volte al
   secondo) e tocca solo i riquadri di chi parla.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const TICK_MS = 80;                // ~12 aggiornamenti al secondo
  const levels = new Map();          // peerId → { v: 0..1, t: ultimo aggiornamento }
  const talking = new Map();         // peerId → { s: livello smussato, refs }
  let timer = null;

  const MIC_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<line x1="3" y1="3" x2="21" y2="21"/><path d="M9 9v3a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.9-.6"/>'
    + '<path d="M17 16.9A7 7 0 0 1 5 12v-1.5M19 10.5V12a7 7 0 0 1-.1 1.2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>';

  function avColor(peerId, tile) {
    try { if (typeof getAvatarColor === 'function') return getAvatarColor(String(peerId)); } catch (_) { }
    return tile.querySelector('.avatar-circle')?.style.background || '';
  }

  /** Aggiunge l'indicatore e il colore dell'avatar a un riquadro (non agli schermi condivisi). */
  function tile(el, peerId) {
    if (!el || el.classList.contains('screenshare') || el.classList.contains('lv-more')) return;
    if (el.querySelector(':scope > .t183-voice')) return;
    const v = document.createElement('div');
    v.className = 't183-voice';
    v.setAttribute('aria-hidden', 'true');
    v.innerHTML = '<span class="t183-bars"><i></i><i></i><i></i></span>' + MIC_OFF;
    el.appendChild(v); // dopo .tile-mute-badge: il CSS usa «.tile-mute-badge.visible ~ .t183-voice»
    const c = avColor(peerId ?? el.dataset.peerId, el);
    if (c) el.style.setProperty('--t183-av', c);
    el.classList.add('t183');
  }

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function setLevel(id, v) {
    const o = levels.get(id);
    if (o) { o.v = v; o.t = performance.now(); } else levels.set(id, { v, t: performance.now() });
  }
  /** livello del proprio microfono (media 0..255 dell'analisi già esistente, soglia 20) */
  function volLocal(avg) { setLevel('local', clamp01((avg - 14) / 50)); }
  /** livello di un altro partecipante dal server (dBov, arriva solo sopra −65) */
  function volDb(id, db) { if (typeof db === 'number') setLevel(id, clamp01((db + 65) / 40)); }

  function refsOf(id) {
    const t = (typeof peerTiles !== 'undefined' && peerTiles.get(id)) || null;
    if (!t || !t.isConnected) return null;
    const v = t.querySelector(':scope > .t183-voice');
    return { tile: t, bars: v ? [...v.querySelectorAll('.t183-bars i')] : [], av: t.querySelector(':scope > .avatar') };
  }

  function reset(id, st) {
    const r = st?.refs; if (!r) return;
    r.bars.forEach(b => { b.style.transform = ''; });
    r.av?.style.removeProperty('--t183-lv');
  }

  function tick() {
    const now = performance.now();
    talking.forEach((st, id) => {
      if (!st.refs || !st.refs.tile.isConnected) st.refs = refsOf(id);
      const r = st.refs; if (!r) return;
      const lv = levels.get(id);
      // senza un livello recente (es. il server non l'ha mandato) le barrette
      // si muovono lo stesso: «almeno animate mentre parla»
      const target = lv && now - lv.t < 450 ? lv.v : 0.45 + 0.2 * Math.sin(now / 170);
      st.s = st.s * 0.45 + target * 0.55;
      const s = st.s;
      const k = [0.62 + Math.random() * 0.3, 0.85 + Math.random() * 0.15, 0.55 + Math.random() * 0.35];
      for (let i = 0; i < r.bars.length; i++) {
        r.bars[i].style.transform = 'scaleY(' + (0.3 + 0.7 * clamp01(s * 1.15) * k[i]).toFixed(2) + ')';
      }
      // l'onda attorno al cerchio delle iniziali: solo se la camera è spenta
      if (r.av && r.av.style.display !== 'none') r.av.style.setProperty('--t183-lv', s.toFixed(2));
    });
  }

  function speaking(id, on) {
    if (on) {
      if (!talking.has(id)) talking.set(id, { s: 0, refs: refsOf(id) });
    } else {
      const st = talking.get(id);
      if (st) { reset(id, st); talking.delete(id); }
    }
    if (talking.size && !timer) { timer = setInterval(tick, TICK_MS); tick(); }
    else if (!talking.size && timer) { clearInterval(timer); timer = null; }
  }

  // riquadri già presenti (se lo script arrivasse dopo il primo createTile)
  function scan() { document.querySelectorAll('#videoGrid .video-tile[data-peer-id]').forEach(t => tile(t, t.dataset.peerId)); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan); else scan();

  window.TdtTiles183 = { tile, speaking, volLocal, volDb, _busy: () => !!timer, _talking: () => [...talking.keys()] };
})();
