// backgroundEffect.js — Sfondi virtuali
// 1.9.0: separazione persona / sfondo rifatta.
//   • MediaPipe Tasks ImageSegmenter (selfie_segmenter) in un worker
//     (bg-worker.js), poi sulla pagina se il worker non va, e in ultimo il
//     vecchio SelfieSegmentation se manca il modello nuovo (setup-mediapipe.sh
//     non rilanciato): lo sfondo funziona comunque.
//   • Bordi più puliti: maschera a risoluzione più alta, curva che stringe la
//     zona di passaggio (niente alone), media tra un fotogramma e l'altro
//     (niente tremolio), un filo di sfumatura sul bordo.
//   • Il disegno gira sempre a 30 fps con l'ultima maschera: la persona si muove
//     fluida anche se la separazione arriva a 15-20 fps.
//   • Sfocatura anche su Safari (che non ha ctx.filter): si rimpicciolisce e si
//     ingrandisce il video, con lo stesso effetto morbido.
//   • Sfondi animati: 'anim' (disegnati qui, nessun file da scaricare) e
//     'video' (un video in loop, caricato o scelto dal proprio computer).
//   • replaceSource(track): cambio di videocamera con lo sfondo acceso, senza
//     smontare niente.
// API pubblica (invariata, più i tipi nuovi):
//   const bg = new BackgroundEffect();
//   const outStream = await bg.apply(rawCamStream, { type: 'blur' });
//   bg.setBackground({ type: 'blur' | 'image' | 'video' | 'anim' | 'none', imageUrl?: string });
//     (per 'video' imageUrl è l'indirizzo del video, per 'anim' l'id: 'anim:aurora'…)
//   bg.replaceSource(newVideoTrack);  bg.setPaused(true|false);  bg.stop();

(function () {
  const VENDOR = '/assets/vendor';
  const MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// 1.9.0: pulizia della maschera — via le macchie staccate dalla persona (una tenda chiara,
// un riflesso): restano solo le zone grandi almeno il 12% della più grande (due persone sì)
function cleanMask(d, w, h) {
  const n = w * h, T = 77;   // 0,3: sotto, la curva della pagina dà già sfondo
  const lab = new Int32Array(n), stack = new Int32Array(n), sizes = [0];
  let cur = 0;
  for (let i = 0; i < n; i++) {
    if (d[i] <= T || lab[i]) continue;
    cur++; let sp = 0, size = 0; stack[sp++] = i; lab[i] = cur;
    while (sp) {
      const p = stack[--sp]; size++;
      const x = p % w;
      if (x > 0 && !lab[p - 1] && d[p - 1] > T) { lab[p - 1] = cur; stack[sp++] = p - 1; }
      if (x < w - 1 && !lab[p + 1] && d[p + 1] > T) { lab[p + 1] = cur; stack[sp++] = p + 1; }
      if (p >= w && !lab[p - w] && d[p - w] > T) { lab[p - w] = cur; stack[sp++] = p - w; }
      if (p < n - w && !lab[p + w] && d[p + w] > T) { lab[p + w] = cur; stack[sp++] = p + w; }
    }
    sizes.push(size);
  }
  if (cur < 2) return d;
  let max = 0; for (let k = 1; k <= cur; k++) if (sizes[k] > max) max = sizes[k];
  const min = max * 0.12;
  for (let i = 0; i < n; i++) { const l = lab[i]; if (l && sizes[l] < min) d[i] = 0; }
  return d;
}

  // ── Separazione persona / sfondo (condivisa: si carica una volta sola) ────
  const seg = {
    mode: null, delegate: null, worker: null, lm: null, legacy: null, busy: false, _init: null,
    onMask: null, cost: 0, initMs: 0, avg: 0, n: 0, small: false, _tried: null,
    init() {
      if (this._init) return this._init;
      const pref = window.__bgSegDelegate || window.__faceArDelegate || 'GPU';
      const t0 = performance.now();
      this._init = (async () => {
        const haveModel = await fetch(`${VENDOR}/mediapipe_tasks/selfie_segmenter.tflite`, { method: 'HEAD' }).then(r => r.ok).catch(() => false);
        if (haveModel && typeof Worker !== 'undefined' && typeof createImageBitmap === 'function' && !window.__bgSegNoWorker) {
          try {
            await new Promise((resolve, reject) => {
              const w = new Worker('/assets/js/bg-worker.js', { type: 'module' });
              const to = setTimeout(() => { w.terminate(); reject(new Error('timeout worker')); }, 60000);
              w.onerror = (ev) => { clearTimeout(to); w.terminate(); reject(new Error(ev.message || 'worker')); };
              w.onmessage = (ev) => {
                const m = ev.data || {};
                if (m.type === 'ready') { clearTimeout(to); this.worker = w; this.mode = 'worker'; this.delegate = m.delegate; w.onmessage = (e2) => this._result(e2.data); w.onerror = null; resolve(); }
                else if (m.type === 'error') { clearTimeout(to); w.terminate(); reject(new Error(m.message)); }
              };
              w.postMessage({ type: 'init', base: location.origin + VENDOR, delegate: pref });
            });
          } catch (e) { console.warn('[sfondo] worker non disponibile, separazione sulla pagina:', e?.message); }
        }
        if (!this.mode && haveModel) {
          try {
            const run = async () => {
              const vision = await import(`${VENDOR}/mediapipe_tasks/vision_bundle.mjs`);
              const fileset = await vision.FilesetResolver.forVisionTasks(`${VENDOR}/mediapipe_tasks/wasm`);
              const make = (d) => vision.ImageSegmenter.createFromOptions(fileset, {
                baseOptions: { modelAssetPath: `${VENDOR}/mediapipe_tasks/selfie_segmenter.tflite`, delegate: d },
                runningMode: 'VIDEO', outputCategoryMask: false, outputConfidenceMasks: true,
                canvas: document.createElement('canvas'),
              });
              try { this.lm = await make(pref); this.delegate = pref; }
              catch (e) { this.lm = await make('CPU'); this.delegate = 'CPU'; }
              this.mode = 'main';
            };
            if (window.tdMediapipeLock) await window.tdMediapipeLock(run); else await run();
          } catch (e) { console.warn('[sfondo] separazione nuova non disponibile:', e?.message); }
        }
        if (!this.mode) {
          // vecchio SelfieSegmentation (vendor/mediapipe_selfie): c'è sempre
          if (typeof SelfieSegmentation === 'undefined') throw new Error('MediaPipe SelfieSegmentation non caricato');
          const s = new SelfieSegmentation({ locateFile: (file) => `${VENDOR}/mediapipe_selfie/${file}` });
          s.setOptions({ modelSelection: 1, selfieMode: false });
          s.onResults((r) => this._legacyResult(r));
          if (window.tdMediapipeLock) await window.tdMediapipeLock(() => s.initialize()); else await s.initialize();
          this.legacy = s; this.mode = 'legacy'; this.delegate = 'legacy';
        }
        this.initMs = Math.round(performance.now() - t0);
        console.log(`[sfondo] separazione pronta: ${this.mode}/${this.delegate} in ${this.initMs} ms`);
      })().catch(e => { this._init = null; throw e; });
      return this._init;
    },
    // misura dell'immagine da analizzare: abbastanza per un bordo pulito, non di più
    _size(src) {
      const sw = src.videoWidth || src.width, sh = src.videoHeight || src.height;
      const max = this.small ? 256 : MOBILE ? 320 : (this.delegate === 'GPU' ? 512 : 384);
      return sw > max ? [max, Math.max(2, Math.round(sh * max / sw))] : [sw, sh];
    },
    push(src, ts) {
      if (!this.mode || this.busy) return;
      const [w, h] = this._size(src);
      if (!w || !h) return;
      this.busy = true; this._t0 = performance.now();
      if (this.mode === 'worker') {
        createImageBitmap(src, { resizeWidth: w, resizeHeight: h, resizeQuality: 'medium' })
          .then(bmp => this.worker.postMessage({ type: 'frame', bitmap: bmp, ts }, [bmp]))
          .catch(() => { this.busy = false; });
        return;
      }
      if (this.mode === 'legacy') {
        this.legacy.send({ image: src }).catch(() => { }).finally(() => { this.busy = false; });
        return;
      }
      // tasks sulla pagina
      if (!this._small) { this._small = document.createElement('canvas'); this._sctx = this._small.getContext('2d', { willReadFrequently: true }); }
      if (this._small.width !== w || this._small.height !== h) { this._small.width = w; this._small.height = h; }
      this._sctx.drawImage(src, 0, 0, w, h);
      let out = { ts, w: 0, h: 0, data: null };
      try {
        const res = this.lm.segmentForVideo(this._small, ts);
        const mk = res?.confidenceMasks?.[0];
        if (mk) {
          const f = mk.getAsFloat32Array(), d = new Uint8ClampedArray(f.length);
          for (let i = 0; i < f.length; i++) d[i] = f[i] * 255;
          out = { ts, w: mk.width, h: mk.height, data: cleanMask(d, mk.width, mk.height) };
        }
        try { res?.close?.(); } catch (_) { }
      } catch (_) { }
      this._result(out);
    },
    _result(m) {
      this.busy = false;
      this.cost = Math.round(performance.now() - (this._t0 || performance.now()));
      // i primi fotogrammi non contano: la prima volta la grafica prepara i suoi programmi (anche secondi)
      this.n++; if (this.n > 3) this.avg = this.n === 4 ? this.cost : this.avg * 0.8 + this.cost * 0.2;
      if (m && m.data && this.onMask) this.onMask({ kind: 'alpha', w: m.w, h: m.h, data: m.data });
      if (this.n === 16) this._adapt();
    },
    // Scheda grafica lenta o finta (Chrome senza accelerazione: WebGL emulato) → il
    // calcolo "GPU" va più piano del processore: si prova la CPU e si tiene la più veloce.
    // Con la CPU ancora lenta si analizza un'immagine più piccola.
    async _adapt() {
      if (this.mode !== 'worker') { if (this.avg > 60) this.small = true; return; }
      if (this.delegate === 'GPU' && this.avg > 70 && !this._tried) {
        this._tried = { GPU: this.avg };
        await this._reinit('CPU');
      } else if (this._tried && this._tried.GPU != null && this.delegate === 'CPU') {
        if (this.avg > this._tried.GPU) await this._reinit('GPU');
        this._tried.GPU = null;
        if (this.avg > 60) this.small = true;
      } else if (this.avg > 60) this.small = true;
      console.log(`[sfondo] separazione: ${this.delegate}, ${Math.round(this.avg)} ms per fotogramma${this.small ? ', immagine ridotta' : ''}`);
    },
    async _reinit(d) {
      const old = this.worker;
      try {
        await new Promise((resolve, reject) => {
          const w = new Worker('/assets/js/bg-worker.js', { type: 'module' });
          const to = setTimeout(() => { w.terminate(); reject(new Error('timeout')); }, 30000);
          w.onmessage = (ev) => {
            const m = ev.data || {};
            if (m.type === 'ready') { clearTimeout(to); this.worker = w; this.delegate = m.delegate; w.onmessage = (e2) => this._result(e2.data); resolve(); }
            else if (m.type === 'error') { clearTimeout(to); w.terminate(); reject(new Error(m.message)); }
          };
          w.postMessage({ type: 'init', base: location.origin + VENDOR, delegate: d });
        });
        try { old.terminate(); } catch (_) { }
        this.busy = false; this.n = 0; this.avg = 0;
      } catch (e) { console.warn('[sfondo] cambio di calcolo non riuscito:', e?.message); }
    },
    _legacyResult(r) {
      if (r && r.segmentationMask && this.onMask) this.onMask({ kind: 'image', image: r.segmentationMask });
    },
  };

  // ── Sfondi animati disegnati qui (nessun file, nessuna licenza) ──────────
  const ANIMS = {
    aurora: { label: 'Aurora', draw(c, W, H, t) {
      c.fillStyle = '#0b1020'; c.fillRect(0, 0, W, H);
      const blobs = [['#5b3fd1', .9], ['#13a6a0', .75], ['#c43f8e', .6], ['#2f6fe0', .7]];
      c.globalCompositeOperation = 'lighter';
      blobs.forEach(([col, k], i) => {
        const a = t * (0.05 + i * 0.013) + i * 1.7;
        const x = W * (0.5 + 0.38 * Math.sin(a)), y = H * (0.45 + 0.3 * Math.cos(a * 1.3 + i));
        const r = Math.max(W, H) * (0.42 + 0.08 * Math.sin(a * 2));
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, col + 'aa'); g.addColorStop(1, col + '00');
        c.globalAlpha = k * 0.6; c.fillStyle = g; c.fillRect(0, 0, W, H);
      });
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    } },
    bokeh: { label: 'Luci', draw(c, W, H, t) {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1a1426'); g.addColorStop(1, '#2b1d2f');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      for (let i = 0; i < 26; i++) {
        const sp = 0.012 + (i % 7) * 0.004;
        const x = ((i * 0.618 + t * sp) % 1.2 - 0.1) * W;
        const y = H * (0.15 + 0.7 * ((i * 0.37) % 1)) + Math.sin(t * 0.4 + i) * H * 0.03;
        const r = H * (0.03 + ((i * 13) % 9) / 100);
        const hue = [32, 44, 330, 280, 200][i % 5];
        const rg = c.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, `hsla(${hue},90%,72%,.55)`); rg.addColorStop(.7, `hsla(${hue},90%,65%,.22)`); rg.addColorStop(1, `hsla(${hue},90%,60%,0)`);
        c.fillStyle = rg; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      }
    } },
    onde: { label: 'Onde', draw(c, W, H, t) {
      const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0e2a3d'); g.addColorStop(1, '#123b4a');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      const cols = ['rgba(64,190,200,.20)', 'rgba(90,140,230,.18)', 'rgba(150,110,230,.16)', 'rgba(40,220,180,.14)'];
      cols.forEach((col, k) => {
        c.fillStyle = col; c.beginPath();
        const base = H * (0.45 + k * 0.12), amp = H * (0.06 + k * 0.015), f = 1.6 + k * 0.5, sp = 0.35 + k * 0.12;
        c.moveTo(0, H);
        for (let x = 0; x <= W; x += W / 48) c.lineTo(x, base + Math.sin(x / W * Math.PI * f + t * sp) * amp + Math.sin(x / W * 9 + t * sp * 1.7) * amp * 0.25);
        c.lineTo(W, H); c.closePath(); c.fill();
      });
    } },
    studio: { label: 'Studio', draw(c, W, H, t) {
      c.fillStyle = '#17181c'; c.fillRect(0, 0, W, H);
      const x = W * (0.5 + 0.12 * Math.sin(t * 0.12)), y = H * (0.38 + 0.04 * Math.cos(t * 0.09));
      const g = c.createRadialGradient(x, y, 0, x, y, Math.max(W, H) * 0.75);
      g.addColorStop(0, '#4a4d57'); g.addColorStop(.45, '#2a2c33'); g.addColorStop(1, '#111215');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      const v = c.createLinearGradient(0, H * 0.72, 0, H); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.35)');
      c.fillStyle = v; c.fillRect(0, 0, W, H);
    } },
    tramonto: { label: 'Tramonto', draw(c, W, H, t) {
      const s = (Math.sin(t * 0.05) + 1) / 2;
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, `hsl(${255 - s * 20},45%,${22 + s * 6}%)`);
      g.addColorStop(.55, `hsl(${330 + s * 15},55%,${48 + s * 6}%)`);
      g.addColorStop(1, `hsl(${30 + s * 8},85%,${62 + s * 4}%)`);
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      for (let i = 0; i < 5; i++) {
        const y = H * (0.18 + i * 0.09), x = ((t * (0.004 + i * 0.002) + i * 0.29) % 1.4 - 0.2) * W;
        c.fillStyle = 'rgba(255,240,235,.10)';
        c.beginPath(); c.ellipse(x, y, W * 0.16, H * 0.022, 0, 0, Math.PI * 2); c.fill();
      }
    } },
  };

  // sfocatura: ctx.filter dove c'è, altrimenti (Safari) rimpicciolisci e ingrandisci
  const FILTER_OK = !window.__bgNoFilter && (() => {   // __bgNoFilter: i test provano la strada di Safari
    try { const c = document.createElement('canvas').getContext('2d'); if (!('filter' in c)) return false; c.filter = 'blur(2px)'; return c.filter === 'blur(2px)'; } catch (_) { return false; }
  })();

  class BackgroundEffect {
    constructor() {
      this.sourceVideo = null;
      this.canvas = null;
      this.ctx = null;
      this.outputStream = null;
      this.rafId = null;
      this.loaded = false;
      this._type = 'none';
      this._bgImage = null; this._bgImageUrl = null;
      this._bgVideo = null; this._bgVideoUrl = null;
      this._anim = null;
      this._sourceTrackClone = null;
      this._ownsSourceVideo = false;
      this._isMobile = MOBILE;
      this.selfieSeg = null;          // compatibilità: prima era l'oggetto MediaPipe
      // maschera
      this._maskCanvas = document.createElement('canvas');
      this._maskCtx = this._maskCanvas.getContext('2d');
      this._soft = document.createElement('canvas'); this._softCtx = this._soft.getContext('2d');
      this._maskImg = null; this._maskPrev = null; this._hasMask = false;
      this._person = document.createElement('canvas'); this._pctx = this._person.getContext('2d');
      this._blurC = null; this._animC = null;
      this._t0 = performance.now();
    }

    setBackground({ type, imageUrl }) {
      this._type = type || 'none';
      if (type === 'image' && imageUrl && imageUrl !== this._bgImageUrl) {
        this._bgImageUrl = imageUrl;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => { if (this._bgImageUrl === imageUrl) this._bgImage = img; };
        img.onerror = () => { console.error('[backgroundEffect] errore caricamento immagine', imageUrl); };
        img.src = imageUrl;
      }
      if (type === 'video' && imageUrl && imageUrl !== this._bgVideoUrl) {
        this._stopBgVideo();
        this._bgVideoUrl = imageUrl;
        const v = document.createElement('video');
        v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true; v.crossOrigin = 'anonymous';
        v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
        v.src = imageUrl;
        v.play().catch(() => { });
        this._bgVideo = v;
      }
      if (type !== 'video') this._stopBgVideo();
      if (type === 'anim') {
        const id = String(imageUrl || '').replace(/^anim:/, '');
        this._anim = ANIMS[id] ? id : 'aurora';
      }
    }

    _stopBgVideo() {
      if (!this._bgVideo) return;
      try { this._bgVideo.pause(); this._bgVideo.removeAttribute('src'); this._bgVideo.load(); } catch (_) { }
      this._bgVideo = null; this._bgVideoUrl = null;
    }

    async apply(inputStream, options = {}) {
      const videoTrack = inputStream.getVideoTracks()[0];
      if (!videoTrack) throw new Error('Nessun video track');

      this._type = options.type || 'blur';
      this.setBackground({ type: this._type, imageUrl: options.imageUrl });

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
      await this._waitSource();

      if (!this.sourceVideo) throw new Error('pipeline interrotta durante l\'avvio');
      this.canvas = document.createElement('canvas');
      this._fitCanvas();
      this.ctx = this.canvas.getContext('2d');

      seg.onMask = (m) => this._onMask(m); seg.owner = this;
      await seg.init();
      if (!this.sourceVideo) throw new Error('pipeline interrotta durante l\'avvio');

      this.loaded = true;
      this.outputStream = this.canvas.captureStream(this._isMobile ? 24 : 30);
      this._startLoop();
      return this.outputStream;
    }

    async _waitSource() {
      await new Promise((res) => {
        if (!this.sourceVideo || this.sourceVideo.videoWidth > 0) return res();
        this.sourceVideo.addEventListener('loadedmetadata', res, { once: true });
        setTimeout(res, 2000);
      });
      await new Promise((res) => {
        let tries = 0;
        const check = () => {
          tries++;
          if (!this.sourceVideo) return res();
          if (this.sourceVideo.readyState >= 2 && this.sourceVideo.currentTime > 0) return res();
          if (tries > 60) return res();
          setTimeout(check, 33);
        };
        check();
      });
    }

    _fitCanvas() {
      const scale = this._isMobile ? 0.5 : 1;
      const w = Math.floor((this.sourceVideo?.videoWidth || 1280) * scale), h = Math.floor((this.sourceVideo?.videoHeight || 720) * scale);
      if (this.canvas && (this.canvas.width !== w || this.canvas.height !== h)) { this.canvas.width = w; this.canvas.height = h; }
    }

    /** Cambio di videocamera con lo sfondo acceso: nuova sorgente, stessa uscita. */
    async replaceSource(track) {
      if (!track || !this.sourceVideo) return false;
      const old = this._sourceTrackClone;
      this._sourceTrackClone = track.clone();
      this.sourceVideo.srcObject = new MediaStream([this._sourceTrackClone]);
      await this.sourceVideo.play().catch(() => { });
      try { old?.stop(); } catch (_) { }
      this._hasMask = false; this._maskPrev = null;
      await this._waitSource();
      this._fitCanvas();
      return true;
    }

    _startLoop() {
      const every = this._isMobile ? 90 : (seg.mode === 'legacy' ? 50 : 40);   // separazione: 11 / 20-25 al secondo
      let last = 0;
      const tick = () => {
        if (!this.sourceVideo || !this.ctx) return;
        if (this.sourceVideo.paused) return; // camera spenta: niente lavoro (CPU)
        if (this.sourceVideo.readyState < 2) return;
        const now = performance.now();
        if (now - last >= every && !seg.busy && this._type !== 'none') { last = now; seg.push(this.sourceVideo, now); }
        this._render();
      };
      if (this._ticker) { this._ticker.stop(); this._ticker = null; }
      if (window.TdtTicker) {
        // continua anche con la scheda in background (rAF sospeso → video congelato per gli altri)
        this._ticker = window.TdtTicker.start(tick, 33);
      } else {
        const loop = () => { tick(); this.rafId = requestAnimationFrame(loop); };
        loop();
      }
    }

    // maschera nuova: bordo stretto (curva) e media col fotogramma prima (niente tremolio)
    _onMask(m) {
      if (!this.sourceVideo) return;
      if (m.kind === 'image') {
        const im = m.image, w = im.width, h = im.height;
        if (this._maskCanvas.width !== w || this._maskCanvas.height !== h) { this._maskCanvas.width = w; this._maskCanvas.height = h; }
        this._maskCtx.clearRect(0, 0, w, h);
        this._maskCtx.drawImage(im, 0, 0, w, h);
        this._hasMask = true; this._maskKind = 'image'; this._maskSrc = this._maskCanvas;
        return;
      }
      const { w, h, data } = m;
      this._lastRaw = m;
      if (this._maskCanvas.width !== w || this._maskCanvas.height !== h || !this._maskImg) {
        this._maskCanvas.width = w; this._maskCanvas.height = h;
        this._maskImg = this._maskCtx.createImageData(w, h);
        this._maskPrev = null;
        const px = this._maskImg.data;
        for (let i = 0; i < px.length; i += 4) { px[i] = 255; px[i + 1] = 255; px[i + 2] = 255; }
      }
      const n = w * h;
      if (!this._maskPrev || this._maskPrev.length !== n) this._maskPrev = new Float32Array(n);
      const prev = this._maskPrev, px = this._maskImg.data;
      const k = this._hasMask ? 0.62 : 1;     // quanto pesa il fotogramma nuovo
      for (let i = 0; i < n; i++) {
        let a = data[i] / 255;
        // curva: sotto 0,3 sfondo, sopra 0,72 persona, in mezzo morbido (smoothstep)
        a = a <= 0.3 ? 0 : a >= 0.72 ? 1 : ((a - 0.3) / 0.42);
        a = a * a * (3 - 2 * a);
        const v = prev[i] + (a - prev[i]) * k;
        prev[i] = v;
        px[i * 4 + 3] = v * 255;
      }
      this._maskCtx.putImageData(this._maskImg, 0, 0);
      // un filo di sfumatura sul bordo, sulla maschera piccola (costa poco)
      if (FILTER_OK) {
        if (this._soft.width !== w || this._soft.height !== h) { this._soft.width = w; this._soft.height = h; }
        const sc = this._softCtx;
        sc.clearRect(0, 0, w, h); sc.filter = 'blur(0.8px)'; sc.drawImage(this._maskCanvas, 0, 0); sc.filter = 'none';
        this._maskSrc = this._soft;
      } else this._maskSrc = this._maskCanvas;
      this._hasMask = true; this._maskKind = 'alpha';
    }

    _render() {
      const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height, src = this.sourceVideo;
      if (this._type === 'none') { ctx.drawImage(src, 0, 0, W, H); return; }
      // prima maschera non ancora arrivata (il primo calcolo può volerci qualche secondo):
      // tutto sfocato, così la stanza vera non si vede nemmeno per un attimo
      if (!this._hasMask) { this._drawBlur(ctx, W, H); return; }

      // 1) persona: maschera ingrandita (bilineare = bordo morbido) e video dentro
      if (this._person.width !== W || this._person.height !== H) { this._person.width = W; this._person.height = H; }
      const p = this._pctx;
      p.save();
      p.clearRect(0, 0, W, H);
      p.imageSmoothingEnabled = true; p.imageSmoothingQuality = 'high';
      p.drawImage(this._maskSrc || this._maskCanvas, 0, 0, W, H);
      p.globalCompositeOperation = 'source-in';
      p.drawImage(src, 0, 0, W, H);
      p.restore();

      // 2) sfondo
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      if (this._type === 'blur') this._drawBlur(ctx, W, H);
      else if (this._type === 'image' && this._bgImage) this._cover(ctx, this._bgImage, this._bgImage.width, this._bgImage.height, W, H);
      else if (this._type === 'video' && this._bgVideo && this._bgVideo.readyState >= 2) this._cover(ctx, this._bgVideo, this._bgVideo.videoWidth, this._bgVideo.videoHeight, W, H);
      else if (this._type === 'anim') this._drawAnim(ctx, W, H);
      else { ctx.fillStyle = '#1f2937'; ctx.fillRect(0, 0, W, H); }
      // 3) persona sopra
      ctx.drawImage(this._person, 0, 0);
      ctx.restore();
    }

    _cover(ctx, img, iw, ih, W, H) {
      if (!iw || !ih) return;
      const s = Math.max(W / iw, H / ih), dw = iw * s, dh = ih * s;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    }

    _drawBlur(ctx, W, H) {
      const src = this.sourceVideo;
      // due passaggi giù (1/6 poi 1/16) e su, con l'interpolazione del browser: stesso
      // aspetto di ctx.filter blur, molto meno lavoro, e va anche su Safari (che il filtro non ce l'ha)
      if (!this._blurC) { this._blurC = [document.createElement('canvas'), document.createElement('canvas')]; }
      const [a, b] = this._blurC;
      const aw = Math.max(8, Math.round(W / 6)), ah = Math.max(8, Math.round(H / 6));
      const bw = Math.max(4, Math.round(W / 16)), bh = Math.max(4, Math.round(H / 16));
      if (a.width !== aw) { a.width = aw; a.height = ah; }
      if (b.width !== bw) { b.width = bw; b.height = bh; }
      const ac = a.getContext('2d'), bc = b.getContext('2d');
      ac.imageSmoothingQuality = 'high'; bc.imageSmoothingQuality = 'high';
      ac.drawImage(src, 0, 0, aw, ah);
      bc.drawImage(a, 0, 0, bw, bh);
      ac.drawImage(b, 0, 0, aw, ah);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(a, -6, -6, W + 12, H + 12);
    }

    _drawAnim(ctx, W, H) {
      const A = ANIMS[this._anim] || ANIMS.aurora;
      // si disegna piccolo (meno lavoro) e si ingrandisce: sono sfumature, non si vede
      const cw = 480, ch = Math.max(2, Math.round(480 * H / W));
      if (!this._animC) this._animC = document.createElement('canvas');
      if (this._animC.width !== cw || this._animC.height !== ch) { this._animC.width = cw; this._animC.height = ch; }
      const c = this._animC.getContext('2d');
      c.save();
      try { A.draw(c, cw, ch, (performance.now() - this._t0) / 1000); } catch (_) { }
      c.restore();
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(this._animC, 0, 0, W, H);
    }

    stop() {
      this._stopPipeline();
      if (seg.owner === this) { seg.onMask = null; seg.owner = null; }
      this.loaded = false;
      this._hasMask = false; this._maskPrev = null; this._maskImg = null;
      this._bgImage = null; this._bgImageUrl = null;
      this._stopBgVideo();
    }

    /** Camera spenta/riaccesa: ferma l'elaborazione senza smontare la pipeline */
    setPaused(paused) {
      const v = this.sourceVideo; if (!v) return;
      try { if (paused) v.pause(); else v.play().catch(() => { }); } catch (_) { }
      try { if (this._bgVideo) { if (paused) this._bgVideo.pause(); else this._bgVideo.play().catch(() => { }); } } catch (_) { }
    }

    _stopPipeline() {
      if (this._ticker) { this._ticker.stop(); this._ticker = null; }
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

  BackgroundEffect.ANIMS = Object.keys(ANIMS).map(id => ({ id, label: ANIMS[id].label }));
  /** Anteprima di uno sfondo animato (miniature del pannello). */
  BackgroundEffect.drawAnimThumb = (canvas, id, t = 4) => {
    const A = ANIMS[id]; if (!A || !canvas) return;
    const c = canvas.getContext('2d'); c.save(); try { A.draw(c, canvas.width, canvas.height, t); } catch (_) { } c.restore();
  };
  BackgroundEffect.segInfo = () => ({ mode: seg.mode, delegate: seg.delegate, cost: seg.cost, initMs: seg.initMs });
  window.BackgroundEffect = BackgroundEffect;
})();
