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
 * Costruisce constraints audio robusti per il dispositivo corrente.
 * Esposto globalmente perché lo usano anche prejoin.js e room.js (fallback).
 */
window._tdmeetBuildAudioConstraints = function(deviceId) {
  const audioBase = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
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
          ? { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }
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
