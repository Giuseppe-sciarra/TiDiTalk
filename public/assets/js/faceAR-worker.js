/* ═══════════════════════════════════════════════════════════════════════════
   FaceAR worker (1.7.0) — il rilevamento del viso gira qui, fuori dalla pagina.
   ───────────────────────────────────────────────────────────────────────────
   Sulla pagina restano solo il disegno 3D e la composizione: caricare il
   modello (decine di MB di WebAssembly) e analizzare ogni fotogramma non
   bloccano più la chiamata, la chat o la connessione col server.

   Messaggi:
     → { type:'init', base, delegate }          ← { type:'ready', delegate, ms } | { type:'error', message }
     → { type:'frame', bitmap, ts }             ← { type:'result', ts, lms:Float32Array(n*3)|null, mtx:Float32Array(16)|null, bs:Float32Array|null, names?:string[], cost }
   La pagina manda un fotogramma solo quando ha ricevuto la risposta al precedente.
   ═══════════════════════════════════════════════════════════════════════════ */
let landmarker = null, names = null, sentNames = false, delegate = 'GPU';

self.onmessage = async (e) => {
  const m = e.data || {};
  if (m.type === 'init') {
    const t0 = performance.now();
    // MediaPipe usa la grafica (WebGL) anche col calcolo su CPU, per leggere i fotogrammi:
    // senza WebGL nel worker (Safari prima della 17) non trova mai il viso → si torna sulla pagina
    const gl = (() => { try { const ok = (t) => { const c = new OffscreenCanvas(1, 1).getContext(t); c?.getExtension('WEBGL_lose_context')?.loseContext(); return !!c; }; return ok('webgl2') || ok('webgl'); } catch (_) { return false; } })();
    if (!gl) { self.postMessage({ type: 'error', message: 'WebGL non disponibile nel worker' }); return; }
    try {
      const vision = await import(`${m.base}/mediapipe_tasks/vision_bundle.mjs`);
      // nel worker a moduli serve la variante "module" del caricatore WebAssembly;
      // la si importa qui (imposta globalThis.ModuleFactory): Firefox altrimenti
      // non la carica da solo ("ModuleFactory not set")
      // (tasks-vision la azzera dopo ogni uso: la si rimette prima di ogni tentativo)
      const factory = (await import(`${m.base}/mediapipe_tasks/wasm/vision_wasm_module_internal.js`)).default;
      const fileset = await vision.FilesetResolver.forVisionTasks(`${m.base}/mediapipe_tasks/wasm`, true);
      const make = (d) => (self.ModuleFactory = factory, vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: `${m.base}/mediapipe_tasks/face_landmarker.task`, delegate: d },
        runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true,
        ...(d === 'GPU' && typeof OffscreenCanvas !== 'undefined' ? { canvas: new OffscreenCanvas(1, 1) } : {}),
      }));
      delegate = m.delegate || 'GPU';
      try { landmarker = await make(delegate); }
      catch (err) { delegate = 'CPU'; landmarker = await make('CPU'); }
      self.postMessage({ type: 'ready', delegate, ms: Math.round(performance.now() - t0) });
    } catch (err) {
      self.postMessage({ type: 'error', message: String(err?.message || err) });
    }
    return;
  }
  if (m.type === 'frame') {
    const bmp = m.bitmap;
    if (!landmarker) { try { bmp?.close?.(); } catch (_) { } self.postMessage({ type: 'result', ts: m.ts, lms: null, mtx: null, bs: null, cost: 0 }); return; }
    const t0 = performance.now();
    let res = null;
    try { res = landmarker.detectForVideo(bmp, m.ts); } catch (err) { /* fotogramma saltato */ }
    try { bmp?.close?.(); } catch (_) { }
    const out = { type: 'result', ts: m.ts, lms: null, mtx: null, bs: null, cost: Math.round(performance.now() - t0) };
    const L = res?.faceLandmarks?.[0];
    const X = res?.facialTransformationMatrixes?.[0]?.data;
    const B = res?.faceBlendshapes?.[0]?.categories;
    const transfer = [];
    if (L && X) {
      out.lms = new Float32Array(L.length * 3);
      for (let i = 0; i < L.length; i++) { out.lms[i * 3] = L[i].x; out.lms[i * 3 + 1] = L[i].y; out.lms[i * 3 + 2] = L[i].z; }
      out.mtx = Float32Array.from(X);
      transfer.push(out.lms.buffer, out.mtx.buffer);
      if (B) {
        if (!names) names = B.map(c => c.categoryName);
        if (!sentNames) { out.names = names; sentNames = true; }
        out.bs = Float32Array.from(B.map(c => c.score));
        transfer.push(out.bs.buffer);
      }
    }
    self.postMessage(out, transfer);
  }
};
