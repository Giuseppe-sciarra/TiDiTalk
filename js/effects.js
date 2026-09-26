'use strict';

/**
 * VideoEffects
 * Pipeline unificata:
 *   Camera → [Sfondo: blur/virtual] → [Viso AR: cappello/gatto/etc] → canvas → captureStream()
 */
class VideoEffects {
  constructor() {
    this.bgEffect   = 'none';   // 'none' | 'blur' | 'background'
    this.blurAmount = 12;
    this.backgroundImage = null;

    // Canvas principale (output finale)
    this.canvas = document.createElement('canvas');
    this.ctx    = this.canvas.getContext('2d');

    // Canvas intermedio per sfondo elaborato
    this.bgCanvas = document.createElement('canvas');
    this.bgCtx    = this.bgCanvas.getContext('2d');

    // Canvas intermedio per compositing sfondo+persona
    this.compCanvas = document.createElement('canvas');
    this.compCtx    = this.compCanvas.getContext('2d');

    // Video sorgente
    this.sourceVideo = document.createElement('video');
    this.sourceVideo.autoplay = true;
    this.sourceVideo.playsInline = true;
    this.sourceVideo.muted = true;

    this.outputStream = null;
    this.animFrameId  = null;

    // MediaPipe Selfie Segmentation (sfondo)
    this.segmentation = null;
    this.bgReady = false;
    this.segResults = null;
    this._lastRenderedResults = null;  // evita flicker quando MediaPipe è più lento del canvas

    // FaceEffects (effetti viso AR)
    this.faceEffects = null;
    this.faceReady   = false;
  }

  // ─── Init MediaPipe Selfie Segmentation ────────────────────────────────────
  async initBackground() {
    if (typeof SelfieSegmentation === 'undefined') throw new Error('SelfieSegmentation non caricato');

    this.segmentation = new SelfieSegmentation({
      locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1/${f}`,
    });
    this.segmentation.setOptions({ modelSelection: 1, selfieMode: true });
    this.segmentation.onResults((r) => { this.segResults = r; });
    await this.segmentation.initialize();
    this.bgReady = true;
  }

  // ─── Init MediaPipe FaceMesh ────────────────────────────────────────────────
  async initFaceEffects() {
    if (typeof FaceMesh === 'undefined') throw new Error('FaceMesh non caricato');
    this.faceEffects = new FaceEffects();
    await this.faceEffects.init();
    this.faceReady = true;
  }

  // ─── Collega sorgente video ─────────────────────────────────────────────────
  // existingVideoEl: passa l'elemento video già in DOM (evita problemi di rendering Chrome)
  async setSource(mediaStream, existingVideoEl = null) {
    if (existingVideoEl) {
      // Usa elemento video già nel DOM — Chrome renderizza correttamente i frame
      this.sourceVideo = existingVideoEl;
    } else {
      // Fallback: crea nuovo elemento e aggiungilo al DOM nascosto
      this.sourceVideo.style.cssText = 'position:fixed;top:-9999px;opacity:0;pointer-events:none;';
      document.body.appendChild(this.sourceVideo);
      this.sourceVideo.srcObject = mediaStream;
      await this.sourceVideo.play();
    }

    // Aspetta dimensioni video
    await new Promise((res) => {
      if (this.sourceVideo.videoWidth > 0) return res();
      this.sourceVideo.addEventListener('loadedmetadata', res, { once: true });
      setTimeout(res, 2000); // timeout sicurezza
    });

    const w = this.sourceVideo.videoWidth || 1280;
    const h = this.sourceVideo.videoHeight || 720;
    [this.canvas, this.bgCanvas, this.compCanvas].forEach((c) => {
      c.width = w; c.height = h;
    });

    this.outputStream = this.canvas.captureStream(30);
    this._startLoop();
    return this.outputStream;
  }

  // ─── Render loop ─────────────────────────────────────────────────────────────
  _startLoop() {
    const loop = async () => {
      if (!this.sourceVideo.paused && !this.sourceVideo.ended) {
        await this._renderFrame();
      }
      this.animFrameId = requestAnimationFrame(loop);
    };
    loop();
  }

  async _renderFrame() {
    const video = this.sourceVideo;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;

    // ── Step 1: sfondo ────────────────────────────────────────────────────────
    if (this.bgEffect !== 'none' && this.bgReady) {
      // Invia frame a SelfieSegmentation
      // send() non-blocking: MediaPipe chiama onResults() async, il canvas continua a girare
      try { this.segmentation.send({ image: video }); } catch {}

      if (!this.segResults) {
        ctx.drawImage(video, 0, 0, w, h);
      } else {
        // Usa sempre l'ultimo risultato valido — evita flicker tra frame
        const { segmentationMask, image } = this.segResults;

        // Disegna sfondo sul canvas compositing
        this.compCtx.save();
        this.compCtx.clearRect(0, 0, w, h);

        if (this.bgEffect === 'blur') {
          // canvas filter supportato su Chrome/Firefox; fallback multi-pass per Safari
          if (typeof this.bgCtx.filter !== 'undefined') {
            this.bgCtx.filter = `blur(${this.blurAmount}px)`;
            this.bgCtx.drawImage(video, 0, 0, w, h);
            this.bgCtx.filter = 'none';
          } else {
            // Fallback: ridimensiona a 1/8, ridisegna grande → blur approssimativo
            const scale = 8;
            this.bgCtx.drawImage(video, 0, 0, w / scale, h / scale);
            this.bgCtx.drawImage(this.bgCanvas, 0, 0, w / scale, h / scale, 0, 0, w, h);
          }
          this.compCtx.drawImage(this.bgCanvas, 0, 0, w, h);
        } else if (this.bgEffect === 'background' && this.backgroundImage) {
          this._drawBgCover(this.compCtx, this.backgroundImage, w, h);
        }

        // Applica maschera persona
        this.compCtx.globalCompositeOperation = 'destination-in';
        this.compCtx.drawImage(segmentationMask, 0, 0, w, h);
        // Sovrapponi persona allo sfondo
        this.compCtx.globalCompositeOperation = 'destination-over';
        this.compCtx.drawImage(image, 0, 0, w, h);
        this.compCtx.restore();

        ctx.drawImage(this.compCanvas, 0, 0, w, h);
      }
    } else {
      // Passthrough
      ctx.drawImage(video, 0, 0, w, h);
    }

    // ── Step 2: effetti viso AR ───────────────────────────────────────────────
    if (this.faceReady && this.faceEffects?.activeEffect) {
      // Invia il frame corrente (già processato) a FaceMesh
      try { await this.faceEffects.sendFrame(this.canvas); } catch {}
      // Disegna overlay AR sopra
      this.faceEffects.draw(ctx, w, h);
    }
  }

  _drawBgCover(ctx, img, w, h) {
    const r = img.width / img.height;
    const cr = w / h;
    let sw, sh, sx, sy;
    if (r > cr) { sh = h; sw = h * r; sx = (sw - w) / 2; sy = 0; }
    else { sw = w; sh = w / r; sx = 0; sy = (sh - h) / 2; }
    ctx.drawImage(img, -sx, -sy, sw, sh);
  }

  // ─── API pubblica ─────────────────────────────────────────────────────────────

  setBgEffect(effect) { this.bgEffect = effect; }
  setBlurAmount(px)   { this.blurAmount = px; }

  async setBackgroundImage(src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => { this.backgroundImage = img; res(); };
      img.onerror = rej;
      img.src = src;
    });
  }

  async setBackgroundFromFile(file) {
    return new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = async (e) => { await this.setBackgroundImage(e.target.result); res(); };
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });
  }

  setFaceEffect(effectId) {
    if (this.faceEffects) this.faceEffects.setEffect(effectId);
  }

  getVideoTrack() {
    return this.outputStream?.getVideoTracks()[0] || null;
  }

  stop() {
    if (this.animFrameId) { cancelAnimationFrame(this.animFrameId); this.animFrameId = null; }
    this.sourceVideo.srcObject = null;
    this.outputStream?.getTracks().forEach((t) => t.stop());
    this.faceEffects?.stop();
  }
}

window.VideoEffects = VideoEffects;


// ─── Sfondi predefiniti ───────────────────────────────────────────────────────
window.DEFAULT_BACKGROUNDS = [
  {
    id: 'office', label: 'Ufficio',
    src: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#1a237e"/><rect x="0" y="400" width="1280" height="320" fill="#283593"/><rect x="100" y="200" width="200" height="250" fill="#1565c0" rx="4"/><rect x="350" y="150" width="200" height="300" fill="#1565c0" rx="4"/><rect x="600" y="180" width="200" height="270" fill="#1565c0" rx="4"/><rect x="850" y="160" width="200" height="290" fill="#1565c0" rx="4"/><rect x="1050" y="220" width="150" height="230" fill="#1565c0" rx="4"/></svg>')}`,
  },
  {
    id: 'nature', label: 'Natura',
    src: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#87CEEB"/><stop offset="100%" stop-color="#E0F7FA"/></linearGradient></defs><rect width="1280" height="720" fill="url(#s)"/><rect x="0" y="500" width="1280" height="220" fill="#388e3c"/><ellipse cx="200" cy="380" rx="120" ry="140" fill="#2e7d32"/><ellipse cx="500" cy="350" rx="100" ry="120" fill="#388e3c"/><ellipse cx="800" cy="360" rx="130" ry="150" fill="#2e7d32"/><ellipse cx="1100" cy="370" rx="110" ry="130" fill="#388e3c"/></svg>')}`,
  },
  {
    id: 'space', label: 'Spazio',
    src: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#0d0d1a"/><circle cx="200" cy="150" r="2" fill="white" opacity="0.8"/><circle cx="400" cy="80" r="1.5" fill="white" opacity="0.6"/><circle cx="700" cy="200" r="2.5" fill="white" opacity="0.9"/><circle cx="900" cy="100" r="1" fill="white" opacity="0.7"/><circle cx="1100" cy="180" r="2" fill="white" opacity="0.8"/><circle cx="300" cy="300" r="1.5" fill="white" opacity="0.5"/><circle cx="600" cy="400" r="1" fill="white" opacity="0.6"/><circle cx="1000" cy="350" r="2" fill="white" opacity="0.7"/><ellipse cx="400" cy="400" rx="200" ry="200" fill="rgba(100,50,200,0.08)"/></svg>')}`,
  },
  {
    id: 'minimal', label: 'Minimal',
    src: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f5f5f5"/><stop offset="100%" stop-color="#e0e0e0"/></linearGradient></defs><rect width="1280" height="720" fill="url(#g)"/><rect x="0" y="600" width="1280" height="4" fill="#bdbdbd"/><rect x="0" y="604" width="1280" height="116" fill="#eeeeee"/></svg>')}`,
  },
  {
    id: 'beach', label: 'Spiaggia',
    src: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1e90ff"/><stop offset="60%" stop-color="#87ceeb"/></linearGradient><linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#006994"/><stop offset="100%" stop-color="#0099cc"/></linearGradient></defs><rect width="1280" height="720" fill="url(#sky)"/><rect x="0" y="380" width="1280" height="200" fill="url(#sea)"/><rect x="0" y="560" width="1280" height="160" fill="#f4d03f"/><ellipse cx="640" cy="140" rx="80" ry="80" fill="#FFD700" opacity="0.9"/></svg>')}`,
  },
];

// ─── Compatibilità API (alias per room.js) ────────────────────────────────────
// init() = initBackground() per compatibilità
VideoEffects.prototype.init      = VideoEffects.prototype.initBackground;
// setEffect() = setBgEffect() per compatibilità
VideoEffects.prototype.setEffect = VideoEffects.prototype.setBgEffect;
