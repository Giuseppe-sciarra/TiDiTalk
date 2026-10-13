'use strict';

// ⭐ FIX BUG 6: rilevamento device per gestire correttamente i constraints.
// iOS Safari ignora deliberatamente deviceId (il routing è gestito dal SO):
// forzare 'exact' su iOS può causare OverconstrainedError o restituire un
// device diverso. Su Android va bene 'ideal'. Su desktop 'exact' è affidabile.
const _UA = (navigator.userAgent || '');
const _isIOS = /iPad|iPhone|iPod/.test(_UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const _isIOSSafari = _isIOS && /Safari/.test(_UA) && !/CriOS|FxiOS|EdgiOS/.test(_UA);
const _isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(_UA);

/**
 * Regolazione automatica del volume del microfono (AGC).
 * Su Mac e Windows l'AGC del browser può abbassare il volume d'ingresso DEL
 * SISTEMA quando sente eco o voce forte, e lasciarlo giù. Si può spegnere dal
 * selettore del microfono; la scelta resta nel browser.
 * Default: ACCESA ovunque, come i browser e come prima. Spegnendola di
 * default sul Mac, i microfoni integrati arrivavano troppo bassi e la gente
 * era costretta a cambiare sorgente. Chi ha il problema dell'ingresso che si
 * abbassa da solo la spegne dal popup del microfono (la scelta resta salvata).
 */
const _AGC_KEY = 'tdt_mic_agc';
const _isMacDesktop = /Mac/.test(navigator.platform || '') && !_isIOS;
window._tdmeetAgc = function () {
  try {
    const v = localStorage.getItem(_AGC_KEY);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch (_) { }
  return true;
};
window._tdmeetSetAgc = function (on) {
  try { localStorage.setItem(_AGC_KEY, on ? '1' : '0'); } catch (_) { }
};

/**
 * Costruisce constraints audio robusti per il dispositivo corrente.
 * Esposto globalmente perché lo usano anche prejoin.js e room.js (fallback).
 */
window._tdmeetBuildAudioConstraints = function(deviceId) {
  const audioBase = { echoCancellation: true, noiseSuppression: true, autoGainControl: window._tdmeetAgc() };
  if (!deviceId || deviceId === 'default' || deviceId === 'communications') return audioBase;
  if (_isIOSSafari) return audioBase;                                  // iOS: ignora deviceId
  if (_isMobileDevice) return { ...audioBase, deviceId: { ideal: deviceId } };
  return { ...audioBase, deviceId: { exact: deviceId } };
};

/**
 * Costruisce constraints video robusti per il dispositivo corrente.
 */
window._tdmeetBuildVideoConstraints = function(deviceId, extra = {}) {
  const base = { width: { ideal: 1280 }, height: { ideal: 720 }, ...extra };
  if (!deviceId || deviceId === '') return base;
  if (_isIOSSafari) return base;                                       // iOS: ignora deviceId
  if (_isMobileDevice) return { ...base, deviceId: { ideal: deviceId } };
  return { ...base, deviceId: { exact: deviceId } };
};

/**
 * ⭐ 1.5.4 — Uscita audio (casse/cuffie).
 * _tdmeetSpeakerId: null o '' = USCITA DI SISTEMA (nessun setSinkId),
 * 'default' = la stessa cosa su Chrome/Edge, altrimenti un dispositivo scelto
 * dall'utente. Prima, se non c'era una scelta, si prendeva il PRIMO dispositivo
 * della lista: su Firefox (che non ha la voce "default") era quasi sempre
 * "Altoparlanti MacBook" → l'audio della riunione usciva dal Mac mentre la
 * persona aveva le cuffie in testa.
 */
window._tdmeetOutputOptions = function (outputs) {
  const list = (outputs || []).slice();
  if (!list.some(d => d.deviceId === 'default')) list.unshift({ deviceId: '', label: 'Predefinita del sistema', virtual: true });
  return list;
};
window._tdmeetCurrentOutput = function (outputs) {
  const id = window._tdmeetSpeakerId || '';
  const list = outputs || [];
  if (id && list.some(d => d.deviceId === id)) return id;
  return list.some(d => d.deviceId === 'default') ? 'default' : '';
};
window._tdmeetCanPickOutput = function () {
  return typeof document.createElement('audio').setSinkId === 'function';
};
/** Applica l'uscita scelta a un elemento audio/video; se fallisce torna a quella di sistema. */
window._tdmeetApplySink = async function (el, id) {
  if (!el || typeof el.setSinkId !== 'function') return true;
  const want0 = id === undefined ? window._tdmeetSpeakerId : id;
  const want = want0 && want0 !== 'default' ? want0 : '';
  if ((el.sinkId || '') === want) return true;
  try { await el.setSinkId(want); return true; }
  catch (e) {
    console.warn('[sink] setSinkId fallito', e?.name, e?.message);
    if (want) { try { await el.setSinkId(''); } catch (_) { } }
    return false;
  }
};

/**
 * DeviceSelector
 * Popup contestuale che appare sui chevron di microfono, uscita audio e camera.
 * Mostra dispositivi disponibili filtrati per tipo.
 */
class DeviceSelector {
  constructor() {
    this.open = false;
    this.activeType = null;
    this.devices = { audioinput: [], videoinput: [], audiooutput: [] };
    this.producers = null;
    this.rawStream = null;
    this._closeHandler = null;
    this._openTimestamp = 0;
    this._isTouchDevice = ('ontouchstart' in window);
  }

  init(producers, rawCamStream) {
    this.producers = producers;
    this.rawStream = rawCamStream;

    const _bindChevron = (id, type) => {
      const btn = document.getElementById(id);
      if (!btn) return;

      // Desktop: click normale
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._toggle(type, btn);
      });

      // Mobile: touchend — preventDefault impedisce il click sintetico
      // così evitiamo la doppia chiamata click+touchend
      btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._toggle(type, btn);
      });
    };

    _bindChevron('btnMicChevron', 'audioinput');
    _bindChevron('btnSpkChevron', 'audiooutput');   // 1.5.4: uscita audio separata dal microfono
    _bindChevron('btnCamChevron', 'videoinput');
  }

  async _toggle(type, anchor) {
    // Se già aperto sullo stesso tipo → chiudi
    if (this.open && this.activeType === type) {
      this._close();
      return;
    }

    // Chiudi eventuale popup già aperto su tipo diverso
    if (this.open) this._close();

    this.activeType = type;
    this.open = true;
    this._openTimestamp = Date.now();

    await this._loadDevices();
    this._renderPopup(type, anchor);
    this._attachCloseHandler();
  }

  _attachCloseHandler() {
    // Rimuovi handler precedente su tutti gli eventi possibili
    this._detachCloseHandler();

    this._closeHandler = (e) => {
      // Ignora eventi troppo ravvicinati all'apertura (evita race touch→click)
      if (Date.now() - this._openTimestamp < 300) return;

      const popup = document.getElementById('devicePopup');
      if (popup && !popup.contains(e.target)) {
        this._close();
      }
    };

    // Su touch device usa touchstart per intercettare il tap fuori immediatamente;
    // usa anche click come fallback per i casi in cui touchstart non basti
    if (this._isTouchDevice) {
      // Piccolo delay per non intercettare il touchstart che ha aperto il popup
      setTimeout(() => {
        document.addEventListener('touchstart', this._closeHandler, { passive: true });
        document.addEventListener('click', this._closeHandler);
      }, 350);
    } else {
      setTimeout(() => {
        document.addEventListener('click', this._closeHandler);
      }, 50);
    }
  }

  _detachCloseHandler() {
    if (this._closeHandler) {
      document.removeEventListener('click', this._closeHandler);
      document.removeEventListener('touchstart', this._closeHandler);
      this._closeHandler = null;
    }
  }

  _close() {
    this.open = false;
    document.getElementById('devicePopup')?.classList.add('hidden');
    this._detachCloseHandler();
    this._stopMeters();
  }

  /* ── Livelli e volume automatico ────────────────────────────────────────
     Il volume di SISTEMA (cursore d'ingresso del Mac, volume delle casse) non
     è leggibile né modificabile da una pagina web: nessun browser lo espone.
     Qui si mostra il segnale REALE: quanto arriva dal microfono e quanto sta
     uscendo verso le casse, così si capisce al volo se il problema è "non mi
     sentono" o "non li sento". */
  _renderAudioExtras(type) {
    const popup = document.getElementById('devicePopup');
    let box = document.getElementById('devicePopupExtra');
    if (type !== 'audioinput' && type !== 'audiooutput') { box?.remove(); this._stopMeters(); return; }
    if (!box) {
      box = document.createElement('div');
      box.id = 'devicePopupExtra';
      box.className = 'device-popup-extra';
      popup.appendChild(box);
    }
    const T = (x) => (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t(x) : x;
    // ── 1.5.4: popup dell'USCITA AUDIO (casse/cuffie), separato dal microfono ──
    if (type === 'audiooutput') {
      const muted = !!window._tdIsSpkMuted?.();
      box.innerHTML = `
        <div class="device-popup-sep">Livello</div>
        <div class="dp-row"><span class="dp-lbl">Casse</span><div class="dp-meter"><i id="dpSpkBar"></i></div></div>
        <div class="dp-hint" id="dpSpkHint"></div>
        <button type="button" class="dp-test-btn" id="dpSpkTest">🔊 <span>Fai un suono di prova</span></button>
        <button type="button" class="dp-link-btn" id="dpSpkFix">Non senti niente? Ricollega l'audio</button>
        ${window._tdmeetCanPickOutput() ? '' : '<div class="dp-hint dp-note"><span>Questo browser usa l\'uscita audio scelta nel sistema: per cambiarla usa le impostazioni audio del computer.</span></div>'}`;
      const hint = box.querySelector('#dpSpkHint');
      hint.textContent = T(muted ? 'Casse silenziate: non senti gli altri' : 'La barra si muove quando parla qualcuno');
      box.querySelector('#dpSpkTest').addEventListener('click', (e) => { e.stopPropagation(); this.testOutput(); });
      box.querySelector('#dpSpkFix').addEventListener('click', (e) => {
        e.stopPropagation();
        window._tdReattachRemoteAudio?.();
        window.showToast?.('Audio ricollegato. Se ancora non senti nemmeno il suono di prova, chiudi e riapri il browser', 5000);
      });
      this._startMeters('out');
      return;
    }
    const agcOn = window._tdmeetAgc();
    const actual = window._localMicTrack?.getSettings?.()?.autoGainControl;
    box.innerHTML = `
      <div class="device-popup-sep">Livello</div>
      <div class="dp-row"><span class="dp-lbl">Microfono</span><div class="dp-meter"><i id="dpMicBar"></i></div></div>
      <div class="dp-hint" id="dpMicHint">Parla per vedere il livello</div>
      <label class="dp-switch">
        <input type="checkbox" id="dpAgc" ${agcOn ? 'checked' : ''}>
        <span class="dp-track"></span>
        <span class="dp-switch-text">Regola il volume del microfono automaticamente</span>
      </label>
      <div class="dp-hint"><span>Se il volume d'ingresso del computer si abbassa da solo durante le chiamate, spegnilo.</span>${actual === undefined ? '' : ' <span>' + (actual ? 'Ora è attivo' : 'Ora è spento') + '</span>'}</div>
      ${window.TdtNoise?.supported() ? `
      <label class="dp-switch">
        <input type="checkbox" id="dpRnn" ${window.TdtNoise.enabled || window.TdtNoise.wanted() ? 'checked' : ''}>
        <span class="dp-track"></span>
        <span class="dp-switch-text">Riduzione rumore avanzata (RNNoise)</span>
      </label>
      <div class="dp-hint"><span>Toglie tastiera, ventole e traffico con una rete neurale che gira nel browser. Nessun dato esce dal tuo computer.</span></div>` : ''}
      <div class="dp-hint dp-note">Il volume di sistema non è leggibile dal browser: qui vedi il segnale reale.</div>`;

    const rnn = box.querySelector('#dpRnn');
    if (rnn) {
      rnn.addEventListener('click', (e) => e.stopPropagation());
      rnn.addEventListener('change', async () => {
        rnn.disabled = true;
        try { await this.setRnn(rnn.checked); } catch (_) { rnn.checked = false; } finally { rnn.disabled = false; }
      });
    }

    const agc = box.querySelector('#dpAgc');
    agc.addEventListener('click', (e) => e.stopPropagation());
    agc.addEventListener('change', () => this.setAgc(agc.checked));
    this._startMeters('mic');
  }

  // ── 1.5.4: suono di prova sull'uscita scelta (suona anche a casse silenziate:
  // è una prova esplicita). Generato al volo, niente file da scaricare.
  async testOutput() {
    try {
      const sr = 24000, dur = 0.75, n = Math.floor(sr * dur);
      const buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
      const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
      w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
      v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
      w(36, 'data'); v.setUint32(40, n * 2, true);
      for (let i = 0; i < n; i++) {
        const t = i / sr, f = t < 0.3 ? 660 : 880;
        const env = Math.min(1, t / 0.02) * Math.min(1, (dur - t) / 0.08) * (t > 0.28 && t < 0.32 ? 0.2 : 1);
        v.setInt16(44 + i * 2, Math.sin(2 * Math.PI * f * t) * 0.35 * env * 32767, true);
      }
      const url = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
      const a = new Audio(url);
      await window._tdmeetApplySink(a);
      a.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true });
      await a.play();
    } catch (e) {
      console.warn('[testOutput]', e);
      window.showToast?.('Non riesco a riprodurre il suono di prova', 3000);
    }
  }

  // ── Riduzione rumore RNNoise: usata dal popup e dal pannello Impostazioni ──
  async setRnn(on) {
    const N = window.TdtNoise, producer = this.producers?.get('audio');
    try {
      if (on) {
        const out = await N.enable(window._localMicTrack);
        if (producer && !producer.closed) await producer.replaceTrack({ track: out });
        N.setWanted(true);
        window.showToast?.('Riduzione rumore avanzata attiva', 2500);
      } else {
        // prima il microfono raw torna nel producer, POI si chiude il filtro:
        // chiudendo prima l'AudioContext il track del producer terminava →
        // 'trackended' → ricostruzione del microfono per niente
        if (producer && !producer.closed && window._localMicTrack) await producer.replaceTrack({ track: window._localMicTrack });
        N.disable(); N.setWanted(false);
        window.showToast?.('Riduzione rumore avanzata spenta', 2500);
      }
    } catch (e) {
      console.warn('[rnnoise]', e);
      N.setWanted(false);
      window.showToast?.('Riduzione rumore non disponibile: ' + (e?.message || e), 3500);
      throw e;
    }
    document.dispatchEvent(new CustomEvent('tdt:devices'));
  }

  // ── Volume automatico (AGC): riapre lo stesso microfono con la nuova impostazione ──
  async setAgc(on) {
    window._tdmeetSetAgc(on);
    const cur = window._localMicTrack?.getSettings?.()?.deviceId || 'default';
    window.showToast?.(on ? 'Volume automatico attivato' : 'Volume automatico spento', 2500);
    // Da mutato gira il rilevatore "stai parlando ma sei muto", che tiene un
    // CLONE del microfono: Chrome riusa quella sorgente (con il vecchio AGC)
    // per il track nuovo e l'impostazione non cambierebbe. Lo si ferma prima
    // e lo si riaccende dopo.
    const wasMonitoring = typeof micMuted !== 'undefined' && micMuted && typeof stopMuteWarningDetection === 'function';
    if (wasMonitoring) { try { stopMuteWarningDetection(); } catch (_) { } }
    await this._switch('audioinput', cur);
    if (wasMonitoring && micMuted && typeof startMuteWarningDetection === 'function') {
      try { startMuteWarningDetection(); } catch (_) { }
    }
  }

  _startMeters(which = 'mic') {
    this._stopMeters();
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = this._meterCtx || (this._meterCtx = new Ctx());
      if (ctx.state === 'suspended') ctx.resume().catch(() => { });
      const mk = () => { const a = ctx.createAnalyser(); a.fftSize = 512; return a; };
      const micAn = mk(), spkAn = mk();
      const nodes = [];
      const micTrack = window._localMicTrack;
      if (which === 'mic' && micTrack && micTrack.readyState === 'live') {
        const src = ctx.createMediaStreamSource(new MediaStream([micTrack]));
        src.connect(micAn); nodes.push(src);
      }
      // casse: somma dell'audio in arrivo dagli altri (non collegato all'uscita:
      // si misura soltanto, non si riproduce una seconda volta)
      const audios = which === 'out' && window._tdmeetPeerAudios ? [...window._tdmeetPeerAudios.values()] : [];
      audios.forEach(a => {
        const st = a?.srcObject;
        if (!st || !st.getAudioTracks().length) return;
        try { const src = ctx.createMediaStreamSource(st); src.connect(spkAn); nodes.push(src); } catch (_) { }
      });
      const buf = new Float32Array(micAn.fftSize);
      const level = (an) => {
        an.getFloatTimeDomainData(buf);
        let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        return Math.min(1, rms * 6);          // scala "a occhio" per la barra
      };
      let micPeak = 0, micSince = Date.now();
      const tick = () => {
        const micBar = document.getElementById('dpMicBar');
        const spkBar = document.getElementById('dpSpkBar');
        const hint = document.getElementById('dpMicHint');
        if ((!micBar && !spkBar) || document.getElementById('devicePopup')?.classList.contains('hidden')) { this._stopMeters(); return; }
        const m = which === 'mic' && nodes.length ? level(micAn) : 0;
        const k = which === 'out' ? level(spkAn) : 0;
        if (micBar) micBar.style.width = Math.round(m * 100) + '%';
        if (spkBar) spkBar.style.width = Math.round(k * 100) + '%';
        micPeak = Math.max(micPeak * 0.995, m);
        const muted = typeof micMuted !== 'undefined' && micMuted;
        if (hint && which === 'mic') {
          let msg;
          if (muted) msg = 'Microfono spento: gli altri non ti sentono';
          else if (!micTrack || micTrack.readyState !== 'live') msg = 'Microfono non disponibile';
          else if (micPeak > 0.08) msg = 'Ti sentono bene';
          else if (Date.now() - micSince > 4000) msg = 'Livello molto basso: parla per provare. Se la barra resta ferma, alza il volume d\'ingresso nelle impostazioni audio del computer.';
          else msg = 'Parla per vedere il livello';
          // tradotto qui e scritto solo se cambia: niente ping-pong col traduttore
          const tr = window.I18n?.t ? window.I18n.t(msg) : msg;
          if (hint.textContent !== tr) hint.textContent = tr;
        }
        this._meterRaf = requestAnimationFrame(tick);
      };
      this._meterNodes = nodes;
      this._meterRaf = requestAnimationFrame(tick);
    } catch (e) { console.warn('[devices] indicatori livello non disponibili', e?.message); }
  }

  _stopMeters() {
    if (this._meterRaf) cancelAnimationFrame(this._meterRaf);
    this._meterRaf = 0;
    (this._meterNodes || []).forEach(n => { try { n.disconnect(); } catch (_) { } });
    this._meterNodes = [];
  }

  async _loadDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.devices.audioinput  = devices.filter(d => d.kind === 'audioinput');
      this.devices.videoinput  = devices.filter(d => d.kind === 'videoinput');
      this.devices.audiooutput = devices.filter(d => d.kind === 'audiooutput');

      // 1.5.4: nessuna scelta = uscita di sistema. Prima si prendeva il PRIMO
      // dispositivo della lista (su Firefox: "Altoparlanti MacBook" anche con
      // le cuffie in testa). Qui non si sceglie più niente da soli.
    } catch (e) {
      console.warn('[devices] enumerateDevices:', e);
    }
  }

  _renderPopup(type, anchor) {
    const popup      = document.getElementById('devicePopup');
    const titleEl    = document.getElementById('devicePopupTitle');
    const listEl     = document.getElementById('devicePopupList');
    const speakerSec = document.getElementById('devicePopupSpeaker');
    const speakerList= document.getElementById('devicePopupSpeakerList');

    // 1.5.4: "Microfono" e "Uscita audio" (prima "Audio" e "Speaker", che la
    // traduzione trasformava in "Relatore")
    const labels = { audioinput: '🎙 Microfono', audiooutput: '🔊 Uscita audio', videoinput: '📷 Videocamera' };
    titleEl.textContent = labels[type] || 'Dispositivo';
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    let items = this.devices[type] || [];
    let currentId;
    if (type === 'audiooutput') {
      items = window._tdmeetOutputOptions(items);
      if (!window._tdmeetCanPickOutput()) items = items.filter(d => d.virtual || d.deviceId === 'default').slice(0, 1);
      currentId = window._tdmeetCurrentOutput(this.devices.audiooutput);
    } else {
      currentId = type === 'audioinput'
        ? (window._localMicTrack?.getSettings?.()?.deviceId || '')
        : (window._localCamTrack?.getSettings?.()?.deviceId || '');
    }
    const fallback = type === 'audiooutput' ? 'Uscita audio ' : 'Dispositivo ';
    listEl.innerHTML = items.map((d, i) => `
      <button class="device-popup-item${d.deviceId === currentId ? ' active' : ''}"
              data-id="${esc(d.deviceId)}" data-type="${type}">
        <span class="device-popup-item-label"${d.virtual ? '' : ' translate="no"'}>${esc(d.label || fallback + (i + 1))}</span>
      </button>`).join('');

    listEl.querySelectorAll('.device-popup-item').forEach(btn => {
      btn.addEventListener('click', () => this._switch(btn.dataset.type, btn.dataset.id));
      // Touch: preventDefault evita doppio trigger click
      btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        this._switch(btn.dataset.type, btn.dataset.id);
      });
    });

    // 1.5.4: l'uscita audio ha il suo pulsante e il suo popup: la vecchia
    // sezione "Speaker" dentro il popup del microfono non si mostra più
    speakerSec?.classList.add('hidden');

    // Livelli reali di microfono e casse + interruttore del volume automatico
    this._renderAudioExtras(type);

    // ── Posizionamento ──────────────────────────────────────────────────────
    popup.classList.remove('hidden');

    // Forza reflow per avere dimensioni reali del popup
    popup.style.visibility = 'hidden';
    popup.style.display = 'block';
    const popupH = popup.offsetHeight;
    popup.style.visibility = '';
    popup.style.display = '';

    const rect = anchor.getBoundingClientRect();
    const isMobile = window.innerWidth <= 640;

    if (isMobile) {
      // Larghezza: quasi tutto lo schermo, max 360px
      const pw = Math.min(window.innerWidth - 24, 360);
      const left = Math.round((window.innerWidth - pw) / 2);

      // Prova a posizionarlo sopra il footer;
      // se non c'è spazio sufficiente, posizionalo sotto il header
      const spaceAbove = rect.top - 8;
      const spaceBelow = window.innerHeight - rect.bottom - 8;

      popup.style.width  = pw + 'px';
      popup.style.left   = left + 'px';
      popup.style.right  = 'auto';

      if (spaceAbove >= popupH || spaceAbove >= spaceBelow) {
        // Sopra il pulsante
        popup.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
        popup.style.top    = 'auto';
      } else {
        // Sotto il pulsante (fallback)
        popup.style.top    = (rect.bottom + 8) + 'px';
        popup.style.bottom = 'auto';
      }
    } else {
      // Desktop: centrato sull'anchor, agganciato in basso a 90px dal footer
      const pw = popup.offsetWidth || 280;
      let left = rect.left + rect.width / 2 - pw / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
      popup.style.width  = pw + 'px';
      popup.style.left   = left + 'px';
      popup.style.right  = 'auto';
      popup.style.bottom = '90px';
      popup.style.top    = 'auto';
    }
  }

  async _switch(type, deviceId) {
    this._close();

    // Uscita audio (setSinkId). deviceId '' = uscita di sistema.
    if (type === 'audiooutput') {
      if (!window._tdmeetCanPickOutput()) {
        window.showToast?.('Questo browser usa l\'uscita audio scelta nel sistema');
        return;
      }
      window._tdmeetSpeakerId = deviceId && deviceId !== 'default' ? deviceId : (deviceId || null);
      // ⭐ Persisti per riapertura stanza (NON per i guest, che hanno cleanup all'inizio)
      try {
        if (!sessionStorage.getItem('tdmeet_guest_token')) localStorage.setItem('vc_speakerId', deviceId || '');
      } catch {}

      // Tutti gli elementi che suonano l'audio degli altri: <audio> dei
      // partecipanti (Map globale, vedi room.js) + eventuali <video> non muti
      const targets = [];
      if (window._tdmeetPeerAudios) {
        for (const [, audio] of window._tdmeetPeerAudios) if (audio && audio.srcObject) targets.push(audio);
      }
      for (const el of document.querySelectorAll('audio, video')) {
        if (!el.srcObject || el.muted) continue;
        if (el.id === 'video-local' || el.id === 'pjVideo') continue;
        if (!targets.includes(el)) targets.push(el);
      }
      let ok = 0, fail = 0;
      for (const el of targets) {
        if (await window._tdmeetApplySink(el, deviceId)) ok++; else fail++;
        if (el.paused) el.play?.().catch(() => { });   // dopo il cambio alcuni browser si fermano
      }
      const name = window._tdmeetOutputOptions(this.devices.audiooutput).find(d => d.deviceId === deviceId)?.label || '';
      if (fail && !ok) window.showToast?.('Uscita audio non cambiabile: resto su quella di sistema', 3500);
      else window.showToast?.((window.I18n?.t ? window.I18n.t('Uscita audio') : 'Uscita audio') + (name ? ': ' + name : ' cambiata ✓'), 2500);
      document.dispatchEvent(new CustomEvent('tdt:devices'));
      return;
    }

    try {
      console.log('[devices] richiesto switch', { type, deviceId });

      // ⭐ FIX: con effetto viso/sfondo attivo, l'outbound è il canvas, non la camera.
      // Un replaceTrack col track raw farebbe sparire l'effetto agli altri e freezerebbe
      // la pipeline (legge ancora la camera vecchia). Meglio bloccare e chiedere di
      // disattivare l'effetto prima di cambiare camera.
      if (type === 'videoinput' &&
          ((window.faceEffects && window.faceEffects.outputStream) ||
           (window.backgroundEffect && window.backgroundEffect.outputStream))) {
        window.showToast?.('Disattiva l\u2019effetto/sfondo prima di cambiare camera', 4000);
        return;
      }

      // STOP dei vecchi track PRIMA di richiederne di nuovi — su macOS Chrome
      // non libera il device se c'è un track attivo, e la richiesta ritorna lo
      // stesso dispositivo di sistema invece di quello richiesto
      // Da muto gira il rilevatore "stai parlando ma sei muto" su un CLONE del
      // vecchio microfono: va fermato, altrimenti il vecchio device resta acquisito
      // (LED acceso) e il banner ascolta il mic sbagliato. Si riaccende alla fine.
      const _wasMonitoring = type === 'audioinput' && typeof micMuted !== 'undefined' && micMuted && typeof stopMuteWarningDetection === 'function';
      if (_wasMonitoring) { try { stopMuteWarningDetection(); } catch (_) { } }
      if (type === 'audioinput') {
        const oldTrack = window._localMicTrack;
        console.log('[devices] stopping old mic track', oldTrack?.getSettings?.()?.deviceId, oldTrack?.label);
        oldTrack?.stop();
        this.rawStream?.getAudioTracks().forEach(t => { t.stop(); this.rawStream.removeTrack(t); });
      } else {
        const oldTrack = window._localCamTrack;
        console.log('[devices] stopping old cam track', oldTrack?.getSettings?.()?.deviceId, oldTrack?.label);
        oldTrack?.stop();
        this.rawStream?.getVideoTracks().forEach(t => { t.stop(); this.rawStream.removeTrack(t); });
      }

      // Delay per far liberare l'handle al sistema operativo
      await new Promise(r => setTimeout(r, 150));

      // ⭐ FIX BUG 6: usa gli helper che gestiscono correttamente iOS Safari/Android/desktop.
      // Prima si forzava sempre 'exact' anche su iOS Safari → OverconstrainedError frequente,
      // utente costretto a "cambiare dispositivo" dalle impostazioni del SO.
      const constraints = type === 'audioinput'
        ? { audio: window._tdmeetBuildAudioConstraints(deviceId) }
        : { video: window._tdmeetBuildVideoConstraints(deviceId) };

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (errExact) {
        console.warn('[devices] gUM con constraints preferiti fallito, fallback minimale:', errExact.message);
        // Fallback estremo: nessun deviceId, solo i constraints base
        const fallback = type === 'audioinput'
          ? { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: window._tdmeetAgc() } }
          : { video: { width: { ideal: 1280 }, height: { ideal: 720 } } };
        stream = await navigator.mediaDevices.getUserMedia(fallback);
      }

      const newTrack = type === 'audioinput'
        ? stream.getAudioTracks()[0]
        : stream.getVideoTracks()[0];

      if (!newTrack) {
        window.showToast?.('Dispositivo non disponibile');
        return;
      }

      // Verifica device effettivo
      const settings = newTrack.getSettings?.() || {};
      const actualId = settings.deviceId;
      console.log('[devices] nuovo track ottenuto', {
        label: newTrack.label,
        deviceId: actualId,
        requested: deviceId,
        match: actualId === deviceId,
      });

      if (actualId && actualId !== deviceId) {
        console.warn('[devices] ⚠ Il sistema ha restituito un dispositivo diverso!');
        console.warn('[devices]   Richiesto:', deviceId);
        console.warn('[devices]   Ottenuto: ', actualId, `(${newTrack.label})`);
        console.warn('[devices] Su macOS questo succede se il dispositivo ha "Default System Device" attivo.');
        console.warn('[devices] Cambia il dispositivo dalle Impostazioni di Sistema → Suono → Input/Output.');
        window.showToast?.(`⚠ macOS usa "${newTrack.label}" — cambia da Impostazioni Sistema`, 6000);
      }

      // Sostituisce nel producer mediasoup
      const label    = type === 'audioinput' ? 'audio' : 'video';
      const producer = this.producers?.get(label);
      // mic: se la riduzione rumore RNNoise è attiva il nuovo microfono entra nel filtro
      const outTrack = (type === 'audioinput' && window.TdtNoise?.enabled) ? window.TdtNoise.setSource(newTrack) : newTrack;
      if (producer) await producer.replaceTrack({ track: outTrack });

      // ⭐ FIX: il track nuovo da getUserMedia nasce enabled=true. Se l'utente era mutato,
      // cambiare device lo "smutava" silenziosamente. Riallinea allo stato reale del bottone
      // e ripausa il producer server-side se serve (coerente col pattern pause/resume).
      const _btnId = type === 'audioinput' ? 'btnMic' : 'btnCamera';
      const _mutedNow = document.getElementById(_btnId)?.classList.contains('off');
      newTrack.enabled = !_mutedNow;
      if (producer && _mutedNow && !producer.paused) {
        try { producer.pause(); } catch {}
        try { window._tdmeetSocket?.emit('pauseProducer', { producerId: producer.id }); } catch {}
      }

      // Aggiorna rawStream con il nuovo track
      this.rawStream?.addTrack(newTrack);

      if (type === 'videoinput') {
        const v = document.getElementById('video-local');
        if (v) v.srcObject = this.rawStream;
        window._localCamTrack = newTrack;
        try { if (!sessionStorage.getItem('tdmeet_guest_token')) localStorage.setItem('vc_videoId', deviceId); } catch {}
        window._tdmeetSelectedVideo = deviceId;
      } else {
        window._localMicTrack = newTrack;
        // Re-inizializza l'analyser audio con il nuovo track
        window._reinitSpeakingDetection?.();
        if (_wasMonitoring && typeof startMuteWarningDetection === 'function') { try { startMuteWarningDetection(); } catch (_) { } }
        // la registrazione in corso deve passare al nuovo microfono
        try { window.recorder?.refreshAudio?.(); } catch (_) { }
        try { if (!sessionStorage.getItem('tdmeet_guest_token')) localStorage.setItem('vc_audioId', deviceId); } catch {}
        window._tdmeetSelectedAudio = deviceId;
      }

      if (!actualId || actualId === deviceId) {
        window.showToast?.('Dispositivo cambiato ✓');
      }
    } catch (err) {
      console.error('[devices switch]', err);
      window.showToast?.('Errore cambio dispositivo: ' + err.message);
    }
  }
}

window.DeviceSelector = DeviceSelector;
