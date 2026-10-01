'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   Connection Log
   Diagnostica delle cadute di connessione. Ogni evento va:
     1. su console con prefisso [CONN]  →  docker logs td-meet | grep CONN
     2. in un ring buffer in memoria    →  GET /api/connlog?room=XXX (host auth)
                                           oppure tdConnLog() dalla console browser
   Eventi tracciati: join/leave (con reason socket.io spiegata), stati ICE/DTLS
   server-side, tuple ICE selezionato (UDP/TCP + IP remoto → relay TURN?), stati
   ICE client-side, info rete del client (4g/wifi, rtt, downlink), visibilità
   pagina (schermo bloccato / app in background su mobile), online/offline,
   snapshot stats (packet loss, jitter, bitrate) alla disconnessione.
   ═══════════════════════════════════════════════════════════════════════════ */

const MAX_EVENTS = 600;
const _buf = [];

/* Spiegazione delle reason di socket.io — è IL dato per capire una caduta */
const DISCONNECT_REASONS = {
  'ping timeout':                'rete del client MORTA silenziosamente (segnale perso, wifi↔4G, galleria, tunnel)',
  'transport close':             'connessione chiusa dal client: tab chiusa, app in background/schermo bloccato (iOS), cambio rete',
  'transport error':             'errore di trasporto: proxy/rete ha troncato il websocket',
  'client namespace disconnect': 'disconnessione ESPLICITA del client (ha premuto esci / reload)',
  'server namespace disconnect': 'disconnessione forzata dal server',
  'forced close':                'chiusura forzata',
  'parse error':                 'pacchetto malformato',
};

function explainReason(reason) {
  return DISCONNECT_REASONS[reason] || reason || '?';
}

/* Sintesi user-agent: browser + mobile/desktop, senza loggare la stringa intera */
function summarizeUA(ua) {
  ua = String(ua || '');
  const mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  let browser = 'altro';
  if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari';
  let os = 'altro';
  if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';
  return { browser, os, mobile };
}

/* IP reale dietro NPMplus */
function clientIp(socket) {
  const h = socket?.handshake?.headers || {};
  // ⭐ FIX R11: x-real-ip è impostato da NPMplus ($remote_addr) e non è
  // falsificabile dal client; il primo valore di XFF invece sì (solo diagnostica).
  if (h['x-real-ip']) return String(h['x-real-ip']).trim();
  const xff = h['x-forwarded-for'];
  if (xff) { const parts = String(xff).split(',').map(x => x.trim()).filter(Boolean); return parts[parts.length - 1]; }
  return socket?.handshake?.address || '?';
}

function fmtDetails(d) {
  if (!d || typeof d !== 'object') return '';
  return Object.entries(d)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join(' ');
}

/**
 * Registra un evento di connessione.
 * @param {string} roomId
 * @param {string} peer   display name (o socket id se non ancora peer)
 * @param {string} event  join | leave | ice | dtls | tuple | client-ice | net | visibility | stats | lobby
 * @param {object} details
 */
function log(roomId, peer, event, details = {}) {
  const entry = { ts: new Date().toISOString(), room: roomId || '?', peer: peer || '?', event, ...details };
  _buf.push(entry);
  if (_buf.length > MAX_EVENTS) _buf.shift();
  const level = (event === 'leave' || event === 'ice' && /disconnected|failed|closed/.test(details.state || '')) ? 'warn' : 'log';
  console[level](`[CONN] ${entry.ts} room=${entry.room} peer="${entry.peer}" ${event} ${fmtDetails(details)}`);
}

/** Ultimi eventi, filtrabili per stanza/peer */
function list({ room, peer, limit = 200 } = {}) {
  let out = _buf;
  if (room) out = out.filter(e => e.room === room);
  if (peer) out = out.filter(e => String(e.peer).toLowerCase().includes(String(peer).toLowerCase()));
  return out.slice(-Math.min(Number(limit) || 200, MAX_EVENTS));
}

/**
 * Snapshot stats di un transport mediasoup → compatto e leggibile.
 * iceSelectedTuple.remoteIp = IP con cui il server parla: se è l'IP del coturn
 * il client sta passando da RELAY (rete restrittiva/NAT simmetrico → più fragile).
 */
async function transportSnapshot(transport) {
  try {
    const [s] = await transport.getStats();
    if (!s) return null;
    const t = s.iceSelectedTuple || {};
    return {
      dir: transport.appData?.direction || '?',
      ice: s.iceState, dtls: s.dtlsState,
      proto: t.protocol, remote: t.remoteIp ? `${t.remoteIp}:${t.remotePort}` : undefined,
      recvKbps: Math.round((s.recvBitrate || 0) / 1000),
      sendKbps: Math.round((s.sendBitrate || 0) / 1000),
      lossRecv: s.rtpPacketLossReceived != null ? Number(s.rtpPacketLossReceived).toFixed(3) : undefined,
      lossSent: s.rtpPacketLossSent != null ? Number(s.rtpPacketLossSent).toFixed(3) : undefined,
      availOutKbps: s.availableOutgoingBitrate ? Math.round(s.availableOutgoingBitrate / 1000) : undefined,
    };
  } catch (e) { return null; }
}

/** Snapshot producer (uplink del client verso il server): loss, jitter, score */
async function producerSnapshot(producer) {
  try {
    const stats = await producer.getStats();
    const s = stats.find(x => x.type === 'inbound-rtp') || stats[0];
    if (!s) return null;
    return {
      kind: producer.kind,
      type: producer.appData?.mediaType,
      score: s.score,
      lost: s.packetsLost,
      fracLost: s.fractionLost != null ? (s.fractionLost / 256).toFixed(3) : undefined,
      jitterMs: s.jitter != null ? Math.round(s.jitter / 48) : undefined, // clockrate 48k audio; per video approssimato
      rtt: s.roundTripTime != null ? Math.round(s.roundTripTime) : undefined,
      kbps: Math.round((s.bitrate || 0) / 1000),
    };
  } catch (e) { return null; }
}

module.exports = { log, list, explainReason, summarizeUA, clientIp, transportSnapshot, producerSnapshot };
