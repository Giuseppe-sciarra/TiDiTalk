'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   1.8.3 — Menu ⋮ sul riquadro (idea 06): comandi lato server
   ───────────────────────────────────────────────────────────────────────────
   • pinAll        fissa / sblocca un riquadro per tutti (max 3 per stanza);
                   chi entra in ritardo lo riceve subito dopo l'ingresso
   • mutePeer      silenzia UNA persona (come «silenzia tutti», ma per uno)
   • sendToLobby   rimanda un ospite in sala d'attesa: perde il biglietto e al
                   rientro aspetta di nuovo (anche se la sala d'attesa è spenta)
   «Rimuovi» usa il kickPeer che esiste già in index.js.
   Tutti i permessi sono controllati QUI (solo organizzatori), con limite di
   frequenza per ogni connessione. index.js chiama le funzioni con agganci di una riga.
   ═══════════════════════════════════════════════════════════════════════════ */

const MAX_PINS = 3;
const BACK_TTL_MS = 10 * 60 * 1000;   // per quanto «rimandato in sala d'attesa» vale al rientro

function _bucket(capacity, refillPerSec) {
  return {
    tokens: capacity, last: Date.now(),
    take() {
      const now = Date.now();
      this.tokens = Math.min(capacity, this.tokens + (now - this.last) / 1000 * refillPerSec);
      this.last = now;
      if (this.tokens < 1) return false;
      this.tokens -= 1; return true;
    },
  };
}

// ── stato per stanza (creato al primo uso) ────────────────────────────────
function _st(room) {
  if (!room._tm183) room._tm183 = { pins: [], back: new Map() };
  return room._tm183;
}
/** Fissati di persone ancora in stanza (chi esce sparisce da solo). */
function _livePins(room) {
  const st = _st(room);
  st.pins = st.pins.filter(p => room.peers.has(p.id));
  return st.pins;
}
function _view(room) { return _livePins(room).map(p => ({ id: p.id, by: p.by, at: p.at })); }
function _broadcast(io, room) { io.to(room.id).emit('pinAll', { pins: _view(room) }); }

/** Chiave per riconoscere chi rientra: la scheda (tabId) o, senza, il nome. */
function _key(tabId, name) { return tabId ? 't:' + tabId : 'n:' + String(name || '').toLowerCase(); }

/** joinRoom: questo ospite è stato rimandato in sala d'attesa e non è ancora stato riammesso? */
function mustWait(room, tabId, name, socketId) {
  const st = room && room._tm183;
  if (!st || !st.back.size) return false;
  const now = Date.now();
  for (const [k, t] of st.back) if (now - t > BACK_TTL_MS) st.back.delete(k);
  const k = _key(tabId, name);
  if (!st.back.has(k)) return false;
  // riammesso dall'organizzatore: da qui in poi entra come gli altri
  if (room.admitted.has(socketId)) { st.back.delete(k); return false; }
  return true;
}

/** Dopo l'ingresso: i fissati per tutti a chi è appena entrato. */
function afterJoin(socket, room) {
  if (room && room._tm183 && room._tm183.pins.length) socket.emit('pinAll', { pins: _view(room), snapshot: true });
}

// ── socket ─────────────────────────────────────────────────────────────────
// ctx: { io, room(), peer(), isHost() }
function bindSocket(socket, ctx) {
  const { io } = ctx;
  const rl = { pin: _bucket(6, 0.5), mute: _bucket(8, 1), lobby: _bucket(5, 0.3) };
  const cbOf = (cb) => (typeof cb === 'function' ? cb : () => { });
  const hostOnly = (cb, bucket) => {
    if (!ctx.isHost()) { cb({ error: 'Solo gli organizzatori' }); return false; }
    if (!rl[bucket].take()) { cb({ error: 'Troppe richieste, riprova tra poco' }); return false; }
    return true;
  };
  const targetId = (d) => String((d && d.peerId) || '').slice(0, 64);

  // ── Fissa / sblocca per tutti ───────────────────────────────────────────
  socket.on('pinAll', (d, cb) => {
    cb = cbOf(cb);
    if (!hostOnly(cb, 'pin')) return;
    const room = ctx.room(), me = ctx.peer();
    const id = targetId(d);
    if (!room.peers.has(id)) return cb({ error: 'Partecipante non trovato' });
    const pins = _livePins(room);
    const i = pins.findIndex(p => p.id === id);
    if (d && d.on === true) {
      if (i >= 0) return cb({ ok: true });
      if (pins.length >= MAX_PINS) return cb({ error: 'Puoi fissare per tutti al massimo 3 riquadri' });
      pins.push({ id, by: String(me.displayName || '').slice(0, 50), at: Date.now() });
    } else {
      if (i < 0) return cb({ ok: true });
      pins.splice(i, 1);
    }
    _broadcast(io, room);
    cb({ ok: true });
  });

  // ── Silenzia una persona ────────────────────────────────────────────────
  socket.on('mutePeer', (d, cb) => {
    cb = cbOf(cb);
    if (!hostOnly(cb, 'mute')) return;
    const room = ctx.room(), id = targetId(d);
    if (id === socket.id) return cb({ error: 'Per te usa il tasto del microfono' });
    if (!room.peers.has(id)) return cb({ error: 'Partecipante non trovato' });
    io.to(id).emit('mutedBy', { by: ctx.peer().displayName });
    cb({ ok: true });
  });

  // ── Rimanda in sala d'attesa ────────────────────────────────────────────
  socket.on('sendToLobby', (d, cb) => {
    cb = cbOf(cb);
    if (!hostOnly(cb, 'lobby')) return;
    const room = ctx.room(), id = targetId(d);
    const target = room.peers.get(id);
    if (!target) return cb({ error: 'Partecipante non trovato' });
    if (!target.isGuest) return cb({ error: 'Gli organizzatori entrano sempre: non puoi rimandarli in sala d\'attesa' });
    // niente biglietto: al rientro (la pagina si ricarica) aspetta di nuovo
    room.revokeTicket(target.admitTicket);
    room.admitted.delete(id);
    const st = _st(room);
    st.back.set(_key(target.tabId, target.displayName), Date.now());
    while (st.back.size > 200) st.back.delete(st.back.keys().next().value);
    io.to(id).emit('sentToLobby', { by: ctx.peer().displayName });
    console.log(`[tilemenu] ${ctx.peer().displayName} ha rimandato ${target.displayName} in sala d'attesa (${room.id})`);
    // il client si ricarica da solo; se non lo fa, lo stacchiamo comunque
    setTimeout(() => { if (room.peers.get(id) === target) io.in(id).disconnectSockets(true); }, 4000);
    cb({ ok: true });
  });
}

module.exports = { bindSocket, afterJoin, mustWait };
