'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   FaceAR — effetti viso 3D (1.7.0, calibrazione delle espressioni 1.8.0, testa vera 1.8.9)
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
  let PNP_IDS = null;              // punti usati per rifinire la posa (parte alta del viso, vedi _refinePose)

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

  /* ── Calibrazione delle espressioni (1.8.0) ──────────────────────────────
     MediaPipe dà valori piccoli e diversi da persona a persona: una bocca
     spalancata vale ~0,45, a occhi aperti eyeBlink vale già 0,05–0,3, e c'è chi
     a viso rilassato ha browDown a 0,7. Gli effetti invece vogliono
     0 = faccia neutra DI QUELLA PERSONA, 1 = espressione piena.

     Per ogni blendshape:
     • NEUTRO: 20° percentile delle medie a pacchetti di 0,25 s (0,1 s nel primo
       secondo) degli ultimi 60 s in cui il viso è stato visto. Nei primi
       secondi converge in fretta; dopo si adatta piano (un'espressione tenuta
       a lungo entra nel neutro solo se dura più dell'80% della finestra). Il
       neutro ha un tetto per tipo (nessuno ha un "sorriso neutro" a 0,5), così
       chi sorride sempre non perde il sorriso. Passa al nuovo valore in modo
       morbido (~0,5 s): niente scatti.
     • GUADAGNO: (grezzo − neutro) / ampiezza del tipo (quanto sale il grezzo
       sopra il neutro per l'espressione piena), con una zona morta dolce
       vicino al neutro contro i tremolii, poi limitato a 0..1. L'ampiezza non
       supera lo spazio che resta sopra il neutro (browDown neutro 0,7 → basta
       arrivare a ~0,97 per l'1).
     • FILTRO: in render() ogni valore va verso il bersaglio con una frequenza
       di taglio che sale con la velocità (tipo "One Euro"): fermo = liscio,
       movimento veloce (ammiccamento) = quasi senza ritardo. Liscia anche gli
       scalini quando il rilevamento è più lento del video.
     La stima è una sola per pagina (vale per tutti gli effetti: cambiare
     effetto non la rifà) e non viene salvata da nessuna parte.

     Contratto per gli effetti — update(g, bs, t, h):
       bs.<nome>   calibrato e filtrato, 0 = neutro della persona, 1 = pieno
       bs.smile / bs.blink / bs.browUp   medie comode (calibrate anche loro)
       h.raw.<nome>  valore grezzo di MediaPipe (ultimo rilevamento)
       h.neutral.<nome>  neutro stimato (grezzo)
       h.calib = { ready, progress 0..1, seconds }  ready dopo ~3 s di viso visto
       h.pose = { yaw, pitch, roll (rad), x, y, z (cm, camera), t (s) }
                posa della testa disegnata, per l'inerzia (orecchie, baffi…)
     Nelle miniature e nei banchi di prova h.raw/h.calib/h.pose possono mancare. */
  // tipo → [zona morta, ampiezza, neutro massimo, neutro di partenza, taglio minimo del filtro (Hz)]
  // (ampiezze misurate col modello sul viso vero: bocca spalancata ~0,45–0,55,
  //  sorriso pieno ~0,8–0,95, occhio chiuso ~0,55–0,8, guance e lingua deboli)
  const CAL = {
    jaw: [.025, .40, .22, .02, 4], smile: [.04, .58, .30, .01, 4], pucker: [.05, .60, .30, .02, 4], funnel: [.03, .38, .25, .01, 4],
    frown: [.02, .28, .20, 0, 4], blink: [.05, .42, .45, .10, 8], squint: [.05, .48, .50, .10, 5], wide: [.02, .24, .20, .02, 4],
    browUp: [.05, .52, .50, .05, 4], browDown: [.05, .48, .80, .10, 4], puff: [.02, .22, .10, 0, 4], cheekSq: [.02, .30, .20, 0, 4],
    look: [.03, .50, .50, .08, 6], tongue: [.02, .22, .10, 0, 4], other: [.03, .50, .40, .02, 4],
  };
  function calType(n) {
    if (n === 'jawOpen') return 'jaw';
    if (n.startsWith('mouthSmile')) return 'smile';
    if (n === 'mouthPucker') return 'pucker';
    if (n === 'mouthFunnel') return 'funnel';
    if (n.startsWith('mouthFrown')) return 'frown';
    if (n.startsWith('eyeBlink')) return 'blink';
    if (n.startsWith('eyeSquint')) return 'squint';
    if (n.startsWith('eyeWide')) return 'wide';
    if (n.startsWith('eyeLook')) return 'look';
    if (n === 'browInnerUp' || n.startsWith('browOuterUp')) return 'browUp';
    if (n.startsWith('browDown')) return 'browDown';
    if (n === 'cheekPuff') return 'puff';
    if (n.startsWith('cheekSquint')) return 'cheekSq';
    if (n === 'tongueOut') return 'tongue';
    return 'other';
  }
  const CAL_RING = 240, CAL_Q = 0.2;
  class ExpressionCalibration {
    constructor() { this.names = null; this.n = 0; this.trackedS = 0; this.samples = 0; this.info = { ready: false, progress: 0, seconds: 0 }; this.raw = {}; this.neutral = {}; }
    _setup(names) {
      const n = this.n = names.length; this.names = names.slice();
      this.dz = new Float32Array(n); this.span = new Float32Array(n); this.maxN = new Float32Array(n); this.skip = new Uint8Array(n);
      this.base = new Float32Array(n); this.baseT = new Float32Array(n); this.cal = new Float32Array(n); this.speed = new Float32Array(n);
      this.last = new Float32Array(n); this.sum = new Float32Array(n); this.filt = new Float32Array(n); this.fc0 = new Float32Array(n);
      this.ring = new Float32Array(n * CAL_RING); this.scratch = new Float32Array(CAL_RING);
      this.ringLen = 0; this.ringPos = 0; this.bucketN = 0; this.bucketS = 0; this.lastTs = 0;
      for (let i = 0; i < n; i++) {
        const p = CAL[calType(names[i])]; this.dz[i] = p[0]; this.span[i] = p[1]; this.maxN[i] = p[2]; this.fc0[i] = p[4];
        this.skip[i] = names[i] === '_neutral' ? 1 : 0;
        this.base[i] = this.baseT[i] = p[3];
      }
    }
    /** Un risultato del rilevamento (valori grezzi nell'ordine di names). ts in ms. */
    feed(names, raw, ts) {
      const first = !this.names || this.n !== raw.length;
      if (first) this._setup(names);
      const n = this.n;
      // primo fotogramma: il neutro parte da lì (con il tetto), così non c'è un attimo di espressione finta
      if (first) for (let i = 0; i < n; i++) if (!this.skip[i]) this.base[i] = this.baseT[i] = Math.min(raw[i], this.maxN[i]);
      let dt = this.lastTs ? (ts - this.lastTs) / 1000 : 1 / 30;
      if (!(dt > 0)) return;                       // stesso fotogramma (o tempo all'indietro): già contato
      if (dt > 0.5) dt = 1 / 30;                  // dopo una pausa (viso perso) non si salta avanti
      this.lastTs = ts;
      this.trackedS += dt; this.samples++;
      // pacchetti: medie di 0,1 s nel primo secondo, poi di 0,25 s
      for (let i = 0; i < n; i++) this.sum[i] += raw[i];
      this.bucketN++; this.bucketS += dt;
      if (this.bucketS >= (this.trackedS < 1 ? 0.1 : 0.25)) this._pushBucket();
      // neutro mostrato: segue il percentile in modo morbido (più svelto all'inizio)
      const kb = 1 - Math.exp(-dt / (this.trackedS < 3 ? 0.15 : 0.5));
      for (let i = 0; i < n; i++) {
        const r = raw[i];
        this.raw[this.names[i]] = r;
        if (this.skip[i]) { this.cal[i] = r; continue; }
        this.base[i] += (this.baseT[i] - this.base[i]) * kb;
        const b = this.base[i];
        const span = Math.max(0.12, Math.min(this.span[i], 1 - b - this.dz[i] * .5));
        // zona morta dolce: sotto 2·dz cresce col quadrato (niente tremolio), poi lineare
        const x = (r - b) / span, d = this.dz[i] / span;
        let y = x <= 0 ? 0 : (x < 2 * d ? x * x / (4 * d) : x - d);
        y /= (1 - d); if (y > 1) y = 1;
        // velocità (per il filtro in render): lisciata su ~0,08 s
        const v = Math.abs(y - this.last[i]) / dt; this.last[i] = y;
        this.speed[i] += (v - this.speed[i]) * (1 - Math.exp(-dt / 0.06));
        this.cal[i] = y;
      }
      this.info.seconds = this.trackedS; this.info.progress = Math.min(1, this.trackedS / 3); this.info.ready = this.trackedS >= 3;
    }
    _pushBucket() {
      const n = this.n, R = CAL_RING, k = this.bucketN;
      for (let i = 0; i < n; i++) { this.ring[i * R + this.ringPos] = this.sum[i] / k; this.sum[i] = 0; }
      this.ringPos = (this.ringPos + 1) % R; if (this.ringLen < R) this.ringLen++;
      this.bucketN = 0; this.bucketS = 0;
      // percentile basso di ogni blendshape sulla finestra
      const L = this.ringLen, sc = this.scratch, qi = Math.min(L - 1, Math.floor(CAL_Q * (L - 1) + 0.5));
      for (let i = 0; i < n; i++) {
        if (this.skip[i]) continue;
        for (let j = 0; j < L; j++) sc[j] = this.ring[i * R + j];
        const v = L === R ? sc.sort()[qi] : sc.subarray(0, L).sort()[qi];
        this.baseT[i] = Math.min(v, this.maxN[i]);
        this.neutral[this.names[i]] = this.baseT[i];
      }
    }
    /** Filtro (a ogni fotogramma disegnato): ogni valore va verso il bersaglio
     *  calibrato con frequenza di taglio fc = fc0 + 2·velocità (One Euro):
     *  fermo ≈ 40 ms di costante di tempo, ammiccamento ≈ 10 ms. Scrive in out. */
    smooth(out, dt) {
      if (!this.n) return false;
      if (!(dt > 0)) dt = 1 / 60; if (dt > 0.1) dt = 0.1;
      const W = 2 * Math.PI * dt;
      for (let i = 0; i < this.n; i++) {
        // velocità limitata: un solo fotogramma sbagliato non lancia il filtro (taglio max ~fc0+8 Hz)
        const fc = this.fc0[i] + Math.min(1.5 * this.speed[i], 6);
        const f = this.filt[i] += (this.cal[i] - this.filt[i]) * (1 - Math.exp(-W * fc));
        out[this.names[i]] = f < 1e-4 ? 0 : f;
      }
      return true;
    }
    /** Viso perso: i bersagli tornano al neutro (il personaggio riappare rilassato). */
    relax() { if (!this.cal) return; for (let i = 0; i < this.n; i++) if (!this.skip[i]) { this.cal[i] = 0; this.speed[i] = 0; this.last[i] = 0; } }
    /** Per le prove: azzera tutto (come una persona nuova). */
    reset() { this.names = null; this.n = 0; this.trackedS = 0; this.samples = 0; this.info.ready = false; this.info.progress = 0; this.info.seconds = 0; }
  }
  const calibration = new ExpressionCalibration();

  /* ── Posa della testa: misure accettate solo se plausibili e coerenti (1.8.0) ──
     Prima una sola misura strana (viso tagliato a metà dal bordo, falso
     riconoscimento, risultato vecchio rimasto da un effetto precedente) o due
     misure ravvicinate (estrapolazione ×30) bastavano a disegnare l'effetto
     enorme, davanti alla camera, finché la testa non si muoveva.
     • una misura fuori misura (z, scala, NaN) si scarta;
     • l'effetto compare solo dopo POSE.confirm misure coerenti fra loro;
     • un salto improvviso si accetta solo se confermato dalla misura dopo
       (nel frattempo resta la posa di prima, ferma);
     • la previsione in avanti è limitata (tempo, spostamento, rotazione) e si
       azzera dopo una pausa (viso perso, scheda in background, rilevamento lento). */
  const POSE = {
    zNear: -12, zFar: -260,     // cm: la testa sta fra 12 cm e 2,6 m dalla camera
    confirm: 3,                 // misure coerenti prima di mostrare l'effetto (2 se il rilevamento è lento)
    gap: 350,                   // ms fra due misure oltre i quali non si stima la velocità
    relock: 1500,               // ms senza misure: al ritorno serve di nuovo la conferma
    lostHide: 400,              // ms di posa tenuta dopo aver perso il viso
    stale: 2500,                // ms: un risultato più vecchio di così non vale (PC lenti: ~0,5 s)
  };
  /* ── La testa vera intorno al viso (1.8.9) ──────────────────────────────────
     Misure sulle chiamate vere riportate nello spazio canonico di MediaPipe (cm):
     il cranio vero arriva a y ≈ 13–14,5 (una testa calva: 13,8–14,5) e dietro a
     z ≈ −13,5 (lunghezza della testa ~19 cm dalla glabella); l'ellissoide di
     sempre finisce a y 10,4 e z −11,3, cioè all'attaccatura dei capelli: da
     sotto (webcam bassa) si vedeva l'interno dei cappelli e la parte di tese e
     fasce dietro la testa passava davanti. HEAD.cranium è la calotta che manca:
     sopra le sopracciglia e dietro, mai davanti al viso (≥ 0,8 cm dietro ai 468
     punti del modello, più indietro dell'ellissoide di prima intorno agli occhi).
     Gli accessori aderenti regolati sull'ellissoide piccolo (fiocchi, cerchietti,
     bandane, parrucche corte) ci finirebbero dentro: la calotta si accende per
     effetto (vedi _fitEffect) solo se nasconde meno di HEAD.lost della loro
     superficie che guarda la camera; un effetto può deciderlo da sé con
     export const cranium = true | false. */
  const HEAD = {
    cranium: { c: [0, 5.6, -4.8], r: [7.7, 7.7, 8.7] },   // cima y 13,3, nuca z −13,5, larga ±7,7
    lost: 0.04,
  };
  // parti al collo: quanta inclinazione della testa si toglie, fino a quanti radianti, intorno a quale punto (cm)
  const NECK = { damp: 0.6, max: 0.6, pivot: [0, -5, -4], below: -8.5 };

  // la misura b è coerente con a? (spostamento ammesso che cresce col tempo fra le due)
  function poseCoherent(a, b, maxDt) {
    const dt = Math.min(Math.max((b.ts - a.ts) / 1000, 0.016), maxDt || 1.0);
    const dxy = Math.hypot(b.p.x - a.p.x, b.p.y - a.p.y), dz = Math.abs(b.p.z - a.p.z);
    const dq = Math.abs(a.q.x * b.q.x + a.q.y * b.q.y + a.q.z * b.q.z + a.q.w * b.q.w);
    const ang = 2 * Math.acos(Math.min(1, dq));
    return dxy < 4 + 120 * dt && dz < 5 + 100 * dt && ang < 0.25 + 4 * dt;
  }

  class FaceAR {
    constructor() {
      this.canvas = null; this.renderer = null; this.scene = null; this.camera = null;
      this.width = 0; this.height = 0;
      this.faceGroup = null;        // segue la testa (matrice MediaPipe)
      this.faceMesh = null;         // mesh del viso deformata dai 468 punti (occlusore + pittura)
      this.skull = null;            // ellissoide dietro al viso (occlusore)
      this.effect = null;           // { def, group?, update?, hideHead, paintTex? }
      this.bs = {};                 // blendshape correnti CALIBRATI (0 neutro … 1 pieno), filtrati
      this.bsRaw = calibration.raw; // grezzi di MediaPipe (ultimo rilevamento)
      this.pose = { yaw: 0, pitch: 0, roll: 0, x: 0, y: 0, z: -50, t: 0 };   // posa disegnata (per l'inerzia)
      this._lastRender = 0;
      this.tracking = false;        // viso trovato nell'ultimo fotogramma
      this.confirmed = false;       // posa confermata (POSE.confirm misure coerenti): solo allora si disegna
      this._stable = 0;             // misure coerenti di fila
      this._pending = null;         // salto in attesa di conferma { meas, n }
      this.stats = { results: 0, noFace: 0, stale: 0, rejected: 0, jumps: 0, relock: 0 };   // diagnostica (console: faceEffects.ar.stats)
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
      // 1.8.6: se Chrome rifiuta la grafica 3D, un secondo tentativo dopo un attimo
      // (prima l'effetto falliva subito e restava spento fino al ricaricamento)
      const mkRenderer = () => new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
      try { this.renderer = mkRenderer(); }
      catch (e1) {
        console.warn('[FaceAR] grafica 3D rifiutata, riprovo:', e1?.message);
        await new Promise(r => setTimeout(r, 1200));
        this.canvas = document.createElement('canvas'); this.canvas.width = width; this.canvas.height = height;
        try { this.renderer = mkRenderer(); }
        catch (e2) { FaceAR._sup = false; FaceAR._supAt = Date.now(); throw new Error('il browser non ha dato la grafica 3D (WebGL 2): ' + (e2?.message || '')); }
      }
      // grafica persa (scheda grafica ripartita): lo dice a chi usa l'effetto, che lo ricrea
      this.canvas.addEventListener('webglcontextlost', () => { if (this._destroying) return; this.lost = true; try { FaceAR.onContextLost?.(this); } catch (_) { } });
      this.canvas.addEventListener('webglcontextrestored', () => { this.lost = false; try { FaceAR.onContextRestored?.(this); } catch (_) { } });
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
      // cranio: solo profondità, dietro al viso (1.8.9: vedi HEAD — l'ellissoide di prima più la calotta vera)
      this.skull = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true }));
      this.skull.scale.set(7.4, 8.9, 7.5); this.skull.position.set(0, 1.5, -3.8);
      this.skull.renderOrder = -3;
      // calotta del cranio vero (HEAD.cranium): accesa solo per gli effetti che la reggono (vedi _fitEffect)
      this.cranium = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), this.skull.material);
      this.cranium.scale.set(...HEAD.cranium.r); this.cranium.position.set(...HEAD.cranium.c);
      this.cranium.renderOrder = -3; this.cranium.visible = false;
      this.faceGroup.add(this.cranium);
      this.faceGroup.add(this.skull);
      // collo e spalle (solo profondità): i capelli lunghi e il retro delle
      // parrucche passano DIETRO al corpo invece di coprire il collo e il petto
      const occ = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true });
      this.neck = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.6, 10, 24), occ); this.neck.position.set(0, -12, -1.5); this.neck.renderOrder = -3;
      this.body = new THREE.Mesh(new THREE.BoxGeometry(34, 10, 12), occ); this.body.position.set(0, -20, -2); this.body.renderOrder = -3;
      this.faceGroup.add(this.neck, this.body);
      this.faceMesh.matrixAutoUpdate = false;
      // niente si disegna finché la posa non è confermata (prima erano visibili con la matrice identità)
      this.faceGroup.visible = false; this.faceMesh.visible = false;
      this._tmp = { v: new THREE.Vector3(), m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), q2: new THREE.Quaternion(), one: new THREE.Vector3(1, 1, 1) };
      // l'ultimo risultato del rilevamento può essere di un effetto di prima (il rilevamento è unico
      // per la pagina): si parte dal prossimo
      this._seen = tracker.version;
      // scheda di nuovo in primo piano: niente velocità vecchie
      this._onVis = () => { this._prev = null; };
      try { document.addEventListener('visibilitychange', this._onVis); } catch (_) { }
      this.ready = true; mark('scene');
      console.log('[FaceAR] pronto', JSON.stringify(this.timings));
    }

    resize(width, height) {
      if (!this.renderer || (width === this.width && height === this.height)) return;
      this.width = width; this.height = height;
      this._applyScale();
      this.camera.aspect = this._aspect(); this.camera.updateProjectionMatrix();
    }
    _aspect() { return this.srcAspect || (this.width / this.height); }
    _setSrcAspect(a) {
      if (this.srcAspect && Math.abs(a - this.srcAspect) < 1e-3) return;
      this.srcAspect = a; if (this.camera) { this.camera.aspect = a; this.camera.updateProjectionMatrix(); }
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
        // 1.8.0: grezzi, neutro stimato, stato della calibrazione e posa della testa (oggetti vivi)
        raw: calibration.raw, neutral: calibration.neutral, calib: calibration.info, pose: this.pose,
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
        eff.group = g; eff.hideHead = !!mod.hideHead; eff.neck = mod.neck; eff.cranium = mod.cranium;
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
      // proporzioni del fotogramma che vede MediaPipe: la camera 3D usa le stesse (se la webcam
      // cambia risoluzione dopo l'avvio, il video viene stirato nel canvas e il 3D con lui)
      const sw = source.videoWidth || source.width, sh = source.videoHeight || source.height;
      if (sw > 0 && sh > 0) this._setSrcAspect(sw / sh);
      tracker.push(source, nowMs);
      if (tracker.version === this._seen) return this.tracking;
      this._seen = tracker.version;
      const r = tracker.latest;
      const st = this.stats; st.results++;
      if (!r || !r.lms || !r.mtx) { st.noFace++; this._lost(); return false; }
      // intervallo medio fra due risultati (PC lenti: anche 0,5–2 s): le soglie di tempo si adattano
      if (this._lastTs && r.ts > this._lastTs) { const d = Math.min(r.ts - this._lastTs, 4000); this._detIv = this._detIv ? this._detIv * .8 + d * .2 : d; }
      this._lastTs = r.ts;
      const iv = this._detIv || 33, relock = Math.max(POSE.relock, iv * 3), stale = Math.max(POSE.stale, (tracker.roundTrip || 0) * 3, iv * 3);
      if (nowMs - r.ts > stale) { st.stale++; return this.tracking; }    // risultato vecchio: si aspetta il prossimo
      const meas = this._measure(r.mtx, r.ts, r.lms);
      if (!meas) { st.rejected++; this._lost(); return false; }          // posa impossibile: come viso non trovato
      // espressioni: calibrate qui (bersagli), filtrate in render() a ogni fotogramma
      if (r.bs && tracker.names) calibration.feed(tracker.names, r.bs, r.ts);
      const last = this._meas;
      // (un "viso non trovato" isolato non azzera la conferma: conta il tempo dall'ultima misura buona)
      const fresh = !last || r.ts - last.ts > relock;
      // lunga pausa (rilevamento fermo o lentissimo): se la testa è ancora lì si continua senza
      // velocità, altrimenti si riaggancia da capo (niente scivolate dalla posa vecchia)
      if (fresh && this.confirmed && !poseCoherent(last, meas, 0.05)) { st.relock++; this._resetPose(true); }
      const good = this._lastGood;
      if (!this.confirmed && good && r.ts - good.ts < 3000 && poseCoherent(good, meas, 0.1)) {
        // viso ritrovato vicino a dov'era (perso per poco): si riprende subito, senza attendere
        this._accept(meas, r.lms, true); this._snap = true; this._stable = POSE.confirm;
      } else if (!last || (!this.confirmed && (fresh || !poseCoherent(last, meas)))) {
        // (ri)aggancio: si riparte da questa misura, senza velocità
        this._accept(meas, r.lms, true); this._stable = 1;
      } else if (poseCoherent(last, meas)) {
        this._accept(meas, r.lms, fresh); this._stable++; this._pending = null;
      } else {
        // salto: si tiene la posa di prima finché la misura dopo non lo conferma
        st.jumps++;
        const pd = this._pending;
        if (pd && poseCoherent(pd.meas, meas)) { this._accept(meas, r.lms, true); this._snap = true; this._stable = POSE.confirm; this._pending = null; }
        else if (pd && pd.n >= 3) { this._resetPose(true); this._accept(meas, r.lms, true); this._stable = 1; }   // misure tutte diverse: si nasconde e si riaggancia
        else this._pending = { meas, n: pd ? pd.n + 1 : 1 };
      }
      if (this._stable >= POSE.confirm || (this._stable >= 2 && last && r.ts - last.ts > 150)) this.confirmed = true;
      if (this.confirmed && this._meas === meas) this._lastGood = meas;
      this.tracking = true; this._lostAt = 0;
      return true;
    }
    _lost() {
      // viso perso: tengo l'ultima posa per qualche istante, poi nascondo
      if (this.tracking) { this._lostAt = performance.now(); this.tracking = false; calibration.relax(); }
      this._pending = null;
    }
    // azzera la posa: la prossima misura riparte da capo (serve di nuovo la conferma)
    _resetPose(hard) { this.confirmed = false; this._stable = 0; this._pending = null; this._prev = null; this._smooth = null; if (hard) this._lastGood = null; }

    // Posa misurata (MediaPipe, matrice per colonne come three.js: errore di
    // riproiezione ~3 px con la camera a 63° di apertura verticale).
    // Si tengono le ultime due misure con il loro istante: in render() la posa
    // viene PREDETTA all'istante del fotogramma da disegnare, così il cappello
    // non resta indietro quando si muove la testa e il rilevamento è più lento
    // del video (PC deboli, rilevamento su CPU).
    // misura → { m, p, q, s, ts } oppure null se impossibile (NaN, scala strana, troppo vicina o lontana)
    _measure(data, ts, lms) {
      const { THREE } = _libs;
      for (let i = 0; i < 16; i++) if (!Number.isFinite(data[i])) return null;
      const m = new THREE.Matrix4().fromArray(data);
      // 1.8.9: posa rifinita sui punti 2D (vedi _refinePose); se non converge resta quella di MediaPipe
      if (lms && lms.length >= 468 * 3 && _facemesh && FaceAR.options.refinePose) {
        // solo se la camera da 63° spiega i punti almeno quanto una più stretta (webcam, telefoni);
        // con una camera stretta (foto, viso vicinissimo) MediaPipe è già giusto e resta il suo
        const r = this._fovPick(m.elements, lms) === FOV_DEG ? this._refinePose(m.elements, lms, FOV_DEG) : null;
        if (r) { const mr = new THREE.Matrix4().fromArray(r); if (this._rotDiff(m, mr) < 0.45) m.copy(mr); }
      }
      const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
      m.decompose(p, q, sc);
      if (!(p.z < POSE.zNear && p.z > POSE.zFar)) return null;
      if (Math.abs(p.x) > -p.z * 1.5 || Math.abs(p.y) > -p.z * 1.2) return null;     // fuori dall'inquadratura
      if (!(sc.x > .6 && sc.x < 1.6 && sc.y > .6 && sc.y < 1.6 && sc.z > .6 && sc.z < 1.6)) return null;
      // la matrice deve dire la stessa grandezza dei punti: proietto con la matrice gli angoli degli
      // occhi e fronte/mento del modello canonico e confronto le distanze con quelle dei punti rilevati
      // (normalmente il rapporto sta fra 0,9 e 1,2; una matrice "incollata" vicino alla camera dà 2–3)
      if (lms && lms.length >= 468 * 3 && _facemesh) {
        const k = this._consistency(m.elements, lms);
        if (k && (k < 0.6 || k > 1.65)) return null;
      }
      return { m, p, q, s: sc, ts };
    }
    /* Posa rifinita sui punti 2D (1.8.9). La matrice di MediaPipe viene da un
       confronto 3D-3D che usa anche la profondità stimata di ogni punto: sulle
       chiamate vere sbaglia l'imbardata di 5–10° a testa girata (35° invece di
       45°) e con una mano davanti alla bocca si sposta tutta (13°). Qui si parte
       da quella e la si corregge minimizzando l'errore di riproiezione del
       modello rigido sui punti della parte alta del viso (occhi, sopracciglia,
       naso, fronte, tempie, guance: niente bocca né mento, che si muovono col
       sorriso e spariscono dietro una mano), con pesi robusti (Huber): 5–6
       passi di Gauss-Newton su 140 punti, meno di 0,2 ms.
       M: elementi 4x4 per colonne (three.js), lms: punti normalizzati. Ritorna
       la matrice nuova (Float64Array 16) o null se non converge o è peggio. */
    _refinePose(M, lms, fovDeg) {
      const cp = _facemesh.pos;
      if (!PNP_IDS) { PNP_IDS = []; const lips = new Set(FaceAR.CONTOURS.LIPS_OUTER.concat(FaceAR.CONTOURS.LIPS_INNER)); for (let i = 0, k = 0; i < 468; i++) if (cp[i * 3 + 1] > -1.6 && !lips.has(i) && (k++ & 1) === 0) PNP_IDS.push(i); }
      const fov = fovDeg || FOV_DEG, A = this._aspect() || 16 / 9, f = 1 / (2 * Math.tan(fov * Math.PI / 360));
      // stato: R (3x3 per righe), t (con un'altra apertura la testa si vede uguale se cambia solo la distanza z)
      const s = Math.hypot(M[0], M[1], M[2]) || 1, kz = Math.tan(FOV_DEG * Math.PI / 360) / Math.tan(fov * Math.PI / 360);
      const R = [M[0] / s, M[4] / s, M[8] / s, M[1] / s, M[5] / s, M[9] / s, M[2] / s, M[6] / s, M[10] / s];
      const t = [M[12], M[13], M[14] * kz];        // stessa posizione e grandezza a schermo: cambia solo la distanza
      const n = PNP_IDS.length, H = new Float64Array(36), g = new Float64Array(6), d = new Float64Array(6);
      const err = (R, t) => {     // errore medio (unità: altezza del fotogramma)
        let e = 0, c = 0;
        for (let k = 0; k < n; k++) {
          const i = PNP_IDS[k], x = cp[i * 3], y = cp[i * 3 + 1], z = cp[i * 3 + 2];
          const Px = R[0] * x + R[1] * y + R[2] * z + t[0], Py = R[3] * x + R[4] * y + R[5] * z + t[1], Z = -(R[6] * x + R[7] * y + R[8] * z + t[2]);
          if (!(Z > 1)) return Infinity;
          const ra = A / 2 + f * Px / Z - A * lms[i * 3], rb = 0.5 - f * Py / Z - lms[i * 3 + 1];
          e += Math.hypot(ra, rb); c++;
        }
        return e / c;
      };
      const e0 = err(R, t);
      if (!Number.isFinite(e0)) return null;
      const HUB = 0.008;   // ~6 px su 720: oltre, il punto pesa meno (mano davanti, barba, ombre)
      let e = e0;
      for (let it = 0; it < 6; it++) {
        H.fill(0); g.fill(0);
        for (let k = 0; k < n; k++) {
          const i = PNP_IDS[k], x = cp[i * 3], y = cp[i * 3 + 1], z = cp[i * 3 + 2];
          const qx = R[0] * x + R[1] * y + R[2] * z, qy = R[3] * x + R[4] * y + R[5] * z, qz = R[6] * x + R[7] * y + R[8] * z;
          const Px = qx + t[0], Py = qy + t[1], Pz = qz + t[2], Z = -Pz;
          if (!(Z > 1)) return null;
          const ra = A / 2 + f * Px / Z - A * lms[i * 3], rb = 0.5 - f * Py / Z - lms[i * 3 + 1];
          const rr = Math.hypot(ra, rb), w = rr > HUB ? HUB / rr : 1;
          // d(residuo)/dP
          const ax = f / Z, az = f * Px / (Z * Z), by = -f / Z, bz = -f * Py / (Z * Z);
          // dP/d(omega) = -[q]x  → righe: [0, qz, -qy], [-qz, 0, qx], [qy, -qx, 0]
          const Ja = [ax * 0 + az * qy, ax * qz + az * -qx, ax * -qy + az * 0, ax, 0, az];
          const Jb = [by * -qz + bz * qy, 0 + bz * -qx, by * qx + 0, 0, by, bz];
          for (let r = 0; r < 6; r++) {
            g[r] += w * (Ja[r] * ra + Jb[r] * rb);
            for (let c = 0; c <= r; c++) H[r * 6 + c] += w * (Ja[r] * Ja[c] + Jb[r] * Jb[c]);
          }
        }
        for (let r = 0; r < 6; r++) { H[r * 6 + r] *= 1.0001; H[r * 6 + r] += 1e-9; for (let c = 0; c < r; c++) H[c * 6 + r] = H[r * 6 + c]; }
        // risolve H d = -g (eliminazione di Gauss con pivot)
        const a = Array.from(H), b = Array.from(g, v => -v);
        for (let c = 0; c < 6; c++) {
          let p = c; for (let r = c + 1; r < 6; r++) if (Math.abs(a[r * 6 + c]) > Math.abs(a[p * 6 + c])) p = r;
          if (Math.abs(a[p * 6 + c]) < 1e-14) return null;
          if (p !== c) { for (let k = 0; k < 6; k++) { const tmp = a[c * 6 + k]; a[c * 6 + k] = a[p * 6 + k]; a[p * 6 + k] = tmp; } const tb = b[c]; b[c] = b[p]; b[p] = tb; }
          for (let r = c + 1; r < 6; r++) { const m = a[r * 6 + c] / a[c * 6 + c]; for (let k = c; k < 6; k++) a[r * 6 + k] -= m * a[c * 6 + k]; b[r] -= m * b[c]; }
        }
        for (let r = 5; r >= 0; r--) { let v = b[r]; for (let k = r + 1; k < 6; k++) v -= a[r * 6 + k] * d[k]; d[r] = v / a[r * 6 + r]; }
        // aggiornamento: R ← exp([ω]x)·R (Rodrigues), t ← t + δt
        const wx = d[0], wy = d[1], wz = d[2], th = Math.hypot(wx, wy, wz);
        if (!Number.isFinite(th) || th > 0.5) return null;
        const ux = th > 1e-12 ? wx / th : 0, uy = th > 1e-12 ? wy / th : 0, uz = th > 1e-12 ? wz / th : 0, cs = Math.cos(th), sn = Math.sin(th), vc = 1 - cs;
        const E = [cs + ux * ux * vc, ux * uy * vc - uz * sn, ux * uz * vc + uy * sn,
          uy * ux * vc + uz * sn, cs + uy * uy * vc, uy * uz * vc - ux * sn,
          uz * ux * vc - uy * sn, uz * uy * vc + ux * sn, cs + uz * uz * vc];
        const R2 = new Array(9);
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) R2[r * 3 + c] = E[r * 3] * R[c] + E[r * 3 + 1] * R[3 + c] + E[r * 3 + 2] * R[6 + c];
        const t2 = [t[0] + d[3], t[1] + d[4], t[2] + d[5]];
        const e2 = err(R2, t2);
        if (!(e2 <= e * 1.0005)) break;            // non migliora più
        for (let k = 0; k < 9; k++) R[k] = R2[k]; t[0] = t2[0]; t[1] = t2[1]; t[2] = t2[2]; e = e2;
        if (th < 1e-5 && Math.hypot(d[3], d[4], d[5]) < 1e-3) break;
      }
      if (!(e < e0) && fovDeg === FOV_DEG) return null;
      const out = new Float64Array(16);
      out[0] = R[0]; out[1] = R[3]; out[2] = R[6]; out[3] = 0;
      out[4] = R[1]; out[5] = R[4]; out[6] = R[7]; out[7] = 0;
      out[8] = R[2]; out[9] = R[5]; out[10] = R[8]; out[11] = 0;
      // posizione riportata alla camera da 63° con cui si disegna: la testa resta della stessa grandezza a schermo
      out[12] = t[0]; out[13] = t[1]; out[14] = t[2] / kz; out[15] = 1;
      this._pnpErr = [e0, e];
      out.err = e;
      return out;
    }
    /* Quale apertura spiega meglio i punti? Con le webcam (viso a 40–70 cm) l'errore cambia
       poco con l'apertura e 63° va bene; con un obiettivo stretto (foto, viso vicinissimo)
       l'errore dice chiaramente 25–35° (es. 8,3 px a 63°, 4,1 a 25°) e lì la posa rifinita a
       63° storcerebbe l'inclinazione (anche 15°), mentre quella di MediaPipe è giusta (a 25°
       le due coincidono entro 2°). Ogni 8 misure si provano 25/35/45/63° e si tiene la
       mediana delle ultime scelte (63° vince se le altre non sono meglio di almeno l'8%).
       Si disegna sempre con la camera da 63°. */
    _fovPick(M, lms) {
      this._fovN = (this._fovN || 0) + 1;
      if (this._fovEst && this._fovN % 8 !== 1) return this._fovEst;
      let best = FOV_DEG, be = Infinity;
      for (const f of [25, 35, 45, FOV_DEG]) {
        const r = this._refinePose(M, lms, f); if (!r) continue;
        const e = r.err * (f === FOV_DEG ? 0.92 : 1);
        if (e < be) { be = e; best = f; }
      }
      const h = this._fovHist || (this._fovHist = []); h.push(best); if (h.length > 7) h.shift();
      const sorted = h.slice().sort((a, b) => a - b);
      return (this._fovEst = sorted[sorted.length >> 1]);
    }
    // angolo (rad) fra le rotazioni di due matrici
    _rotDiff(a, b) {
      const A = a.elements, B = b.elements, sa = Math.hypot(A[0], A[1], A[2]) || 1, sb = Math.hypot(B[0], B[1], B[2]) || 1;
      let tr = 0; for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) tr += A[c * 4 + r] * B[c * 4 + r];
      return Math.acos(Math.max(-1, Math.min(1, (tr / (sa * sb) - 1) / 2)));
    }
    _consistency(M, lms) {
      const cp = _facemesh.pos, tanH = Math.tan(FOV_DEG * Math.PI / 360), tanW = tanH * (this._aspect() || 16 / 9);
      const P = (i, o) => { const x = cp[i * 3], y = cp[i * 3 + 1], z = cp[i * 3 + 2];
        const X = M[0] * x + M[4] * y + M[8] * z + M[12], Y = M[1] * x + M[5] * y + M[9] * z + M[13], Z = -(M[2] * x + M[6] * y + M[10] * z + M[14]);
        if (!(Z > 1)) return false; o[0] = (X / (Z * tanW) + 1) / 2; o[1] = (1 - Y / (Z * tanH)) / 2; return true; };
      const a = this._ca || (this._ca = [0, 0]), b = this._cb || (this._cb = [0, 0]);
      let pr = 0, lr = 0;
      for (const [i, j] of [[33, 263], [10, 152]]) {
        if (!P(i, a) || !P(j, b)) return 0;
        const A = this._aspect() || 16 / 9;   // distanze in unità dell'altezza del fotogramma
        pr += Math.hypot((a[0] - b[0]) * A, a[1] - b[1]);
        lr += Math.hypot((lms[i * 3] - lms[j * 3]) * A, lms[i * 3 + 1] - lms[j * 3 + 1]);
      }
      return lr > 1e-6 ? pr / lr : 0;
    }
    _accept(meas, lms, noVel) {
      this._prev = noVel ? null : (this._meas || null);
      this._meas = meas;
      const b = this._prev;
      // misure troppo distanti o troppo vicine nel tempo: niente velocità (dividere per pochi ms la esplode)
      if (b && (meas.ts - b.ts > POSE.gap || meas.ts - b.ts < 20)) this._prev = null;
      this._applyLandmarks(lms);
    }

    _predictPose(nowMs) {
      const { THREE } = _libs;
      const a = this._meas; if (!a) return null;
      const out = this._pred || (this._pred = { p: new THREE.Vector3(), q: new THREE.Quaternion() });
      out.p.copy(a.p); out.q.copy(a.q);
      const b = this._prev;
      const since = nowMs - a.ts;
      // previsione solo se le misure arrivano regolari: se il rilevamento si è fermato
      // (scheda in background, PC occupato) si tiene l'ultima posa, non la si spinge avanti
      if (b && since >= 0 && since < 250) {
        const dtM = a.ts - b.ts;
        const ahead = Math.min(since, 120, dtM * 1.5);                    // al massimo 120 ms e 1,5 intervalli
        const f = (ahead / dtM) * 0.85;
        const v = this._tmp.v.subVectors(a.p, b.p).multiplyScalar(f);
        const L = v.length(); if (L > 5) v.multiplyScalar(5 / L);         // al massimo 5 cm in avanti
        out.p.add(v);
        // rotazione: stessa velocità angolare dell'ultimo intervallo (al massimo ~17°)
        const dq = this._tmp.q.copy(b.q).invert().premultiply(a.q);     // a = dq · b
        let ang = 2 * Math.acos(Math.min(1, Math.abs(dq.w)));
        if (ang > 1e-4 && ang < 0.6) {
          const axis = this._tmp.p.set(dq.x, dq.y, dq.z).normalize(); if (dq.w < 0) axis.negate();
          out.q.premultiply(this._tmp.q2.setFromAxisAngle(axis, Math.min(ang * f, 0.3)));
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
      const tanW = tanH * this._aspect();
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

    /* Parti al collo (1.8.9): sciarpe, colletti, papillon seguivano tutta l'inclinazione della
       testa intorno al centro del viso: a testa china (16° in giù) la sciarpa girava indietro
       e in su, verso il mento e la bocca, invece di restare intorno al collo.
       Il collo si piega meno della testa: alle parti che stanno tutte sotto il mento
       (y < −8,5 cm nello spazio canonico) si toglie NECK.damp dell'inclinazione avanti/indietro,
       ruotando intorno all'attaccatura del collo (NECK.pivot). L'imbardata e il resto restano.
       La correzione vale solo al momento del disegno (onBeforeRender/onAfterRender), quindi
       non tocca niente di quello che l'effetto calcola da sé. Un effetto può spegnerla con
       export const neck = false. Non si applica se nella zona del collo c'è anche una parte
       che scende dalla testa (cappucci, parrucche lunghe): resterebbero staccate. */
    _fitEffect(eff) {
      const { THREE } = _libs;
      const fit = eff.fit = { neck: [], cranium: false, lost: 0 };
      const g = eff.group;
      if (!g || eff.hideHead) return;
      this.faceGroup.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(this.faceGroup.matrixWorld).invert(), m = new THREE.Matrix4(), nm = new THREE.Matrix3();
      const v = new THREE.Vector3(), n = new THREE.Vector3();
      const C = HEAD.cranium, inCr = (p) => ((p.x - C.c[0]) / C.r[0]) ** 2 + ((p.y - C.c[1]) / C.r[1]) ** 2 + ((p.z - C.c[2]) / C.r[2]) ** 2 < 1;
      const inOld = (p) => (p.x / 7.4) ** 2 + ((p.y - 1.5) / 8.9) ** 2 + ((p.z + 3.8) / 7.5) ** 2 < 1;
      const items = []; let tot = 0, lost = 0;
      g.traverse((o) => {
        if (!(o.isMesh || o.isLine || o.isSprite) || o.isInstancedMesh) return;
        const geo = o.geometry, pos = geo && geo.attributes && geo.attributes.position; if (!pos || !pos.count) return;
        let vis = o.visible; for (let p = o.parent; p && p !== this.faceGroup; p = p.parent) if (!p.visible) vis = false;
        const mats = [].concat(o.material), occ = mats.every(mt => mt && mt.colorWrite === false);
        const two = mats.some(mt => mt && mt.side === THREE.DoubleSide), nor = !two && o.isMesh && !o.isSkinnedMesh ? geo.attributes.normal : null;
        m.multiplyMatrices(inv, o.matrixWorld); nm.getNormalMatrix(m);
        const cnt = pos.count, step = Math.max(1, Math.floor(cnt / 160)), ys = [];
        for (let i = 0; i < cnt; i += step) {
          v.fromBufferAttribute(pos, i); if (o.isSkinnedMesh && o.applyBoneTransform) o.applyBoneTransform(i, v); v.applyMatrix4(m);
          if (!Number.isFinite(v.y)) continue;
          ys.push(v.y);
          if (!vis || occ || !o.isMesh) continue;
          // superficie che si vede dalla camera (davanti, sopra o sotto): normale verso l'esterno della
          // testa e verso avanti (le pareti dietro la testa non contano), o materiale a due facce
          let out = true;
          if (nor) { n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); out = n.z > 0.15 && n.x * (v.x - C.c[0]) + n.y * (v.y - C.c[1]) + n.z * (v.z - C.c[2]) > 0; }
          else out = v.z > C.c[2];
          if (!out) continue;
          tot++; if (inCr(v) && !inOld(v)) lost++;
        }
        if (!ys.length) return;
        ys.sort((a, b) => a - b);
        items.push({ o, lo: ys[Math.floor(0.1 * (ys.length - 1))], hi: ys[Math.floor(0.9 * (ys.length - 1))], occ });
      });
      // la calotta vera nasconde l'interno dei cappelli e il retro di fasce e tese; gli accessori
      // aderenti fatti sull'ellissoide piccolo (fiocchi, cerchietti, parrucche corte) ci finirebbero
      // dentro: si accende solo se nasconde meno di HEAD.lost della loro superficie esterna
      fit.lost = tot ? lost / tot : 0;
      fit.cranium = eff.cranium != null ? !!eff.cranium : fit.lost < HEAD.lost;
      if (eff.neck === false) return;
      const neck = items.filter(it => it.hi <= NECK.below);
      if (!neck.length) return;
      // qualcosa d'altro (non occlusore) scende nella zona del collo? allora niente correzione
      if (items.some(it => !it.occ && it.hi > NECK.below && it.lo < NECK.below)) return;
      for (const it of neck) this._hookDraw(it.o, 'neck');
      fit.neck = neck.map(it => it.o);
    }
    // correzione applicata solo mentre l'oggetto si disegna (la matrice si ripristina subito dopo)
    _hookDraw(o, kind) {
      const self = this, b0 = o.onBeforeRender, a0 = o.onAfterRender;
      o.onBeforeRender = function (r, sc, cam, geo, mat, grp) {
        b0.call(this, r, sc, cam, geo, mat, grp);
        const X = self._drawX && self._drawX[kind];
        if (X) { this.matrixWorld.premultiply(X.m); this.__tdX = X; }
      };
      o.onAfterRender = function (r, sc, cam, geo, mat, grp) {
        if (this.__tdX) { this.matrixWorld.premultiply(this.__tdX.mi); this.__tdX = null; }
        a0.call(this, r, sc, cam, geo, mat, grp);
      };
    }
    _neckFrame() {
      const fit = this.effect.fit;
      if (!fit || !fit.neck.length) { if (this._drawX) this._drawX.neck = null; return; }
      const { THREE } = _libs;
      const X = (this._drawX || (this._drawX = {})).neck || (this._drawX.neck = { m: new THREE.Matrix4(), mi: new THREE.Matrix4(), l: new THREE.Matrix4(), t: new THREE.Matrix4() });
      const a = -NECK.damp * Math.max(-NECK.max, Math.min(NECK.max, this.pose.pitch || 0));
      const P = NECK.pivot;
      // locale (testa): T(pivot)·Rx(a)·T(−pivot); mondo: H·locale·H⁻¹
      X.l.makeRotationX(a);
      X.t.makeTranslation(P[0], P[1], P[2]); X.l.premultiply(X.t);
      X.t.makeTranslation(-P[0], -P[1], -P[2]); X.l.multiply(X.t);
      X.m.copy(this.faceGroup.matrix).multiply(X.l).multiply(X.t.copy(this.faceGroup.matrix).invert());
      X.mi.copy(X.m).invert();
      this._drawX.neck = X;
    }

    render(nowMs) {
      if (!this.ready) return;
      const t = (nowMs - this._t0) / 1000;
      // viso perso da più di POSE.lostHide: al prossimo aggancio serve di nuovo la conferma
      if (!this.tracking && this._lostAt && nowMs - this._lostAt > POSE.lostHide && this.confirmed) this._resetPose();
      const gapR = this._lastRender ? nowMs - this._lastRender : 0;
      const pr = this.confirmed ? this._predictPose(nowMs) : null;
      if (pr) {
        // lisciatura leggera (meno tremolio), poi matrice del gruppo. Si parte (o si
        // riparte, dopo una pausa o un salto confermato) dalla posa misurata, mai da lontano
        if (!this._smooth || this._snap || gapR > 300) { this._smooth = this._smooth || { p: pr.p.clone(), q: pr.q.clone() }; this._smooth.p.copy(pr.p); this._smooth.q.copy(pr.q); this._snap = false; }
        else { this._smooth.p.lerp(pr.p, 0.6); this._smooth.q.slerp(pr.q, 0.6); }
        // scala: quella misurata (MediaPipe dà ~1, le misure fuori da 0,6–1,6 sono già scartate)
        this.faceGroup.matrix.compose(this._smooth.p, this._smooth.q, this._meas.s);
        this.faceGroup.matrixWorldNeedsUpdate = true;
        // la mesh del viso è nello spazio camera dell'istante misurato: la si
        // sposta della stessa differenza (posa disegnata · misurata⁻¹)
        this.faceMesh.matrix.copy(this.faceGroup.matrix).multiply(this._tmp.m.copy(this._meas.m).invert());
        this.faceMesh.matrixWorldNeedsUpdate = true;
      }
      // espressioni: filtro verso i valori calibrati + medie comode
      const dt = this._lastRender ? (nowMs - this._lastRender) / 1000 : 1 / 30; this._lastRender = nowMs;
      if (calibration.smooth(this.bs, dt)) for (const a in BS_ALIAS) { const ns = BS_ALIAS[a]; let s = 0; for (let i = 0; i < ns.length; i++) s += this.bs[ns[i]] || 0; this.bs[a] = s / ns.length; }
      if (this._smooth) this._updatePose(t);
      const vis = this.confirmed && !!this._smooth && (this.tracking || (this._lostAt && nowMs - this._lostAt < POSE.lostHide));
      this.faceGroup.visible = vis && !!this.effect;
      this.faceMesh.visible = vis && !!this.effect && (!this.effect.hideHead || this.effect.def.type === 'paint');
      if (this.effect?.update) { try { this.effect.update(this.bs, t); } catch (e) { if (!this._updErr) { this._updErr = true; console.warn('[FaceAR] update', e); } } }
      if (this.effect && this._smooth) { if (!this.effect.fit) this._fitEffect(this.effect); this._neckFrame(); }
      this.cranium.visible = this.skull.visible && !!(this.effect && this.effect.fit && this.effect.fit.cranium);
      if (this.cranium.material !== this.skull.material) this.cranium.material = this.skull.material;   // (i banchi di prova colorano lo skull)
      this.renderer.render(this.scene, this.camera);
      this._fpsN++; if (nowMs - this._fpsT > 1000) { this.fps = this._fpsN; this._fpsN = 0; this._fpsT = nowMs; }
    }

    // posa della testa disegnata in angoli (YXZ) e cm: la usano gli effetti per l'inerzia
    _updatePose(t) {
      const q = this._smooth.q, p = this._smooth.p, P = this.pose;
      const x = q.x, y = q.y, z = q.z, w = q.w;
      // matrice di rotazione → Eulero YXZ (come three.js)
      const m13 = 2 * (x * z + w * y), m23 = 2 * (y * z - w * x), m33 = 1 - 2 * (x * x + y * y), m21 = 2 * (x * y + w * z), m22 = 1 - 2 * (x * x + z * z);
      const sx = Math.max(-1, Math.min(1, -m23));
      P.pitch = Math.asin(sx);
      if (Math.abs(sx) < 0.9999) { P.yaw = Math.atan2(m13, m33); P.roll = Math.atan2(m21, m22); } else { P.yaw = 0; P.roll = 0; }
      P.x = p.x; P.y = p.y; P.z = p.z; P.t = t;
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
      this._destroying = true;
      try { this.clearEffect(); } catch (_) { }
      // 1.8.6: libera subito la grafica 3D (Chrome ne tiene poche per pagina)
      try { this.renderer?.forceContextLoss?.(); } catch (_) { }
      try { document.removeEventListener('visibilitychange', this._onVis); } catch (_) { }
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
    /** Calibrazione delle espressioni (unica per la pagina): .info, .raw, .neutral, .reset() */
    static get calibration() { return calibration; }
    static get libsLoaded() { return !!_libs; }
    /** Il browser può disegnare il 3D? (WebGL 2: Chrome, Edge, Firefox, Safari 15+)
     *  1.8.6: un «no» non è più per sempre. Chrome può rifiutare la grafica 3D per un
     *  momento (scheda grafica sotto sforzo, processo della grafica ripartito, cambio
     *  di scheda grafica sui MacBook): il «no» vale 4 secondi, poi si ricontrolla. */
    static get supported() {
      const now = Date.now();
      if (FaceAR._sup === true) return true;
      if (FaceAR._sup === false && now - (FaceAR._supAt || 0) < 4000) return false;
      return FaceAR.recheck();
    }
    /** Ricontrolla subito; FaceAR.supportInfo dice anche perché ha detto di no. */
    static recheck() {
      let ok = false, reason = '';
      try {
        const c = document.createElement('canvas');
        c.addEventListener('webglcontextcreationerror', (e) => { reason = (e && e.statusMessage) || reason; }, { once: true });
        const gl = c.getContext('webgl2');
        ok = !!gl;
        if (!ok) reason = reason || (c.getContext('webgl') ? 'WebGL 2 assente (c\'è solo WebGL 1)' : 'nessun contesto WebGL');
        gl?.getExtension('WEBGL_lose_context')?.loseContext();
      } catch (e) { ok = false; reason = String(e && e.message || e); }
      FaceAR._sup = ok; FaceAR._supAt = Date.now();
      FaceAR.supportInfo = { ok, reason: ok ? '' : reason, at: FaceAR._supAt };
      return ok;
    }
  }

  /** Opzioni del motore (per le prove: si possono spegnere dalla console). */
  FaceAR.options = { refinePose: true };
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
