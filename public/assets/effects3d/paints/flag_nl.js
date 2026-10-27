// Bandiera dei Paesi Bassi (rosso, bianco, blu orizzontali), dipinta su entrambe le guance con texture di pennello leggera.
export const meta = { label: 'Bandiera olandese', labelEn: 'Netherlands flag cheeks', category: 'maschere', icon: '🇳🇱' };
// ── helper comuni (incorporati in ogni modulo: i moduli non importano nulla) ──────────────────
const _ctr = (h, ids) => { let x = 0, y = 0; for (const i of ids) { const p = h.uv(i); x += p[0]; y += p[1]; } return [x / ids.length, y / ids.length]; };
const _rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const _rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
// disegna fn(1) e poi la stessa cosa specchiata attorno a x = size/2 (fn(-1))
function _mirror(ctx, size, fn) { fn(1); ctx.save(); ctx.translate(size, 0); ctx.scale(-1, 1); fn(-1); ctx.restore(); }
// alone sfumato ellittico: colore c=[r,g,b], alpha a al centro → 0 al bordo; inner = quota piena
function _glow(ctx, x, y, rx, ry, c, a = 1, inner = 0, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, rx * inner, 0, 0, rx); g.addColorStop(0, _rgba(c, a)); g.addColorStop(1, _rgba(c, 0));
  ctx.fillStyle = g; ctx.fillRect(-rx, -rx, 2 * rx, 2 * rx); ctx.restore();
}
function _ell(ctx, x, y, rx, ry, col, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); if (col) { ctx.fillStyle = col; ctx.fill(); } }
// base coat su tutto l'ovale del viso, bordo sfumato
function _base(ctx, h, col, alpha = 1, feather = 16) { ctx.save(); ctx.globalAlpha = alpha; ctx.filter = `blur(${feather}px)`; ctx.fillStyle = col; h.poly(h.FACE_OVAL); ctx.fill(); ctx.restore(); }
// cancella (destination-out) un contorno di landmark, allargato di pad px e sfumato
function _cut(ctx, h, ids, pad = 8, blur = 2, amount = 1) {
  ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.globalAlpha = amount; ctx.fillStyle = '#000'; ctx.strokeStyle = '#000';
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(pad, .1); ctx.filter = `blur(${blur}px)`; h.poly(ids); ctx.fill(); if (pad > 0) ctx.stroke(); ctx.restore();
}
function _cutEyes(ctx, h, pad = 8, blur = 2, amount = 1) { _cut(ctx, h, h.EYE_L, pad, blur, amount); _cut(ctx, h, h.EYE_R, pad, blur, amount); }
// rifinitura finale (chiamata per ultima da ogni effetto):
//  • bordo morbido lungo l'ovale del viso e più trasparenza all'attaccatura dei capelli e sotto la mandibola
//    → sulla pelle vera la pittura sfuma invece di finire netta come un adesivo;
//  • buchi per gli occhi (seguono le palpebre: se strizzi gli occhi il buco si stringe con loro);
//  • buco sulla bocca interna: i triangoli della mesh che attraversano la bocca prendono il colore di quella striscia
//    della texture; se è trasparente, a bocca aperta si vedono i denti veri.
//  • compressione delle luci: nell'app la pittura è illuminata (hemi 1.1 + key 1.5), un bianco puro diventerebbe
//    bianco bruciato; i toni chiari vengono abbassati in modo morbido (sulla luminanza, i colori restano saturi).
// o = { edge: 0..1.5 (forza della sfumatura, 0 = niente), top: moltiplicatore della sfumatura all'attaccatura dei capelli,
//       eyes: pad px | false, mouth: pad px | false, tone: false per non comprimere le luci,
//       grain: 0..0.3 trasparenza irregolare a macchie (la pelle e i pori si intravedono, aspetto da pittura vera) }
const _OVAL_TOP = [127, 162, 21, 54, 103, 67, 109, 10, 338, 297, 332, 284, 251, 389, 356];
const _OVAL_BOT = [323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93];
function _finish(ctx, h, o = {}) {
  const edge = o.edge ?? 1, eyes = o.eyes ?? 5, mouth = o.mouth ?? 8, top = o.top ?? 1;
  if (edge > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = '#000';
    // bordo dell'ovale: trasparente sul bordo, piena ~30 px più dentro
    ctx.filter = `blur(${Math.round(14 * edge)}px)`; ctx.lineWidth = 44 * edge; h.poly(h.FACE_OVAL); ctx.stroke();
    // attaccatura dei capelli: fascia larga e leggera
    ctx.filter = `blur(${Math.round(30 * edge)}px)`; ctx.globalAlpha = .42 * top; ctx.lineWidth = 120 * edge;
    ctx.beginPath(); _OVAL_TOP.forEach((i, k) => { const p = h.uv(i); k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); ctx.stroke();
    // mandibola e sotto il mento
    ctx.globalAlpha = .3; ctx.lineWidth = 90 * edge;
    ctx.beginPath(); _OVAL_BOT.forEach((i, k) => { const p = h.uv(i); k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); ctx.stroke();
    ctx.restore();
  }
  if (eyes !== false) _cutEyes(ctx, h, eyes, 2);
  if (mouth !== false) _cut(ctx, h, h.LIPS_INNER, mouth, 1);
  if (o.tone !== false || o.grain) _pixels(ctx, h.size || 1024, o.tone !== false, o.grain || 0);
}
// un solo passaggio sui pixel (una sola lettura/scrittura della tela): compressione delle luci + grana
function _pixels(ctx, size, tone, grain, knee = 150, slope = .45, cell = 6) {
  let img; try { img = ctx.getImageData(0, 0, size, size); } catch (_) { return; }
  const d = img.data; let grid = null, G = 0;
  if (grain > 0) { G = Math.ceil(size / cell) + 2; const rnd = _rng(5); grid = new Float32Array(G * G); for (let i = 0; i < grid.length; i++) grid[i] = rnd(); }
  for (let y = 0; y < size; y++) { const gy = y / cell, iy = gy | 0, fy = gy - iy;
    for (let x = 0; x < size; x++) { const i = (y * size + x) * 4; if (!d[i + 3]) continue;
      if (tone) { const L = .299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2]; if (L > knee) { const f = (knee + (L - knee) * slope) / L; d[i] *= f; d[i + 1] *= f; d[i + 2] *= f; } }
      if (grid) { const gx = x / cell, ix = gx | 0, fx = gx - ix, a0 = grid[iy * G + ix], a1 = grid[iy * G + ix + 1], b0 = grid[(iy + 1) * G + ix], b1 = grid[(iy + 1) * G + ix + 1];
        d[i + 3] *= 1 - grain * ((a0 + (a1 - a0) * fx) * (1 - fy) + (b0 + (b1 - b0) * fx) * fy); } } }
  ctx.putImageData(img, 0, 0);
}
function _tone(ctx, size, knee = 150, slope = .45) {
  let img; try { img = ctx.getImageData(0, 0, size, size); } catch (_) { return; }
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const L = .299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2];
    if (L > knee) { const f = (knee + (L - knee) * slope) / L; d[i] *= f; d[i + 1] *= f; d[i + 2] *= f; }
  }
  ctx.putImageData(img, 0, 0);
}
// toppa dipinta sulla guancia (bandiere, tatuaggi): draw(ctx, W, H) disegna nel riquadro centrato in 0,0.
// Sul lato specchiato il contenuto viene ri-raddrizzato, così scritte/bandiere asimmetriche si leggono giuste
// su entrambe le guance; l'inclinazione invece resta speculare (segue lo zigomo).
function _cheeks(ctx, h, draw, o = {}) {
  const size = h.size || 1024, W = o.W ?? 200, H = o.H ?? 140, rot = o.rot ?? .16, r = o.r ?? 12;
  const cL = h.uv(50), chL = h.uv(123), cx = (cL[0] + chL[0]) / 2 - 18 + (o.dx || 0), cy = cL[1] + 88 + (o.dy || 0);
  _mirror(ctx, size, (sgn) => {
    if (o.only && o.only !== sgn) return;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); if (sgn < 0) ctx.scale(-1, 1);
    if (o.clip !== false) { ctx.beginPath(); ctx.roundRect(-W / 2, -H / 2, W, H, r); ctx.save(); ctx.filter = 'blur(1.2px)'; ctx.clip(); }
    draw(ctx, W, H, sgn);
    if (o.clip !== false) { ctx.restore(); ctx.beginPath(); ctx.roundRect(-W / 2, -H / 2, W, H, r); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(0,0,0,.16)'; ctx.stroke(); }
    // lucido leggero della pittura
    if (o.clip !== false) _glow(ctx, -W * .2, -H * .25, W * .45, H * .3, [255, 255, 255], .14);
    ctx.restore();
  });
}
// stella a 5 punte piena centrata in x,y (raggio R)
function _star(ctx, x, y, R, col, rot = 0, inner = .45) { ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + rot + k * Math.PI / 5, rr = k % 2 ? R * inner : R; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); if (col) { ctx.fillStyle = col; ctx.fill(); } }
// cuore pieno centrato in x,y (larghezza ~2s)
function _heart(ctx, x, y, s, col, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.beginPath(); ctx.moveTo(0, s * .95);
  ctx.bezierCurveTo(-s * 1.25, s * .1, -s * .95, -s * .95, 0, -s * .35); ctx.bezierCurveTo(s * .95, -s * .95, s * 1.25, s * .1, 0, s * .95); ctx.closePath();
  if (col) { ctx.fillStyle = col; ctx.fill(); } ctx.restore();
}
// scintilla a 4 punte con alone
function _spark(ctx, x, y, r, col = '#fff', a = 1, halo = [255, 235, 180]) {
  ctx.save(); ctx.globalAlpha = a; if (halo) _glow(ctx, x, y, r * 2, r * 2, halo, .45);
  _taper(ctx, [[x - r, y], [x, y], [x + r, y]], 0, r * .32, col); _taper(ctx, [[x, y - r], [x, y], [x, y + r]], 0, r * .32, col);
  _taper(ctx, [[x + r, y], [x, y]], 0, r * .32, col); _taper(ctx, [[x, y + r], [x, y]], 0, r * .32, col); _ell(ctx, x, y, r * .2, r * .2, '#fff'); ctx.restore();
}
// rossetto: riempie le labbra (bordo esterno) con gradiente e luce sul labbro inferiore
function _lips(ctx, h, c0, c1, a = 1, gloss = .35) {
  const t = h.uv(0), b = h.uv(17);
  ctx.save(); ctx.globalAlpha = a; ctx.filter = 'blur(1.2px)'; const g = ctx.createLinearGradient(0, t[1] - 10, 0, b[1] + 10); g.addColorStop(0, c0); g.addColorStop(1, c1); ctx.fillStyle = g; h.poly(h.LIPS_OUTER); ctx.fill(); ctx.restore();
  if (gloss > 0) { ctx.save(); h.poly(h.LIPS_OUTER); ctx.clip(); _glow(ctx, t[0] - 6, b[1] - 16, 34, 9, [255, 235, 240], gloss); _glow(ctx, t[0] - 30, t[1] + 12, 18, 5, [255, 235, 240], gloss * .6); ctx.restore(); }
}
// linea sulla palpebra superiore (eyeliner) che segue il contorno vero dell'occhio sinistro (usare dentro _mirror)
const _UPPER_L = [33, 246, 161, 160, 159, 158, 157, 173, 133], _LOWER_L = [33, 7, 163, 144, 145, 153, 154, 155, 133];
function _liner(ctx, h, w, col, wing = 0, lift = 0) {
  const up = _UPPER_L.map(i => { const p = h.uv(i); return [p[0], p[1] - lift]; });
  // spessore crescente verso l'esterno
  _taper(ctx, up.slice().reverse(), w * .35, w, col);
  if (wing > 0) { const p = up[0]; _taper(ctx, [[p[0] + 4, p[1] + 1], [p[0] - wing * .55, p[1] - wing * .32], [p[0] - wing, p[1] - wing * .62]], w * .95, 1, col); }
}
// polilinea densa (Catmull-Rom) passante per i punti dati
function _smooth(pts, seg = 10, closed = false) {
  const n = pts.length, out = []; if (n < 2) return pts.slice();
  const P = (i) => closed ? pts[(i + n) % n] : pts[Math.min(n - 1, Math.max(0, i))];
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let k = 0; k < seg; k++) {
      const t = k / seg, t2 = t * t, t3 = t2 * t;
      out.push([.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
                .5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
    }
  }
  if (!closed) out.push(pts[n - 1]); return out;
}
// path morbido attraverso i punti (da usare con stroke/fill)
function _path(ctx, pts, closed = false) { const s = _smooth(pts, 8, closed); ctx.beginPath(); ctx.moveTo(s[0][0], s[0][1]); for (let i = 1; i < s.length; i++) ctx.lineTo(s[i][0], s[i][1]); if (closed) ctx.closePath(); }
// pennellata affusolata lungo i punti (smussati): larghezza w0 all'inizio → w1 alla fine
function _taper(ctx, pts, w0, w1, col, pow = 1) {
  const s = _smooth(pts, 8), n = s.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = s[Math.max(0, i - 1)], b = s[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const t = Math.pow(i / (n - 1), pow), w = (w0 + (w1 - w0) * t) / 2;
    L.push([s[i][0] - dy * w, s[i][1] + dx * w]); R.push([s[i][0] + dy * w, s[i][1] - dx * w]);
  }
  ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]); for (let i = 1; i < n; i++) ctx.lineTo(L[i][0], L[i][1]);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]); ctx.closePath(); if (col) ctx.fillStyle = col; ctx.fill();
}
// linea morbida con estremi arrotondati
function _stroke(ctx, pts, w, col, alpha = 1) { ctx.save(); ctx.globalAlpha = alpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = w; ctx.strokeStyle = col; _path(ctx, pts); ctx.stroke(); ctx.restore(); }
// contorno occhi comodo: centro, mezze larghezze
function _eye(h, ids) { const c = _ctr(h, ids); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const i of ids) { const p = h.uv(i); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); } return { x: c[0], y: c[1], w: (x1 - x0) / 2, hh: (y1 - y0) / 2, x0, x1, y0, y1 }; }
// ──────────────────────────────────────────────────────────────────────────────────────────────
// viso "statua di metallo": base metallica + ombre e luci scolpite sui volumi del viso (orbite, naso, zigomi, labbra, mento)
// P = { lo: [r,g,b] ombre, mid: [r,g,b] tono base, hi: [r,g,b] luci, spec: [r,g,b] riflessi }
function _metal(ctx, h, P) {
  const size = h.size || 1024, mid = size / 2, A = h.ANCHORS || {};
  const EL = _eye(h, h.EYE_L), yTop = h.uv(10)[1], yChin = h.uv(152)[1], yBrow = h.uv(105)[1], bridge = h.uv(168), nT = h.uv(1), nL = h.uv(49), nB = h.uv(2);
  const lip = h.uv(0), lipB = h.uv(17), mL = h.uv(61), chL = h.uv(123), cL = h.uv(50), tL = h.uv(127), jL = h.uv(172);
  const g = ctx.createLinearGradient(0, yTop, 0, yChin); g.addColorStop(0, _rgba(P.mid.map((v, i) => (v + P.hi[i]) / 2), 1)); g.addColorStop(.45, _rgba(P.mid, 1)); g.addColorStop(1, _rgba(P.mid.map((v, i) => (v + P.lo[i]) / 2), 1));
  _base(ctx, h, g, .97, 14);
  ctx.save(); h.poly(h.FACE_OVAL); ctx.clip();
  const lo = (x, y, rx, ry, a, rot = 0) => _glow(ctx, x, y, rx, ry, P.lo, a, 0, rot), hi = (x, y, rx, ry, a, rot = 0) => _glow(ctx, x, y, rx, ry, P.hi, a, 0, rot);
  _mirror(ctx, size, () => {
    lo(tL[0] + 40, tL[1] + 40, 90, 230, .55);                        // lati del viso in ombra
    lo(EL.x, EL.y + 4, EL.w + 40, EL.hh + 34, .6);                    // orbite
    lo(EL.x + 30, yBrow + 40, 70, 18, .4);                            // sotto l'arcata
    hi(EL.x - 10, yBrow - 34, 90, 24, .55);                           // arcata sopraccigliare
    lo(nL[0] - 6, (bridge[1] + nT[1]) / 2 + 10, 22, 90, .5);          // fianchi del naso
    hi(chL[0] + 50, chL[1] - 4, 100, 28, .7, -.35);                   // zigomo
    lo(cL[0] - 50, cL[1] + 130, 100, 70, .45);                        // guancia scavata
    lo(mL[0] - 40, mL[1] - 20, 30, 80, .35, .4);                      // solco naso-labiale
    lo(jL[0] + 40, jL[1] + 10, 120, 60, .45, -.4);                    // mandibola
  });
  hi(mid, yTop + 90, 200, 70, .55);                                   // fronte
  hi(mid, (bridge[1] + nT[1]) / 2 - 10, 18, 110, .7);                 // dorso del naso
  hi(mid - 14, nT[1] - 26, 26, 18, .9);                               // punta del naso
  lo(mid, nB[1] + 14, 70, 22, .6);                                    // sotto il naso
  lo(mid, lipB[1] + 20, 80, 22, .6);                                  // sotto il labbro inferiore
  hi(mid, h.uv(199)[1] + 10, 70, 40, .6);                             // mento
  ctx.restore();
  // labbra: un tono più scuro con riflesso
  _lips(ctx, h, _rgba(P.mid.map((v, i) => (v + P.lo[i]) / 2), 1), _rgba(P.lo, 1), .7, .0);
  ctx.save(); h.poly(h.LIPS_OUTER); ctx.clip(); _glow(ctx, mid, lipB[1] - 14, 46, 10, P.spec, .7); ctx.restore();
  // sopracciglia in rilievo (ombra sotto, luce sopra)
  _mirror(ctx, size, () => { const b = [70, 63, 105, 66, 107].map(i => h.uv(i)); _stroke(ctx, b.map(p => [p[0], p[1] + 9]), 9, _rgba(P.lo, .45)); _stroke(ctx, b.map(p => [p[0], p[1] - 4]), 7, _rgba(P.hi, .5)); });
  // riflessi speculari puntuali (metallo lucido)
  _glow(ctx, mid - 60, yTop + 80, 50, 10, P.spec, .7, 0, -.2); _glow(ctx, mid - 12, nT[1] - 30, 9, 6, P.spec, 1);
  _mirror(ctx, size, () => { _glow(ctx, chL[0] + 60, chL[1] - 8, 30, 7, P.spec, .7, 0, -.35); _glow(ctx, EL.x - 30, yBrow - 40, 26, 6, P.spec, .6); });
  // bordo scuro attorno agli occhi (palpebre di metallo)
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = 9; ctx.strokeStyle = _rgba(P.lo, .85); h.poly(h.EYE_L); ctx.stroke(); h.poly(h.EYE_R); ctx.stroke(); ctx.restore();
}
// ── pennello "pittorico" (effetti nuovi) ─────────────────────────────────────────────────────────
// profilo di pressione di una pennellata: attacco morbido, pieno al centro, coda che si assottiglia
const _press = (t) => Math.sin(Math.min(1, t * 1.7 + .06) * Math.PI / 2) * (1 - Math.pow(t, 2.6) * .8);
// pennellata a setole lungo pts: corpo morbido + setole sottili sfalsate (colore e lunghezza variabili)
// col = [r,g,b]; o = { a, bristles, seed, dry (0..1: più "secco" = setole più visibili), jit (variazione colore) }
function _brush(ctx, pts, w, col, o = {}) {
  const rnd = _rng(o.seed ?? (((pts[0][0] * 73 + pts[0][1] * 31) | 0) + 7)), s = _smooth(pts, 10), n = s.length; if (n < 2) return;
  const a = o.a ?? 1, dry = o.dry ?? .5, jit = o.jit ?? 14, nb = o.bristles ?? Math.max(5, Math.round(w / 2.4));
  const N = s.map((p, i) => { const q = s[Math.min(n - 1, i + 1)], r = s[Math.max(0, i - 1)]; let dx = q[0] - r[0], dy = q[1] - r[1]; const d = Math.hypot(dx, dy) || 1; return [-dy / d, dx / d]; });
  // corpo
  const L = [], R = [];
  for (let i = 0; i < n; i++) { const hw = w / 2 * _press(i / (n - 1)) * .85; L.push([s[i][0] + N[i][0] * hw, s[i][1] + N[i][1] * hw]); R.push([s[i][0] - N[i][0] * hw, s[i][1] - N[i][1] * hw]); }
  ctx.save(); ctx.globalAlpha = a * (1 - dry * .55); ctx.fillStyle = _rgba(col, 1); ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]); L.forEach(p => ctx.lineTo(p[0], p[1])); for (let i = n - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]); ctx.closePath(); ctx.fill(); ctx.restore();
  // setole
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let k = 0; k < nb; k++) {
    const off = (rnd() - .5) * .95, t0 = rnd() * .12, t1 = 1 - rnd() * (.12 + dry * .25), lw = Math.max(.8, w / nb * (1.1 + rnd() * .8));
    const c = col.map(v => Math.max(0, Math.min(255, v + (rnd() - .5) * jit * 2)));
    ctx.globalAlpha = a * (.35 + rnd() * .45); ctx.strokeStyle = _rgba(c, 1); ctx.lineWidth = lw; ctx.beginPath();
    for (let i = Math.floor(t0 * (n - 1)); i <= Math.floor(t1 * (n - 1)); i++) { const hw = w / 2 * _press(i / (n - 1)) * off * 2; const x = s[i][0] + N[i][0] * hw, y = s[i][1] + N[i][1] * hw; i === Math.floor(t0 * (n - 1)) ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.restore();
}
// ciuffo di pelo: tratto affusolato e leggermente curvo da (x,y) con angolo ang
function _hair(ctx, x, y, ang, len, w, col, a = 1, bend = 0) {
  // ciuffo = due curve quadratiche che si chiudono in punta (molto più leggero di un _taper)
  const c = Math.cos(ang), s = Math.sin(ang), ex = x + c * len, ey = y + s * len, mx = x + c * len * .5 - s * bend, my = y + s * len * .5 + c * bend, hw = w / 2;
  ctx.globalAlpha = a; ctx.fillStyle = _rgba(col, 1); ctx.beginPath(); ctx.moveTo(x - s * hw, y + c * hw); ctx.quadraticCurveTo(mx - s * hw * .7, my + c * hw * .7, ex, ey); ctx.quadraticCurveTo(mx + s * hw * .7, my - c * hw * .7, x + s * hw, y - c * hw); ctx.closePath(); ctx.fill();
}
// campo di pelo: n ciuffi dentro clip(); dir(x,y) → angolo, color(x,y) → [r,g,b] o null per saltare
function _furField(ctx, n, box, clip, dir, color, o = {}) {
  const rnd = _rng(o.seed ?? 11), len = o.len ?? 26, w = o.w ?? 3.2, a = o.a ?? .5;
  ctx.save(); if (clip) { clip(); ctx.clip(); }
  for (let k = 0; k < n; k++) {
    const x = box[0] + rnd() * (box[2] - box[0]), y = box[1] + rnd() * (box[3] - box[1]), c = color(x, y, rnd); if (!c) continue;
    _hair(ctx, x, y, dir(x, y) + (rnd() - .5) * .35, len * (.6 + rnd() * .8), w * (.7 + rnd() * .6), c, a * (.6 + rnd() * .4), (rnd() - .5) * len * .25);
  }
  ctx.restore();
}
// squame sovrapposte (file dal basso verso l'alto: ogni fila copre la metà alta di quella sotto → si vedono le "U")
// color(x,y) → [r,g,b]; o = { r: raggio, edge: colore bordo [r,g,b], hi: alpha riflesso }
function _scales(ctx, box, clip, color, o = {}) {
  const R = o.r ?? 20, dy = R * .62, dx = R * 1.5, edge = o.edge ?? [20, 30, 25], hi = o.hi ?? .5;
  ctx.save(); if (clip) { clip(); ctx.clip(); }
  const rows = Math.ceil((box[3] - box[1]) / dy) + 2;
  for (let r = rows; r >= -1; r--) {
    const y = box[1] + r * dy, sh = (r % 2) * dx / 2;
    for (let x = box[0] - dx + sh; x < box[2] + dx; x += dx) {
      const c = color(x, y); if (!c) continue;
      const g = ctx.createRadialGradient(x - R * .25, y - R * .45, R * .1, x, y, R * 1.05);
      g.addColorStop(0, _rgba(c.map(v => Math.min(255, v + 70)), 1)); g.addColorStop(.55, _rgba(c, 1)); g.addColorStop(1, _rgba(c.map(v => v * .45), 1));
      ctx.beginPath(); ctx.ellipse(x, y, R * .78, R, 0, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 1.6; ctx.strokeStyle = _rgba(edge, .55); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x, y + R * .05, R * .62, R * .82, 0, Math.PI * .15, Math.PI * .85); ctx.lineWidth = 1.4; ctx.strokeStyle = `rgba(255,255,255,${hi})`; ctx.stroke();
    }
  }
  ctx.restore();
}
// gemma sfaccettata con ombra portata, faccette e riflesso a stella. c = [r,g,b]
function _gem(ctx, x, y, r, c, o = {}) {
  const sides = o.sides ?? 8, rot = o.rot ?? Math.PI / 8;
  _glow(ctx, x + r * .25, y + r * .45, r * 1.25, r * .9, [20, 10, 20], .35);                      // ombra sulla pelle
  const P = []; for (let k = 0; k < sides; k++) { const a = rot + k / sides * Math.PI * 2; P.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
  ctx.beginPath(); P.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
  const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r); g.addColorStop(0, _rgba(c.map(v => Math.min(255, v + 110)), 1)); g.addColorStop(.5, _rgba(c, 1)); g.addColorStop(1, _rgba(c.map(v => v * .35), 1));
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = Math.max(1, r * .12); ctx.strokeStyle = o.rim || 'rgba(230,200,120,.95)'; ctx.stroke();
  // faccette: tavola centrale + raggi
  const T = P.map(p => [x + (p[0] - x) * .5, y + (p[1] - y) * .5]);
  ctx.beginPath(); T.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fillStyle = _rgba(c.map(v => Math.min(255, v + 50)), .55); ctx.fill();
  ctx.lineWidth = .8; ctx.strokeStyle = 'rgba(255,255,255,.45)'; for (let k = 0; k < sides; k++) { ctx.beginPath(); ctx.moveTo(T[k][0], T[k][1]); ctx.lineTo(P[k][0], P[k][1]); ctx.stroke(); }
  _glow(ctx, x - r * .35, y - r * .35, r * .45, r * .3, [255, 255, 255], .9);
  if (o.star !== false) _spark(ctx, x - r * .3, y - r * .35, r * 1.1, '#ffffff', .85, null);
}
// perla con riflesso
function _pearl(ctx, x, y, r, tint = [250, 240, 235]) {
  _glow(ctx, x + r * .2, y + r * .4, r * 1.2, r * .8, [30, 20, 20], .3);
  const g = ctx.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r); g.addColorStop(0, '#ffffff'); g.addColorStop(.5, _rgba(tint, 1)); g.addColorStop(1, _rgba(tint.map(v => v * .62), 1));
  _ell(ctx, x, y, r, r, g); _glow(ctx, x + r * .3, y + r * .35, r * .35, r * .2, [255, 220, 240], .5);
}
// grana: la pittura non è uniforme, lascia trasparire un po' la pelle (pori) a macchie di qualche pixel
function _grain(ctx, size, amount = .1, cell = 6, seed = 5) {
  if (amount <= 0) return; let img; try { img = ctx.getImageData(0, 0, size, size); } catch (_) { return; }
  const d = img.data, G = Math.ceil(size / cell) + 2, rnd = _rng(seed), grid = new Float32Array(G * G); for (let i = 0; i < grid.length; i++) grid[i] = rnd();
  for (let y = 0; y < size; y++) { const gy = y / cell, iy = gy | 0, fy = gy - iy;
    for (let x = 0; x < size; x++) { const i = (y * size + x) * 4; if (!d[i + 3]) continue;
      const gx = x / cell, ix = gx | 0, fx = gx - ix, a0 = grid[iy * G + ix], a1 = grid[iy * G + ix + 1], b0 = grid[(iy + 1) * G + ix], b1 = grid[(iy + 1) * G + ix + 1];
      const v = (a0 + (a1 - a0) * fx) * (1 - fy) + (b0 + (b1 - b0) * fx) * fy; d[i + 3] *= 1 - amount * v; } }
  ctx.putImageData(img, 0, 0);
}
// maschera di disegno: draw(c2) disegna su una tela a parte; ritorna m(x,y) → 0..1 (alpha in quel punto)
// serve per far "seguire" al pelo le macchie/strisce (bordi pelosi invece che netti)
function _canvas(size) { let cv; try { cv = new OffscreenCanvas(size, size); } catch (_) { cv = document.createElement('canvas'); cv.width = cv.height = size; } return cv; }
// livello a parte: draw(c2) disegna su una tela nuova, poi la tela viene incollata una sola volta (eventualmente sfocata):
// un solo blur per tante forme invece di un blur per forma (molto più veloce)
function _layer(ctx, size, draw, o = {}) {
  const cv = _canvas(size), c2 = cv.getContext('2d'); draw(c2);
  ctx.save(); if (o.blur) ctx.filter = `blur(${o.blur}px)`; ctx.globalAlpha = o.a ?? 1; if (o.op) ctx.globalCompositeOperation = o.op; ctx.drawImage(cv, 0, 0); ctx.restore();
}
function _mask(size, draw, blur = 0) {
  let cv = _canvas(size), c2 = cv.getContext('2d'); c2.fillStyle = '#000'; c2.strokeStyle = '#000'; draw(c2);
  if (blur) { const cv3 = _canvas(size), c3 = cv3.getContext('2d'); c3.filter = `blur(${blur}px)`; c3.drawImage(cv, 0, 0); cv = cv3; c2 = c3; }
  const d = c2.getImageData(0, 0, size, size).data;
  return (x, y) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= size || y >= size) return 0; return d[(y * size + x) * 4 + 3] / 255; };
}
const _mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
// forma a "fuso" lungo pts (larga al centro, appuntita alle estremità): strisce di tigre/gatto, petali lunghi
function _lens(c, pts, w, col) {
  const s = _smooth(pts, 10), n = s.length; if (n < 2) return;
  const L = [], R = [];
  for (let i = 0; i < n; i++) { const q = s[Math.min(n - 1, i + 1)], r = s[Math.max(0, i - 1)]; let dx = q[0] - r[0], dy = q[1] - r[1]; const d = Math.hypot(dx, dy) || 1; const t = i / (n - 1), hw = w / 2 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, t * .96 + .02))), .7);
    L.push([s[i][0] - dy / d * hw, s[i][1] + dx / d * hw]); R.push([s[i][0] + dy / d * hw, s[i][1] - dx / d * hw]); }
  c.beginPath(); c.moveTo(L[0][0], L[0][1]); L.forEach(p => c.lineTo(p[0], p[1])); for (let i = n - 1; i >= 0; i--) c.lineTo(R[i][0], R[i][1]); c.closePath(); if (col) { c.fillStyle = col; } c.fill();
}
const _mirrorPts = (pts, size = 1024) => pts.map(p => [size - p[0], p[1]]);
// viso di pelliccia "realistica": base sfumata, sottopittura morbida delle macchie, poi migliaia di ciuffi che seguono
// la direzione del pelo e prendono il colore da base / muso / macchie → bordi pelosi e niente forme piatte.
// P = { grad: [top, mid, bottom] css, side: [r,g,b] ombra tempie, fur: [r,g,b], muzzle: [r,g,b], mark: [r,g,b],
//       marks(c) disegna le macchie su una tela (nero pieno), muzzleR: raggio muso, n, len, w, a, light: [r,g,b] luci sopra/sotto occhi }
function _furPaint(ctx, h, P) {
  const size = h.size || 1024, mid = size / 2, E = _eye(h, h.EYE_L);
  const yTop = h.uv(10)[1], yChin = h.uv(152)[1], yBrow = h.uv(105)[1], nT = h.uv(1), lip = h.uv(0), tL = h.uv(127);
  const g = ctx.createLinearGradient(0, yTop, 0, yChin); g.addColorStop(0, P.grad[0]); g.addColorStop(.45, P.grad[1]); g.addColorStop(1, P.grad[2]);
  _base(ctx, h, g, .94, 18);
  ctx.save(); h.poly(h.FACE_OVAL); ctx.clip();
  _mirror(ctx, size, () => { _glow(ctx, tL[0] + 40, tL[1] + 60, 110, 230, P.side, .45); if (P.light) { _glow(ctx, E.x + 6, E.y - E.hh - 42, 62, 20, P.light, .5); _glow(ctx, E.x - 4, E.y + E.hh + 30, 70, 22, P.light, .45); } });
  const mR = P.muzzleR ?? 175, inMuzzle = (x, y) => Math.hypot((x - mid) / 1.25, y - (lip[1] + 30)) < mR && y > nT[1] - 20;
  if (P.muzzle) _layer(ctx, size, (c) => { c.fillStyle = _rgba(P.muzzle, 1); c.beginPath(); c.ellipse(mid, lip[1] + 40, mR * 1.2, mR * .95, 0, 0, Math.PI * 2); c.fill(); }, { blur: 20 });
  const M = P.marks ? _mask(size, P.marks, 3) : () => 0;
  if (P.marks) _layer(ctx, size, (c) => { c.fillStyle = _rgba(P.mark, 1); c.strokeStyle = _rgba(P.mark, 1); P.marks(c); }, { blur: 4, a: P.markA ?? .85 });
  const dir = (x, y) => { if (y > lip[1] + 30) return Math.atan2(y - lip[1] + 140, (x - mid) * .8); if (y < yBrow) return Math.atan2(y - yBrow - 120, (x - mid) * 1.4); return Math.atan2(y - nT[1] + 40, x - mid); };
  _furField(ctx, P.n ?? 7000, [0, yTop - 20, size, yChin + 20], () => h.poly(h.FACE_OVAL), dir, (x, y, r) => {
    const base = _mix(P.muzzle && inMuzzle(x, y) ? P.muzzle : P.fur, P.mark || [0, 0, 0], M(x, y) * .95), k = r();
    return k < .3 ? base.map(v => v * .76) : k < .55 ? base.map(v => Math.min(255, v * 1.14 + 12)) : base;
  }, { len: P.len ?? 24, w: P.w ?? 2.6, a: P.a ?? .45, seed: P.seed ?? 3 });
  ctx.restore();
  return M;
}
// tartufo (naso animale) con texture e lucido: c0/c1 colori del gradiente, s = scala
function _animalNose(ctx, h, c0, c1, s = 1, rim = 'rgba(40,20,20,.8)') {
  const mid = (h.size || 1024) / 2, nT = h.uv(1), nL = h.uv(49), nR = h.uv(279), nB = h.uv(2), rnd = _rng(77);
  const L = [mid - (mid - nL[0]) * s, nL[1]], Rr = [mid + (nR[0] - mid) * s, nR[1]];
  const nose = () => { ctx.beginPath(); ctx.moveTo(L[0] - 4, L[1] - 18); ctx.quadraticCurveTo(mid, nT[1] - 60 * s, Rr[0] + 4, Rr[1] - 18); ctx.quadraticCurveTo(Rr[0] - 4, nB[1] - 16, mid, nB[1] - 2); ctx.quadraticCurveTo(L[0] + 4, nB[1] - 16, L[0] - 4, L[1] - 18); ctx.closePath(); };
  nose(); const gn = ctx.createLinearGradient(0, nT[1] - 50, 0, nB[1]); gn.addColorStop(0, c0); gn.addColorStop(1, c1); ctx.fillStyle = gn; ctx.fill();
  ctx.save(); nose(); ctx.clip(); for (let k = 0; k < 160; k++) _ell(ctx, L[0] + rnd() * (Rr[0] - L[0]), nT[1] - 50 + rnd() * 80, 1.4, 1.4, 'rgba(40,20,25,.3)'); _glow(ctx, mid - 14, nT[1] - 28, 18, 9, [255, 245, 245], .55); ctx.restore();
  nose(); ctx.lineWidth = 3.5; ctx.strokeStyle = rim; ctx.stroke();
}

export default function paint(ctx, size, h) {
  ctx.clearRect(0, 0, size, size);
  _cheeks(ctx, h, (c, W, H) => {
    ['#ae1c28', '#f3f3ef', '#21468b'].forEach((col, i) => { c.fillStyle = col; c.fillRect(-W / 2, -H / 2 + i * H / 3, W, H / 3 + 1); });
    // texture di pennello: striature leggere chiare e scure, come pittura stesa a mano
    const r = _rng(7); c.save(); c.globalAlpha = .1; for (let k = 0; k < 26; k++) { const y = -H / 2 + r() * H; c.strokeStyle = r() < .5 ? '#ffffff' : '#000000'; c.lineWidth = 1 + r() * 2.5; c.beginPath(); c.moveTo(-W / 2, y); c.quadraticCurveTo(0, y + (r() - .5) * 10, W / 2, y + (r() - .5) * 8); c.stroke(); } c.restore();
  }, { W: 200, H: 140, r: 16 });
  _finish(ctx, h, { edge: 0, eyes: false, grain: .1 });
}
