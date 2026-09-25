'use strict';

// ─── Join trace: logging mirato per diagnosticare problemi reali di join ───────
// Ogni tappa del join (prejoin, transport, produce, consume, play) viene loggata in
// console con prefisso [JOIN] E salvata in un ring buffer. Quando un utente ha un
// problema, basta che apra la console e lanci tdJoinReport() per avere tutto lo storico.
window._tdJoinTrace = [];
function _jlog(tag, data) {
  const e = { t: new Date().toISOString().slice(11, 23), tag, ...(data || {}) };
  window._tdJoinTrace.push(e);
  if (window._tdJoinTrace.length > 300) window._tdJoinTrace.shift();
  console.log('[JOIN]', tag, data || '');
}
window.tdJoinReport = function () {
  console.table(window._tdJoinTrace);
  return window._tdJoinTrace;
};

// ─── Parametri URL ────────────────────────────────────────────────────────────
const params = new URLSearchParams(window.location.search);
const ROOM_ID = window.location.pathname.split('/').pop();
let DISPLAY_NAME_DEFAULT = localStorage.getItem('vc_displayName') || params.get('name') || '';

// ─── Stato globale ────────────────────────────────────────────────────────────
let device, socket, sendTransport, recvTransport;
let DISPLAY_NAME = DISPLAY_NAME_DEFAULT || 'Anonimo';

const producers = new Map();
const consumers = new Map();
const peers = new Map();
// ⭐ FIX entrata-muto: stato mic/cam a scope modulo, condiviso tra init (prejoin)
// e i toggle in bindControls. Prima bindControls li ridichiarava a false → entrando
// muti il primo click sul mic/camera invertiva lo stato sbagliato (due click per smutare).
let micMuted = false;
let camOff = false;
const peerTiles = new Map();
const peerStreams = new Map();

let audioContext;
const speakingStates = new Map();
const speakingTimers = new Map();
// Esponi speakingStates globalmente per ParticipantList
window._speakingStates = speakingStates;

let callStartTime = Date.now();
let timerInterval;
let unreadCount = 0;
let chatOpen = false;

let rawCamStream = null;

let recorder = null;
let isRecording = false;

let localMicTrack, localCamTrack;
// Esposti globalmente per DeviceSelector
Object.defineProperty(window, '_localMicTrack', { get: () => localMicTrack, set: v => localMicTrack = v });
Object.defineProperty(window, '_localCamTrack', { get: () => localCamTrack, set: v => localCamTrack = v });

// Moduli aggiuntivi
let sounds = null;
let participantList = null;
let prejoin = null;
let deviceSelector = null;
let annotator = null; // disegno sullo schermo condiviso (annotate.js)
let faceEffects = null;
// Getter live per accesso cross-file (es. devices.js controlla se un effetto è attivo)
Object.defineProperty(window, 'faceEffects', { get: () => faceEffects, configurable: true });
let _currentFaceEffectId = null; // Track effetto viso attivo per save/restore
let _currentStyle = null; // Color style attivo (indipendente dall'effetto viso)
let pinnedPeerId = null;  // null = auto-layout

// ─── Init ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  // Verifica auth — redirect al login se token mancante, SALVO guest token valido
  const _token = localStorage.getItem('tdmeet_token');
  const _guestToken = sessionStorage.getItem('tdmeet_guest_token');

  if (!_token && !_guestToken) {
    // Conserva la destinazione (es. /room/ABCD123) per il post-login
    const next = encodeURIComponent(window.location.pathname);
    window.location.href = '/?next=' + next;
    return;
  }
  // Guest: nascondi link invito subito e dopo render
  if (_guestToken) {
    const _hl = () => { const el = document.getElementById('btnCopyLink'); if (el) el.style.display = 'none'; };
    _hl(); setTimeout(_hl, 300); setTimeout(_hl, 1500);
  }

  if (_token) {
    try {
      const _r = await fetch('/api/auth/verify', { headers: { 'x-auth-token': _token } });
      if (_r.status === 401) {
        localStorage.removeItem('tdmeet_token');
        if (!_guestToken) {
          const next = encodeURIComponent(window.location.pathname);
          window.location.href = '/?next=' + next;
          return;
        }
      }
      if (_r.ok) { const _u = await _r.json(); if (!DISPLAY_NAME_DEFAULT && _u.displayName) { DISPLAY_NAME_DEFAULT = _u.displayName; localStorage.setItem('vc_displayName', _u.displayName); } }
    } catch { /* errore di rete, continua comunque */ }
  }

  sounds = new SoundManager();
  deviceSelector = new DeviceSelector();
  participantList = new ParticipantList();
  prejoin = new PreJoin();

  document.getElementById('roomIdDisplay').textContent = ROOM_ID;
  document.title = `${ROOM_ID} · ${window.__BRAND?.branding?.platformName || document.title.split('·').pop().trim()}`;

  startClock();
  bindControls();
  updateSoundIcon();

  // Mostra loading, poi pre-join gestirà il resto
  document.getElementById('loadingScreen').classList.remove('hidden');

  try {
    // ── 1. Pre-join screen ────────────────────────────────────────────────────
    const pjResult = await prejoin.show(ROOM_ID, DISPLAY_NAME_DEFAULT);
    DISPLAY_NAME = pjResult.displayName;

    // Usa lo stream dalla pre-join (già acquisito, non riacquistare)
    rawCamStream = pjResult.stream;
    localMicTrack = rawCamStream?.getAudioTracks()[0] || null;
    localCamTrack = rawCamStream?.getVideoTracks()[0] || null;

    // FIX: esponi i track e gli ID device scelti per gli altri moduli (devices.js, fallback produceAudio)
    window._localMicTrack = localMicTrack;
    window._localCamTrack = localCamTrack;
    window._tdmeetSelectedAudio = pjResult.audioDeviceId || null;
    window._tdmeetSelectedVideo = pjResult.videoDeviceId || null;
    // ⭐ risoluzione con cui la camera è partita: è quella a cui tornare dopo
    // effetti e sfondi (prima si ripiegava su 1280×720, o peggio sul default
    // del browser, e il video restava più sgranato di come era partito)
    try {
      const s0 = localCamTrack?.getSettings?.() || {};
      if (s0.width) window._camPreferred = { width: s0.width, height: s0.height, deviceId: s0.deviceId, frameRate: s0.frameRate };
    } catch (_) { }

    // ⭐ Speaker scelto nel prejoin → applica a tutti gli audio remoti che verranno creati
    if (pjResult.speakerDeviceId) {
      window._tdmeetSpeakerId = pjResult.speakerDeviceId;
    }

    // ⭐ Hot-plug device: se l'utente collega/scollega cuffie/mic in corsa, aggiorna automaticamente
    setupDeviceChangeWatcher();

    // Sanity check: se il prejoin ha restituito uno stream senza audio track,
    // avvisa l'utente (succede se l'utente ha negato il permesso al microfono)
    if (!localMicTrack && !pjResult.micMuted) {
      console.warn('[init] prejoin senza audio track — produceAudio userà fallback getUserMedia');
    }

    // Sincronizza stato mute/cam dalla pre-join (variabili a scope modulo)
    micMuted = pjResult.micMuted;
    camOff = pjResult.camOff;
    _jlog('prejoin', {
      micMuted, camOff,
      hasAudioTrack: !!localMicTrack,
      hasVideoTrack: !!localCamTrack,
      micLabel: localMicTrack?.label || null,
    });

    // Mostra loading
    document.getElementById('loadingScreen').classList.remove('hidden');
    setLoading('Connessione al server...');

    // ── 2. Socket + Join ──────────────────────────────────────────────────────
    await initSocket();
    setLoading('Configurazione media...');
    annotator = new Annotator(socket);
    window._annotator = annotator;

    // FIX: cattura il risultato di joinRoom (prima non veniva salvato → res undefined)
    const joinRes = await joinRoom(micMuted, camOff);

    // ── LOBBY: server ha risposto "waitingForHost" ────────────────────────────
    // Il guest è in lobby server-side. Niente transport/producer creati.
    // Mostra overlay e ascolta hostAvailable per riemettere joinRoom.
    if (joinRes && joinRes.waitingForHost) {
      hideLoading();
      showGuestWaitOverlay();

      // Ascolta evento server "host arrivato": completa il join
      socket.once('hostAvailable', async () => {
        console.log('[lobby] host arrivato, completo il join');
        try {
          hideGuestWaitOverlay();
          setLoading('Ingresso in stanza...');
          document.getElementById('loadingScreen').classList.remove('hidden');
          const res2 = await joinRoom(micMuted, camOff);
          if (res2 && res2.error) throw new Error(res2.error);
          if (micMuted) {
            document.getElementById('btnMic').classList.add('off');
            document.querySelector('#btnMic .icon-on').classList.add('hidden');
            document.querySelector('#btnMic .icon-off').classList.remove('hidden');
            setTileMuted('local', true);
          }
          if (camOff) {
            document.getElementById('btnCamera').classList.add('off');
            document.querySelector('#btnCamera .icon-on').classList.add('hidden');
            document.querySelector('#btnCamera .icon-off').classList.remove('hidden');
          }
          startCallTimer();
          hideLoading();
          setTimeout(() => startTour(false), 900);
          deviceSelector?.init(producers, rawCamStream);
          showToast?.('✅ L\'host è entrato. Buona riunione!', 4000);
        } catch (e) {
          console.error('[lobby join retry]', e);
          setLoading('Errore: ' + e.message);
        }
      });

      // Ritorna senza fare il setup mediasoup (lo fa hostAvailable)
      return;
    }

    // Aggiorna UI pulsanti se mic/cam già spenti dalla pre-join
    if (micMuted) {
      document.getElementById('btnMic').classList.add('off');
      document.querySelector('#btnMic .icon-on').classList.add('hidden');
      document.querySelector('#btnMic .icon-off').classList.remove('hidden');
      setTileMuted('local', true);
    }
    if (camOff) {
      document.getElementById('btnCamera').classList.add('off');
      document.querySelector('#btnCamera .icon-on').classList.add('hidden');
      document.querySelector('#btnCamera .icon-off').classList.remove('hidden');
    }

    // ⭐ Se l'utente è entrato già muto, avvia la detection "stai parlando ma sei muto"
    if (micMuted) startMuteWarningDetection();

    startCallTimer();
    hideLoading();
    setTimeout(() => startTour(false), 900);

    // Inizializza device selector con riferimenti a producers e stream
    deviceSelector?.init(producers, rawCamStream);

  } catch (err) {
    console.error('[init]', err);
    setLoading('Errore: ' + err.message);
  }
});

// ─── Guest wait overlay ───────────────────────────────────────────────────────
function showGuestWaitOverlay() {
  // Crea overlay bloccante sopra tutta la UI
  const overlay = document.createElement('div');
  overlay.id = 'guestWaitOverlay';
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:9999',
    'background:color-mix(in srgb, var(--bg, #121318) 94%, transparent)',
    'backdrop-filter:blur(10px)',
    '-webkit-backdrop-filter:blur(10px)',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'justify-content:center',
    'gap:20px',
    'color:#fff',
    'font-family:inherit',
    'padding:24px',
    'text-align:center',
  ].join(';');

  overlay.innerHTML = `
    <style>
      @keyframes _gwSpin { to { transform: rotate(360deg); } }
      #guestWaitOverlay .gw-spinner {
        width: 56px; height: 56px;
        border: 3px solid rgba(255,255,255,0.12);
        border-top-color: var(--accent, #e8913a);
        border-radius: 50%;
        animation: _gwSpin 1s linear infinite;
        flex-shrink: 0;
      }
      #guestWaitOverlay .gw-title {
        font-size: 20px; font-weight: 700; letter-spacing: -0.3px;
      }
      #guestWaitOverlay .gw-sub {
        font-size: 14px; color: rgba(255,255,255,0.5);
        max-width: 280px; line-height: 1.5;
      }
      #guestWaitOverlay .gw-leave {
        margin-top: 12px;
        padding: 10px 20px;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 8px;
        color: rgba(255,255,255,0.6);
        font-size: 13px;
        cursor: pointer;
        transition: background 0.2s;
      }
      #guestWaitOverlay .gw-leave:hover { background: rgba(255,255,255,0.14); }
    </style>
    <div class="gw-spinner"></div>
    <div class="gw-title">Aspettiamo l'organizzatore</div>
    <div class="gw-sub">Entrerai automaticamente appena si collega. Non serve ricaricare la pagina.</div>
    <button class="gw-leave" id="gwBtnLeave">Abbandona</button>
  `;

  document.body.appendChild(overlay);

  // Pulsante abbandona nell'overlay
  document.getElementById('gwBtnLeave').addEventListener('click', () => {
    rawCamStream?.getTracks().forEach(t => t.stop());
    socket?.disconnect();
    window.location.href = '/';
  });

  // Niente polling: l'overlay viene rimosso da hideGuestWaitOverlay()
  // chiamato esplicitamente dall'handler 'hostAvailable' o da hostLeft → reload.
}

function hideGuestWaitOverlay() {
  const overlay = document.getElementById('guestWaitOverlay');
  if (!overlay) return;
  overlay.style.transition = 'opacity 0.4s';
  overlay.style.opacity = '0';
  setTimeout(() => overlay.remove(), 420);
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function setLoading(t) { document.getElementById('loadingText').textContent = t; }
function hideLoading() { document.getElementById('loadingScreen').classList.add('hidden'); }

function startClock() {
  const el = document.getElementById('clock');
  const tick = () => el.textContent = new Date().toLocaleTimeString(I18n.locale, { hour: '2-digit', minute: '2-digit' });
  tick(); setInterval(tick, 30000);
}
function startCallTimer() {
  callStartTime = Date.now();
  const el = document.getElementById('callTimer');
  timerInterval = setInterval(() => {
    const s = Math.floor((Date.now() - callStartTime) / 1000);
    el.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }, 1000);
}
function updatePeerCount() {
  const n = peers.size + 1;
  document.getElementById('peerCount').textContent = n === 1 ? '1 partecipante' : `${n} partecipanti`;
}
function refreshParticipants() {
  participantList.refresh(peers, DISPLAY_NAME, 'local', speakingStates);
}
function showToast(msg, duration = 3500) {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg; c.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, duration);
}
function updateSoundIcon() {
  document.getElementById('soundOnIcon').classList.toggle('hidden', sounds.muted);
  document.getElementById('soundOffIcon').classList.toggle('hidden', !sounds.muted);
}

// ─── Video Tile ───────────────────────────────────────────────────────────────
function getInitials(n) { return escapeHtml(String(n || '?').trim().split(/\s+/).map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '?'); }
function getAvatarColor(id) {
  const cols = ['#1a73e8', '#34a853', '#9c27b0', '#ff5722', '#00bcd4', '#e91e63', '#ff9800', '#607d8b'];
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) % cols.length;
  return cols[Math.abs(h)];
}

/** Marca il riquadro quando il video è verticale (telefono in portrait):
 *  senza questo il ritaglio "cover" mostrava solo una fetta della persona. */
function _watchAspect(videoEl, tile) {
  if (!videoEl || !tile) return;
  const update = () => {
    if (!videoEl.videoWidth || !videoEl.videoHeight) return;
    tile.classList.toggle('is-portrait', videoEl.videoHeight > videoEl.videoWidth * 1.05);
  };
  videoEl.addEventListener('resize', update);
  videoEl.addEventListener('loadedmetadata', update);
  update();
  setTimeout(update, 800);
}

function createTile(peerId, displayName, isLocal = false) {
  // ⭐ FIX R11 (XSS): il nome arriva da QUALSIASI partecipante (anche guest) e
  // finiva crudo in innerHTML → un nome tipo <img onerror=...> eseguiva JS nel
  // browser dell'host (con accesso al token in localStorage).
  const safeName = escapeHtml(displayName);
  const tile = document.createElement('div');
  tile.className = 'video-tile' + (isLocal ? ' local' : '');
  tile.dataset.peerId = peerId;
  tile.innerHTML = `
    <video id="video-${peerId}" autoplay playsinline muted></video>
    <div class="avatar" id="avatar-${peerId}">
      <div class="avatar-circle" id="avatarCircle-${peerId}" style="background:${getAvatarColor(peerId)}">${getInitials(displayName)}</div>
      <span class="avatar-name">${safeName}</span>
    </div>
    <span class="tile-name-always" translate="no">${safeName}</span>
    <div class="tile-mute-badge" id="muteBadge-${peerId}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="1" y1="1" x2="23" y2="23"/>
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
        <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
      </svg>
    </div>
    <div class="tile-hand-badge" id="handBadge-${peerId}">✋</div>
    <div class="tile-netq" id="netq-${peerId}" ${isLocal ? 'data-level="3"' : ''} title="Qualità connessione — passa sopra per le statistiche"><i></i><i></i><i></i></div>
    <div class="speaking-eq" id="speakEq-${peerId}"><div class="eq-up"></div><div class="eq-down"></div></div>
    ${isLocal ? '' : `<button class="tile-rotate-btn" id="rotBtn-${peerId}" title="Ruota video (utile se il guest mobile è capovolto)">↻</button>`}`;
  peerTiles.set(peerId, tile);
  document.getElementById('videoGrid').appendChild(tile);
  _watchAspect(tile.querySelector('video'), tile);

  // ⭐ Bottone rotazione manuale: cicla 0° → 90° → 180° → 270° → mirror → 0°
  if (!isLocal) {
    const rotBtn = tile.querySelector('.tile-rotate-btn');
    rotBtn?.addEventListener('click', (e) => { e.stopPropagation(); cycleVideoRotation(peerId); });
  }

  // Riapplica eventuale rotazione salvata (per session) o ricevuta
  const savedRot = window._videoRotations?.get(peerId);
  if (savedRot != null) applyVideoRotation(peerId, savedRot);

  updateGridLayout();
  tile.classList.add('tile-entering');
  setTimeout(() => tile.classList.remove('tile-entering'), 300);
  return tile;
}

function removeTile(peerId) {
  const t = peerTiles.get(peerId); if (!t) return;
  t.style.animation = 'tile-enter 0.2s ease reverse forwards';
  setTimeout(() => { t.remove(); peerTiles.delete(peerId); updateGridLayout(); }, 200);
}
function updateGridLayout() {
  const g = document.getElementById('videoGrid');
  // ⭐ Pin legacy disabilitato: niente più layout a colonna che si sovrapponeva
  g.dataset.pinned = 'false';
  g.querySelectorAll('.video-tile').forEach(t => t.classList.remove('pinned-main', 'pinned-self'));

  // applySpotlight ripulisce PRIMA gli strip (rimuove .spotlight-strip e li riporta
  // nella griglia), poi decide spotlight vs griglia. In spotlight setta lui data-count.
  applySpotlight();

  // ⭐ FIX conteggio: in vista griglia calcolo data-count QUI, DOPO applySpotlight,
  // quando i tile sono già stati ripuliti dalla classe spotlight-strip. Prima lo
  // calcolavo all'inizio, ma uscendo dallo spotlight i tile avevano ancora .spotlight-strip
  // → contava 1 invece di 2 → CSS metteva 1 colonna → tile impilati.
  if (g.dataset.spotlight !== 'true') {
    g.dataset.count = Math.min(g.querySelectorAll('.video-tile:not(.spotlight-strip)').length, 20);
    // click su un tile → vista relatore con quel peer grande (il "tieni grande" di Meet)
    g.querySelectorAll('.video-tile').forEach(t => {
      t.onclick = () => window.togglePin(t.dataset.peerId);
    });
  }

  // riflette lo stato reale (auto o forzato) sul bottone Layout
  const _bl = document.getElementById('btnLayout');
  if (_bl) _bl.classList.toggle('active', g.dataset.spotlight === 'true');

  fitGridToViewport(); // riquadri dimensionati sullo spazio reale
  scheduleLayerUpdate(); // ⭐ ROUND 5: ricalcola i preferred layers dopo ogni cambio layout
}

/* ── Vista griglia: i riquadri si adattano allo spazio disponibile ─────────
   Il CSS da solo non ci riesce: con righe "auto" i riquadri 16:9 prendono
   l'altezza dalla larghezza e, su una finestra bassa, l'ultima fila finiva
   tagliata sotto la barra. Qui si calcola per ogni numero di colonne quanto
   può essere grande un riquadro 16:9 senza uscire né in larghezza né in
   altezza, e si sceglie la combinazione con i riquadri più grandi. Tutti i
   riquadri hanno la stessa misura, l'ultima fila incompleta resta centrata,
   il nome in basso resta sempre visibile. */
const _FIT_RATIO = 16 / 9;
let _fitRaf = 0;

function _clearGridFit(g) {
  if (!g || !g.dataset.fitted) return;
  ['display', 'flex-wrap', 'justify-content', 'align-content', 'align-items', 'grid-template-columns', 'grid-auto-rows'].forEach(p => g.style.removeProperty(p));
  g.querySelectorAll('.video-tile[data-fit]').forEach(t => {
    t.style.removeProperty('width'); t.style.removeProperty('height');
    t.style.removeProperty('max-width'); t.style.removeProperty('max-height');
    t.style.removeProperty('flex'); t.style.removeProperty('aspect-ratio');
    delete t.dataset.fit;
  });
  delete g.dataset.fitted;
}

function fitGridToViewport() {
  const g = document.getElementById('videoGrid');
  if (!g) return;
  const isGrid = g.dataset.spotlight !== 'true' && g.dataset.pinned !== 'true';
  // telefono: si usa sempre la vista relatore, ha già il suo layout
  if (!isGrid || window.innerWidth <= 820) { _clearGridFit(g); return; }

  const tiles = [...g.querySelectorAll(':scope > .video-tile')].filter(t => getComputedStyle(t).display !== 'none');
  const n = tiles.length;
  if (!n) { _clearGridFit(g); return; }

  const cs = getComputedStyle(g);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  const gap = parseFloat(cs.columnGap) || 10;
  const rgap = parseFloat(cs.rowGap) || gap;
  const W = g.clientWidth - padX;
  const H = g.clientHeight - padY;
  if (W <= 0 || H <= 0) return;

  let best = { w: 0, cols: 1 };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const byWidth = (W - gap * (cols - 1)) / cols;
    const byHeight = ((H - rgap * (rows - 1)) / rows) * _FIT_RATIO;
    const w = Math.floor(Math.min(byWidth, byHeight));
    if (w > best.w) best = { w, cols };
  }
  const w = Math.max(120, best.w);
  const h = Math.floor(w / _FIT_RATIO);

  // flex invece di grid: così l'ultima fila incompleta si centra da sola
  g.style.setProperty('display', 'flex', 'important');
  g.style.setProperty('flex-wrap', 'wrap', 'important');
  g.style.setProperty('justify-content', 'center', 'important');
  g.style.setProperty('align-content', 'center', 'important');
  g.style.setProperty('align-items', 'center', 'important');
  tiles.forEach(t => {
    t.style.setProperty('width', w + 'px', 'important');
    t.style.setProperty('height', h + 'px', 'important');
    t.style.setProperty('max-width', w + 'px', 'important');
    t.style.setProperty('max-height', h + 'px', 'important');
    t.style.setProperty('flex', `0 0 ${w}px`, 'important');
    t.style.setProperty('aspect-ratio', 'auto', 'important');
    t.dataset.fit = '1';
  });
  g.dataset.fitted = '1';
}

function _scheduleGridFit() {
  cancelAnimationFrame(_fitRaf);
  _fitRaf = requestAnimationFrame(fitGridToViewport);
}
window.addEventListener('resize', _scheduleGridFit);
document.addEventListener('DOMContentLoaded', () => {
  const g = document.getElementById('videoGrid');
  if (!g || !window.ResizeObserver) return;
  new ResizeObserver(_scheduleGridFit).observe(g);
  // tile che entrano/escono (anche fuori da updateGridLayout)
  new MutationObserver(_scheduleGridFit).observe(g, { childList: true });
});

/* ── Layout spotlight ─────────────────────────────────────────────────── */
let _spotlightMode = true;
let _spotlightOverride = null; // ⭐ null=auto (griglia ≤4, spotlight >4); true=forza barra laterale; false=forza griglia
let _spotlightPeer = null;
let _userSetLayout = true; // spotlight sempre attivo

/* ── ROUND 5: layer adattivo (adaptiveStream "manuale") ───────────────────────
 * Regola lo spatial layer di ogni consumer video remoto in base al ruolo del suo
 * tile nel layout corrente, così da non tirare 540p per 8 miniature e da alzare
 * il relatore a 1080p. Equivalente di ciò che LiveKit/plugNmeet fa in automatico.
 *  - .spotlight-main  → spatial 2 / temporal 2   (relatore: 1080p piena)
 *  - .spotlight-strip → spatial 0 / temporal 1   (miniatura: 270p, fps ridotto)
 *  - griglia (no spotlight) → spatial 1 / temporal 2 (540p)
 *  - cam spenta / tile assente → spatial 0 / temporal 1 (minimo)
 * Fire-and-forget verso il server (socket.emit senza await). Cache per-consumer
 * per non rimandare lo stesso layer a ogni re-render del layout. */
const _lastSentLayers = new Map(); // consumerId → "sl:tl"
let _layerUpdateTimer = null;

/* ── ROUND 5: tetto per-ricevente in base a DEVICE + RETE ──────────────────────
 * Il size-based qui sotto guarda solo quanto è grande il tile. Ma chiedere un
 * 1080p su un dispositivo scarso significa fargli DECODIFICARE 1080p → CPU a fuoco
 * (la banda la gestisce già mediasoup, la CPU no). Quindi calcoliamo un tetto
 * massimo di spatial layer per QUESTO client e ci clampiamo sopra.
 *   - saveData / 2g            → 0 (270p max)
 *   - 3g / downlink < 1.5Mbps  → 1 (540p max)
 *   - ≤2 core CPU o ≤2GB RAM   → 1 (decodifica 1080p troppo pesante)
 *   - mobile                   → 1 (schermo piccolo + risparmio batteria/dati)
 *   - tutto il resto           → 2 (1080p ok)
 * Nota: Safari/Firefox non espongono navigator.connection → in dubbio NON penalizza. */
let _maxSpatial = 2;
// ⭐ Risparmio dati: override manuale (persistito) che forza il layer minimo.
// Pensato per chi ha rete scarsa (mobile in campagna, hotspot): ~200-300 kbps
// in ricezione invece di 2-4 Mbps. Toggle nel menu ⋮ → "Risparmio dati".
let _dataSaver = false;
try { _dataSaver = localStorage.getItem('tdmeet_datasaver') === '1'; } catch (e) { /* ignore */ }

function _computeMaxSpatial() {
  if (_dataSaver) return 0; // ⭐ override manuale: sempre 270p
  let cap = 2;
  try {
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (c) {
      if (c.saveData === true) cap = 0;
      const et = c.effectiveType || '';
      if (et === 'slow-2g' || et === '2g') cap = 0;
      else if (et === '3g') cap = Math.min(cap, 1);
      if (typeof c.downlink === 'number' && c.downlink > 0) {
        if (c.downlink < 0.6) cap = 0;
        else if (c.downlink < 1.5) cap = Math.min(cap, 1);
      }
    }
    const cores = navigator.hardwareConcurrency;
    if (typeof cores === 'number' && cores > 0 && cores <= 2) cap = Math.min(cap, 1);
    const mem = navigator.deviceMemory;
    if (typeof mem === 'number' && mem > 0 && mem <= 2) cap = Math.min(cap, 1);
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) cap = Math.min(cap, 1);
  } catch { /* in dubbio lascia 2 */ }
  return cap;
}
_maxSpatial = _computeMaxSpatial();
// Ricalcola se la rete cambia (4g↔3g, attivazione risparmio dati) e riapplica
try {
  const _conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  _conn?.addEventListener?.('change', () => {
    const nv = _computeMaxSpatial();
    if (nv !== _maxSpatial) { _maxSpatial = nv; _lastSentLayers.clear(); scheduleLayerUpdate(); }
  });
} catch {}

/* ── layer adattivo per DIMENSIONE REALE del tile (clampato dal tetto) ─────────
 * Come Meet/Zoom: la risoluzione segue quanto è grande il riquadro. Pochi → tile
 * grandi → 1080p. Tanti → piccole → scala giù. Il risultato viene poi tagliato da
 * _maxSpatial per non sovraccaricare dispositivi/reti deboli. */
function _desiredLayerForTile(tile, videoOff) {
  if (videoOff || !tile) return { sl: 0, tl: 1 };
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = (tile.clientWidth || 0) * dpr;
  let sl, tl;
  if (w <= 0)        { sl = 1; tl = 2; }   // non ancora misurabile → media di sicurezza
  else if (w >= 850) { sl = 2; tl = 2; }   // riquadro grande → 1080p
  else if (w >= 420) { sl = 1; tl = 2; }   // riquadro medio → 540p
  else               { sl = 0; tl = 1; }   // miniatura → 270p
  sl = Math.min(sl, _maxSpatial);          // ⭐ tetto device/rete
  if (sl === 0) tl = Math.min(tl, 1);      // a 270p anche meno fps, alleggerisce
  return { sl, tl };
}

function updatePreferredLayers() {
  if (!socket || !device?.loaded) return;
  consumers.forEach((c) => {
    if (c.kind !== 'video') return;
    if (c.appData?.mediaType === 'screen') return; // screen = single layer → niente da fare
    const peerId = c.appData?.producerPeerId;
    if (!peerId) return;
    const tile = document.querySelector(`.video-tile[data-peer-id="${peerId}"]`);
    const { sl, tl } = _desiredLayerForTile(tile, peers.get(peerId)?.videoOff);
    const key = `${sl}:${tl}`;
    if (_lastSentLayers.get(c.id) === key) return; // già impostato → no spam
    _lastSentLayers.set(c.id, key);
    socket.emit('setConsumerLayers', { consumerId: c.id, spatialLayer: sl, temporalLayer: tl });
  });
}

// Debounce: il layout può rifire a raffica (resize, join/leave, toggle pin)
function scheduleLayerUpdate() {
  clearTimeout(_layerUpdateTimer);
  _layerUpdateTimer = setTimeout(updatePreferredLayers, 250);
}

function applySpotlight() {
  const grid = document.getElementById('videoGrid');

  // Rimuovi col precedente e ripristina tiles nel grid
  const oldCol = grid.querySelector('.spotlight-col');
  if (oldCol) { Array.from(oldCol.children).forEach(c => grid.appendChild(c)); oldCol.remove(); }

  const tiles = Array.from(grid.querySelectorAll('.video-tile'));
  tiles.forEach(t => {
    t.classList.remove('spotlight-main', 'spotlight-strip');
    if (t.classList.contains('local')) t.style.cssText = ''; // rimuovi PiP fixed residuo
    t.onclick = null;
  });
  grid.removeAttribute('data-spotlight');

  const hasScreen = tiles.some(t => t.classList.contains('screenshare'));
  const peopleTiles = tiles.filter(t => !t.classList.contains('screenshare'));
  const isMobile = window.matchMedia('(max-width: 640px)').matches;
  // ⭐ Mobile: sempre vista relatore (main + filmstrip orizzontale, come prima) —
  // la griglia a colonne sarebbe troppo stretta in verticale. Lo screen share forza
  // sempre lo spotlight. Desktop: override manuale (bottone Layout) o auto (griglia ≤4).
  const autoSpotlight = peopleTiles.length > 4;
  const wantSpotlight = (hasScreen || isMobile)
    ? true
    : (_spotlightOverride !== null ? _spotlightOverride : autoSpotlight);
  const shouldSpotlight = _spotlightMode && wantSpotlight;
  if (!shouldSpotlight) return;

  grid.dataset.spotlight = 'true';

  // Main: se l'utente ha scelto un peer (anche local) usalo,
  // altrimenti auto: screenshare > remote > primo disponibile
  let main = _spotlightPeer
    ? grid.querySelector(`[data-peer-id="${_spotlightPeer}"]`)
    : null;
  if (!main) main = tiles.find(t => t.classList.contains('screenshare'));
  if (!main) main = tiles.find(t => !t.classList.contains('local'));
  if (!main) main = tiles[0];
  if (!main) return;

  main.classList.add('spotlight-main');
  // click sul tile grande → toggle (a ≤4 torna alla griglia; a >4 resta spotlight)
  main.onclick = () => window.togglePin(main.dataset.peerId);

  // Strip: tutti tranne main — click su qualsiasi strip (anche locale) → diventa main
  const strips = tiles.filter(t => t !== main);
  const col = document.createElement('div');
  col.className = 'spotlight-col';
  strips.forEach(t => {
    t.classList.add('spotlight-strip');
    col.appendChild(t);
    t.onclick = () => { _spotlightPeer = t.dataset.peerId; applySpotlight(); };
  });

  // Appendi col DOPO il main nel DOM → main a sinistra, strip a destra
  grid.appendChild(col);

  // FIX: aggiorna data-count in base ai tile non-strip effettivi
  // evita che le regole CSS PiP (data-count="2") scattino con dati stale
  grid.dataset.count = Math.min(
    grid.querySelectorAll('.video-tile:not(.spotlight-strip)').length, 20
  );
}

window.togglePin = function (peerId) {
  // ⭐ "Pin/ingrandisci" ora usa il sistema spotlight (vista relatore con questo peer
  // come main). Il vecchio layout data-pinned (flex column) è stato rimosso perché
  // con 3+ persone impilava i tile a tutta larghezza e si sovrapponevano.
  if (_spotlightOverride === true && _spotlightPeer === peerId) {
    _spotlightOverride = null; _spotlightPeer = null; // de-pin → torna ad auto (griglia/relatore)
  } else {
    _spotlightOverride = true; _spotlightPeer = peerId;
  }
  updateGridLayout();
};

// Click sul tile locale → mette locale grande (relatore)
window.toggleLocalPin = function () { window.togglePin('local'); };

function setTileVideo(peerId, stream, hasVideo) {
  const _t = peerTiles.get(peerId);
  if (_t) _watchAspect(_t.querySelector('video'), _t);
  const v = document.getElementById(`video-${peerId}`);
  const a = document.getElementById(`avatar-${peerId}`);
  if (!v || !a) return;
  if (hasVideo && stream) {
    v.srcObject = stream; v.style.display = 'block'; a.style.display = 'none';
    // ⭐ FIX Safari/iOS "non vede gli altri": autoplay del video remoto spesso non
    // parte da solo dopo aver assegnato srcObject. Il video è muted (l'audio è su un
    // <audio> separato), quindi play() è sempre permesso dalle policy autoplay.
    v.muted = true;
    v.play?.().catch(() => { });
  } else {
    v.style.display = 'none'; a.style.display = 'flex';
  }
}
function setTileMuted(peerId, muted) { document.getElementById(`muteBadge-${peerId}`)?.classList.toggle('visible', muted); }
function setTileHand(peerId, raised) { document.getElementById(`handBadge-${peerId}`)?.classList.toggle('visible', raised); }
function setSpeaking(peerId, speaking) {
  if (speakingStates.get(peerId) === speaking) return;
  speakingStates.set(peerId, speaking);

  const el = document.getElementById(`speakEq-${peerId}`);
  if (el) el.classList.toggle('active', speaking);

  // Applica anche al tile stesso (classe .speaking sul container)
  // così possiamo usare box-shadow / border / qualsiasi effetto visibile
  const tile = peerTiles.get(peerId);
  if (tile) tile.classList.toggle('is-speaking', speaking);
  // Tile locale
  if (peerId === 'local') {
    const localTile = document.querySelector('.video-tile.local');
    if (localTile) localTile.classList.toggle('is-speaking', speaking);
  }

  if (speaking) console.log('[speaking] ▶ ACTIVE', peerId);
}

// ─── Media locale ─────────────────────────────────────────────────────────────
function initLocalMedia(micMuted, camOff) {
  createTile('local', DISPLAY_NAME, true);

  const v = document.getElementById('video-local');
  if (rawCamStream && !camOff) {
    v.srcObject = rawCamStream;
    v.muted = true; // locale sempre muto (anti-echo) → autoplay garantito
    v.style.display = 'block';
    document.getElementById('avatar-local').style.display = 'none';
    v.play?.().catch(() => { });
  } else {
    v.style.display = 'none';
    document.getElementById('avatar-local').style.display = 'flex';
  }
  v.style.transform = 'scaleX(-1)';

  initSpeakingDetection();
  refreshParticipants();
}

let _speakingRafId = null;
let _speakingSrcNode = null;   // ⭐ FIX leak: ref per disconnettere a ogni reinit
let _speakingAnalyser = null;
async function initSpeakingDetection() {
  if (!rawCamStream) {
    console.warn('[speaking] no rawCamStream');
    return;
  }
  try {
    if (_speakingRafId) { cancelAnimationFrame(_speakingRafId); _speakingRafId = null; }
    // ⭐ FIX leak: disconnetti i nodi della sessione precedente (switch mic / recovery)
    // altrimenti source+analyser restano agganciati all'AudioContext per sempre.
    try { _speakingSrcNode?.disconnect(); } catch { }
    try { _speakingAnalyser?.disconnect(); } catch { }
    _speakingSrcNode = null; _speakingAnalyser = null;

    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume con await — senza await può restare suspended per decine di ms
    if (audioContext.state === 'suspended') {
      try { await audioContext.resume(); } catch { }
    }
    console.log('[speaking] audioContext state:', audioContext.state);

    const audioTracks = rawCamStream.getAudioTracks();
    if (audioTracks.length === 0) {
      console.warn('[speaking] no audio tracks in rawCamStream');
      return;
    }

    const audioOnly = new MediaStream([audioTracks[0]]);
    const a = audioContext.createAnalyser();
    a.fftSize = 512;
    a.smoothingTimeConstant = 0.4;
    _speakingSrcNode = audioContext.createMediaStreamSource(audioOnly);
    _speakingSrcNode.connect(a);
    _speakingAnalyser = a;

    const data = new Uint8Array(a.frequencyBinCount);
    let _logCount = 0;
    const check = () => {
      a.getByteFrequencyData(data);
      const avg = data.slice(0, 64).reduce((s, b) => s + b, 0) / 64;
      // Log il valore ogni ~1s per i primi 10 secondi (debug)
      _logCount++;
      if (_logCount % 60 === 0 && _logCount < 600) {
        console.log('[speaking local] avg =', avg.toFixed(1), '(threshold 20)');
      }
      setSpeaking('local', avg > 20);
      _speakingRafId = requestAnimationFrame(check);
    };
    check();
    console.log('[speaking] local detector started, track:', audioTracks[0].label);
  } catch (e) { console.warn('[speaking]', e); }
}
window._reinitSpeakingDetection = initSpeakingDetection;

// Auto-unblock al primo (e ogni) gesture nella stanza: risveglia l'AudioContext E
// ritenta il play() su tutti i media remoti. Su iOS Safari il play() ha bisogno di
// un gesture; ascoltiamo pointerdown/touchstart/keydown/click (non solo click) perché
// su mobile un tap non sempre genera un evento 'click' (pattern preso da MiroTalk).
function _tdUnblockMedia() {
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume().catch(() => { });
  }
  if (window._tdmeetPeerAudios) {
    for (const [, a] of window._tdmeetPeerAudios) {
      if (a && a.srcObject && a.paused) a.play().catch(() => { });
    }
  }
  document.querySelectorAll('video').forEach(v => {
    if (v.srcObject && v.paused) v.play().catch(() => { });
  });
}
['pointerdown', 'touchstart', 'keydown', 'click'].forEach(ev =>
  document.addEventListener(ev, _tdUnblockMedia, { capture: true, passive: true })
);

// ─── Socket.io ────────────────────────────────────────────────────────────────
let _wasDisconnected = false; // true dopo una caduta socket → reload in arrivo (usato anche da _doIceRestart)
async function initSocket() {
  return new Promise((resolve, reject) => {
    // ⭐ FIX BUG 16: configurazione robusta per reconnection.
    // Default socket.io ha già reconnection on, ma con backoff piuttosto aggressivo.
    socket = io({
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });
    window._tdmeetSocket = socket; // accesso cross-file (es. devices.js)
    socket.on('connect', resolve);
    socket.on('connect_error', reject);

    // ⭐ FIX BUG 16: feedback all'utente quando la rete WebSocket cade/torna.
    // Senza, l'utente non capiva perché non riceveva più chat o eventi peerJoined.
    let _reconnectToast = null;

    socket.on('disconnect', (reason) => {
      console.warn('[socket] disconnesso:', reason);
      _wasDisconnected = true;
      // Mostra banner "connessione persa" (persistente fino al reconnect)
      _reconnectToast?.remove();
      _reconnectToast = document.createElement('div');
      _reconnectToast.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);background:#e5534b;color:#fff;padding:10px 18px;border-radius:999px;z-index:99999;font-family:inherit;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
      _reconnectToast.textContent = 'Connessione persa, riprovo…';
      document.body.appendChild(_reconnectToast);
    });

    socket.io.on('reconnect', (attempt) => {
      console.log('[socket] riconnesso dopo', attempt, 'tentativi');
      _reconnectToast?.remove();
      _reconnectToast = null;
      // Se la disconnessione è stata lunga, il server ci ha già rimosso dalla stanza:
      // serve un page reload per ri-joinare con un nuovo peerId, transport, producer.
      // (un re-join in-place richiederebbe ricostruire tutto lo stato mediasoup,
      // che è 10x più complicato del semplice reload).
      if (_wasDisconnected) {
        showToast?.('🔄 Riconnessione completata, ricarico la stanza…', 2000);
        setTimeout(() => location.reload(), 1500);
      }
    });

    socket.io.on('reconnect_attempt', (attempt) => {
      if (_reconnectToast) {
        _reconnectToast.textContent = `Connessione persa, riprovo (tentativo ${attempt})…`;
      }
    });

    // ⭐ Indicatore qualità rete: il server manda il livello (3=buona 2=media
  // 1=scarsa) calcolato dagli score mediasoup dei producer del peer (uplink).
  socket.on('peerNetQuality', ({ peerId, level }) => {
    const el = document.getElementById(`netq-${peerId}`);
    if (!el) return;
    el.dataset.level = level;
    el.title = level === 3 ? 'Connessione buona' : level === 2 ? 'Connessione instabile' : 'Connessione scarsa';
  });

  socket.on('peerJoined', (peer) => {
      peers.set(peer.id, peer);
      createTile(peer.id, peer.displayName);
      // ⭐ FIX entrata-muto: rifletti subito lo stato mute/video del nuovo peer
      setTileMuted(peer.id, peer.audioMuted);
      if (peer.handRaised) setTileHand(peer.id, true);
      // ⭐ FIX race: se 'newProducer' è arrivato PRIMA di 'peerJoined' (raro ma possibile),
      // il video era stato consumato e salvato in peerStreams ma setTileVideo era fallito
      // perché il tile non esisteva ancora. Ora che il tile c'è, lo ri-attacchiamo.
      const cached = peerStreams.get(peer.id);
      if (cached?.video && !peer.videoOff) setTileVideo(peer.id, cached.video, true);
      _jlog('peerJoined', { peer: peer.id, name: peer.displayName, audioMuted: peer.audioMuted, videoOff: peer.videoOff, hadCachedVideo: !!cached?.video });
      updatePeerCount();
      refreshParticipants();
      showToast(`${peer.displayName} è entrato nella riunione`);
      sounds.join();
      recorder?.refreshAudio();
    });

    socket.on('peerLeft', ({ peerId, displayName }) => {
      // FIX: rimuovi anche l'<audio> remoto dal DOM, non solo dalla Map
      const remoteAudio = window._tdmeetPeerAudios?.get(peerId);
      if (remoteAudio) {
        try { remoteAudio.pause(); remoteAudio.srcObject = null; remoteAudio.remove(); } catch { }
      }
      window._tdmeetPeerAudios?.delete(peerId);
      // ⭐ FIX screen-audio: rimuovi anche l'eventuale audio schermo del peer uscito
      const remoteScreenAudio = window._tdmeetPeerAudios?.get(`${peerId}-screen`);
      if (remoteScreenAudio) {
        try { remoteScreenAudio.pause(); remoteScreenAudio.srcObject = null; remoteScreenAudio.remove(); } catch { }
      }
      window._tdmeetPeerAudios?.delete(`${peerId}-screen`);
      peerStreams.delete(`${peerId}-screen`);
      annotator?.detach(peerId);
      document.querySelector(`[data-peer-id="${peerId}-screen"]`)?.remove();
      peers.delete(peerId);
      // Cleanup speaking detector interval
      if (typeof _remoteSpeakingIntervals !== 'undefined') {
        const iid = _remoteSpeakingIntervals.get(peerId);
        if (iid) { clearInterval(iid); _remoteSpeakingIntervals.delete(peerId); }
      }
      removeTile(peerId);
      peerStreams.delete(peerId);
      speakingStates.delete(peerId);
      clearTimeout(speakingTimers.get(peerId)); speakingTimers.delete(peerId);
      updatePeerCount();
      refreshParticipants();
      showToast(`${displayName} ha lasciato la riunione`);
      sounds.leave();
    });

    // ── LOBBY: l'ultimo host è uscito, server ci ha rimesso in lobby ─────────
    // Reload pulito: tornerà nel prejoin → joinRoom → server risponde
    // waitingForHost → overlay. Più semplice e robusto del teardown manuale.
    socket.on('hostLeft', () => {
      try { rawCamStream?.getTracks().forEach(t => t.stop()); } catch { }
      try { socket?.disconnect(); } catch { }
      // Notifica visiva prima del reload
      const msg = document.createElement('div');
      msg.style.cssText = 'position:fixed;inset:0;z-index:99999;background:var(--bg,#121318);display:flex;align-items:center;justify-content:center;color:#fff;font-family:inherit;font-size:16px;text-align:center;padding:24px;';
      msg.textContent = 'L\'host ha lasciato la riunione. Verrai rimesso in attesa…';
      document.body.appendChild(msg);
      setTimeout(() => location.reload(), 1500);
    });

    socket.on('peerMediaState', ({ peerId, type, status }) => {
      const peer = peers.get(peerId); if (!peer) return;
      if (type === 'audio') { peer.audioMuted = status; setTileMuted(peerId, status); }
      if (type === 'video') { peer.videoOff = status; setTileVideo(peerId, (peerStreams.get(peerId) || {}).video, !status); }
      refreshParticipants();
    });

    socket.on('peerHandRaise', ({ peerId, displayName, raised }) => {
      if (peerId === socket.id) { document.getElementById('btnHand').classList.toggle('active', raised); }
      const peer = peers.get(peerId); if (peer) peer.handRaised = raised;
      setTileHand(peerId, raised);
      refreshParticipants();
      if (raised) showToast(`✋ ${displayName} ha alzato la mano`);
    });

    socket.on('peerReaction', ({ emoji }) => spawnReaction(emoji));

    socket.on('newProducer', async ({ producerId, peerId, kind, appData, audioMuted, videoOff }) => {
      _jlog('newProducer', { peer: peerId, kind, tileExists: !!document.getElementById(`video-${peerId}`) });
      // ⭐ FIX mute-fantasma: riallinea mic/camera con lo stato autoritativo del
      // server (vedi server/index.js). Copre il caso in cui 'peerMediaState' è
      // stato droppato dal rate limiter durante l'avvio dello screen share.
      const _pr = peers.get(peerId);
      if (_pr && audioMuted !== undefined) { _pr.audioMuted = audioMuted; setTileMuted(peerId, audioMuted); }
      if (_pr && videoOff !== undefined) { _pr.videoOff = videoOff; }
      if (_pr) refreshParticipants();
      await consume(producerId, peerId, kind, appData);
    });

    // ⭐ FIX mute-fantasma: stato REALE del producer inoltrato dal server
    // (mediasoup-client non emette producerpause/resume: erano codice morto).
    // GUARD su mediaType: 'screen-audio' NON deve toccare l'icona del microfono,
    // 'screen' non deve toccare il video della camera.
    socket.on('consumerProducerState', ({ peerId, kind, mediaType, paused }) => {
      const pr = peers.get(peerId);
      if (kind === 'audio' && mediaType === 'audio') {
        if (pr) pr.audioMuted = paused;
        setTileMuted(peerId, paused); refreshParticipants();
      } else if (kind === 'video' && mediaType === 'video') {
        if (pr) pr.videoOff = paused;
        setTileVideo(peerId, paused ? null : (peerStreams.get(peerId) || {}).video, !paused);
        refreshParticipants();
      }
    });

    socket.on('producerClosed', ({ producerId, peerId, mediaType }) => {
      _consumedProducers.delete(producerId); // libera per un eventuale ri-consume futuro
      // ⭐ FIX screen-audio: rimuovi l'<audio> dello schermo quando la condivisione finisce
      if (mediaType === 'screen-audio') {
        const sa = window._tdmeetPeerAudios?.get(`${peerId}-screen`);
        if (sa) { try { sa.pause(); sa.srcObject = null; sa.remove(); } catch { } }
        window._tdmeetPeerAudios?.delete(`${peerId}-screen`);
        peerStreams.delete(`${peerId}-screen`);
      }
      if (mediaType === 'audio') {
        const ma = window._tdmeetPeerAudios?.get(peerId);
        if (ma) { try { ma.pause(); ma.srcObject = null; ma.remove(); } catch { } }
        window._tdmeetPeerAudios?.delete(peerId);
      }
      consumers.forEach((c, id) => {
        if (c.producerId !== producerId) return;
        c.close(); consumers.delete(id);
        // Nasconde il video camera SOLO se è il producer camera a chiudersi,
        // NON quando è lo screen share (altrimenti la camera scompare dopo ogni condivisione)
        if (c.kind === 'video' && mediaType !== 'screen') {
          document.getElementById(`video-${peerId}`)?.style.setProperty('display', 'none');
          document.getElementById(`avatar-${peerId}`)?.style.setProperty('display', 'flex');
        }
      });
      const _ss = document.querySelector(`[data-peer-id="${peerId}-screen"]`) || document.querySelector(`[data-peer-id="${peerId}"].screenshare`);
      if (_ss && mediaType === 'screen') annotator?.detach(peerId);
      if (_ss) { _ss.remove(); updateGridLayout(); }
    });

    socket.on('chatMessage', (msg) => {
      appendChatMessage(msg);
      if (!chatOpen) {
        unreadCount++;
        updateChatBadge();
        if (msg.peerId !== socket.id) sounds.chat();
      }
    });

    // ⭐ FIX BUG 9: dominant speaker server-side via audioLevelObserver.
    // Sostituisce il polling consumer.getStats() ogni 100ms per ogni peer (drain CPU
    // pesante su mobile con 5+ partecipanti). Ora arriva un singolo evento dal server
    // ~ogni 200ms che dice chi sta parlando.
    socket.on('activeSpeaker', ({ peerId, volume }) => {
      // volume è in dBov: -127..0 (ma con threshold -65 lato server, qui arriva sempre voce)
      // Marchiamo il peer come speaking, autospegnimento dopo 800ms se non riarrivano eventi
      setSpeaking(peerId, true);
      clearTimeout(speakingTimers.get(peerId));
      speakingTimers.set(peerId, setTimeout(() => setSpeaking(peerId, false), 800));
    });

    socket.on('speakerSilence', () => {
      // Spegni tutti i peer remoti dopo un breve grace period
      // (il setSpeaking false su singolo peer è già gestito dai timer di 'activeSpeaker')
      // Qui forziamo lo spegnimento di chi è ancora 'speaking' senza eventi recenti
      setTimeout(() => {
        peers.forEach((_, peerId) => {
          if (speakingStates.get(peerId)) setSpeaking(peerId, false);
        });
      }, 300);
    });

    socket.on('error', ({ message }) => showToast('Errore: ' + message));
  });
}

// ─── Join Room ────────────────────────────────────────────────────────────────
async function joinRoom(micMuted = false, camOff = false) {
  const authToken = localStorage.getItem('tdmeet_token');
  const guestToken = sessionStorage.getItem('tdmeet_guest_token');
  const joinPayload = { roomId: ROOM_ID, displayName: DISPLAY_NAME, audioMuted: micMuted, videoOff: camOff };
  if (guestToken) joinPayload.guestToken = guestToken;
  else joinPayload.token = authToken;

  const res = await socketEmit('joinRoom', joinPayload);
  if (res.error === 'AUTH_REQUIRED') {
    localStorage.removeItem('tdmeet_token');
    sessionStorage.removeItem('tdmeet_guest_token');
    window.location.href = '/';
    return res;
  }
  if (res.error) throw new Error(res.error);

  // ── LOBBY: server dice di aspettare l'host. Niente setup mediasoup. ──────
  // Il caller (init) mostra l'overlay e ascolta 'hostAvailable' per ritentare.
  if (res.waitingForHost) return res;

  _startConnDiag(); // ⭐ diagnostica rete + wake lock (idempotente)

  device = new mediasoupClient.Device();

  // ⭐ FIX ROTAZIONE VIDEO (iPad/iPhone in landscape):
  // Rimuoviamo l'estensione header RTP "video-orientation" (CVO) dalle capabilities prima di caricare il device.
  // Senza CVO negoziato, il browser sender (Safari iOS) applica direttamente la rotazione al frame trasmesso
  // invece di trasmettere il frame raw + un bit metadata che Firefox poi ignora.
  // Risultato: TUTTI i receiver (Chrome, Firefox, Safari) vedono il video sempre dritto.
  // Soluzione presa da MiroTalk SFU (RoomClient.js).
  const routerCaps = res.routerRtpCapabilities;
  if (routerCaps && Array.isArray(routerCaps.headerExtensions)) {
    routerCaps.headerExtensions = routerCaps.headerExtensions.filter(
      (ext) => ext.uri !== 'urn:3gpp:video-orientation'
    );
  }
  await device.load({ routerRtpCapabilities: routerCaps });

  await createSendTransport();
  await createRecvTransport();
  _jlog('transports', { send: sendTransport?.id?.slice(0, 8), recv: recvTransport?.id?.slice(0, 8), existingPeers: res.peers.length });

  // Crea tile locale con stato corretto da pre-join
  initLocalMedia(micMuted, camOff);

  // Aggiungi peer esistenti
  res.peers.forEach((peer) => {
    peers.set(peer.id, peer);
    createTile(peer.id, peer.displayName);
    // ⭐ FIX: applica TUTTO lo stato iniziale del peer, non solo il mute.
    // Prima la mano alzata di chi era già in stanza non si vedeva entrando,
    // e lo stato "camera spenta" non veniva forzato (restava video vuoto).
    setTileMuted(peer.id, peer.audioMuted);
    setTileHand(peer.id, peer.handRaised);
    if (peer.videoOff) setTileVideo(peer.id, null, false);
  });
  updatePeerCount();
  refreshParticipants();
  res.chatHistory.forEach(appendChatMessage);
  // Disegni già presenti sugli schermi condivisi + regole della stanza
  window.__policy = res.policy || window.__BRAND?.rooms || {};
  window.__isHostRole = !!res.isHostRole;
  if (annotator) { annotator.setSelf(socket.id, res.isHostRole); annotator.loadSnapshot(res.annotations, res.annOpen); }
  _applyPolicyUi();

  // Produce audio e video
  if (!micMuted) await produceAudio();
  if (!camOff) await produceVideo();
  _jlog('produced', { audioProducer: !!producers.get('audio'), videoProducer: !!producers.get('video') });

  // Consuma producer esistenti
  for (const peer of res.peers) {
    for (const prod of peer.producers || []) {
      await consume(prod.id, peer.id, prod.kind, prod.appData);
    }
  }
  _jlog('joinComplete', { consumers: consumers.size });
}

// ─── Transports ──────────────────────────────────────────────────────────────
// ⭐ FIX audit: ICE restart con debounce. Su 'failed' restart immediato; su
// 'disconnected' aspetta 3s e restarta SOLO se ancora disconnesso (un 'disconnected'
// transitorio — blip wifi, switch rete — spesso si auto-recupera senza renegoziare).
const _iceRestartTimers = new WeakMap();
async function _doIceRestart(transport, label) {
  // ⭐ Se il socket è caduto, alla riconnessione la pagina viene ricaricata:
  // i transport attuali sono già morti lato server (peer rimosso) e chiedere
  // restartIce produce solo "[restartIce] ... Non in stanza" nei log.
  if (_wasDisconnected || !socket?.connected) {
    console.log(`[${label}] ICE restart saltato: socket caduto, reload in arrivo`);
    return;
  }
  try {
    const r = await socketEmit('restartIce', { transportId: transport.id });
    if (r.error) throw new Error(r.error);
    await transport.restartIce({ iceParameters: r.iceParameters });
    console.log(`[${label}] ICE restart OK`);
  } catch (e) { console.warn(`[${label}] ICE restart fallito:`, e?.message || e); }
}
function _handleIceState(transport, label, state) {
  console.log(`[${label}] connectionstate:`, state);
  // ⭐ Diagnostica: il server logga lo stato ICE visto dal CLIENT (vedi connlog.js)
  try { if (socket?.connected) socket.emit('clientIceState', { label, state }); } catch (e) { /* ignore */ }
  const prev = _iceRestartTimers.get(transport);
  if (prev) { clearTimeout(prev); _iceRestartTimers.delete(transport); }
  if (state === 'failed') {
    _doIceRestart(transport, label);
  } else if (state === 'disconnected') {
    const t = setTimeout(() => {
      _iceRestartTimers.delete(transport);
      if (transport.connectionState === 'disconnected') _doIceRestart(transport, label);
    }, 3000);
    _iceRestartTimers.set(transport, t);
  }
}

async function createSendTransport() {
  const { params, error } = await socketEmit('createWebRtcTransport', { direction: 'send' });
  if (error) throw new Error(error);
  const { iceServers, ...transportParams } = params;
  sendTransport = device.createSendTransport({ ...transportParams, iceServers });
  sendTransport.on('connect', async ({ dtlsParameters }, cb, eb) => {
    const r = await socketEmit('connectWebRtcTransport', { transportId: sendTransport.id, dtlsParameters });
    r.error ? eb(new Error(r.error)) : cb();
  });
  sendTransport.on('produce', async ({ kind, rtpParameters, appData }, cb, eb) => {
    const r = await socketEmit('produce', { transportId: sendTransport.id, kind, rtpParameters, appData });
    r.error ? eb(new Error(r.error)) : cb({ id: r.producerId });
  });
  // ⭐ FIX BUG 5: ICE restart automatico su disconnect.
  // Quando la rete fluttua (switch wifi/4G, galleria, vpn riconnect), il transport
  // va in 'disconnected'. Senza restartIce la connessione muore e l'utente deve
  // ri-joinare. Con restartIce mediasoup chiede nuovi ICE candidates al server e
  // ricostruisce la connettività in modo trasparente.
  sendTransport.on('connectionstatechange', (state) => _handleIceState(sendTransport, 'sendTransport', state));
}

async function createRecvTransport() {
  const { params, error } = await socketEmit('createWebRtcTransport', { direction: 'recv' });
  if (error) throw new Error(error);
  const { iceServers, ...transportParams } = params;
  recvTransport = device.createRecvTransport({ ...transportParams, iceServers });
  recvTransport.on('connect', async ({ dtlsParameters }, cb, eb) => {
    const r = await socketEmit('connectWebRtcTransport', { transportId: recvTransport.id, dtlsParameters });
    r.error ? eb(new Error(r.error)) : cb();
  });
  // ⭐ FIX BUG 5: stesso ICE restart sul recv transport.
  recvTransport.on('connectionstatechange', (state) => _handleIceState(recvTransport, 'recvTransport', state));
}

// ─── Producers ───────────────────────────────────────────────────────────────
async function produceAudio() {
  // FIX: se non abbiamo un mic track valido (prejoin con stream senza audio,
  // track ended dopo getUserMedia, ecc.), tenta un getUserMedia di fallback
  // invece di entrare silenziosi senza nessun avviso all'utente.
  if (!localMicTrack || localMicTrack.readyState === 'ended') {
    console.warn('[produceAudio] mic track mancante o ended, fallback getUserMedia');
    try {
      // ⭐ FIX BUG 6: usa l'helper iOS-aware (definito in devices.js).
      const audioDeviceId = window._tdmeetSelectedAudio || (prejoin && prejoin.selectedAudio);
      const audioConstraints = window._tdmeetBuildAudioConstraints
        ? window._tdmeetBuildAudioConstraints(audioDeviceId)
        : { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
      const fallback = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      const track = fallback.getAudioTracks()[0];
      if (!track) throw new Error('Nessun audio track ottenuto dal fallback');
      localMicTrack = track;
      window._localMicTrack = track;
      // Aggiungi al rawCamStream così speaking detection e device switch funzionano
      if (rawCamStream) {
        rawCamStream.getAudioTracks().forEach(t => { try { t.stop(); rawCamStream.removeTrack(t); } catch { } });
        rawCamStream.addTrack(track);
      }
      window._reinitSpeakingDetection?.();
      showToast?.('Microfono attivato');
    } catch (e) {
      console.error('[produceAudio] fallback fallito', e);
      setMicError("Permesso negato o microfono occupato. Premi “Riprova” dopo aver concesso l'accesso.");
      return;
    }
  }
  if (!localMicTrack) { setMicError('Nessun microfono rilevato.'); return; }
  let p;
  try {
    p = await sendTransport.produce({
      track: localMicTrack,
      codecOptions: {
        opusStereo: false,    // mono: dimezza la banda senza perdere qualità voce
        opusDtx: true,        // Discontinuous Transmission: non trasmette quando sei in silenzio
        opusFec: true,        // Forward Error Correction: recupera pacchetti persi
        opusNack: true,       // richiedi ritrasmissione pacchetti persi
        opusMaxPlaybackRate: 48000,
      },
      appData: { mediaType: 'audio' },
    });
  } catch (e) {
    console.error('[produceAudio] produce fallito', e);
    setMicError('Errore di trasmissione audio. Premi “Riprova”.');
    return;
  }
  producers.set('audio', p);
  clearMicError(); // audio in trasmissione: rimuovi eventuale banner d'errore
  _jlog('produceAudio OK', { producerId: p.id?.slice(0, 8), track: localMicTrack?.label });
  p.on('transportclose', () => producers.delete('audio'));
  // ⭐ Auto-recovery: se il mic muore (cuffie staccate, app rubato il device, ecc.) prova a riprenderlo
  p.on('trackended', async () => {
    console.warn('[produceAudio] trackended → tento recovery automatico');
    closeProducer('audio');
    showToast('Microfono disconnesso — provo a riconnettere…', 2000);
    // Aspetta che il sistema rilasci il device, poi retry
    await new Promise(r => setTimeout(r, 800));
    try {
      // ⭐ FIX BUG 6: anche qui usa l'helper iOS-aware
      const audioDeviceId = window._tdmeetSelectedAudio;
      const audioConstraints = window._tdmeetBuildAudioConstraints
        ? window._tdmeetBuildAudioConstraints(audioDeviceId)
        : { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
      const s = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      const newTrack = s.getAudioTracks()[0];
      if (!newTrack) throw new Error('no track');
      // Sostituisci nel rawCamStream
      rawCamStream?.getAudioTracks().forEach(t => { try { t.stop(); rawCamStream.removeTrack(t); } catch { } });
      rawCamStream?.addTrack(newTrack);
      localMicTrack = newTrack;
      window._localMicTrack = newTrack;
      // Riproduci e ri-inizializza speaking detection
      window._reinitSpeakingDetection?.();
      // Se non eravamo in mute, ricrea il producer
      const btnMicEl = document.getElementById('btnMic');
      const wasMuted = btnMicEl?.classList.contains('off');
      if (!wasMuted && device?.loaded && sendTransport) {
        await produceAudio();
        showToast('✅ Microfono riconnesso', 2500);
      }
    } catch (e) {
      console.error('[produceAudio recovery]', e);
      setMicError('Microfono perso. Ricollega il dispositivo e premi “Riprova”.');
    }
  });
}

async function produceVideo() {
  const track = localCamTrack;
  if (!track) { setCamError('Nessuna videocamera rilevata.'); return; }
  let p;
  try {
    p = await sendTransport.produce({
      track,
      // Simulcast 3 layer con resilienza su banda scarsa.
      // r0 = base (270p, 150 kbps) - sopravvive anche su 3G debole
      // r1 = medio (540p, 600 kbps) - standard
      // r2 = alto (1080p, 2 Mbps) - qualità max se rete buona
      // ⭐ FIX BUG 7: scalabilityMode L1T3 (sintassi standard SVC per simulcast classico
      // VP8/H264: 1 spatial layer, 3 temporal layer). Prima usavo S1T3 che è una
      // sintassi non standard — funziona ma alcuni handler mediasoup-client (Firefox 120+)
      // emettono warning e in casi rari ricadono su L1T1 azzerando i temporal layer.
      encodings: [
        { rid: 'r0', maxBitrate: 150000, scaleResolutionDownBy: 4, scalabilityMode: 'L1T3' },
        { rid: 'r1', maxBitrate: 600000, scaleResolutionDownBy: 2, scalabilityMode: 'L1T3' },
        { rid: 'r2', maxBitrate: 2000000, scaleResolutionDownBy: 1, scalabilityMode: 'L1T3' },
      ],
      codecOptions: {
        videoGoogleStartBitrate: 400,    // parte conservativo, sale se la rete regge
        videoGoogleMinBitrate: 100,      // non scende sotto 100 kbps
        videoGoogleMaxBitrate: 2500,     // cap superiore 2.5 Mbps per 1080p
      },
      appData: { mediaType: 'video' },
    });
  } catch (e) {
    console.error('[produceVideo] produce fallito', e);
    setCamError('Errore di trasmissione video. Premi “Riprova”.');
    return;
  }
  producers.set('video', p);
  clearCamError();
  _jlog('produceVideo OK', { producerId: p.id?.slice(0, 8) });
  p.on('transportclose', () => producers.delete('video'));
  p.on('trackended', () => { closeProducer('video'); showToast('Camera disconnessa'); });
}

async function produceScreen() {
  if (_screenStarting || producers.has('screen')) return;
  _screenStarting = true;
  try { await _produceScreenInner(); }
  finally { _screenStarting = false; }
}
let _screenStarting = false;
let _screenTransport = null;

async function _produceScreenInner() {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    showToast('Questo dispositivo non permette di condividere lo schermo dal browser. Usa un computer.', 4500);
    return;
  }
  let screenStream;
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      // cursor:'always' → il mouse del relatore è sempre nel video condiviso
      video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 15 }, cursor: 'always' },
      audio: true,
    });
  } catch { showToast('Condivisione schermo annullata'); return; }

  // ⭐ FIX R11: prima effetti/sfondo venivano spenti PRIMA del selettore del
  // browser → se l'utente annullava, restavano spenti per sempre. Ora solo
  // dopo che la cattura è partita davvero.
  window._savedFaceEffectId = _currentFaceEffectId || null;
  window._savedBgType = (_bgCurrentType && _bgCurrentType !== 'none') ? _bgCurrentType : null;
  window._savedBgUrl = window._savedBgType ? _bgCurrentUrl : null;
  if (window._savedFaceEffectId) {
    try { await applyFaceEffect('none'); } catch (e) { console.warn('[screen] off faceEffect fallito', e); }
  }
  if (window._savedBgType) {
    try { await applyBackground('none', null); } catch (e) { console.warn('[screen] off bg fallito', e); }
  }

  const screenTrack = screenStream.getVideoTracks()[0];
  // Suggerisce all'encoder di privilegiare nitidezza del testo sulla fluidità
  try { if ('contentHint' in screenTrack) screenTrack.contentHint = 'detail'; } catch { }
  window._tdScreenStream = screenStream;
  const { params, error } = await socketEmit('createWebRtcTransport', { direction: 'send', isScreenShare: true });
  if (error) {
    // ⭐ FIX R11: senza stop il browser continuava a catturare lo schermo
    try { screenStream.getTracks().forEach(t => t.stop()); } catch { }
    window._tdScreenStream = null;
    await _restoreSavedEffects();
    showToast('Errore condivisione schermo'); return;
  }

  // FIX: stesso destructuring iceServers del transport normale, altrimenti mediasoup ignora i STUN/TURN
  const { iceServers: ssIceServers, ...ssTransportParams } = params;
  const st = device.createSendTransport({ ...ssTransportParams, iceServers: ssIceServers });
  _screenTransport = st;
  st.on('connect', async ({ dtlsParameters }, cb, eb) => {
    const r = await socketEmit('connectWebRtcTransport', { transportId: st.id, dtlsParameters });
    r.error ? eb(new Error(r.error)) : cb();
  });
  st.on('produce', async ({ kind, rtpParameters, appData }, cb, eb) => {
    const r = await socketEmit('produce', { transportId: st.id, kind, rtpParameters, appData });
    r.error ? eb(new Error(r.error)) : cb({ id: r.producerId });
  });
  // ⭐ FIX BUG 5: ICE restart anche sul transport dello screen share. Senza, una
  // breve interruzione di rete durante una presentazione interrompeva la condivisione
  // permanentemente (lo user doveva ri-condividere manualmente).
  st.on('connectionstatechange', (state) => _handleIceState(st, 'screenTransport', state));

  let sp;
  try {
    sp = await st.produce({ track: screenTrack, appData: { mediaType: 'screen' } });
  } catch (e) {
    console.error('[screen] produce fallito', e);
    try { screenStream.getTracks().forEach(t => t.stop()); } catch { }
    window._tdScreenStream = null;
    _closeScreenTransport();
    await _restoreSavedEffects();
    showToast(/riservata/i.test(e?.message || '') ? e.message : 'Non è stato possibile avviare la condivisione dello schermo', 4000); return;
  }
  producers.set('screen', sp);

  // ⭐ FIX: produci anche l'audio dello schermo (tab/sistema) se presente.
  // Prima era catturato con audio:true ma mai trasmesso → condivisioni con audio mute.
  // stereo + no DTX perché è audio di sistema, non voce. NON viene agganciato all'ALO
  // server-side (filtra su mediaType==='audio') quindi non genera falsi "sta parlando".
  const screenAudioTrack = screenStream.getAudioTracks()[0];
  if (screenAudioTrack) {
    try {
      const sap = await st.produce({
        track: screenAudioTrack,
        codecOptions: { opusStereo: true, opusDtx: false },
        appData: { mediaType: 'screen-audio' },
      });
      producers.set('screen-audio', sap);
    } catch (e) { console.warn('[screen] produce audio schermo fallito', e?.message); }
  }
  document.getElementById('btnScreen').classList.add('active');
  document.dispatchEvent(new CustomEvent('td:screenshare', { detail: { active: true } }));

  // ⭐ FIX mute-fantasma: dopo la raffica di eventi dello screen share, riafferma
  // lo stato REALE di mic e camera. Se un 'peerMediaState' precedente è stato
  // droppato dal rate limiter, gli altri ci vedevano mutati finché non
  // toccavamo il microfono.
  socket?.emit('mediaState', { type: 'audio', status: micMuted });
  socket?.emit('mediaState', { type: 'video', status: camOff });

  const screenTile = document.createElement('div');
  screenTile.className = 'video-tile screenshare local';
  screenTile.dataset.peerId = 'local-screen';
  screenTile.innerHTML = `<video autoplay muted playsinline style="object-fit:contain;background:#000;transform:none;"></video><span class="tile-name-always">Il tuo schermo</span>`;
  // FIX: new MediaStream([track]) evita il bug Chrome schermo nero in anteprima locale
  screenTile.querySelector('video').srcObject = new MediaStream([screenTrack]);
  document.getElementById('videoGrid').prepend(screenTile);
  // Metti lo screen share come main spotlight automaticamente
  _spotlightPeer = 'local-screen';
  updateGridLayout();
  annotator?.attach(socket.id, screenTile, screenTile.querySelector('video'), { ownerName: DISPLAY_NAME });
  if (!localStorage.getItem('tdt_present_hint')) {
    localStorage.setItem('tdt_present_hint', '1');
    showToast('Stai presentando. Premi "Disegna" per evidenziare o usare il puntatore laser.', 5000);
  }

  const _restoreLocalVideo = () => {
    const _lv = document.getElementById('video-local');
    if (!_lv || !rawCamStream) return;
    const _camIsOff = document.getElementById('btnCamera')?.classList.contains('off');
    if (_camIsOff) return;

    // Se c'è un effetto viso attivo, ripristina il canvas stream (non il raw camera)
    if (faceEffects && faceEffects.outputStream) {
      const effTrack = faceEffects.outputStream.getVideoTracks()[0];
      if (effTrack && effTrack.readyState === 'live') {
        _lv.srcObject = new MediaStream([effTrack]);
        _lv.style.display = 'block';
        document.getElementById('avatar-local').style.display = 'none';
        return;
      }
    }

    // Se c'è uno sfondo virtuale attivo, ripristina il canvas del background
    if (backgroundEffect && backgroundEffect.outputStream) {
      const bgTrack = backgroundEffect.outputStream.getVideoTracks()[0];
      if (bgTrack && bgTrack.readyState === 'live') {
        _lv.srcObject = new MediaStream([bgTrack]);
        _lv.style.display = 'block';
        const _av = document.getElementById('avatar-local');
        if (_av) _av.style.display = 'none';
        return;
      }
    }

    _lv.srcObject = rawCamStream;
    _lv.style.display = 'block';
    const _av = document.getElementById('avatar-local');
    if (_av) _av.style.display = 'none';
  };

  window._tdRestoreLocalVideo = _restoreLocalVideo;
  screenTrack.addEventListener('ended', () => stopScreenShare());
  sp.on('transportclose', () => stopScreenShare({ transportGone: true }));
}

// ⭐ FIX R11: UN solo percorso di stop. Prima c'erano 3 copie divergenti
// (pulsante, 'ended' del browser, transportclose): il pulsante ripristinava la
// camera RAW ignorando sfondo/effetto, e il transport dedicato restava aperto.
let _screenStopping = false;
async function stopScreenShare({ transportGone = false } = {}) {
  if (_screenStopping) return;
  if (!producers.has('screen') && !window._tdScreenStream && !document.querySelector('[data-peer-id="local-screen"]')) return;
  _screenStopping = true;
  try {
    if (transportGone) { producers.delete('screen'); producers.delete('screen-audio'); }
    else {
      closeProducer('screen');
      if (producers.has('screen-audio')) closeProducer('screen-audio');
    }
    try { window._tdScreenStream?.getTracks().forEach(t => t.stop()); } catch { }
    window._tdScreenStream = null;
    _closeScreenTransport();
    if (socket?.id) annotator?.detach(socket.id);
    document.querySelector('[data-peer-id="local-screen"]')?.remove();
    _spotlightPeer = null;
    updateGridLayout();
    window._tdRestoreLocalVideo?.();
    document.getElementById('btnScreen')?.classList.remove('active');
    document.dispatchEvent(new CustomEvent('td:screenshare', { detail: { active: false } }));
    if (socket?.connected) {
      socket.emit('mediaState', { type: 'audio', status: micMuted });
      socket.emit('mediaState', { type: 'video', status: camOff });
    }
    await _restoreSavedEffects();
  } finally { _screenStopping = false; }
}

function _closeScreenTransport() {
  const t = _screenTransport; _screenTransport = null;
  if (!t) return;
  try { if (socket?.connected) socket.emit('closeTransport', { transportId: t.id }); } catch { }
  try { if (!t.closed) t.close(); } catch { }
}

async function _restoreSavedEffects() {
  if (window._savedFaceEffectId) {
    const id = window._savedFaceEffectId; window._savedFaceEffectId = null;
    try { await applyFaceEffect(id); } catch (e) { console.warn('[screen] restore faceEffect', e); }
  }
  if (window._savedBgType) {
    const t = window._savedBgType, u = window._savedBgUrl;
    window._savedBgType = null; window._savedBgUrl = null;
    try { await applyBackground(t, u); } catch (e) { console.warn('[screen] restore bg', e); }
  }
}

function closeProducer(label) {
  const p = producers.get(label); if (!p) return;
  socket.emit('closeProducer', { producerId: p.id });
  p.close(); producers.delete(label);
}

// ─── Consumers ───────────────────────────────────────────────────────────────
// ⭐ FIX race "audio/video doppio": un producer può arrivare sia nella risposta di
// join sia via 'newProducer' → senza guard si creano due consumer sullo stesso
// producer. Il Set agisce da lock sincrono (add PRIMA di qualsiasi await).
const _consumedProducers = new Set();
async function consume(producerId, peerId, kind, appData) {
  if (!device?.loaded) return;
  if (_consumedProducers.has(producerId)) return;
  _consumedProducers.add(producerId);

  const { params, error } = await socketEmit('consume', {
    producerId, producerPeerId: peerId, rtpCapabilities: device.rtpCapabilities,
  });
  if (error) { _consumedProducers.delete(producerId); console.error('[consume]', error); return; }

  let consumer;
  try {
    consumer = await recvTransport.consume(params);
  } catch (e) {
    _consumedProducers.delete(producerId);
    console.error('[consume] recvTransport.consume fallito', e);
    return;
  }
  consumer.appData = { ...(consumer.appData || {}), producerId, producerPeerId: peerId, kind, mediaType: appData?.mediaType };
  consumers.set(consumer.id, consumer);
  await socketEmit('resumeConsumer', { consumerId: consumer.id });

  const stream = new MediaStream([consumer.track]);

  if (appData?.mediaType === 'screen') {
    _jlog('consume screen', { peer: peerId });
    let st = document.querySelector(`[data-peer-id="${peerId}-screen"]`);
    if (!st) {
      st = document.createElement('div');
      st.className = 'video-tile screenshare';
      st.dataset.peerId = `${peerId}-screen`;
      const name = peers.get(peerId)?.displayName || 'Partecipante';
      st.innerHTML = `<video autoplay playsinline muted style="object-fit:contain;background:#000;transform:none;"></video><span class="tile-name-always">Schermo di ${escapeHtml(name)}</span>`;
      document.getElementById('videoGrid').prepend(st);
      updateGridLayout();
      annotator?.attach(peerId, st, st.querySelector('video'), { ownerName: name });
      showToast(`${name} sta presentando lo schermo`, 2600);
    }
    const _sv = st.querySelector('video');
    _sv.srcObject = stream;
    _sv.muted = true;
    _sv.play?.().catch(() => { });
  } else if (kind === 'video') {
    const s = peerStreams.get(peerId) || {}; s.video = stream; peerStreams.set(peerId, s);
    const tileExists = !!document.getElementById(`video-${peerId}`);
    if (!peers.get(peerId)?.videoOff) setTileVideo(peerId, stream, true);
    _jlog('consume video', { peer: peerId, tileExists, videoOff: peers.get(peerId)?.videoOff });
    scheduleLayerUpdate(); // ⭐ ROUND 5: assegna subito il layer giusto al nuovo tile
  } else if (kind === 'audio') {
    // ⭐ FIX screen-audio: chiave distinta così l'audio dello schermo NON sovrascrive
    // l'<audio> del microfono dello stesso peer (entrambi devono suonare).
    const isScreenAudio = appData?.mediaType === 'screen-audio';
    const audioKey = isScreenAudio ? `${peerId}-screen` : peerId;
    const s = peerStreams.get(audioKey) || {}; s.audio = stream; peerStreams.set(audioKey, s);
    // ⭐ FIX R11: se il peer ri-produce (cambio mic, ri-attivazione) il vecchio
    // <audio> restava nel DOM e nella Map veniva solo sovrascritto → audio doppio/leak.
    const _oldAudio = window._tdmeetPeerAudios?.get(audioKey);
    if (_oldAudio) { try { _oldAudio.pause(); _oldAudio.srcObject = null; _oldAudio.remove(); } catch { } }
    const audio = new Audio();
    audio.srcObject = stream;
    audio.autoplay = true;
    audio.playsInline = true;
    // FIX: appendi al DOM (nascosto). I detached HTMLAudioElement su Safari e
    // su Chrome con autoplay restrittivo possono non riprodurre, e setSinkId
    // a volte fallisce silenziosamente. Attaccarli al body risolve entrambi.
    // ⭐ FIX iOS: NON usare display:none — iOS può rifiutarsi di riprodurre media
    // fuori dal render tree. Lo teniamo renderizzato ma invisibile e a costo zero.
    audio.style.cssText = 'position:absolute;width:0;height:0;opacity:0;pointer-events:none;';
    audio.dataset.peerId = audioKey;
    audio.dataset.tdmeetRemote = '1';
    document.body.appendChild(audio);

    if (!window._tdmeetPeerAudios) window._tdmeetPeerAudios = new Map();
    window._tdmeetPeerAudios.set(audioKey, audio);

    // ⭐ FIX Safari: applica speakerId se supportato (Chrome/Edge; Safari ignora)
    const spkId = window._tdmeetSpeakerId;
    if (spkId && typeof audio.setSinkId === 'function') {
      audio.setSinkId(spkId).catch((e) => console.warn('[consume] setSinkId fallito', e?.name));
    }

    // ⭐ FIX Safari "non sento": Safari spesso NON emette 'loadedmetadata' per i
    // MediaStream remoti → se ci affidiamo solo a quell'evento, play() non parte mai.
    // Proviamo subito + su più eventi (idempotente) + retry temporizzati. Come ultima
    // spiaggia ri-attacchiamo lo stream (pattern preso da Jitsi AudioTrack).
    let _played = false;
    let _retries = 0;
    const tryPlay = () => {
      if (_played) return;
      audio.play().then(() => { _played = true; _jlog('audio play OK', { peer: peerId, retries: _retries }); }).catch((err) => {
        if (_retries === 0) {
          console.warn('[consume audio] play() bloccato — banner unblock', err?.name);
          _jlog('audio play BLOCKED', { peer: peerId, error: err?.name });
          showAudioUnblockBanner();
        }
        if (_retries < 3) {
          _retries++;
          setTimeout(tryPlay, 1000);
        } else if (!_played) {
          // Retry esauriti: ri-attacca lo stream e ritenta una volta
          _jlog('audio play reattach', { peer: peerId });
          try { audio.srcObject = stream; audio.play().then(() => { _played = true; }).catch(() => { }); } catch { }
        }
      });
    };
    tryPlay();
    audio.addEventListener('loadedmetadata', tryPlay, { once: true });
    audio.addEventListener('canplay', tryPlay, { once: true });
    // Se l'elemento va in errore, ri-attacca lo stream (pattern Jitsi _errorHandler)
    audio.addEventListener('error', () => {
      try { audio.srcObject = stream; audio.play().catch(() => { }); } catch { }
    });
    recorder?.refreshAudio();
  }

  // NB: gli eventi 'producerpause'/'producerresume' NON esistono su mediasoup-client
  // (solo sul Consumer server-side): il riallineamento autoritativo dell'icona mute
  // arriva ora dall'evento socket 'consumerProducerState' inoltrato dal server.


  consumer.on('transportclose', () => {
    consumers.delete(consumer.id);
    _consumedProducers.delete(consumer.appData?.producerId);
    _lastSentLayers.delete(consumer.id); // ⭐ ROUND 5
  });
}

const _remoteSpeakingRafs = new Map();
const _remoteSpeakingIntervals = new Map();
async function initRemoteSpeaking(peerId, stream, audioElement = null, consumer = null) {
  // ⭐ FIX BUG 9: speaking detection ora arriva dal server via 'activeSpeaker' / 'speakerSilence'
  // (vedi audioLevelObserver in Room.js). Niente più consumer.getStats() polling lato client,
  // niente più Web Audio analyser su stream remoti — tutto centralizzato sul SFU.
  // Questa funzione resta come no-op per compatibilità con i call site esistenti, e per
  // poter eventualmente attivare un fallback in futuro.
  return;
}

// ─── Recording ────────────────────────────────────────────────────────────────
function getRecorderVideoElements() {
  const elements = [];
  const lv = document.getElementById('video-local');
  if (lv) elements.push({ videoEl: lv, label: DISPLAY_NAME + ' (Tu)' });
  peers.forEach((peer, peerId) => {
    const v = document.getElementById(`video-${peerId}`);
    if (v && v.srcObject) elements.push({ videoEl: v, label: peer.displayName });
  });
  // ⭐ Schermi condivisi: passo anche il "sid" della superficie, così il
  // registratore ci disegna sopra annotazioni e puntatore laser. Niente
  // ritaglio (contain): in registrazione lo schermo si deve vedere intero.
  document.querySelectorAll('.video-tile.screenshare').forEach(tile => {
    const el = tile.querySelector('video');
    if (!el || !el.srcObject) return;
    const pid = tile.dataset.peerId || '';
    const sid = pid === 'local-screen' ? socket?.id : pid.replace(/-screen$/, '');
    const who = pid === 'local-screen' ? DISPLAY_NAME : (peers.get(sid)?.displayName || '');
    elements.push({ videoEl: el, label: who ? `Schermo di ${who}` : 'Schermo condiviso', sid, contain: true });
  });
  return elements;
}
function getRecorderAudioStreams() {
  const streams = [];
  if (rawCamStream) { const s = new MediaStream(rawCamStream.getAudioTracks()); if (s.getAudioTracks().length > 0) streams.push(s); }
  peerStreams.forEach(s => { if (s.audio) streams.push(s.audio); });
  return streams;
}
async function startRecording() {
  if (isRecording || !window.MediaRecorder) return;
  recorder = new ClientRecorder();
  recorder.connect(getRecorderVideoElements, getRecorderAudioStreams);
  try {
    const mimeType = await recorder.start();
    isRecording = true;
    document.getElementById('btnRecord').classList.add('recording');
    document.getElementById('btnRecord').querySelector('.ctrl-label').textContent = 'Stop';
    document.getElementById('recIndicator').classList.add('visible');
    sounds.recStart();
    showToast('⏺ Registrazione avviata');
    console.log('[recorder] codec:', mimeType);
  } catch (err) { console.error('[recorder]', err); showToast('Errore: ' + err.message); recorder = null; }
}
function stopRecording() {
  if (!isRecording || !recorder) return;
  recorder.stop(); recorder = null; isRecording = false;
  document.getElementById('btnRecord').classList.remove('recording');
  document.getElementById('btnRecord').querySelector('.ctrl-label').textContent = 'Registra';
  document.getElementById('recIndicator').classList.remove('visible');
  showToast('Registrazione salvata ✓ — download in corso');
}

// ─── Controlli ────────────────────────────────────────────────────────────────
function bindControls() {
  let _micToggling = false;
  document.getElementById('btnMic').addEventListener('click', async () => {
    // ⭐ FIX BUG 15: previeni doppi click rapidi che creano producer duplicati.
    if (_micToggling) return;
    _micToggling = true;
    const btn = document.getElementById('btnMic');
    btn.disabled = true;
    try {
      micMuted = !micMuted;
      // ⭐ Resume AudioContext (autoplay policy bypass) sempre quando l'utente clicca un controllo
      if (audioContext && audioContext.state === 'suspended') {
        try { await audioContext.resume(); } catch { }
      }
      if (localMicTrack) localMicTrack.enabled = !micMuted;
      const p = producers.get('audio');
      let voluntaryMute = false;
      if (p) {
        if (micMuted) { p.pause();  socket?.emit('pauseProducer',  { producerId: p.id }); }
        else          { p.resume(); socket?.emit('resumeProducer', { producerId: p.id }); }
        voluntaryMute = micMuted; // mute reale di un producer attivo
      } else if (!micMuted && device?.loaded && sendTransport) {
        // ⭐ FIX BUG 15: aspetta produceAudio. Se fallisce, ripristina lo stato muto
        // e riallinea il bottone (prima rimaneva in stato 'unmuted' silenzioso).
        try {
          await produceAudio();
          // produceAudio mostra già il banner d'errore se fallisce.
          if (!producers.get('audio')) {
            console.warn('[btnMic] produceAudio non ha creato il producer');
            micMuted = true; // resta "muto" ma il banner d'errore resta visibile
          }
        } catch (e) {
          console.error('[btnMic] produceAudio failed:', e);
          micMuted = true;
        }
      }
      socket?.emit('mediaState', { type: 'audio', status: micMuted });
      // Rimuovi il banner SOLO se è un mute volontario di un mic funzionante,
      // NON se micMuted=true è il fallback di un unmute fallito (lì il banner resta).
      if (voluntaryMute) clearMicError();
      btn.classList.toggle('off', micMuted);
      document.querySelector('#btnMic .icon-on').classList.toggle('hidden', micMuted);
      document.querySelector('#btnMic .icon-off').classList.toggle('hidden', !micMuted);
      setTileMuted('local', micMuted);
      refreshParticipants();
      if (micMuted) startMuteWarningDetection();
      else { stopMuteWarningDetection(); hideMuteWarning(); }
    } finally {
      btn.disabled = false;
      _micToggling = false;
    }
  });

  let _camToggling = false;
  document.getElementById('btnCamera').addEventListener('click', async () => {
    // ⭐ FIX BUG 15: stessa protezione per la camera (anche se più rara la double-click qui)
    if (_camToggling) return;
    _camToggling = true;
    const btn = document.getElementById('btnCamera');
    btn.disabled = true;
    try {
      camOff = !camOff;
      if (localCamTrack) localCamTrack.enabled = !camOff;
      const p = producers.get('video');
      let voluntaryOff = false;
      if (p) {
        if (camOff) { p.pause();  socket?.emit('pauseProducer',  { producerId: p.id }); }
        else        { p.resume(); socket?.emit('resumeProducer', { producerId: p.id }); }
        voluntaryOff = camOff;
      } else if (!camOff && device?.loaded && sendTransport) {
        try {
          await produceVideo();
          if (!producers.get('video')) {
            console.warn('[btnCamera] produceVideo non ha creato il producer');
            camOff = true; // resta spenta ma il banner d'errore resta visibile
          }
        } catch (e) {
          console.error('[btnCamera] produceVideo failed:', e);
          camOff = true;
        }
      }
      socket?.emit('mediaState', { type: 'video', status: camOff });
      if (voluntaryOff) clearCamError();
      btn.classList.toggle('off', camOff);
      document.querySelector('#btnCamera .icon-on').classList.toggle('hidden', camOff);
      document.querySelector('#btnCamera .icon-off').classList.toggle('hidden', !camOff);
      setTileVideo('local', rawCamStream, !camOff);
    } finally {
      btn.disabled = false;
      _camToggling = false;
    }
  });

  document.getElementById('btnScreen').addEventListener('click', async () => {
    if (producers.has('screen')) await stopScreenShare();
    else await produceScreen();
  });

  document.getElementById('btnLeave').addEventListener('click', () => {
    if (isRecording) stopRecording();
    clearInterval(timerInterval);
    rawCamStream?.getTracks().forEach(t => t.stop());
    socket?.disconnect();
    window.location.href = '/';
  });

  document.getElementById('btnRecord').addEventListener('click', () => { isRecording ? stopRecording() : startRecording(); });

  // Partecipanti
  document.getElementById('btnParticipants').addEventListener('click', () => participantList.toggle());
  document.getElementById('btnCloseParticipants').addEventListener('click', () => participantList.toggle());

  let handRaised = false;
  let _handAutoLowerTimer = null;
  document.getElementById('btnHand').addEventListener('click', () => {
    handRaised = !handRaised;
    socket?.emit('handRaise', { raised: handRaised });
    // Auto-abbassamento dopo 10 secondi
    clearTimeout(_handAutoLowerTimer);
    if (handRaised) {
      _handAutoLowerTimer = setTimeout(() => {
        if (handRaised) {
          handRaised = false;
          socket?.emit('handRaise', { raised: false });
        }
      }, 10000);
    }
  });

  // ⭐ Bottone Layout: flippa tra vista griglia e vista relatore (main + barra laterale)
  // a qualsiasi numero di partecipanti. Lo screen share resta sempre in spotlight.
  document.getElementById('btnLayout')?.addEventListener('click', () => {
    const g = document.getElementById('videoGrid');
    const isSpotlightNow = g.dataset.spotlight === 'true';
    _spotlightOverride = !isSpotlightNow; // forza l'opposto della vista attuale
    if (!_spotlightOverride) _spotlightPeer = null; // tornando a griglia, dimentica la selezione
    updateGridLayout();
    showToast(_spotlightOverride ? 'Vista relatore' : 'Vista griglia', 1500);
  });

  // ⭐ Re-valuta il layout al cambio dimensione/orientamento (rotazione telefono,
  // attraversamento breakpoint mobile↔desktop). Debounce per non sfarfallare.
  // Su mobile il bottone Layout è inutile (vista relatore forzata): lo nasconde.
  let _layoutResizeT = null;
  const _onLayoutResize = () => {
    clearTimeout(_layoutResizeT);
    _layoutResizeT = setTimeout(() => {
      const bl = document.getElementById('btnLayout');
      if (bl) bl.style.display = window.matchMedia('(max-width: 640px)').matches ? 'none' : '';
      updateGridLayout();
    }, 200);
  };
  window.addEventListener('resize', _onLayoutResize);
  window.addEventListener('orientationchange', _onLayoutResize);
  _onLayoutResize();

  const picker = document.getElementById('emojiPicker');
  document.getElementById('btnReactions').addEventListener('click', (e) => {
    e.stopPropagation();
    const willShow = picker.classList.contains('hidden');
    picker.classList.toggle('hidden');
    if (willShow) {
      // Posiziona sopra il pulsante (ora è al centro, non più in basso a destra)
      const r = e.currentTarget.getBoundingClientRect();
      picker.style.right = 'auto';
      const pw = picker.offsetWidth || 320;
      let left = r.left + r.width / 2 - pw / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
      picker.style.left = left + 'px';
      picker.style.bottom = (window.innerHeight - r.top + 10) + 'px';
    }
  });
  document.addEventListener('click', () => picker.classList.add('hidden'));
  picker.addEventListener('click', e => e.stopPropagation());
  document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      socket?.emit('reaction', { emoji: btn.dataset.emoji });
      spawnReaction(btn.dataset.emoji);
      picker.classList.add('hidden');
    });
  });

  document.getElementById('btnChat').addEventListener('click', toggleChat);
  document.getElementById('btnCloseChat').addEventListener('click', toggleChat);
  document.getElementById('btnSend').addEventListener('click', sendChatMessage);
  document.getElementById('chatInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
  });

  document.getElementById('btnCopyLink').addEventListener('click', shareRoomLink);
  document.getElementById('roomIdDisplay')?.addEventListener('click', () => {
    if (sessionStorage.getItem('tdmeet_guest_token')) {
      navigator.clipboard?.writeText(ROOM_ID); showToast('Codice stanza copiato'); return;
    }
    shareRoomLink();
  });
  document.getElementById('btnAnnotate')?.addEventListener('click', () => annotator?.toggleDraw());
  document.getElementById('btnHelp')?.addEventListener('click', () => startTour(true));

  document.getElementById('btnSoundToggle').addEventListener('click', () => {
    sounds.toggleMute();
    updateSoundIcon();
    showToast(sounds.muted ? 'Suoni di notifica disattivati' : 'Suoni di notifica attivati');
  });

  // ── Effetti viso (cappelli, gatto, etc.) ──────────────────────────────────
  // ── Risparmio dati ──────────────────────────────────────────────────────
  const _dsBtn = document.getElementById('btnDataSaver');
  const _dsSync = () => {
    _dsBtn?.classList.toggle('active', _dataSaver);
    const l = document.getElementById('dataSaverLabel');
    if (l) l.textContent = _dataSaver ? 'Risparmio dati ✓' : 'Risparmio dati';
  };
  _dsSync();
  _dsBtn?.addEventListener('click', () => {
    _dataSaver = !_dataSaver;
    try { localStorage.setItem('tdmeet_datasaver', _dataSaver ? '1' : '0'); } catch (e) { /* ignore */ }
    _maxSpatial = _computeMaxSpatial();
    _lastSentLayers.clear();
    scheduleLayerUpdate();
    _dsSync();
    closeMoreMenu();
    showToast?.(_dataSaver
      ? '🍃 Risparmio dati ATTIVO: video in ricezione a bassa risoluzione'
      : 'Risparmio dati disattivato: risoluzione automatica', 2600);
  });

  document.getElementById('btnEffects')?.addEventListener('click', () => closeMoreMenu());
  document.getElementById('btnEffects')?.addEventListener('click', toggleEffectsPicker);

  // ── Menu ⋮ "Altro" (Sfondo / Effetti / Risparmio dati) ───────────────────
  document.getElementById('btnMore')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = document.getElementById('moreMenu');
    const btn = document.getElementById('btnMore');
    if (!menu || !btn) return;
    if (!menu.classList.contains('hidden')) { closeMoreMenu(); return; }
    const r = btn.getBoundingClientRect();
    menu.classList.remove('hidden');
    const mw = menu.offsetWidth || 220;
    let left = r.left + r.width / 2 - mw / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - mw - 12));
    menu.style.left = left + 'px';
    menu.style.bottom = (window.innerHeight - r.top + 10) + 'px';
    btn.classList.add('active');
  });
  // Chiudi il menu quando si clicca una voce o fuori
  document.querySelectorAll('#moreMenu .more-menu-item').forEach(it =>
    it.addEventListener('click', () => closeMoreMenu())
  );
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('moreMenu');
    if (!menu || menu.classList.contains('hidden')) return;
    if (!menu.contains(e.target) && !document.getElementById('btnMore')?.contains(e.target)) {
      closeMoreMenu();
    }
  });

  // ── Sfondi virtuali ──────────────────────────────────────────────────────
  document.getElementById('btnBackground')?.addEventListener('click', () => closeMoreMenu());
  document.getElementById('btnBackground')?.addEventListener('click', openBackgroundModal);

  // ── Condividi stanza dal menu ⋮ ───────────────────────────────────────────
  document.getElementById('btnShareMenu')?.addEventListener('click', () => { closeMoreMenu(); shareRoomLink(); });
  document.getElementById('bgModalClose')?.addEventListener('click', () => {
    document.getElementById('bgModal').classList.add('hidden');
  });
  document.getElementById('bgModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'bgModal') document.getElementById('bgModal').classList.add('hidden');
  });
  document.getElementById('bgUploadInput')?.addEventListener('change', handleBackgroundUpload);

  // ── Info modal ────────────────────────────────────────────────────────────
  document.getElementById('btnInfo')?.addEventListener('click', openInfoModal);
  document.getElementById('infoModalClose')?.addEventListener('click', () => {
    document.getElementById('infoModal').classList.add('hidden');
  });
  document.getElementById('infoModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'infoModal') document.getElementById('infoModal').classList.add('hidden');
  });

  // ── Branding + footer (carica pubblico settings) ──────────────────────────
  loadPublicSettings();
}

// ─── Effetti viso ─────────────────────────────────────────────────────────────
let _effectsPickerOpen = false;

function buildEffectsPicker() {
  let picker = document.getElementById('effectsPicker');
  if (picker) return picker;

  picker = document.createElement('div');
  picker.id = 'effectsPicker';
  picker.className = 'effects-picker hidden';
  picker.innerHTML = `
    <div class="effects-picker-head">
      <span class="effects-picker-head-title">Sfondi ed effetti</span>
      <button class="effects-picker-close" id="effectsPickerClose" aria-label="Chiudi" title="Chiudi">✕</button>
    </div>
    <div class="effects-picker-title" style="color:rgba(120,180,255,0.95);border-left:3px solid #4a90e2;padding-left:8px;">🎨 Stili colore</div>
    <div class="effects-picker-grid" id="stylesPickerGrid" style="flex:none;max-height:128px;"></div>
    <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent);margin:14px 2px 12px;flex-shrink:0;"></div>
    <div class="effects-picker-title" style="color:rgba(255,180,120,0.95);border-left:3px solid #e2904a;padding-left:8px;">✨ Effetti viso</div>
    <div class="effects-picker-grid" id="effectsPickerGrid"></div>
    <button class="effects-picker-close-bottom" id="effectsPickerCloseBottom">Chiudi</button>
  `;
  document.body.appendChild(picker);

  // Pulsanti chiudi (X in alto + Chiudi in basso su mobile)
  picker.querySelector('#effectsPickerClose')?.addEventListener('click', closeEffectsPicker);
  picker.querySelector('#effectsPickerCloseBottom')?.addEventListener('click', closeEffectsPicker);

  // ── Griglia STILI colore ──
  const styleGrid = picker.querySelector('#stylesPickerGrid');
  (FaceEffects.STYLES || []).forEach(st => {
    const btn = document.createElement('button');
    btn.className = 'effect-btn' + (st.id === 'none' ? ' active' : '');
    btn.dataset.styleId = st.id;
    btn.innerHTML = `<span class="effect-icon">${st.icon}</span><span class="effect-label">${st.label}</span>`;
    btn.addEventListener('click', async () => {
      await applyStyle(st.id);
      styleGrid.querySelectorAll('.effect-btn').forEach(b => b.classList.toggle('active', b.dataset.styleId === st.id));
    });
    styleGrid.appendChild(btn);
  });

  const grid = picker.querySelector('#effectsPickerGrid');
  FaceEffects.CATALOG.forEach(eff => {
    const btn = document.createElement('button');
    btn.className = 'effect-btn';
    btn.dataset.id = eff.id;
    btn.innerHTML = `<span class="effect-icon">${eff.icon}</span><span class="effect-label">${eff.label}</span>`;
    btn.addEventListener('click', async () => {
      await applyFaceEffect(eff.id);
      picker.querySelectorAll('.effect-btn').forEach(b => b.classList.toggle('active', b.dataset.id === eff.id));
    });
    grid.appendChild(btn);
  });

  // Chiudi cliccando fuori
  document.addEventListener('click', (e) => {
    if (!_effectsPickerOpen) return;
    if (!picker.contains(e.target) && !document.getElementById('btnEffects')?.contains(e.target)) {
      closeEffectsPicker();
    }
  });

  return picker;
}

function toggleEffectsPicker(e) {
  e?.stopPropagation();
  const picker = buildEffectsPicker();
  if (_effectsPickerOpen) { closeEffectsPicker(); return; }

  picker.classList.remove('hidden');

  if (window.innerWidth <= 640) {
    // Mobile: bottom sheet a tutta larghezza (posizione gestita dal CSS)
    picker.style.width = '';
    picker.style.left = '';
    picker.style.bottom = '';
  } else {
    // Desktop: ancorato sopra il pulsante ⋮ (btnEffects è dentro il menu nascosto)
    const anchor = document.getElementById('btnMore') || document.getElementById('btnEffects');
    const rect = anchor.getBoundingClientRect();
    const pw = Math.min(window.innerWidth - 24, 420);
    picker.style.width = pw + 'px';
    let left = rect.left + rect.width / 2 - pw / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - pw - 12));
    picker.style.left = left + 'px';
    picker.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
  }
  _effectsPickerOpen = true;
}

function closeEffectsPicker() {
  document.getElementById('effectsPicker')?.classList.add('hidden');
  _effectsPickerOpen = false;
}

function closeMoreMenu() {
  document.getElementById('moreMenu')?.classList.add('hidden');
  document.getElementById('btnMore')?.classList.remove('active');
}

async function shareRoomLink() {
  const t = localStorage.getItem('tdmeet_token');
  if (t) {
    try {
      const r = await fetch(`/api/room/${ROOM_ID}/invite`, { method: 'POST', headers: { 'x-auth-token': t } });
      const { url } = await r.json();
      navigator.clipboard.writeText(url);
      showToast('Link d\'invito copiato: incollalo a chi vuoi invitare');
      return;
    } catch { }
  }
  navigator.clipboard.writeText(window.location.href);
  showToast('Link copiato');
}

// ⭐ FIX: effetti viso, stili colore e sfondo virtuale lavorano TUTTI sullo
// stesso track della camera, ma avevano lucchetti separati: due click ravvicinati
// (o uno stile mentre parte un effetto) si pestavano i piedi a vicenda e uno dei
// due trovava `faceEffects` già azzerato → "faceEffects is null",
// "sourceVideo is null", ed effetti che non si applicavano. Ora le operazioni
// vengono messe in fila e svolte una alla volta.
let _mediaChain = Promise.resolve();
function _mediaQueue(fn) {
  const run = () => fn();
  _mediaChain = _mediaChain.then(run, run);
  return _mediaChain;
}

/** Riporta un track camera appena ripristinato alla risoluzione piena.
 *  Senza questo, dopo il fallback getUserMedia la camera tornava a 640×480
 *  (il default del browser) e il video restava sgranato. */
async function _restoreCamQuality(track) {
  if (!track || track.readyState !== 'live') return;
  try { track.contentHint = 'motion'; } catch (_) { }
  try {
    const st = track.getSettings?.() || {};
    // Solo se la risoluzione è NOTA e bassa. Se il browser non la riporta
    // (capita su Firefox) non si tocca niente: forzare i vincoli su un track
    // già a 1080p lo farebbe scendere inutilmente.
    if (Number.isFinite(st.width) && st.width > 0 && st.width < 1000) {
      await track.applyConstraints({ width: { ideal: 1280 }, height: { ideal: 720 } });
      console.log('[camera] risoluzione rialzata a', track.getSettings?.());
    }
  } catch (e) { console.warn('[camera] applyConstraints fallito', e?.message); }
}

/** Riporta anteprima locale e flusso inviato sullo STESSO track della camera.
 *  Su Firefox l'anteprima restava agganciata al vecchio stream (quello del
 *  canvas dell'effetto) e si vedeva sgranata, mentre agli altri arrivava la
 *  camera vera: da qui il "io mi vedo di merda, gli altri no".
 *  Riassegnare un MediaStream NUOVO forza Firefox a ricostruire la pipeline. */
function _saveCamBaseline() {
  try {
    const t = rawCamStream?.getVideoTracks?.()[0];
    const st = t?.getSettings?.() || {};
    if (Number.isFinite(st.width) && st.width > 0) {
      window._camBaseline = { width: st.width, height: st.height, frameRate: st.frameRate, deviceId: st.deviceId };
      console.log('[camera] stato di partenza memorizzato', window._camBaseline);
    }
  } catch (_) { }
}

async function _syncLocalVideoToCamera(reason) {
  const track = rawCamStream?.getVideoTracks?.()[0];
  const v = document.getElementById('video-local');
  if (!track || track.readyState !== 'live') return;
  try {
    // Se la camera è tornata più bassa di com'era prima dell'effetto, la si
    // riporta ESATTAMENTE ai valori di partenza (non a un 1280 a caso).
    const base = window._camBaseline;
    const now = track.getSettings?.() || {};
    if (base && Number.isFinite(now.width) && now.width < base.width) {
      console.warn('[camera] risoluzione scesa dopo l\'effetto:', now.width, '→ ripristino', base.width);
      await track.applyConstraints({
        width: { ideal: base.width }, height: { ideal: base.height },
        frameRate: base.frameRate ? { ideal: base.frameRate } : undefined,
      }).catch(e => console.warn('[camera] ripristino risoluzione fallito', e?.message));
    }
    const p = producers.get('video');
    const sending = p?.track;
    if (p && sending !== track) await p.replaceTrack({ track });
    if (v) {
      v.srcObject = new MediaStream([track]);
      v.muted = true;
      await v.play?.().catch(() => { });
    }
    console.log(`[camera] ${reason}: anteprima e invio allineati`, {
      track: track.getSettings?.(),
      anteprima: v ? `${v.videoWidth}x${v.videoHeight}` : '-',
      eraDiverso: !!(p && sending !== track),
    });
  } catch (e) { console.warn('[camera] riallineamento fallito', e?.message); }
}

/** Diagnostica a mano: scrivi tdCamInfo() nella console */
window.tdCamInfo = function () {
  const v = document.getElementById('video-local');
  const pv = producers.get('video');
  const info = {
    anteprima: { size: v ? `${v.videoWidth}x${v.videoHeight}` : '-', tracks: v?.srcObject?.getVideoTracks?.().map(t => ({ id: t.id.slice(0, 8), ...t.getSettings?.(), readyState: t.readyState })) },
    inviato: pv?.track ? { id: pv.track.id.slice(0, 8), ...pv.track.getSettings?.(), readyState: pv.track.readyState } : null,
    rawCamStream: rawCamStream?.getVideoTracks?.().map(t => ({ id: t.id.slice(0, 8), ...t.getSettings?.(), readyState: t.readyState })),
    effettoAttivo: !!faceEffects, sfondoAttivo: !!backgroundEffect,
  };
  console.table([].concat(info.anteprima.tracks || [], info.inviato || [], info.rawCamStream || []));
  console.log(info);
  return info;
};

/** Dopo aver tolto effetto o sfondo: controlla che la camera stia DAVVERO
 *  mandando frame. Su Firefox capita che il track originale resti "live" ma
 *  morto, o che torni a bassa risoluzione: in quel caso si riapre la camera e
 *  si rimette nel producer. Meglio due secondi di attesa che un riquadro nero. */
async function _ensureCameraAlive() {
  if (camOff) return;                    // camera volutamente spenta: niente da fare
  const v = document.getElementById('video-local');
  const t = rawCamStream?.getVideoTracks?.()[0];
  const st = t?.getSettings?.() || {};
  console.log('[camera] dopo rimozione effetto:', { readyState: t?.readyState, muted: t?.muted, ...st });

  if (t && t.readyState === 'live' && !t.muted) {
    // Track sano: NON si tocca. Al massimo si ri-aggancia l'anteprima, che su
    // Firefox a volte resta appesa al canvas dell'effetto (e si vede sgranata).
    if (v && v.srcObject !== rawCamStream) { v.srcObject = rawCamStream; v.play?.().catch(() => { }); }
    for (let i = 0; i < 12 && v && v.videoWidth === 0; i++) await new Promise(r => setTimeout(r, 250));
    if (!v || v.videoWidth > 0 || Number.isFinite(st.width)) return;
    console.warn('[camera] track vivo ma senza frame né risoluzione: riapro');
  }

  // Solo se il track è morto o assente si riapre la camera.
  const camId = window._localCamTrack?.getSettings?.()?.deviceId;
  try { rawCamStream?.getVideoTracks?.().forEach(x => { try { x.stop(); } catch (_) { } try { rawCamStream.removeTrack(x); } catch (_) { } }); } catch (_) { }
  for (const attempt of [0, 400, 900, 1600]) {
    if (attempt) await new Promise(r => setTimeout(r, attempt));
    try {
      const constraints = camId
        ? { video: { deviceId: { ideal: camId }, width: { ideal: 1280 }, height: { ideal: 720 } } }
        : { video: { width: { ideal: 1280 }, height: { ideal: 720 } } };
      const ns = await navigator.mediaDevices.getUserMedia(constraints);
      const nt = ns.getVideoTracks()[0];
      rawCamStream.addTrack(nt);
      window._localCamTrack = nt;
      try { nt.contentHint = 'motion'; } catch (_) { }
      if (producers.get('video')) await producers.get('video').replaceTrack({ track: nt });
      if (v) { v.srcObject = rawCamStream; v.play?.().catch(() => { }); }
      console.log('[camera] riaperta:', nt.getSettings?.());
      return;
    } catch (e) {
      console.warn('[camera] riapertura fallita:', e?.message);
    }
  }
  showToast('Non riesco a riaprire la videocamera: spegnila e riaccendila dalla barra', 5000);
}

const applyFaceEffect = (effectId) => _mediaQueue(() => _applyFaceEffectImpl(effectId));
const applyStyle = (styleId) => _mediaQueue(() => _applyStyleImpl(styleId));
const applyBackground = (type, imageUrl) => _mediaQueue(() => _applyBackgroundImpl(type, imageUrl));

async function _applyFaceEffectImpl(effectId) {
  _currentFaceEffectId = (effectId && effectId !== 'none') ? effectId : null;
  if (!rawCamStream) { showToast('Camera non attiva'); return; }
  try {
    // ── "none" → rimuovi effetto ────────────────────────────────────────
    if (effectId === 'none') {
      if (!faceEffects) {
        document.getElementById('btnEffects')?.classList.remove('active');
        return;
      }
      // ⭐ Se c'è ancora un Color Style attivo, NON smontare la pipeline:
      // togli solo l'overlay e lascia girare il filtro colore.
      if (_currentStyle && _currentStyle !== 'none') {
        faceEffects.setEffect('none');
        document.getElementById('btnEffects')?.classList.remove('active');
        return;
      }

      const originalTrack = rawCamStream.getVideoTracks()[0];
      console.log('[faceEffect OFF] originalTrack state:', {
        exists: !!originalTrack,
        readyState: originalTrack?.readyState,
        enabled: originalTrack?.enabled,
        muted: originalTrack?.muted,
        label: originalTrack?.label,
      });

      // Se il track originale è morto, DOBBIAMO ri-acquisire la camera prima di rimuovere l'effetto
      if (!originalTrack || originalTrack.readyState !== 'live') {
        console.warn('[faceEffect OFF] track originale NON vivo, tento recupero via clone MediaPipe');
        try {
          // STRATEGIA: MediaPipe internamente ha già clonato il videoTrack originale
          // (vedi faceEffects.js: `this._sourceTrackClone = videoTrack.clone()`).
          // Quel clone è ANCORA VIVO finché non chiamiamo faceEffects.stop().
          // Lo clono di nuovo (clone del clone) per avere un track indipendente che
          // sopravvive al stop() di MediaPipe — così NON dobbiamo chiamare getUserMedia
          // e aggirare il bug di Firefox sul release del device.

          let recoveredTrack = null;
          try {
            const mpClone = faceEffects?._sourceTrackClone;
            if (mpClone && mpClone.readyState === 'live') {
              recoveredTrack = mpClone.clone();
              console.log('[faceEffect OFF] track recuperato dal clone MediaPipe');
            }
          } catch (e) {
            console.warn('[faceEffect OFF] clone del clone fallito:', e.message);
          }

          // Fermo la pipeline PRIMA di usare il track (dopo il stop il clone originale muore,
          // ma il nostro clone-of-clone rimane vivo)
          try { faceEffects?.stop?.(); } catch (_) { }

          // Se il recovery dal clone è andato, uso quello
          if (recoveredTrack && recoveredTrack.readyState === 'live') {
            // Pulisco i track vecchi da rawCamStream
            rawCamStream.getVideoTracks().forEach(t => {
              try { t.stop(); } catch (_) { }
              try { rawCamStream.removeTrack(t); } catch (_) { }
            });
            rawCamStream.addTrack(recoveredTrack);
            window._localCamTrack = recoveredTrack;
            await _restoreCamQuality(recoveredTrack);
            if (producers.get('video')) {
              await producers.get('video').replaceTrack({ track: recoveredTrack });
            }
            console.log('[faceEffect OFF] ripristino via clone OK');
          } else {
            // Fallback: retry loop con getUserMedia (strada vecchia, serve se il clone è già morto)
            console.warn('[faceEffect OFF] clone non disponibile, fallback a getUserMedia');
            const currentCamId = window._localCamTrack?.getSettings?.()?.deviceId;
            rawCamStream.getVideoTracks().forEach(t => {
              try { t.stop(); } catch (_) { }
              try { rawCamStream.removeTrack(t); } catch (_) { }
            });
            try {
              if (window._localCamTrack && window._localCamTrack.readyState !== 'ended') {
                window._localCamTrack.stop();
              }
            } catch (_) { }

            const delays = [300, 500, 800, 1200, 2000, 2500];
            let newStream = null;
            let lastErr = null;
            for (let i = 0; i < delays.length; i++) {
              await new Promise(r => setTimeout(r, delays[i]));
              try {
                // ⭐ sempre con una risoluzione richiesta: col solo deviceId il
                // browser torna al default (640×480) e il video resta sgranato
                const _w = window._camPreferred || { width: 1280, height: 720 };
                const constraints = (i < 3 && currentCamId)
                  ? { video: { deviceId: { ideal: currentCamId }, width: { ideal: _w.width }, height: { ideal: _w.height } } }
                  : { video: { width: { ideal: _w.width }, height: { ideal: _w.height } } };
                newStream = await navigator.mediaDevices.getUserMedia(constraints);
                console.log(`[faceEffect OFF] camera riacquisita al tentativo ${i + 1}/${delays.length}`);
                break;
              } catch (err) {
                lastErr = err;
                console.warn(`[faceEffect OFF] tentativo ${i + 1}/${delays.length} fallito:`, err.message);
              }
            }
            if (!newStream) {
              throw lastErr || new Error('Camera non ri-acquisibile');
            }
            const newCamTrack = newStream.getVideoTracks()[0];
            rawCamStream.addTrack(newCamTrack);
            window._localCamTrack = newCamTrack;
            await _restoreCamQuality(newCamTrack);
            if (producers.get('video')) {
              await producers.get('video').replaceTrack({ track: newCamTrack });
            }
          }
        } catch (err) {
          console.error('[faceEffect OFF] ri-acquisizione camera fallita', err);
          showToast('Errore nel ripristino camera: ricarica la pagina per continuare');
        }
      } else {
        // Track originale vivo: basta un replaceTrack
        await _restoreCamQuality(originalTrack);
        if (producers.get('video')) {
          try {
            await producers.get('video').replaceTrack({ track: originalTrack });
          } catch (e) { console.warn('[faceEffect revert]', e); }
        }
      }

      faceEffects.setEffect('none');

      try { faceEffects.stop(); } catch (_) { }
      faceEffects = null;
      await _ensureCameraAlive();
      await _syncLocalVideoToCamera('effetto rimosso');
      document.getElementById('btnEffects')?.classList.remove('active');
      showToast('Effetto rimosso');
      return;
    }

    // ── Effetto già attivo: cambia solo il tipo, non ricreare la pipeline ──
    if (faceEffects && faceEffects.loaded && faceEffects.outputStream) {
      faceEffects.setEffect(effectId);
      document.getElementById('btnEffects')?.classList.add('active');
      showToast('✨ Effetto cambiato');
      return;
    }

    // ── Primo uso: istanzia pipeline ────────────────────────────────────
    _saveCamBaseline();
    showToast('Caricamento effetto...', 2500);

    // Se c'è un'istanza in stato inconsistente, distruggila
    if (faceEffects) { try { faceEffects.stop(); } catch { } faceEffects = null; }

    faceEffects = new FaceEffects();
    const outStream = await faceEffects.apply(rawCamStream);
    const newTrack = outStream.getVideoTracks()[0];

    // Verifica che il track sia ancora vivo prima del replaceTrack
    if (!newTrack || newTrack.readyState !== 'live') {
      throw new Error('track del canvas non valido (readyState: ' + newTrack?.readyState + ')');
    }

    const p = producers.get('video');
    if (p) await p.replaceTrack({ track: newTrack });

    const v = document.getElementById('video-local');
    if (v) v.srcObject = new MediaStream([newTrack]);

    faceEffects.setEffect(effectId);
    document.getElementById('btnEffects')?.classList.add('active');
    showToast('✨ Effetto applicato');

  } catch (err) {
    console.error('[faceEffect]', err);
    showToast('Errore effetti: ' + err.message);
    // Cleanup in caso di errore per non lasciare stati zombie
    if (faceEffects) { try { faceEffects.stop(); } catch { } faceEffects = null; }
    document.getElementById('btnEffects')?.classList.remove('active');
  }
}

// ─── Color Styles (gradazioni colore tipo Google Meet) ─────────────────────────
// Il filtro colore gira sulla stessa pipeline canvas degli effetti viso. Può essere
// attivo da solo (senza overlay): in quel caso la pipeline resta su con active='none'
// e disegna solo il frame filtrato.
async function _applyStyleImpl(styleId) {
  if (!rawCamStream) { showToast('Camera non attiva'); return; }
  try {
    _currentStyle = (styleId && styleId !== 'none') ? styleId : null;

    // Stile "none" e nessun effetto viso → smonta tutto (torna al track raw)
    if (!_currentStyle && !_currentFaceEffectId) {
      await _applyFaceEffectImpl('none');   // stessa coda: chiamata diretta
      return;
    }

    // Pipeline già attiva → applica solo lo stile
    if (faceEffects && faceEffects.loaded && faceEffects.outputStream) {
      faceEffects.setStyle(styleId || 'none');
      return;
    }

    // Pipeline non attiva → avviala (stesso percorso del primo uso effetti)
    showToast('Applico stile...', 2000);
    if (faceEffects) { try { faceEffects.stop(); } catch { } faceEffects = null; }
    faceEffects = new FaceEffects();
    const outStream = await faceEffects.apply(rawCamStream);
    const newTrack = outStream.getVideoTracks()[0];
    if (!newTrack || newTrack.readyState !== 'live') {
      throw new Error('track canvas non valido (' + newTrack?.readyState + ')');
    }
    const p = producers.get('video');
    if (p) await p.replaceTrack({ track: newTrack });
    const v = document.getElementById('video-local');
    if (v) v.srcObject = new MediaStream([newTrack]);

    faceEffects.setStyle(styleId || 'none');
    faceEffects.setEffect(_currentFaceEffectId || 'none'); // preserva eventuale overlay
  } catch (err) {
    console.error('[applyStyle]', err);
    showToast('Errore stile: ' + err.message);
    _currentStyle = null;
    if (faceEffects && !_currentFaceEffectId) { try { faceEffects.stop(); } catch { } faceEffects = null; }
  }
}

// ─── Chat ─────────────────────────────────────────────────────────────────────
function toggleChat() {
  chatOpen = !chatOpen;
  const panel = document.getElementById('chatPanel');
  panel.classList.toggle('hidden', !chatOpen);
  // Niente style.height/style.top: il CSS gestisce height:100dvh e inset:0
  if (chatOpen) {
    unreadCount = 0;
    updateChatBadge();
    document.getElementById('chatInput').focus();
    scrollChat();
  }
}
function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim(); if (!msg) return;
  socket?.emit('chatMessage', { message: msg }); input.value = '';
}
function appendChatMessage(msg) {
  const isOwn = msg.peerId === socket?.id;
  const c = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'chat-msg' + (isOwn ? ' own' : '');
  const time = new Date(msg.timestamp).toLocaleTimeString(I18n.locale, { hour: '2-digit', minute: '2-digit' });

  div.innerHTML = `
    <div class="msg-meta">
      <span ${isOwn ? '' : 'translate="no"'}>${isOwn ? 'Tu' : escapeHtml(msg.displayName)}</span>
      <span>${time}</span>
    </div>
    <div class="msg-bubble-wrap">
      <div class="msg-bubble">${escapeHtml(msg.message)}</div>
      <button class="msg-tts-btn" title="Leggi ad alta voce" aria-label="Leggi messaggio">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
      </button>
    </div>`;

  div.querySelector('.msg-tts-btn').addEventListener('click', () => {
    sounds?.speak(msg.message, isOwn ? '' : msg.displayName);
    div.querySelector('.msg-tts-btn').classList.add('speaking');
    setTimeout(() => div.querySelector('.msg-tts-btn')?.classList.remove('speaking'), 3000);
  });

  c.appendChild(div);
  scrollChat();
}
function scrollChat() { const el = document.getElementById('chatMessages'); el.scrollTop = el.scrollHeight; }
function updateChatBadge() { const b = document.getElementById('chatBadge'); b.textContent = unreadCount; b.classList.toggle('hidden', unreadCount === 0); }

// ─── Reazioni flottanti ───────────────────────────────────────────────────────
function spawnReaction(emoji) {
  // Suono specifico per la reazione
  sounds?.reaction(emoji);

  const overlay = document.getElementById('reactionsOverlay');
  const count = 6 + Math.floor(Math.random() * 3); // 6-8 particelle
  const baseLeft = 15 + Math.random() * 70;

  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'reaction-float';
    el.textContent = emoji;

    // Spread orizzontale attorno al punto base
    const spread = (Math.random() - 0.5) * 30;
    el.style.left = Math.max(5, Math.min(95, baseLeft + spread)) + '%';

    // Animazione con variazioni random per effetto più naturale
    const duration = 5 + Math.random() * 2;   // 5-7s: prima sparivano subito
    const delay = Math.random() * 0.35;
    const xDrift = (Math.random() - 0.5) * 120;
    const scale = 0.8 + Math.random() * 0.6;
    const rotate = (Math.random() - 0.5) * 60;

    el.style.setProperty('--x-drift', xDrift + 'px');
    el.style.setProperty('--rotate', rotate + 'deg');
    el.style.setProperty('--scale', scale);
    el.style.animationDuration = duration + 's';
    el.style.animationDelay = delay + 's';
    el.style.fontSize = (24 + Math.random() * 20) + 'px';

    overlay.appendChild(el);
    setTimeout(() => el.remove(), (duration + delay) * 1000 + 100);
  }
}

// ─── Utils ────────────────────────────────────────────────────────────────────
// ⭐ FIX: timeout sull'ack. Senza, se il server non richiama la callback (eccezione
// prima di callback(), socket droppato a metà richiesta, server sovraccarico) il
// Promise non si risolve MAI → il join resta appeso a "Configurazione media…" per
// sempre. Col timeout risolviamo con {error}, così il chiamante (es. joinRoom che fa
// `if (error) throw`) mostra la schermata d'errore e l'utente può ricaricare.
function socketEmit(event, data = {}, timeoutMs = 15000) {
  return new Promise(resolve => {
    let done = false;
    const t = setTimeout(() => {
      if (done) return;
      done = true;
      console.warn('[socketEmit] timeout su', event);
      _jlog?.('socketEmit TIMEOUT', { event });
      resolve({ error: `Timeout: "${event}" non ha risposto` });
    }, timeoutMs);
    socket.emit(event, data, res => {
      if (done) return;
      done = true;
      clearTimeout(t);
      resolve(res || {});
    });
  });
}

// ─── Sfondi virtuali + Info + Footer ──────────────────────────────────────────
let backgroundEffect = null;
// Getter live per accesso cross-file (devices.js)
Object.defineProperty(window, 'backgroundEffect', { get: () => backgroundEffect, configurable: true });
let _bgCurrentType = 'none';
let _bgCurrentUrl = null;
let _publicSettings = null;

async function loadPublicSettings() {
  try {
    const r = await fetch('/api/settings/public');
    _publicSettings = await r.json();
    renderFooter();
    applyBranding();
  } catch (e) { /* silent */ }
}

function renderFooter() {
  const f = _publicSettings?.footer;
  const el = document.getElementById('roomFooter');
  if (!el) return;
  if (!f || f.enabled === false || !f.text) { el.innerHTML = ''; return; }
  const text = escapeHtml(f.text);
  el.innerHTML = f.link
    ? `<a href="${escapeHtml(f.link)}" target="_blank" rel="noopener">${text}</a>`
    : text;
}

function applyBranding() {
  const b = _publicSettings?.branding;
  if (!b) return;
  if (b.platformName) document.title = `Riunione · ${b.platformName}`;
  // L'accento lo imposta il server nella <head>, già adattato al tema chiaro e
  // scuro: qui NON va sovrascritto col valore grezzo (un colore quasi nero
  // sparirebbe sul tema scuro).
  if (b.accentColor) document.documentElement.style.setProperty('--accent-raw', b.accentColor);
}

function openBackgroundModal() {
  const modal = document.getElementById('bgModal');
  modal.classList.remove('hidden');
  loadBackgroundPresets();
  markActiveBackground();
}

function markActiveBackground() {
  document.querySelectorAll('.bg-item').forEach(el => {
    const type = el.dataset.bgType;
    const url = el.dataset.bgUrl;
    const isActive = (type === _bgCurrentType) && (type !== 'image' || url === _bgCurrentUrl);
    el.classList.toggle('active', isActive);
  });
}

async function loadBackgroundPresets() {
  const grid = document.getElementById('bgPresetsGrid');
  grid.innerHTML = '<div class="bg-loading">Caricamento...</div>';
  try {
    const r = await fetch('/api/backgrounds');
    const data = await r.json();
    const all = [...(data.presets || []), ...(data.uploads || [])];
    if (all.length === 0) {
      grid.innerHTML = '<div class="bg-loading">Nessuno sfondo disponibile. Carica il tuo qui sotto.</div>';
      return;
    }
    grid.innerHTML = all.map(b => `
      <button class="bg-item" data-bg-type="image" data-bg-url="${escapeHtml(b.url)}" title="${escapeHtml(b.label)}">
        <img src="${escapeHtml(b.url)}" alt="${escapeHtml(b.label)}">
        <span class="bg-label">${escapeHtml(b.label)}</span>
      </button>
    `).join('');
    grid.querySelectorAll('.bg-item').forEach(btn => {
      btn.addEventListener('click', () => applyBackground('image', btn.dataset.bgUrl));
    });
  } catch (e) {
    grid.innerHTML = '<div class="bg-loading">Errore nel caricamento sfondi</div>';
  }

  // Collega anche i bottoni fissi (none/blur)
  document.querySelectorAll('.bg-item.bg-none, .bg-item.bg-blur').forEach(btn => {
    btn.onclick = () => applyBackground(btn.dataset.bgType, null);
  });
  markActiveBackground();
}

async function handleBackgroundUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) { showToast('File troppo grande (max 8MB)'); return; }
  showToast('Caricamento sfondo...');
  try {
    const ext = file.name.split('.').pop().toLowerCase();
    const buffer = await file.arrayBuffer();
    // Upload richiede auth: usa il token salvato se presente
    const token = localStorage.getItem('tdmeet_token');
    const headers = {};
    if (token) headers['x-auth-token'] = token;
    const r = await fetch(`/api/upload/background?ext=${ext}`, {
      method: 'POST', headers, body: buffer,
    });
    const data = await r.json();
    if (data.url) {
      await loadBackgroundPresets();
      await applyBackground('image', data.url);
    } else {
      showToast('Upload fallito: ' + (data.error || 'errore'));
    }
  } catch (err) { showToast('Upload fallito: ' + err.message); }
  e.target.value = '';  // reset per poter ricaricare lo stesso file
}

async function _applyBackgroundImpl(type, imageUrl) {
  // Chiusura modal
  document.getElementById('bgModal').classList.add('hidden');

  // ── Mutua esclusione con effetti viso ───────────────────────────────────
  if (type !== 'none' && faceEffects) {
    showToast('Rimosso effetto viso per applicare sfondo');
    // Simula click "Nessuno" sugli effetti prima
    await _applyFaceEffectImpl('none');   // stessa coda: chiamata diretta
  }

  // ── "none" → stop del background effect, ripristina camera raw ─────────
  if (type === 'none') {
    if (!backgroundEffect) {
      _bgCurrentType = 'none'; _bgCurrentUrl = null;
      document.getElementById('btnBackground')?.classList.remove('active');
      return;
    }
    const originalTrack = rawCamStream.getVideoTracks()[0];
    if (originalTrack && originalTrack.readyState === 'live') {
      await _restoreCamQuality(originalTrack);
      try { await producers.get('video')?.replaceTrack({ track: originalTrack }); } catch { }
    } else {
      // FIX Firefox: uso il clone del clone (stesso approccio di applyFaceEffect).
      // BackgroundEffect ha internamente _sourceTrackClone ancora vivo; lo riclono
      // prima di stop() per avere un track indipendente e saltare getUserMedia.
      let recoveredTrack = null;
      try {
        const bgClone = backgroundEffect?._sourceTrackClone;
        if (bgClone && bgClone.readyState === 'live') {
          recoveredTrack = bgClone.clone();
          console.log('[applyBackground OFF] track recuperato dal clone BackgroundEffect');
        }
      } catch (e) {
        console.warn('[applyBackground OFF] clone del clone fallito:', e.message);
      }

      if (recoveredTrack && recoveredTrack.readyState === 'live') {
        rawCamStream.getVideoTracks().forEach(t => {
          try { t.stop(); } catch (_) { }
          try { rawCamStream.removeTrack(t); } catch (_) { }
        });
        rawCamStream.addTrack(recoveredTrack);
        window._localCamTrack = recoveredTrack;
        if (producers.get('video')) {
          try { await producers.get('video').replaceTrack({ track: recoveredTrack }); } catch { }
        }
      } else {
        // Fallback: retry loop con getUserMedia
        try {
          console.warn('[applyBackground OFF] clone non disponibile, fallback a getUserMedia');
          const camId = window._localCamTrack?.getSettings?.()?.deviceId;
          rawCamStream.getVideoTracks().forEach(t => {
            try { t.stop(); } catch (_) { }
            try { rawCamStream.removeTrack(t); } catch (_) { }
          });
          try {
            if (window._localCamTrack && window._localCamTrack.readyState !== 'ended') {
              window._localCamTrack.stop();
            }
          } catch (_) { }

          const delays = [300, 500, 800, 1200, 2000, 2500];
          let ns = null;
          let lastErr = null;
          for (let i = 0; i < delays.length; i++) {
            await new Promise(r => setTimeout(r, delays[i]));
            try {
              const _w = window._camPreferred || { width: 1280, height: 720 };
              const constraints = (i < 3 && camId)
                ? { video: { deviceId: { ideal: camId }, width: { ideal: _w.width }, height: { ideal: _w.height } } }
                : { video: { width: { ideal: _w.width }, height: { ideal: _w.height } } };
              ns = await navigator.mediaDevices.getUserMedia(constraints);
              console.log(`[applyBackground OFF] camera riacquisita al tentativo ${i + 1}/${delays.length}`);
              break;
            } catch (err) {
              lastErr = err;
              console.warn(`[applyBackground OFF] tentativo ${i + 1}/${delays.length} fallito:`, err.message);
            }
          }
          if (!ns) throw lastErr || new Error('Camera non ri-acquisibile');
          const newT = ns.getVideoTracks()[0];
          rawCamStream.addTrack(newT);
          window._localCamTrack = newT;
          if (producers.get('video')) await producers.get('video').replaceTrack({ track: newT });
        } catch (err) {
          console.error('[applyBackground OFF] ripristino camera fallito:', err);
          showToast('Errore ripristino camera: ricarica la pagina per continuare');
        }
      }
    }
    const v = document.getElementById('video-local');
    if (v) v.srcObject = rawCamStream;
    backgroundEffect.stop();
    backgroundEffect = null;
    await _ensureCameraAlive();
    await _syncLocalVideoToCamera('sfondo rimosso');
    _bgCurrentType = 'none'; _bgCurrentUrl = null;
    document.getElementById('btnBackground')?.classList.remove('active');
    showToast('Sfondo rimosso');
    return;
  }

  // ── Altrimenti: crea/aggiorna pipeline sfondo ──────────────────────────
  showToast('Caricamento sfondo...', 2000);

  // Se già attivo, basta cambiare tipo/url
  if (backgroundEffect && backgroundEffect.loaded) {
    backgroundEffect.setBackground({ type, imageUrl });
    _bgCurrentType = type; _bgCurrentUrl = imageUrl;
    document.getElementById('btnBackground')?.classList.add('active');
    showToast(type === 'blur' ? 'Sfocatura attivata' : 'Sfondo applicato');
    return;
  }

  // Prima attivazione
  _saveCamBaseline();
  try {
    if (backgroundEffect) { try { backgroundEffect.stop(); } catch { } }
    backgroundEffect = new BackgroundEffect();
    const outStream = await backgroundEffect.apply(rawCamStream, { type, imageUrl });
    const newTrack = outStream.getVideoTracks()[0];
    if (!newTrack || newTrack.readyState !== 'live') throw new Error('track canvas non valido');

    if (producers.get('video')) {
      await producers.get('video').replaceTrack({ track: newTrack });
    }
    const v = document.getElementById('video-local');
    if (v) v.srcObject = new MediaStream([newTrack]);

    _bgCurrentType = type; _bgCurrentUrl = imageUrl;
    document.getElementById('btnBackground')?.classList.add('active');
    showToast(type === 'blur' ? 'Sfocatura attivata' : 'Sfondo applicato');
  } catch (e) {
    showToast('Errore: ' + e.message);
    if (backgroundEffect) { try { backgroundEffect.stop(); } catch { } backgroundEffect = null; }
  }
}

function openInfoModal() {
  const modal = document.getElementById('infoModal');
  const body = document.getElementById('infoModalBody');
  if (!body) return;

  const info = _publicSettings?.info || {};
  const branding = _publicSettings?.branding || {};
  const footer = _publicSettings?.footer || {};

  const logoHtml = branding.logoUrl ? `<div class="info-logo"><img src="${escapeHtml(branding.logoUrl)}"></div>` : '';
  const companyName = escapeHtml(info.companyName || 'Tastiere Digitali');
  const companyEmail = info.companyEmail ? escapeHtml(info.companyEmail) : '';
  const companySite = info.companySite ? escapeHtml(info.companySite) : '';
  const devTitle = escapeHtml(info.developerTitle || 'Sviluppato da Giuseppe Sciarra - Tastiere Digitali');
  const platformName = escapeHtml(branding.platformName || '');

  body.innerHTML = `
    ${logoHtml}
    <h4>Piattaforma</h4>
    <p><strong>${platformName}</strong></p>

    <h4>Azienda</h4>
    <p><strong>${companyName}</strong></p>
    ${companyEmail ? `<p>📧 <a href="mailto:${companyEmail}">${companyEmail}</a></p>` : ''}
    ${companySite ? `<p>🌐 <a href="${companySite}" target="_blank" rel="noopener">${companySite}</a></p>` : ''}

    <div class="info-credits">
      ${devTitle}
      ${footer.text && footer.link ? `<br><a href="${escapeHtml(footer.link)}" target="_blank" rel="noopener" style="opacity:0.7">${escapeHtml(footer.text)}</a>` : ''}
    </div>
  `;
  modal.classList.remove('hidden');
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── Popover statistiche rete (hover/tap sulle barrette del tile) ──────────
// Stile Jitsi: risoluzione, fps, bitrate, packet loss, jitter, layer, codec.
// Sampling 1s solo mentre il popover è aperto (zero costo a riposo).
let _nqPop = null, _nqTimer = null, _nqPeer = null, _nqPrev = new Map();

function _nqClose() {
  if (_nqTimer) { clearInterval(_nqTimer); _nqTimer = null; }
  _nqPop?.remove(); _nqPop = null; _nqPeer = null; _nqPrev.clear();
}

async function _nqSample(peerId) {
  const isLocal = peerId === socket?.id;
  const rows = [];
  const kb = (key, bytes, ts) => {
    const p = _nqPrev.get(key); _nqPrev.set(key, { bytes, ts });
    if (!p || ts <= p.ts) return null;
    return Math.max(0, Math.round((bytes - p.bytes) * 8 / (ts - p.ts)));
  };
  if (isLocal) {
    for (const [kind, prod] of producers) {
      if (!prod || prod.closed) continue;
      try {
        let tot = 0, layers = 0, res = '', fps = null;
        (await prod.getStats()).forEach(r => {
          if (r.type !== 'outbound-rtp') return;
          const k = kb('o:' + prod.id + ':' + (r.rid || 'x'), r.bytesSent || 0, r.timestamp);
          if (k != null) tot += k;
          if (r.active !== false && (r.bytesSent || 0) > 0) layers++;
          if (r.frameWidth) { res = `${r.frameWidth}×${r.frameHeight}`; fps = r.framesPerSecond; }
        });
        rows.push({ label: kind === 'video' ? '↑ Video (invio)' : kind === 'screen' ? '↑ Schermo' : '↑ Audio (invio)',
                    kbps: tot, res, fps, extra: kind === 'video' && layers ? `${layers} layer attivi` : '' });
      } catch (e) { /* ignore */ }
    }
  } else {
    for (const [id, c] of consumers) {
      if (c.appData?.producerPeerId !== peerId || c.closed) continue;
      try {
        (await c.getStats()).forEach(r => {
          if (r.type !== 'inbound-rtp') return;
          const k = kb('i:' + id, r.bytesReceived || 0, r.timestamp);
          const isVid = c.kind === 'video';
          const mt = c.appData?.mediaType;
          const pref = _lastSentLayers.get(c.id);
          rows.push({
            label: mt === 'screen' ? '↓ Schermo' : isVid ? '↓ Video' : '↓ Audio',
            kbps: k, res: r.frameWidth ? `${r.frameWidth}×${r.frameHeight}` : '',
            fps: r.framesPerSecond, lost: r.packetsLost,
            jit: r.jitter != null ? Math.round(r.jitter * 1000) : null,
            extra: isVid && mt !== 'screen' && pref ? `layer ${pref.split(':')[0]}` : '',
          });
        });
      } catch (e) { /* ignore */ }
    }
  }
  return rows;
}

function _nqRender(rows, name, level) {
  if (!_nqPop) return;
  const fmt = (v, suf = '') => (v == null || v === '' ? '—' : v + suf);
  let html = `<h4><span class="nq-dot" data-level="${parseInt(level, 10) || 3}"></span>${escapeHtml(name)}</h4><table>`;
  for (const r of rows) {
    html += `<tr><td colspan="2" style="color:#c7d2fe;padding-top:5px;">${r.label}${r.extra ? ` <span style="color:#6b7280;">· ${r.extra}</span>` : ''}</td></tr>`;
    if (r.res) html += `<tr><td>Risoluzione</td><td>${r.res}${r.fps ? ' @ ' + Math.round(r.fps) + 'fps' : ''}</td></tr>`;
    html += `<tr><td>Bitrate</td><td>${fmt(r.kbps, ' kbps')}</td></tr>`;
    if (r.lost != null) html += `<tr><td>Pacchetti persi</td><td>${r.lost}</td></tr>`;
    if (r.jit != null) html += `<tr><td>Jitter</td><td>${r.jit} ms</td></tr>`;
  }
  if (!rows.length) html += `<tr><td colspan="2">In attesa di dati…</td></tr>`;
  html += `</table><div class="nq-sep"></div>
    <button class="nq-ds ${_dataSaver ? 'on' : ''}">🍃 Risparmio dati: ${_dataSaver ? 'ATTIVO' : 'spento'}</button>`;
  _nqPop.innerHTML = html;
  _nqPop.querySelector('.nq-ds')?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('btnDataSaver')?.dispatchEvent(new Event('click'));
    _nqRender(rows, name, level); // aggiorna subito l'etichetta
  });
}

async function _nqOpen(peerId, anchorEl) {
  if (_nqPeer === peerId) return;
  _nqClose();
  _nqPeer = peerId;
  _nqPop = document.createElement('div');
  _nqPop.className = 'netq-popover';
  document.body.appendChild(_nqPop);
  const name = peerId === socket?.id ? 'Tu' : (peers.get(peerId)?.displayName || 'Partecipante');
  const level = anchorEl?.dataset.level || 3;
  _nqRender([], name, level);
  // posizione: sotto le barrette, dentro lo schermo
  const r = anchorEl.getBoundingClientRect();
  const place = () => {
    const pw = _nqPop.offsetWidth, ph = _nqPop.offsetHeight;
    let x = Math.min(Math.max(8, r.left), window.innerWidth - pw - 8);
    let y = r.bottom + 6;
    if (y + ph > window.innerHeight - 8) y = Math.max(8, r.top - ph - 6);
    _nqPop.style.left = x + 'px'; _nqPop.style.top = y + 'px';
  };
  place();
  const tick = async () => { const rows = await _nqSample(peerId); if (_nqPeer === peerId) { _nqRender(rows, name, anchorEl?.dataset.level || level); place(); } };
  await tick();
  _nqTimer = setInterval(tick, 1000);
}

// Delegation: hover desktop + tap mobile sulle barrette di qualsiasi tile
document.addEventListener('mouseover', (e) => {
  const nq = e.target.closest?.('.tile-netq');
  if (nq) { const pid = nq.closest('.video-tile')?.dataset.peerId; if (pid) _nqOpen(pid, nq); }
});
document.addEventListener('mouseout', (e) => {
  if (!_nqPop) return;
  const to = e.relatedTarget;
  if (to && (_nqPop.contains(to) || to.closest?.('.tile-netq'))) return;
  if (e.target.closest?.('.tile-netq') || _nqPop.contains(e.target)) setTimeout(() => {
    if (_nqPop && !_nqPop.matches(':hover') && !document.querySelector('.tile-netq:hover')) _nqClose();
  }, 250);
});
document.addEventListener('click', (e) => {
  const nq = e.target.closest?.('.tile-netq');
  if (nq) { const pid = nq.closest('.video-tile')?.dataset.peerId;
    if (pid) { if (_nqPeer === pid) _nqClose(); else _nqOpen(pid, nq); }
    return; }
  if (_nqPop && !_nqPop.contains(e.target)) _nqClose();
});


// ─── Diagnostica connessione → server (vedi server/connlog.js) ─────────────
// Manda al server: info rete (4g/wifi, rtt, downlink), online/offline, cambio
// rete, visibilità pagina (app in background / schermo bloccato: su iOS Safari
// uccide WebRTC). Il server le logga come [CONN] accanto a ICE/DTLS server-side,
// così una caduta si legge tutta in un posto: docker logs td-meet | grep CONN
// oppure tdConnLog() dalla console (solo host).
let _connDiagStarted = false;
let _wakeLock = null;

async function _acquireWakeLock() {
  // ⭐ Wake Lock: tiene lo schermo acceso in chiamata. Su telefono il blocco
  // schermo automatico ferma camera/mic e spesso butta giù la connessione.
  if (!('wakeLock' in navigator) || _wakeLock) return;
  try {
    _wakeLock = await navigator.wakeLock.request('screen');
    _wakeLock.addEventListener('release', () => { _wakeLock = null; });
  } catch (e) { /* non concesso (batteria bassa, tab non visibile): ignora */ }
}

function _netSnapshot() {
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return {
    online: navigator.onLine,
    conn: c ? { type: c.type, effectiveType: c.effectiveType, downlink: c.downlink, rtt: c.rtt, saveData: c.saveData } : null,
  };
}

function _startConnDiag() {
  if (_connDiagStarted) return;
  _connDiagStarted = true;

  const send = (why) => { try { if (socket?.connected) socket.emit('clientNetInfo', { why, ..._netSnapshot() }); } catch (e) { /* ignore */ } };
  send('join');

  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  let _lastChange = 0;
  if (c && typeof c.addEventListener === 'function') {
    c.addEventListener('change', () => {
      const now = Date.now();
      if (now - _lastChange < 1500) return; // throttle
      _lastChange = now;
      send('change');
    });
  }
  window.addEventListener('online',  () => send('online'));
  window.addEventListener('offline', () => send('offline'));

  document.addEventListener('visibilitychange', () => {
    const state = document.visibilityState;
    try { if (socket?.connected) socket.emit('clientVisibility', { state }); } catch (e) { /* ignore */ }
    if (state === 'visible') { _acquireWakeLock(); send('visible'); }
  });

  // Riconnessione socket: rimanda la snapshot rete
  if (socket?.io) socket.io.on('reconnect', () => send('reconnect'));

  _acquireWakeLock();
  window.addEventListener('pagehide', () => { try { _wakeLock?.release(); } catch (e) { /* ignore */ } });
}

// Console (solo host): tdConnLog()          → eventi di questa stanza
//                      tdConnLog('Maria')   → filtra per nome peer
window.tdConnLog = async function (peerFilter) {
  const token = localStorage.getItem('tdmeet_token');
  if (!token) { console.error('tdConnLog: disponibile solo per host loggati'); return; }
  const q = new URLSearchParams({ room: ROOM_ID, limit: '300' });
  if (peerFilter) q.set('peer', peerFilter);
  const r = await fetch('/api/connlog?' + q.toString(), { headers: { 'x-auth-token': token } });
  if (!r.ok) { console.error('tdConnLog: HTTP', r.status); return; }
  const { events } = await r.json();
  console.error(`[CONN] ${events.length} eventi per stanza ${ROOM_ID}${peerFilter ? ' / peer ~' + peerFilter : ''}`);
  console.table(events.map(e => {
    const { ts, peer, event, transports, producers, ...rest } = e;
    return { ora: ts.slice(11, 19), peer, evento: event, dettagli: JSON.stringify(rest),
             transports: transports ? JSON.stringify(transports) : '', producers: producers ? JSON.stringify(producers) : '' };
  }));
  return events;
};

// ─── Diagnostica WebRTC per-persona (console: tdDiag()) ───────────────────────
// Auto-campiona 1s e calcola il bitrate REALE con una sola chiamata. Raggruppa
// per peer (nome), mostra risoluzione (= layer ricevuto), fps, loss, e il layer
// che abbiamo CHIESTO (preferred). console.error per bypassare il silenziatore prod.
window.tdDiag = async function () {
  const log = (...a) => console.error(...a);
  const SLNAME = { 0: 'r0~270p', 1: 'r1~540p', 2: 'r2~1080p' };

  // snapshot bytes per chiave
  const snap = async () => {
    const m = new Map();
    for (const [kind, p] of producers) {
      try { (await p.getStats()).forEach(r => {
        if (r.type === 'outbound-rtp') m.set('out:' + p.id + ':' + (r.rid || 'x'),
          { bytes: r.bytesSent || 0, ts: r.timestamp, r });
      }); } catch {}
    }
    for (const [id, c] of consumers) {
      try { (await c.getStats()).forEach(r => {
        if (r.type === 'inbound-rtp') m.set('in:' + id,
          { bytes: r.bytesReceived || 0, ts: r.timestamp, r, c });
      }); } catch {}
    }
    return m;
  };

  const a = await snap();
  await new Promise(r => setTimeout(r, 1000));
  const b = await snap();
  const kbps = (k) => {
    const x = a.get(k), y = b.get(k);
    if (!x || !y) return '—';
    const dt = (y.ts - x.ts) / 1000;
    if (dt <= 0) return '0';
    return Math.round(((y.bytes - x.bytes) * 8) / dt / 1000) + ' kbps';
  };

  log('═══════════════════════════════════════════════════════════');
  log('  TD MEET — Diagnostica WebRTC   (tetto layer device/rete: ' + (SLNAME[_maxSpatial] || _maxSpatial) + ')');
  log('═══════════════════════════════════════════════════════════');

  log('\n🔼 TU stai trasmettendo:');
  let txAny = false;
  for (const [kind, p] of producers) {
    for (const k of b.keys()) {
      if (!k.startsWith('out:' + p.id + ':')) continue;
      txAny = true;
      const r = b.get(k).r;
      log(`  ${kind} [rid=${r.rid || 'single'}]`, {
        bitrate: kbps(k),
        res: r.frameWidth ? `${r.frameWidth}x${r.frameHeight}` : 'n/a',
        fps: r.framesPerSecond ?? 'n/a',
        limit: r.qualityLimitationReason || 'none',
      });
    }
  }
  if (!txAny) log('  (niente in trasmissione)');

  log('\n🔽 RICEVI dai peer:');
  if (consumers.size === 0) { log('  (nessun peer)'); }
  else {
    // raggruppa per peer
    const byPeer = new Map();
    for (const [id, c] of consumers) {
      const pid = c.appData?.producerPeerId || '?';
      if (!byPeer.has(pid)) byPeer.set(pid, []);
      byPeer.get(pid).push([id, c]);
    }
    for (const [pid, list] of byPeer) {
      const name = peers.get(pid)?.displayName || pid;
      log(`\n  👤 ${name}`);
      for (const [id, c] of list) {
        const e = b.get('in:' + id); const r = e?.r;
        const want = _lastSentLayers.get(id);
        log(`     ${c.kind} [${c.appData?.mediaType || 'n/a'}]`, {
          bitrate: kbps('in:' + id),
          res: r?.frameWidth ? `${r.frameWidth}x${r.frameHeight}` : 'n/a',
          fps: r?.framesPerSecond ?? 'n/a',
          lost: r?.packetsLost ?? 'n/a',
          jitter: r?.jitter != null ? r.jitter.toFixed(3) + 's' : 'n/a',
          ...(c.kind === 'video' && want ? { chiesto: want + ' (sl:tl)' } : {}),
        });
      }
    }
  }

  log('\n📊 ' + peers.size + ' peer | producers: ' + producers.size + ' | consumers: ' + consumers.size);
  log('═══════════════════════════════════════════════════════════\n');
  return 'OK';
};

// ════════════════════════════════════════════════════════════════════════════
// AUDIO ROBUSTEZZA — banner unblock, mute warning, hot-plug device
// ════════════════════════════════════════════════════════════════════════════

// ─── Banner "Audio bloccato dal browser" ─────────────────────────────────────
let _audioUnblockShown = false;
function showAudioUnblockBanner() {
  if (_audioUnblockShown) return;
  const banner = document.getElementById('audioUnblockBanner');
  if (!banner) return;
  _audioUnblockShown = true;
  banner.classList.remove('hidden');

  const handler = async () => {
    banner.classList.add('hidden');
    _audioUnblockShown = false;
    banner.removeEventListener('click', handler);
    // Riprova play su tutti gli audio remoti + resume audioContext
    if (audioContext && audioContext.state === 'suspended') {
      try { await audioContext.resume(); } catch { }
    }
    if (window._tdmeetPeerAudios) {
      for (const [, audio] of window._tdmeetPeerAudios) {
        if (audio && audio.srcObject) {
          try { await audio.play(); } catch (e) { console.warn('[unblock] play() ancora bloccato', e?.name); }
        }
      }
    }
    // Anche tutti i video con audio nel DOM
    document.querySelectorAll('video, audio').forEach(el => {
      if (el.srcObject && !el.muted) { el.play().catch(() => { }); }
    });
    showToast?.('🔊 Audio attivato', 2000);
  };
  banner.addEventListener('click', handler);

  // Auto-dismiss dopo 60s se l'utente non clicca (per non lasciare il banner per sempre)
  setTimeout(() => { if (_audioUnblockShown) handler(); }, 60000);
}

// ─── Media health: avvisa l'utente quando il SUO audio/video non sta partendo ─
// (permesso negato, device occupato, produce fallito). Il problema classico è
// l'audio: il pulsante sembra "non muto" ma nessun producer esiste → gli altri
// non sentono e l'utente non se ne accorge. Qui mostriamo un banner persistente
// con pulsante "Riprova" + evidenziamo il pulsante in errore.
let _mediaErrStylesInjected = false;
function _injectMediaErrStyles() {
  if (_mediaErrStylesInjected) return;
  _mediaErrStylesInjected = true;
  const s = document.createElement('style');
  s.id = 'tdMediaErrStyle';
  s.textContent = `
    .td-media-banner{position:fixed;left:50%;transform:translateX(-50%);z-index:10000;
      display:flex;align-items:center;gap:12px;max-width:92vw;
      color:#fff;border-radius:12px;padding:12px 16px;
      box-shadow:0 6px 24px rgba(0,0,0,.35);font-family:inherit;font-size:14px;line-height:1.3;
      animation:tdMediaIn .25s ease;}
    @keyframes tdMediaIn{from{opacity:0;transform:translate(-50%,8px);}to{opacity:1;transform:translate(-50%,0);}}
    #tdMicErrorBanner{bottom:104px;background:#d93025;}
    #tdCamErrorBanner{bottom:168px;background:#b8530a;}
    .td-media-banner .tdme-ico{font-size:20px;flex:0 0 auto;}
    .td-media-banner .tdme-txt{flex:1 1 auto;}
    .td-media-banner .tdme-title{font-weight:700;}
    .td-media-banner .tdme-sub{opacity:.92;font-size:12px;margin-top:2px;}
    .td-media-banner button{flex:0 0 auto;background:#fff;color:#222;border:0;border-radius:8px;
      padding:8px 14px;font-weight:700;font-size:13px;cursor:pointer;}
    .td-media-banner button:disabled{opacity:.6;cursor:default;}
    .ctrl-btn.td-media-fault{box-shadow:0 0 0 3px #d93025 inset !important;}
    .ctrl-btn.td-media-fault.cam{box-shadow:0 0 0 3px #b8530a inset !important;}
    @media(max-width:640px){
      #tdMicErrorBanner{bottom:150px;}
      #tdCamErrorBanner{bottom:212px;}
      .td-media-banner{font-size:13px;padding:10px 12px;gap:10px;}
    }`;
  document.head.appendChild(s);
}

function setMicError(sub) {
  _injectMediaErrStyles();
  document.getElementById('btnMic')?.classList.add('td-media-fault');
  let b = document.getElementById('tdMicErrorBanner');
  if (!b) {
    b = document.createElement('div');
    b.id = 'tdMicErrorBanner';
    b.className = 'td-media-banner';
    b.innerHTML = `<span class="tdme-ico">🎤</span>
      <span class="tdme-txt"><span class="tdme-title">Il tuo microfono non è attivo — gli altri NON ti sentono</span>
      <span class="tdme-sub"></span></span>
      <button type="button">Riprova</button>`;
    document.body.appendChild(b);
    b.querySelector('button').addEventListener('click', async () => {
      const btn = b.querySelector('button');
      btn.disabled = true; btn.textContent = '…';
      try {
        micMuted = false;
        await produceAudio();
        if (producers.get('audio')) {
          const mic = document.getElementById('btnMic');
          mic?.classList.remove('off');
          document.querySelector('#btnMic .icon-on')?.classList.remove('hidden');
          document.querySelector('#btnMic .icon-off')?.classList.add('hidden');
          setTileMuted('local', false);
          socket?.emit('mediaState', { type: 'audio', status: false });
        }
      } catch (e) { console.error('[micError retry]', e); }
      btn.disabled = false; btn.textContent = 'Riprova';
    });
  }
  b.querySelector('.tdme-sub').textContent = sub || "Controlla i permessi del microfono nel browser o se è usato da un'altra app.";
}
function clearMicError() {
  document.getElementById('btnMic')?.classList.remove('td-media-fault');
  document.getElementById('tdMicErrorBanner')?.remove();
}

function setCamError(sub) {
  _injectMediaErrStyles();
  document.getElementById('btnCamera')?.classList.add('td-media-fault', 'cam');
  let b = document.getElementById('tdCamErrorBanner');
  if (!b) {
    b = document.createElement('div');
    b.id = 'tdCamErrorBanner';
    b.className = 'td-media-banner';
    b.innerHTML = `<span class="tdme-ico">📷</span>
      <span class="tdme-txt"><span class="tdme-title">La tua videocamera non è attiva</span>
      <span class="tdme-sub"></span></span>
      <button type="button">Riprova</button>`;
    document.body.appendChild(b);
    b.querySelector('button').addEventListener('click', async () => {
      const btn = b.querySelector('button');
      btn.disabled = true; btn.textContent = '…';
      try {
        camOff = false;
        await produceVideo();
        if (producers.get('video')) {
          const cam = document.getElementById('btnCamera');
          cam?.classList.remove('off');
          document.querySelector('#btnCamera .icon-on')?.classList.remove('hidden');
          document.querySelector('#btnCamera .icon-off')?.classList.add('hidden');
          setTileVideo('local', rawCamStream, true);
          socket?.emit('mediaState', { type: 'video', status: false });
        }
      } catch (e) { console.error('[camError retry]', e); }
      btn.disabled = false; btn.textContent = 'Riprova';
    });
  }
  b.querySelector('.tdme-sub').textContent = sub || "Controlla i permessi della camera nel browser o se è usata da un'altra app.";
}
function clearCamError() {
  document.getElementById('btnCamera')?.classList.remove('td-media-fault', 'cam');
  document.getElementById('tdCamErrorBanner')?.remove();
}

// ─── Mute warning: rileva se l'utente parla mentre è in mute ─────────────────
let _muteWarningCtx = null;
let _muteWarningRAF = null;
let _muteWarningHideTimer = null;
async function startMuteWarningDetection() {
  stopMuteWarningDetection();
  if (!localMicTrack) return; // niente mic → non possiamo sapere

  try {
    _muteWarningCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_muteWarningCtx.state === 'suspended') await _muteWarningCtx.resume();

    // Importante: usiamo un MediaStream costruito ad-hoc col SOLO mic track,
    // perché localMicTrack.enabled=false (mute) silenzia il flusso outbound MA
    // il dato grezzo del microfono è ancora leggibile via Web Audio.
    // Tuttavia, su molti browser MediaStreamSource su un track con enabled=false
    // restituisce silenzio. Allora cloniamo il track per il monitoring.
    const monitorTrack = localMicTrack.clone();
    monitorTrack.enabled = true; // il clone è separato, niente effetti collaterali sull'outbound
    const monitorStream = new MediaStream([monitorTrack]);

    const src = _muteWarningCtx.createMediaStreamSource(monitorStream);
    const analyser = _muteWarningCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.5;
    src.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    let sustainedFrames = 0;

    const tick = () => {
      analyser.getByteFrequencyData(data);
      // Energia in banda voce (200–4000 Hz approssimativi → bin centrali su 22kHz)
      let sum = 0; for (let i = 4; i < 80; i++) sum += data[i];
      const avg = sum / 76;

      if (avg > 22) {
        sustainedFrames++;
        // ~25 frame ≈ 400ms di voce → mostra il banner
        if (sustainedFrames >= 25) showMuteWarning();
      } else {
        sustainedFrames = Math.max(0, sustainedFrames - 2);
      }
      _muteWarningRAF = requestAnimationFrame(tick);
    };
    tick();

    // Cleanup quando il monitor track muore
    monitorTrack.addEventListener('ended', stopMuteWarningDetection);
    _muteWarningCtx._monitorTrack = monitorTrack; // tenere riferimento per stop
  } catch (e) {
    console.warn('[muteWarning] init fallito', e);
  }
}

function stopMuteWarningDetection() {
  if (_muteWarningRAF) { cancelAnimationFrame(_muteWarningRAF); _muteWarningRAF = null; }
  if (_muteWarningCtx) {
    try { _muteWarningCtx._monitorTrack?.stop(); } catch { }
    try { _muteWarningCtx.close(); } catch { }
    _muteWarningCtx = null;
  }
}

function showMuteWarning() {
  const b = document.getElementById('muteWarningBanner');
  if (!b) return;
  b.classList.remove('hidden');
  clearTimeout(_muteWarningHideTimer);
  // Si nasconde da solo dopo 2.5s di silenzio
  _muteWarningHideTimer = setTimeout(() => { b.classList.add('hidden'); }, 2500);
}
function hideMuteWarning() {
  const b = document.getElementById('muteWarningBanner');
  if (!b) return;
  b.classList.add('hidden');
  clearTimeout(_muteWarningHideTimer);
}

// ─── Hot-plug device: gestisce cuffie/mic collegati o staccati al volo ───────
let _devChangeWatcherActive = false;
function setupDeviceChangeWatcher() {
  if (_devChangeWatcherActive) return;
  _devChangeWatcherActive = true;
  if (!navigator.mediaDevices || !navigator.mediaDevices.addEventListener) return;

  navigator.mediaDevices.addEventListener('devicechange', async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const currentMicId = localMicTrack?.getSettings?.()?.deviceId;
      const currentCamId = localCamTrack?.getSettings?.()?.deviceId;

      const micStillPresent = devices.some(d => d.kind === 'audioinput' && d.deviceId === currentMicId);
      const camStillPresent = devices.some(d => d.kind === 'videoinput' && d.deviceId === currentCamId);

      // Se il device attuale è sparito (es. cuffie staccate), mostra notifica.
      // L'evento "trackended" del producer si occuperà del recovery automatico.
      if (currentMicId && !micStillPresent) {
        showToast?.('⚠ Microfono scollegato — passo al microfono di sistema', 4500);
      }
      if (currentCamId && !camStillPresent) {
        showToast?.('⚠ Camera scollegata', 4500);
      }

      // Se è stato collegato un nuovo dispositivo, notifica (l'utente può cambiarlo dal popup chevron)
      const knownAudioCount = window._lastKnownAudioInputCount;
      const newAudioCount = devices.filter(d => d.kind === 'audioinput').length;
      if (knownAudioCount !== undefined && newAudioCount > knownAudioCount) {
        showToast?.('🎙 Nuovo microfono rilevato — cliccare ▾ accanto al pulsante mic per selezionarlo', 5500);
      }
      window._lastKnownAudioInputCount = newAudioCount;
    } catch (e) {
      console.warn('[devicechange]', e);
    }
  });

  // Stato iniziale
  navigator.mediaDevices.enumerateDevices().then(d => {
    window._lastKnownAudioInputCount = d.filter(x => x.kind === 'audioinput').length;
  }).catch(() => { });
}

// Esponi per debug
window.showAudioUnblockBanner = showAudioUnblockBanner;
window.startMuteWarningDetection = startMuteWarningDetection;

// ════════════════════════════════════════════════════════════════════════════
// VIDEO ROTATION — fix per iPad/Android in landscape che Firefox non gira
// ════════════════════════════════════════════════════════════════════════════

window._videoRotations = window._videoRotations || new Map(); // peerId → angle (0/90/180/270/-1=mirror)
window._videoRotationsManual = window._videoRotationsManual || new Set(); // peerId con override manuale dell'utente

const ROT_CYCLE = [0, 90, 180, 270, -1]; // -1 = mirror (scaleX(-1))

function applyVideoRotation(peerId, val) {
  const tile = peerTiles.get(peerId); if (!tile) return;
  tile.classList.remove('rot-90', 'rot-180', 'rot-270', 'rot-mirror');
  if (val === 90) tile.classList.add('rot-90');
  if (val === 180) tile.classList.add('rot-180');
  if (val === 270) tile.classList.add('rot-270');
  if (val === -1) tile.classList.add('rot-mirror');
  window._videoRotations.set(peerId, val);
}

function cycleVideoRotation(peerId) {
  const cur = window._videoRotations.get(peerId) ?? 0;
  const idx = ROT_CYCLE.indexOf(cur);
  const next = ROT_CYCLE[(idx + 1) % ROT_CYCLE.length];
  applyVideoRotation(peerId, next);
  window._videoRotationsManual.add(peerId); // l'utente ha deciso, non sovrascriverla con auto
  showToast?.(next === 0 ? 'Rotazione: normale' : next === -1 ? 'Rotazione: specchio' : `Rotazione: ${next}°`, 1500);
}

window.cycleVideoRotation = cycleVideoRotation;
window.applyVideoRotation = applyVideoRotation;

// ════════════════════════════════════════════════════════════════════════════
// R12 — regole stanza, mini-guida
// ════════════════════════════════════════════════════════════════════════════
function _applyPolicyUi() {
  const pol = window.__policy || {};
  const btn = document.getElementById('btnScreen');
  if (!btn) return;
  const canCapture = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  const guestBlocked = !window.__isHostRole && pol.guestScreenShare === false;
  // Telefoni e tablet non hanno getDisplayMedia: il pulsante sparisce (lo nasconde
  // il CSS su .unsupported) invece di restare lì a non fare niente.
  if (!canCapture) btn.classList.add('unsupported');
  if (guestBlocked) btn.classList.add('hidden');
}

function startTour(force) {
  if (!window.TdtTour) return;
  const pol = window.__policy || window.__BRAND?.rooms || {};
  // Parte da sola SOLO se l'interruttore è acceso in Impostazioni → Riunioni.
  // Resta sempre richiamabile a mano con il "?" in alto.
  if (!force && pol.tour !== true) return;
  window.TdtTour.start([
    { el: '#btnMic', title: 'Microfono e videocamera', text: 'Accendili o spegnili da qui. La freccina accanto serve a scegliere un altro microfono, altoparlante o videocamera. Scorciatoie: M e V.' },
    { el: '#btnScreen', title: 'Presenta il tuo schermo', text: 'Premi Presenta, poi nella finestra del browser scegli cosa mostrare: una scheda, una finestra o lo schermo intero. Per smettere, premi di nuovo.' },
    { el: '#btnAnnotate:not(.hidden), #btnMore', title: 'Disegna e indica', text: 'Quando qualcuno presenta compare Disegna: penna, evidenziatore, frecce e puntatore laser visibili a tutti. In Altro trovi lo sfondo virtuale e gli effetti viso.' },
    { el: '#btnLeave', title: 'Uscire', text: 'Quando hai finito, esci da qui. Puoi rivedere questa guida con il ? in alto.' },
  ], { force });
}
