'use strict';
/**
 * 1.8.0 — Mani alzate in coda (idea di Meet, stile Tiditalk).
 *
 * • Nella lista Persone, in cima, la sezione «Mani alzate» in ordine di
 *   arrivo (ora segnata dal server) con da quanto è alzata ogni mano, il tasto
 *   Abbassa (organizzatori, e la persona stessa) e «Abbassa tutte»
 *   (organizzatori).
 * • Sul riquadro, in alto a sinistra, il posto in coda (✋ 2), dentro il
 *   contenitore a colonna .tile-badges (così altre scritte si impilano sotto).
 * • In basso a sinistra un piccolo avviso «3 mani alzate» che apre la coda.
 * • La propria mano si abbassa da sola dopo che hai parlato per circa 4 s
 *   (rilevamento della voce già presente in room.js), non più dopo 10 s fissi.
 * Server: handRaise { raised } · handLower { peerId | all } → peerHandRaise.
 */
(function () {
  const T = (s) => (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t(s) : s;
  const SPEAK_LOWER_MS = 4000;
  let socket = null, offset = 0;           // offset = ora del server − ora del browser
  const queue = new Map();                 // peerId (socket) → ora del server in cui ha alzato la mano
  let sec = null, pill = null, tick = null, flashT = null;

  const isHost = () => !!window.__isHostRole;
  const myId = () => socket?.id;
  const now = () => Date.now() + offset;
  const sorted = () => Array.from(queue.entries()).sort((a, b) => a[1] - b[1]).map(([id, at]) => ({ id, at }));
  const nameOf = (id) => (id === myId() ? (window._tdDisplayName?.() || '') : (window._tdPeers?.get(id)?.displayName || ''));
  const tileId = (id) => (id === myId() ? 'local' : id);
  function ago(at) {
    const s = Math.max(0, Math.round((now() - at) / 1000));
    if (s < 60) return T('{0} s').replace('{0}', s);
    const m = Math.floor(s / 60);
    return m < 60 ? T('{0} min').replace('{0}', m) : T('{0} h').replace('{0}', Math.floor(m / 60));
  }
  function initials(n) { return (typeof window.getInitialsPlain === 'function') ? window.getInitialsPlain(n) : (String(n || '?')[0] || '?').toUpperCase(); }
  function color(id) { try { return window.getAvatarColor(String(tileId(id))); } catch (_) { return 'var(--accent)'; } }
  function el(tag, cls, attrs) { const n = document.createElement(tag); if (cls) n.className = cls; if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]); return n; }

  // ── posto in coda sul riquadro (in alto a sinistra) ──────────────────────
  function badgesOf(tile) {
    let b = tile.querySelector(':scope > .tile-badges');
    if (!b) { b = el('div', 'tile-badges'); tile.appendChild(b); }
    return b;
  }
  function paintTiles() {
    const order = sorted();
    const pos = new Map(order.map((x, i) => [tileId(x.id), i + 1]));
    document.querySelectorAll('#videoGrid .video-tile').forEach(t => {
      const id = t.dataset.peerId; if (!id || t.classList.contains('screenshare')) return;
      const n = pos.get(id);
      let h = t.querySelector('.tile-badges > .tile-hand-queue');
      if (!n) { if (h) h.remove(); return; }
      if (!h) {
        h = el('div', 'tile-hand-queue', { role: 'img' });
        h.innerHTML = '<span class="thq-ico" aria-hidden="true">✋</span><span class="thq-n"></span>';
        badgesOf(t).prepend(h);
      }
      h.querySelector('.thq-n').textContent = n;
      h.setAttribute('aria-label', T('Mano alzata, {0}° in coda').replace('{0}', n));
      h.dataset.tip = T('Mano alzata, {0}° in coda').replace('{0}', n);
    });
  }

  // ── sezione «Mani alzate» nella lista Persone ────────────────────────────
  function ensureSec() {
    if (sec) return sec;
    const panel = document.getElementById('participantsPanel');
    const list = document.getElementById('participantsList');
    if (!panel || !list) return null;
    sec = el('section', 'tdt-hands-sec hidden', { 'aria-label': T('Mani alzate') });
    sec.innerHTML = `<div class="tdt-hands-head"><span class="tdt-hands-title"><span aria-hidden="true">✋</span> <span class="tdt-hands-label"></span> <span class="participants-count tdt-hands-count"></span></span><button type="button" class="tdt-hands-all"></button></div><ol class="tdt-hands-list"></ol>`;
    sec.querySelector('.tdt-hands-label').textContent = T('Mani alzate');
    const all = sec.querySelector('.tdt-hands-all');
    all.textContent = T('Abbassa tutte');
    all.addEventListener('click', () => lower({ all: true }));
    sec.querySelector('.tdt-hands-list').addEventListener('click', (e) => {
      const b = e.target.closest('[data-lower]'); if (b) lower({ peerId: b.dataset.lower });
    });
    panel.insertBefore(sec, list);
    return sec;
  }
  function paintSec() {
    const s = ensureSec(); if (!s) return;
    const order = sorted();
    s.classList.toggle('hidden', !order.length);
    s.querySelector('.tdt-hands-count').textContent = order.length;
    s.querySelector('.tdt-hands-all').classList.toggle('hidden', !(isHost() && order.length >= 2));
    const ol = s.querySelector('.tdt-hands-list');
    ol.textContent = '';
    order.forEach((x, i) => {
      const me = x.id === myId();
      const li = el('li', 'tdt-hands-row');
      const pos = el('span', 'tdt-hands-pos'); pos.textContent = i + 1;
      const av = el('span', 'participant-avatar tdt-hands-av'); av.textContent = initials(nameOf(x.id)); av.style.background = color(x.id);
      const info = el('span', 'tdt-hands-info');
      const nm = el('span', 'tdt-hands-name', { translate: 'no' }); nm.textContent = nameOf(x.id) + (me ? ' ' + T('(Tu)') : '');
      const since = el('span', 'tdt-hands-since', { 'data-at': String(x.at) }); since.textContent = ago(x.at);
      info.append(nm, since);
      li.append(pos, av, info);
      if (isHost() || me) {
        const b = el('button', 'tdt-hands-lower', { type: 'button', 'data-lower': x.id, 'aria-label': T('Abbassa la mano di {0}').replace('{0}', nameOf(x.id)) });
        b.textContent = T('Abbassa');
        li.appendChild(b);
      }
      ol.appendChild(li);
    });
  }

  // ── avviso in basso a sinistra ───────────────────────────────────────────
  function ensurePill() {
    if (pill) return pill;
    pill = el('button', 'tdt-hands-pill hidden', { type: 'button' });
    pill.innerHTML = '<span class="thp-ico" aria-hidden="true">✋</span><span class="thp-txt"><b class="thp-n"></b><small class="thp-who" translate="no"></small></span>';
    pill.addEventListener('click', openQueue);
    document.body.appendChild(pill);
    return pill;
  }
  function placePill() {
    if (!pill) return;
    const cb = document.querySelector('.controls-bar');
    const gap = cb ? Math.max(0, window.innerHeight - cb.getBoundingClientRect().top) : 84;
    pill.style.bottom = (gap + 12) + 'px';
  }
  function paintPill() {
    const p = ensurePill();
    const order = sorted();
    const panelOpen = !document.getElementById('participantsPanel')?.classList.contains('hidden');
    const show = order.length > 0 && !panelOpen;
    const was = !p.classList.contains('hidden');
    p.classList.toggle('hidden', !show);
    if (show) {
      p.querySelector('.thp-n').textContent = order.length === 1 ? T('1 mano alzata') : T('{0} mani alzate').replace('{0}', order.length);
      const first = order[0];
      p.querySelector('.thp-who').textContent = first.id === myId() ? T('Tu per primo') : nameOf(first.id);
      p.querySelector('.thp-who').setAttribute('translate', first.id === myId() ? 'yes' : 'no');
      p.setAttribute('aria-label', p.querySelector('.thp-n').textContent + ': ' + T('apri la coda'));
      p.dataset.tip = T('Apri la coda delle mani alzate');
      placePill();
      if (!was) { p.classList.remove('in'); void p.offsetWidth; p.classList.add('in'); }
    }
    if (was !== show) window.TdtReact?.layoutRise?.();
  }
  function openQueue() {
    const panel = document.getElementById('participantsPanel');
    if (panel?.classList.contains('hidden')) document.getElementById('btnParticipants')?.click();
    paint();
    const s = ensureSec(); if (!s) return;
    s.scrollIntoView({ block: 'nearest' });
    s.classList.remove('flash'); void s.offsetWidth; s.classList.add('flash');
    clearTimeout(flashT); flashT = setTimeout(() => s.classList.remove('flash'), 1400);
    s.querySelector('button:not(.hidden)')?.focus({ preventScroll: true });
  }

  function paint() {
    paintTiles(); paintSec(); paintPill();
    if (queue.size && !tick) tick = setInterval(() => {
      sec?.querySelectorAll('.tdt-hands-since').forEach(e => { e.textContent = ago(+e.dataset.at); });
      paintPill(); // il pannello Persone si apre e chiude anche da altri tasti
    }, 1000);
    if (!queue.size && tick) { clearInterval(tick); tick = null; }
  }

  function lower(payload) {
    socket?.emit('handLower', payload, (r) => { if (r?.error) window.showToast?.(T(r.error), 3000); });
  }

  // ── abbassa da sola dopo ~4 s di voce ────────────────────────────────────
  let spokenMs = 0, lastCheck = 0;
  setInterval(() => {
    const t = performance.now(), dt = lastCheck ? Math.min(t - lastCheck, 1000) : 0; lastCheck = t;
    const mine = socket && queue.has(myId());
    if (!mine) { spokenMs = 0; return; }
    const speaking = !!window._speakingStates?.get('local') && !window._tdIsMicMuted?.();
    if (speaking) spokenMs += dt;
    if (spokenMs >= SPEAK_LOWER_MS) {
      spokenMs = 0;
      socket.emit('handRaise', { raised: false });
    }
  }, 250);

  // ── eventi ───────────────────────────────────────────────────────────────
  function onHand({ peerId, raised, at, now: srv, by } = {}) {
    if (typeof srv === 'number') offset = srv - Date.now();
    if (!peerId) return;
    if (raised) { if (!queue.has(peerId)) queue.set(peerId, typeof at === 'number' ? at : now()); if (peerId === myId()) spokenMs = 0; }
    else queue.delete(peerId);
    if (!raised && by && peerId === myId()) window.showToast?.(T('{0} ha abbassato la tua mano').replace('{0}', by), 3500);
    paint();
    window.TdtLayout?.hand?.(tileId(peerId), !!raised); // chi è nel «+N» e alza la mano torna in vista
  }

  window.TdtHands = {
    bind(sock) {
      socket = sock;
      sock.on('peerHandRaise', onHand);
      sock.on('peerLeft', ({ peerId } = {}) => { if (queue.delete(peerId)) paint(); });
      sock.on('peerJoined', (p) => { if (p?.handRaised) { queue.set(p.id, p.handRaisedAt || now()); paint(); } else paintTiles(); });
    },
    /** chi entra in ritardo: stato dal callback di joinRoom */
    load(peers, serverNow) {
      if (typeof serverNow === 'number') offset = serverNow - Date.now();
      (peers || []).forEach(p => { if (p && p.handRaised) queue.set(p.id, p.handRaisedAt || now()); });
      paint();
      // i riquadri vengono creati/spostati dopo (layout): riallinea il numero
      setTimeout(paintTiles, 600);
    },
    paint, openQueue,
    get queue() { return sorted(); },
  };
  window.addEventListener('resize', placePill);
  // la griglia ricrea o sposta i riquadri: il numero in coda resta al suo posto
  document.addEventListener('DOMContentLoaded', () => {
    const g = document.getElementById('videoGrid');
    if (g && window.MutationObserver) new MutationObserver(() => { if (queue.size) paintTiles(); }).observe(g, { childList: true });
    document.getElementById('btnParticipants')?.addEventListener('click', () => setTimeout(paint, 0));
    document.getElementById('btnCloseParticipants')?.addEventListener('click', () => setTimeout(paint, 0));
  });
})();
