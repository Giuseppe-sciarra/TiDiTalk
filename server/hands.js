'use strict';
/**
 * 1.8.0 — Mani alzate in coda.
 * Il server segna l'ora in cui si alza la mano (la coda è in ordine d'arrivo,
 * non si fida dell'orologio del client) e decide chi può abbassarla:
 * la persona stessa, oppure un organizzatore (anche «Abbassa tutte»).
 * Niente più abbassamento fisso dopo 10 s: la mano si abbassa quando la
 * persona ha parlato (lo decide il suo browser) o la abbassa qualcuno.
 */

/** Alza/abbassa la propria mano. */
function raise(io, room, peer, raised) {
  if (raised && peer.handRaised) return;                 // già in coda: non perde il posto
  if (!raised && !peer.handRaised) return;
  peer.handRaised = !!raised;
  peer.handRaisedAt = raised ? Date.now() : null;
  io.to(room.id).emit('peerHandRaise', {
    peerId: peer.id, displayName: peer.displayName, raised: peer.handRaised,
    at: peer.handRaisedAt || undefined, now: Date.now(),
  });
}

/** Coda attuale, in ordine d'arrivo (per chi entra in ritardo). */
function queue(room) {
  const out = [];
  for (const p of room.peers.values()) if (p.handRaised) out.push({ peerId: p.id, at: p.handRaisedAt || 0 });
  return out.sort((a, b) => a.at - b.at);
}

/** Eventi socket: handLower { peerId } oppure { all: true } */
function bind(socket, { io, room, peer, inRoom, take }) {
  socket.on('handLower', (d, callback) => {
    if (typeof callback !== 'function') callback = () => { };
    if (!inRoom() || !d || typeof d !== 'object' || Array.isArray(d)) return callback({ error: 'Non in stanza' });
    if (!take()) return callback({ error: 'Troppe richieste' });
    const r = room(), me = peer();
    let targets;
    if (d.all === true) {
      if (me.isGuest) return callback({ error: 'Solo gli organizzatori possono abbassare le mani degli altri' });
      targets = Array.from(r.peers.values()).filter(p => p.handRaised);
    } else {
      const t = r.peers.get(String(d.peerId || '').slice(0, 40));
      if (!t) return callback({ error: 'Partecipante non trovato' });
      if (t !== me && me.isGuest) return callback({ error: 'Solo gli organizzatori possono abbassare le mani degli altri' });
      targets = t.handRaised ? [t] : [];
    }
    for (const t of targets) {
      t.handRaised = false; t.handRaisedAt = null;
      io.to(r.id).emit('peerHandRaise', {
        peerId: t.id, displayName: t.displayName, raised: false, now: Date.now(),
        // chi l'ha abbassata (solo se non è la persona stessa): il nome lo mette il server
        by: t === me ? undefined : me.displayName,
      });
    }
    callback({ ok: true, lowered: targets.length });
  });
}

module.exports = { raise, queue, bind };
