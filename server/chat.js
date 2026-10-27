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
/** Per chi entra (anche in ritardo): fissati e reazioni dei messaggi in cronologia. */
function snapshot(room, sid) {
  const reacts = {};
  if (room.chatReacts) {
    for (const msg of room.chatHistory || []) {
      if (!room.chatReacts.has(msg.id)) continue;
      const v = reactView(room, msg.id, sid);
      if (v.length) reacts[msg.id] = v;
    }
  }
  return { pins: pinsView(room), reacts };
}

// le reazioni dei messaggi usciti dalla cronologia non servono più
function prune(room) {
  if (!room.chatReacts || room.chatReacts.size <= (room.chatHistory || []).length + 20) return;
  const alive = new Set((room.chatHistory || []).map(m => m.id));
  for (const id of room.chatReacts.keys()) if (!alive.has(id)) room.chatReacts.delete(id);
}

/** Eventi socket. Restituisce { onMessage } per il gestore 'chatMessage' di index.js. */
function bind(io, socket, { inRoom, room, peer }) {
  const rl = {
    react: rlim(12, 4),    // reazioni: 12 di fila, 4/s
    pin: rlim(6, 1),       // fissa/sblocca: 6 di fila, 1/s
    typing: rlim(4, 0.5),  // «sta scrivendo»: 4 di fila, poi uno ogni 2 s
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
    if (!msg || msg.type !== 'text') return cb({ error: 'Messaggio non trovato' });
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
      if (!msg || msg.type !== 'text') return cb({ error: 'Messaggio non trovato' });
      if (pins.length >= LIM.PINS) return cb({ error: 'Puoi fissare al massimo 3 messaggi: sbloccane uno' });
      pins.unshift({ id: msg.id, peerId: msg.peerId, name: msg.displayName, text: msg.message, ts: msg.timestamp, by: me.displayName, at: Date.now() });
      action = 'pin';
    }
    io.to(r.id).emit('chatPins', { pins: pinsView(r), action, msgId, by: me.displayName });
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
      const replyId = safeId(extra && extra.replyTo);
      if (replyId && replyId !== msg.id) {
        const orig = findMsg(r, replyId);
        if (orig && orig.type === 'text') msg.replyTo = { id: orig.id, peerId: orig.peerId, name: orig.displayName, text: snippet(orig.message, LIM.QUOTE) };
      }
      if (typingOn) {
        typingOn = false;
        socket.to(r.id).emit('chatTyping', { peerId: socket.id, name: peer().displayName, on: false });
      }
    },
  };
}

module.exports = { bind, snapshot, LIM };
