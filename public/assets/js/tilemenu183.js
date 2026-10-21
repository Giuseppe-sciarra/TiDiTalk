/* ═══════════════════════════════════════════════════════════════════════════
   1.8.3 — Menu ⋮ sul riquadro (idea 06)
   · tasto ⋮ su ogni riquadro di una persona (non sugli schermi condivisi, non
     sul «+N»): compare al passaggio del mouse; sul telefono è sempre visibile
     sui riquadri grandi (sui piccoli un tocco li fa diventare grandi)
   · lo stesso menu accanto a ogni persona nella lista Persone
   · voci per tutti: Fissa / Sblocca per me, Schermo intero
     voci in più per gli organizzatori: Fissa / Sblocca per tutti (max 3),
     Silenzia, Rimanda in sala d'attesa, Rimuovi (con conferma)
   «Fissa per me» è il «fissa» che c'era già (layout.js, clic sul riquadro):
   qui non c'è un secondo sistema di pin. «Fissa per tutti» arriva dal server
   (server/pinall.js) e viene applicato come quel pin, con la scritta
   «Fissata per tutti da X» sul riquadro; il pin scelto da te vince sempre.
   Agganci: room.js createTile → tile(), connessione → bind(socket);
   layout.js → getPin() e isPinAll() per tenere in vista i fissati.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const T = (s) => (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t(s) : s;
  const fmt = (s, ...a) => T(s).replace(/\{(\d)\}/g, (_, i) => String(a[i] ?? ''));
  const toast = (m, d) => { if (typeof window.showToast === 'function') window.showToast(m, d || 2600); };

  let sock = null;
  let pins = [];                 // [{ id: socket del server, by: nome, at }]
  const optOut = new Set();      // fissati per tutti che hai sbloccato per te (id@at)
  let autoPinned = null;         // riquadro reso grande da qui (per tutti), non da te

  // ── utilità ──────────────────────────────────────────────────────────────
  const myId = () => (sock && sock.id) || window._tdSocket?.id || '';
  const toTile = (sid) => (sid && sid === myId() ? 'local' : sid);
  const toSid = (tid) => (tid === 'local' ? myId() : tid);
  const peersMap = () => (typeof peers !== 'undefined' ? peers : new Map());
  const tilesMap = () => (typeof peerTiles !== 'undefined' ? peerTiles : new Map());
  const isHost = () => !!window.__isHostRole;
  const pinKey = (p) => p.id + '@' + p.at;
  const present = (sid) => sid === myId() || peersMap().has(sid);
  function nameOf(tid) {
    if (tid === 'local') return (typeof DISPLAY_NAME !== 'undefined' ? DISPLAY_NAME : '') || T('Tu');
    return peersMap().get(tid)?.displayName || '';
  }
  const pinOf = (tid) => pins.find(p => toTile(p.id) === tid && present(p.id)) || null;
  const curPin = () => (window.TdtLayout && typeof window.TdtLayout.getPin === 'function' ? window.TdtLayout.getPin() : null) || null;
  const relayout = () => { if (typeof updateGridLayout === 'function') updateGridLayout(); };
  const isPersonTile = (el) => !!el && !el.classList.contains('screenshare') && !el.classList.contains('lv-more');

  // ── icone (disegnate qui) ────────────────────────────────────────────────
  const svg = (p) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  const IC = {
    dots: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5.5" r="1.9" fill="currentColor"/><circle cx="12" cy="12" r="1.9" fill="currentColor"/><circle cx="12" cy="18.5" r="1.9" fill="currentColor"/></svg>',
    pin: svg('<path d="M9 3.5h6l-1 5 3.5 3.5v1.5h-11V12L10 8.5z"/><path d="M12 13.5V21"/>'),
    unpin: svg('<path d="M9 3.5h6l-1 5 3.5 3.5v1.5h-11V12L10 8.5z"/><path d="M12 13.5V21"/><path d="M4 4l16 16"/>'),
    pinAll: svg('<path d="M8 3.5h5l-.8 4.2 2.9 2.9v1.3H5.9v-1.3l2.9-2.9z"/><path d="M10.5 11.9V18"/><path d="M16.5 14.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM20.5 21a4 4 0 0 0-8 0"/>'),
    full: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
    exitFull: svg('<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'),
    mute: svg('<path d="M3 3l18 18"/><path d="M9 9v3a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.9-.6"/><path d="M17 16.9A7 7 0 0 1 5 12v-1.5M19 10.5V12a7 7 0 0 1-.1 1.2"/><path d="M12 19v3"/>'),
    lobby: svg('<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 16l-4-4 4-4"/><path d="M6 12h9"/>'),
    kick: svg('<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20a6.5 6.5 0 0 1 11-4.7"/><path d="M16 15l5 5M21 15l-5 5"/>'),
  };

  // ── «Fissa per tutti» applicato come il pin di layout.js ─────────────────
  function applyPins() {
    if (typeof window.togglePin !== 'function' || !window.TdtLayout?.getPin) return;
    const cur = curPin();
    // il riquadro grande è cambiato senza di noi (clic, presentazione, uscita):
    // quel «fissato per tutti» per te resta sbloccato
    if (autoPinned && cur !== autoPinned) {
      const p = pinOf(autoPinned);
      if (p) optOut.add(pinKey(p));
      autoPinned = null;
    }
    if (cur && cur !== autoPinned) return; // fissato da te: vince il tuo
    // l'ultimo fissato per tutti diventa grande (tu non diventi grande sul tuo schermo)
    const live = pins.filter(p => present(p.id) && !optOut.has(pinKey(p)) && toTile(p.id) !== 'local'
      && tilesMap().get(toTile(p.id))?.isConnected);
    const want = live.length ? toTile(live[live.length - 1].id) : null;
    if (want === cur) { autoPinned = want; return; }
    autoPinned = want;
    window.togglePin(want || cur); // con want null toglie il pin che avevamo messo noi
    if (want && curPin() !== want) autoPinned = null;
  }

  function renderLabels() {
    tilesMap().forEach((el, tid) => {
      if (!isPersonTile(el)) return;
      const p = pinOf(tid);
      let chip = el.querySelector(':scope > .tm-pinned');
      if (!p) { chip?.remove(); el.classList.remove('tm-is-pinall'); return; }
      if (!chip) {
        chip = document.createElement('span');
        chip.className = 'tm-pinned';
        chip.innerHTML = IC.pin + '<span class="tm-pinned-t"></span>';
        el.appendChild(chip);
      }
      const txt = fmt('Fissata per tutti da {0}', p.by);
      chip.querySelector('.tm-pinned-t').textContent = txt;
      chip.dataset.tip = txt;
      el.classList.add('tm-is-pinall');
    });
  }

  function refreshAll() {
    renderLabels();
    const before = curPin();
    applyPins();
    // la posizione dei fissati (sempre in vista) dipende da isPinAll: rifà il layout
    if (curPin() === before) relayout();
    if (typeof refreshParticipants === 'function') { try { refreshParticipants(); } catch (_) { } }
  }

  // ── tasto ⋮ sul riquadro ─────────────────────────────────────────────────
  let ro = null;
  function watchWidth(el) {
    if (typeof ResizeObserver === 'undefined') return;
    if (!ro) ro = new ResizeObserver(es => es.forEach(e => {
      e.target.classList.toggle('tm-narrow', e.contentRect.width < 170);
    }));
    ro.observe(el);
  }

  function tile(el, peerId) {
    if (!isPersonTile(el) || el.querySelector(':scope > .tm-dots')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tm-dots';
    b.setAttribute('aria-haspopup', 'menu');
    b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-label', T('Altre opzioni'));
    b.dataset.tip = T('Altre opzioni');
    b.innerHTML = IC.dots;
    b.addEventListener('click', (ev) => {
      ev.stopPropagation(); ev.preventDefault();
      toggleMenu(b, peerId ?? el.dataset.peerId);
    });
    // il tocco sul ⋮ non deve far diventare grande il riquadro
    b.addEventListener('dblclick', (ev) => ev.stopPropagation());
    el.appendChild(b);
    watchWidth(el);
    setTimeout(() => { renderLabels(); if (pins.length) applyPins(); }, 0);
  }

  // ── menu ─────────────────────────────────────────────────────────────────
  let menu = null, anchor = null, menuFor = null;

  function closeMenu(focusBack) {
    if (!menu) return;
    menu.remove(); menu = null;
    if (anchor) {
      anchor.setAttribute('aria-expanded', 'false');
      anchor.closest('.video-tile')?.classList.remove('tm-open');
      if (focusBack && anchor.isConnected) anchor.focus();
    }
    anchor = null; menuFor = null;
  }
  function toggleMenu(btn, tid) {
    if (menu && anchor === btn) { closeMenu(true); return; }
    openMenu(btn, tid);
  }

  function items(tid) {
    const out = [];
    const host = isHost();
    const pinnedForMe = curPin() === tid;
    out.push(pinnedForMe
      ? { k: 'unpinMe', ic: IC.unpin, t: 'Sblocca per me' }
      : { k: 'pinMe', ic: IC.pin, t: 'Fissa per me' });
    if (host) {
      if (pinOf(tid)) out.push({ k: 'unpinAll', ic: IC.unpin, t: 'Sblocca per tutti' });
      else {
        const full = pins.filter(p => present(p.id)).length >= 3;
        out.push({ k: 'pinAll', ic: IC.pinAll, t: full ? 'Fissa per tutti (massimo 3)' : 'Fissa per tutti', off: full });
      }
    }
    const el = tilesMap().get(tid);
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    out.push(el && fsEl === el
      ? { k: 'exitFull', ic: IC.exitFull, t: 'Esci da schermo intero' }
      : { k: 'full', ic: IC.full, t: 'Schermo intero', off: !el });
    if (host && tid !== 'local') {
      const p = peersMap().get(tid);
      out.push({ sep: true });
      out.push({ k: 'mute', ic: IC.mute, t: p?.audioMuted ? 'Microfono già spento' : 'Silenzia', off: !!p?.audioMuted });
      if (p?.isGuest) {
        out.push({ k: 'lobby', ic: IC.lobby, t: 'Rimanda in sala d\'attesa' });
        out.push({ k: 'kick', ic: IC.kick, t: 'Rimuovi dalla riunione', danger: true });
      }
    }
    return out;
  }

  function fill(tid) {
    menu.textContent = '';
    const head = document.createElement('div');
    head.className = 'tm-head';
    head.textContent = tid === 'local' ? fmt('{0} (Tu)', nameOf(tid)) : nameOf(tid);
    menu.appendChild(head);
    items(tid).forEach(it => {
      if (it.sep) { const s = document.createElement('div'); s.className = 'tm-sep'; s.setAttribute('role', 'separator'); menu.appendChild(s); return; }
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tm-item' + (it.danger ? ' danger' : '');
      b.setAttribute('role', 'menuitem');
      b.dataset.k = it.k;
      if (it.off) b.disabled = true;
      b.innerHTML = it.ic + '<span></span>';
      b.querySelector('span').textContent = T(it.t);
      b.addEventListener('click', (ev) => { ev.stopPropagation(); act(it.k, tid); });
      menu.appendChild(b);
    });
  }

  function place() {
    if (!menu || !anchor) return;
    const phone = window.matchMedia('(max-width: 640px)').matches;
    menu.classList.toggle('tm-sheet', phone);
    if (phone) { menu.style.left = menu.style.top = ''; return; }
    const r = anchor.getBoundingClientRect();
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    const vw = window.innerWidth, vh = window.innerHeight;
    let left = r.right - mw;
    if (left < 8) left = Math.min(r.left, vw - mw - 8);
    let top = r.bottom + 6;
    if (top + mh > vh - 8) top = Math.max(8, r.top - mh - 6);
    menu.style.left = Math.max(8, Math.min(left, vw - mw - 8)) + 'px';
    menu.style.top = top + 'px';
  }

  function openMenu(btn, tid) {
    closeMenu(false);
    if (!tid) return;
    anchor = btn; menuFor = tid;
    menu = document.createElement('div');
    menu.className = 'tm-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', fmt('Opzioni per {0}', nameOf(tid)));
    fill(tid);
    // a schermo intero si vede solo l'elemento a schermo intero: il menu va lì dentro
    (document.fullscreenElement || document.webkitFullscreenElement || document.body).appendChild(menu);
    btn.setAttribute('aria-expanded', 'true');
    btn.closest('.video-tile')?.classList.add('tm-open');
    place();
    menu.querySelector('.tm-item:not([disabled])')?.focus({ preventScroll: true });
  }

  function confirmKick(tid) {
    const nm = nameOf(tid);
    menu.textContent = '';
    const q = document.createElement('div');
    q.className = 'tm-confirm';
    q.textContent = fmt('Rimuovere {0} dalla riunione?', nm);
    const row = document.createElement('div');
    row.className = 'tm-confirm-row';
    const no = document.createElement('button');
    no.type = 'button'; no.className = 'tm-btn'; no.textContent = T('Annulla');
    const yes = document.createElement('button');
    yes.type = 'button'; yes.className = 'tm-btn tm-btn-danger'; yes.dataset.k = 'kickYes'; yes.textContent = T('Rimuovi');
    no.addEventListener('click', (ev) => { ev.stopPropagation(); fill(tid); place(); menu.querySelector('.tm-item')?.focus(); });
    yes.addEventListener('click', (ev) => {
      ev.stopPropagation(); closeMenu(false);
      emit('kickPeer', { peerId: toSid(tid) }, () => toast(fmt('Hai rimosso {0} dalla riunione', nm)));
    });
    row.append(no, yes);
    menu.append(q, row);
    place();
    no.focus();
  }

  function emit(ev, data, ok) {
    const s = sock || window._tdSocket;
    if (!s) return;
    s.emit(ev, data, (r) => {
      if (r && r.error) toast(T(r.error), 3000);
      else if (ok) ok(r);
    });
  }

  function fullscreen(tid) {
    const el = tilesMap().get(tid);
    if (!el) return;
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl === el) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
      return;
    }
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) {
      try { const p = req.call(el); if (p && p.catch) p.catch(() => toast(T('Schermo intero non disponibile'))); } catch (_) { toast(T('Schermo intero non disponibile')); }
      return;
    }
    // iPhone: solo il video può andare a schermo intero
    const v = el.querySelector('video');
    if (v && typeof v.webkitEnterFullscreen === 'function' && v.srcObject) { try { v.webkitEnterFullscreen(); } catch (_) { } }
    else toast(T('Schermo intero non disponibile'));
  }

  function act(k, tid) {
    const nm = nameOf(tid);
    if (k === 'kick') { confirmKick(tid); return; }
    closeMenu(k !== 'full');
    switch (k) {
      case 'pinMe':
        // fissato da te: vince sui fissati per tutti
        autoPinned = null;
        window.togglePin?.(tid);
        if (curPin() !== tid) toast(T('Questo riquadro ora non si può fissare'));
        break;
      case 'unpinMe': {
        const p = pinOf(tid);
        if (p) optOut.add(pinKey(p));
        if (autoPinned === tid) autoPinned = null;
        if (curPin() === tid) window.togglePin?.(tid);
        applyPins();
        break;
      }
      case 'pinAll': emit('pinAll', { peerId: toSid(tid), on: true }); break;
      case 'unpinAll': emit('pinAll', { peerId: toSid(tid), on: false }); break;
      case 'full': fullscreen(tid); break;
      case 'exitFull': fullscreen(tid); break;
      case 'mute': emit('mutePeer', { peerId: toSid(tid) }, () => toast(fmt('Hai silenziato {0}', nm))); break;
      case 'lobby': emit('sendToLobby', { peerId: toSid(tid) }, () => toast(fmt('Hai rimandato {0} in sala d\'attesa', nm), 3500)); break;
    }
  }

  // chiusura: clic fuori, Esc, finestra che cambia; frecce per muoversi
  document.addEventListener('pointerdown', (ev) => {
    if (!menu) return;
    if (menu.contains(ev.target) || (anchor && anchor.contains(ev.target))) return;
    closeMenu(false);
  }, true);
  document.addEventListener('keydown', (ev) => {
    if (!menu) return;
    if (ev.key === 'Escape') { ev.stopPropagation(); closeMenu(true); return; }
    if (ev.key === 'Tab') { closeMenu(false); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(ev.key)) return;
    const list = [...menu.querySelectorAll('button:not([disabled])')];
    if (!list.length) return;
    ev.preventDefault();
    const i = list.indexOf(document.activeElement);
    const n = ev.key === 'Home' ? 0 : ev.key === 'End' ? list.length - 1
      : ev.key === 'ArrowDown' ? (i + 1) % list.length : (i - 1 + list.length) % list.length;
    list[n].focus();
  }, true);
  // la finestra cambia (rotazione, barra degli indirizzi del telefono): il menu si risistema
  window.addEventListener('resize', () => { if (menu && anchor && !anchor.isConnected) closeMenu(false); else place(); });
  document.addEventListener('fullscreenchange', () => closeMenu(false));
  document.addEventListener('webkitfullscreenchange', () => closeMenu(false));

  // ── lista Persone: lo stesso ⋮ accanto a ogni persona ────────────────────
  function patchList() {
    const PL = window.ParticipantList;
    if (!PL || PL.prototype._tm183) return;
    const orig = PL.prototype._upsertItem;
    PL.prototype._tm183 = true;
    PL.prototype._upsertItem = function (list, peerId, displayName, state, isLocal) {
      orig.apply(this, arguments);
      const el = list.querySelector(`[data-peer-id="${CSS.escape(String(peerId))}"]`);
      if (!el) return;
      el.classList.add('tm-has-dots');
      const badges = el.querySelector('.participant-badges') || el;
      const tid = isLocal ? 'local' : peerId;
      const pinned = !!pinOf(tid);
      if (pinned) {
        const mark = document.createElement('span');
        mark.className = 'tm-list-pin';
        mark.dataset.tip = T('Fissata per tutti');
        mark.setAttribute('aria-label', T('Fissata per tutti'));
        mark.innerHTML = IC.pin;
        badges.appendChild(mark);
      }
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tm-dots tm-dots-list';
      b.setAttribute('aria-haspopup', 'menu');
      b.setAttribute('aria-expanded', menu && menuFor === tid ? 'true' : 'false');
      b.setAttribute('aria-label', fmt('Opzioni per {0}', isLocal ? nameOf('local') : displayName));
      b.dataset.tip = T('Altre opzioni');
      b.innerHTML = IC.dots;
      b.addEventListener('click', (ev) => { ev.stopPropagation(); ev.preventDefault(); toggleMenu(b, tid); });
      badges.appendChild(b);
      // la lista si ridisegna spesso: il menu aperto resta agganciato al tasto nuovo
      if (menu && menuFor === tid && anchor && !anchor.isConnected && anchor.classList.contains('tm-dots-list')) anchor = b;
    };
  }
  patchList();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', patchList);

  // ── socket ───────────────────────────────────────────────────────────────
  function bind(s) {
    if (!s || s._tm183) return;
    s._tm183 = true;
    sock = s;
    s.on('pinAll', (d) => {
      const next = Array.isArray(d && d.pins) ? d.pins.filter(p => p && typeof p.id === 'string').slice(0, 3)
        .map(p => ({ id: p.id, by: String(p.by || '').slice(0, 50), at: Number(p.at) || 0 })) : [];
      const old = new Set(pins.map(pinKey));
      const added = next.filter(p => !old.has(pinKey(p)));
      pins = next;
      // via le scelte «sblocca per me» di fissati che non ci sono più
      const keys = new Set(pins.map(pinKey));
      [...optOut].forEach(k => { if (!keys.has(k)) optOut.delete(k); });
      refreshAll();
      // avviso solo per i fissati nuovi (non all'ingresso, non a chi l'ha fatto)
      if (!(d && d.snapshot)) {
        added.forEach(p => {
          const tid = toTile(p.id);
          if (!p.by) return;
          if (tid === 'local') toast(fmt('{0} ti ha fissato per tutti', p.by), 3000);
          else if (nameOf(tid)) toast(fmt('{0} ha fissato {1} per tutti', p.by, nameOf(tid)), 3000);
        });
      }
    });
    s.on('peerLeft', ({ peerId } = {}) => {
      if (menuFor === peerId) closeMenu(false);
      if (pins.some(p => p.id === peerId)) {
        pins = pins.filter(p => p.id !== peerId);
        setTimeout(refreshAll, 350); // il riquadro esce dopo 200 ms
      }
    });
    // un organizzatore ti ha silenziato (solo te)
    s.on('mutedBy', ({ by } = {}) => {
      const already = !!window._tdIsMicMuted?.();
      try { window._tdSetMicMuted?.(true); } catch (_) { }
      if (!already) toast(fmt('{0} ti ha silenziato', String(by || T('L\'organizzatore')).slice(0, 50)), 4000);
    });
    // un organizzatore ti ha rimandato in sala d'attesa: si ricarica e si aspetta
    s.on('sentToLobby', ({ by } = {}) => {
      try { if (typeof _ticketKey === 'function') sessionStorage.removeItem(_ticketKey()); } catch (_) { }
      try { if (typeof _saveRejoin === 'function') _saveRejoin('sent-to-lobby'); } catch (_) { }
      const msg = document.createElement('div');
      msg.className = 'tm-backmsg';
      msg.textContent = fmt('{0} ti ha rimandato in sala d\'attesa…', String(by || T('L\'organizzatore')).slice(0, 50));
      document.body.appendChild(msg);
      const stop = () => {
        try { if (typeof rawCamStream !== 'undefined') rawCamStream?.getTracks().forEach(t => t.stop()); } catch (_) { }
        try { s.disconnect(); } catch (_) { }
      };
      if (typeof _reloadForRejoin === 'function') _reloadForRejoin(stop);
      else { stop(); setTimeout(() => location.reload(), 1200); }
    });
  }

  // riquadri già presenti (se lo script arrivasse dopo il primo createTile)
  function scan() { tilesMap().forEach((el, id) => tile(el, id)); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan); else scan();
  if (window._tdSocket) bind(window._tdSocket);

  window.TdtTileMenu = {
    tile, bind,
    isPinAll: (tid) => !!pinOf(tid),
    _state: () => ({ pins: pins.slice(), optOut: [...optOut], autoPinned, pin: curPin(), open: menuFor }),
  };
})();
