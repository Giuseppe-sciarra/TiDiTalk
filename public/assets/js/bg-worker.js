/* ═══════════════════════════════════════════════════════════════════════════
   Sfondi virtuali — worker (1.9.0). La separazione persona / sfondo gira qui,
   fuori dalla pagina: la chiamata, la chat e il disegno non rallentano.
   Modello: MediaPipe Tasks ImageSegmenter con selfie_segmenter (256×256),
   lo stesso pacchetto tasks-vision degli effetti 3D (vendor/mediapipe_tasks).

   Messaggi:
     → { type:'init', base, delegate }   ← { type:'ready', delegate, ms } | { type:'error', message }
     → { type:'frame', bitmap, ts }      ← { type:'mask', ts, w, h, data:Uint8ClampedArray(w*h), cost }
   La pagina manda un fotogramma solo dopo aver ricevuto la maschera del precedente.
   ═══════════════════════════════════════════════════════════════════════════ */
let seg = null, delegate = 'GPU';

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

self.onmessage = async (e) => {
  const m = e.data || {};
  if (m.type === 'init') {
    const t0 = performance.now();
    // come faceAR-worker: senza WebGL nel worker (Safari prima della 17) MediaPipe non legge
    // i fotogrammi → la pagina fa da sola (sul thread principale)
    const gl = (() => { try { const ok = (t) => { const c = new OffscreenCanvas(1, 1).getContext(t); c?.getExtension('WEBGL_lose_context')?.loseContext(); return !!c; }; return ok('webgl2') || ok('webgl'); } catch (_) { return false; } })();
    if (!gl) { self.postMessage({ type: 'error', message: 'WebGL non disponibile nel worker' }); return; }
    try {
      const vision = await import(`${m.base}/mediapipe_tasks/vision_bundle.mjs`);
      const factory = (await import(`${m.base}/mediapipe_tasks/wasm/vision_wasm_module_internal.js`)).default;
      const fileset = await vision.FilesetResolver.forVisionTasks(`${m.base}/mediapipe_tasks/wasm`, true);
      const make = (d) => (self.ModuleFactory = factory, vision.ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: `${m.base}/mediapipe_tasks/selfie_segmenter.tflite`, delegate: d },
        runningMode: 'VIDEO', outputCategoryMask: false, outputConfidenceMasks: true,
        ...(d === 'GPU' && typeof OffscreenCanvas !== 'undefined' ? { canvas: new OffscreenCanvas(1, 1) } : {}),
      }));
      delegate = m.delegate || 'GPU';
      try { seg = await make(delegate); }
      catch (err) { delegate = 'CPU'; seg = await make('CPU'); }
      self.postMessage({ type: 'ready', delegate, ms: Math.round(performance.now() - t0) });
    } catch (err) {
      self.postMessage({ type: 'error', message: String(err?.message || err) });
    }
    return;
  }
  if (m.type === 'frame') {
    const bmp = m.bitmap;
    const out = { type: 'mask', ts: m.ts, w: 0, h: 0, data: null, cost: 0 };
    if (!seg || !bmp) { try { bmp?.close?.(); } catch (_) { } self.postMessage(out); return; }
    const t0 = performance.now();
    try {
      const res = seg.segmentForVideo(bmp, m.ts);
      const mask = res?.confidenceMasks?.[0];
      if (mask) {
        const f = mask.getAsFloat32Array();
        const data = new Uint8ClampedArray(f.length);
        for (let i = 0; i < f.length; i++) data[i] = f[i] * 255;
        out.w = mask.width; out.h = mask.height; out.data = cleanMask(data, mask.width, mask.height);
      }
      try { res?.close?.(); } catch (_) { }
    } catch (err) { /* fotogramma saltato */ }
    try { bmp.close?.(); } catch (_) { }
    out.cost = Math.round(performance.now() - t0);
    self.postMessage(out, out.data ? [out.data.buffer] : []);
  }
};
