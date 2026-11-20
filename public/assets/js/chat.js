'use strict';
/**
 * 1.8.2 — Chat: messaggi fissati, reazioni, risposta con citazione, link
 * cliccabili e «sta scrivendo…» (idea 07 di Meet, fatta alla Tiditalk).
 *
 * • In cima alla chat fino a 3 messaggi fissati (li vede anche chi entra
 *   dopo). Fissano e sbloccano solo gli organizzatori: il server lo controlla.
 * • Passando sopra un messaggio (sul telefono: tocco sul fumetto) compare una
 *   barretta con 5 reazioni rapide (la quinta è 🙏), Rispondi e, per gli
 *   organizzatori, Fissa in cima / Sblocca.
 * • Sotto il fumetto le reazioni col conteggio (👍 3): toccarne una aggiunge o
 *   toglie la propria; il suggerimento dice chi ha reagito.
 * • Rispondi: sopra il campo compare il messaggio citato; il messaggio inviato
 *   ne mostra l'anteprima e un clic porta al messaggio originale.
 * • Link: solo http/https (e www.), aperti in una scheda nuova con
 *   rel="noopener noreferrer". Il testo resta testo: niente innerHTML.
 * • «Marco sta scrivendo…» sopra il campo, con limiti di frequenza.
 * • 1.9.0 — sui propri messaggi «⋯» → Modifica (il testo torna nel campo,
 *   Invio salva, Esc annulla; sotto compare «modificato») ed Elimina per
 *   tutti (secondo tocco per confermare; resta «Messaggio eliminato»).
 *   Il server controlla che il messaggio sia davvero tuo, anche dopo un
 *   ricaricamento della pagina (snapshot.mine).
 *
 * Agganci in room.js: bind(socket), load(res.chat), decorate(div, msg) in
 * appendChatMessage, outgoing(payload) in sendChatMessage.
 * Server: chatReact · chatPin · chatTyping · chatEdit · chatDelete (server/chat.js).
 */
(function () {
  const T = (s) => (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t(s) : s;
  const fmt = (s, ...a) => T(s).replace(/\{(\d+)\}/g, (m, i) => (a[i] != null ? a[i] : m));
  // 5 reazioni rapide: [emoji, nome]
  const QUICK = [['👍', 'Ok'], ['❤️', 'Cuore'], ['😂', 'Risata'], ['😮', 'Wow'], ['🙏', 'Grazie']];
  const MAX_PINS = 3;
  const TYPING_EVERY = 3000;   // ogni quanto si ripete «sto scrivendo» mentre si scrive
  const TYPING_IDLE = 4000;    // fermo da 4 s → non sto più scrivendo
  const TYPING_TTL = 6500;     // chi non si fa risentire sparisce dalla riga
  const QUOTE_MAX = 140;

  let socket = null;
  let pins = [];
  const reacts = new Map();    // id messaggio → [{ e, n, mine, who }]
  const typers = new Map();    // peerId → { name, until }
  let reply = null;            // { id, name, text } del messaggio a cui si risponde
  let editing = null;          // 1.9.0: { id, draft } del messaggio che sto modificando
  const mine = new Set();      // 1.9.0: id dei miei messaggi (modificabili)
  let pinsEl = null, replyEl = null, editEl = null, typingEl = null, typingTick = null;
  let myTypingAt = 0, myIdleT = null;

  const isHost = () => !!window.__isHostRole;
  const myId = () => socket && socket.id;
  const list = () => document.getElementById('chatMessages');
  const input = () => document.getElementById('chatInput');
  const chatIsOpen = () => { const p = document.getElementById('chatPanel'); return !!p && !p.classList.contains('hidden'); };
  const toast = (m, d) => { if (typeof window.showToast === 'function') window.showToast(T(m), d || 2800); };
  function el(tag, cls, attrs) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function snippet(text, max) {
    const cps = Array.from(String(text || '').replace(/\s+/g, ' ').trim());
    return cps.length > max ? cps.slice(0, max - 1).join('').trimEnd() + '…' : cps.join('');
  }
  const firstName = (n) => { const s = String(n || '').trim(); const f = s.split(/\s+/)[0] || s; return f.length > 18 ? f.slice(0, 17) + '…' : f; };
  const msgEl = (id) => { const c = list(); if (!c || !id) return null; for (const m of c.querySelectorAll('.chat-msg[data-msg-id]')) if (m.dataset.msgId === id) return m; return null; };
  const nearBottom = () => { const c = list(); return !c || c.scrollHeight - c.scrollTop - c.clientHeight < 40; };
  const keepBottom = (was) => { if (was) { const c = list(); if (c) c.scrollTop = c.scrollHeight; } };

  // ── Icone (stesso tratto delle altre: 24×24, linea 1.8) ──────────────────
  const SVG = (d) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICON = {
    reply: SVG('<path d="M9.5 7L4.5 12l5 5"/><path d="M5 12h9a5.5 5.5 0 0 1 5.5 5.5V19"/>'),
    pin: SVG('<path d="M9 3.5h6l-1 5.5 3.5 3.5v1.5h-11V12.5L10 9z"/><path d="M12 14v6.5"/>'),
    unpin: SVG('<path d="M9 3.5h6l-1 5.5 3.5 3.5v1.5h-11V12.5L10 9z"/><path d="M12 14v6.5"/><path d="M4 4l16 16"/>'),
    close: SVG('<path d="M7 7l10 10M17 7L7 17"/>'),
    more: SVG('<circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/>'),
    back: SVG('<path d="M14.5 6.5L9 12l5.5 5.5"/>'),
    edit: SVG('<path d="M4.5 19.5l1-4L15.8 5.2a2 2 0 0 1 2.9 0l.1.1a2 2 0 0 1 0 2.9L8.5 18.5z"/><path d="M13.5 7.5l3 3"/>'),
    trash: SVG('<path d="M4.5 7h15"/><path d="M9.5 7V4.8h5V7"/><path d="M6.5 7l1 12.5h9l1-12.5"/><path d="M10.2 10.8v5.4M13.8 10.8v5.4"/>'),
  };

  // ── Link sicuri ──────────────────────────────────────────────────────────
  // Solo http/https (www. diventa https). Il resto resta testo: si costruisce
  // il DOM con nodi di testo e <a>, mai con innerHTML.
  const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
  function safeHref(raw) {
    try {
      const u = new URL(/^www\./i.test(raw) ? 'https://' + raw : raw);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      if (!u.hostname || u.username || u.password) return null;
      return u.href;
    } catch (_) { return null; }
  }
  function trimTail(s) {
    // punteggiatura finale e parentesi chiuse in più non fanno parte del link
    let out = s;
    for (;;) {
      const last = out.slice(-1);
      if (/[.,;:!?'"»]/.test(last)) { out = out.slice(0, -1); continue; }
      if (last === ')' && (out.match(/\(/g) || []).length < (out.match(/\)/g) || []).length) { out = out.slice(0, -1); continue; }
      if (last === ']' && !out.includes('[')) { out = out.slice(0, -1); continue; }
      break;
    }
    return out;
  }
  function linkify(target, text) {
    target.textContent = '';
    const s = String(text == null ? '' : text);
    let last = 0, m;
    URL_RE.lastIndex = 0;
    while ((m = URL_RE.exec(s))) {
      const raw = trimTail(m[0]);
      const href = raw.length > 4 ? safeHref(raw) : null;
      if (!href) continue;
      if (m.index > last) target.appendChild(document.createTextNode(s.slice(last, m.index)));
      const a = el('a', 'tc-link', { href, target: '_blank', rel: 'noopener noreferrer nofollow', translate: 'no' });
      a.textContent = raw.length > 64 ? raw.slice(0, 61) + '…' : raw;
      if (raw.length > 64) a.title = raw;
      target.appendChild(a);
      last = m.index + raw.length;
      URL_RE.lastIndex = last;
    }
    if (last < s.length) target.appendChild(document.createTextNode(s.slice(last)));
  }

  // ── Reazioni sotto il messaggio ──────────────────────────────────────────
  function whoText(r) {
    const names = (r.mine ? [T('Tu')] : []).concat(r.who || []);
    const rest = r.n - names.length;
    return names.join(', ') + (rest > 0 ? ' +' + rest : '');
  }
  function paintReacts(div) {
    const id = div.dataset.msgId;
    const data = reacts.get(id) || [];
    let row = div.querySelector(':scope > .tc-reacts');
    if (!data.length) { if (row) row.remove(); return; }
    if (!row) { row = el('div', 'tc-reacts', { 'data-i18n-skip': '' }); div.appendChild(row); }
    row.textContent = '';
    for (const r of data) {
      const b = el('button', 'tc-chip' + (r.mine ? ' mine' : ''), { type: 'button', 'aria-pressed': r.mine ? 'true' : 'false' });
      const tip = r.e + ' ' + whoText(r);
      b.dataset.tip = tip;
      b.setAttribute('aria-label', tip);
      const e = el('span', 'tc-chip-e'); e.textContent = r.e;
      const n = el('span', 'tc-chip-n'); n.textContent = r.n;
      b.append(e, n);
      b.addEventListener('click', () => react(id, r.e));
      row.appendChild(b);
    }
  }
  function react(msgId, emoji) {
    if (!socket || !msgId) return;
    socket.emit('chatReact', { msgId, emoji }, (res) => { if (res && res.error) toast(res.error); });
  }

  // ── Barretta di azioni sul messaggio ─────────────────────────────────────
  function buildTools(div, msg) {
    const bar = el('div', 'tc-tools', { role: 'toolbar', 'aria-label': T('Azioni sul messaggio') });
    for (const [e, name] of QUICK) {
      const b = el('button', 'tc-tool tc-tool-e', { type: 'button', 'data-tip': name, 'aria-label': name });
      b.textContent = e;
      b.addEventListener('click', (ev) => { ev.stopPropagation(); react(msg.id, e); closeTools(); });
      bar.appendChild(b);
    }
    bar.appendChild(el('span', 'tc-tools-sep', { 'aria-hidden': 'true' }));
    const rb = el('button', 'tc-tool', { type: 'button', 'data-tip': 'Rispondi', 'aria-label': 'Rispondi' });
    rb.innerHTML = ICON.reply;
    rb.addEventListener('click', (ev) => { ev.stopPropagation(); startReply(msg); closeTools(); });
    bar.appendChild(rb);
    const pb = el('button', 'tc-tool tc-tool-pin', { type: 'button' });
    pb.addEventListener('click', (ev) => { ev.stopPropagation(); togglePin(msg.id); closeTools(); });
    bar.appendChild(pb);
    paintPinBtn(div, pb);
    if (mine.has(msg.id)) addOwnTools(div, bar);
    return bar;
  }
  // 1.9.0 — «⋯» sui miei messaggi: seconda pagina della barretta con Modifica ed Elimina per tutti
  function addOwnTools(div, bar) {
    if (bar.querySelector('.tc-tool-more')) return;
    const mb = el('button', 'tc-tool tc-tool-more', { type: 'button', 'data-tip': 'Altre azioni', 'aria-label': 'Altre azioni', 'aria-expanded': 'false' });
    mb.innerHTML = ICON.more;
    mb.addEventListener('click', (ev) => { ev.stopPropagation(); ownPage(bar, true); });
    bar.appendChild(mb);
    const page = el('div', 'tc-own', { role: 'group' });
    const back = el('button', 'tc-tool', { type: 'button', 'data-tip': 'Indietro', 'aria-label': 'Indietro' });
    back.innerHTML = ICON.back;
    back.addEventListener('click', (ev) => { ev.stopPropagation(); ownPage(bar, false); });
    const eb = el('button', 'tc-own-btn', { type: 'button' });
    eb.innerHTML = ICON.edit + '<span>' + T('Modifica') + '</span>';
    eb.addEventListener('click', (ev) => { ev.stopPropagation(); ownPage(bar, false); closeTools(); startEdit(div._tcMsg); });
    const db = el('button', 'tc-own-btn tc-own-del', { type: 'button' });
    const paintDel = (armed) => { db.classList.toggle('armed', armed); db.innerHTML = ICON.trash + '<span>' + T(armed ? 'Sì, elimina per tutti' : 'Elimina per tutti') + '</span>'; };
    paintDel(false);
    let armT = null;
    db.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (!db.classList.contains('armed')) { paintDel(true); clearTimeout(armT); armT = setTimeout(() => paintDel(false), 4000); return; }
      clearTimeout(armT); paintDel(false); ownPage(bar, false); closeTools();
      remove(div.dataset.msgId);
    });
    bar._tcResetDel = () => { clearTimeout(armT); paintDel(false); };
    page.append(back, eb, db);
    bar.appendChild(page);
  }
  function ownPage(bar, on) {
    bar.classList.toggle('tc-own-on', on);
    const mb = bar.querySelector('.tc-tool-more'); if (mb) mb.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (!on && bar._tcResetDel) bar._tcResetDel();
    const f = on ? bar.querySelector('.tc-own-btn') : bar.querySelector('.tc-tool-more');
    if (f && bar.contains(document.activeElement)) f.focus();
  }
  function paintPinBtn(div, pb) {
    pb = pb || div.querySelector('.tc-tool-pin');
    if (!pb) return;
    const on = div.classList.contains('tc-pinned');
    const label = on ? 'Sblocca' : 'Fissa in cima';
    pb.innerHTML = on ? ICON.unpin : ICON.pin;
    pb.dataset.tip = label;
    pb.setAttribute('aria-label', label);
  }
  function closeTools(except) {
    document.querySelectorAll('.chat-msg.tc-open').forEach(m => { if (m !== except) m.classList.remove('tc-open'); });
    document.querySelectorAll('.tc-tools.tc-own-on').forEach(b => { if (!except || !except.contains(b)) ownPage(b, false); });
  }

  // ── 1.9.0: modifica ed elimina dei miei messaggi ─────────────────────────
  function startEdit(msg) {
    if (!msg || !mine.has(msg.id)) return;
    const i = input(); if (!i) return;
    if (reply) cancelReply();
    if (!editing) editing = { id: msg.id, draft: i.value };
    else editing.id = msg.id;
    paintEdit(msg);
    i.value = msg.message;
    i.focus();
    try { i.setSelectionRange(i.value.length, i.value.length); } catch (_) { }
    i.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function cancelEdit(keepText) {
    if (!editing) return;
    const i = input();
    const draft = editing.draft;
    editing = null;
    paintEdit(null);
    if (i && !keepText) { i.value = draft || ''; i.dispatchEvent(new Event('input', { bubbles: true })); }
  }
  function paintEdit(msg) {
    if (!editEl) return;
    editEl.classList.toggle('hidden', !editing);
    if (!editing || !msg) return;
    editEl.querySelector('.tc-replybar-text').textContent = snippet(msg.message, QUOTE_MAX);
  }
  /** Da room.js (sendChatMessage): se sto modificando, salva al posto di inviare. */
  function submitEdit(text) {
    if (!editing) return false;
    const id = editing.id;
    const m = msgEl(id), cur = m && m._tcMsg;
    if (!socket || !cur || cur.deleted) { cancelEdit(true); return false; }
    const draft = editing.draft;
    editing = null; paintEdit(null);
    stopMyTyping();
    const i = input();
    if (text !== cur.message) {
      socket.emit('chatEdit', { msgId: id, text }, (res) => { if (res && res.error) toast(res.error, 3500); });
    }
    if (i) { i.value = draft || ''; i.dispatchEvent(new Event('input', { bubbles: true })); }
    return true;
  }
  function remove(msgId) {
    if (!socket || !msgId) return;
    if (editing && editing.id === msgId) cancelEdit();
    socket.emit('chatDelete', { msgId }, (res) => { if (res && res.error) toast(res.error, 3500); });
  }
  function paintEdited(div, msg) {
    const meta = div.querySelector('.msg-meta'); if (!meta) return;
    let b = meta.querySelector('.tc-edited');
    if (!msg.edited || msg.deleted) { if (b) b.remove(); return; }
    if (!b) { b = el('span', 'tc-edited'); meta.appendChild(b); }
    b.textContent = T('modificato');
    try { b.dataset.tip = fmt('Modificato alle {0}', new Date(msg.edited).toLocaleTimeString(window.I18n?.locale || undefined, { hour: '2-digit', minute: '2-digit' })); } catch (_) { }
  }
  function paintDeleted(div) {
    div.classList.add('tc-deleted');
    div.classList.remove('tc-pinned', 'tc-open');
    div.querySelectorAll(':scope .tc-tools, :scope > .tc-reacts, :scope > .tc-quote, :scope .msg-tts-btn').forEach(n => n.remove());
    const bubble = div.querySelector('.msg-bubble');
    if (bubble) {
      bubble.textContent = '';
      bubble.appendChild(el('span', 'tc-deleted-ico', { 'aria-hidden': 'true' })).innerHTML = ICON.trash;
      bubble.appendChild(document.createTextNode(T('Messaggio eliminato')));
    }
    paintEdited(div, { deleted: true });
  }
  function quotesOf(id) {
    return Array.from(document.querySelectorAll('#chatMessages .tc-quote[data-quote-id]')).filter(q => q.dataset.quoteId === id);
  }

  // ── Risposta ─────────────────────────────────────────────────────────────
  function startReply(msg) {
    if (editing) cancelEdit();
    reply = { id: msg.id, name: msg.peerId === myId() ? T('Tu') : msg.displayName, text: snippet(msg.message, QUOTE_MAX) };
    paintReply();
    const i = input(); if (i) i.focus();
  }
  function cancelReply() { reply = null; paintReply(); }
  function paintReply() {
    if (!replyEl) return;
    replyEl.classList.toggle('hidden', !reply);
    if (!reply) return;
    replyEl.querySelector('.tc-replybar-who').textContent = fmt('Rispondi a {0}', reply.name);
    replyEl.querySelector('.tc-replybar-text').textContent = reply.text;
  }
  function quoteBlock(q) {
    const b = el('button', 'tc-quote' + (q.deleted ? ' tc-quote-gone' : ''), { type: 'button', 'data-i18n-skip': '', translate: 'no', 'data-quote-id': q.id });
    const who = el('span', 'tc-quote-who'); who.textContent = q.peerId === myId() ? T('Tu') : q.name;
    const txt = el('span', 'tc-quote-text'); txt.textContent = q.deleted ? T('Messaggio eliminato') : q.text;
    b.append(who, txt);
    b.setAttribute('aria-label', T('Vai al messaggio') + ': ' + (q.peerId === myId() ? T('Tu') : q.name));
    b.addEventListener('click', (ev) => { ev.stopPropagation(); jumpTo(q.id); });
    return b;
  }
  function jumpTo(id) {
    const m = msgEl(id);
    if (!m) { toast('Il messaggio non è più nella chat'); return; }
    m.scrollIntoView({ block: 'center', behavior: 'smooth' });
    m.classList.remove('tc-flash');
    void m.offsetWidth;
    m.classList.add('tc-flash');
    setTimeout(() => m.classList.remove('tc-flash'), 1800);
  }

  // ── Messaggi fissati ─────────────────────────────────────────────────────
  function togglePin(msgId) {
    if (!socket) return;
    const on = pins.some(p => p.id === msgId);
    if (!on && pins.length >= MAX_PINS) { toast('Puoi fissare al massimo 3 messaggi: sbloccane uno', 3500); return; }
    socket.emit('chatPin', { msgId, pinned: !on }, (res) => { if (res && res.error) toast(res.error, 3500); });
  }
  function paintPins() {
    if (!pinsEl) return;
    pinsEl.classList.toggle('hidden', !pins.length);
    const box = pinsEl.querySelector('.tc-pins-list');
    box.textContent = '';
    for (const p of pins) {
      const row = el('div', 'tc-pin');
      const ico = el('span', 'tc-pin-ico', { 'aria-hidden': 'true' }); ico.innerHTML = ICON.pin;
      const body = el('div', 'tc-pin-body', { role: 'button', tabindex: '0', 'data-i18n-skip': '', translate: 'no' });
      body.dataset.tip = fmt('Fissato da {0}', p.by || '');
      const who = el('span', 'tc-pin-who'); who.textContent = p.peerId === myId() ? T('Tu') : p.name;
      const txt = el('span', 'tc-pin-text'); linkify(txt, p.text);
      body.append(who, txt);
      body.setAttribute('aria-label', T('Vai al messaggio') + ': ' + who.textContent);
      body.addEventListener('click', (ev) => { if (ev.target.closest('a')) return; jumpTo(p.id); });
      body.addEventListener('keydown', (ev) => { if ((ev.key === 'Enter' || ev.key === ' ') && !ev.target.closest('a')) { ev.preventDefault(); jumpTo(p.id); } });
      row.append(ico, body);
      if (isHost()) {
        const x = el('button', 'tc-pin-x btn-icon', { type: 'button', 'data-tip': 'Sblocca', 'aria-label': 'Sblocca' });
        x.innerHTML = ICON.close;
        x.addEventListener('click', () => togglePin(p.id));
        row.appendChild(x);
      }
      box.appendChild(row);
    }
    // segno sul messaggio nella lista
    const ids = new Set(pins.map(p => p.id));
    document.querySelectorAll('#chatMessages .chat-msg[data-msg-id]').forEach(m => {
      const on = ids.has(m.dataset.msgId);
      if (m.classList.contains('tc-pinned') !== on) { m.classList.toggle('tc-pinned', on); paintPinBtn(m); }
    });
  }

  // ── «sta scrivendo…» ─────────────────────────────────────────────────────
  function paintTyping() {
    if (!typingEl) return;
    const now = Date.now();
    for (const [id, t] of typers) if (t.until < now || id === myId()) typers.delete(id);
    const names = Array.from(typers.values()).map(t => firstName(t.name));
    let txt = '';
    if (names.length === 1) txt = fmt('{0} sta scrivendo…', names[0]);
    else if (names.length === 2) txt = fmt('{0} e {1} stanno scrivendo…', names[0], names[1]);
    else if (names.length > 2) txt = fmt('{0} persone stanno scrivendo…', names.length);
    typingEl.querySelector('.tc-typing-text').textContent = txt;
    typingEl.classList.toggle('on', !!txt);
    if (!typers.size && typingTick) { clearInterval(typingTick); typingTick = null; }
    else if (typers.size && !typingTick) typingTick = setInterval(paintTyping, 1000);
  }
  function myTyping() {
    const i = input(); if (!socket || !i) return;
    clearTimeout(myIdleT);
    if (!i.value.trim()) { stopMyTyping(); return; }
    const now = Date.now();
    if (now - myTypingAt > TYPING_EVERY) { myTypingAt = now; socket.emit('chatTyping', { on: true }); }
    myIdleT = setTimeout(stopMyTyping, TYPING_IDLE);
  }
  function stopMyTyping() {
    clearTimeout(myIdleT);
    if (!myTypingAt) return;
    myTypingAt = 0;
    socket && socket.emit('chatTyping', { on: false });
  }

  // ── Struttura nel pannello della chat ────────────────────────────────────
  function mount() {
    const panel = document.getElementById('chatPanel');
    const msgs = list();
    const area = panel && panel.querySelector('.chat-input-area');
    if (!panel || !msgs || !area || pinsEl) return;
    pinsEl = el('section', 'tc-pins hidden', { 'aria-label': T('Messaggi fissati') });
    pinsEl.appendChild(el('div', 'tc-pins-list'));
    panel.insertBefore(pinsEl, msgs);

    typingEl = el('div', 'tc-typing', { 'aria-live': 'polite', 'data-i18n-skip': '' });
    typingEl.innerHTML = '<span class="tc-typing-pill"><span class="tc-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="tc-typing-text" translate="no"></span></span>';
    replyEl = el('div', 'tc-replybar hidden', { 'data-i18n-skip': '', translate: 'no' });
    replyEl.innerHTML = `<span class="tc-replybar-ico" aria-hidden="true">${ICON.reply}</span><span class="tc-replybar-body"><span class="tc-replybar-who"></span><span class="tc-replybar-text"></span></span>`;
    const x = el('button', 'btn-icon tc-replybar-x', { type: 'button' });
    x.dataset.tip = T('Annulla risposta'); x.setAttribute('aria-label', T('Annulla risposta'));
    x.innerHTML = ICON.close;
    x.addEventListener('click', () => { cancelReply(); const i = input(); if (i) i.focus(); });
    replyEl.appendChild(x);
    // 1.9.0: «Modifica messaggio» sopra il campo (stesso aspetto della risposta)
    editEl = el('div', 'tc-replybar tc-editbar hidden', { 'data-i18n-skip': '', translate: 'no' });
    editEl.innerHTML = `<span class="tc-replybar-ico" aria-hidden="true">${ICON.edit}</span><span class="tc-replybar-body"><span class="tc-replybar-who"></span><span class="tc-replybar-text"></span></span>`;
    editEl.querySelector('.tc-replybar-who').textContent = T('Modifica messaggio');
    const ex = el('button', 'btn-icon tc-replybar-x', { type: 'button' });
    ex.dataset.tip = T('Annulla modifica'); ex.setAttribute('aria-label', T('Annulla modifica'));
    ex.innerHTML = ICON.close;
    ex.addEventListener('click', () => { cancelEdit(); const i = input(); if (i) i.focus(); });
    editEl.appendChild(ex);
    panel.insertBefore(typingEl, area);
    panel.insertBefore(replyEl, area);
    panel.insertBefore(editEl, area);

    const i = input();
    if (i) {
      i.addEventListener('input', myTyping);
      i.addEventListener('blur', () => { if (!i.value.trim()) stopMyTyping(); });
      i.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && editing) { e.preventDefault(); e.stopPropagation(); cancelEdit(); return; }
        if (e.key === 'Escape' && reply) { e.preventDefault(); e.stopPropagation(); cancelReply(); }
        // freccia su a campo vuoto: modifica l'ultimo mio messaggio (come Slack / Teams)
        if (e.key === 'ArrowUp' && !editing && !i.value && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
          const own = Array.from(document.querySelectorAll('#chatMessages .chat-msg[data-msg-id]')).reverse().find(m => mine.has(m.dataset.msgId) && m._tcMsg && !m._tcMsg.deleted);
          if (own) { e.preventDefault(); startEdit(own._tcMsg); }
        }
      });
    }
    // telefono: tocco sul fumetto = barretta delle azioni; tocco altrove la chiude
    msgs.addEventListener('click', (e) => {
      if (e.target.closest('a, button, .tc-tools')) return;
      const m = e.target.closest('.chat-msg[data-msg-id]');
      const touch = e.pointerType ? e.pointerType !== 'mouse' : !!(window.matchMedia && matchMedia('(hover: none)').matches);
      if (m && touch && e.target.closest('.msg-bubble')) { closeTools(m); m.classList.toggle('tc-open'); }
      else closeTools();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTools(); });
  }

  // ── API per room.js ──────────────────────────────────────────────────────
  function decorate(div, msg) {
    if (!div || !msg || !msg.id || msg.type === 'system') return;
    mount();
    div.dataset.msgId = msg.id;
    div._tcMsg = msg;
    if (msg.deleted) { paintDeleted(div); return; }
    if (msg.peerId && msg.peerId === myId()) mine.add(msg.id);
    const bubble = div.querySelector('.msg-bubble');
    if (bubble) linkify(bubble, msg.message);
    paintEdited(div, msg);
    if (msg.replyTo && msg.replyTo.id) div.insertBefore(quoteBlock(msg.replyTo), div.querySelector('.msg-bubble-wrap'));
    if (pins.some(p => p.id === msg.id)) div.classList.add('tc-pinned');
    (div.querySelector('.msg-bubble-wrap') || div).appendChild(buildTools(div, msg));
    paintReacts(div);
    // chi ha appena scritto non sta più scrivendo
    if (typers.delete(msg.peerId)) paintTyping();
  }
  function load(data) {
    mount();
    document.body.classList.toggle('tc-host', isHost());
    pins = (data && Array.isArray(data.pins)) ? data.pins.slice(0, MAX_PINS) : [];
    // 1.9.0: i miei messaggi anche dopo un ricaricamento (il server sa chi li ha scritti)
    if (data && Array.isArray(data.mine)) for (const id of data.mine) {
      if (typeof id !== 'string') continue;
      mine.add(id);
      const m = msgEl(id), bar = m && m.querySelector('.tc-tools');
      if (bar) addOwnTools(m, bar);
    }
    reacts.clear();
    if (data && data.reacts) for (const k of Object.keys(data.reacts)) reacts.set(k, data.reacts[k]);
    const was = nearBottom();
    document.querySelectorAll('#chatMessages .chat-msg[data-msg-id]').forEach(paintReacts);
    paintPins();
    keepBottom(was);
  }
  function outgoing(payload) {
    if (editing) cancelEdit(true);
    stopMyTyping();
    // invio da fuori (es. dalle notifiche) a chat chiusa: niente citazione e la risposta in corso resta
    if (reply && chatIsOpen()) { payload.replyTo = reply.id; cancelReply(); }
    return payload;
  }
  function bind(s) {
    socket = s;
    mount();
    s.on('chatReactions', ({ msgId, list: l } = {}) => {
      if (typeof msgId !== 'string') return;
      if (Array.isArray(l) && l.length) reacts.set(msgId, l); else reacts.delete(msgId);
      const m = msgEl(msgId); if (!m) return;
      const was = nearBottom();
      paintReacts(m);
      keepBottom(was);
    });
    s.on('chatPins', ({ pins: p } = {}) => {
      pins = Array.isArray(p) ? p.slice(0, MAX_PINS) : [];
      paintPins();
    });
    s.on('chatTyping', ({ peerId, name, on } = {}) => {
      if (!peerId || peerId === myId()) return;
      if (on) typers.set(peerId, { name: String(name || ''), until: Date.now() + TYPING_TTL });
      else typers.delete(peerId);
      paintTyping();
    });
    s.on('peerLeft', ({ peerId } = {}) => { if (typers.delete(peerId)) paintTyping(); });
    // 1.9.0 — modificato / eliminato per tutti
    s.on('chatEdited', ({ msgId, text, edited, quote } = {}) => {
      if (typeof msgId !== 'string' || typeof text !== 'string') return;
      const was = nearBottom();
      const m = msgEl(msgId);
      if (m && m._tcMsg && !m._tcMsg.deleted) {
        m._tcMsg.message = text;
        m._tcMsg.edited = Number(edited) || Date.now();
        const bubble = m.querySelector('.msg-bubble');
        if (bubble) linkify(bubble, text);
        paintEdited(m, m._tcMsg);
        if (editing && editing.id === msgId) paintEdit(m._tcMsg);
      }
      const q = typeof quote === 'string' ? quote : snippet(text, QUOTE_MAX);
      for (const b of quotesOf(msgId)) { const t = b.querySelector('.tc-quote-text'); if (t) t.textContent = q; }
      if (reply && reply.id === msgId) { reply.text = q; paintReply(); }
      keepBottom(was);
    });
    s.on('chatDeleted', ({ msgId } = {}) => {
      if (typeof msgId !== 'string') return;
      const was = nearBottom();
      reacts.delete(msgId);
      mine.delete(msgId);
      if (editing && editing.id === msgId) cancelEdit();
      if (reply && reply.id === msgId) cancelReply();
      const m = msgEl(msgId);
      if (m) { if (m._tcMsg) { m._tcMsg.deleted = true; m._tcMsg.message = ''; delete m._tcMsg.edited; } paintDeleted(m); }
      for (const b of quotesOf(msgId)) {
        b.classList.add('tc-quote-gone');
        const t = b.querySelector('.tc-quote-text'); if (t) t.textContent = T('Messaggio eliminato');
      }
      keepBottom(was);
    });
  }

  window.TdtChat = { bind, load, decorate, outgoing, linkify, submitEdit };
})();
