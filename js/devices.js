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
 * Default: spenta su Mac (dove succede più spesso), accesa altrove.
 */
const _AGC_KEY = 'tdt_mic_agc';
const _isMacDesktop = /Mac/.test(navigator.platform || '') && !_isIOS;
window._tdmeetAgc = function () {
  try {
    const v = localStorage.getItem(_AGC_KEY);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch (_) { }
  return !_isMacDesktop;
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
 * DeviceSelector
 * Popup contestuale che appare sui chevron di mic/cam.
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
    if (type !== 'audioinput') { box?.remove(); this._stopMeters(); return; }
    if (!box) {
      box = document.createElement('div');
      box.id = 'devicePopupExtra';
      box.className = 'device-popup-extra';
      popup.appendChild(box);
    }
    const agcOn = window._tdmeetAgc();
    const actual = window._localMicTrack?.getSettings?.()?.autoGainControl;
    const spkName = (this.devices.audiooutput.find(d => d.deviceId === (window._tdmeetSpeakerId || 'default')) || this.devices.audiooutput[0])?.label || '';
    box.innerHTML = `
      <div class="device-popup-sep">Livelli</div>
      <div class="dp-row"><span class="dp-lbl">Microfono</span><div class="dp-meter"><i id="dpMicBar"></i></div></div>
      <div class="dp-hint" id="dpMicHint">Parla per vedere il livello</div>
      <div class="dp-row"><span class="dp-lbl">Casse</span><div class="dp-meter"><i id="dpSpkBar"></i></div></div>
      <div class="dp-hint" id="dpSpkHint">${spkName ? '<span>Uscita</span> · ' + spkName.replace(/[<>&"]/g, '') : '<span>Si muove quando parla qualcuno</span>'}</div>
      <label class="dp-switch">
        <input type="checkbox" id="dpAgc" ${agcOn ? 'checked' : ''}>
        <span class="dp-track"></span>
        <span class="dp-switch-text">Regola il volume del microfono automaticamente</span>
      </label>
      <div class="dp-hint"><span>Se il volume d'ingresso del computer si abbassa da solo durante le chiamate, spegnilo.</span>${actual === undefined ? '' : ' <span>' + (actual ? 'Ora è attivo' : 'Ora è spento') + '</span>'}</div>
      <div class="dp-hint dp-note">Il volume di sistema non è leggibile dal browser: qui vedi il segnale reale.</div>`;

    const agc = box.querySelector('#dpAgc');
    agc.addEventListener('click', (e) => e.stopPropagation());
    agc.addEventListener('change', async () => {
      window._tdmeetSetAgc(agc.checked);
      // Riapre lo stesso microfono con la nuova impostazione (stesso percorso,
      // già collaudato, del cambio dispositivo: sostituisce il track nel flusso)
      const cur = window._localMicTrack?.getSettings?.()?.deviceId || 'default';
      window.showToast?.(agc.checked ? 'Volume automatico attivato' : 'Volume automatico spento', 2500);
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
    });
    this._startMeters();
  }

  _startMeters() {
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
      if (micTrack && micTrack.readyState === 'live') {
        const src = ctx.createMediaStreamSource(new MediaStream([micTrack]));
        src.connect(micAn); nodes.push(src);
      }
      // casse: somma dell'audio in arrivo dagli altri (non collegato all'uscita:
      // si misura soltanto, non si riproduce una seconda volta)
      const audios = window._tdmeetPeerAudios ? [...window._tdmeetPeerAudios.values()] : [];
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
        if (!micBar || document.getElementById('devicePopup')?.classList.contains('hidden')) { this._stopMeters(); return; }
        const m = nodes.length ? level(micAn) : 0;
        const k = level(spkAn);
        micBar.style.width = Math.round(m * 100) + '%';
        spkBar.style.width = Math.round(k * 100) + '%';
        micPeak = Math.max(micPeak * 0.995, m);
        const muted = typeof micMuted !== 'undefined' && micMuted;
        if (hint) {
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

      // Se non c'è ancora uno speaker selezionato, scegli il "default" di sistema
      // così il popup lo mostra attivo e i nuovi peer lo rispettano
      if (!window._tdmeetSpeakerId && this.devices.audiooutput.length > 0) {
        // Cerca il device con id "default" (convenzione Chrome/Edge su dispositivo di sistema),
        // altrimenti prendi il primo della lista
        const defaultDev = this.devices.audiooutput.find(d => d.deviceId === 'default')
                        || this.devices.audiooutput[0];
        if (defaultDev) {
          window._tdmeetSpeakerId = defaultDev.deviceId;
          console.log('[devices] speaker di default pre-selezionato:', defaultDev.label || defaultDev.deviceId);
        }
      }
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

    const labels = { audioinput: '🎙 Audio', videoinput: '📷 Videocamera' };
    titleEl.textContent = labels[type] || 'Dispositivo';

    const currentId = type === 'audioinput'
      ? (window._localMicTrack?.getSettings?.()?.deviceId || '')
      : (window._localCamTrack?.getSettings?.()?.deviceId || '');

    listEl.innerHTML = this.devices[type].map((d, i) => `
      <button class="device-popup-item${d.deviceId === currentId ? ' active' : ''}"
              data-id="${d.deviceId}" data-type="${type}">
        <span class="device-popup-item-label">${d.label || 'Dispositivo ' + (i + 1)}</span>
      </button>`).join('');

    listEl.querySelectorAll('.device-popup-item').forEach(btn => {
      btn.addEventListener('click', () => this._switch(btn.dataset.type, btn.dataset.id));
      // Touch: preventDefault evita doppio trigger click
      btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        this._switch(btn.dataset.type, btn.dataset.id);
      });
    });

    // Sezione speaker (solo nel popup audio)
    if (type === 'audioinput' && this.devices.audiooutput.length > 0) {
      const currentSpeakerId = window._tdmeetSpeakerId || '';
      speakerList.innerHTML = this.devices.audiooutput.map((d, i) => `
        <button class="device-popup-item${d.deviceId === currentSpeakerId ? ' active' : ''}"
                data-id="${d.deviceId}" data-type="audiooutput">
          <span class="device-popup-item-label">${d.label || 'Speaker ' + (i + 1)}</span>
        </button>`).join('');
      speakerList.querySelectorAll('.device-popup-item').forEach(btn => {
        btn.addEventListener('click', () => this._switch('audiooutput', btn.dataset.id));
        btn.addEventListener('touchend', (e) => {
          e.preventDefault();
          this._switch('audiooutput', btn.dataset.id);
        });
      });
      speakerSec.classList.remove('hidden');
    } else {
      speakerSec.classList.add('hidden');
    }

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

    // Speaker output (setSinkId)
    if (type === 'audiooutput') {
      const testEl = document.createElement('audio');
      if (typeof testEl.setSinkId !== 'function') {
        window.showToast?.('Speaker non cambiabile da browser (usa impostazioni di sistema)');
        return;
      }

      window._tdmeetSpeakerId = deviceId;
      // ⭐ Persisti per riapertura stanza (NON per i guest, che hanno cleanup all'inizio)
      try {
        if (!sessionStorage.getItem('tdmeet_guest_token')) {
          localStorage.setItem('vc_speakerId', deviceId);
        }
      } catch {}

      // Raccolgo TUTTI gli elementi audio da aggiornare:
      // 1. Audio elements dei peer remoti (creati con new Audio(), NON nel DOM)
      // 2. Video elements remoti nel DOM (non muted)
      const targets = [];

      // Peer audios tracciati via Map globale (vedi room.js)
      if (window._tdmeetPeerAudios) {
        for (const [peerId, audio] of window._tdmeetPeerAudios) {
          if (audio && audio.srcObject) targets.push(audio);
        }
      }

      // Video DOM dei peer remoti (hanno audio multiplato)
      for (const el of document.querySelectorAll('audio, video')) {
        if (!el.srcObject) continue;
        if (el.muted) continue;
        if (el.id === 'video-local' || el.id === 'pjVideo') continue;
        if (el.readyState < 1) continue;
        if (targets.includes(el)) continue;
        targets.push(el);
      }

      console.log('[setSinkId] target elements:', targets.length);

      let okCount = 0, failCount = 0;
      for (const el of targets) {
        try {
          await el.setSinkId(deviceId);
          okCount++;
        } catch (e) {
          if (e.name !== 'AbortError' && e.name !== 'NotFoundError') {
            failCount++;
            console.warn('[setSinkId]', e.name, e.message);
          }
        }
      }

      if (failCount > 0 && okCount === 0) {
        window.showToast?.('Speaker non cambiabile');
      } else {
        window.showToast?.('Speaker cambiato ✓');
      }
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
      if (producer) await producer.replaceTrack({ track: newTrack });

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
