'use strict';
/**
 * 1.8.2 — Notifiche in basso a sinistra (idea di Meet, stile Tiditalk).
 *
 * • Pila di schede sopra la barra comandi, a sinistra: faccia (iniziali e
 *   colore dell'avatar, come sui riquadri) o icona, testo e orario.
 * • Vanno qui: ingressi e uscite, messaggi di chat (a chat chiusa) e
 *   registrazione avviata/fermata. Gli avvisi tecnici restano le pillole di
 *   sempre (showToast in room.js).
 * • Chat: anteprima del messaggio e campo «Rispondi…» che usa l'invio della
 *   chat già esistente (sendChatMessage in room.js), senza aprire il pannello.
 *   Più messaggi di fila della stessa persona finiscono nella stessa scheda.
 * • Le schede più vecchie si attenuano e spariscono da sole; col mouse sopra
 *   (o scrivendo una risposta) restano. Al massimo 4 (3 con l'avviso delle
 *   mani), sul telefono una sola.
 * • L'avviso «N mani alzate» di hands.js entra nella pila come scheda fissa,
 *   in fondo vicino alla barra; la colonna delle reazioni (reactbar.js) parte
 *   sopra la pila (TdtNotify.top()).
 * Agganci in room.js: peerJoined, peerLeft, chatMessage, start/stopRecording.
 */
(function () {
  const T = (s) => (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t(s) : s;
  const LIFE = { join: 6000, leave: 6000, rec: 6500, chat: 11000 };
  const FADE_AT = 0.45;             // ultima parte della vita: la scheda si attenua
  const OUT_MS = 260;
  let stack = null, list = null, tick = null, hovering = false;
  const cards = [];                 // { el, kind, peerId, remain, life, lines? }

  const isPhone = () => window.matchMedia('(max-width: 640px), (max-height: 500px) and (pointer: coarse)').matches;
  function el(tag, cls, attrs) { const n = document.createElement(tag); if (cls) n.className = cls; if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]); return n; }
  function initials(n) { return (typeof window.getInitialsPlain === 'function') ? window.getInitialsPlain(n) : (String(n || '?')[0] || '?').toUpperCase(); }
  function color(id) { try { return window.getAvatarColor(String(id || 'x')); } catch (_) { return 'var(--accent)'; } }
  function clock(ts) {
    try { return new Date(ts || Date.now()).toLocaleTimeString(window.I18n?.locale || 'it', { hour: '2-digit', minute: '2-digit' }); }
    catch (_) { return ''; }
  }
  const ICO = {
    join: '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    leave: '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>',
    chat: '<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4V16A2.5 2.5 0 0 1 4 13.5z"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    send: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>',
  };

  // ── pila ────────────────────────────────────────────────────────────────
  function ensure() {
    if (stack) return stack;
    stack = el('div', 'tdt-ntf', { 'aria-label': T('Notifiche') });
    list = el('div', 'tdt-ntf-list', { role: 'log', 'aria-live': 'polite' });
    stack.appendChild(list);
    // solo mouse vero: sul telefono un tocco «entra» e non esce più
    stack.addEventListener('mouseenter', () => { if (!window.matchMedia('(hover: hover)').matches) return; hovering = true; stack.classList.add('hover'); });
    stack.addEventListener('mouseleave', () => {
      hovering = false; stack.classList.remove('hover');
      cards.forEach(c => { c.remain = Math.max(c.remain, 2500); c.el.classList.remove('old'); });
    });
    document.body.appendChild(stack);
    adoptHands();
    return stack;
  }
  // l'avviso delle mani (hands.js lo crea nel body): scheda fissa in fondo alla pila
  function adoptHands() {
    const p = document.querySelector('body > .tdt-hands-pill');
    if (p && stack && p.parentNode !== stack) { stack.appendChild(p); layout(); }
  }

  function bottomGap() {
    const cb = document.querySelector('.controls-bar');
    const top = cb ? cb.getBoundingClientRect().top : window.innerHeight - 84;
    return Math.max(0, window.innerHeight - top);
  }
  function place() {
    if (!stack) return;
    let b = bottomGap() + 12;
    // tastiera del telefono aperta (rispondendo): la pila sale sopra la tastiera
    const vv = window.visualViewport;
    if (vv && stack.contains(document.activeElement)) {
      const kb = window.innerHeight - vv.height - vv.offsetTop;
      if (kb > 80) b = kb + 8;
    }
    // avviso «persone nascoste» (layout.js) nella stessa fascia: la pila sale sopra
    const sr = stack.getBoundingClientRect();
    document.querySelectorAll('.lv-note').forEach(n => {
      const r = n.getBoundingClientRect();
      if (r.width && r.left < sr.right && r.right > sr.left) b = Math.max(b, window.innerHeight - r.top + 8);
    });
    stack.style.bottom = Math.round(b) + 'px';
  }
  function layout() {
    place();
    try { window.TdtReact?.layoutRise?.(); } catch (_) { }
  }
  function maxCards() {
    if (isPhone()) return 1;
    const hands = stack?.querySelector('.tdt-hands-pill:not(.hidden)');
    const short = window.innerHeight < 700;
    return (hands || short) ? 3 : 4;
  }
  function busy(c) { return c.el.contains(document.activeElement) || !!c.input?.value; }
  function trim() {
    let over = cards.length - maxCards();
    for (let i = 0; i < cards.length && over > 0; i++) {
      if (busy(cards[i])) continue;
      remove(cards[i], true); i--; over--;
    }
  }

  function startTick() {
    if (tick) return;
    let last = performance.now();
    tick = setInterval(() => {
      const t = performance.now(), dt = t - last; last = t;
      cards.slice().forEach(c => {
        if (hovering || busy(c)) { c.el.classList.remove('old'); return; }
        c.remain -= dt;
        c.el.classList.toggle('old', c.remain < c.life * FADE_AT);
        if (c.remain <= 0) remove(c);
      });
      if (!cards.length) { clearInterval(tick); tick = null; }
    }, 200);
  }

  function remove(c, quick) {
    const i = cards.indexOf(c); if (i < 0) return;
    cards.splice(i, 1);
    const n = c.el;
    if (quick) { n.remove(); layout(); return; }
    n.style.height = n.offsetHeight + 'px';
    void n.offsetHeight;
    n.classList.add('out');
    setTimeout(() => { n.remove(); layout(); }, OUT_MS);
  }

  // ── scheda ──────────────────────────────────────────────────────────────
  function card(kind, { peerId, name, text, ts, icon } = {}) {
    ensure();
    const c = { kind, peerId, life: LIFE[kind] || 6000 };
    c.remain = c.life;
    const n = el('div', 'tdt-ntf-card tdt-ntf-' + kind);
    const face = el('div', 'tdt-ntf-face' + (icon ? ' ico' : ''), { 'aria-hidden': 'true' });
    if (icon) face.innerHTML = icon;
    else {
      face.textContent = initials(name);
      face.style.background = color(peerId);
      if (ICO[kind]) { const b = el('span', 'tdt-ntf-kind'); b.innerHTML = ICO[kind]; face.appendChild(b); }
    }
    const body = el('div', 'tdt-ntf-body');
    const head = el('div', 'tdt-ntf-head');
    const who = el('span', 'tdt-ntf-who');
    const time = el('time', 'tdt-ntf-time'); time.textContent = clock(ts);
    head.append(who, time);
    const txt = el('div', 'tdt-ntf-text');
    body.append(head, txt);
    const x = el('button', 'tdt-ntf-x', { type: 'button', 'aria-label': T('Chiudi la notifica') });
    x.innerHTML = ICO.close;
    x.addEventListener('click', () => remove(c));
    n.append(face, body, x);
    c.el = n; c.who = who; c.text = txt; c.time = time;
    if (name != null) { who.textContent = name; who.setAttribute('translate', 'no'); }
    if (text != null) txt.textContent = text;
    list.appendChild(n);
    cards.push(c);
    trim();
    layout();
    startTick();
    return c;
  }
  function bump(c) {
    c.remain = c.life;
    c.el.classList.remove('old');
    if (c.el !== list.lastElementChild) {
      list.appendChild(c.el);
      cards.splice(cards.indexOf(c), 1); cards.push(c);
    }
    c.el.classList.remove('pulse'); void c.el.offsetWidth; c.el.classList.add('pulse');
  }

  // ── chat ────────────────────────────────────────────────────────────────
  function addLine(c, text, own) {
    const p = el('p', 'tdt-ntf-line' + (own ? ' own' : ''), { translate: own ? 'yes' : 'no' });
    if (own) { const b = el('b'); b.textContent = T('Tu') + ': '; p.appendChild(b); }
    p.appendChild(document.createTextNode(text));
    c.text.appendChild(p);
    while (c.text.children.length > 3) c.text.firstElementChild.remove();
  }
  function send(text) {
    // invio della chat già esistente (room.js): passa dal campo della chat e
    // rimette com'era l'eventuale bozza lasciata lì
    const input = document.getElementById('chatInput');
    if (typeof window.sendChatMessage === 'function' && input) {
      const draft = input.value;
      input.value = text;
      window.sendChatMessage();
      input.value = draft;
      return true;
    }
    const s = window._tdSocket;
    if (s?.connected) { s.emit('chatMessage', { message: text }); return true; }
    return false;
  }
  function chat(msg) {
    if (!msg || typeof msg.message !== 'string') return;
    if (msg.type && msg.type !== 'text') return;
    const me = window._tdSocket?.id;
    if (msg.peerId && msg.peerId === me) return;
    const last = cards[cards.length - 1];
    const prev = cards.find(c => c.kind === 'chat' && c.peerId === msg.peerId);
    if (prev && prev === last) {
      addLine(prev, msg.message);
      prev.time.textContent = clock(msg.timestamp);
      bump(prev);
      return;
    }
    if (prev && !busy(prev)) remove(prev, true);
    else if (prev) { addLine(prev, msg.message); bump(prev); return; }
    const c = card('chat', { peerId: msg.peerId, name: msg.displayName, ts: msg.timestamp });
    addLine(c, msg.message);
    c.text.classList.add('tdt-ntf-open');
    c.text.setAttribute('role', 'button');
    c.text.tabIndex = 0;
    c.text.dataset.tip = T('Apri la chat');
    const openChat = () => { if (document.getElementById('chatPanel')?.classList.contains('hidden')) document.getElementById('btnChat')?.click(); };
    c.text.addEventListener('click', openChat);
    c.text.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openChat(); } });
    const form = el('form', 'tdt-ntf-reply');
    const input = el('input', '', { type: 'text', maxlength: '500', autocomplete: 'off', enterkeyhint: 'send', placeholder: T('Rispondi…'), 'aria-label': T('Rispondi a {0}').replace('{0}', msg.displayName || '') });
    const go = el('button', 'tdt-ntf-send', { type: 'submit', 'aria-label': T('Invia'), 'data-tip': T('Invia') });
    go.innerHTML = ICO.send;
    form.append(input, go);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value.trim(); if (!v) return;
      if (!send(v)) return;
      input.value = '';
      addLine(c, v, true);
      input.blur();
      c.remain = 2600; c.el.classList.add('sent');
    });
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();          // niente scorciatoie della stanza mentre si scrive
      if (e.key === 'Escape') { e.preventDefault(); input.blur(); remove(c); }
    });
    input.addEventListener('focus', () => { place(); setTimeout(place, 350); });
    input.addEventListener('blur', () => setTimeout(place, 50));
    c.input = input;
    c.el.querySelector('.tdt-ntf-body').appendChild(form);
    layout();
  }

  // ── ingressi, uscite, registrazione ─────────────────────────────────────
  function peer(kind, id, name) {
    if (!stack && !document.body) return false;
    card(kind, { peerId: id, name: name || '', text: kind === 'join' ? T('ora è nella riunione') : T('ha lasciato la riunione') });
    return true;
  }
  function rec(what) {
    const icon = '<span class="tdt-ntf-dot" aria-hidden="true"></span>';
    if (what === 'start') {
      const c = card('rec', { icon, text: T('Il file si salva su questo dispositivo quando la fermi') });
      c.who.textContent = T('Registrazione avviata');
      c.el.classList.add('on');
      return c;
    }
    cards.filter(x => x.kind === 'rec').forEach(x => remove(x, true)); // via «avviata»: resta solo questa
    const c = card('rec', { icon, text: T('Salvataggio in corso…') });
    c.who.textContent = T('Registrazione fermata');
    c.remain = c.life = 60000;        // resta finché il file non è pronto
    return {
      saved() { c.text.textContent = T('Salvata: download in corso'); c.life = LIFE.rec; c.remain = LIFE.rec; bump(c); },
    };
  }

  // la chat aperta mostra già i messaggi: le schede della chat se ne vanno
  function onChatPanel() {
    const open = !document.getElementById('chatPanel')?.classList.contains('hidden');
    if (open) cards.filter(c => c.kind === 'chat' && !busy(c)).forEach(c => remove(c, true));
  }

  window.TdtNotify = {
    peer, chat, rec,
    LIFE,                           // durate per tipo (ms), modificabili
    /** bordo alto della pila (px dall'alto della finestra), 0 se vuota: reactbar.js */
    top() {
      if (!stack) return 0;
      const vis = cards.length || stack.querySelector('.tdt-hands-pill:not(.hidden)');
      return vis ? stack.getBoundingClientRect().top : 0;
    },
    layout,
  };

  document.addEventListener('DOMContentLoaded', () => {
    ensure();
    // hands.js crea l'avviso delle mani solo quando serve
    new MutationObserver(adoptHands).observe(document.body, { childList: true });
    const cp = document.getElementById('chatPanel');
    if (cp) new MutationObserver(onChatPanel).observe(cp, { attributes: true, attributeFilter: ['class'] });
  });
  window.addEventListener('resize', () => { layout(); trim(); });
  window.visualViewport?.addEventListener('resize', place);
})();
