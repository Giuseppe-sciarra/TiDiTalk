// backgroundEffect.js — Sfondi virtuali via MediaPipe SelfieSegmentation
// API pubblica:
//   const bg = new BackgroundEffect();
//   const outStream = await bg.apply(rawCamStream, { type: 'blur' });
//   bg.setBackground({ type: 'blur' | 'image' | 'none', imageUrl?: string });
//   bg.stop();

class BackgroundEffect {
  constructor() {
    this.selfieSeg = null;
    this.sourceVideo = null;
    this.canvas = null;
    this.ctx = null;
    this.outputStream = null;
    this.rafId = null;
    this.loaded = false;
    this._type = 'none';  // 'blur' | 'image' | 'none'
    this._bgImage = null;  // HTMLImageElement
    this._bgImageUrl = null;
    this._lastSegMask = null;
    this._sourceTrackClone = null;
    this._ownsSourceVideo = false;
    this._isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  setBackground({ type, imageUrl }) {
    this._type = type || 'none';
    if (type === 'image' && imageUrl && imageUrl !== this._bgImageUrl) {
      this._bgImageUrl = imageUrl;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { this._bgImage = img; };
      img.onerror = () => { console.error('[backgroundEffect] errore caricamento immagine', imageUrl); };
      img.src = imageUrl;
    }
  }

  async apply(inputStream, options = {}) {
    const videoTrack = inputStream.getVideoTracks()[0];
    if (!videoTrack) throw new Error('Nessun video track');

    this._type = options.type || 'blur';
    if (options.imageUrl) this.setBackground({ type: 'image', imageUrl: options.imageUrl });

    // Clono il track (stesso workaround usato in faceEffects.js per Chrome)
    this._sourceTrackClone = videoTrack.clone();
    this.sourceVideo = document.createElement('video');
    this.sourceVideo.autoplay = true;
    this.sourceVideo.playsInline = true;
    this.sourceVideo.muted = true;
    this.sourceVideo.style.cssText = 'position:fixed;bottom:0;right:0;width:4px;height:4px;opacity:0.01;pointer-events:none;z-index:999;';
    document.body.appendChild(this.sourceVideo);
    this.sourceVideo.srcObject = new MediaStream([this._sourceTrackClone]);
    await this.sourceVideo.play().catch(() => {});
    this._ownsSourceVideo = true;

    await new Promise((res) => {
      if (!this.sourceVideo || this.sourceVideo.videoWidth > 0) return res();
      this.sourceVideo.addEventListener('loadedmetadata', res, { once: true });
      setTimeout(res, 2000);
    });
    await new Promise((res) => {
      let tries = 0;
      const check = () => {
        tries++;
        // la pipeline può essere stata smontata nel frattempo: non esplodere
        if (!this.sourceVideo) return res();
        if (this.sourceVideo.readyState >= 2 && this.sourceVideo.currentTime > 0) return res();
        if (tries > 60) return res();
        setTimeout(check, 33);
      };
      check();
    });

    // Canvas output - dimensioni ridotte su mobile
    const scale = this._isMobile ? 0.5 : 1;
    if (!this.sourceVideo) throw new Error('pipeline interrotta durante l\'avvio');
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.floor((this.sourceVideo.videoWidth || 1280) * scale);
    this.canvas.height = Math.floor((this.sourceVideo.videoHeight || 720) * scale);
    this.ctx = this.canvas.getContext('2d');

    // Inizializza MediaPipe SelfieSegmentation
    if (typeof SelfieSegmentation === 'undefined') {
      throw new Error('MediaPipe SelfieSegmentation non caricato');
    }
    this.selfieSeg = new SelfieSegmentation({
      locateFile: (file) => `/assets/vendor/mediapipe_selfie/${file}`,
    });
    this.selfieSeg.setOptions({
      modelSelection: 1,   // 0=general 256x256 veloce; 1=landscape 256x144 più veloce ancora
      selfieMode: false,
    });
    this.selfieSeg.onResults(this._onResults.bind(this));
    await this.selfieSeg.initialize();

    this.loaded = true;
    this.outputStream = this.canvas.captureStream(this._isMobile ? 20 : 30);
    this._startLoop();
    return this.outputStream;
  }

  _startLoop() {
    let lastInfer = 0;
    const inferEveryMs = this._isMobile ? 100 : 50;  // mobile: 10fps inferenza, desktop: 20fps
    const loop = async () => {
      if (!this.selfieSeg || !this.sourceVideo) return;
      const now = performance.now();
      if (this.sourceVideo.readyState >= 2 && now - lastInfer >= inferEveryMs) {
        lastInfer = now;
        try {
          await this.selfieSeg.send({ image: this.sourceVideo });
        } catch (e) {
          // ignoro: il loop continua
        }
      } else if (this._lastSegMask) {
        // Render intermedio con ultima maschera (interpolazione)
        this._renderWithLastMask();
      }
      this.rafId = requestAnimationFrame(loop);
    };
    loop();
  }

  _onResults(results) {
    if (!this.sourceVideo) return;
    this._lastSegMask = results.segmentationMask;
    this._renderFrame(results);
  }

  _renderFrame(results) {
    if (!this.sourceVideo || !this.canvas || !this.ctx) return;   // pipeline smontata a metà frame
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    if (this._type === 'none') {
      // Solo video, nessun effetto
      ctx.drawImage(this.sourceVideo, 0, 0, W, H);
      return;
    }

    ctx.save();
    ctx.clearRect(0, 0, W, H);

    // 1) Disegna la PERSONA dal video usando la maschera
    ctx.drawImage(results.segmentationMask, 0, 0, W, H);
    ctx.globalCompositeOperation = 'source-in';
    ctx.drawImage(this.sourceVideo, 0, 0, W, H);

    // 2) Disegna lo sfondo DIETRO la persona
    ctx.globalCompositeOperation = 'destination-over';
    if (this._type === 'blur') {
      // Sfondo sfocato = il video stesso, ma sfocato
      ctx.filter = 'blur(12px)';
      ctx.drawImage(this.sourceVideo, -8, -8, W + 16, H + 16);
      ctx.filter = 'none';
    } else if (this._type === 'image' && this._bgImage) {
      // Immagine personalizzata (cover)
      const imgW = this._bgImage.width;
      const imgH = this._bgImage.height;
      const scale = Math.max(W / imgW, H / imgH);
      const dw = imgW * scale;
      const dh = imgH * scale;
      const dx = (W - dw) / 2;
      const dy = (H - dh) / 2;
      ctx.drawImage(this._bgImage, dx, dy, dw, dh);
    } else {
      // Fallback: sfondo nero
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  _renderWithLastMask() {
    // Re-uso l'ultima maschera per fluidità. Chiama _renderFrame con un pseudo-results
    if (!this._lastSegMask) return;
    this._renderFrame({ segmentationMask: this._lastSegMask });
  }

  stop() {
    this._stopPipeline();
    if (this.selfieSeg) {
      try { this.selfieSeg.close(); } catch {}
      this.selfieSeg = null;
    }
    this.loaded = false;
    this._lastSegMask = null;
    this._bgImage = null;
    this._bgImageUrl = null;
  }

  _stopPipeline() {
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    if (this.sourceVideo) {
      if (this._ownsSourceVideo) {
        this.sourceVideo.pause?.();
        this.sourceVideo.srcObject = null;
        this.sourceVideo.remove();
      }
      this.sourceVideo = null;
      this._ownsSourceVideo = false;
    }
    if (this._sourceTrackClone) {
      try { this._sourceTrackClone.stop(); } catch {}
      this._sourceTrackClone = null;
    }
    if (this.outputStream) {
      this.outputStream.getVideoTracks().forEach(t => t.stop());
      this.outputStream = null;
    }
  }
}

window.BackgroundEffect = BackgroundEffect;
