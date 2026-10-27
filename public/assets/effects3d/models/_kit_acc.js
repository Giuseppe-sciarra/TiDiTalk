// ───────────── Tiditalk AR — libreria comune per cappelli, occhiali e accessori (models/*.js la importano) ─────────────
// Spazio del viso canonico MediaPipe in cm: origine ≈ centro testa, +X verso la destra di chi guarda, +Y su, +Z verso la camera.
// Il file inizia con "_": non finisce nel catalogo.
//
// Cosa c'è:
//  • materiali credibili: feltro, lana, tela, pelle, plastica lucida/opaca, metalli (oro, argento, cromo), gemme, lenti
//    (con riflesso ai bordi, Fresnel) — texture procedurali piccole (≤ 256 px) create una volta sola e condivise
//  • forme smussate: tubi con sezione ovale e punte arrotondate, estrusioni con bordo morbido, anelli con profilo
//  • occlusori: testa calva/capelli dentro i cappelli (copre anche le teste grandi inclinate in giù) e viso per occhiali
//  • niente allocazioni in update(): le funzioni qui servono solo in build()

const TAU = Math.PI * 2;
export const D2R = Math.PI / 180;
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ── texture procedurali (cache per THREE: si creano una sola volta) ─────────────────────────────────────────
const _tex = new Map();
function canvasTex(THREE, key, size, draw, repeat, srgb = true) {
  let t = _tex.get(key);
  if (!t || t.image?.width !== size) {
    const c = typeof OffscreenCanvas !== 'undefined' && !globalThis.document ? new OffscreenCanvas(size, size) : document.createElement('canvas');
    c.width = c.height = size;
    draw(c.getContext('2d'), size);
    t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    _tex.set(key, t);
  }
  const u = t.clone(); u.needsUpdate = true;       // ogni materiale ha la sua ripetizione (stessa immagine sotto)
  if (repeat) u.repeat.set(repeat[0], repeat[1]);
  return u;
}
// rumore a valori (per le texture): deterministico
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y, P) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const w = (a) => ((a % P) + P) % P;
  return (hash(w(xi), w(yi)) * (1 - ux) + hash(w(xi + 1), w(yi)) * ux) * (1 - uy) + (hash(w(xi), w(yi + 1)) * (1 - ux) + hash(w(xi + 1), w(yi + 1)) * ux) * uy;
}
// mappa di rilievo (bump) in scala di grigi da una funzione f(u,v) → 0..1 ripetibile
function bumpTex(THREE, key, size, f, repeat) {
  return canvasTex(THREE, key, size, (x, S) => {
    const img = x.createImageData(S, S);
    // (la riga j della canvas è la v = 1 - j/S della texture: le trame orientate restano dritte)
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const v = clamp(f(i / S, 1 - j / S), 0, 1) * 255, k = (j * S + i) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = v; img.data[k + 3] = 255; }
    x.putImageData(img, 0, 0);
  }, repeat, false);
}
// feltro / lana cotta: fibre corte e irregolari
const FELT = (u, v) => 0.5 + 0.28 * (vnoise(u * 64, v * 64, 64) - 0.5) + 0.22 * (vnoise(u * 160, v * 160, 160) - 0.5) + 0.12 * (vnoise(u * 16, v * 16, 16) - 0.5);
// tela / cotone: trama a quadretti
const CANVAS = (u, v) => { const a = Math.sin(u * TAU * 48), b = Math.sin(v * TAU * 48); return 0.5 + 0.22 * (a * a - 0.5) * Math.sign(b) + 0.2 * (b * b - 0.5) * Math.sign(a) + 0.1 * (vnoise(u * 96, v * 96, 96) - 0.5); };
// maglia rasata (berretti): punti a "V" (due gambe oblique per punto), 8 colonne × 10 righe per ripetizione
// (v cresce verso l'alto del berretto: la V si apre verso l'alto come nella maglia vera)
const KNIT = (u, v) => {
  const x = u * 8, y = v * 10, ci = Math.floor(x), fx = x - ci - 0.5;
  let best = 0;
  for (let dy = -1; dy <= 1; dy++) {
    const ry = Math.floor(y) + dy, fy = y - ry;
    for (const side of [-1, 1]) {
      const px = fx - side * 0.22, py = fy - 0.5, a = -side * 0.55, ca = Math.cos(a), sa = Math.sin(a);
      const qx = px * ca - py * sa, qy = px * sa + py * ca, d = (qx / 0.21) ** 2 + (qy / 0.62) ** 2;
      best = Math.max(best, Math.sqrt(Math.max(0, 1 - d)) * (0.85 + 0.15 * hash((ci * 2 + side + 16) % 16, (ry + 10) % 10)));
    }
  }
  return 0.12 + 0.88 * best;
};
// pelle: grana a celle
const LEATHER = (u, v) => { let m = 1; const N = 40; const gx = u * N, gy = v * N, ix = Math.floor(gx), iy = Math.floor(gy); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const cx = ix + a + hash(ix + a, iy + b), cy = iy + b + hash(iy + b + 7, ix + a); m = Math.min(m, Math.hypot(gx - cx, gy - cy)); } return 0.35 + 0.55 * smooth(0, 0.55, m) + 0.1 * (vnoise(u * 12, v * 12, 12) - 0.5); };
// metallo spazzolato / micrograffi (per la ruvidità)
const BRUSHED = (u, v) => 0.5 + 0.35 * (vnoise(u * 2, v * 220, 220) - 0.5) + 0.15 * (vnoise(u * 8, v * 512, 512) - 0.5);

// ── materiali ────────────────────────────────────────────────────────────────────────────────────────────────
// rep = ripetizioni della trama sugli uv della geometria (le LatheGeometry hanno u 0..1 attorno, v 0..1 lungo il profilo)
export function felt(THREE, color, rep = [10, 4], opt = {}) {
  return new THREE.MeshPhysicalMaterial(Object.assign({ color, roughness: 0.95, metalness: 0, sheen: 0.4, sheenRoughness: 0.85, sheenColor: new THREE.Color(color).multiplyScalar(0.85),
    bumpMap: bumpTex(THREE, 'felt', 256, FELT, rep), bumpScale: 1.2, envMapIntensity: 0.25 }, opt));
}
// rep: ripetizioni della trama (una ripetizione = 8 colonne × 10 righe di punti)
export function wool(THREE, color, rep = [1, 1], opt = {}) {
  const knitCol = canvasTex(THREE, 'knitC', 256, (x, S) => { const img = x.createImageData(S, S); for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const v = 165 + 90 * clamp(KNIT(i / S, 1 - j / S), 0, 1), k = (j * S + i) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = v; img.data[k + 3] = 255; } x.putImageData(img, 0, 0); }, rep, true);
  return new THREE.MeshPhysicalMaterial(Object.assign({ color, map: knitCol, roughness: 1, metalness: 0, sheen: 0.5, sheenRoughness: 0.7, sheenColor: new THREE.Color(color).multiplyScalar(0.9),
    bumpMap: bumpTex(THREE, 'knit', 256, KNIT, rep), bumpScale: 3.0, envMapIntensity: 0.2 }, opt));
}
export function cloth(THREE, color, rep = [12, 5], opt = {}) {
  return new THREE.MeshPhysicalMaterial(Object.assign({ color, roughness: 0.88, metalness: 0, sheen: 0.25, sheenRoughness: 0.8, sheenColor: new THREE.Color(color).multiplyScalar(0.85),
    bumpMap: bumpTex(THREE, 'canvas', 256, CANVAS, rep), bumpScale: 0.9, envMapIntensity: 0.22 }, opt));
}
export function leather(THREE, color, rep = [6, 3], opt = {}) {
  return new THREE.MeshPhysicalMaterial(Object.assign({ color, roughness: 0.62, metalness: 0, clearcoat: 0.15, clearcoatRoughness: 0.55, sheen: 0.15, sheenRoughness: 0.6, sheenColor: new THREE.Color(color).multiplyScalar(1.2),
    bumpMap: bumpTex(THREE, 'leather', 256, LEATHER, rep), bumpScale: 0.5, envMapIntensity: 0.25, specularIntensity: 0.4 }, opt));
}
// plastica: gloss 0 (opaca) … 1 (laccata)
export function plastic(THREE, color, gloss = 0.7, opt = {}) {
  // (la mappa d'ambiente dell'app è una stanza chiara: su una plastica scura un riflesso forte la fa sembrare argento)
  // per i colori scuri il riflesso d'ambiente si tiene basso: la lucentezza la danno i colpi di luce delle lampade
  const lum = new THREE.Color(color).getHSL({ h: 0, s: 0, l: 0 }).l, dk = 0.35 + 0.65 * Math.min(1, lum * 2.2);
  return new THREE.MeshPhysicalMaterial(Object.assign({ color, roughness: 0.6 - 0.4 * gloss, metalness: 0, clearcoat: gloss * 0.6 * dk, clearcoatRoughness: 0.18 + 0.3 * (1 - gloss), envMapIntensity: (0.2 + 0.35 * gloss) * dk, specularIntensity: 0.35 }, opt));
}
// metalli: oro, argento, cromo, ottone, rame… (colore = riflesso del metallo); brushed = spazzolato
export function metal(THREE, color, rough = 0.25, opt = {}) {
  const o = Object.assign({ color, roughness: rough, metalness: 1, envMapIntensity: 1.25 }, opt);
  if (o.brushed) { o.roughnessMap = bumpTex(THREE, 'brushed', 256, BRUSHED, o.brushed === true ? [1, 1] : o.brushed); delete o.brushed; }
  return new THREE.MeshPhysicalMaterial(o);
}
export const GOLD = 0xe8b84a, SILVER = 0xe4e7ec, CHROME = 0xf2f4f7, BRASS = 0xc9a050, COPPER = 0xc87f5a, GUNMETAL = 0x55585e;
// gemma: trasparenza finta (niente transmission: costa troppo su GPU deboli) + riflessi forti
export function gem(THREE, color, opt = {}) {
  return new THREE.MeshPhysicalMaterial(Object.assign({ color, roughness: 0.04, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 2.2,
    emissive: color, emissiveIntensity: 0.18, specularIntensity: 1, ior: 2.2, flatShading: true }, opt));
}
// lente: tinta trasparente al centro, più riflettente e opaca verso i bordi (Fresnel) → si vede che c'è un vetro,
// ma gli occhi restano visibili; specchiata = lente a specchio. Disegnata dopo il viso (transparent) e senza scrivere
// la profondità (non nasconde le ciglia/il viso dietro).
export function lens(THREE, tint = 0x303238, opacity = 0.45, opt = {}) {
  // Standard (non Physical), poco riflesso d'ambiente: la stanza dell'app è chiara e la luce di taglio diffusa
  // su una superficie quasi trasparente la "sbianca" (lente lattiginosa). Il riflesso vero lo disegna lo shader qui sotto.
  const o = Object.assign({ color: tint, roughness: 0.25, metalness: 0, transparent: true, opacity, depthWrite: false, side: THREE.FrontSide,
    envMapIntensity: 0.15 }, opt);
  const mirror = o.mirror; delete o.mirror;
  const m = new THREE.MeshStandardMaterial(o);
  const k = (mirror ? 0.85 : 0.45).toFixed(2), rf = (mirror ? 0.9 : 0.35).toFixed(2);
  // riflesso "a finestra": una fascia chiara in diagonale (come un cielo/una finestra riflessi) + bordi più riflettenti
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLensP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vLensP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vLensP;')
      .replace('#include <opaque_fragment>', `
      float fr = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 3.0);
      // riflesso: due strisce oblique sottili (una finestra riflessa) disegnate sulla lente (coordinate della lente, cm),
      // che scorrono un poco quando si gira la testa (seguono la normale nella vista): non coprono mai la lente
      float sx = vLensP.x * 0.8 + vLensP.y * 0.6 + normal.x * 3.0 + normal.y * 2.0;
      float band = smoothstep(0.0, 0.12, sx - 0.4) * (1.0 - smoothstep(0.35, 0.55, sx - 0.4))
                 + 0.6 * smoothstep(0.0, 0.08, sx - 1.25) * (1.0 - smoothstep(0.15, 0.3, sx - 1.25));
      // vetro: niente luce diffusa (solo un velo), il colore è la tinta che filtra
      outgoingLight = mix(diffuseColor.rgb * 0.5, outgoingLight, 0.12) + min(reflectedLight.directSpecular, vec3(0.6)) * 0.35;
      // (il bordo si schiarisce poco: le lenti curve viste di taglio, con la luce dall'alto, diventavano bianche)
      outgoingLight += vec3(0.9, 0.95, 1.0) * (band * ${rf} + fr * 0.12);
      diffuseColor.a = clamp(diffuseColor.a + fr * ${k} * 0.6 + band * ${rf} * 0.6, 0.0, 0.92);
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'tdLens2' + k + rf;
  return m;
}
// smalto/vernice lucida (es. caschi, giocattoli): colore pieno, vernice trasparente sopra
export function enamel(THREE, color, opt = {}) {
  return new THREE.MeshPhysicalMaterial(Object.assign({ color, roughness: 0.35, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.9 }, opt));
}

// ── forme smussate ──────────────────────────────────────────────────────────────────────────────────────────
// tubo lungo una curva con sezione ellittica (w × t), raggio variabile r(u) e punte arrotondate (cap: emisfere)
// up(u, P, T) → vettore "su" della sezione (default: Frenet). Ritorna una BufferGeometry indicizzata con uv (u lungo, v attorno).
export function tube(THREE, pts, r = 0.2, opt = {}) {
  const curve = pts.isCurve ? pts : new THREE.CatmullRomCurve3(pts.map(p => p.isVector3 ? p : new THREE.Vector3(...p)), !!opt.closed, 'centripetal', 0.5);
  const segs = opt.segs || Math.max(16, Math.round(curve.getLength() * 3)), rad = opt.rad || 12;
  const rf = typeof r === 'function' ? r : () => r;
  const asp = opt.aspect || 1;                         // larghezza / spessore della sezione
  const fr = curve.computeFrenetFrames(segs, !!opt.closed);
  const capN = opt.closed ? 0 : (opt.cap === false ? 0 : 4);
  const pos = [], nrm = [], uv = [], idx = [];
  const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), P = new THREE.Vector3();
  const ring = (P, N, B, rr, u, nT, nk) => {
    for (let j = 0; j <= rad; j++) {
      const a = j / rad * TAU, cs = Math.cos(a), sn = Math.sin(a);
      const ox = cs * rr * asp, oy = sn * rr;
      pos.push(P.x + N.x * ox + B.x * oy, P.y + N.y * ox + B.y * oy, P.z + N.z * ox + B.z * oy);
      // normale della sezione ellittica (inclinata lungo T sulle calotte)
      const nx = cs / asp, ny = sn, l = Math.hypot(nx, ny) || 1;
      const kx = nx / l * nk, ky = ny / l * nk;
      nrm.push(N.x * kx + B.x * ky + nT.x, N.y * kx + B.y * ky + nT.y, N.z * kx + B.z * ky + nT.z);
      uv.push(u, j / rad);
    }
  };
  const getFrame = (i, out) => {
    const t = i / segs; curve.getPointAt(t, P); T.copy(fr.tangents[i]);
    if (opt.up) { const U = opt.up(t, P, T); B.copy(U).addScaledVector(T, -U.dot(T)).normalize(); N.crossVectors(B, T).normalize(); }
    else { N.copy(fr.normals[i]); B.copy(fr.binormals[i]); }
  };
  const zero = new THREE.Vector3();
  // calotta iniziale
  if (capN) { getFrame(0); const r0 = rf(0); for (let c = 0; c < capN; c++) { const a = (1 - c / capN) * Math.PI / 2, f = Math.cos(a); const Pc = P.clone().addScaledVector(T, -Math.sin(a) * r0 * 0.9); ring(Pc, N.clone(), B.clone(), Math.max(1e-3, r0 * f), 0, T.clone().multiplyScalar(-Math.sin(a)), Math.cos(a)); } }
  for (let i = 0; i <= segs; i++) { getFrame(i); ring(P, N.clone(), B.clone(), Math.max(1e-3, rf(i / segs)), i / segs, zero, 1); }
  if (capN) { getFrame(segs); const r1 = rf(1); for (let c = 1; c <= capN; c++) { const a = c / capN * Math.PI / 2, f = Math.cos(a); const Pc = P.clone().addScaledVector(T, Math.sin(a) * r1 * 0.9); ring(Pc, N.clone(), B.clone(), Math.max(1e-3, r1 * f), 1, T.clone().multiplyScalar(Math.sin(a)), Math.cos(a)); } }
  const rows = pos.length / 3 / (rad + 1);
  for (let i = 0; i < rows - 1; i++) for (let j = 0; j < rad; j++) { const a = i * (rad + 1) + j, b = a + 1, c = a + rad + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const nn = new THREE.Float32BufferAttribute(nrm, 3); for (let i = 0; i < nn.count; i++) { const x = nn.getX(i), y = nn.getY(i), z = nn.getZ(i), l = Math.hypot(x, y, z) || 1; nn.setXYZ(i, x / l, y / l, z / l); }
  g.setAttribute('normal', nn);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
// estrusione con bordo morbido e "gonfio" (bevel arrotondato con abbastanza segmenti): per montature, stemmi, punte
export function softExtrude(THREE, shape, depth = 0.4, bevel = 0.12, opt = {}) {
  const g = new THREE.ExtrudeGeometry(shape, Object.assign({ depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: opt.bevelSegments || 4, curveSegments: opt.curveSegments || 24 }, opt.extra || {}));
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}
// anello con profilo arrotondato (fascia di un cappello, bordo): lathe di un rettangolo con angoli tondi
export function roundBand(THREE, R, height, thick, segs = 96, round = 0.4) {
  const pts = [], r = Math.min(round, thick / 2, height / 2), N = 5;
  const corner = (cx, cy, a0) => { for (let i = 0; i <= N; i++) { const a = a0 + i / N * Math.PI / 2; pts.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r)); } };
  const x0 = R - thick / 2, x1 = R + thick / 2;
  corner(x1 - r, r, -Math.PI / 2); corner(x1 - r, height - r, 0); corner(x0 + r, height - r, Math.PI / 2); corner(x0 + r, r, Math.PI);
  pts.push(pts[0].clone());
  return new THREE.LatheGeometry(pts, segs);
}
// lathe con uv ripetute: v lungo il profilo in cm (per le trame), u attorno in "giri"
export function lathe(THREE, prof, segs = 96) {
  const g = new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), segs);
  return g;
}
// sfera ammaccata/gonfia (pompon, nuvole): rumore sul raggio
export function lumpySphere(THREE, r, amp = 0.12, seg = 32, seed = 1) {
  const g = new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = 1 + amp * (Math.sin(x / r * 7.1 + y / r * 5.3 + seed) * Math.cos(z / r * 6.7 - y / r * 4.1) * 0.7 + 0.3 * Math.sin(x / r * 13 + z / r * 11 + seed)); p.setXYZ(i, x * n, y * n, z * n); }
  g.computeVertexNormals();
  return g;
}

// ── occlusori ───────────────────────────────────────────────────────────────────────────────────────────────
// Dentro un cappello: forma "testa + capelli" invisibile (solo profondità). Nell'app il cranio dell'occlusore del motore
// è piccolo (7,4 × 8,9 × 7,5 cm): su una testa vera — specie calva e grande, inclinata in giù verso la webcam del
// portatile — la parte posteriore del cappello si vedrebbe attraverso la fronte. Questa forma è nello spazio del VISO
// (non del cappello): si aggiunge al gruppo radice dell'effetto. bottomY: dove finisce sotto (sotto la tesa).
export function headOccluder(THREE, h, opt = {}) {
  const geo = new THREE.SphereGeometry(1, 32, 20);
  const m = h.preview ? new THREE.MeshStandardMaterial({ color: 0x4a3526, roughness: 1 }) : new THREE.MeshBasicMaterial({ colorWrite: false });
  const o = new THREE.Mesh(geo, m);
  const s = opt.scale || [8.0, 10.2, 9.3], c = opt.center || [0, 2.3, -4.4];
  o.scale.set(...s); o.position.set(...c);
  o.renderOrder = -1; o.name = 'headOccluder';
  return o;
}
// Per occhiali e maschere: copia rigida del viso canonico, rientrata (solo profondità). Nell'app l'occlusore del viso
// vero sta nella passata trasparente e non nasconde gli oggetti opachi: senza questo, girando la testa l'asta lontana
// degli occhiali si vedrebbe attraverso la guancia.
export function faceOccluder(THREE, h, inset = 0.3) {
  const f = h.face, geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(Array.from(f.pos), 3)); geo.setIndex(Array.from(f.idx)); geo.computeVertexNormals();
  const pp = geo.attributes.position, nn = geo.attributes.normal;
  for (let i = 0; i < pp.count; i++) pp.setXYZ(i, pp.getX(i) - nn.getX(i) * inset, pp.getY(i) - nn.getY(i) * inset, pp.getZ(i) - nn.getZ(i) * inset);
  const occ = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false })); occ.renderOrder = -1; occ.name = 'faceOccluder';
  return occ;
}
// Le parti opache che possono finire DIETRO il viso (aste degli occhiali, lati di una maschera) devono essere disegnate
// dopo l'occlusore del viso (che è "transparent"): rende transparent (opacità 1) i materiali del gruppo.
export function afterFace(g) {
  g.traverse(o => { if (!o.material) return; for (const m of [].concat(o.material)) { if (m.colorWrite === false) continue; if (!m.transparent) { m.transparent = true; m.opacity = 1; } } });
  return g;
}

// ── occhiali: aste che seguono la testa fino all'orecchio, cerniera arrotondata, naselli ──────────────────────
// s = lato (+1/-1); front = [x, y, z] della cerniera; r = raggio; aspect = sezione piatta
export function temple(THREE, s, front, r = 0.2, aspect = 1.6) {
  const [fx, fy, fz] = front;
  const pts = [[s * fx, fy, fz], [s * (fx + 0.7), fy - 0.05, fz - 0.8], [s * 7.35, fy - 0.35, 1.3], [s * 7.6, fy - 0.85, -1.6], [s * 7.65, fy - 1.2, -2.7], [s * 7.45, fy - 2.3, -4.0], [s * 7.15, fy - 3.4, -4.5]];
  return tube(THREE, pts, (u) => r * (1 - 0.25 * smooth(0.7, 1, u)), { aspect, up: () => new THREE.Vector3(0, 1, 0), segs: 48, rad: 10 });
}
export function hingeBlock(THREE, s, at, size = [0.55, 0.7, 0.9]) {
  const sh = new THREE.Shape(); const w = size[0] / 2, hh = size[1] / 2, r = Math.min(w, hh) * 0.6;
  sh.moveTo(-w + r, -hh); sh.lineTo(w - r, -hh); sh.quadraticCurveTo(w, -hh, w, -hh + r); sh.lineTo(w, hh - r); sh.quadraticCurveTo(w, hh, w - r, hh); sh.lineTo(-w + r, hh); sh.quadraticCurveTo(-w, hh, -w, hh - r); sh.lineTo(-w, -hh + r); sh.quadraticCurveTo(-w, -hh, -w + r, -hh);
  const g = softExtrude(THREE, sh, size[2] * 0.6, 0.12, { bevelSegments: 3, curveSegments: 6 });
  g.rotateY(Math.PI / 2 + s * 0.35); g.translate(...at);
  return g;
}
export function nosePads(THREE, g, mat, y = 2.25, z = 5.15, x = 0.95) {
  for (const s of [-1, 1]) {
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), mat); pad.scale.set(0.45, 1, 0.7);
    pad.position.set(s * x, y, z); pad.rotation.z = s * 0.25; g.add(pad);
    g.add(new THREE.Mesh(tube(THREE, [[s * 1.15, y + 0.8, z + 0.55], [s * 1.05, y + 0.4, z + 0.35], [s * x, y + 0.1, z + 0.1]], 0.05, { segs: 8, rad: 6 }), mat._arm || mat));
  }
}
// lenti curve: la forma 2D viene piegata su un cilindro (raggio Rc) come una lente vera, non un foglio piatto
export function curvedLensGeo(THREE, shape, Rc = 9, segs = 32) {
  const g = new THREE.ShapeGeometry(shape, segs), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, -(x * x + 0.6 * y * y) / (2 * Rc)); }
  g.computeVertexNormals();
  return g;
}

// ── finish(): ripassata automatica dei materiali di un effetto ───────────────────────────────────────────────
// Per gli effetti scritti con h.mat(...) (MeshStandardMaterial piatti): guarda ruvidità e metallo e
//  • stoffa/feltro/lana (ruvidità ≥ 0,8, non metallo) → MeshPhysical con lucentezza "velluto" (sheen) e rilievo
//    procedurale di fibre calcolato nello spazio dell'oggetto, in cm (non dipende dagli uv: niente trame stirate)
//  • metalli (metalness ≥ 0,6) → riflessi più ricchi e micrograffi (ruvidità che varia un poco)
//  • plastiche lucide → vernice trasparente leggera (clearcoat)
// opt.skip: Set di materiali da non toccare; opt.fabric: 'felt' | 'fine' (scala del rilievo)
const FIBER_GLSL = `
float tdH3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float tdN3(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(tdH3(i), tdH3(i + vec3(1,0,0)), f.x), mix(tdH3(i + vec3(0,1,0)), tdH3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(tdH3(i + vec3(0,0,1)), tdH3(i + vec3(1,0,1)), f.x), mix(tdH3(i + vec3(0,1,1)), tdH3(i + vec3(1,1,1)), f.x), f.y), f.z); }
`;
export function fiberBump(m, scale = 1, amount = 1) {
  const s = (scale * 1).toFixed(3), a = (amount * 1).toFixed(3);
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTdObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vTdObj = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vTdObj;\n' + FIBER_GLSL)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  // fibre: rumore a due scale (≈ 0,5 mm e 2 mm) usato come rilievo; sparisce da solo quando è più piccolo di un pixel
  vec3 q = vTdObj * (6.0 / ${s});
  float fw = length(fwidth(q));
  float hb = (tdN3(q * 3.1) * 0.55 + tdN3(q) * 0.45) * (1.0 - smoothstep(0.6, 1.6, fw)) * 0.035 * ${s} * ${a};
  vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
  vec2 dH = vec2(dFdx(hb), dFdy(hb));
  vec3 rr1 = cross(sy, normal), rr2 = cross(normal, sx);
  float det = dot(sx, rr1) * faceDirection;
  normal = normalize(abs(det) * normal - sign(det) * (dH.x * rr1 + dH.y * rr2));
  diffuseColor.rgb *= 0.93 + 0.12 * tdN3(q * 0.35 + 3.0);
}`);
  };
  const key = (m.customProgramCacheKey ? m.customProgramCacheKey() : '') + 'tdFiber' + s + a;
  m.customProgramCacheKey = () => key;
  m.userData.tdFiber = true;        // finish() non lo riapplica (varying dichiarata due volte = shader rotto)
  return m;
}
export function finish(THREE, g, opt = {}) {
  // materiali usati da update() (in g.userData): si modificano sul posto, non si sostituiscono
  const keep = new Set();
  const scan = (v, d) => { if (!v || d > 3) return; if (v.isMaterial) keep.add(v); else if (v.isMesh) [].concat(v.material).forEach(m => keep.add(m)); else if (Array.isArray(v)) v.forEach(x => scan(x, d + 1)); else if (typeof v === 'object' && !v.isObject3D) Object.values(v).forEach(x => scan(x, d + 1)); else if (v.isObject3D) v.traverse?.(o => o.isMesh && [].concat(o.material).forEach(m => keep.add(m))); };
  scan(g.userData, 0);
  const done = new Map();
  const upgrade = (m, extra) => {
    if (keep.has(m) || !(m.isMeshStandardMaterial && !m.isMeshPhysicalMaterial)) { extra(m, false); return m; }
    // MeshPhysicalMaterial.copy() vuole un materiale fisico: si copiano a mano le proprietà dello Standard
    const n = new THREE.MeshPhysicalMaterial();
    THREE.MeshStandardMaterial.prototype.copy.call(n, m);
    n.name = m.name; extra(n, true); return n;
  };
  const conv = (m) => {
    if (!m || m.colorWrite === false || (opt.skip && opt.skip.has(m))) return m;
    if (done.has(m)) return done.get(m);
    let out = m;
    if (m.isMeshStandardMaterial && !m.map && !m.userData.tdKeep && !m.userData.tdFiber && !m.bumpMap) {
      const glow = m.emissiveIntensity * Math.max(m.emissive.r, m.emissive.g, m.emissive.b);
      if (m.metalness >= 0.6) {
        out = upgrade(m, (x, phys) => { x.envMapIntensity = Math.max(m.envMapIntensity, 1.3); x.roughness = clamp(m.roughness, 0.14, 0.6); if (phys) { x.clearcoat = 0.25; x.clearcoatRoughness = 0.18; } });
      } else if (m.roughness >= 0.78 && !m.transparent && glow < 0.2) {
        // stoffa, feltro, lana, pelliccia: "velluto" (sheen) e fibre in rilievo
        // (sheen basso e del colore stesso, un po' più scuro: con le luci dell'app un sheen chiaro "sbianca" la stoffa)
        out = upgrade(m, (x, phys) => { if (phys) { x.sheen = 0.35; x.sheenRoughness = 0.85; x.sheenColor = m.color.clone().multiplyScalar(0.8); } x.envMapIntensity = Math.min(m.envMapIntensity, 0.4); fiberBump(x, opt.fabric === 'fine' ? 0.6 : 1, 0.6); });
      } else if (m.roughness <= 0.45 && m.metalness < 0.3 && !m.transparent && glow < 0.3) {
        out = upgrade(m, (x, phys) => { if (phys && !x.clearcoat) { x.clearcoat = 0.55; x.clearcoatRoughness = 0.12; } x.envMapIntensity = Math.max(m.envMapIntensity, 0.8); });
      }
    }
    done.set(m, out);
    return out;
  };
  g.traverse(o => { if (o.isMesh && o.material) o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material); });
  return g;
}

// "Tappo" invisibile per cappelli e corone (spazio del cappello): chiude l'interno della fascia dal bordo in giù.
// Una corona o un cappello più largo della testa a quell'altezza lascia vedere, da sotto, l'interno della parte
// posteriore attraverso lo spazio fra la fascia e la testa vera; nella realtà lì c'è la testa (o i capelli).
// Cilindro di raggio r da y0 a y1 con il fondo arrotondato verso la testa.
export function plugOccluder(THREE, h, r, y0 = -3, y1 = 1, opt = {}) {
  const prof = [[0, y0 - r * 0.35], [r * 0.6, y0 - r * 0.25], [r * 0.92, y0 - 0.6], [r, y0 + 0.4], [r, y1], [0, y1]];
  const geo = new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), 48);
  const m = h.preview ? new THREE.MeshStandardMaterial({ color: 0x4a3526, roughness: 1 }) : new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
  const o = new THREE.Mesh(geo, m); o.renderOrder = -1; o.name = 'plugOccluder';
  if (opt.scaleZ) o.scale.z = opt.scaleZ;
  return o;
}

// 1.8.9: cappello calzato sulla testa vera (fascia ovale come una testa). Scala x/z solo vicino alla fascia (r < r0),
// sfumando fino a r1: tese, calotte e visiere larghe restano tonde e ampie. Coordinate del gruppo g del cappello.
export function ovalize(THREE, g, kx, kz, r0, r1) {
  g.updateMatrixWorld(true);
  const gi = g.matrixWorld.clone().invert(), v = new THREE.Vector3();
  g.traverse(o => {
    if (!o.isMesh || !o.geometry?.attributes.position) return;
    o.geometry = o.geometry.clone();                       // (geometrie condivise fra più mesh: ognuna la sua)
    const M = new THREE.Matrix4().multiplyMatrices(gi, o.matrixWorld), Mi = M.clone().invert(), pos = o.geometry.attributes.position;
    const nrm = o.geometry.attributes.normal, N = new THREE.Matrix3().getNormalMatrix(M), Ni = new THREE.Matrix3().getNormalMatrix(Mi), n = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(M);
      const f = smooth(r0, r1, Math.hypot(v.x, v.z)), sx = kx + (1 - kx) * f, sz = kz + (1 - kz) * f;
      v.x *= sx; v.z *= sz;
      v.applyMatrix4(Mi); pos.setXYZ(i, v.x, v.y, v.z);
      // normali: stessa deformazione (inversa trasposta della scala locale), restano lisce anche sulle geometrie non indicizzate
      if (nrm) { n.fromBufferAttribute(nrm, i).applyMatrix3(N); n.x /= sx; n.z /= sz; n.applyMatrix3(Ni).normalize(); nrm.setXYZ(i, n.x, n.y, n.z); }
    }
    pos.needsUpdate = true; if (nrm) nrm.needsUpdate = true; o.geometry.computeBoundingSphere();
  });
  return g;
}
