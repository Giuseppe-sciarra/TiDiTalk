'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   FaceAR — effetti viso 3D (1.7.0)
   ───────────────────────────────────────────────────────────────────────────
   Motore nuovo per gli effetti "come Meet": cappelli, occhiali, parrucche,
   personaggi animati e maschere dipinte sulla pelle.

   • MediaPipe Face Landmarker (tasks-vision): per ogni fotogramma dà i 468
     punti del viso, la MATRICE 3D della testa (posizione + rotazione in cm) e
     52 "blendshape" (bocca aperta, occhi chiusi, sopracciglia…).
   • three.js disegna la scena 3D sopra il video: la testa vera fa da
     "occlusore" (si disegna solo nella profondità) così quello che sta dietro
     — la parte posteriore di un cappello, le stanghette degli occhiali —
     sparisce dietro la testa come nella realtà.
   • Le maschere dipinte sono una texture sulla mesh del viso, che segue
     l'espressione: i 468 punti rilevati muovono i vertici (bocca che si apre,
     sorriso) mentre la profondità viene dal modello rigido.
   • I modelli stanno in /assets/effects3d/{models,hair,chars,paints}/<id>.js
     (moduli ES, scritti in casa) e si caricano solo quando servono.

   Tutto gira nel browser, niente lascia il computer.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  const VENDOR = '/assets/vendor';
  const FX = '/assets/effects3d';
  const FOV_DEG = 63;              // camera "metrica" di MediaPipe Face Geometry (verticale)
  let _libs = null;                // { THREE, GLTFLoader, RoomEnvironment, BufferGeometryUtils, vision }
  let _facemesh = null;            // { pos, uv, idx } del modello canonico (468 punti)

  async function loadLibs() {
    if (_libs) return _libs;
    const [THREE, gltf, env, bgu, fm] = await Promise.all([
      import(`${VENDOR}/three/three.module.js`),
      import(`${VENDOR}/three/jsm/loaders/GLTFLoader.js`),
      import(`${VENDOR}/three/jsm/environments/RoomEnvironment.js`),
      import(`${VENDOR}/three/jsm/utils/BufferGeometryUtils.js`),
      fetch(`${FX}/facemesh.json`).then(r => { if (!r.ok) throw new Error('facemesh.json mancante'); return r.json(); }),
    ]);
    _facemesh = fm;
    _libs = { THREE, GLTFLoader: gltf.GLTFLoader, RoomEnvironment: env.RoomEnvironment, BufferGeometryUtils: bgu };
    return _libs;
  }

  /* ── Tracker: Face Landmarker in un Web Worker (fuori dalla pagina) ────────
     Caricare il modello e analizzare i fotogrammi è il lavoro pesante: nel
     worker non blocca la pagina (connessione col server, chat, video). Se il
     browser non ha i worker a moduli si ricade sul thread principale.
     L'ultimo risultato è in tracker.latest = { lms, mtx, bs, names, ts }. */
  /* MediaPipe vecchio (effetti classici, sfondi) e nuovo (Tasks, effetti 3D) usano la
     stessa variabile globale "Module" mentre si caricano sulla pagina: il nuovo la svuota
     a fine caricamento e il vecchio, se sta scaricando i suoi file in quel momento, si
     rompe ("Module.dataFileDownloads"). Succede solo quando il rilevamento 3D gira sulla
     pagina (Safari prima della 17: niente WebGL nel worker). I caricamenti si mettono in
     fila: uno alla volta, al massimo 60 s di attesa per quello prima. */
  let _mpQueue = Promise.resolve();
  window.tdMediapipeLock = (fn) => {
    const prev = Promise.race([_mpQueue, new Promise(r => setTimeout(r, 60000))]);
    const run = prev.then(() => fn());
    _mpQueue = run.catch(() => { });
    return run;
  };

  const tracker = {
    mode: null, delegate: null, worker: null, lm: null, busy: false, latest: null, version: 0, names: null,
    initMs: 0, cost: 0, _init: null, failed: null,
    init() {
      if (this._init) return this._init;
      const pref = window.__faceArDelegate || 'GPU';      // i test (senza GPU vera) forzano CPU
      const t0 = performance.now();
      this._init = (async () => {
        if (typeof Worker !== 'undefined' && typeof createImageBitmap === 'function' && !window.__faceArNoWorker) {
          try {
            await new Promise((resolve, reject) => {
              const w = new Worker('/assets/js/faceAR-worker.js', { type: 'module' });
              const to = setTimeout(() => { w.terminate(); reject(new Error('timeout worker')); }, 90000);
              w.onerror = (ev) => { clearTimeout(to); w.terminate(); reject(new Error(ev.message || 'worker')); };
              w.onmessage = (ev) => {
                const m = ev.data || {};
                if (m.type === 'ready') { clearTimeout(to); this.worker = w; this.mode = 'worker'; this.delegate = m.delegate; w.onmessage = (e2) => this._onResult(e2.data); w.onerror = null; resolve(); }
                else if (m.type === 'error') { clearTimeout(to); w.terminate(); reject(new Error(m.message)); }
              };
              w.postMessage({ type: 'init', base: location.origin + VENDOR, delegate: pref });
            });
          } catch (e) { console.warn('[FaceAR] worker non disponibile, rilevamento sulla pagina:', e?.message); }
        }
        if (!this.mode) await window.tdMediapipeLock(async () => {
          const vision = await import(`${VENDOR}/mediapipe_tasks/vision_bundle.mjs`);
          const fileset = await vision.FilesetResolver.forVisionTasks(`${VENDOR}/mediapipe_tasks/wasm`);
          // un canvas della pagina per la grafica di MediaPipe: quello che si crea da solo
          // (OffscreenCanvas) in Safari prima della 17 non ha WebGL e il viso non si trova mai
          const make = (d) => vision.FaceLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: `${VENDOR}/mediapipe_tasks/face_landmarker.task`, delegate: d },
            runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true,
            canvas: document.createElement('canvas'),
          });
          try { this.lm = await make(pref); this.delegate = pref; }
          catch (e) { this.lm = await make('CPU'); this.delegate = 'CPU'; }
          this.mode = 'main';
        });
        this.initMs = Math.round(performance.now() - t0);
        console.log(`[FaceAR] rilevamento pronto: ${this.mode}/${this.delegate} in ${this.initMs} ms`);
      })().catch(e => { this.failed = e; this._init = null; throw e; });
      return this._init;
    },
    // Su CPU l'immagine si analizza più piccola (max 480 px): 5-6 volte meno lavoro.
    // I punti escono normalizzati (0..1), quindi la misura non cambia niente.
    _size(src) {
      const sw = src.videoWidth || src.width, sh = src.videoHeight || src.height;
      const max = this.delegate === 'CPU' ? 640 : 960;
      return sw > max ? [max, Math.round(sh * max / sw)] : [sw, sh];
    },
    /** Manda un fotogramma (se il precedente è già tornato). */
    push(src, ts) {
      if (!this.mode || this.busy) return;
      const [w, h] = this._size(src);
      if (!w || !h) return;
      this.busy = true; const t0 = performance.now();
      if (this.mode === 'worker') {
        createImageBitmap(src, { resizeWidth: w, resizeHeight: h, resizeQuality: 'low' })
          .then(bmp => this.worker.postMessage({ type: 'frame', bitmap: bmp, ts }, [bmp]))
          .catch(() => { this.busy = false; });
        this._sentAt = t0;
        return;
      }
      // thread principale
      let input = src;
      if (w !== (src.videoWidth || src.width)) {
        if (!this._small) { this._small = document.createElement('canvas'); this._sctx = this._small.getContext('2d', { willReadFrequently: true }); }
        if (this._small.width !== w || this._small.height !== h) { this._small.width = w; this._small.height = h; }
        this._sctx.drawImage(src, 0, 0, w, h); input = this._sctx.getImageData(0, 0, w, h);
      }
      let res = null;
      try { res = this.lm.detectForVideo(input, ts); } catch (_) { }
      const L = res?.faceLandmarks?.[0], X = res?.facialTransformationMatrixes?.[0]?.data, B = res?.faceBlendshapes?.[0]?.categories;
      const out = { ts, lms: null, mtx: null, bs: null, cost: performance.now() - t0 };
      if (L && X) {
        out.lms = new Float32Array(L.length * 3); for (let i = 0; i < L.length; i++) { out.lms[i * 3] = L[i].x; out.lms[i * 3 + 1] = L[i].y; out.lms[i * 3 + 2] = L[i].z; }
        out.mtx = X; if (B) { if (!this.names) out.names = B.map(c => c.categoryName); out.bs = B.map(c => c.score); }
      }
      this._onResult(out);
    },
    _onResult(m) {
      if (m.names) this.names = m.names;
      this.cost = m.cost || 0;
      if (this._sentAt) this.roundTrip = performance.now() - this._sentAt;
      this.latest = { ts: m.ts, lms: m.lms, mtx: m.mtx, bs: m.bs };
      this.version++;
      this.busy = false;
    },
  };

  // nomi dei 52 blendshape ARKit (li usa anche MediaPipe) + alias comodi
  const BS_ALIAS = { smile: ['mouthSmileLeft', 'mouthSmileRight'], blink: ['eyeBlinkLeft', 'eyeBlinkRight'], browUp: ['browInnerUp', 'browOuterUpLeft', 'browOuterUpRight'] };

  class FaceAR {
    constructor() {
      this.canvas = null; this.renderer = null; this.scene = null; this.camera = null;
      this.width = 0; this.height = 0;
      this.faceGroup = null;        // segue la testa (matrice MediaPipe)
      this.faceMesh = null;         // mesh del viso deformata dai 468 punti (occlusore + pittura)
      this.skull = null;            // ellissoide dietro al viso (occlusore)
      this.effect = null;           // { def, group?, update?, hideHead, paintTex? }
      this.bs = {};                 // blendshape correnti (0..1), lisciati
      this.tracking = false;        // viso trovato nell'ultimo fotogramma
      this._smooth = null;
      this._t0 = performance.now();
      this.ready = false;
      this.renderScale = 1; this._costN = 0; this._costAvg = null;
      this.fps = 0; this._fpsN = 0; this._fpsT = 0;
    }

    async init(width, height) {
      const T = [performance.now()]; const mark = (k) => { T.push(performance.now()); this.timings[k] = Math.round(T[T.length - 1] - T[T.length - 2]); };
      this.timings = {};
      const { THREE, RoomEnvironment } = await loadLibs(); mark('libs');
      await tracker.init(); mark('landmarker');
      await new Promise(r => setTimeout(r, 0));   // lascia respirare la pagina fra un passo pesante e l'altro
      this.width = width; this.height = height;
      this.canvas = document.createElement('canvas');
      this.canvas.width = width; this.canvas.height = height;
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(width, height, false);
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      mark('renderer');
      await new Promise(r => setTimeout(r, 0));
      this.scene = new THREE.Scene();
      // riflessi morbidi per oro/metallo/vetro: mappa d'ambiente piccola (64 px),
      // costa pochi millisecondi anche sui PC deboli
      // (saltata se già creare il renderer è stato lento: macchina debole, bastano le luci)
      if (this.timings.renderer < 1500) {
        try { const pm = new THREE.PMREMGenerator(this.renderer); this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04, 0.1, 100, { size: 64 }).texture; pm.dispose(); } catch (_) { }
      }
      mark('envmap');
      this.scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.1));
      const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(3, 6, 10); this.scene.add(key);
      const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(-5, 2, 6); this.scene.add(fill);
      this.camera = new THREE.PerspectiveCamera(FOV_DEG, width / height, 1, 1000);
      this.camera.position.set(0, 0, 0);

      // gruppo che segue la testa: matrice impostata a mano ogni fotogramma
      this.faceGroup = new THREE.Group();
      this.faceGroup.matrixAutoUpdate = false;
      this.scene.add(this.faceGroup);

      // viso: geometria con i vertici che aggiorno io (spazio camera, non nel gruppo)
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(_facemesh.pos), 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(_facemesh.uv), 2));
      geo.setIndex(_facemesh.idx);
      geo.computeVertexNormals();
      this.faceMat = new THREE.MeshStandardMaterial({ colorWrite: false, depthWrite: true, roughness: .7, transparent: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
      this.faceMesh = new THREE.Mesh(geo, this.faceMat);
      this.faceMesh.renderOrder = -2; this.faceMesh.frustumCulled = false;
      this.scene.add(this.faceMesh);
      // cranio: solo profondità, dietro al viso
      this.skull = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true }));
      this.skull.scale.set(7.4, 8.9, 7.5); this.skull.position.set(0, 1.5, -3.8);
      this.skull.renderOrder = -3;
      this.faceGroup.add(this.skull);
      // collo e spalle (solo profondità): i capelli lunghi e il retro delle
      // parrucche passano DIETRO al corpo invece di coprire il collo e il petto
      const occ = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true });
      this.neck = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.6, 10, 24), occ); this.neck.position.set(0, -12, -1.5); this.neck.renderOrder = -3;
      this.body = new THREE.Mesh(new THREE.BoxGeometry(34, 10, 12), occ); this.body.position.set(0, -20, -2); this.body.renderOrder = -3;
      this.faceGroup.add(this.neck, this.body);
      this.faceMesh.matrixAutoUpdate = false;
      this._tmp = { v: new THREE.Vector3(), m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3() };
      this.ready = true; mark('scene');
      console.log('[FaceAR] pronto', JSON.stringify(this.timings));
    }

    resize(width, height) {
      if (!this.renderer || (width === this.width && height === this.height)) return;
      this.width = width; this.height = height;
      this._applyScale();
      this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
    }
    // Il 3D si disegna a una risoluzione che si adatta alla macchina: piena
    // finché un fotogramma costa poco, poi 3/4 e 1/2 (il canvas finale resta
    // della misura del video, il 3D viene solo un po' più morbido).
    _applyScale() {
      const s = this.renderScale || 1;
      const w = Math.max(2, Math.round(this.width * s)), h = Math.max(2, Math.round(this.height * s));
      if (this.canvas.width === w && this.canvas.height === h) return;
      this.renderer.setSize(w, h, false);
    }

    // helper passati ai moduli degli effetti (stessi del banco di prova)
    _helpers() {
      const { THREE, GLTFLoader, BufferGeometryUtils } = _libs;
      const fm = _facemesh;
      return {
        THREE, GLTFLoader, BufferGeometryUtils, face: fm,
        lm: (i) => new THREE.Vector3(fm.pos[i * 3], fm.pos[i * 3 + 1], fm.pos[i * 3 + 2]),
        ANCHORS: FaceAR.ANCHORS,
        mat: (color, opt = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .6, metalness: 0 }, opt)),
        base: FX,
      };
    }
    _uvHelpers(ctx, size) {
      const fm = _facemesh;
      const h = {
        uv: (i) => [fm.uv[i * 2] * size, (1 - fm.uv[i * 2 + 1]) * size], ANCHORS: FaceAR.ANCHORS, size,
        poly: (ids) => { ctx.beginPath(); ids.forEach((i, k) => { const [x, y] = h.uv(i); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); },
      };
      Object.assign(h, FaceAR.CONTOURS);
      return h;
    }

    /** Carica e monta un effetto del catalogo 3D. def = { id, type: 'model'|'hair'|'char'|'paint'|'glb', path } */
    async setEffect(def) {
      this.clearEffect();
      if (!def) return;
      const { THREE } = _libs;
      const h = this._helpers();
      const eff = { def, group: null, update: null, hideHead: false, paintTex: null };
      if (def.type === 'paint') {
        const mod = await import(`${FX}/${def.path}`);
        const size = 1024;
        const c = document.createElement('canvas'); c.width = c.height = size;
        const ctx = c.getContext('2d');
        await mod.default(ctx, size, this._uvHelpers(ctx, size));
        const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
        eff.paintTex = tex;
        this.faceMat.map = tex; this.faceMat.colorWrite = true; this.faceMat.needsUpdate = true;
        if (mod.update) eff.update = (bs, t) => mod.update(ctx, size, bs, t, this._uvHelpers(ctx, size)) && (tex.needsUpdate = true);
      } else if (def.type === 'glb') {
        const gltf = await new _libs.GLTFLoader().loadAsync(`${FX}/${def.path}`);
        const g = gltf.scene; const box = new THREE.Box3().setFromObject(g); const sz = new THREE.Vector3(); box.getSize(sz); const c = new THREE.Vector3(); box.getCenter(c);
        g.position.sub(c);
        const wrap = new THREE.Group(); wrap.add(g);
        wrap.scale.setScalar(def.scale || (16 / Math.max(sz.x, sz.y, sz.z)));
        if (def.pos) wrap.position.set(...def.pos);
        if (def.rot) wrap.rotation.set(...def.rot.map(d => d * Math.PI / 180));
        eff.group = wrap; eff.hideHead = !!def.hideHead;
        this.faceGroup.add(wrap);
      } else {
        const mod = await import(`${FX}/${def.path}`);
        const g = await mod.default(THREE, h);
        eff.group = g; eff.hideHead = !!mod.hideHead;
        if (mod.update) eff.update = (bs, t) => mod.update(g, bs, t, h);
        this.faceGroup.add(g);
      }
      // shader compilati in parallelo (KHR_parallel_shader_compile dove c'è):
      // cambiare effetto non blocca la pagina
      try { if (this.renderer.compileAsync) await this.renderer.compileAsync(this.scene, this.camera); } catch (_) { }
      // i personaggi che coprono tutta la testa non vogliono l'occlusore
      this.skull.visible = this.neck.visible = this.body.visible = !eff.hideHead;
      this.faceMesh.visible = !eff.hideHead || def.type === 'paint';
      this.effect = eff;
    }

    clearEffect() {
      const e = this.effect; if (!e) return;
      if (e.group) { this.faceGroup.remove(e.group); FaceAR.dispose(e.group); }
      if (e.paintTex) { e.paintTex.dispose(); this.faceMat.map = null; this.faceMat.colorWrite = false; this.faceMat.needsUpdate = true; }
      this.skull.visible = this.neck.visible = this.body.visible = true; this.faceMesh.visible = true;
      this.effect = null;
    }

    /** Manda il fotogramma al rilevamento e applica l'ultimo risultato arrivato.
     *  Ritorna true se il viso è tracciato. */
    detect(source, nowMs) {
      if (!tracker.mode || !this.ready) return false;
      tracker.push(source, nowMs);
      if (tracker.version === this._seen) return this.tracking;
      this._seen = tracker.version;
      const r = tracker.latest;
      if (!r || !r.lms || !r.mtx) { this._lost(); return false; }
      this._applyMatrix(r.mtx, r.ts);
      this._applyLandmarks(r.lms);
      if (r.bs && tracker.names) {
        const k = this.tracking ? 0.55 : 1;
        for (let i = 0; i < r.bs.length; i++) { const n = tracker.names[i]; this.bs[n] = (this.bs[n] || 0) * (1 - k) + r.bs[i] * k; }
        for (const [a, names] of Object.entries(BS_ALIAS)) this.bs[a] = names.reduce((s, n) => s + (this.bs[n] || 0), 0) / names.length;
      }
      this.tracking = true;
      return true;
    }
    _lost() {
      // viso perso: tengo l'ultima posa per qualche istante, poi nascondo
      if (this.tracking) { this._lostAt = performance.now(); this.tracking = false; }
    }

    // Posa misurata (MediaPipe, matrice per colonne come three.js: errore di
    // riproiezione ~3 px con la camera a 63° di apertura verticale).
    // Si tengono le ultime due misure con il loro istante: in render() la posa
    // viene PREDETTA all'istante del fotogramma da disegnare, così il cappello
    // non resta indietro quando si muove la testa e il rilevamento è più lento
    // del video (PC deboli, rilevamento su CPU).
    _applyMatrix(data, ts) {
      const { THREE } = _libs;
      const m = new THREE.Matrix4().fromArray(data);
      const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
      m.decompose(p, q, sc);
      this._prev = this._meas || null;
      this._meas = { m, p, q, s: sc, ts };
      if (this._prev && (ts - this._prev.ts > 400 || ts <= this._prev.ts)) this._prev = null;   // misure troppo distanti: niente velocità
    }

    _predictPose(nowMs) {
      const { THREE } = _libs;
      const a = this._meas; if (!a) return null;
      const out = this._pred || (this._pred = { p: new THREE.Vector3(), q: new THREE.Quaternion() });
      out.p.copy(a.p); out.q.copy(a.q);
      const b = this._prev;
      if (b) {
        const dtM = a.ts - b.ts;
        const ahead = Math.min(Math.max(nowMs - a.ts, 0), 160);          // al massimo 160 ms nel futuro
        const f = ahead / dtM;
        out.p.addScaledVector(this._tmp.v.subVectors(a.p, b.p), f * 0.85);
        // rotazione: stessa velocità angolare dell'ultimo intervallo
        const dq = this._tmp.q.copy(b.q).invert().premultiply(a.q);     // a = dq · b
        let ang = 2 * Math.acos(Math.min(1, Math.abs(dq.w)));
        if (ang > 1e-4 && ang < 0.6) {
          const axis = this._tmp.p.set(dq.x, dq.y, dq.z).normalize(); if (dq.w < 0) axis.negate();
          out.q.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, ang * f * 0.85));
        }
      }
      return out;
    }

    // vertici del viso: xy dai punti rilevati (seguono l'espressione), profondità dal modello rigido
    _applyLandmarks(lms) {
      const { THREE } = _libs;
      const pos = this.faceMesh.geometry.attributes.position;
      const arr = pos.array; const cp = _facemesh.pos;
      const M = this._meas.m.elements;
      const tanH = Math.tan(FOV_DEG * Math.PI / 360);
      const tanW = tanH * (this.width / this.height);
      const n = Math.min(lms.length / 3, 468);
      for (let i = 0; i < n; i++) {
        const x = cp[i * 3], y = cp[i * 3 + 1], z = cp[i * 3 + 2];
        const d = -(M[2] * x + M[6] * y + M[10] * z + M[14]);   // profondità nello spazio camera
        const dd = Math.max(d, 1);
        arr[i * 3] = (lms[i * 3] - 0.5) * 2 * dd * tanW;
        arr[i * 3 + 1] = (0.5 - lms[i * 3 + 1]) * 2 * dd * tanH;
        arr[i * 3 + 2] = -dd;
      }
      pos.needsUpdate = true;
      this.faceMesh.geometry.computeVertexNormals();
    }

    render(nowMs) {
      if (!this.ready) return;
      const t = (nowMs - this._t0) / 1000;
      const pr = this._predictPose(nowMs);
      if (pr) {
        // lisciatura leggera (meno tremolio), poi matrice del gruppo
        if (!this._smooth) this._smooth = { p: pr.p.clone(), q: pr.q.clone() };
        else { this._smooth.p.lerp(pr.p, 0.6); this._smooth.q.slerp(pr.q, 0.6); }
        this.faceGroup.matrix.compose(this._smooth.p, this._smooth.q, this._meas.s);
        this.faceGroup.matrixWorldNeedsUpdate = true;
        // la mesh del viso è nello spazio camera dell'istante misurato: la si
        // sposta della stessa differenza (posa disegnata · misurata⁻¹)
        this.faceMesh.matrix.copy(this.faceGroup.matrix).multiply(this._tmp.m.copy(this._meas.m).invert());
        this.faceMesh.matrixWorldNeedsUpdate = true;
      }
      const vis = this.tracking || (this._lostAt && nowMs - this._lostAt < 400);
      this.faceGroup.visible = vis && !!this.effect;
      this.faceMesh.visible = vis && !!this.effect && (!this.effect.hideHead || this.effect.def.type === 'paint');
      if (this.effect?.update) { try { this.effect.update(this.bs, t); } catch (e) { if (!this._updErr) { this._updErr = true; console.warn('[FaceAR] update', e); } } }
      this.renderer.render(this.scene, this.camera);
      this._fpsN++; if (nowMs - this._fpsT > 1000) { this.fps = this._fpsN; this._fpsN = 0; this._fpsT = nowMs; }
    }

    /** Costo (ms) di un fotogramma 3D completo (render + composizione sul video):
     *  sopra ~22 ms si scende di risoluzione, sotto ~8 ms si risale. */
    reportFrameCost(ms) {
      this._costAvg = this._costAvg == null ? ms : this._costAvg * 0.85 + ms * 0.15;
      if (++this._costN < 12) return;
      this._costN = 0;
      const s = this.renderScale || 1;
      const next = this._costAvg > 22 && s > 0.5 ? (s > 0.75 ? 0.75 : 0.5) : (this._costAvg < 8 && s < 1 ? (s < 0.75 ? 0.75 : 1) : s);
      if (next !== s) { this.renderScale = next; this._applyScale(); this._costAvg = null; }
    }

    destroy() {
      this.clearEffect();
      try { this.renderer?.dispose(); } catch (_) { }
      this.renderer = null; this.scene = null; this.ready = false;
    }

    static dispose(obj) {
      obj.traverse?.((o) => {
        if (o.geometry) o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
        mats.forEach(m => { Object.values(m).forEach(v => { if (v && v.isTexture) v.dispose(); }); m.dispose(); });
      });
    }

    /** Precarica librerie e modello (es. mentre si apre il pannello) */
    static preload() { return loadLibs().then(() => tracker.init()).catch(() => { }); }
    static get tracker() { return tracker; }
    static get libsLoaded() { return !!_libs; }
    /** Il browser può disegnare il 3D? (WebGL 2: Chrome, Edge, Firefox, Safari 15+) */
    static get supported() {
      if (FaceAR._sup == null) {
        try { const c = document.createElement('canvas'); const gl = c.getContext('webgl2'); FaceAR._sup = !!gl; gl?.getExtension('WEBGL_lose_context')?.loseContext(); }
        catch (_) { FaceAR._sup = false; }
      }
      return FaceAR._sup;
    }
  }

  FaceAR.ANCHORS = { noseTip: 1, forehead: 10, chin: 152, earL: 234, earR: 454, eyeLOuter: 33, eyeROuter: 263, eyeLInner: 133, eyeRInner: 362,
    lipTop: 13, lipBottom: 14, mouthL: 61, mouthR: 291, noseBridge: 168, browL: 105, browR: 334, cheekL: 50, cheekR: 280, templeL: 127, templeR: 356 };
  FaceAR.CONTOURS = {
    LIPS_OUTER: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185],
    LIPS_INNER: [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191],
    EYE_L: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
    EYE_R: [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466],
    BROW_L: [70, 63, 105, 66, 107, 55, 65, 52, 53, 46], BROW_R: [300, 293, 334, 296, 336, 285, 295, 282, 283, 276],
    FACE_OVAL: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],
    NOSE: [168, 6, 197, 195, 5, 4, 1, 19, 94, 2], NOSE_L: [49, 131, 134, 51, 5], NOSE_R: [279, 360, 363, 281, 5],
  };
  window.FaceAR = FaceAR;
})();
