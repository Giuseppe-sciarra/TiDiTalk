'use strict';

/**
 * PreJoin — versione "Google-Meet-grade"
 *  - Preview camera + audio meter live
 *  - Selezione mic / cam / SPEAKER (con fallback per Firefox/Safari che non supportano setSinkId)
 *  - Test microfono (echo loopback su speaker scelto, max 8s)
 *  - Test speaker (beep di prova)
 *  - Diagnostica permessi esplicita (NotAllowedError, NotFoundError, NotReadableError, OverconstrainedError, …)
 *  - Pulsante "Riprova" che ricontrolla permessi e ricarica device
 *  - Hot-plug: se l'utente collega/scollega un dispositivo, la lista si aggiorna
 *  - AudioContext.resume() silenzioso al click di "Entra" → niente autoplay block in stanza
 */
class PreJoin {
  constructor() {
    this.stream = null;
    this.micMuted = false;
    this.camOff = false;
    this.selectedAudio  = null;  // deviceId mic
    this.selectedVideo  = null;  // deviceId cam
    this.selectedSpeaker = null; // deviceId speaker (output)

    this._audioCtx = null;
    this._analyser = null;
    this._meterRAF = null;

    this._devChangeHandler = null;
    this._isGuest = !!sessionStorage.getItem('tdmeet_guest_token');
    this._echoTestNode = null;
    this._echoTestTimer = null;
  }

  // ─── Avvia schermata pre-join ──────────────────────────────────────────────

  async show(roomId, defaultName) {
    return new Promise(async (resolve) => {

      // Imposta codice stanza
      document.getElementById('pjRoomCode').textContent = roomId;

      // Imposta nome (i guest sono "fresh": niente precompilato a parte vc_displayName che hanno appena settato in guest.html)
      const nameInput = document.getElementById('pjName');
      nameInput.value = defaultName || localStorage.getItem('vc_displayName') || '';

      // Per i NON-guest, recupera l'ultimo speaker scelto (i guest partono puliti)
      if (!this._isGuest) {
        this.selectedSpeaker = localStorage.getItem('vc_speakerId') || null;
        this.selectedAudio   = localStorage.getItem('vc_audioId')   || null;
        this.selectedVideo   = localStorage.getItem('vc_videoId')   || null;
      }

      // Mostra subito la schermata (senza preview): l'utente vede qualcosa mentre chiediamo i permessi
      document.getElementById('prejoinScreen').classList.remove('hidden');
      document.getElementById('loadingScreen').classList.add('hidden');

      // Richiedi permessi + popola device + avvia preview
      const permsOk = await this._loadDevices();
      if (permsOk) {
        await this._startPreview();
      } else {
        this._showError(this._lastErrorMsg || 'Permessi audio/video negati. Clicca "Riprova" dopo aver consentito l\'accesso.');
      }

      nameInput.focus();

      // ── Bind controlli ────────────────────────────────────────────────────────
      const btnMic = document.getElementById('pjToggleMic');
      const btnCam = document.getElementById('pjToggleCam');
      btnMic.addEventListener('click', () => this._toggleMic());
      btnCam.addEventListener('click', () => this._toggleCam());

      document.getElementById('pjAudioSelect').addEventListener('change', async (e) => {
        this.selectedAudio = e.target.value;
        if (!this._isGuest) localStorage.setItem('vc_audioId', this.selectedAudio || '');
        await this._startPreview();
      });
      document.getElementById('pjVideoSelect').addEventListener('change', async (e) => {
        this.selectedVideo = e.target.value;
        if (!this._isGuest) localStorage.setItem('vc_videoId', this.selectedVideo || '');
        await this._startPreview();
      });

      const speakerSel = document.getElementById('pjSpeakerSelect');
      if (speakerSel) {
        speakerSel.addEventListener('change', (e) => {
          this.selectedSpeaker = e.target.value;
          if (!this._isGuest) localStorage.setItem('vc_speakerId', this.selectedSpeaker || '');
          // Esponi globalmente, devices.js / room.js lo riprendono
          window._tdmeetSpeakerId = this.selectedSpeaker;
        });
      }

      // Test microfono (echo)
      document.getElementById('pjTestMic')?.addEventListener('click', () => this._testMic());
      // Test speaker (beep)
      document.getElementById('pjTestSpeaker')?.addEventListener('click', () => this._testSpeaker());
      // Riprova permessi
      document.getElementById('pjRetry')?.addEventListener('click', async () => {
        this._hideError();
        const ok = await this._loadDevices();
        if (ok) await this._startPreview();
      });

      // Hot-plug dispositivi
      this._devChangeHandler = () => {
        console.log('[prejoin] devicechange — ricarico lista');
        this._loadDevices(/*silent=*/true);
      };
      navigator.mediaDevices.addEventListener?.('devicechange', this._devChangeHandler);

      // ── Entra ─────────────────────────────────────────────────────────────────
      const join = async () => {
        const name = nameInput.value.trim();
        if (!name) { nameInput.focus(); return; }
        localStorage.setItem('vc_displayName', name);

        // ⭐ Wake AudioContext qui, mentre siamo dentro un user gesture — sblocca autoplay in stanza
        try {
          const wakeCtx = new (window.AudioContext || window.webkitAudioContext)();
          // timeout: su alcune macchine (Firefox senza dispositivo audio di
          // output) resume() non si risolve mai e l'ingresso resta appeso
          if (wakeCtx.state === 'suspended') {
            await Promise.race([
              wakeCtx.resume().catch(() => { }),
              new Promise(r => setTimeout(r, 800)),
            ]);
          }
          // Lo chiudiamo, room.js ne creerà uno suo — ma il fatto di averlo "risvegliato" almeno una volta
          // sblocca le policy autoplay sulla pagina su Safari/Chrome
          setTimeout(() => wakeCtx.close().catch(() => {}), 100);
        } catch {}

        // Espone speaker scelto globalmente (room.js / devices.js lo applicano agli audio remoti)
        window._tdmeetSpeakerId = this.selectedSpeaker || null;

        this._stopMeter();
        this._stopEchoTest();
        navigator.mediaDevices.removeEventListener?.('devicechange', this._devChangeHandler);

        document.getElementById('prejoinScreen').classList.add('hidden');
        resolve({
          displayName: name,
          stream: this.stream,
          micMuted: this.micMuted,
          camOff: this.camOff,
          audioDeviceId:   this.selectedAudio,
          videoDeviceId:   this.selectedVideo,
          speakerDeviceId: this.selectedSpeaker,
        });
      };

      document.getElementById('pjJoinBtn').addEventListener('click', join);
      nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });
    });
  }

  // ─── Errori UI ────────────────────────────────────────────────────────────

  _showError(msg) {
    const box = document.getElementById('pjError');
    if (!box) { console.warn('[prejoin] no error box, message:', msg); return; }
    // Supporta newline nel messaggio (istruzioni multi-linea)
    box.style.whiteSpace = 'pre-line';
    box.textContent = msg;
    box.classList.remove('hidden');
  }
  _hideError() {
    document.getElementById('pjError')?.classList.add('hidden');
    window.PermBanner?.hide();
  }

  _isPermDenied(err) {
    const n = err?.name || '';
    return n === 'NotAllowedError' || n === 'PermissionDeniedError';
  }

  // Mostra il banner full-screen con istruzioni browser-specific (permBanner.js)
  _showPermBanner() {
    window.PermBanner?.show({
      onRetry: async () => {
        const ok = await this._loadDevices(/*silent=*/true);
        if (ok) await this._startPreview();
        return ok;
      },
    });
  }

  _humanizeGumError(err) {
    const n = err?.name || '';
    const m = err?.message || String(err);
    if (n === 'NotAllowedError' || n === 'PermissionDeniedError') {
      return this._buildPermissionDeniedMessage();
    }
    if (n === 'NotFoundError' || n === 'DevicesNotFoundError') {
      return 'Nessuna camera o microfono rilevato. Collega un dispositivo e premi "Abilita microfono e camera".';
    }
    if (n === 'NotReadableError' || n === 'TrackStartError') {
      return 'Microfono o camera in uso da un\'altra applicazione (Zoom, Teams, OBS, FaceTime…). Chiudila e premi "Abilita microfono e camera".';
    }
    if (n === 'OverconstrainedError' || n === 'ConstraintNotSatisfiedError') {
      return 'Il dispositivo selezionato non supporta i parametri richiesti. Prova un altro dispositivo dalla lista.';
    }
    if (n === 'SecurityError') {
      return 'Accesso a media bloccato. Apri la pagina in HTTPS (https://app.example.com).';
    }
    if (n === 'AbortError') {
      return 'Richiesta interrotta. Premi "Abilita microfono e camera".';
    }
    return 'Errore: ' + m;
  }

  // Istruzioni browser-specific per sbloccare permessi negati
  _detectBrowser() {
    const ua = navigator.userAgent;
    const isEdge    = /Edg\//.test(ua);
    const isOpera   = /OPR\//.test(ua);
    const isFirefox = /Firefox\//.test(ua);
    const isChrome  = /Chrome\//.test(ua) && !isEdge && !isOpera;
    const isSafari  = /Safari\//.test(ua) && !/Chrome\//.test(ua) && !/CriOS\//.test(ua);
    const isIOS     = /iPhone|iPad|iPod/.test(ua);
    const isMac     = /Macintosh/.test(ua);
    if (isFirefox) return 'firefox';
    if (isEdge)    return 'edge';
    if (isOpera)   return 'opera';
    if (isSafari && isIOS) return 'safari-ios';
    if (isSafari && isMac) return 'safari-mac';
    if (isChrome)  return 'chrome';
    return 'generic';
  }

  _buildPermissionDeniedMessage() {
    const b = this._detectBrowser();
    const HOST = window.location.host;

    const instructions = {
      'chrome':
        '🚫 Microfono / camera bloccati su Chrome.\n\n' +
        '1. Clicca sull\'icona 🔒 (o ⓘ) a sinistra dell\'indirizzo ' + HOST + '\n' +
        '2. Trova "Microfono" e "Fotocamera" → metti su "Consenti"\n' +
        '3. Ricarica la pagina (F5)',
      'edge':
        '🚫 Microfono / camera bloccati su Edge.\n\n' +
        '1. Clicca sull\'icona 🔒 a sinistra dell\'indirizzo ' + HOST + '\n' +
        '2. "Autorizzazioni per il sito" → metti Microfono e Fotocamera su "Consenti"\n' +
        '3. Ricarica la pagina (F5)',
      'firefox':
        '🚫 Microfono / camera bloccati su Firefox.\n\n' +
        '1. Clicca sull\'icona 🔒 (o "permessi bloccati") a sinistra dell\'URL\n' +
        '2. Rimuovi le X rosse accanto a Microfono e Fotocamera\n' +
        '3. Ricarica la pagina (F5)',
      'safari-mac':
        '🚫 Microfono / camera bloccati su Safari.\n\n' +
        '1. Menu Safari → Impostazioni → Siti web\n' +
        '2. Sezione "Microfono" e "Fotocamera" → trova ' + HOST + ' → metti "Consenti"\n' +
        '3. Ricarica la pagina (Cmd+R)',
      'safari-ios':
        '🚫 Microfono / camera bloccati su Safari iOS.\n\n' +
        '1. Apri Impostazioni iPhone → Safari → Fotocamera / Microfono → "Chiedi" o "Consenti"\n' +
        '2. Oppure: tieni premuto sulla "AA" nella barra URL → Impostazioni sito web\n' +
        '3. Ricarica la pagina',
      'opera':
        '🚫 Microfono / camera bloccati su Opera.\n\n' +
        '1. Clicca sull\'icona 🔒 a sinistra dell\'indirizzo\n' +
        '2. Imposta Microfono e Fotocamera su "Consenti"\n' +
        '3. Ricarica la pagina',
      'generic':
        '🚫 Microfono / camera bloccati dal browser.\n\n' +
        'Cerca l\'icona del lucchetto 🔒 vicino all\'indirizzo del sito, ' +
        'consenti l\'accesso a Microfono e Fotocamera, poi ricarica la pagina.',
    };
    return instructions[b] || instructions.generic;
  }

  // ─── Permission state (best-effort, non tutti i browser supportano) ────────

  async _checkPermission() {
    if (!navigator.permissions || !navigator.permissions.query) return null;
    try {
      const m = await navigator.permissions.query({ name: 'microphone' }).catch(() => null);
      const c = await navigator.permissions.query({ name: 'camera' }).catch(() => null);
      return { mic: m?.state, cam: c?.state };
    } catch { return null; }
  }

  // ─── Dispositivi ──────────────────────────────────────────────────────────

  async _loadDevices(silent = false) {
    try {
      // 1. Chiedi permessi (necessario per ottenere i label dei device)
      let tmp = null;
      try {
        tmp = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      } catch (e1) {
        // Se fallisce con audio+video, prova solo audio (utente potrebbe non avere camera)
        console.warn('[prejoin] gUM audio+video fallito, retry solo audio:', e1?.name);
        try {
          tmp = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e2) {
          // Solo video
          console.warn('[prejoin] gUM solo audio fallito, retry solo video:', e2?.name);
          try {
            tmp = await navigator.mediaDevices.getUserMedia({ video: true });
          } catch (e3) {
            this._lastErrorMsg = this._humanizeGumError(e3 || e2 || e1);
            if (!silent) {
              this._showError(this._lastErrorMsg);
              if (this._isPermDenied(e3) || this._isPermDenied(e2) || this._isPermDenied(e1)) {
                this._showPermBanner();
              }
            }
            return false;
          }
        }
      }
      tmp.getTracks().forEach(t => t.stop());

      // 2. Enumera
      const devices = await navigator.mediaDevices.enumerateDevices();

      const audioSel   = document.getElementById('pjAudioSelect');
      const videoSel   = document.getElementById('pjVideoSelect');
      const speakerSel = document.getElementById('pjSpeakerSelect');

      audioSel.innerHTML   = '';
      videoSel.innerHTML   = '';
      if (speakerSel) speakerSel.innerHTML = '';

      const mics     = devices.filter(d => d.kind === 'audioinput');
      const cams     = devices.filter(d => d.kind === 'videoinput');
      const speakers = devices.filter(d => d.kind === 'audiooutput');

      mics.forEach((d, i) => {
        const opt = document.createElement('option');
        opt.value = d.deviceId;
        opt.textContent = d.label || `Microfono ${i + 1}`;
        if (d.deviceId === this.selectedAudio) opt.selected = true;
        audioSel.appendChild(opt);
      });
      cams.forEach((d, i) => {
        const opt = document.createElement('option');
        opt.value = d.deviceId;
        opt.textContent = d.label || `Videocamera ${i + 1}`;
        if (d.deviceId === this.selectedVideo) opt.selected = true;
        videoSel.appendChild(opt);
      });

      // Speaker: solo browser che supportano setSinkId (Chrome, Edge, Opera) hanno la lista populata.
      // Firefox/Safari NON espongono audiooutput → mostriamo "Predefinito di sistema" e nascondiamo il select.
      const speakerSupported = (typeof HTMLAudioElement !== 'undefined') &&
                                ('sinkId' in HTMLAudioElement.prototype) &&
                                speakers.length > 0;

      const speakerWrap = document.getElementById('pjSpeakerWrap');
      const speakerNote = document.getElementById('pjSpeakerNote');
      if (speakerSel && speakerWrap) {
        if (speakerSupported) {
          speakers.forEach((d, i) => {
            const opt = document.createElement('option');
            opt.value = d.deviceId;
            opt.textContent = d.label || `Speaker ${i + 1}`;
            if (d.deviceId === this.selectedSpeaker) opt.selected = true;
            speakerSel.appendChild(opt);
          });
          speakerWrap.style.display = '';
          if (speakerNote) speakerNote.style.display = 'none';
          // Default se nulla scelto
          if (!this.selectedSpeaker) {
            const def = speakers.find(d => d.deviceId === 'default') || speakers[0];
            if (def) { this.selectedSpeaker = def.deviceId; speakerSel.value = def.deviceId; }
          }
          window._tdmeetSpeakerId = this.selectedSpeaker;
        } else {
          // Firefox / Safari: nascondi select, mostra nota
          speakerWrap.style.display = 'none';
          if (speakerNote) speakerNote.style.display = '';
          this.selectedSpeaker = null;
          window._tdmeetSpeakerId = null;
        }
      }

      // Salva selezione default (mic/cam) se mancanti
      if (!this.selectedAudio && audioSel.value) this.selectedAudio = audioSel.value;
      if (!this.selectedVideo && videoSel.value) this.selectedVideo = videoSel.value;

      // Permission state warning (best-effort)
      const perms = await this._checkPermission();
      if (perms?.mic === 'denied' || perms?.cam === 'denied') {
        this._showError('Accesso a microfono o camera negato. Clicca sull\'icona del lucchetto nella barra dell\'URL e consenti.');
        if (!silent) this._showPermBanner();
      } else {
        this._hideError();
      }

      return true;
    } catch (e) {
      console.warn('[prejoin] enumerateDevices errore:', e);
      this._lastErrorMsg = this._humanizeGumError(e);
      if (!silent) this._showError(this._lastErrorMsg);
      return false;
    }
  }

  // ─── Preview ──────────────────────────────────────────────────────────────

  async _startPreview() {
    // Stop test mic / meter / stream precedente
    this._stopEchoTest();
    this._stopMeter();
    this.stream?.getTracks().forEach(t => t.stop());

    const ua        = navigator.userAgent || '';
    const isIOS     = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isIOSSafari = isIOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    const isMobile  = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const conn      = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const effType   = conn?.effectiveType || '4g';
    const isSlowNet = ['slow-2g', '2g', '3g'].includes(effType);

    let idealW = 1920, idealH = 1080, idealFps = 30;
    if (isMobile)  { idealW = 1280; idealH = 720; idealFps = 24; }
    if (isSlowNet) { idealW = 640;  idealH = 360; idealFps = 15; }

    const videoConstraints = {
      width:     { ideal: idealW, max: 1920 },
      height:    { ideal: idealH, max: 1080 },
      frameRate: { ideal: idealFps, max: 30 },
    };

    const audioBase = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

    // ⭐ FIX BUG 6: gestione corretta deviceId per piattaforma.
    // - iOS Safari: ignora SEMPRE deviceId (il routing è gestito dal SO).
    // - Android/iOS Chrome: usa 'ideal' (best effort, alcuni device rifiutano exact).
    // - Desktop: usa 'exact' (affidabile).
    const wantAudio = this.selectedAudio && this.selectedAudio !== 'default' && this.selectedAudio !== 'communications';
    const wantVideo = this.selectedVideo && this.selectedVideo !== 'default' && this.selectedVideo !== '';

    let audioConstraints = audioBase;
    if (wantAudio && !isIOSSafari) {
      audioConstraints = isMobile
        ? { ...audioBase, deviceId: { ideal: this.selectedAudio } }
        : { ...audioBase, deviceId: { exact: this.selectedAudio } };
    }
    if (wantVideo && !isIOSSafari) {
      videoConstraints.deviceId = isMobile
        ? { ideal: this.selectedVideo }
        : { exact: this.selectedVideo };
    }

    const constraints = {
      audio: audioConstraints,
      video: videoConstraints,
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this._hideError();
    } catch (e) {
      console.warn('[prejoin] gUM constraints specifici fallito, fallback:', e?.name || e);
      // Tentativo 1: solo "ideal" sui deviceId (più permissivo di "exact")
      try {
        const c2 = {
          audio: wantAudio && !isIOSSafari
            ? { ...audioBase, deviceId: { ideal: this.selectedAudio } }
            : audioBase,
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        };
        this.stream = await navigator.mediaDevices.getUserMedia(c2);
        this._hideError();
      } catch (e2) {
        console.warn('[prejoin] fallback ideal fallito:', e2?.name || e2);
        // Tentativo 2: senza deviceId
        try {
          this.stream = await navigator.mediaDevices.getUserMedia({
            audio: audioBase,
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          });
          this._hideError();
        } catch (e3) {
          // Tentativo 3: solo audio (utente potrebbe non avere camera)
          try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: audioBase });
            this.camOff = true;
            this._hideError();
            this._showError('⚠ Camera non disponibile. Puoi entrare in audio.');
          } catch (e4) {
            this.stream = null;
            this._showError(this._humanizeGumError(e4 || e3 || e2 || e));
            if (this._isPermDenied(e4) || this._isPermDenied(e3) || this._isPermDenied(e2) || this._isPermDenied(e)) {
              this._showPermBanner();
            }
          }
        }
      }
    }

    // FIX: se lo stream non ha audio track ma l'utente non ha disattivato il mic, retry solo audio
    if (this.stream && this.stream.getAudioTracks().length === 0 && !this.micMuted) {
      console.warn('[prejoin] stream senza audio track, retry solo audio');
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: audioBase });
        audioOnly.getAudioTracks().forEach(t => this.stream.addTrack(t));
      } catch (e) { console.warn('[prejoin] retry audio fallito:', e?.name || e); }
    }

    const video  = document.getElementById('pjVideo');
    const avatar = document.getElementById('pjAvatar');

    if (this.stream) {
      this.stream.getAudioTracks().forEach(t => t.enabled = !this.micMuted);
      this.stream.getVideoTracks().forEach(t => t.enabled = !this.camOff);

      video.srcObject = this.stream;
      video.style.display  = (this.camOff || this.stream.getVideoTracks().length === 0) ? 'none'  : 'block';
      avatar.style.display = (this.camOff || this.stream.getVideoTracks().length === 0) ? 'flex'  : 'none';

      // Aggiorna l'avatar iniziali se camOff
      const ai = document.getElementById('pjAvatarInitials');
      const name = document.getElementById('pjName')?.value?.trim();
      if (ai && name) ai.textContent = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

      this._startMeter();
    } else {
      video.style.display  = 'none';
      avatar.style.display = 'flex';
    }
  }

  // ─── Mic meter ────────────────────────────────────────────────────────────

  _startMeter() {
    if (!this.stream || this.stream.getAudioTracks().length === 0) return;
    try {
      this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this._analyser = this._audioCtx.createAnalyser();
      this._analyser.fftSize = 256;
      this._audioCtx.createMediaStreamSource(this.stream).connect(this._analyser);

      const data = new Uint8Array(this._analyser.frequencyBinCount);
      const bar  = document.getElementById('pjMeterBar');

      const tick = () => {
        this._analyser.getByteFrequencyData(data);
        const avg = data.slice(0, 32).reduce((a, b) => a + b, 0) / 32;
        if (bar) bar.style.width = Math.min(100, avg * 1.5) + '%';
        this._meterRAF = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) { console.warn('[prejoin meter]', e); }
  }

  _stopMeter() {
    if (this._meterRAF) { cancelAnimationFrame(this._meterRAF); this._meterRAF = null; }
    this._audioCtx?.close(); this._audioCtx = null; this._analyser = null;
  }

  // ─── Test mic (echo loopback) ─────────────────────────────────────────────

  async _testMic() {
    const btn = document.getElementById('pjTestMic');
    if (!btn) return;

    if (this._echoTestNode) {
      this._stopEchoTest();
      btn.classList.remove('active');
      btn.textContent = '🎙 Prova microfono';
      return;
    }

    if (!this.stream || this.stream.getAudioTracks().length === 0) {
      window.showToast?.('Microfono non disponibile') || this._showError('Microfono non disponibile');
      return;
    }

    try {
      // Usa un AudioContext separato per il test (non interferisce col meter)
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') await ctx.resume();

      const src  = ctx.createMediaStreamSource(this.stream);
      const dest = ctx.createMediaStreamDestination();

      // Filtri per evitare feedback rumoroso: passa-banda voce + gain ridotto
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass';   hp.frequency.value = 200;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';    lp.frequency.value = 4000;
      const gain = ctx.createGain(); gain.gain.value = 0.7;

      src.connect(hp); hp.connect(lp); lp.connect(gain); gain.connect(dest);

      // Riproduci su <audio> hidden così possiamo applicare setSinkId
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.srcObject = dest.stream;
      audio.style.display = 'none';
      document.body.appendChild(audio);

      // Applica speaker scelto se possibile
      if (this.selectedSpeaker && typeof audio.setSinkId === 'function') {
        try { await audio.setSinkId(this.selectedSpeaker); } catch (e) { console.warn('[testMic] setSinkId fallito', e?.name); }
      }
      try { await audio.play(); } catch (e) { /* autoplay block raro qui — sei dentro user gesture */ }

      this._echoTestNode = { ctx, audio, src, hp, lp, gain, dest };

      btn.classList.add('active');
      btn.textContent = '⏹ Ferma prova (parla!)';

      // Timeout sicurezza: 8 secondi e basta — evita feedback se l'utente abbandona la pagina
      this._echoTestTimer = setTimeout(() => {
        this._stopEchoTest();
        btn.classList.remove('active');
        btn.textContent = '🎙 Prova microfono';
      }, 8000);
    } catch (e) {
      console.error('[testMic]', e);
      window.showToast?.('Errore prova microfono: ' + e.message);
    }
  }

  _stopEchoTest() {
    clearTimeout(this._echoTestTimer); this._echoTestTimer = null;
    const n = this._echoTestNode; this._echoTestNode = null;
    if (!n) return;
    try { n.audio.pause(); n.audio.srcObject = null; n.audio.remove(); } catch {}
    try { n.src.disconnect(); n.hp.disconnect(); n.lp.disconnect(); n.gain.disconnect(); n.dest.disconnect(); } catch {}
    try { n.ctx.close(); } catch {}
  }

  // ─── Test speaker (beep di prova) ─────────────────────────────────────────

  async _testSpeaker() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') await ctx.resume();

      const dest = ctx.createMediaStreamDestination();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = 440;
      // Inviluppo per evitare il "click"
      const t0 = ctx.currentTime;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.25, t0 + 0.05);
      gain.gain.setValueAtTime(0.25, t0 + 0.55);
      gain.gain.linearRampToValueAtTime(0, t0 + 0.65);
      osc.connect(gain); gain.connect(dest);
      osc.start(t0);
      osc.stop(t0 + 0.7);

      const audio = document.createElement('audio');
      audio.srcObject = dest.stream;
      audio.style.display = 'none';
      document.body.appendChild(audio);

      if (this.selectedSpeaker && typeof audio.setSinkId === 'function') {
        try { await audio.setSinkId(this.selectedSpeaker); } catch (e) { console.warn('[testSpeaker] setSinkId fallito', e?.name); }
      }
      await audio.play().catch(() => {});

      // Cleanup dopo 1s
      setTimeout(() => {
        try { audio.pause(); audio.srcObject = null; audio.remove(); } catch {}
        try { ctx.close(); } catch {}
      }, 1000);
    } catch (e) {
      console.error('[testSpeaker]', e);
      window.showToast?.('Errore prova speaker: ' + e.message);
    }
  }

  // ─── Toggle ───────────────────────────────────────────────────────────────

  _toggleMic() {
    this.micMuted = !this.micMuted;
    this.stream?.getAudioTracks().forEach(t => t.enabled = !this.micMuted);
    const btn = document.getElementById('pjToggleMic');
    btn.classList.toggle('off', this.micMuted);
    btn.querySelector('.icon-on')?.classList.toggle('hidden', this.micMuted);
    btn.querySelector('.icon-off')?.classList.toggle('hidden', !this.micMuted);
  }

  _toggleCam() {
    this.camOff = !this.camOff;
    this.stream?.getVideoTracks().forEach(t => t.enabled = !this.camOff);
    const video  = document.getElementById('pjVideo');
    const avatar = document.getElementById('pjAvatar');
    video.style.display  = this.camOff ? 'none'  : 'block';
    avatar.style.display = this.camOff ? 'flex' : 'none';
    const btn = document.getElementById('pjToggleCam');
    btn.classList.toggle('off', this.camOff);
    btn.querySelector('.icon-on')?.classList.toggle('hidden', this.camOff);
    btn.querySelector('.icon-off')?.classList.toggle('hidden', !this.camOff);
  }

  // Usato da room.js per fermare preview dopo il join
  stopPreview() {
    this.stream?.getTracks().forEach(t => t.stop());
    this._stopMeter();
    this._stopEchoTest();
    this.stream = null;
  }
}

window.PreJoin = PreJoin;


// ─── ParticipantList (invariato) ───────────────────────────────────────────

class ParticipantList {
  constructor() {
    this.open = false;
    this._rafId = null;
  }

  toggle() {
    this.open = !this.open;
    document.getElementById('participantsPanel').classList.toggle('hidden', !this.open);
    document.getElementById('btnParticipants').classList.toggle('active', this.open);
    if (this.open) this._startUpdate();
    else this._stopUpdate();
  }

  refresh(peers, localName, localId, speakingStates) {
    const list = document.getElementById('participantsList');
    if (!list) return;

    const count = peers.size + 1;
    const countEl = document.getElementById('participantsCount');
    if (countEl) countEl.textContent = count;

    const existing = new Set();

    this._upsertItem(list, localId, localName + ' (Tu)', {
      audioMuted: false,
      videoOff: false,
      speaking: speakingStates?.get('local') || false,
    }, true);
    existing.add(localId);

    peers.forEach((peer) => {
      this._upsertItem(list, peer.id, peer.displayName, {
        audioMuted: peer.audioMuted,
        videoOff: peer.videoOff,
        handRaised: peer.handRaised,
        speaking: speakingStates?.get(peer.id) || false,
      }, false);
      existing.add(peer.id);
    });

    list.querySelectorAll('.participant-item').forEach((el) => {
      if (!existing.has(el.dataset.peerId)) el.remove();
    });
  }

  _upsertItem(list, peerId, displayName, state, isLocal) {
    let el = list.querySelector(`[data-peer-id="${peerId}"]`);
    if (!el) {
      el = document.createElement('div');
      el.className = 'participant-item';
      el.dataset.peerId = peerId;
      if (isLocal) list.prepend(el);
      else list.appendChild(el);
    }

    const initials = this._esc(String(displayName || '?').trim().split(/\s+/).map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '?');
    const color = this._color(peerId);
    const speakingRing = state.speaking ? `outline: 2px solid var(--green);` : '';

    el.innerHTML = `
      <div class="participant-avatar" style="background:${color};${speakingRing}">${initials}</div>
      <div class="participant-info">
        <div class="participant-name">${this._esc(displayName)}</div>
        <div class="participant-status">${state.speaking ? '🗣 Sta parlando' : ''}</div>
      </div>
      <div class="participant-badges">
        ${state.handRaised ? '<div class="p-badge hand">✋</div>' : ''}
        ${state.audioMuted ? `<div class="p-badge muted"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/></svg></div>` : ''}
        ${state.videoOff ? `<div class="p-badge novideo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7"/><line x1="1" y1="1" x2="23" y2="23"/></svg></div>` : ''}
      </div>`;
  }

  _startUpdate() {
    const tick = () => {
      if (!this.open) return;
      document.querySelectorAll('.participant-item').forEach((el) => {
        const peerId = el.dataset.peerId;
        const speaking = window._speakingStates?.get(peerId === 'local' ? 'local' : peerId) || false;
        const status = el.querySelector('.participant-status');
        const avatar = el.querySelector('.participant-avatar');
        if (status) status.textContent = speaking ? '🗣 Sta parlando' : '';
        if (avatar) avatar.style.outline = speaking ? '2px solid var(--green)' : '';
      });
      this._rafId = setTimeout(tick, 300);
    };
    tick();
  }

  _stopUpdate() {
    clearTimeout(this._rafId); this._rafId = null;
  }

  _color(id) {
    const cols = ['#1a73e8', '#34a853', '#9c27b0', '#ff5722', '#00bcd4', '#e91e63', '#ff9800', '#607d8b'];
    let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) % cols.length;
    return cols[Math.abs(h)];
  }

  _esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

window.ParticipantList = ParticipantList;
