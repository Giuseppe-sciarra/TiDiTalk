'use strict';
/**
 * 1.8.2 — Chat: messaggi fissati, reazioni ai messaggi, risposta con citazione
 * e «sta scrivendo…» (idea 07 di Meet, fatta alla Tiditalk).
 *
 *  Fissati   room.chatPins — al massimo 3, li fissano e sbloccano solo gli
 *            organizzatori. Ogni voce tiene una copia del messaggio: resta
 *            anche quando il messaggio esce dalla cronologia (200 messaggi).
 *  Reazioni  room.chatReacts: id messaggio → Map(emoji → Map(chiave persona → nome)).
 *            La chiave è quella dei sondaggi (utente, biglietto o socket):
 *            la stessa emoji una seconda volta la toglie. Ogni socket riceve
 *            la sua vista ('mine' = c'è anche la mia reazione).
 *  Risposta  il client manda solo l'id del messaggio citato: nome e testo
 *            della citazione li prende il server dalla cronologia.
 *  Scrivendo 'chatTyping' { on } → agli altri { peerId, name, on }. Il client
 *            lo ripete ogni ~3 s mentre scrive e lo fa scadere da solo.
 *  1.9.0     'chatEdit' { msgId, text } e 'chatDelete' { msgId }: solo sui
 *            propri messaggi. Il proprietario è la chiave dei sondaggi
 *            (utente, biglietto o socket) tenuta in room.chatOwners, mai
 *            mandata ai client: così si può modificare anche dopo aver
 *            ricaricato la pagina. La modifica aggiorna anche le copie nei
 *            fissati e nelle citazioni; l'eliminazione lascia «Messaggio
 *            eliminato», toglie reazioni e fissato e svuota le citazioni.
 *
 * Agganci in index.js: snapshot() nella risposta di joinRoom, bind() con gli
 * altri handler del socket, onMessage() nel gestore 'chatMessage'.
 * Room.js non cambia: i campi si creano al primo uso.
 */

const { validEmoji } = require('./reactions');

const LIM = {
  PINS: 3,            // messaggi fissati per stanza
  QUOTE: 140,         // caratteri della citazione
  EMOJI_PER_MSG: 8,   // emoji diverse sotto lo stesso messaggio
  NAMES: 15,          // nomi mandati per ogni emoji (per il suggerimento)
  TEXT: 2000,         // caratteri di un messaggio (come 'chatMessage' in index.js)
};

// token bucket (come makeRateLimiter in index.js, copia locale per non toccarlo)
function rlim(capacity, refillPerSec) {
  let tokens = capacity, last = Date.now();
  return {
    take() {
      const now = Date.now();
      tokens = Math.min(capacity, tokens + (now - last) / 1000 * refillPerSec);
      last = now;
      if (tokens < 1) return false;
      tokens -= 1;
      return true;
    },
  };
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
// gli id dei messaggi sono crypto.randomUUID() (Room.addChatMessage)
const safeId = (v) => (typeof v === 'string' && /^[0-9a-f-]{8,40}$/i.test(v) ? v : '');
function snippet(text, max) {
  const cps = Array.from(String(text || '').replace(/\s+/g, ' ').trim());
  return cps.length > max ? cps.slice(0, max - 1).join('').trimEnd() + '…' : cps.join('');
}
function findMsg(room, id) {
  const h = room.chatHistory || [];
  for (let i = h.length - 1; i >= 0; i--) if (h[i].id === id) return h[i];
  return null;
}

// ── Viste per i client ──────────────────────────────────────────────────────
function pinsView(room) {
  return (room.chatPins || []).map(p => ({ id: p.id, peerId: p.peerId, name: p.name, text: p.text, ts: p.ts, by: p.by, at: p.at }));
}
function reactView(room, msgId, sid) {
  const m = room.chatReacts && room.chatReacts.get(msgId);
  if (!m) return [];
  const me = room.voterKey(sid);
  const out = [];
  for (const [e, who] of m) {
    if (!who.size) continue;
    const names = []; let mine = false;
    for (const [k, n] of who) {
      if (k === me) mine = true;
      else if (names.length < LIM.NAMES) names.push(n);
    }
    out.push({ e, n: who.size, mine, who: names });
  }
  return out;
}
/** Per chi entra (anche in ritardo): fissati, reazioni e quali messaggi sono suoi. */
function snapshot(room, sid) {
  const reacts = {};
  if (room.chatReacts) {
    for (const msg of room.chatHistory || []) {
      if (!room.chatReacts.has(msg.id)) continue;
      const v = reactView(room, msg.id, sid);
      if (v.length) reacts[msg.id] = v;
    }
  }
  const mine = [];
  if (room.chatOwners) {
    const me = room.voterKey(sid);
    for (const msg of room.chatHistory || []) if (!msg.deleted && room.chatOwners.get(msg.id) === me) mine.push(msg.id);
  }
  return { pins: pinsView(room), reacts, mine };
}
// testo pulito come in 'chatMessage': niente byte nulli, al massimo LIM.TEXT
const BAD_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
function cleanText(v) {
  return typeof v === 'string' ? v.slice(0, LIM.TEXT).replace(BAD_CHARS, '').trim() : '';
}

// le reazioni (e i proprietari) dei messaggi usciti dalla cronologia non servono più
function prune(room) {
  const n = (room.chatHistory || []).length + 20;
  const big = (m) => m && m.size > n;
  if (!big(room.chatReacts) && !big(room.chatOwners)) return;
  const alive = new Set((room.chatHistory || []).map(m => m.id));
  for (const map of [room.chatReacts, room.chatOwners]) {
    if (!big(map)) continue;
    for (const id of map.keys()) if (!alive.has(id)) map.delete(id);
  }
}

/** Eventi socket. Restituisce { onMessage } per il gestore 'chatMessage' di index.js. */
function bind(io, socket, { inRoom, room, peer }) {
  const rl = {
    react: rlim(12, 4),    // reazioni: 12 di fila, 4/s
    pin: rlim(6, 1),       // fissa/sblocca: 6 di fila, 1/s
    typing: rlim(4, 0.5),  // «sta scrivendo»: 4 di fila, poi uno ogni 2 s
    edit: rlim(6, 1),      // modifica / elimina: 6 di fila, 1/s
  };
  let typingOn = false;
  const cbOf = (cb) => (typeof cb === 'function' ? cb : () => { });

  function sendReacts(r, msgId) {
    const sids = io.sockets.adapter.rooms.get(r.id) || new Set();
    for (const sid of sids) io.to(sid).emit('chatReactions', { msgId, list: reactView(r, msgId, sid) });
  }

  // Reazione a un messaggio: aggiunge, oppure toglie se c'era già la mia
  socket.on('chatReact', (d, cb) => {
    cb = cbOf(cb);
    if (!inRoom() || !isObj(d)) return cb({ error: 'Non in stanza' });
    if (!rl.react.take()) return cb({ error: 'Troppe richieste' });
    const r = room(), me = peer();
    const msgId = safeId(d.msgId), e = validEmoji(d.emoji);
    if (!msgId || !e) return cb({ error: 'Reazione non valida' });
    const msg = findMsg(r, msgId);
    if (!msg || msg.type !== 'text' || msg.deleted) return cb({ error: 'Messaggio non trovato' });
    if (!r.chatReacts) r.chatReacts = new Map();
    let m = r.chatReacts.get(msgId);
    if (!m) { m = new Map(); r.chatReacts.set(msgId, m); }
    let who = m.get(e);
    const key = r.voterKey(socket.id);
    if (who && who.has(key)) {
      who.delete(key);
      if (!who.size) m.delete(e);
    } else {
      if (!who) {
        if (m.size >= LIM.EMOJI_PER_MSG) return cb({ error: 'Troppe reazioni diverse su questo messaggio' });
        who = new Map(); m.set(e, who);
      }
      who.set(key, me.displayName);
    }
    if (!m.size) r.chatReacts.delete(msgId);
    prune(r);
    sendReacts(r, msgId);
    cb({ ok: true });
  });

  // Fissa / sblocca (solo organizzatori, controllo qui sul server)
  socket.on('chatPin', (d, cb) => {
    cb = cbOf(cb);
    if (!inRoom() || !isObj(d)) return cb({ error: 'Non in stanza' });
    const r = room(), me = peer();
    if (me.isGuest) return cb({ error: 'Solo gli organizzatori possono fissare i messaggi' });
    if (!rl.pin.take()) return cb({ error: 'Troppe richieste' });
    const msgId = safeId(d.msgId);
    if (!msgId) return cb({ error: 'Messaggio non trovato' });
    const pins = r.chatPins || (r.chatPins = []);
    const idx = pins.findIndex(p => p.id === msgId);
    let action;
    if (d.pinned === false) {
      if (idx < 0) return cb({ ok: true });
      pins.splice(idx, 1); action = 'unpin';
    } else {
      if (idx >= 0) return cb({ ok: true });
      const msg = findMsg(r, msgId);
      if (!msg || msg.type !== 'text' || msg.deleted) return cb({ error: 'Messaggio non trovato' });
      if (pins.length >= LIM.PINS) return cb({ error: 'Puoi fissare al massimo 3 messaggi: sbloccane uno' });
      pins.unshift({ id: msg.id, peerId: msg.peerId, name: msg.displayName, text: msg.message, ts: msg.timestamp, by: me.displayName, at: Date.now() });
      action = 'pin';
    }
    io.to(r.id).emit('chatPins', { pins: pinsView(r), action, msgId, by: me.displayName });
    cb({ ok: true });
  });

  // 1.9.0 — il messaggio è mio? (stessa chiave dei sondaggi, vale anche dopo un ricaricamento)
  function ownMsg(r, d, cb) {
    if (!inRoom() || !isObj(d)) { cb({ error: 'Non in stanza' }); return null; }
    if (!rl.edit.take()) { cb({ error: 'Troppe richieste' }); return null; }
    const msgId = safeId(d.msgId);
    const msg = msgId ? findMsg(r, msgId) : null;
    if (!msg || msg.type !== 'text' || msg.deleted) { cb({ error: 'Messaggio non trovato' }); return null; }
    const owner = r.chatOwners && r.chatOwners.get(msg.id);
    if (!owner || owner !== r.voterKey(socket.id)) { cb({ error: 'Puoi modificare solo i tuoi messaggi' }); return null; }
    return msg;
  }

  // Modifica di un proprio messaggio: testo nuovo a tutti, fissati e citazioni compresi
  socket.on('chatEdit', (d, cb) => {
    cb = cbOf(cb);
    const r = room();
    const msg = ownMsg(r, d, cb);
    if (!msg) return;
    const text = cleanText(d.text);
    if (!text) return cb({ error: 'Il messaggio è vuoto' });
    if (text === msg.message) return cb({ ok: true });
    msg.message = text;
    msg.edited = Date.now();
    const quote = snippet(text, LIM.QUOTE);
    let pinsChanged = false;
    for (const p of r.chatPins || []) if (p.id === msg.id) { p.text = text; pinsChanged = true; }
    for (const m of r.chatHistory || []) if (m.replyTo && m.replyTo.id === msg.id) m.replyTo.text = quote;
    io.to(r.id).emit('chatEdited', { msgId: msg.id, text, edited: msg.edited, quote });
    if (pinsChanged) io.to(r.id).emit('chatPins', { pins: pinsView(r) });
    cb({ ok: true });
  });

  // Elimina per tutti un proprio messaggio: resta «Messaggio eliminato»
  socket.on('chatDelete', (d, cb) => {
    cb = cbOf(cb);
    const r = room();
    const msg = ownMsg(r, d, cb);
    if (!msg) return;
    msg.message = '';
    msg.deleted = true;
    delete msg.edited;
    delete msg.replyTo;
    if (r.chatReacts) r.chatReacts.delete(msg.id);
    for (const m of r.chatHistory || []) if (m.replyTo && m.replyTo.id === msg.id) { m.replyTo.text = ''; m.replyTo.deleted = true; }
    const pins = r.chatPins || [];
    const idx = pins.findIndex(p => p.id === msg.id);
    if (idx >= 0) pins.splice(idx, 1);
    io.to(r.id).emit('chatDeleted', { msgId: msg.id });
    if (idx >= 0) io.to(r.id).emit('chatPins', { pins: pinsView(r), action: 'unpin', msgId: msg.id });
    cb({ ok: true });
  });

  // «sta scrivendo…»: solo agli altri. Lo spegnimento passa solo se era acceso.
  socket.on('chatTyping', (d) => {
    if (!inRoom() || !isObj(d)) return;
    const on = d.on === true;
    if (on ? !rl.typing.take() : !typingOn) return;
    typingOn = on;
    socket.to(room().id).emit('chatTyping', { peerId: socket.id, name: peer().displayName, on });
  });

  return {
    /** Chiamata dal gestore 'chatMessage' prima di inoltrare il messaggio. */
    onMessage(msg, extra) {
      const r = room();
      if (!r || !msg) return;
      if (!r.chatOwners) r.chatOwners = new Map();
      r.chatOwners.set(msg.id, r.voterKey(socket.id)); // 1.9.0: per modifica / elimina
      prune(r);
      const replyId = safeId(extra && extra.replyTo);
      if (replyId && replyId !== msg.id) {
        const orig = findMsg(r, replyId);
        if (orig && orig.type === 'text' && !orig.deleted) msg.replyTo = { id: orig.id, peerId: orig.peerId, name: orig.displayName, text: snippet(orig.message, LIM.QUOTE) };
      }
      if (typingOn) {
        typingOn = false;
        socket.to(r.id).emit('chatTyping', { peerId: socket.id, name: peer().displayName, on: false });
      }
    },
  };
}

module.exports = { bind, snapshot, LIM };
