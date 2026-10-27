'use strict';

/**
 * 1.8.0 — Attività della riunione: Timer e Domande (idee di Meet, fatte alla Tiditalk).
 * Stesso schema dei sondaggi (Room.js + index.js): lo stato vive nella stanza,
 * il server controlla permessi e limiti e ogni client riceve la sua vista.
 *
 *  Timer    room.actTimer — uno per stanza. Solo gli organizzatori lo avviano, lo
 *           mettono in pausa, aggiungono un minuto o lo annullano. Il conto alla
 *           rovescia lo fanno i browser con l'orologio del SERVER: endsAt è in ms
 *           del server e 'actClock' serve al client per misurare lo scarto.
 *           Alla scadenza il server avvisa tutti (action 'end') e toglie il timer.
 *  Domande  room.qna — chiunque chiede, anche in forma anonima: in quel caso il
 *           client non manda il nome e il server NON salva chi l'ha scritta (né
 *           nome, né utente, né socket). Un voto a persona (si toglie). Gli
 *           organizzatori segnano «In risposta» / «Risposta data» e nascondono.
 *
 * Agganci in index.js: snapshot() nella risposta di joinRoom, bind() con gli
 * altri handler del socket. Room.js non cambia: i campi si creano al primo uso.
 */

const crypto = require('crypto');

const LIM = {
  TITLE: 60,            // titolo del timer
  DUR_MIN: 5,           // secondi
  DUR_MAX: 3 * 3600,    // 3 ore
  ADD_MAX: 600,         // "+N" al massimo 10 minuti per volta
  Q_TEXT: 300,          // caratteri di una domanda
  Q_ANSWER: 1000,       // caratteri di una risposta scritta (1.8.5)
  Q_ROOM: 200,          // domande per stanza
  Q_SOCKET: 30,         // domande per connessione
};
const Q_STATUS = new Set(['open', 'answering', 'answered']);

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
const newId = () => crypto.randomBytes(5).toString('hex');
const safeId = (v) => (typeof v === 'string' && /^[0-9a-f]{10}$/.test(v) ? v : '');
// Testo libero: niente caratteri di controllo né di direzione (RTL override),
// a capo normalizzati, taglio per punti di codice (le emoji non si spezzano).
const BAD_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩﻿]/g;
function cleanText(v, max, singleLine) {
  if (typeof v !== 'string') return '';
  let s = v.slice(0, max * 4).replace(BAD_CHARS, '').replace(/\r\n?/g, '\n');
  s = singleLine ? s.replace(/\s+/g, ' ') : s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  s = s.trim();
  const cps = Array.from(s);
  return (cps.length > max ? cps.slice(0, max).join('') : s).trim();
}

// ── Timer ────────────────────────────────────────────────────────────────────
function timerView(room, now = Date.now()) {
  const t = room.actTimer;
  if (!t) return null;
  return {
    id: t.id, title: t.title, durationMs: t.durationMs, paused: t.paused,
    endsAt: t.paused ? null : t.endsAt,
    remainingMs: t.paused ? t.remainingMs : Math.max(0, t.endsAt - now),
    startedAt: t.startedAt, startedByName: t.startedByName,
  };
}

// La stanza chiusa non deve lasciare timeout appesi (fino a 3 ore)
function hookClose(room) {
  if (room._actHooked) return;
  room._actHooked = true;
  const orig = room.close.bind(room);
  room.close = () => {
    try { if (room.actTimer) clearTimeout(room.actTimer._to); } catch (_) { }
    room.actTimer = null;
    return orig();
  };
}

function emitTimer(io, room, action, bySid, byName, extra) {
  io.to(room.id).emit('timerUpdate', {
    timer: timerView(room), action, bySid: bySid || null, by: byName || null,
    serverNow: Date.now(), ...(extra || {}),
  });
}

function scheduleEnd(io, room) {
  const t = room.actTimer;
  if (!t) return;
  clearTimeout(t._to);
  if (t.paused) return;
  t._to = setTimeout(() => {
    const cur = room.actTimer;
    if (!cur || cur.id !== t.id || cur.paused) return;
    // setTimeout può scattare un filo prima: in quel caso si riprogramma
    if (Date.now() < cur.endsAt - 5) { scheduleEnd(io, room); return; }
    room.actTimer = null;
    emitTimer(io, room, 'end', null, null, { ended: { id: cur.id, title: cur.title } });
  }, Math.max(0, t.endsAt - Date.now()));
}

// ── Domande ──────────────────────────────────────────────────────────────────
const qList = (room) => (room.qna || (room.qna = []));
const qFind = (room, id) => qList(room).find((q) => q.id === id) || null;
const isHostSid = (room, sid) => { const p = room.peers.get(sid); return !!p && !p.isGuest; };

/** Vista di una domanda per un socket: null se lui non la deve vedere (nascosta). */
function qView(room, q, sid) {
  if (q.hidden && !isHostSid(room, sid)) return null;
  const key = room.voterKey(sid);
  return {
    id: q.id, text: q.text, anonymous: q.anonymous,
    author: q.anonymous ? null : q.authorName,
    mine: !q.anonymous && !!q.authorKey && q.authorKey === key,
    votes: q.votes.size, voted: q.votes.has(key),
    status: q.status, hidden: q.hidden,
    createdAt: q.createdAt, answeredAt: q.answeredAt,
    // 1.8.5: risposta scritta dall'organizzatore (la vedono tutti)
    answer: q.answer ? { text: q.answer.text, name: q.answer.name, at: q.answer.at, edited: !!q.answer.edited, mine: !!q.answer.key && q.answer.key === key } : null,
  };
}

function broadcastQ(io, room, q, bySid) {
  const sockets = io.sockets.adapter.rooms.get(room.id) || new Set();
  for (const sid of sockets) {
    const v = qView(room, q, sid);
    io.to(sid).emit('qnaUpdate', v ? { q: v, bySid: bySid || null } : { id: q.id, removed: true });
  }
}

// ── API per index.js ─────────────────────────────────────────────────────────
/** Stato per chi entra (anche in ritardo): timer in corso e domande visibili. */
function snapshot(room, sid) {
  return {
    serverNow: Date.now(),
    timer: timerView(room),
    qna: qList(room).map((q) => qView(room, q, sid)).filter(Boolean),
  };
}

/**
 * Handler del socket. ctx = { inRoom(), room(), peer() } dalle closure di index.js.
 */
function bind(io, socket, ctx) {
  const rl = {
    clock: rlim(8, 0.5),   // misura dell'orologio: qualche campione all'ingresso
    timer: rlim(10, 2),
    ask: rlim(3, 0.2),     // 3 di fila, poi una ogni 5 s
    vote: rlim(20, 4),
    mod: rlim(20, 4),      // azioni degli organizzatori sulle domande
  };
  let asked = 0; // domande fatte da questa connessione (solo un numero: nessun legame con le domande)
  const cbf = (cb) => (typeof cb === 'function' ? cb : () => { });
  const guard = (d, bucket, hostOnly, hostMsg) => {
    if (!ctx.inRoom() || !isObj(d)) throw new Error('Non in stanza');
    if (hostOnly && ctx.peer().isGuest) throw new Error(hostMsg || 'Solo gli organizzatori');
    if (!rl[bucket].take()) throw new Error('Troppe richieste');
  };
  const on = (ev, fn) => socket.on(ev, (d, cb) => {
    if (typeof d === 'function') { cb = d; d = {}; }
    cb = cbf(cb);
    try { fn(d == null ? {} : d, cb); } catch (err) { cb({ error: err.message }); }
  });

  // Orologio del server: il client misura andata e ritorno e corregge lo scarto
  on('actClock', (d, cb) => {
    if (!rl.clock.take()) return cb({ error: 'Troppe richieste' });
    cb({ now: Date.now() });
  });

  // ── Timer (solo organizzatori) ──────────────────────────────────────────
  const T_HOST = 'Solo gli organizzatori possono usare il timer';
  on('timerStart', (d, cb) => {
    guard(d, 'timer', true, T_HOST);
    const sec = Math.round(Number(d.durationSec));
    if (!Number.isFinite(sec) || sec < LIM.DUR_MIN || sec > LIM.DUR_MAX) throw new Error('Durata non valida (da 5 secondi a 3 ore)');
    const room = ctx.room(), peer = ctx.peer();
    hookClose(room);
    if (room.actTimer) clearTimeout(room.actTimer._to);
    const now = Date.now();
    room.actTimer = {
      id: newId(), title: cleanText(d.title, LIM.TITLE, true),
      durationMs: sec * 1000, endsAt: now + sec * 1000, remainingMs: sec * 1000, paused: false,
      startedAt: now, startedByName: peer.displayName, _to: null,
    };
    scheduleEnd(io, room);
    emitTimer(io, room, 'start', socket.id, peer.displayName);
    cb({ ok: true, id: room.actTimer.id });
  });
  on('timerPause', (d, cb) => {
    guard(d, 'timer', true, T_HOST);
    const room = ctx.room(), t = room.actTimer;
    if (!t) throw new Error('Nessun timer in corso');
    if (!t.paused) {
      t.remainingMs = Math.max(0, t.endsAt - Date.now());
      t.paused = true;
      clearTimeout(t._to);
      emitTimer(io, room, 'pause', socket.id, ctx.peer().displayName);
    }
    cb({ ok: true });
  });
  on('timerResume', (d, cb) => {
    guard(d, 'timer', true, T_HOST);
    const room = ctx.room(), t = room.actTimer;
    if (!t) throw new Error('Nessun timer in corso');
    if (t.paused) {
      t.paused = false;
      t.endsAt = Date.now() + t.remainingMs;
      scheduleEnd(io, room);
      emitTimer(io, room, 'resume', socket.id, ctx.peer().displayName);
    }
    cb({ ok: true });
  });
  on('timerAdd', (d, cb) => {
    guard(d, 'timer', true, T_HOST);
    const room = ctx.room(), t = room.actTimer;
    if (!t) throw new Error('Nessun timer in corso');
    let add = d.sec == null ? 60 : Math.round(Number(d.sec));
    if (!Number.isFinite(add) || add < 1 || add > LIM.ADD_MAX) throw new Error('Durata non valida');
    const now = Date.now();
    const rem = t.paused ? t.remainingMs : Math.max(0, t.endsAt - now);
    add = Math.min(add * 1000, LIM.DUR_MAX * 1000 - rem);
    if (add <= 0) throw new Error('Il timer è già al massimo (3 ore)');
    t.durationMs += add;
    if (t.paused) t.remainingMs = rem + add; else t.endsAt = now + rem + add;
    scheduleEnd(io, room);
    emitTimer(io, room, 'add', socket.id, ctx.peer().displayName, { addedMs: add });
    cb({ ok: true });
  });
  on('timerCancel', (d, cb) => {
    guard(d, 'timer', true, T_HOST);
    const room = ctx.room(), t = room.actTimer;
    if (t) {
      clearTimeout(t._to);
      room.actTimer = null;
      emitTimer(io, room, 'cancel', socket.id, ctx.peer().displayName, { ended: { id: t.id, title: t.title } });
    }
    cb({ ok: true });
  });

  // ── Domande ─────────────────────────────────────────────────────────────
  on('qnaAsk', (d, cb) => {
    guard(d, 'ask', false);
    const text = cleanText(d.text, LIM.Q_TEXT, false);
    if (!text) throw new Error('Scrivi la domanda');
    if (asked >= LIM.Q_SOCKET) throw new Error('Hai già fatto molte domande: aspetta un po\' di risposte');
    const room = ctx.room(), list = qList(room);
    if (list.length >= LIM.Q_ROOM) throw new Error('Questa riunione ha raggiunto il numero massimo di domande');
    // Anonima: si legge SOLO il testo. Nome, utente e socket non vengono
    // salvati sulla domanda e non compaiono in nessun log.
    const anonymous = d.anonymous === true;
    const peer = ctx.peer();
    const q = {
      id: newId(), text, anonymous,
      authorName: anonymous ? null : peer.displayName,
      authorKey: anonymous ? null : room.voterKey(socket.id),
      votes: new Set(), status: 'open', hidden: false,
      createdAt: Date.now(), answeredAt: null,
    };
    list.push(q);
    asked++;
    broadcastQ(io, room, q, null);
    cb({ ok: true, id: q.id });
  });
  on('qnaVote', (d, cb) => {
    guard(d, 'vote', false);
    const room = ctx.room(), q = qFind(room, safeId(d.id));
    if (!q || (q.hidden && ctx.peer().isGuest)) throw new Error('Domanda non trovata');
    if (q.status === 'answered') throw new Error('Questa domanda ha già avuto risposta');
    const key = room.voterKey(socket.id);
    const want = d.on !== false;
    if (want !== q.votes.has(key)) {
      if (want) q.votes.add(key); else q.votes.delete(key);
      broadcastQ(io, room, q, null);
    }
    cb({ ok: true });
  });
  const Q_HOST = 'Solo gli organizzatori possono moderare le domande';
  on('qnaStatus', (d, cb) => {
    guard(d, 'mod', true, Q_HOST);
    const room = ctx.room(), q = qFind(room, safeId(d.id));
    if (!q) throw new Error('Domanda non trovata');
    const status = typeof d.status === 'string' && Q_STATUS.has(d.status) ? d.status : null;
    if (!status) throw new Error('Stato non valido');
    const now = Date.now();
    if (status === 'answering') {
      // una sola «In risposta» alla volta: quella di prima si considera risposta
      for (const o of qList(room)) {
        if (o !== q && o.status === 'answering') { o.status = 'answered'; o.answeredAt = now; broadcastQ(io, room, o, socket.id); }
      }
      q.hidden = false;
    }
    q.status = status;
    q.answeredAt = status === 'answered' ? now : null;
    broadcastQ(io, room, q, socket.id);
    cb({ ok: true });
  });
  // 1.8.5 · risposta scritta: la scrive un organizzatore, la domanda passa a
  // «Risposta data»; solo chi l'ha scritta la corregge o la toglie (testo vuoto)
  on('qnaAnswer', (d, cb) => {
    guard(d, 'mod', true, Q_HOST);
    const room = ctx.room(), q = qFind(room, safeId(d.id));
    if (!q) throw new Error('Domanda non trovata');
    const key = room.voterKey(socket.id);
    if (q.answer && q.answer.key && q.answer.key !== key) throw new Error('Questa risposta l\'ha scritta un altro organizzatore');
    const text = cleanText(d.text, LIM.Q_ANSWER, false);
    const now = Date.now();
    if (!text) {
      if (!q.answer) return cb({ ok: true });
      q.answer = null;
      if (q.status === 'answered') { q.status = 'open'; q.answeredAt = null; }
    } else {
      q.answer = { text, name: ctx.peer().displayName, key, at: q.answer ? q.answer.at : now, edited: !!q.answer };
      q.status = 'answered'; q.answeredAt = q.answeredAt || now; q.hidden = false;
    }
    broadcastQ(io, room, q, socket.id);
    cb({ ok: true });
  });
  on('qnaHide', (d, cb) => {
    guard(d, 'mod', true, Q_HOST);
    const room = ctx.room(), q = qFind(room, safeId(d.id));
    if (!q) throw new Error('Domanda non trovata');
    const hidden = d.hidden !== false;
    if (hidden !== q.hidden) {
      q.hidden = hidden;
      if (hidden && q.status === 'answering') q.status = 'open';
      broadcastQ(io, room, q, socket.id);
    }
    cb({ ok: true });
  });
}

module.exports = { snapshot, bind, LIM, _cleanText: cleanText };
