'use strict';

/**
 * FaceEffects v2
 * Overlay AR vettoriali che si adattano alla geometria del viso.
 *
 * Tecniche:
 *   - MediaPipe FaceMesh 468 landmark (servito localmente da /assets/vendor/mediapipe/)
 *   - Calcolo yaw/pitch/roll dai landmark per orientamento 3D
 *   - Scala adattiva basata sulla larghezza del viso (distanza tra le tempie)
 *   - Overlay disegnati su canvas con forme vettoriali (path + gradienti)
 *   - Deformazione prospettica leggera (skew su asse roll/yaw)
 *
 * Pipeline:
 *   camera → FaceMesh → canvas con overlay vettoriali → captureStream() → producer
 */
class FaceEffects {
  constructor() {
    this.active = null;
    this.faceMesh = null;
    this.loaded = false;
    this.lastLandmarks = null;
    this.sourceVideo = null;
    this.sourceStream = null;
    this.canvas = null;
    this.ctx = null;
    this.outputStream = null;
    this.rafId = null;
    this._sendBusy = false;
    this._lastSend = 0;
    this._sendInterval = 50;
    // ⭐ Color Styles: filtro colore applicato all'intero frame (stile Google Meet).
    // Indipendente dall'overlay: può essere attivo anche senza effetto viso.
    this.style = 'none';
    this._styleFilter = 'none';
  }

  // ─── Color Styles (gradazioni colore tipo Google Meet) ─────────────────────
  static get STYLES() {
    return [
      { id: 'none', label: 'Originale', icon: '⭕' },
      { id: 'vivid', label: 'Vivido', icon: '🌈' },
      { id: 'warm', label: 'Caldo', icon: '🔥' },
      { id: 'cool', label: 'Freddo', icon: '❄️' },
      { id: 'cinematic', label: 'Cinema', icon: '🎬' },
      { id: 'soft', label: 'Morbido', icon: '🌸' },
      { id: 'pop', label: 'Pop', icon: '💥' },
      { id: 'vintage', label: 'Vintage', icon: '📷' },
      { id: 'sepia', label: 'Seppia', icon: '🟤' },
      { id: 'mono', label: 'B/N', icon: '⚫' },
      { id: 'noir', label: 'Noir', icon: '🎭' },
    ];
  }
  static get STYLE_FILTERS() {
    return {
      none: 'none',
      vivid: 'saturate(1.5) contrast(1.12) brightness(1.03)',
      warm: 'sepia(0.28) saturate(1.35) brightness(1.05) hue-rotate(-8deg)',
      cool: 'saturate(1.18) contrast(1.05) brightness(1.02) hue-rotate(12deg)',
      cinematic: 'contrast(1.25) saturate(0.92) brightness(0.96) sepia(0.12)',
      soft: 'brightness(1.09) contrast(0.9) saturate(1.12)',
      pop: 'saturate(1.75) contrast(1.22) brightness(1.02) hue-rotate(-5deg)',
      vintage: 'sepia(0.42) saturate(1.2) contrast(0.92) brightness(1.06) hue-rotate(-10deg)',
      sepia: 'sepia(0.7) contrast(1.05) brightness(1.05)',
      mono: 'grayscale(1) contrast(1.1)',
      noir: 'grayscale(1) contrast(1.45) brightness(0.94)',
    };
  }

  setStyle(id) {
    this.style = id || 'none';
    this._styleFilter = FaceEffects.STYLE_FILTERS[this.style] || 'none';
  }
  getStyle() { return this.style; }

  // ─── Catalogo effetti ─────────────────────────────────────────────────────
  static get CATALOG() {
    return [
      { id: 'none', label: 'Nessuno', icon: '🚫' },
      // Copricapi
      { id: 'tophat', label: 'Cilindro', icon: '🎩' },
      { id: 'partyhat', label: 'Cono festa', icon: '🎉' },
      { id: 'crown', label: 'Corona', icon: '👑' },
      { id: 'cowboy', label: 'Cowboy', icon: '🤠' },
      { id: 'beanie', label: 'Berretto', icon: '🧢' },
      { id: 'santa', label: 'Babbo Natale', icon: '🎅' },
      // Orecchie animali
      { id: 'cat', label: 'Gatto', icon: '🐱' },
      { id: 'dog', label: 'Cane', icon: '🐶' },
      { id: 'rabbit', label: 'Coniglio', icon: '🐰' },
      { id: 'bear', label: 'Orso', icon: '🐻' },
      { id: 'mouse', label: 'Topo', icon: '🐭' },
      // Accessori viso
      { id: 'sunglasses', label: 'Occhiali sole', icon: '🕶️' },
      { id: 'nerdglasses', label: 'Occhiali nerd', icon: '🤓' },
      { id: 'mustache', label: 'Baffi', icon: '👨' },
      { id: 'beard', label: 'Barba', icon: '🧔' },
      { id: 'clownnose', label: 'Naso clown', icon: '🤡' },
      // Testa / aura
      { id: 'horns', label: 'Corna', icon: '😈' },
      { id: 'halo', label: 'Aureola', icon: '😇' },
      { id: 'hearts', label: 'Cuori', icon: '💕' },
      { id: 'flowers', label: 'Fiori', icon: '🌸' },
      { id: 'stars', label: 'Stelle', icon: '⭐' },
      // Maschere
      { id: 'mask', label: 'Maschera', icon: '🎭' },
      // Divertenti
      { id: 'blackcat', label: 'Gatto nero', icon: '😺' },
      { id: 'pizza', label: 'Pizza', icon: '🍕' },
      { id: 'shark', label: 'Squalo', icon: '🦈' },
      { id: 'hackerskull', label: 'Teschio hacker', icon: '💀' },
      { id: 'pumpkin', label: 'Zucca', icon: '🎃' },
      { id: 'brain', label: 'Cervello', icon: '🧠' },
      { id: 'bee', label: 'Ape', icon: '🐝' },
      { id: 'taco', label: 'Taco', icon: '🌮' },
      { id: 'dino', label: 'Dinosauro', icon: '🦖' },
      { id: 'beer', label: 'Birra', icon: '🍺' },
      { id: 'robot', label: 'Robot', icon: '🤖' },
      { id: 'alien', label: 'Alieno', icon: '👾' },
      // ⭐ Nuovi — occhiali & accessori occhi
      { id: 'glasses3d', label: 'Occhiali 3D', icon: '📺' },
      { id: 'thuglife', label: 'Thug Life', icon: '😎' },
      { id: 'heartglasses', label: 'Occhiali cuore', icon: '😍' },
      { id: 'monocle', label: 'Monocolo', icon: '🧐' },
      { id: 'eyepatch', label: 'Benda pirata', icon: '🏴‍☠️' },
      // ⭐ Nuovi — copricapi
      { id: 'graduation', label: 'Laurea', icon: '🎓' },
      { id: 'viking', label: 'Vichingo', icon: '⚔️' },
      { id: 'headphones', label: 'Cuffie', icon: '🎧' },
      { id: 'flowercrown', label: 'Ghirlanda fiori', icon: '💐' },
      { id: 'tiara', label: 'Tiara', icon: '👸' },
      { id: 'catpet', label: 'Gatto + coda', icon: '🐈' },
    ];
  }

  // ─── Init MediaPipe (da asset locali) ─────────────────────────────────────
  async _loadMediaPipe() {
    if (this.loaded) return;

    const localBase = '/assets/vendor/mediapipe';

    // Carica script principale
    if (typeof FaceMesh === 'undefined') {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = `${localBase}/face_mesh.js`;
        s.onload = res;
        s.onerror = () => rej(new Error('Impossibile caricare face_mesh.js — esegui setup-mediapipe.sh'));
        document.head.appendChild(s);
      });
    }

    if (typeof FaceMesh === 'undefined') throw new Error('FaceMesh non disponibile');

    this.faceMesh = new FaceMesh({
      // Punta ai file locali
      locateFile: (f) => `${localBase}/${f}`,
    });
    this.faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    this.faceMesh.onResults((results) => {
      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        this.lastLandmarks = results.multiFaceLandmarks[0];
      } else {
        this.lastLandmarks = null;
      }
      this._sendBusy = false;
    });

    await this.faceMesh.initialize();
    this.loaded = true;
  }

  async apply(stream) {
    await this._loadMediaPipe();
    this._stopPipeline();

    this.sourceStream = stream;
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) throw new Error('Nessun track video nello stream');

    const settings = videoTrack.getSettings();
    const w = settings.width || 1280;
    const h = settings.height || 720;

    // Workaround Chrome: clono il track perché Chrome non pompa frame
    // in un <video> hidden che condivide il track con un altro <video> visibile
    this._sourceTrackClone = videoTrack.clone();

    this.sourceVideo = document.createElement('video');
    this.sourceVideo.autoplay = true;
    this.sourceVideo.playsInline = true;
    this.sourceVideo.muted = true;
    // Chrome fix: se il video è 0x0 o display:none, getCurrentFrame() non funziona
    this.sourceVideo.style.cssText = 'position:fixed;bottom:0;right:0;width:4px;height:4px;opacity:0.01;pointer-events:none;z-index:999;';
    document.body.appendChild(this.sourceVideo);
    this.sourceVideo.srcObject = new MediaStream([this._sourceTrackClone]);
    await this.sourceVideo.play().catch(() => { });

    await new Promise((res) => {
      if (!this.sourceVideo || this.sourceVideo.videoWidth > 0) return res();
      this.sourceVideo.addEventListener('loadedmetadata', res, { once: true });
      setTimeout(res, 1500);
    });
    // Attendi che il video abbia effettivamente frame (Chrome)
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

    if (!this.sourceVideo) throw new Error('pipeline interrotta durante l\'avvio');
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.sourceVideo.videoWidth || w;
    this.canvas.height = this.sourceVideo.videoHeight || h;
    this.ctx = this.canvas.getContext('2d');

    this.outputStream = this.canvas.captureStream(30);
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) this.outputStream.addTrack(audioTrack);

    this._startLoop();
    return this.outputStream;
  }

  _startLoop() {
    const loop = async () => {
      if (!this.sourceVideo) return;
      if (!this.sourceVideo.paused && !this.sourceVideo.ended) {
        await this._renderFrame();
      }
      this.rafId = requestAnimationFrame(loop);
    };
    loop();
  }

  async _renderFrame() {
    const v = this.sourceVideo;
    if (!v || !this.canvas || !this.ctx) return;   // pipeline smontata a metà frame
    const w = this.canvas.width;
    const h = this.canvas.height;

    // ⭐ Color Style: filtro colore SOLO sul frame video (gli overlay restano nitidi).
    this.ctx.filter = (this._styleFilter && this._styleFilter !== 'none') ? this._styleFilter : 'none';
    this.ctx.drawImage(v, 0, 0, w, h);
    this.ctx.filter = 'none';

    if (this.active && this.active !== 'none') {
      const now = performance.now();
      if (!this._sendBusy && now - this._lastSend >= this._sendInterval) {
        this._sendBusy = true;
        this._lastSend = now;
        this.faceMesh.send({ image: v }).catch(() => { this._sendBusy = false; });
      }
      if (this.lastLandmarks) {
        this._drawOverlay(this.ctx, this.lastLandmarks, w, h);
      }
    }
  }

  // ─── Calcolo geometria viso da landmark ───────────────────────────────────
  _computeFaceGeometry(lm, w, h) {
    const p = (i) => ({ x: lm[i].x * w, y: lm[i].y * h, z: lm[i].z * w });

    const forehead = p(10);
    const chin = p(152);
    const noseTip = p(1);
    const noseBridge = p(168);
    const leftEyeOuter = p(33);
    const rightEyeOuter = p(263);
    const leftEyeInner = p(133);
    const rightEyeInner = p(362);
    const leftEar = p(234);
    const rightEar = p(454);
    const upperLip = p(13);
    const lowerLip = p(14);
    const leftMouth = p(61);
    const rightMouth = p(291);
    const leftCheek = p(50);
    const rightCheek = p(280);
    const topHead = p(10);

    // Centro viso
    const cx = (leftEar.x + rightEar.x) / 2;
    const cy = (forehead.y + chin.y) / 2;

    // Larghezza viso (tempia a tempia)
    const faceW = Math.hypot(rightEar.x - leftEar.x, rightEar.y - leftEar.y);
    // Altezza viso
    const faceH = Math.hypot(chin.x - forehead.x, chin.y - forehead.y);

    // Rotazioni
    // Roll: inclinazione laterale (dagli occhi)
    const roll = Math.atan2(rightEyeOuter.y - leftEyeOuter.y, rightEyeOuter.x - leftEyeOuter.x);
    // Yaw: rotazione sx/dx (dalla profondità Z delle tempie)
    const yaw = Math.atan2(rightEar.z - leftEar.z, faceW);
    // Pitch: rotazione su/giù (Z di fronte vs mento)
    const pitch = Math.atan2(forehead.z - chin.z, faceH);

    return {
      forehead, chin, noseTip, noseBridge,
      leftEye: leftEyeOuter, rightEye: rightEyeOuter,
      leftEyeInner, rightEyeInner,
      leftEar, rightEar,
      upperLip, lowerLip, leftMouth, rightMouth,
      leftCheek, rightCheek, topHead,
      cx, cy, faceW, faceH,
      roll, yaw, pitch,
      eyeDist: Math.hypot(rightEyeOuter.x - leftEyeOuter.x, rightEyeOuter.y - leftEyeOuter.y),
      eyeMid: { x: (leftEyeOuter.x + rightEyeOuter.x) / 2, y: (leftEyeOuter.y + rightEyeOuter.y) / 2 },
    };
  }

  _drawOverlay(ctx, lm, w, h) {
    const g = this._computeFaceGeometry(lm, w, h);
    ctx.save();

    // ⭐ Realismo: ombra morbida proporzionale al viso, così gli overlay
    // "appoggiano" invece di galleggiare piatti. I singoli metodi possono
    // sovrascriverla (es. effetti glow) con ctx.shadowBlur = 0.
    ctx.shadowColor = 'rgba(0,0,0,0.32)';
    ctx.shadowBlur = g.faceW * 0.05;
    ctx.shadowOffsetX = g.faceW * 0.008;
    ctx.shadowOffsetY = g.faceW * 0.018;

    switch (this.active) {
      case 'tophat': this._drawTopHat(ctx, g); break;
      case 'partyhat': this._drawPartyHat(ctx, g); break;
      case 'crown': this._drawCrown(ctx, g); break;
      case 'cowboy': this._drawCowboyHat(ctx, g); break;
      case 'beanie': this._drawBeanie(ctx, g); break;
      case 'santa': this._drawSantaHat(ctx, g); break;
      case 'cat': this._drawCatEars(ctx, g); break;
      case 'dog': this._drawDogEars(ctx, g); break;
      case 'rabbit': this._drawRabbitEars(ctx, g); break;
      case 'bear': this._drawBearEars(ctx, g); break;
      case 'mouse': this._drawMouseEars(ctx, g); break;
      case 'sunglasses': this._drawSunglasses(ctx, g); break;
      case 'nerdglasses': this._drawNerdGlasses(ctx, g); break;
      case 'mustache': this._drawMustache(ctx, g); break;
      case 'beard': this._drawBeard(ctx, g); break;
      case 'clownnose': this._drawClownNose(ctx, g); break;
      case 'horns': this._drawHorns(ctx, g); break;
      case 'halo': this._drawHalo(ctx, g); break;
      case 'hearts': this._drawHearts(ctx, g); break;
      case 'flowers': this._drawFlowers(ctx, g); break;
      case 'stars': this._drawStars(ctx, g); break;
      case 'mask': this._drawMask(ctx, g); break;
      case 'blackcat': this._drawBlackCat(ctx, g); break;
      case 'pizza': this._drawPizza(ctx, g); break;
      case 'shark': this._drawShark(ctx, g); break;
      case 'hackerskull': this._drawHackerSkull(ctx, g); break;
      case 'pumpkin': this._drawPumpkin(ctx, g); break;
      case 'brain': this._drawBrain(ctx, g); break;
      case 'bee': this._drawBee(ctx, g); break;
      case 'taco': this._drawTaco(ctx, g); break;
      case 'dino': this._drawDino(ctx, g); break;
      case 'beer': this._drawBeer(ctx, g); break;
      case 'robot': this._drawRobot(ctx, g); break;
      case 'alien': this._drawAlien(ctx, g); break;
      case 'glasses3d': this._drawGlasses3D(ctx, g); break;
      case 'thuglife': this._drawThugLife(ctx, g); break;
      case 'heartglasses': this._drawHeartGlasses(ctx, g); break;
      case 'monocle': this._drawMonocle(ctx, g); break;
      case 'eyepatch': this._drawEyepatch(ctx, g); break;
      case 'graduation': this._drawGraduation(ctx, g); break;
      case 'viking': this._drawViking(ctx, g); break;
      case 'headphones': this._drawHeadphones(ctx, g); break;
      case 'flowercrown': this._drawFlowerCrown(ctx, g); break;
      case 'tiara': this._drawTiara(ctx, g); break;
      case 'catpet': this._drawCatPet(ctx, g); break;
    }

    ctx.restore();
  }

  // ─── Helper: applica trasformazione testa (ruota+inclina) ─────────────────
  _headTransform(ctx, g, offsetY = 0) {
    ctx.translate(g.cx, g.cy + offsetY);
    ctx.rotate(g.roll);
    // Compressione orizzontale per yaw (prospettiva leggera)
    const yawScale = Math.cos(g.yaw);
    ctx.scale(yawScale * 1.0, 1.0);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // COPRICAPI
  // ═════════════════════════════════════════════════════════════════════════

  _drawTopHat(ctx, g) {
    const W = g.faceW * 1.15;
    const brimH = W * 0.1;
    const crownH = W * 0.9;
    const crownW = W * 0.75;

    ctx.save();
    this._headTransform(ctx, g);
    ctx.translate(0, -(g.cy - g.forehead.y) - crownH * 0.42);

    // Falda
    ctx.fillStyle = '#0e0e14';
    ctx.beginPath();
    ctx.ellipse(0, crownH * 0.5, W / 2, brimH, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cilindro
    const grad = ctx.createLinearGradient(-crownW / 2, 0, crownW / 2, 0);
    grad.addColorStop(0, '#1a1a24'); grad.addColorStop(0.5, '#2b2b38'); grad.addColorStop(1, '#0c0c12');
    ctx.fillStyle = grad;
    ctx.fillRect(-crownW / 2, -crownH / 2, crownW, crownH);
    // Top
    ctx.beginPath();
    ctx.ellipse(0, -crownH / 2, crownW / 2, brimH * 0.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#2b2b38';
    ctx.fill();
    // Fascia rossa
    ctx.fillStyle = '#a02030';
    ctx.fillRect(-crownW / 2, crownH * 0.28, crownW, crownH * 0.1);
    ctx.restore();
  }

  _drawPartyHat(ctx, g) {
    const W = g.faceW * 0.55;
    const H = g.faceW * 0.9;

    ctx.save();
    this._headTransform(ctx, g);
    ctx.translate(0, -(g.cy - g.forehead.y) - H * 0.5);

    const grad = ctx.createLinearGradient(0, -H, 0, 0);
    grad.addColorStop(0, '#ff2e7a'); grad.addColorStop(0.5, '#ffd400'); grad.addColorStop(1, '#00b6ff');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-W / 2, 0);
    ctx.lineTo(W / 2, 0);
    ctx.lineTo(0, -H);
    ctx.closePath();
    ctx.fill();

    // Pom pom
    ctx.fillStyle = '#fff6b0';
    ctx.beginPath();
    ctx.arc(0, -H - W * 0.15, W * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Pois
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 6; i++) {
      const y = -H * (0.15 + Math.random() * 0.65);
      const x = (Math.random() - 0.5) * W * 0.7 * (1 - Math.abs(y) / H);
      ctx.beginPath();
      ctx.arc(x, y, W * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawCrown(ctx, g) {
    const W = g.faceW * 1.05;
    const H = W * 0.45;

    ctx.save();
    this._headTransform(ctx, g);
    ctx.translate(0, -(g.cy - g.forehead.y) - H * 0.4);

    const grad = ctx.createLinearGradient(0, -H, 0, 0);
    grad.addColorStop(0, '#ffd700'); grad.addColorStop(1, '#b8860b');
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.moveTo(-W / 2, H * 0.2);
    ctx.lineTo(-W / 2, -H * 0.15);
    ctx.lineTo(-W * 0.35, -H * 0.85);
    ctx.lineTo(-W * 0.2, -H * 0.35);
    ctx.lineTo(-W * 0.08, -H);
    ctx.lineTo(W * 0.08, -H);
    ctx.lineTo(W * 0.2, -H * 0.35);
    ctx.lineTo(W * 0.35, -H * 0.85);
    ctx.lineTo(W / 2, -H * 0.15);
    ctx.lineTo(W / 2, H * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#7d5a00'; ctx.lineWidth = 2; ctx.stroke();

    // Gemme
    const gems = ['#e94560', '#3a8ef6', '#34a853'];
    [-W * 0.35, 0, W * 0.35].forEach((x, i) => {
      ctx.beginPath();
      ctx.arc(x, -H * 0.12, W * 0.05, 0, Math.PI * 2);
      ctx.fillStyle = gems[i % 3]; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
    });
    ctx.restore();
  }

  _drawCowboyHat(ctx, g) {
    const W = g.faceW * 1.4;
    const H = W * 0.55;

    ctx.save();
    this._headTransform(ctx, g);
    ctx.translate(0, -(g.cy - g.forehead.y) - H * 0.3);

    const grad = ctx.createLinearGradient(0, -H, 0, H * 0.3);
    grad.addColorStop(0, '#a86d3b'); grad.addColorStop(1, '#5c3a1e');
    ctx.fillStyle = grad;

    // Falda ondulata
    ctx.beginPath();
    ctx.moveTo(-W / 2, 0);
    ctx.quadraticCurveTo(-W / 2, -H * 0.1, -W * 0.35, -H * 0.1);
    ctx.quadraticCurveTo(0, -H * 0.05, W * 0.35, -H * 0.1);
    ctx.quadraticCurveTo(W / 2, -H * 0.1, W / 2, 0);
    ctx.quadraticCurveTo(0, H * 0.15, -W / 2, 0);
    ctx.closePath();
    ctx.fill();

    // Cupola
    ctx.beginPath();
    ctx.moveTo(-W * 0.3, -H * 0.1);
    ctx.bezierCurveTo(-W * 0.3, -H, W * 0.3, -H, W * 0.3, -H * 0.1);
    ctx.closePath();
    ctx.fill();

    // Piega centrale
    ctx.strokeStyle = '#3a2512'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -H * 0.95);
    ctx.lineTo(0, -H * 0.2);
    ctx.stroke();

    ctx.restore();
  }

  _drawBeanie(ctx, g) {
    const W = g.faceW * 1.05;
    const H = W * 0.65;

    ctx.save();
    this._headTransform(ctx, g);
    ctx.translate(0, -(g.cy - g.forehead.y) - H * 0.45);

    ctx.fillStyle = '#c23e4a';
    ctx.beginPath();
    ctx.moveTo(-W / 2, H * 0.15);
    ctx.quadraticCurveTo(-W / 2, -H, 0, -H);
    ctx.quadraticCurveTo(W / 2, -H, W / 2, H * 0.15);
    ctx.closePath();
    ctx.fill();

    // Risvolto
    ctx.fillStyle = '#8a1e2a';
    ctx.fillRect(-W / 2, 0, W, H * 0.2);

    // Pompon
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, -H - W * 0.05, W * 0.13, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _drawSantaHat(ctx, g) {
    const W = g.faceW * 1.1;
    const H = W * 1.1;

    ctx.save();
    this._headTransform(ctx, g);
    ctx.translate(0, -(g.cy - g.forehead.y) - H * 0.5);

    // Triangolo rosso ricurvo
    ctx.fillStyle = '#d62828';
    ctx.beginPath();
    ctx.moveTo(-W / 2, H * 0.15);
    ctx.quadraticCurveTo(-W / 2, -H / 2, -W * 0.1, -H * 0.9);
    ctx.quadraticCurveTo(W * 0.3, -H, W * 0.45, -H * 0.8);
    ctx.quadraticCurveTo(W * 0.2, -H * 0.3, W / 2, H * 0.15);
    ctx.closePath();
    ctx.fill();

    // Bordo bianco
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(0, H * 0.15, W * 0.55, H * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pompon
    ctx.beginPath();
    ctx.arc(W * 0.45, -H * 0.8, W * 0.13, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ORECCHIE ANIMALI
  // ═════════════════════════════════════════════════════════════════════════

  _drawCatEars(ctx, g) {
    const W = g.faceW;
    ctx.save();
    this._headTransform(ctx, g, -(g.cy - g.forehead.y));

    const earW = W * 0.28;
    const earH = W * 0.38;
    const offX = W * 0.28;

    // Orecchio sx
    ctx.fillStyle = '#2a2a32';
    ctx.beginPath();
    ctx.moveTo(-offX - earW / 2, earH * 0.3);
    ctx.lineTo(-offX, -earH);
    ctx.lineTo(-offX + earW / 2, earH * 0.3);
    ctx.closePath();
    ctx.fill();
    // Interno
    ctx.fillStyle = '#ffb0c0';
    ctx.beginPath();
    ctx.moveTo(-offX - earW * 0.25, earH * 0.1);
    ctx.lineTo(-offX, -earH * 0.7);
    ctx.lineTo(-offX + earW * 0.25, earH * 0.1);
    ctx.closePath();
    ctx.fill();

    // Orecchio dx
    ctx.fillStyle = '#2a2a32';
    ctx.beginPath();
    ctx.moveTo(offX - earW / 2, earH * 0.3);
    ctx.lineTo(offX, -earH);
    ctx.lineTo(offX + earW / 2, earH * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffb0c0';
    ctx.beginPath();
    ctx.moveTo(offX - earW * 0.25, earH * 0.1);
    ctx.lineTo(offX, -earH * 0.7);
    ctx.lineTo(offX + earW * 0.25, earH * 0.1);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Naso + baffetti gatto
    ctx.save();
    ctx.translate(g.noseTip.x, g.noseTip.y);
    ctx.rotate(g.roll);
    ctx.fillStyle = '#ff8fa0';
    ctx.beginPath();
    ctx.moveTo(-W * 0.04, 0);
    ctx.lineTo(W * 0.04, 0);
    ctx.lineTo(0, W * 0.04);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _drawDogEars(ctx, g) {
    const W = g.faceW;
    ctx.save();
    this._headTransform(ctx, g, -(g.cy - g.forehead.y) * 0.5);

    const earW = W * 0.22;
    const earH = W * 0.5;
    const offX = W * 0.42;

    // Orecchie pendenti
    ctx.fillStyle = '#6b3a1a';
    // Sx
    ctx.beginPath();
    ctx.ellipse(-offX, earH * 0.2, earW, earH * 0.6, -0.2, 0, Math.PI * 2);
    ctx.fill();
    // Interno
    ctx.fillStyle = '#d8a77e';
    ctx.beginPath();
    ctx.ellipse(-offX, earH * 0.3, earW * 0.55, earH * 0.4, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Dx
    ctx.fillStyle = '#6b3a1a';
    ctx.beginPath();
    ctx.ellipse(offX, earH * 0.2, earW, earH * 0.6, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d8a77e';
    ctx.beginPath();
    ctx.ellipse(offX, earH * 0.3, earW * 0.55, earH * 0.4, 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Naso nero
    ctx.save();
    ctx.translate(g.noseTip.x, g.noseTip.y);
    ctx.rotate(g.roll);
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.ellipse(0, 0, W * 0.06, W * 0.045, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawRabbitEars(ctx, g) {
    const W = g.faceW;
    ctx.save();
    this._headTransform(ctx, g, -(g.cy - g.forehead.y));

    const earW = W * 0.18;
    const earH = W * 0.9;
    const offX = W * 0.18;

    ctx.fillStyle = '#f5f5f5';
    // Sx
    ctx.beginPath();
    ctx.ellipse(-offX, -earH / 2, earW, earH / 2, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd0d8';
    ctx.beginPath();
    ctx.ellipse(-offX, -earH / 2, earW * 0.5, earH * 0.38, -0.1, 0, Math.PI * 2);
    ctx.fill();

    // Dx
    ctx.fillStyle = '#f5f5f5';
    ctx.beginPath();
    ctx.ellipse(offX, -earH / 2, earW, earH / 2, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd0d8';
    ctx.beginPath();
    ctx.ellipse(offX, -earH / 2, earW * 0.5, earH * 0.38, 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _drawBearEars(ctx, g) {
    const W = g.faceW;
    ctx.save();
    this._headTransform(ctx, g, -(g.cy - g.forehead.y) * 0.8);

    const earR = W * 0.18;
    const offX = W * 0.4;

    ctx.fillStyle = '#4a2c17';
    ctx.beginPath(); ctx.arc(-offX, 0, earR, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(offX, 0, earR, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#a87350';
    ctx.beginPath(); ctx.arc(-offX, earR * 0.1, earR * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(offX, earR * 0.1, earR * 0.5, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  }

  _drawMouseEars(ctx, g) {
    const W = g.faceW;
    ctx.save();
    this._headTransform(ctx, g, -(g.cy - g.forehead.y) * 0.9);

    const earR = W * 0.22;
    const offX = W * 0.35;

    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath(); ctx.arc(-offX, -earR * 0.2, earR, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(offX, -earR * 0.2, earR, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#ff99aa';
    ctx.beginPath(); ctx.arc(-offX, -earR * 0.15, earR * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(offX, -earR * 0.15, earR * 0.55, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ACCESSORI VISO
  // ═════════════════════════════════════════════════════════════════════════

  _drawSunglasses(ctx, g) {
    const eyeDist = g.eyeDist;
    const lensR = eyeDist * 0.35;

    ctx.save();
    ctx.translate(g.eyeMid.x, g.eyeMid.y);
    ctx.rotate(g.roll);
    ctx.scale(Math.cos(g.yaw), 1);

    // Lenti scure
    ctx.fillStyle = 'rgba(20,20,30,0.88)';
    ctx.strokeStyle = '#0a0a14';
    ctx.lineWidth = 3;
    // Sx
    ctx.beginPath();
    ctx.ellipse(-eyeDist / 2, 0, lensR, lensR * 0.85, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Dx
    ctx.beginPath();
    ctx.ellipse(eyeDist / 2, 0, lensR, lensR * 0.85, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Ponte
    ctx.beginPath();
    ctx.moveTo(-eyeDist / 2 + lensR * 0.85, -lensR * 0.1);
    ctx.lineTo(eyeDist / 2 - lensR * 0.85, -lensR * 0.1);
    ctx.stroke();

    // Riflesso
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.ellipse(-eyeDist / 2 - lensR * 0.3, -lensR * 0.3, lensR * 0.2, lensR * 0.12, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(eyeDist / 2 - lensR * 0.3, -lensR * 0.3, lensR * 0.2, lensR * 0.12, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawNerdGlasses(ctx, g) {
    const eyeDist = g.eyeDist;
    const lensR = eyeDist * 0.4;

    ctx.save();
    ctx.translate(g.eyeMid.x, g.eyeMid.y);
    ctx.rotate(g.roll);
    ctx.scale(Math.cos(g.yaw), 1);

    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 5;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';

    // Quadrate con angoli arrotondati
    const lensH = lensR * 0.8;
    [-eyeDist / 2, eyeDist / 2].forEach(cx => {
      ctx.beginPath();
      ctx.roundRect(cx - lensR, -lensH, lensR * 2, lensH * 2, 6);
      ctx.fill();
      ctx.stroke();
    });
    // Ponte
    ctx.beginPath();
    ctx.moveTo(-eyeDist / 2 + lensR, 0);
    ctx.lineTo(eyeDist / 2 - lensR, 0);
    ctx.stroke();
    ctx.restore();
  }

  _drawMustache(ctx, g) {
    const nose = g.noseTip;
    const lip = g.upperLip;
    const cx = (nose.x + lip.x) / 2;
    const cy = (nose.y + lip.y * 2) / 3;
    const W = g.faceW * 0.5;
    const H = g.faceW * 0.18;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(g.roll);
    ctx.scale(Math.cos(g.yaw), 1);

    ctx.fillStyle = '#2a1a0c';
    // Baffo manubrio: due curve a spirale
    ctx.beginPath();
    ctx.moveTo(0, -H * 0.1);
    ctx.bezierCurveTo(-W * 0.3, -H * 0.5, -W * 0.5, -H * 0.2, -W * 0.55, H * 0.2);
    ctx.bezierCurveTo(-W * 0.42, H * 0.3, -W * 0.25, H * 0.2, -W * 0.05, H * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -H * 0.1);
    ctx.bezierCurveTo(W * 0.3, -H * 0.5, W * 0.5, -H * 0.2, W * 0.55, H * 0.2);
    ctx.bezierCurveTo(W * 0.42, H * 0.3, W * 0.25, H * 0.2, W * 0.05, H * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _drawBeard(ctx, g) {
    const W = g.faceW * 0.85;
    const H = g.faceH * 0.55;

    ctx.save();
    ctx.translate((g.leftMouth.x + g.rightMouth.x) / 2, (g.lowerLip.y + g.chin.y) / 2);
    ctx.rotate(g.roll);
    ctx.scale(Math.cos(g.yaw), 1);

    ctx.fillStyle = '#3a2512';
    ctx.beginPath();
    ctx.moveTo(-W / 2, -H * 0.3);
    ctx.quadraticCurveTo(-W / 2, H * 0.5, 0, H * 0.6);
    ctx.quadraticCurveTo(W / 2, H * 0.5, W / 2, -H * 0.3);
    ctx.quadraticCurveTo(W * 0.3, -H * 0.15, 0, -H * 0.1);
    ctx.quadraticCurveTo(-W * 0.3, -H * 0.15, -W / 2, -H * 0.3);
    ctx.closePath();
    ctx.fill();

    // Textura
    ctx.strokeStyle = 'rgba(80,50,25,0.4)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 20; i++) {
      const x = (Math.random() - 0.5) * W * 0.8;
      const y = (Math.random() * 0.8) * H * 0.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 1, y + 4);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawClownNose(ctx, g) {
    const r = g.faceW * 0.07;
    ctx.save();
    ctx.translate(g.noseTip.x, g.noseTip.y);
    ctx.rotate(g.roll);

    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    grad.addColorStop(0, '#ff8080'); grad.addColorStop(1, '#d10000');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(-r * 0.3, -r * 0.35, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ═════════════════════════════════════════════════════════════════════════
  // TESTA / AURA
  // ═════════════════════════════════════════════════════════════════════════

  _drawHorns(ctx, g) {
    const W = g.faceW;
    ctx.save();
    this._headTransform(ctx, g, -(g.cy - g.forehead.y) * 0.7);

    const hornW = W * 0.12;
    const hornH = W * 0.35;
    const offX = W * 0.3;

    const grad = ctx.createLinearGradient(0, -hornH, 0, 0);
    grad.addColorStop(0, '#6b0a0a'); grad.addColorStop(1, '#2a0505');
    ctx.fillStyle = grad;

    // Sx
    ctx.beginPath();
    ctx.moveTo(-offX - hornW / 2, 0);
    ctx.quadraticCurveTo(-offX - hornW, -hornH * 0.6, -offX, -hornH);
    ctx.quadraticCurveTo(-offX + hornW / 2, -hornH * 0.4, -offX + hornW / 2, 0);
    ctx.closePath();
    ctx.fill();
    // Dx
    ctx.beginPath();
    ctx.moveTo(offX - hornW / 2, 0);
    ctx.quadraticCurveTo(offX - hornW / 2, -hornH * 0.4, offX, -hornH);
    ctx.quadraticCurveTo(offX + hornW, -hornH * 0.6, offX + hornW / 2, 0);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  _drawHalo(ctx, g) {
    ctx.save();
    ctx.translate(g.cx, g.forehead.y - g.faceW * 0.55);
    ctx.rotate(g.roll);

    // Glow esterno
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, g.faceW * 0.7);
    glow.addColorStop(0, 'rgba(255,230,100,0.5)');
    glow.addColorStop(1, 'rgba(255,230,100,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(0, 0, g.faceW * 0.7, g.faceW * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    // Anello principale
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = g.faceW * 0.04;
    ctx.beginPath();
    ctx.ellipse(0, 0, g.faceW * 0.55, g.faceW * 0.15, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,220,0.8)';
    ctx.lineWidth = g.faceW * 0.015;
    ctx.stroke();
    ctx.restore();
  }

  _drawHearts(ctx, g) {
    const t = Date.now() / 800;
    const positions = [
      { x: g.leftCheek.x - g.faceW * 0.08, y: g.leftCheek.y, s: 0.35, ph: 0 },
      { x: g.rightCheek.x + g.faceW * 0.08, y: g.rightCheek.y, s: 0.35, ph: 1 },
      { x: g.forehead.x - g.faceW * 0.3, y: g.forehead.y - g.faceW * 0.2, s: 0.25, ph: 2 },
      { x: g.forehead.x + g.faceW * 0.3, y: g.forehead.y - g.faceW * 0.2, s: 0.25, ph: 3 },
    ];
    positions.forEach(p => {
      const pulse = 1 + Math.sin(t + p.ph) * 0.1;
      this._drawHeart(ctx, p.x, p.y, g.faceW * p.s * pulse);
    });
  }

  _drawHeart(ctx, cx, cy, size) {
    ctx.save();
    ctx.translate(cx, cy);
    const grad = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
    grad.addColorStop(0, '#ff6b9d'); grad.addColorStop(1, '#c7184b');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.3);
    ctx.bezierCurveTo(-size, -size * 0.2, -size * 0.5, -size * 0.7, 0, -size * 0.3);
    ctx.bezierCurveTo(size * 0.5, -size * 0.7, size, -size * 0.2, 0, size * 0.3);
    ctx.fill();
    ctx.restore();
  }

  _drawFlowers(ctx, g) {
    const W = g.faceW;
    // Corona di fiori sulla testa
    const count = 7;
    const t = Date.now() / 2000;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI - Math.PI / 2 + g.roll + Math.sin(t + i) * 0.05;
      const r = W * 0.55;
      const x = g.forehead.x + Math.cos(a) * r;
      const y = g.forehead.y - W * 0.35 + Math.sin(a) * r * 0.3;
      const colors = ['#ff6b9d', '#ffd700', '#ff8a5b', '#e94560'];
      this._drawFlower(ctx, x, y, W * 0.08, colors[i % 4]);
    }
  }

  _drawFlower(ctx, cx, cy, size, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = color;
    for (let i = 0; i < 5; i++) {
      ctx.rotate(Math.PI * 2 / 5);
      ctx.beginPath();
      ctx.ellipse(0, -size * 0.55, size * 0.35, size * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawStars(ctx, g) {
    const W = g.faceW;
    const t = Date.now() / 500;
    // 8 stelle che orbitano attorno alla testa
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + t * 0.3;
      const r = W * 0.7;
      const x = g.cx + Math.cos(a) * r;
      const y = g.forehead.y - W * 0.1 + Math.sin(a) * r * 0.5;
      const twinkle = 0.6 + Math.sin(t * 2 + i) * 0.4;
      this._drawStar(ctx, x, y, W * 0.06 * twinkle, '#ffd700');
    }
  }

  _drawStar(ctx, cx, cy, size, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = color;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? size : size * 0.4;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  _drawMask(ctx, g) {
    const W = g.faceW * 1.1;
    const H = g.faceH * 0.5;

    ctx.save();
    ctx.translate(g.eyeMid.x, g.eyeMid.y - g.faceW * 0.05);
    ctx.rotate(g.roll);
    ctx.scale(Math.cos(g.yaw), 1);

    // Maschera veneziana dorata
    const grad = ctx.createLinearGradient(0, -H / 2, 0, H / 2);
    grad.addColorStop(0, '#ffd700'); grad.addColorStop(0.5, '#b8860b'); grad.addColorStop(1, '#7d5a00');
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.moveTo(-W / 2, 0);
    ctx.quadraticCurveTo(-W / 2, -H / 2, -W * 0.25, -H / 2);
    ctx.quadraticCurveTo(0, -H * 0.3, W * 0.25, -H / 2);
    ctx.quadraticCurveTo(W / 2, -H / 2, W / 2, 0);
    ctx.quadraticCurveTo(W * 0.25, H / 2, 0, H * 0.35);
    ctx.quadraticCurveTo(-W * 0.25, H / 2, -W / 2, 0);
    ctx.closePath();
    ctx.fill();

    // Ritagli per gli occhi
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.ellipse(-W * 0.22, 0, W * 0.1, H * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(W * 0.22, 0, W * 0.1, H * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = 'source-over';
    // Decori
    ctx.strokeStyle = '#5a4000'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(-W * 0.22, 0, W * 0.13, H * 0.18, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(W * 0.22, 0, W * 0.13, H * 0.18, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NUOVI EFFETTI DIVERTENTI
  // ═══════════════════════════════════════════════════════════════════════════

  // Gatto nero con occhi gialli luminosi e orecchie appuntite
  _drawBlackCat(ctx, g) {
    const W = g.faceW;
    ctx.save();
    this._headTransform(ctx, g, -(g.cy - g.forehead.y));

    const earW = W * 0.3;
    const earH = W * 0.42;
    const offX = W * 0.3;

    // Orecchie nere appuntite
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(-offX - earW / 2, earH * 0.3);
    ctx.lineTo(-offX, -earH);
    ctx.lineTo(-offX + earW / 2, earH * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(offX - earW / 2, earH * 0.3);
    ctx.lineTo(offX, -earH);
    ctx.lineTo(offX + earW / 2, earH * 0.3);
    ctx.closePath();
    ctx.fill();

    // Interno orecchie viola scuro
    ctx.fillStyle = '#3a1a4a';
    ctx.beginPath();
    ctx.moveTo(-offX - earW * 0.2, earH * 0.15);
    ctx.lineTo(-offX, -earH * 0.75);
    ctx.lineTo(-offX + earW * 0.2, earH * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(offX - earW * 0.2, earH * 0.15);
    ctx.lineTo(offX, -earH * 0.75);
    ctx.lineTo(offX + earW * 0.2, earH * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Occhi gialli luminosi con pupilla verticale (sopra gli occhi reali)
    const t = Date.now() / 500;
    const glow = 0.7 + Math.sin(t) * 0.3;
    [g.leftEye, g.rightEye].forEach((eye) => {
      ctx.save();
      ctx.translate(eye.x, eye.y);
      ctx.rotate(g.roll);
      const er = W * 0.06;
      // Alone
      const ag = ctx.createRadialGradient(0, 0, 0, 0, 0, er * 3);
      ag.addColorStop(0, `rgba(255,230,0,${glow})`);
      ag.addColorStop(1, 'rgba(255,230,0,0)');
      ctx.fillStyle = ag;
      ctx.beginPath(); ctx.arc(0, 0, er * 3, 0, Math.PI * 2); ctx.fill();
      // Iride
      ctx.fillStyle = '#ffdd00';
      ctx.beginPath(); ctx.arc(0, 0, er, 0, Math.PI * 2); ctx.fill();
      // Pupilla verticale
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(0, 0, er * 0.2, er * 0.9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
  }

  // Fetta di pizza triangolare in testa
  _drawPizza(ctx, g) {
    const W = g.faceW * 1.3;
    const H = W * 0.85;

    ctx.save();
    this._headTransform(ctx, g);
    ctx.translate(0, -(g.cy - g.forehead.y) - H * 0.5);

    // Base pizza (triangolo con crosta)
    ctx.fillStyle = '#f2c166';  // crosta
    ctx.beginPath();
    ctx.moveTo(-W / 2, 0);
    ctx.lineTo(W / 2, 0);
    ctx.lineTo(0, -H);
    ctx.closePath();
    ctx.fill();

    // Formaggio (interno più piccolo, giallo)
    ctx.fillStyle = '#ffda6a';
    ctx.beginPath();
    ctx.moveTo(-W * 0.42, -H * 0.08);
    ctx.lineTo(W * 0.42, -H * 0.08);
    ctx.lineTo(0, -H * 0.88);
    ctx.closePath();
    ctx.fill();

    // Salamini rossi
    ctx.fillStyle = '#c22b2b';
    const pepperoni = [
      { x: -W * 0.12, y: -H * 0.25, r: W * 0.07 },
      { x: W * 0.15, y: -H * 0.35, r: W * 0.06 },
      { x: 0, y: -H * 0.55, r: W * 0.06 },
      { x: -W * 0.08, y: -H * 0.72, r: W * 0.04 },
    ];
    pepperoni.forEach(p => {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });

    // Olive nere
    ctx.fillStyle = '#222';
    [[-W * 0.25, -H * 0.18], [W * 0.22, -H * 0.6], [W * 0.05, -H * 0.15]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.ellipse(x, y, W * 0.03, W * 0.02, 0, 0, Math.PI * 2); ctx.fill();
    });

    // Basilico verde
    ctx.fillStyle = '#2d7d2d';
    [[-W * 0.18, -H * 0.4], [W * 0.08, -H * 0.25]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.ellipse(x, y, W * 0.04, W * 0.02, 0.5, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  }

  // Mascella di squalo che circonda il viso
  _drawShark(ctx, g) {
    const W = g.faceW * 1.5;
    const H = g.faceH * 1.5;

    ctx.save();
    ctx.translate(g.cx, g.cy);
    ctx.rotate(g.roll);

    // Fauci grigio squalo (ellisse esterna)
    ctx.fillStyle = '#5a6670';
    ctx.beginPath();
    ctx.ellipse(0, 0, W / 2, H / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Gradient per effetto 3D
    const grad = ctx.createRadialGradient(0, 0, W * 0.3, 0, 0, W / 2);
    grad.addColorStop(0, 'rgba(90,102,112,0)');
    grad.addColorStop(1, 'rgba(30,40,50,0.8)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, W / 2, H / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Buco centrale (dove stai tu)
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.ellipse(0, 0, W * 0.32, H * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // Denti triangolari tutto intorno
    ctx.fillStyle = '#fff';
    const teeth = 18;
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const toothLen = W * 0.08;
      const rx = W * 0.34;
      const ry = H * 0.4;
      const x1 = Math.cos(a) * rx;
      const y1 = Math.sin(a) * ry;
      const x2 = Math.cos(a + 0.08) * rx;
      const y2 = Math.sin(a + 0.08) * ry;
      const xt = Math.cos(a + 0.04) * (rx - toothLen);
      const yt = Math.sin(a + 0.04) * (ry - toothLen);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(xt, yt);
      ctx.closePath();
      ctx.fill();
    }
    // Bordi denti
    ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, W * 0.34, H * 0.4, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Teschio hacker con occhiali da sole e matrice verde
  _drawHackerSkull(ctx, g) {
    const W = g.faceW * 1.1;
    const H = g.faceH * 1.1;

    ctx.save();
    ctx.translate(g.cx, g.cy);
    ctx.rotate(g.roll);
    ctx.scale(Math.cos(g.yaw), 1);

    // Teschio bianco osseo
    const grad = ctx.createRadialGradient(0, -H * 0.1, W * 0.1, 0, 0, W / 2);
    grad.addColorStop(0, '#f0ebd8');
    grad.addColorStop(1, '#8a8470');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, -H * 0.1, W * 0.48, H * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mandibola
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-W * 0.35, H * 0.15);
    ctx.quadraticCurveTo(-W * 0.25, H * 0.5, 0, H * 0.48);
    ctx.quadraticCurveTo(W * 0.25, H * 0.5, W * 0.35, H * 0.15);
    ctx.closePath();
    ctx.fill();

    // Occhiaie nere
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(-W * 0.17, -H * 0.1, W * 0.12, H * 0.13, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(W * 0.17, -H * 0.1, W * 0.12, H * 0.13, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Naso triangolare
    ctx.beginPath();
    ctx.moveTo(0, H * 0.02);
    ctx.lineTo(-W * 0.04, H * 0.1);
    ctx.lineTo(W * 0.04, H * 0.1);
    ctx.closePath();
    ctx.fill();

    // Denti
    ctx.fillStyle = '#fff';
    for (let i = -3; i <= 3; i++) {
      ctx.fillRect(i * W * 0.05 - W * 0.02, H * 0.25, W * 0.035, H * 0.08);
    }

    // Occhiali da sole hacker (sopra le occhiaie)
    ctx.fillStyle = '#000';
    ctx.fillRect(-W * 0.3, -H * 0.18, W * 0.6, H * 0.05);
    ctx.fillRect(-W * 0.3, -H * 0.18, W * 0.22, H * 0.12);
    ctx.fillRect(W * 0.08, -H * 0.18, W * 0.22, H * 0.12);
    // Riflesso verde (codice matrix)
    ctx.fillStyle = '#00ff44';
    ctx.font = `${W * 0.035}px monospace`;
    const t = Date.now() / 200 | 0;
    ctx.fillText(((t + 7) % 10) + '1' + ((t + 3) % 10), -W * 0.26, -H * 0.10);
    ctx.fillText('0' + ((t) % 10) + '1', W * 0.12, -H * 0.10);
    ctx.restore();
  }

  // Zucca di Halloween con volto intagliato
  _drawPumpkin(ctx, g) {
    const W = g.faceW * 1.4;
    const H = g.faceH * 1.3;

    ctx.save();
    ctx.translate(g.cx, g.cy);
    ctx.rotate(g.roll);

    // Corpo zucca arancione
    const grad = ctx.createRadialGradient(-W * 0.1, -H * 0.1, W * 0.1, 0, 0, W / 2);
    grad.addColorStop(0, '#ff9a3c');
    grad.addColorStop(1, '#d16400');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, W / 2, H / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Costolature verticali
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      const x = i * W * 0.15;
      ctx.moveTo(x, -H * 0.45);
      ctx.quadraticCurveTo(x * 1.3, 0, x, H * 0.45);
      ctx.stroke();
    }

    // Intagli neri (occhi + bocca) — buco dove stai tu
    ctx.fillStyle = '#000';
    // Occhi triangolari
    ctx.beginPath();
    ctx.moveTo(-W * 0.2, -H * 0.15);
    ctx.lineTo(-W * 0.05, -H * 0.15);
    ctx.lineTo(-W * 0.12, -H * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(W * 0.05, -H * 0.15);
    ctx.lineTo(W * 0.2, -H * 0.15);
    ctx.lineTo(W * 0.12, -H * 0.05);
    ctx.closePath();
    ctx.fill();
    // Bocca a zigzag
    ctx.beginPath();
    ctx.moveTo(-W * 0.25, H * 0.15);
    for (let i = 0; i < 5; i++) {
      ctx.lineTo(-W * 0.25 + i * W * 0.1 + W * 0.05, H * (0.3 - (i % 2) * 0.15));
      ctx.lineTo(-W * 0.25 + i * W * 0.1 + W * 0.1, H * 0.15);
    }
    ctx.lineTo(W * 0.25, H * 0.3);
    ctx.lineTo(-W * 0.25, H * 0.3);
    ctx.closePath();
    ctx.fill();

    // Glow interno (candela)
    const gglow = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.3);
    gglow.addColorStop(0, 'rgba(255,180,50,0.6)');
    gglow.addColorStop(1, 'rgba(255,180,50,0)');
    ctx.fillStyle = gglow;
    ctx.fillRect(-W * 0.3, -H * 0.2, W * 0.6, H * 0.5);
    ctx.restore();

    // Stelo verde sopra
    ctx.save();
    this._headTransform(ctx, g);
    ctx.translate(0, -(g.cy - g.forehead.y) - H * 0.55);
    ctx.fillStyle = '#3a6b1a';
    ctx.beginPath();
    ctx.moveTo(-W * 0.06, 0);
    ctx.lineTo(-W * 0.04, -W * 0.18);
    ctx.quadraticCurveTo(W * 0.06, -W * 0.25, W * 0.05, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Cervello rosa/grigio sopra la testa (con circonvoluzioni)
  _drawBrain(ctx, g) {
    const W = g.faceW * 1.15;
    const H = W * 0.7;

    ctx.save();
    this._headTransform(ctx, g);
    ctx.translate(0, -(g.cy - g.forehead.y) - H * 0.5);

    // Emisfero base rosa
    const grad = ctx.createRadialGradient(0, -H * 0.2, W * 0.1, 0, 0, W / 2);
    grad.addColorStop(0, '#ffc2cc');
    grad.addColorStop(1, '#d86b80');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, W / 2, H, 0, Math.PI, 0);
    ctx.fill();

    // Solco centrale (separa emisferi)
    ctx.strokeStyle = '#a04a5e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -H * 0.9);
    ctx.quadraticCurveTo(0, -H * 0.5, 0, 0);
    ctx.stroke();

    // Circonvoluzioni (linee curve)
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#b85c75';
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const y0 = -H * (0.2 + (i % 4) * 0.2);
      ctx.beginPath();
      ctx.moveTo(side * W * 0.05, y0);
      ctx.bezierCurveTo(
        side * W * 0.25, y0 - H * 0.1,
        side * W * 0.35, y0 + H * 0.05,
        side * W * 0.45, y0 - H * 0.05
      );
      ctx.stroke();
    }

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.ellipse(-W * 0.15, -H * 0.5, W * 0.1, H * 0.15, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Antenne d'ape con strisce gialle/nere sul viso
  _drawBee(ctx, g) {
    const W = g.faceW;
    ctx.save();
    this._headTransform(ctx, g, -(g.cy - g.forehead.y));

    // Due antenne a molla
    const antH = W * 0.55;
    const t = Date.now() / 300;
    [{ x: -W * 0.2, ph: 0 }, { x: W * 0.2, ph: 1 }].forEach(({ x, ph }) => {
      const sway = Math.sin(t + ph) * W * 0.05;
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.quadraticCurveTo(x * 1.3 + sway, -antH * 0.5, x * 1.4 + sway, -antH);
      ctx.stroke();
      // Pallina gialla in punta
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(x * 1.4 + sway, -antH, W * 0.055, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5;
      ctx.stroke();
    });
    ctx.restore();

    // Strisce gialle e nere sulle guance
    ctx.save();
    ctx.translate(g.cx, g.cy);
    ctx.rotate(g.roll);
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(-g.faceW * 0.4, g.faceH * 0.08, g.faceW * 0.8, g.faceH * 0.04);
    ctx.fillStyle = '#111';
    ctx.fillRect(-g.faceW * 0.4, g.faceH * 0.14, g.faceW * 0.8, g.faceH * 0.04);
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(-g.faceW * 0.4, g.faceH * 0.20, g.faceW * 0.8, g.faceH * 0.04);
    ctx.restore();
  }

  // Taco posizionato sulla bocca
  _drawTaco(ctx, g) {
    const cx = (g.upperLip.x + g.lowerLip.x) / 2;
    const cy = (g.upperLip.y + g.lowerLip.y) / 2;
    const W = g.faceW * 0.7;
    const H = W * 0.6;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(g.roll);
    ctx.scale(Math.cos(g.yaw), 1);

    // Tortilla dorata (arco)
    const grad = ctx.createLinearGradient(0, -H / 2, 0, H / 2);
    grad.addColorStop(0, '#f7c96a');
    grad.addColorStop(1, '#c68e3e');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-W / 2, H * 0.2);
    ctx.quadraticCurveTo(0, -H * 0.7, W / 2, H * 0.2);
    ctx.quadraticCurveTo(0, H * 0.4, -W / 2, H * 0.2);
    ctx.closePath();
    ctx.fill();

    // Ripieno: carne marrone
    ctx.fillStyle = '#6b3a1a';
    ctx.beginPath();
    ctx.ellipse(0, 0, W * 0.32, H * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Formaggio giallo
    ctx.fillStyle = '#ffe066';
    [-W * 0.2, -W * 0.05, W * 0.12, W * 0.22].forEach(x => {
      ctx.beginPath();
      ctx.arc(x, -H * 0.05, W * 0.04, 0, Math.PI * 2);
      ctx.fill();
    });

    // Lattuga verde
    ctx.fillStyle = '#4a9a3a';
    [-W * 0.15, 0, W * 0.15].forEach(x => {
      ctx.beginPath();
      ctx.ellipse(x, H * 0.08, W * 0.06, W * 0.02, 0.3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Pomodoro rosso
    ctx.fillStyle = '#d83636';
    [[W * 0.05, 0.05], [-W * 0.08, -0.02]].forEach(([x, yOff]) => {
      ctx.beginPath();
      ctx.arc(x, H * yOff, W * 0.035, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  // Dinosauro: corpo con denti + cresta
  _drawDino(ctx, g) {
    const W = g.faceW;
    ctx.save();
    this._headTransform(ctx, g, -(g.cy - g.forehead.y) * 0.6);

    // Cresta triangolare verde sulla testa
    ctx.fillStyle = '#3d8b3d';
    const spikes = 5;
    for (let i = 0; i < spikes; i++) {
      const x = -W * 0.3 + (i / (spikes - 1)) * W * 0.6;
      const h = W * (0.15 + (i % 2) * 0.1);
      ctx.beginPath();
      ctx.moveTo(x - W * 0.06, 0);
      ctx.lineTo(x, -h);
      ctx.lineTo(x + W * 0.06, 0);
      ctx.closePath();
      ctx.fill();
    }

    // Ombra spine
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    for (let i = 0; i < spikes; i++) {
      const x = -W * 0.3 + (i / (spikes - 1)) * W * 0.6;
      const h = W * (0.15 + (i % 2) * 0.1);
      ctx.beginPath();
      ctx.moveTo(x, -h);
      ctx.lineTo(x + W * 0.04, -h * 0.8);
      ctx.lineTo(x + W * 0.06, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Denti da T-Rex sulla bocca (sopra upperLip)
    ctx.save();
    ctx.translate((g.leftMouth.x + g.rightMouth.x) / 2, g.upperLip.y);
    ctx.rotate(g.roll);
    ctx.fillStyle = '#fff';
    const mouthW = Math.abs(g.rightMouth.x - g.leftMouth.x);
    for (let i = 0; i < 7; i++) {
      const x = -mouthW / 2 + (i / 6) * mouthW;
      const h = g.faceW * 0.04;
      ctx.beginPath();
      ctx.moveTo(x - g.faceW * 0.015, 0);
      ctx.lineTo(x, h);
      ctx.lineTo(x + g.faceW * 0.015, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  // Boccale di birra con schiuma sulla testa
  _drawBeer(ctx, g) {
    const W = g.faceW * 1.1;
    const H = W * 1.2;

    ctx.save();
    this._headTransform(ctx, g);
    ctx.translate(0, -(g.cy - g.forehead.y) - H * 0.5);

    // Boccale vetro (trasparente con bordo)
    ctx.fillStyle = 'rgba(255,220,100,0.85)';
    ctx.strokeStyle = 'rgba(200,160,50,0.8)';
    ctx.lineWidth = 3;

    // Corpo del boccale
    ctx.beginPath();
    ctx.moveTo(-W * 0.35, H * 0.1);
    ctx.lineTo(-W * 0.35, -H * 0.3);
    ctx.lineTo(W * 0.35, -H * 0.3);
    ctx.lineTo(W * 0.35, H * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Manico destro
    ctx.beginPath();
    ctx.moveTo(W * 0.35, -H * 0.22);
    ctx.quadraticCurveTo(W * 0.6, -H * 0.15, W * 0.6, 0);
    ctx.quadraticCurveTo(W * 0.58, H * 0.05, W * 0.35, H * 0);
    ctx.lineWidth = 6;
    ctx.stroke();

    // Righe verticali riflesso vetro
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    [-W * 0.2, -W * 0.05, W * 0.15].forEach(x => {
      ctx.beginPath();
      ctx.moveTo(x, -H * 0.25);
      ctx.lineTo(x, H * 0.05);
      ctx.stroke();
    });

    // Schiuma bianca frastagliata in cima
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(-W * 0.4, -H * 0.3);
    for (let i = 0; i <= 16; i++) {
      const x = -W * 0.4 + (i / 16) * W * 0.8;
      const y = -H * 0.3 - W * (0.05 + Math.sin(i * 1.7) * 0.06 + Math.random() * 0.03);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W * 0.4, -H * 0.3);
    ctx.closePath();
    ctx.fill();

    // Bolle nella schiuma
    ctx.fillStyle = 'rgba(240,240,240,0.7)';
    for (let i = 0; i < 6; i++) {
      const x = -W * 0.3 + Math.random() * W * 0.6;
      const y = -H * 0.35 - Math.random() * W * 0.08;
      ctx.beginPath();
      ctx.arc(x, y, W * 0.025, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bollicine dentro la birra
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    const t = Date.now() / 100;
    for (let i = 0; i < 8; i++) {
      const x = -W * 0.3 + (i * W * 0.08);
      const y = H * 0.1 - ((t + i * 30) % 100) / 100 * H * 0.4;
      ctx.beginPath();
      ctx.arc(x, y, W * 0.012, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Maschera robot con LED e antenne
  _drawRobot(ctx, g) {
    const W = g.faceW * 1.1;
    const H = g.faceH * 1.1;

    ctx.save();
    ctx.translate(g.cx, g.cy);
    ctx.rotate(g.roll);
    ctx.scale(Math.cos(g.yaw), 1);

    // Testa metallica grigia squadrata
    const grad = ctx.createLinearGradient(0, -H / 2, 0, H / 2);
    grad.addColorStop(0, '#b8c2cc');
    grad.addColorStop(0.5, '#8a95a0');
    grad.addColorStop(1, '#5a6470');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(-W * 0.45, -H * 0.5, W * 0.9, H, W * 0.08);
    ctx.fill();
    // Bordo
    ctx.strokeStyle = '#3a4550'; ctx.lineWidth = 2;
    ctx.stroke();

    // Occhi LED blu luminosi
    const t = Date.now() / 400;
    const glow = 0.7 + Math.sin(t) * 0.3;
    ctx.shadowColor = '#00ddff';
    ctx.shadowBlur = 15 * glow;
    ctx.fillStyle = '#00ddff';
    ctx.fillRect(-W * 0.25, -H * 0.15, W * 0.15, H * 0.06);
    ctx.fillRect(W * 0.1, -H * 0.15, W * 0.15, H * 0.06);
    ctx.shadowBlur = 0;

    // Griglia altoparlante bocca
    ctx.fillStyle = '#2a3540';
    ctx.fillRect(-W * 0.2, H * 0.15, W * 0.4, H * 0.1);
    ctx.fillStyle = '#1a2028';
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(-W * 0.18 + i * W * 0.07, H * 0.17, W * 0.03, H * 0.06);
    }

    // LED rosso di stato in fronte
    ctx.fillStyle = '#ff3333';
    ctx.shadowColor = '#ff3333';
    ctx.shadowBlur = 10 * (Math.sin(t * 3) * 0.5 + 0.5);
    ctx.beginPath();
    ctx.arc(0, -H * 0.35, W * 0.03, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Bulloni agli angoli
    ctx.fillStyle = '#3a4550';
    [[-W * 0.38, -H * 0.42], [W * 0.38, -H * 0.42], [-W * 0.38, H * 0.42], [W * 0.38, H * 0.42]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.arc(x, y, W * 0.025, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1a2028'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - W * 0.02, y); ctx.lineTo(x + W * 0.02, y); ctx.stroke();
    });
    ctx.restore();

    // Antenne sopra la testa con pallino lampeggiante
    ctx.save();
    this._headTransform(ctx, g, -(g.cy - g.forehead.y));
    const blink = (Math.sin(t * 4) > 0) ? '#ff3333' : '#660000';
    ctx.strokeStyle = '#5a6470'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-W * 0.15, 0);
    ctx.lineTo(-W * 0.15, -W * 0.25);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W * 0.15, 0);
    ctx.lineTo(W * 0.15, -W * 0.25);
    ctx.stroke();
    ctx.fillStyle = blink;
    ctx.shadowColor = blink; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(-W * 0.15, -W * 0.25, W * 0.03, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(W * 0.15, -W * 0.25, W * 0.03, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // Alieno verde con occhi enormi neri e antenne
  _drawAlien(ctx, g) {
    const W = g.faceW * 1.2;
    const H = g.faceH * 1.25;

    ctx.save();
    ctx.translate(g.cx, g.cy);
    ctx.rotate(g.roll);
    ctx.scale(Math.cos(g.yaw), 1);

    // Testa verde a goccia (larga in alto, stretta in basso)
    const grad = ctx.createRadialGradient(-W * 0.1, -H * 0.2, W * 0.1, 0, 0, W / 2);
    grad.addColorStop(0, '#a8e85a');
    grad.addColorStop(0.7, '#5ab02a');
    grad.addColorStop(1, '#3a7a1a');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-W * 0.45, -H * 0.25);
    ctx.quadraticCurveTo(-W * 0.55, -H * 0.5, -W * 0.3, -H * 0.5);
    ctx.quadraticCurveTo(0, -H * 0.58, W * 0.3, -H * 0.5);
    ctx.quadraticCurveTo(W * 0.55, -H * 0.5, W * 0.45, -H * 0.25);
    ctx.quadraticCurveTo(W * 0.25, H * 0.5, 0, H * 0.55);
    ctx.quadraticCurveTo(-W * 0.25, H * 0.5, -W * 0.45, -H * 0.25);
    ctx.closePath();
    ctx.fill();

    // Occhi neri a mandorla enormi
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.ellipse(-W * 0.18, -H * 0.1, W * 0.14, H * 0.22, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(W * 0.18, -H * 0.1, W * 0.14, H * 0.22, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Riflessi bianchi negli occhi
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.ellipse(-W * 0.23, -H * 0.18, W * 0.04, H * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(W * 0.13, -H * 0.18, W * 0.04, H * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();

    // Piccola bocca a linea
    ctx.strokeStyle = '#2a5a1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-W * 0.05, H * 0.25);
    ctx.quadraticCurveTo(0, H * 0.28, W * 0.05, H * 0.25);
    ctx.stroke();

    // Puntini nasali
    ctx.fillStyle = '#3a7a1a';
    ctx.beginPath(); ctx.arc(-W * 0.02, H * 0.1, W * 0.008, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(W * 0.02, H * 0.1, W * 0.008, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Antenne con palline pulsanti sopra la testa
    ctx.save();
    this._headTransform(ctx, g, -(g.cy - g.forehead.y));
    const t = Date.now() / 400;
    const pulse = 0.7 + Math.sin(t) * 0.3;
    [-W * 0.12, W * 0.12].forEach((x, i) => {
      ctx.strokeStyle = '#5ab02a'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.quadraticCurveTo(x * 1.5, -W * 0.15, x * 1.2, -W * 0.3);
      ctx.stroke();
      // Pallina verde chiaro luminosa
      ctx.fillStyle = `rgba(180,255,100,${pulse})`;
      ctx.shadowColor = '#a8e85a'; ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(x * 1.2, -W * 0.3, W * 0.04, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ─── Nuovi effetti ─────────────────────────────────────────────────────────
  _drawGlasses3D(ctx, g) {
    const eyeDist = g.eyeDist, lensR = eyeDist * 0.42, lensH = lensR * 0.78;
    ctx.save();
    ctx.translate(g.eyeMid.x, g.eyeMid.y);
    ctx.rotate(g.roll);
    ctx.scale(Math.cos(g.yaw), 1);
    // Montatura cartone bianca
    ctx.fillStyle = '#f4f4f4';
    ctx.strokeStyle = '#cfcfcf'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-eyeDist / 2 - lensR - 6, -lensH - 6, (eyeDist / 2 + lensR + 6) * 2, (lensH + 6) * 2, 8);
    ctx.fill(); ctx.stroke();
    // Lente sx rossa, dx ciano
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(230,40,40,0.62)';
    ctx.beginPath(); ctx.roundRect(-eyeDist / 2 - lensR, -lensH, lensR * 2, lensH * 2, 5); ctx.fill();
    ctx.fillStyle = 'rgba(40,200,230,0.62)';
    ctx.beginPath(); ctx.roundRect(eyeDist / 2 - lensR, -lensH, lensR * 2, lensH * 2, 5); ctx.fill();
    ctx.restore();
  }

  _drawThugLife(ctx, g) {
    const eyeDist = g.eyeDist, barH = eyeDist * 0.34;
    ctx.save();
    ctx.translate(g.eyeMid.x, g.eyeMid.y);
    ctx.rotate(g.roll);
    ctx.scale(Math.cos(g.yaw), 1);
    // Pixel art a blocchi: barra nera con bordo
    const w = eyeDist * 1.7, x0 = -w / 2;
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(x0, -barH / 2, w, barH);
    // Riflessi a scaletta (stile 8-bit)
    ctx.fillStyle = '#ffffff';
    const px = barH * 0.22;
    ctx.fillRect(x0 + px, -barH / 2 + px, px, px);
    ctx.fillRect(x0 + px * 2, -barH / 2 + px, px, px);
    ctx.fillRect(x0 + w * 0.55, -barH / 2 + px, px, px);
    ctx.fillRect(x0 + w * 0.55 + px, -barH / 2 + px, px, px);
    ctx.restore();
  }

  _drawHeartGlasses(ctx, g) {
    const eyeDist = g.eyeDist, s = eyeDist * 0.5;
    ctx.save();
    ctx.translate(g.eyeMid.x, g.eyeMid.y);
    ctx.rotate(g.roll);
    ctx.scale(Math.cos(g.yaw), 1);
    const heart = (cx, fill) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(cx, s * 0.35);
      ctx.bezierCurveTo(cx - s * 0.7, -s * 0.1, cx - s * 0.4, -s * 0.6, cx, -s * 0.25);
      ctx.bezierCurveTo(cx + s * 0.4, -s * 0.6, cx + s * 0.7, -s * 0.1, cx, s * 0.35);
      ctx.fill();
    };
    heart(-eyeDist / 2, 'rgba(255,80,140,0.78)');
    heart(eyeDist / 2, 'rgba(255,80,140,0.78)');
    // Ponte + riflessi
    ctx.strokeStyle = '#ff4f8b'; ctx.lineWidth = 4; ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.moveTo(-eyeDist / 2 + s * 0.35, -s * 0.15); ctx.lineTo(eyeDist / 2 - s * 0.35, -s * 0.15); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.ellipse(-eyeDist / 2 - s * 0.18, -s * 0.18, s * 0.12, s * 0.07, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  _drawMonocle(ctx, g) {
    const eyeDist = g.eyeDist, r = eyeDist * 0.36;
    ctx.save();
    ctx.translate(g.rightEye.x, g.rightEye.y);
    ctx.rotate(g.roll);
    // Lente trasparente con bordo oro
    ctx.fillStyle = 'rgba(220,235,255,0.18)';
    ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Riflesso
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.3, r * 0.22, r * 0.12, -0.4, 0, Math.PI * 2); ctx.fill();
    // Catenella
    ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, r); ctx.quadraticCurveTo(r * 0.6, r * 2, r * 0.2, r * 2.6); ctx.stroke();
    ctx.restore();
  }

  _drawEyepatch(ctx, g) {
    const eyeDist = g.eyeDist, r = eyeDist * 0.34;
    ctx.save();
    ctx.translate(g.leftEye.x, g.leftEye.y);
    ctx.rotate(g.roll);
    ctx.scale(Math.cos(g.yaw), 1);
    // Cinghia attraverso la testa
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = eyeDist * 0.12;
    ctx.beginPath();
    ctx.moveTo(-eyeDist * 1.6, -r * 1.4); ctx.lineTo(eyeDist * 1.2, r * 1.4); ctx.stroke();
    // Toppa
    const grd = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.2, 0, 0, r * 1.2);
    grd.addColorStop(0, '#2a2a2a'); grd.addColorStop(1, '#080808');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  _drawGraduation(ctx, g) {
    const W = g.faceW;
    ctx.save();
    this._headTransform(ctx, g, -(g.cy - g.forehead.y) - W * 0.18);
    // Calotta
    ctx.fillStyle = '#16161c';
    ctx.beginPath(); ctx.ellipse(0, W * 0.12, W * 0.42, W * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    // Tavoletta (rombo prospettico)
    ctx.fillStyle = '#0d0d12';
    ctx.beginPath();
    ctx.moveTo(0, -W * 0.12); ctx.lineTo(W * 0.62, W * 0.06);
    ctx.lineTo(0, W * 0.24); ctx.lineTo(-W * 0.62, W * 0.06); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();
    // Bottone + nappa
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#e8c14a';
    ctx.beginPath(); ctx.arc(0, W * 0.06, W * 0.04, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e8c14a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, W * 0.06); ctx.lineTo(W * 0.5, W * 0.1); ctx.lineTo(W * 0.5, W * 0.42); ctx.stroke();
    for (let i = 0; i < 7; i++) {
      ctx.beginPath(); ctx.moveTo(W * 0.5, W * 0.36); ctx.lineTo(W * (0.46 + i * 0.013), W * 0.5); ctx.stroke();
    }
    ctx.restore();
  }

  _drawViking(ctx, g) {
    const W = g.faceW;
    ctx.save();
    this._headTransform(ctx, g, -(g.cy - g.forehead.y) - W * 0.05);
    // Calotta metallica
    const grd = ctx.createLinearGradient(0, -W * 0.45, 0, W * 0.1);
    grd.addColorStop(0, '#cfd6dd'); grd.addColorStop(0.5, '#8a949e'); grd.addColorStop(1, '#5a626b');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(0, 0, W * 0.46, Math.PI, 0); ctx.lineTo(W * 0.46, W * 0.05); ctx.lineTo(-W * 0.46, W * 0.05); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#3f454c'; ctx.lineWidth = 3; ctx.stroke();
    // Banda centrale + rivetti
    ctx.fillStyle = '#6b727a';
    ctx.fillRect(-W * 0.04, -W * 0.45, W * 0.08, W * 0.5);
    // Corna
    const horn = (dir) => {
      ctx.save(); ctx.scale(dir, 1);
      const hg = ctx.createLinearGradient(W * 0.4, 0, W * 0.8, -W * 0.4);
      hg.addColorStop(0, '#f3ead2'); hg.addColorStop(1, '#cbb98e');
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.moveTo(W * 0.4, -W * 0.1);
      ctx.quadraticCurveTo(W * 0.85, -W * 0.2, W * 0.78, -W * 0.62);
      ctx.quadraticCurveTo(W * 0.6, -W * 0.3, W * 0.42, -W * 0.28);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    };
    horn(1); horn(-1);
    ctx.restore();
  }

  _drawHeadphones(ctx, g) {
    const W = g.faceW;
    ctx.save();
    this._headTransform(ctx, g, -(g.cy - g.forehead.y) + W * 0.05);
    // Archetto
    ctx.strokeStyle = '#1c1c22'; ctx.lineWidth = W * 0.08; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, W * 0.05, W * 0.52, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    // Padiglioni
    ctx.shadowBlur = g.faceW * 0.03;
    [-1, 1].forEach(dir => {
      const cx = dir * W * 0.52;
      const grd = ctx.createRadialGradient(cx - dir * W * 0.05, W * 0.32, W * 0.02, cx, W * 0.32, W * 0.22);
      grd.addColorStop(0, '#3a3a44'); grd.addColorStop(1, '#15151a');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.ellipse(cx, W * 0.32, W * 0.16, W * 0.22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#444';
      ctx.beginPath(); ctx.ellipse(cx, W * 0.32, W * 0.08, W * 0.13, 0, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  }

  _drawFlowerCrown(ctx, g) {
    const W = g.faceW;
    ctx.save();
    this._headTransform(ctx, g, -(g.cy - g.forehead.y) + W * 0.1);
    const cols = ['#ff6f91', '#ffd166', '#9b5de5', '#ff9770', '#f7f0ff', '#ff70a6'];
    const n = 9;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const ang = Math.PI * (1.08 - t * 1.16);
      const x = Math.cos(ang) * W * 0.5;
      const y = -Math.sin(ang) * W * 0.34;
      const r = W * (0.06 + (i % 2) * 0.02);
      ctx.fillStyle = cols[i % cols.length];
      for (let p = 0; p < 5; p++) {
        const pa = (p / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(pa) * r * 0.6, y + Math.sin(pa) * r * 0.6, r * 0.5, r * 0.32, pa, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#fff3b0'; ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(x, y, r * 0.32, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = g.faceW * 0.05;
    }
    ctx.restore();
  }

  _drawTiara(ctx, g) {
    const W = g.faceW;
    ctx.save();
    this._headTransform(ctx, g, -(g.cy - g.forehead.y) + W * 0.12);
    // Base arcuata oro
    const grd = ctx.createLinearGradient(0, -W * 0.1, 0, W * 0.05);
    grd.addColorStop(0, '#ffe9a8'); grd.addColorStop(0.5, '#e8c14a'); grd.addColorStop(1, '#b8902a');
    ctx.fillStyle = grd; ctx.strokeStyle = '#a87f1f'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-W * 0.34, 0);
    ctx.quadraticCurveTo(0, W * 0.06, W * 0.34, 0);
    ctx.lineTo(W * 0.34, W * 0.05);
    ctx.quadraticCurveTo(0, W * 0.11, -W * 0.34, W * 0.05);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Punte con gemme
    const peaks = [-0.26, 0, 0.26];
    peaks.forEach((px, i) => {
      const h = i === 1 ? W * 0.22 : W * 0.15;
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(W * px - W * 0.05, 0); ctx.lineTo(W * px, -h); ctx.lineTo(W * px + W * 0.05, 0); ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = i === 1 ? '#ff5d8f' : '#5ec8ff';
      ctx.beginPath(); ctx.arc(W * px, -h * 0.55, W * 0.04, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = g.faceW * 0.05;
    });
    ctx.restore();
  }

  _drawCatPet(ctx, g) {
    const W = g.faceW;
    const t = Date.now() / 1000;
    const fur = '#3a3a44', furDark = '#2a2a32', inner = '#ffb0c0';

    // ── Coda animata: arco che spunta dietro la testa e ondeggia ──
    ctx.save();
    this._headTransform(ctx, g, 0);
    const sway = Math.sin(t * 2.2) * W * 0.22;     // oscillazione laterale
    const curl = Math.cos(t * 2.2) * W * 0.10;     // arricciamento punta
    const baseX = W * 0.5, baseY = -W * 0.1;       // attacco dietro l'orecchio dx
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // Corpo coda (linea spessa con gradiente)
    const grd = ctx.createLinearGradient(baseX, baseY, baseX + sway, baseY - W * 0.9);
    grd.addColorStop(0, furDark); grd.addColorStop(1, fur);
    ctx.strokeStyle = grd;
    ctx.lineWidth = W * 0.13;
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.bezierCurveTo(
      baseX + W * 0.25, baseY - W * 0.35,
      baseX + sway, baseY - W * 0.7,
      baseX + sway + curl, baseY - W * 0.95
    );
    ctx.stroke();
    // Punta chiara
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#d8d8e0';
    ctx.lineWidth = W * 0.1;
    ctx.beginPath();
    ctx.moveTo(baseX + sway * 0.9, baseY - W * 0.82);
    ctx.lineTo(baseX + sway + curl, baseY - W * 0.97);
    ctx.stroke();
    ctx.restore();

    // ── Orecchie sulla testa ──
    ctx.save();
    this._headTransform(ctx, g, -(g.cy - g.forehead.y));
    const earW = W * 0.26, earH = W * 0.34, offX = W * 0.26;
    [-1, 1].forEach(dir => {
      ctx.fillStyle = fur;
      ctx.beginPath();
      ctx.moveTo(dir * offX - earW / 2, earH * 0.3);
      ctx.lineTo(dir * offX, -earH);
      ctx.lineTo(dir * offX + earW / 2, earH * 0.3);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = inner; ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(dir * offX - earW * 0.22, earH * 0.08);
      ctx.lineTo(dir * offX, -earH * 0.65);
      ctx.lineTo(dir * offX + earW * 0.22, earH * 0.08);
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = W * 0.05;
    });
    ctx.restore();

    // ── Naso + baffi ──
    ctx.save();
    ctx.translate(g.noseTip.x, g.noseTip.y);
    ctx.rotate(g.roll);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ff7a9a';
    ctx.beginPath();
    ctx.moveTo(0, W * 0.03); ctx.lineTo(-W * 0.035, -W * 0.015); ctx.lineTo(W * 0.035, -W * 0.015);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2;
    [[-1, -0.03], [-1, 0.02], [1, -0.03], [1, 0.02]].forEach(([dir, yy]) => {
      ctx.beginPath();
      ctx.moveTo(dir * W * 0.04, W * yy);
      ctx.quadraticCurveTo(dir * W * 0.18, W * (yy - 0.01), dir * W * 0.26, W * (yy + 0.02));
      ctx.stroke();
    });
    ctx.restore();
  }

  // ─── API pubblica ─────────────────────────────────────────────────────────
  setEffect(id) {
    if (id === 'none' || !id) { this.active = null; return; }
    this.active = id;
  }

  getCurrent() { return this.active; }
  getOutputTrack() { return this.outputStream?.getVideoTracks()[0] || null; }

  _stopPipeline() {
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    if (this.sourceVideo) {
      this.sourceVideo.srcObject = null;
      this.sourceVideo.remove();
      this.sourceVideo = null;
    }
    if (this._sourceTrackClone) {
      try { this._sourceTrackClone.stop(); } catch { }
      this._sourceTrackClone = null;
    }
    if (this.outputStream) {
      this.outputStream.getTracks().forEach(t => t.stop());
      this.outputStream = null;
    }
  }

  stop() {
    this._stopPipeline();
    this.active = null;
    this.style = 'none';
    this._styleFilter = 'none';
    this.lastLandmarks = null;
  }
}

window.FaceEffects = FaceEffects;