'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   1.8.0 — Comandi degli organizzatori e ingresso "secondo schermo"
   ───────────────────────────────────────────────────────────────────────────
   • endMeeting       termina la riunione per tutti (anche chi è in sala d'attesa)
   • lobbyMessage     messaggio a chi aspetta in sala d'attesa (+ posto in coda)
   • setSecondScreen  il secondo schermo passa all'audio (diventa partecipante normale)
                      e, dalla 1.8.3, anche il contrario ({ on: true }) dal menu Altro
   • GET /api/room/:id/who   solo i NOMI di chi c'è, solo con un link valido
   Tutti i permessi sono controllati QUI: il client non decide niente.
   index.js chiama le funzioni esportate con agganci di una riga.
   ═══════════════════════════════════════════════════════════════════════════ */

const MSG_MAX = 200;
const MSG_FRESH_MS = 5 * 60 * 1000;   // chi arriva dopo vede il messaggio se è di meno di 5 minuti fa

const _str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');

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
  if (!room._org) room._org = { lobbyMsg: null, ending: false };
  return room._org;
}

/** joinRoom: la riunione è stata appena terminata → nessuno rientra finché si chiude. */
function isEnding(room) { return !!(room && room._org && room._org.ending); }

/** Posto in coda + messaggio dell'organizzatore a ogni ospite in sala d'attesa.
 *  Chiamata da _lobbyNotifyHosts (ogni volta che la coda cambia). */
function lobbyPositions(io, room) {
  if (!room || !room.lobby) return;
  const st = room._org;
  const msg = st && st.lobbyMsg && Date.now() - st.lobbyMsg.at < MSG_FRESH_MS ? st.lobbyMsg : null;
  const waiting = room.lobbyWaiting();
  waiting.forEach((w, i) => io.to(w.peerId).emit('lobbyInfo', { position: i + 1, total: waiting.length, message: msg }));
}

// ── socket ─────────────────────────────────────────────────────────────────
// ctx: { io, room(), peer(), inRoom(), isHost() }
function bindSocket(socket, ctx) {
  const { io } = ctx;
  const rl = { mod: _bucket(6, 1), msg: _bucket(5, 0.5), end: _bucket(3, 0.2) };
  const cbOf = (cb) => (typeof cb === 'function' ? cb : () => { });
  const hostOnly = (cb, bucket) => {
    if (!ctx.isHost()) { cb({ error: 'Solo gli organizzatori' }); return false; }
    if (!rl[bucket].take()) { cb({ error: 'Troppe richieste, riprova tra poco' }); return false; }
    return true;
  };

  // ── 03 · Termina la riunione per tutti ──────────────────────────────────
  socket.on('endMeeting', (_d, cb) => {
    cb = cbOf(cb);
    if (!hostOnly(cb, 'end')) return;
    const room = ctx.room(), me = ctx.peer();
    const st = _st(room);
    if (st.ending) return cb({ ok: true });
    st.ending = true;
    // nessun biglietto sopravvive: chi ricarica non rientra in una riunione finita
    try { room.tickets.clear(); } catch (_) { }
    const payload = { by: me.displayName };
    const lobbyIds = room.getLobbySocketIds();
    io.to(room.id).emit('meetingEnded', payload);
    for (const id of lobbyIds) io.to(id).emit('meetingEnded', payload);
    console.log(`[org] ${me.displayName} ha terminato la riunione ${room.id} (${room.peers.size} persone, ${lobbyIds.length} in attesa)`);
    cb({ ok: true });
    // il tempo di salvare una registrazione e cambiare pagina, poi si chiude tutto
    setTimeout(() => {
      for (const id of [...room.peers.keys(), ...room.getLobbySocketIds()]) io.in(id).disconnectSockets(true);
    }, 2500);
  });

  // ── 05 · Messaggio a chi aspetta ────────────────────────────────────────
  socket.on('lobbyMessage', (d, cb) => {
    cb = cbOf(cb);
    if (!hostOnly(cb, 'msg')) return;
    const text = _str(d && d.text, MSG_MAX);
    if (!text) return cb({ error: 'Scrivi un messaggio' });
    const room = ctx.room();
    _st(room).lobbyMsg = { text, byName: ctx.peer().displayName, at: Date.now() };
    lobbyPositions(io, room);
    cb({ ok: true, sent: room.lobbyWaiting().length });
  });

  // ── 09 · Secondo schermo → partecipante normale ─────────────────────────
  socket.on('setSecondScreen', (d, cb) => {
    cb = cbOf(cb);
    if (!ctx.inRoom()) return cb({ error: 'Non in stanza' });
    if (!rl.mod.take()) return cb({ error: 'Troppe richieste, riprova tra poco' });
    const p = ctx.peer();
    // 1.8.3: partecipante normale → secondo schermo, senza uscire e rientrare.
    // Si chiudono QUI microfono e videocamera (lo schermo condiviso resta) e da
    // ora refuseProduce rifiuta mic e camera finché non «passa all'audio».
    if (d && d.on === true) {
      if (p.secondScreen) return cb({ ok: true });
      const room = ctx.room();
      for (const pr of [...p.producers.values()]) {
        const mt = pr.appData && pr.appData.mediaType;
        if (mt !== 'audio' && mt !== 'video') continue;
        try { room.closeProducer(socket.id, pr.id); } catch (_) { }
        socket.to(room.id).emit('producerClosed', { producerId: pr.id, peerId: socket.id, mediaType: mt });
      }
      p.secondScreen = true; p.audioMuted = true; p.videoOff = true;
      // per gli altri sparisce il suo riquadro (org.js: onPeerSecondScreen)
      socket.to(room.id).emit('peerSecondScreen', { peerId: socket.id, on: true, peer: p.toJSON() });
      return cb({ ok: true });
    }
    if (!p.secondScreen) return cb({ ok: true });
    p.secondScreen = false;
    // per gli altri è come un ingresso: compare il suo riquadro
    socket.to(ctx.room().id).emit('peerSecondScreen', { peerId: socket.id, peer: p.toJSON() });
    cb({ ok: true });
  });
}

/** Produce: il secondo schermo non trasmette microfono né videocamera. */
function refuseProduce(peer, mediaType) {
  return !!(peer && peer.secondScreen && (mediaType === 'audio' || mediaType === 'video'));
}

// ── HTTP: chi c'è già (pre-ingresso) ───────────────────────────────────────
// Solo i nomi, e solo a chi ha un link valido per QUESTA stanza (token ospite)
// o è un utente registrato. Niente id, stati o altro.
function installHttp(app, { rooms, verifyToken, verifyGuestToken, db }) {
  const hits = new Map();
  setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (now - v.t > 60000) hits.delete(k); }, 60000).unref();
  app.get('/api/room/:roomId/who', (req, res) => {
    const roomId = String(req.params.roomId || '');
    if (!/^[A-Z0-9-]{1,64}$/i.test(roomId)) return res.status(400).json({ error: 'Stanza non valida' });
    const gt = req.get('x-guest-token');
    let ok = false;
    if (gt) { const g = verifyGuestToken(gt); ok = !!(g && g.roomId === roomId); }
    else {
      const p = verifyToken(req.get('x-auth-token'));
      ok = !!(p && !p.guest && db.getUser(p.username));
    }
    if (!ok) return res.status(401).json({ error: 'Link non valido' });
    // anti-raffica: ~1 richiesta ogni 2 s per chi chiede (la pagina chiede ogni 6 s)
    const key = (req.ip || 'x') + '|' + roomId;
    const h = hits.get(key) || { n: 0, t: Date.now() };
    if (Date.now() - h.t > 60000) { h.n = 0; h.t = Date.now(); }
    if (++h.n > 40) return res.status(429).json({ error: 'Troppe richieste' });
    hits.set(key, h);
    const room = rooms.get(roomId);
    const names = room ? [...room.peers.values()].map(p => String(p.displayName || '').slice(0, 50)).filter(Boolean) : [];
    res.set('Cache-Control', 'no-store');
    res.json({ names: names.slice(0, 12), count: names.length });
  });
}

module.exports = { bindSocket, installHttp, lobbyPositions, isEnding, refuseProduce };
