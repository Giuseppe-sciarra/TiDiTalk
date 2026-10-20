// Vecchiaia: rughe (solchi scuri sfumati) su fronte, glabella, zampe di gallina, borse, solchi naso-labiali, labbro e mento; guance e tempie scavate,
// peli grigi sparsi nelle sopracciglia, macchie dell'età. Niente velo chiaro: su pelli scure diventava grigiastro; tutto funziona per ombre.
export const meta = { label: 'Vecchiaia', labelEn: 'Old age', category: 'maschere', icon: '👴' };
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
//       eyes: pad px | false, mouth: pad px | false, tone: false per non comprimere le luci }
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
  if (o.tone !== false) _tone(ctx, h.size || 1024);
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

export default function paint(ctx, size, h) {
  ctx.clearRect(0, 0, size, size);
  const A = h.ANCHORS, E = _eye(h, h.EYE_L), mid = size / 2, rnd = _rng(99);
  const [, yTop] = h.uv(A.forehead), [, yChin] = h.uv(A.chin), browL = h.uv(A.browL), browIn = h.uv(107);
  const nL = h.uv(49), mL = h.uv(A.mouthL), lip = h.uv(0), lip17 = h.uv(17), tL = h.uv(A.templeL), chL = h.uv(123), jL = h.uv(172);
  const DARK = [62, 36, 26], LIGHT = [255, 228, 208];
  // ruga = solco scuro sfumato con un filo di luce appena sopra (il rilievo della pelle)
  const wrinkle = (pts, w, a = .42) => { const s = _smooth(pts); _stroke(ctx, s.map(p => [p[0], p[1] - w * 1.6]), w * 1.4, _rgba(LIGHT, .07)); ctx.save(); ctx.filter = 'blur(3px)'; _stroke(ctx, s, w * 2.6, _rgba(DARK, a * .5)); ctx.restore(); _stroke(ctx, s, w * .55, _rgba(DARK, a * .3)); };

  // 1) volumi che cedono: guance e tempie scavate (solo ombre, nessun velo chiaro)
  ctx.save(); h.poly(h.FACE_OVAL); ctx.clip();
  _mirror(ctx, size, () => { _glow(ctx, chL[0] + 20, chL[1] + 140, 90, 110, [70, 45, 38], .3); _glow(ctx, tL[0] + 60, tL[1] - 40, 80, 120, [70, 45, 38], .24); });

  // 2) fronte: 4 rughe ondulate, più marcate al centro
  for (let k = 0; k < 4; k++) {
    const y = yTop + 60 + k * ((browL[1] - 50 - yTop - 60) / 3), pts = [];
    for (let x = mid - 300; x <= mid + 300; x += 30) pts.push([x, y + Math.sin(x / 95 + k) * 7 + Math.abs(x - mid) * .08]);
    // le rughe della fronte sono spezzate: 2-4 tratti di lunghezza diversa per riga
    let i = (rnd() * 3) | 0;
    while (i < pts.length - 3) { const n = 4 + ((rnd() * 7) | 0), seg = pts.slice(i, Math.min(pts.length, i + n)); if (seg.length > 2) wrinkle(seg.map(p => [p[0], p[1] + (rnd() - .5) * 4]), 4, .4 + (k == 1 ? .08 : 0)); i += n + 1 + ((rnd() * 2) | 0); }
  }
  // linee glabellari (tra le sopracciglia)
  _mirror(ctx, size, () => wrinkle([[browIn[0] - 22, browIn[1] - 50], [browIn[0] - 18, browIn[1] + 10]], 4, .4));

  _mirror(ctx, size, () => {
    // 3) zampe di gallina
    for (let k = -1; k <= 1; k++) wrinkle([[E.x0 - 6, E.y + k * 6], [E.x0 - 45, E.y + k * 26], [E.x0 - 85, E.y + k * 48 + 4]], 3.5, .4);
    // 4) borse sotto gli occhi + palpebre pesanti
    _glow(ctx, E.x, E.y + E.hh + 30, 80, 26, [80, 48, 50], .32);
    wrinkle([[E.x - 60, E.y + E.hh + 48], [E.x, E.y + E.hh + 60], [E.x + 55, E.y + E.hh + 46]], 3.5, .38);
    wrinkle([[E.x - 40, E.y - E.hh - 22], [E.x, E.y - E.hh - 30], [E.x + 50, E.y - E.hh - 20]], 3, .3);
    // 5) solco naso-labiale e linea della marionetta
    wrinkle([[nL[0] - 30, nL[1] - 10], [nL[0] - 70, nL[1] + 70], [mL[0] - 45, mL[1] - 10], [mL[0] - 50, mL[1] + 40]], 6, .4);
    wrinkle([[mL[0] - 20, mL[1] + 30], [mL[0] - 40, mL[1] + 110], [mL[0] - 30, mL[1] + 170]], 4.5, .26);
    // 6) peli grigi sparsi nelle sopracciglia (sale e pepe), orientati come i peli veri
    const bTop = [70, 63, 105, 66, 107].map(i => h.uv(i)), bBot = [46, 53, 52, 65, 55].map(i => h.uv(i));
    for (let k = 0; k < 16; k++) {
      const t = rnd(), i = Math.min(3, (t * 4) | 0), f = t * 4 - i, u = .2 + rnd() * .6;
      const top = [bTop[i][0] + (bTop[i + 1][0] - bTop[i][0]) * f, bTop[i][1] + (bTop[i + 1][1] - bTop[i][1]) * f], bot = [bBot[i][0] + (bBot[i + 1][0] - bBot[i][0]) * f, bBot[i][1] + (bBot[i + 1][1] - bBot[i][1]) * f];
      const x = bot[0] + (top[0] - bot[0]) * u, y = bot[1] + (top[1] - bot[1]) * u, ang = -2.6 + t * 1.2;     // verso l'esterno all'inizio, verso l'alto al centro
      _taper(ctx, [[x, y], [x + Math.cos(ang) * 16, y + Math.sin(ang) * 10]], 2.2, .6, `rgba(196,192,186,${(.45 + rnd() * .3).toFixed(2)})`);
    }
    // 7) macchie dell'età
    for (let k = 0; k < 7; k++) { const x = tL[0] + 40 + rnd() * 200, y = yTop + 40 + rnd() * 320; _glow(ctx, x, y, 6 + rnd() * 10, 5 + rnd() * 8, [110, 70, 45], .32, .3); }
    // 8) rughe sul labbro superiore e sul mento
    for (let k = 0; k < 4; k++) { const x = mid - 20 - k * 22; wrinkle([[x, lip[1] - 48], [x - 3, lip[1] - 6]], 2.5, .3); }
    wrinkle([[mid - 60, yChin - 95], [mid - 20, yChin - 80], [mid + 2, yChin - 85]], 3.5, .3);
    // guance cadenti: linea leggera dalla guancia alla mandibola
    wrinkle([[chL[0] + 40, chL[1] + 150], [jL[0] + 70, jL[1] - 20], [jL[0] + 100, jL[1] + 60]], 4, .14);
  });
  ctx.restore();
  _finish(ctx, h, { eyes: 3, edge: 1.2, tone: false });
}
