'use strict';
/**
 * 1.8.0 — Reazioni in barra (idea di Meet, stile Tiditalk).
 *
 * • Il tasto Reazioni apre una barra orizzontale sopra di sé con 9 reazioni,
 *   la scelta della tonalità della pelle (salvata nel browser, si applica alle
 *   emoji che la supportano) e un «+» con tutte le emoji (cerca + gruppi).
 * • La barra resta aperta dopo il clic; si chiude con Esc, clic fuori o di
 *   nuovo sul tasto.
 * • Ogni reazione sale lungo il bordo sinistro con il nome di chi la manda
 *   (il nome lo mette il server) e resta ~4 s in basso a destra sul riquadro
 *   di chi ha reagito. Quando reagiscono in tanti con la stessa emoji parte lo
 *   «scoppio» di prima (spawnReaction di room.js).
 * Server: 'reaction' { emoji } → 'peerReaction' { peerId, displayName, emoji }.
 */
(function () {
  const T = (s) => (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t(s) : s;
  // 9 reazioni della barra: [emoji, nome, accetta la tonalità]
  const QUICK = [
    ['👍', 'Ok', true], ['❤️', 'Cuore', false], ['😂', 'Risata', false], ['😮', 'Wow', false],
    ['👏', 'Applauso', true], ['🎉', 'Festa', false], ['🙏', 'Grazie', true], ['🚀', 'Razzo', false],
    ['👎', 'Non mi piace', true],
  ];
  const TONES = ['', '\u{1F3FB}', '\u{1F3FC}', '\u{1F3FD}', '\u{1F3FE}', '\u{1F3FF}'];
  const TONE_NAMES = ['Tonalità predefinita', 'Carnagione chiara', 'Carnagione abbastanza chiara', 'Carnagione olivastra', 'Carnagione abbastanza scura', 'Carnagione scura'];
  const GROUPS = [
    ['😀', 'Faccine ed emozioni'], ['👋', 'Persone e corpo'], ['🐻', 'Animali e natura'], ['🍔', 'Cibo e bevande'],
    ['✈️', 'Viaggi e luoghi'], ['⚽', 'Attività'], ['💡', 'Oggetti'], ['🔣', 'Simboli'], ['🏁', 'Bandiere'],
  ];
  const TONE_KEY = 'tdt_skin_tone';
  const RECENT_KEY = 'tdt_react_recent';
  const TILE_MS = 4000;          // quanto resta l'emoji sul riquadro
  const RISE_MS = 4200;          // durata della salita lungo il bordo sinistro
  const BURST_N = 3, BURST_WIN = 3000, BURST_COOL = 4000;

  let socket = null, bar = null, toneRow = null, panel = null, rise = null;
  let tone = 0;
  try { tone = Math.max(0, Math.min(5, parseInt(localStorage.getItem(TONE_KEY) || '0', 10) || 0)); } catch (_) { }
  let emojiData = null, emojiLang = null, emojiLoading = null;
  const recentByEmoji = new Map();   // base → [{ t, who }]
  const lastBurst = new Map();
  let lastSound = 0;

  // ── utilità ──────────────────────────────────────────────────────────────
  const MOD_RE = /[\u{1F3FB}-\u{1F3FF}]/gu;
  const baseOf = (e) => String(e || '').replace(MOD_RE, '');
  const withTone = (e, ok) => (ok && tone ? e.replace(/️$/, '') + TONES[tone] : e);
  const btn = () => document.getElementById('btnReactions');
  const isOpen = () => !!bar && !bar.classList.contains('hidden');
  function el(tag, cls, attrs) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  // spazio occupato in basso (barra comandi) e a sinistra (avviso mani alzate)
  function bottomGap() {
    const cb = document.querySelector('.controls-bar');
    const top = cb ? cb.getBoundingClientRect().top : window.innerHeight - 84;
    return Math.max(0, window.innerHeight - top);
  }

  // ── barra ────────────────────────────────────────────────────────────────
  function build() {
    if (bar) return;
    bar = el('div', 'tdt-rbar hidden', { role: 'toolbar', 'aria-label': T('Reazioni') });
    const row = el('div', 'tdt-rbar-row');
    QUICK.forEach(([e, name, toned]) => {
      const b = el('button', 'tdt-rbar-btn', { type: 'button', 'data-emoji': e, 'data-toned': toned ? '1' : '', 'aria-label': T(name), 'data-tip': T(name) });
      b.textContent = withTone(e, toned);
      row.appendChild(b);
    });
    row.appendChild(el('span', 'tdt-rbar-sep', { 'aria-hidden': 'true' }));
    const tb = el('button', 'tdt-rbar-btn tdt-rbar-tone', { type: 'button', 'aria-label': T('Tonalità della pelle'), 'data-tip': T('Tonalità della pelle'), 'aria-expanded': 'false' });
    row.appendChild(tb);
    const plus = el('button', 'tdt-rbar-btn tdt-rbar-plus', { type: 'button', 'aria-label': T('Tutte le emoji'), 'data-tip': T('Tutte le emoji'), 'aria-expanded': 'false' });
    plus.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
    row.appendChild(plus);
    bar.appendChild(row);

    // tonalità: riga a comparsa sopra la barra
    toneRow = el('div', 'tdt-rbar-tones hidden', { role: 'radiogroup', 'aria-label': T('Tonalità della pelle') });
    TONES.forEach((m, i) => {
      const b = el('button', 'tdt-rbar-btn', { type: 'button', role: 'radio', 'data-tone': String(i), 'aria-label': T(TONE_NAMES[i]), 'data-tip': T(TONE_NAMES[i]) });
      b.textContent = '✋' + m;
      toneRow.appendChild(b);
    });
    bar.appendChild(toneRow);
    document.body.appendChild(bar);

    bar.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const b = ev.target.closest('button'); if (!b) return;
      if (b.dataset.emoji) { send(withTone(b.dataset.emoji, !!b.dataset.toned)); pulse(b); return; }
      if (b.dataset.tone != null) { setTone(+b.dataset.tone); toneRow.classList.add('hidden'); tb.setAttribute('aria-expanded', 'false'); return; }
      if (b === tb) { const open = toneRow.classList.toggle('hidden') === false; tb.setAttribute('aria-expanded', String(open)); return; }
      if (b === plus) { togglePanel(); }
    });
    paintTone();
  }

  function pulse(b) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }

  function setTone(i) {
    tone = i;
    try { localStorage.setItem(TONE_KEY, String(i)); } catch (_) { }
    paintTone();
    if (panel && !panel.classList.contains('hidden')) renderPanel();
  }
  function paintTone() {
    if (!bar) return;
    bar.querySelectorAll('.tdt-rbar-row [data-emoji]').forEach(b => { b.textContent = withTone(b.dataset.emoji, !!b.dataset.toned); });
    bar.querySelector('.tdt-rbar-tone').textContent = '✋' + TONES[tone];
    toneRow.querySelectorAll('[data-tone]').forEach(b => { const on = +b.dataset.tone === tone; b.classList.toggle('active', on); b.setAttribute('aria-checked', String(on)); });
  }

  function place() {
    if (!isOpen()) return;
    const b = btn(); if (!b) return;
    const r = b.getBoundingClientRect();
    const w = bar.offsetWidth;
    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    bar.style.left = left + 'px';
    bar.style.bottom = (window.innerHeight - r.top + 10) + 'px';
    if (panel && !panel.classList.contains('hidden')) {
      const br = bar.getBoundingClientRect();
      const pw = panel.offsetWidth;
      panel.style.left = Math.max(8, Math.min(br.right - pw, window.innerWidth - pw - 8)) + 'px';
      panel.style.bottom = (window.innerHeight - br.top + 8) + 'px';
      panel.style.maxHeight = Math.max(200, Math.min(380, br.top - 16)) + 'px';
    }
  }

  function open() {
    build();
    bar.classList.remove('hidden');
    btn()?.classList.add('active');
    btn()?.setAttribute('aria-expanded', 'true');
    place();
  }
  function close() {
    if (!bar) return;
    bar.classList.add('hidden');
    toneRow.classList.add('hidden');
    bar.querySelector('.tdt-rbar-tone')?.setAttribute('aria-expanded', 'false');
    closePanel();
    btn()?.classList.remove('active');
    btn()?.setAttribute('aria-expanded', 'false');
  }
  function toggle() { isOpen() ? close() : open(); }

  // ── «+»: tutte le emoji ──────────────────────────────────────────────────
  function lang() { const l = (window.I18n?.locale || 'it'); return ['it', 'en', 'fr', 'de'].includes(l) ? l : 'en'; }
  function loadEmoji() {
    const l = lang();
    if (emojiData && emojiLang === l) return Promise.resolve(emojiData);
    if (emojiLoading && emojiLang === l) return emojiLoading;
    emojiLang = l;
    emojiLoading = fetch(`/assets/emoji/emoji-${l}.json`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(d => { emojiData = Array.isArray(d) ? d : []; return emojiData; })
      .catch(() => { emojiLoading = null; emojiData = null; throw new Error('load'); });
    return emojiLoading;
  }
  function buildPanel() {
    if (panel) return;
    panel = el('div', 'tdt-epick hidden', { role: 'dialog', 'aria-label': T('Tutte le emoji') });
    panel.innerHTML = `
      <div class="tdt-epick-top"><input type="search" class="tdt-epick-q" maxlength="40" autocomplete="off" spellcheck="false"></div>
      <div class="tdt-epick-tabs" role="tablist"></div>
      <div class="tdt-epick-body" tabindex="-1"></div>`;
    const q = panel.querySelector('.tdt-epick-q');
    q.placeholder = T('Cerca un’emoji');
    q.setAttribute('aria-label', T('Cerca un’emoji'));
    const tabs = panel.querySelector('.tdt-epick-tabs');
    GROUPS.forEach(([ico, name], i) => {
      const b = el('button', 'tdt-epick-tab', { type: 'button', role: 'tab', 'data-g': String(i), 'aria-label': T(name), 'data-tip': T(name) });
      b.textContent = ico;
      tabs.appendChild(b);
    });
    document.body.appendChild(panel);
    panel.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const t = ev.target.closest('.tdt-epick-tab');
      if (t) {
        q.value = ''; renderPanel();
        const sec = panel.querySelector(`.tdt-epick-sec[data-g="${t.dataset.g}"]`);
        const body = panel.querySelector('.tdt-epick-body');
        if (sec) body.scrollTop = sec.offsetTop - body.offsetTop;
        return;
      }
      const e = ev.target.closest('.tdt-epick-e');
      if (e) { send(e.dataset.e); pushRecent(e.dataset.base); pulse(e); }
    });
    let qt = null;
    q.addEventListener('input', () => { clearTimeout(qt); qt = setTimeout(renderPanel, 120); });
    q.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { const first = panel.querySelector('.tdt-epick-e'); if (first) { send(first.dataset.e); pushRecent(first.dataset.base); } }
    });
    panel.querySelector('.tdt-epick-body').addEventListener('scroll', syncTabs, { passive: true });
  }
  function syncTabs() {
    const body = panel.querySelector('.tdt-epick-body');
    let cur = 0;
    panel.querySelectorAll('.tdt-epick-sec[data-g]').forEach(s => { if (s.offsetTop - body.offsetTop <= body.scrollTop + 8) cur = +s.dataset.g; });
    panel.querySelectorAll('.tdt-epick-tab').forEach(t => t.classList.toggle('active', +t.dataset.g === cur));
  }
  function recent() { try { const r = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(r) ? r.filter(x => typeof x === 'string').slice(0, 16) : []; } catch (_) { return []; } }
  function pushRecent(base) {
    if (!base) return;
    const r = recent().filter(x => x !== base); r.unshift(base);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(r.slice(0, 16))); } catch (_) { }
  }
  function cell(row) {
    const shown = (tone && row[4]) ? row[4][tone - 1] : row[0];
    const b = el('button', 'tdt-epick-e', { type: 'button', 'data-e': shown, 'data-base': row[0], 'aria-label': row[2] || shown, title: row[2] || '' });
    b.setAttribute('translate', 'no');
    b.textContent = shown;
    return b;
  }
  function renderPanel() {
    const body = panel.querySelector('.tdt-epick-body');
    if (!emojiData) { body.innerHTML = `<div class="tdt-epick-msg">${T('Caricamento…')}</div>`; return; }
    const q = panel.querySelector('.tdt-epick-q').value.trim().toLowerCase();
    body.textContent = '';
    const frag = document.createDocumentFragment();
    if (q) {
      const words = q.split(/\s+/);
      const hits = emojiData.filter(r => { const hay = (r[2] + ' ' + r[3]).toLowerCase(); return words.every(w => hay.includes(w)); }).slice(0, 240);
      const grid = el('div', 'tdt-epick-grid');
      hits.forEach(r => grid.appendChild(cell(r)));
      frag.appendChild(hits.length ? grid : Object.assign(el('div', 'tdt-epick-msg'), { textContent: T('Nessuna emoji trovata') }));
      panel.querySelector('.tdt-epick-tabs').classList.add('dim');
    } else {
      panel.querySelector('.tdt-epick-tabs').classList.remove('dim');
      const rec = recent();
      if (rec.length) {
        const byBase = new Map(emojiData.map(r => [r[0], r]));
        const sec = el('div', 'tdt-epick-sec');
        sec.appendChild(Object.assign(el('div', 'tdt-epick-h'), { textContent: T('Usate di recente') }));
        const grid = el('div', 'tdt-epick-grid');
        rec.forEach(b => { const r = byBase.get(b); if (r) grid.appendChild(cell(r)); });
        sec.appendChild(grid); frag.appendChild(sec);
      }
      GROUPS.forEach(([, name], g) => {
        const sec = el('div', 'tdt-epick-sec', { 'data-g': String(g) });
        sec.appendChild(Object.assign(el('div', 'tdt-epick-h'), { textContent: T(name) }));
        const grid = el('div', 'tdt-epick-grid');
        for (const r of emojiData) if (r[1] === g) grid.appendChild(cell(r));
        sec.appendChild(grid); frag.appendChild(sec);
      });
    }
    body.appendChild(frag);
    if (!q) syncTabs();
  }
  function togglePanel() {
    buildPanel();
    if (!panel.classList.contains('hidden')) { closePanel(); return; }
    panel.classList.remove('hidden');
    bar.querySelector('.tdt-rbar-plus')?.setAttribute('aria-expanded', 'true');
    place();
    renderPanel();
    loadEmoji().then(() => { if (!panel.classList.contains('hidden')) { renderPanel(); place(); } })
      .catch(() => { const b = panel.querySelector('.tdt-epick-body'); if (b) b.innerHTML = `<div class="tdt-epick-msg">${T('Emoji non disponibili, riprova più tardi')}</div>`; });
    // sul telefono la tastiera coprirebbe metà delle emoji: niente focus automatico
    if (!window.matchMedia('(hover: none)').matches) setTimeout(() => panel.querySelector('.tdt-epick-q')?.focus(), 30);
  }
  function closePanel() {
    if (!panel) return;
    panel.classList.add('hidden');
    bar?.querySelector('.tdt-rbar-plus')?.setAttribute('aria-expanded', 'false');
  }

  // ── invio e visualizzazione ──────────────────────────────────────────────
  function send(emoji) {
    const s = socket || window._tdSocket;
    if (!s || !s.connected) return;
    s.emit('reaction', { emoji });
    show({ peerId: 'local', name: T('Tu'), emoji, self: true });
  }

  function ensureRise() {
    if (rise) return rise;
    rise = el('div', 'tdt-rise', { 'aria-hidden': 'true' });
    document.body.appendChild(rise);
    return rise;
  }
  function layoutRise() {
    if (!rise) return;
    const hands = document.querySelector('.tdt-hands-pill:not(.hidden)');
    const extra = hands ? hands.getBoundingClientRect().height + 10 : 0;
    rise.style.bottom = (bottomGap() + 12 + extra) + 'px';
  }

  function riseItem(name, emoji, self) {
    const r = ensureRise(); layoutRise();
    while (r.children.length >= 14) r.firstElementChild.remove();
    const it = el('div', 'tdt-rise-item' + (self ? ' self' : ''));
    const e = el('span', 'tdt-rise-emoji'); e.textContent = emoji;
    const n = el('span', 'tdt-rise-name'); n.textContent = name; n.setAttribute('translate', self ? 'yes' : 'no');
    it.append(e, n);
    // un po' di varietà: non salgono tutte sullo stesso binario
    it.style.setProperty('--dx', (Math.round(Math.random() * 26) - 4) + 'px');
    it.style.setProperty('--wob', (Math.random() < .5 ? -1 : 1) * (6 + Math.round(Math.random() * 8)) + 'px');
    it.style.animationDuration = (RISE_MS + Math.round(Math.random() * 600)) + 'ms';
    r.appendChild(it);
    it.addEventListener('animationend', () => it.remove(), { once: true });
    setTimeout(() => it.remove(), RISE_MS + 1500);
  }

  function tileOf(peerId) {
    if (peerId === 'local') return document.querySelector('.video-tile.local');
    return document.querySelector(`.video-tile[data-peer-id="${CSS.escape(peerId)}"]`);
  }
  function tileBadge(peerId, emoji) {
    const t = tileOf(peerId); if (!t) return;
    let b = t.querySelector(':scope > .tdt-tile-react');
    if (!b) { b = el('div', 'tdt-tile-react', { 'aria-hidden': 'true' }); t.appendChild(b); }
    else if (b !== t.lastElementChild) t.appendChild(b);   // dopo il badge del muto: il CSS lo sposta a sinistra
    b.textContent = emoji;
    b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
    clearTimeout(b._t);
    b._t = setTimeout(() => { b.classList.remove('on'); }, TILE_MS);
  }

  function maybeBurst(emoji, who) {
    const base = baseOf(emoji), now = Date.now();
    const list = (recentByEmoji.get(base) || []).filter(x => now - x.t < BURST_WIN);
    list.push({ t: now, who });
    recentByEmoji.set(base, list);
    const people = new Set(list.map(x => x.who)).size;
    if (people >= BURST_N && now - (lastBurst.get(base) || 0) > BURST_COOL) {
      lastBurst.set(base, now);
      try { window.spawnReaction?.(base); } catch (_) { }   // lo scoppio di prima (con il suo suono)
      return true;
    }
    return false;
  }

  function show({ peerId, name, emoji, self }) {
    riseItem(name, emoji, self);
    tileBadge(peerId, emoji);
    const burst = maybeBurst(emoji, peerId);
    // suono della reazione, senza raffiche quando si clicca di seguito
    const now = Date.now();
    if (!burst && now - lastSound > 700) { lastSound = now; try { window.sounds?.reaction(baseOf(emoji)); } catch (_) { } }
  }

  // ── collegamento ─────────────────────────────────────────────────────────
  function bindUi() {
    const b = btn(); if (!b || b._tdtRbar) return;
    b._tdtRbar = true;
    b.setAttribute('aria-haspopup', 'true');
    b.setAttribute('aria-expanded', 'false');
    b.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
    document.addEventListener('click', (e) => {
      if (!isOpen()) return;
      if (e.target.closest('.tdt-rbar, .tdt-epick, #btnReactions')) return;
      close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !isOpen()) return;
      e.preventDefault(); e.stopPropagation();
      if (panel && !panel.classList.contains('hidden') && document.activeElement?.closest('.tdt-epick')) { closePanel(); btn()?.focus(); return; }
      close(); btn()?.focus();
    }, true);
    window.addEventListener('resize', () => { place(); layoutRise(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindUi); else bindUi();

  window.TdtReact = {
    bind(sock) {
      socket = sock;
      sock.on('peerReaction', ({ peerId, displayName, emoji } = {}) => {
        if (!emoji || peerId === sock.id) return;     // la propria è già partita al clic
        show({ peerId, name: String(displayName || '').slice(0, 50) || T('Partecipante'), emoji: String(emoji).slice(0, 32) });
      });
    },
    open, close, isOpen, layoutRise,
    get tone() { return tone; },
  };
})();
