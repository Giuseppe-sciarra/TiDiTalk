'use strict';

/**
 * ClientRecorder
 *
 * Registra la stanza intera lato client:
 * - Canvas compositor che disegna tutti i video tile in tempo reale
 * - AudioContext che mixa tutti gli stream audio (locale + remoti)
 * - MediaRecorder su canvas.captureStream() + audioDestination.stream
 * - Output: file WebM scaricato automaticamente a fine registrazione
 */
class ClientRecorder {
  constructor() {
    this.recording    = false;
    this.mediaRecorder = null;
    this.chunks        = [];
    this.animFrameId   = null;
    this.startTime     = null;
    this.timerInterval = null;

    // Canvas compositor
    this.canvas = document.createElement('canvas');
    this.ctx    = this.canvas.getContext('2d');

    // Audio mixing
    this.audioCtx    = null;
    this.audioDest   = null;
    this.audioSources = new Map(); // streamId → MediaStreamAudioSourceNode

    // Riferimento esterno alla mappa streams
    this._getVideoElements = null;  // callback → array di { video, label }
    this._getAudioStreams  = null;  // callback → array di MediaStream
  }

  /**
   * Collega i getter esterni per accedere ai video/audio della stanza
   * @param {Function} getVideoElements  () => [{ videoEl, label }]
   * @param {Function} getAudioStreams   () => [MediaStream]
   */
  connect(getVideoElements, getAudioStreams) {
    this._getVideoElements = getVideoElements;
    this._getAudioStreams  = getAudioStreams;
  }

  // ─── Start ────────────────────────────────────────────────────────────────

  async start() {
    if (this.recording) return;

    // Polyfill roundRect per Safari < 15.4
    if (!CanvasRenderingContext2D.prototype.roundRect) {
      CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        this.beginPath();
        this.moveTo(x + r, y);
        this.lineTo(x + w - r, y);
        this.quadraticCurveTo(x + w, y, x + w, y + r);
        this.lineTo(x + w, y + h - r);
        this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        this.lineTo(x + r, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - r);
        this.lineTo(x, y + r);
        this.quadraticCurveTo(x, y, x + r, y);
        this.closePath();
      };
    }

    // Risoluzione canvas — 1280x720 è il sweet spot qualità/performance
    this.canvas.width  = 1280;
    this.canvas.height = 720;

    // Setup audio context per mixing
    this.audioCtx  = new (window.AudioContext || window.webkitAudioContext)();
    this.audioDest = this.audioCtx.createMediaStreamDestination();
    // Resume AudioContext (può essere suspended per policy autoplay browser)
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
    this._refreshAudioSources();

    // Stream composito: canvas video + audio misto
    const canvasStream = this.canvas.captureStream(30);
    const audioStream  = this.audioDest.stream;

    const combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioStream.getAudioTracks(),
    ]);

    // Scegli codec disponibile (VP9 > VP8)
    const mimeType = this._getSupportedMimeType();

    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: 2500000,
      audioBitsPerSecond: 128000,
    });

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => this._save();

    this.mediaRecorder.start(1000); // chunk ogni 1s
    this.recording  = true;
    this.startTime  = Date.now();

    // Avvia compositor
    this._renderLoop();

    // Timer UI
    this.timerInterval = setInterval(() => this._updateTimer(), 1000);

    return mimeType;
  }

  // ─── Stop ─────────────────────────────────────────────────────────────────

  stop() {
    if (!this.recording) return;
    this.recording = false;

    cancelAnimationFrame(this.animFrameId);
    this.animFrameId = null;

    clearInterval(this.timerInterval);
    this.timerInterval = null;

    if (this.mediaRecorder?.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    // Chiudi audio context
    this.audioCtx?.close();
    this.audioCtx    = null;
    this.audioDest   = null;
    this.audioSources.clear();
  }

  // ─── Canvas compositor ────────────────────────────────────────────────────

  _renderLoop() {
    const draw = () => {
      if (!this.recording) return;
      this._drawFrame();
      this.animFrameId = requestAnimationFrame(draw);
    };
    draw();
  }

  _drawFrame() {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const ctx = this.ctx;

    ctx.fillStyle = '#121318';
    ctx.fillRect(0, 0, W, H);

    const elements = this._getVideoElements?.() || [];
    if (elements.length === 0) return;

    // Layout a griglia (stesso sistema della UI)
    const { cols, rows } = this._gridLayout(elements.length);
    const cellW = W / cols;
    const cellH = H / rows;
    const padding = 6;

    elements.forEach(({ videoEl, label, sid, contain }, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * cellW + padding;
      const y = row * cellH + padding;
      const w = cellW - padding * 2;
      const h = cellH - padding * 2;

      // Background cella
      ctx.fillStyle = '#1f222b';
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 8);
      ctx.fill();

      // Rettangolo del contenuto dentro la cella: serve anche per disegnare
      // le annotazioni esattamente sopra al punto giusto.
      let content = null;

      if (videoEl && videoEl.readyState >= 2 && !videoEl.paused && videoEl.videoWidth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 8);
        ctx.clip();

        const vr = videoEl.videoWidth / videoEl.videoHeight;
        const cr = w / h;
        let sw, sh, sx, sy;
        if (contain) {
          // schermo condiviso: NIENTE taglio, si vede tutto (come nella stanza)
          if (vr > cr) { sw = w; sh = w / vr; sx = x; sy = y + (h - sh) / 2; }
          else         { sh = h; sw = h * vr; sx = x + (w - sw) / 2; sy = y; }
        } else {
          // camere: cover fit
          if (vr > cr) { sh = h; sw = h * vr; sx = x - (sw - w) / 2; sy = y; }
          else         { sw = w; sh = w / vr; sx = x; sy = y - (sh - h) / 2; }
        }

        ctx.drawImage(videoEl, sx, sy, sw, sh);
        ctx.restore();
        content = { x: sx, y: sy, w: sw, h: sh };
      } else {
        // Avatar placeholder
        ctx.fillStyle = '#1a73e8';
        ctx.beginPath();
        const cx = x + w / 2, cy = y + h / 2;
        const r = Math.min(w, h) * 0.2;
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = `bold ${Math.round(r * 0.8)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((label || '?')[0].toUpperCase(), cx, cy);
      }

      // ⭐ Annotazioni e puntatore laser: disegnati sopra al contenuto, con le
      // stesse coordinate della stanza (così la registrazione mostra i disegni).
      if (sid && content && window._annotator?.hasSurface?.(sid)) {
        ctx.save();
        ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.clip();
        try { window._annotator.drawOn(ctx, sid, content); } catch (e) { }
        ctx.restore();
      }

      // Label nome
      if (label) {
        const fontSize = Math.max(11, Math.min(14, h * 0.05));
        ctx.font = `500 ${fontSize}px sans-serif`;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        const labelW = ctx.measureText(label).width + 16;
        const labelH = fontSize + 8;
        const lx = x + 8, ly = y + h - labelH - 8;
        ctx.beginPath();
        ctx.roundRect(lx, ly, labelW, labelH, 4);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.fillText(label, lx + 8, ly + labelH / 2);
      }
    });

    // Watermark e timer in alto a destra
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const ss = String(elapsed % 60).padStart(2, '0');
    ctx.font = '13px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    const brandName = window.__BRAND?.branding?.platformName || '';
    ctx.fillText(`● ${brandName}  ${mm}:${ss}`.trim(), W - 12, 10);
    ctx.textAlign = 'left';
  }

  _gridLayout(count) {
    if (count === 1)        return { cols: 1, rows: 1 };
    if (count <= 2)         return { cols: 2, rows: 1 };
    if (count <= 4)         return { cols: 2, rows: 2 };
    if (count <= 6)         return { cols: 3, rows: 2 };
    if (count <= 9)         return { cols: 3, rows: 3 };
    if (count <= 12)        return { cols: 4, rows: 3 };
    if (count <= 16)        return { cols: 4, rows: 4 };
    return { cols: 5, rows: 4 };
  }

  // ─── Audio mixing ─────────────────────────────────────────────────────────

  _refreshAudioSources() {
    if (!this.audioCtx || !this.audioDest) return;

    const streams = this._getAudioStreams?.() || [];
    const activeIds = new Set(streams.map(s => s.id));

    // Rimuovi sorgenti non più presenti
    this.audioSources.forEach((node, id) => {
      if (!activeIds.has(id)) { node.disconnect(); this.audioSources.delete(id); }
    });

    // Aggiungi nuove sorgenti
    streams.forEach(stream => {
      if (!this.audioSources.has(stream.id)) {
        try {
          const source = this.audioCtx.createMediaStreamSource(stream);
          source.connect(this.audioDest);
          this.audioSources.set(stream.id, source);
        } catch(e) { console.warn('[recorder] Audio source error:', e); }
      }
    });
  }

  // Chiama questo quando entra/esce un peer per aggiornare il mix
  refreshAudio() {
    this._refreshAudioSources();
  }

  // ─── Save ─────────────────────────────────────────────────────────────────

  _save() {
    if (this.chunks.length === 0) return;

    const mimeType = this.mediaRecorder?.mimeType || 'video/webm';
    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
    const blob = new Blob(this.chunks, { type: mimeType });
    const url  = URL.createObjectURL(blob);

    const date = new Date();
    const ts = `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}_${String(date.getHours()).padStart(2,'0')}${String(date.getMinutes()).padStart(2,'0')}`;

    const a = document.createElement('a');
    a.href     = url;
    const slug = (window.__BRAND?.branding?.platformName || 'riunione')
      .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'riunione';
    a.download = `${slug}_${ts}.${ext}`;
    a.click();

    setTimeout(() => URL.revokeObjectURL(url), 10000);
    this.chunks = [];
  }

  // ─── Utils ────────────────────────────────────────────────────────────────

  _getSupportedMimeType() {
    const candidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
      'video/mp4',
    ];
    return candidates.find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';
  }

  _updateTimer() {
    const el = document.getElementById('recTimer');
    if (!el) return;
    const s = Math.floor((Date.now() - this.startTime) / 1000);
    el.textContent = `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
  }

  getDuration() {
    if (!this.startTime) return 0;
    return Math.floor((Date.now() - this.startTime) / 1000);
  }
}

window.ClientRecorder = ClientRecorder;
