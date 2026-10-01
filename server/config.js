require('dotenv').config({ quiet: true });

// ─── Utenti ──────────────────────────────────────────────────────────────────
// Nessun utente è più scritto nel codice. Gli utenti vivono nel DB (bcrypt) e si
// creano in due modi: dal pannello Impostazioni → Utenti, oppure con la variabile
// USERS in .env (vedi users-env.js e .env.template).

// ─── Server secret OBBLIGATORIA ──────────────────────────────────────────────
const SECRET = process.env.SERVER_SECRET;
if (!SECRET || SECRET.length < 32 || SECRET === 'cambiami_in_produzione' || SECRET === 'tdmeet_secret_cambiami') {
  console.error('[FATAL] SERVER_SECRET non impostata o troppo corta/default.');
  console.error('        Genera con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  console.error('        Impostala in .env come SERVER_SECRET=<hex>');
  process.exit(1);
}

// ─── CORS origins ────────────────────────────────────────────────────────────
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

// ─── STUN/TURN ───────────────────────────────────────────────────────────────
// TURN_HOST: hostname pubblico di coturn. Default = host di BASE_URL.
function _turnHost() {
  if (process.env.TURN_HOST) return process.env.TURN_HOST.trim();
  try { return new URL(process.env.BASE_URL || '').hostname; } catch { return ''; }
}
function buildIceServers() {
  const host = _turnHost();
  if (!host) return [];
  const port = parseInt(process.env.TURN_PORT || '3478', 10);
  const list = [{ urls: `stun:${host}:${port}` }];
  if (process.env.TURN_USER && process.env.TURN_PASSWORD) {
    list.push({
      urls: [`turn:${host}:${port}?transport=udp`, `turn:${host}:${port}?transport=tcp`],
      username: process.env.TURN_USER,
      credential: process.env.TURN_PASSWORD,
    });
  }
  return list;
}
const ICE_SERVERS = buildIceServers();

module.exports = {
  auth: {
    tokenExpiresSec: parseInt(process.env.TOKEN_EXPIRES_SEC || (8 * 60 * 60)),  // 8 ore
    guestTokenDefaultHours: parseInt(process.env.GUEST_TOKEN_HOURS || '24'),     // era 48h, ora 24h
    loginMaxAttempts: parseInt(process.env.LOGIN_MAX_ATTEMPTS || '10'),
    loginLockoutMin: parseInt(process.env.LOGIN_LOCKOUT_MIN || '15'),
  },

  brand: {
    // Default del nome prodotto (sovrascrivibile da Impostazioni → Brand)
    appName: (process.env.APP_NAME || 'Tiditalk').trim(),
  },

  server: {
    port: process.env.PORT || 3010,
    secret: SECRET,
    corsOrigins: CORS_ORIGINS,
    baseUrl: process.env.BASE_URL || '',
  },

  mediasoup: {
    numWorkers: Math.min(require('os').cpus().length, 4),

    workerSettings: {
      logLevel: 'warn',
      logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
      rtcMinPort: process.env.RTC_MIN_PORT ? parseInt(process.env.RTC_MIN_PORT) : 40000,
      rtcMaxPort: process.env.RTC_MAX_PORT ? parseInt(process.env.RTC_MAX_PORT) : 40400, // era 40100 (100 porte): troppo poche per stanze da 20. RICORDA: apri 40000-40400/udp+tcp su firewall/Docker
    },

    routerOptions: {
      mediaCodecs: [
        { kind: 'audio', mimeType: 'audio/opus', clockRate: 48000, channels: 2 },
        { kind: 'video', mimeType: 'video/VP8', clockRate: 90000, parameters: { 'x-google-start-bitrate': 400 } },
        { kind: 'video', mimeType: 'video/VP9', clockRate: 90000, parameters: { 'profile-id': 2, 'x-google-start-bitrate': 400 } },
        { kind: 'video', mimeType: 'video/h264', clockRate: 90000, parameters: { 'packetization-mode': 1, 'profile-level-id': '4d0032', 'level-asymmetry-allowed': 1, 'x-google-start-bitrate': 400 } },
        { kind: 'video', mimeType: 'video/h264', clockRate: 90000, parameters: { 'packetization-mode': 1, 'profile-level-id': '42e01f', 'level-asymmetry-allowed': 1, 'x-google-start-bitrate': 400 } },
      ],
    },

    webRtcTransportOptions: {
      listenInfos: [
        { protocol: 'udp', ip: '0.0.0.0', announcedAddress: process.env.ANNOUNCED_IP || null },
        { protocol: 'tcp', ip: '0.0.0.0', announcedAddress: process.env.ANNOUNCED_IP || null },
      ],
      initialAvailableOutgoingBitrate: 400000,
      minimumAvailableOutgoingBitrate: 150000,
      maxSctpMessageSize: 262144,
      maxIncomingBitrate: 3000000, // era 1500000: strozzava r2 1080p/2Mbps. 3Mbps copre r0+r1+r2 (2.75Mbps) con margine
      iceServers: ICE_SERVERS,
    },

    screenShareTransportOptions: {
      listenInfos: [
        { protocol: 'udp', ip: '0.0.0.0', announcedAddress: process.env.ANNOUNCED_IP || null },
        { protocol: 'tcp', ip: '0.0.0.0', announcedAddress: process.env.ANNOUNCED_IP || null },
      ],
      initialAvailableOutgoingBitrate: 4000000,
      maxSctpMessageSize: 262144,
      iceServers: ICE_SERVERS,
    },
  },
};
