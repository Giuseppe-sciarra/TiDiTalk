// ═══════════════════════════════════════════════════════════════════════════
//  Kit comune dei personaggi (fxchars, Tiditalk 1.8.0)
//  ─────────────────────────────────────────────────────────────────────────
//  I file che iniziano per "_" non finiscono nel catalogo: questo lo importano
//  i personaggi di chars/ (percorso relativo).
//
//  Espressioni: update(g, bs, t, h) riceve valori CALIBRATI dal motore
//  (0 = faccia neutra della persona, 1 = espressione piena: vedi faceAR.js).
//  Niente soglie né guadagni qui: i movimenti sono pensati per 0..1 pieni.
//  h.pose (posa della testa) serve all'inerzia di orecchie, baffi e ciuffi;
//  nelle miniature non c'è e tutto resta fermo.
//
//  Testa dei personaggi (rig):
//  • pelle "con la fessura": testa e muso sono ellissoidi tagliati all'altezza
//    della bocca in due pezzi che a riposo combaciano. Un CAMPO DI SPOSTAMENTO
//    (mandibola che ruota e scende, angoli su col sorriso, bacio in avanti,
//    guance gonfie) muove i vertici: davanti la fessura si apre e si vede
//    l'interno della bocca (sacca scura vista da dentro), con lingua e denti.
//  • occhi: bulbo con texture (iride, pupilla tonda o a fessura) e vernice
//    lucida, riflessi da cartone fermi, palpebre sopra e sotto (sbattere,
//    strizzare, sgranare), sguardo che segue il tuo.
//  • sopracciglia appoggiate sulla pelle (mappa di profondità), si alzano,
//    si abbassano e si inclinano; guance con fard che si gonfiano.
//  • molle: orecchie, baffi e ciuffi con inerzia (e gravità per quelli flosci).
//  Niente allocazioni in update(): tutto pre-allocato.
// ═══════════════════════════════════════════════════════════════════════════

export const PI = Math.PI;
export const c01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
export const ss = (a, b, x) => { const t = c01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
export const B = (bs, k) => { const v = bs ? bs[k] : 0; return (typeof v === 'number' && v === v) ? c01(v) : 0; };
const D2R = PI / 180;

// ─── materiali ────────────────────────────────────────────────────────────
export function M(h, color, opt) { return h.mat(color, Object.assign({ roughness: .7, metalness: 0 }, opt || {})); }
/** materiale fisico (vernice lucida, velluto del pelo) */
export function PM(THREE, color, opt) { return new THREE.MeshPhysicalMaterial(Object.assign({ color, roughness: .7, metalness: 0 }, opt || {})); }
const hexs = (THREE, c) => '#' + new THREE.Color(c).getHexString();
/** texture con sfumatura verticale (alto → basso), opz. colore a metà */
export function gradTex(THREE, top, bottom, mid) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 128;
  const x = c.getContext('2d'); const gr = x.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, hexs(THREE, top)); if (mid !== undefined) gr.addColorStop(.5, hexs(THREE, mid)); gr.addColorStop(1, hexs(THREE, bottom));
  x.fillStyle = gr; x.fillRect(0, 0, 4, 128);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
export function gradMat(THREE, h, top, bottom, opt) { return h.mat(0xffffff, Object.assign({ roughness: .7, metalness: 0, map: gradTex(THREE, top, bottom) }, opt || {})); }
/** pelo: sfumatura + velluto (sheen) per l'aspetto morbido */
export function furMat(THREE, top, bottom, o) {
  o = o || {};
  const sheenC = new THREE.Color(o.sheenColor !== undefined ? o.sheenColor : top).lerp(new THREE.Color(0xffffff), .12);
  return new THREE.MeshPhysicalMaterial(Object.assign({ color: 0xffffff, map: gradTex(THREE, top, bottom, o.mid), roughness: .88, metalness: 0, sheen: .32, sheenRoughness: .55, sheenColor: sheenC, envMapIntensity: .7 }, o.opt || {}));
}
/** pelle liscia e un po' lucida (rana, drago, delfino…) */
export function skinMat(THREE, top, bottom, o) {
  o = o || {};
  return new THREE.MeshPhysicalMaterial(Object.assign({ color: 0xffffff, map: gradTex(THREE, top, bottom, o.mid), roughness: .45, metalness: 0, clearcoat: .35, clearcoatRoughness: .4 }, o.opt || {}));
}
/** smalto lucido (nasi, becchi, corni) */
export function glossMat(THREE, color, o) { return new THREE.MeshPhysicalMaterial(Object.assign({ color, roughness: .3, metalness: 0, clearcoat: 1, clearcoatRoughness: .12 }, o || {})); }

// ─── forme ────────────────────────────────────────────────────────────────
export function ell(THREE, mat, rx, ry, rz, x, y, z, seg) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, seg || 32, (seg || 32) * .75 | 0), mat);
  m.scale.set(rx, ry, rz); m.position.set(x || 0, y || 0, z || 0); return m;
}
export function cap(THREE, mat, r, len, x, y, z, rx, ry, rz) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 16), mat);
  m.position.set(x || 0, y || 0, z || 0); m.rotation.set(rx || 0, ry || 0, rz || 0); return m;
}
// superficie parametrica generica: fn(u,v) → [x,y,z], u,v ∈ [0,1]
export function surf(THREE, nu, nv, fn, closeU) {
  const pos = [], idx = [], uv = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const p = fn(i / nu, j / nv); pos.push(p[0], p[1], p[2]); uv.push(i / nu, 1 - j / nv); }
  const W = nu + 1;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * W + i, b = a + 1, c = a + W, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  if (closeU !== false) {
    const n = g.attributes.normal;
    for (let j = 0; j <= nv; j++) { const a = j * W, b = j * W + nu; const nx = n.getX(a) + n.getX(b), ny = n.getY(a) + n.getY(b), nz = n.getZ(a) + n.getZ(b); const l = Math.hypot(nx, ny, nz) || 1; n.setXYZ(a, nx / l, ny / l, nz / l); n.setXYZ(b, nx / l, ny / l, nz / l); }
  }
  return g;
}
// Catmull-Rom su una lista di vettori con s ∈ [0,1]
export function crom(pts, s) {
  const n = pts.length - 1; const f = c01(s) * n; let i = Math.floor(f); if (i >= n) i = n - 1; const t = f - i;
  const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, n)];
  const out = [];
  for (let k = 0; k < p1.length; k++) { const a = p0[k], b = p1[k], c = p2[k], d = p3[k]; out.push(0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t)); }
  return out;
}
// solido di rotazione (asse Y) da profilo [[r, y], ...]
export function lathe(THREE, mat, prof, o) {
  o = o || {}; const n = o.n || 40; const pts = [];
  for (let i = 0; i <= n; i++) { const p = crom(prof, i / n); pts.push(new THREE.Vector2(Math.max(p[0], 0), p[1])); }
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, o.seg || 48), mat);
  if (o.sz) m.scale.z = o.sz; if (o.sx) m.scale.x = o.sx; if (o.pos) m.position.set(o.pos[0], o.pos[1], o.pos[2]);
  return m;
}
// cono/corno curvo lungo una curva (r0 alla base, r1 in punta; rFn(v) opzionale)
export function horn(THREE, mat, pts, r0, r1, seg, rFn) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])));
  const nu = 12, nv = seg || 12;
  const fr = curve.computeFrenetFrames(nv, false);
  const g = surf(THREE, nu, nv, (u, v) => {
    const j = Math.round(v * nv), p = curve.getPointAt(v), N = fr.normals[j], Bn = fr.binormals[j];
    const r = rFn ? rFn(v) : r0 + (r1 - r0) * v; const an = u * 2 * PI;
    return [p.x + r * (N.x * Math.cos(an) + Bn.x * Math.sin(an)), p.y + r * (N.y * Math.cos(an) + Bn.y * Math.sin(an)), p.z + r * (N.z * Math.cos(an) + Bn.z * Math.sin(an))];
  });
  // verso dei triangoli: normali fuori dal tubo
  { const p = g.attributes.position, n = g.attributes.normal, j = Math.round(nv / 2), q = j * (nu + 1), c = curve.getPointAt(j / nv);
    if ((p.getX(q) - c.x) * n.getX(q) + (p.getY(q) - c.y) * n.getY(q) + (p.getZ(q) - c.z) * n.getZ(q) < 0) flipGeo(g); }
  return new THREE.Mesh(g, mat);
}
/** inverte il verso dei triangoli e le normali */
export function flipGeo(g) { const ix = g.index.array; for (let q = 0; q < ix.length; q += 3) { const t = ix[q + 1]; ix[q + 1] = ix[q + 2]; ix[q + 2] = t; } g.index.needsUpdate = true; const n = g.attributes.normal; for (let i = 0; i < n.array.length; i++) n.array[i] = -n.array[i]; n.needsUpdate = true; return g; }
/** tubo morbido lungo punti, raggio che cala verso la punta (ciuffi, baffi, ciglia) */
export function strand(THREE, mat, pts, r0, r1, seg) { return horn(THREE, mat, pts, r0, r1 === undefined ? r0 * .25 : r1, seg || 10, (v) => (r0 + ((r1 === undefined ? r0 * .25 : r1) - r0) * v) * (v > .92 ? Math.sqrt(Math.max(0, 1 - (v - .92) / .08)) * .9 + .1 : 1)); }
export function mixHex(a, b, t) { const A = [a >> 16 & 255, a >> 8 & 255, a & 255], Bb = [b >> 16 & 255, b >> 8 & 255, b & 255]; t = c01(t); return (Math.round(A[0] + (Bb[0] - A[0]) * t) << 16) | (Math.round(A[1] + (Bb[1] - A[1]) * t) << 8) | Math.round(A[2] + (Bb[2] - A[2]) * t); }

// ─── radice ──────────────────────────────────────────────────────────────
// Per i personaggi a testa intera HEAD_FIT ingrandisce tutto attorno a un perno sotto il viso,
// così la testa cartoon copre anche i capelli veri (che sporgono 3–5 cm sopra il cranio).
export const HEAD_FIT = { s: [1.14, 1.24, 1.14], p: [0, -6, 2] };
export function mkRoot(THREE, g, fit) {
  const f = new THREE.Group(); g.add(f);
  if (fit) { const k = fit.s, q = fit.p; f.scale.set(k[0], k[1], k[2]); f.position.set(q[0] * (1 - k[0]), q[1] * (1 - k[1]), q[2] * (1 - k[2])); }
  const root = new THREE.Group(); f.add(root); g.userData.root = root; g.userData.fit = f; return root;
}
export function reg(g) { if (!g.userData.P) g.userData.P = { eyes: [], brows: [], rbrows: [], springs: [], fx: [], skins: [], follow: [], lips: [], ring: [] }; return g.userData.P; }

// ─── testa: forma ─────────────────────────────────────────────────────────
// punto della sfera unitaria → calotta un po' "squadrata" in alto (copre i capelli veri) e alzata di ~1 cm
function headXform(boxy, lift) {
  return (x, y, z) => {
    const t = c01((y - .3) / .5), n = 2 + boxy * t * t * (3 - 2 * t);
    if (n > 2.001) { const k = Math.pow(Math.pow(Math.abs(x), n) + Math.pow(Math.abs(y), n) + Math.pow(Math.abs(z), n), -1 / n); x *= k; y *= k; z *= k; }
    const tl = c01((y - .3) / .6); y *= 1 + lift * tl * tl * (3 - 2 * tl);
    return [x, y, z];
  };
}
export function headGeo(THREE, r, boxy, lift) {
  lift = lift === undefined ? .1 : lift; const xf = headXform(boxy, lift);
  const g = new THREE.SphereGeometry(1, 48, 36), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const q = xf(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, q[0] * r[0], q[1] * r[1], q[2] * r[2]); }
  g.computeVertexNormals(); return g;
}

/** Ellissoide (c, r) tagliato all'altezza ys in due pezzi: sopra (patch 1) e sotto (patch 2), che a riposo
 *  combaciano (stessa riga di vertici, normali analitiche: la cucitura non si vede). Colonne più fitte davanti,
 *  righe più fitte vicino al taglio. Coordinate già nello spazio della radice. */
export function slitShell(THREE, o) {
  const c = o.c, r = o.r, nu = o.nu || 72, nv = o.nv || 48, xf = o.xform || null;
  const unit = (u, v, out) => { const th = 2 * PI * (u - .5), ph = PI * v; out[0] = Math.sin(ph) * Math.sin(th); out[1] = Math.cos(ph); out[2] = Math.sin(ph) * Math.cos(th); return out; };
  const tmp = [0, 0, 0];
  const P = (u, v) => { unit(u, v, tmp); let q = tmp; if (xf) q = xf(tmp[0], tmp[1], tmp[2]); return [c[0] + r[0] * q[0], c[1] + r[1] * q[1], c[2] + r[2] * q[2]]; };
  const cs = o.ys === undefined ? 2 : (o.ys - c[1]) / r[1];
  const slit = cs > -.97 && cs < .97;
  const vS = slit ? Math.acos(cs) / PI : 1;
  const au = .55, bw = .6;
  const uw = (s) => s + au * Math.sin(2 * PI * s) / (2 * PI);
  const rows = [];   // [v, patch]
  if (slit) {
    const nU = Math.max(6, Math.round(nv * vS)), nL = Math.max(6, nv - nU);
    for (let j = 0; j <= nU; j++) { const q = j / nU; rows.push([vS * (q * (1 + bw) - bw * q * q), 1]); }
    for (let j = 0; j <= nL; j++) { const q = j / nL; rows.push([vS + (1 - vS) * (q * (1 - bw) + bw * q * q), 2]); }
  } else for (let j = 0; j <= nv; j++) rows.push([j / nv, 1]);
  const W = nu + 1, pos = [], nrm = [], uvs = [], patch = [], idx = [];
  const y0 = c[1] - r[1], y1 = c[1] + r[1] * 1.12;
  const e = 1e-3;
  for (let j = 0; j < rows.length; j++) {
    const v = rows[j][0];
    for (let i = 0; i <= nu; i++) {
      const u = uw(i / nu), p = P(u, v);
      pos.push(p[0], p[1], p[2]);
      // normale: differenze finite (con ripiego sul gradiente dell'ellissoide ai poli)
      const pu = P(u + e, v), pu2 = P(u - e, v), pv = P(u, Math.min(1, v + e)), pv2 = P(u, Math.max(0, v - e));
      const ax = pu[0] - pu2[0], ay = pu[1] - pu2[1], az = pu[2] - pu2[2], bx = pv[0] - pv2[0], by = pv[1] - pv2[1], bz = pv[2] - pv2[2];
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; let l = Math.hypot(nx, ny, nz);
      const gx = (p[0] - c[0]) / (r[0] * r[0]), gy = (p[1] - c[1]) / (r[1] * r[1]), gz = (p[2] - c[2]) / (r[2] * r[2]);
      if (l < 1e-9) { nx = gx; ny = gy; nz = gz; l = Math.hypot(nx, ny, nz) || 1; }
      if (nx * gx + ny * gy + nz * gz < 0) { nx = -nx; ny = -ny; nz = -nz; }
      nrm.push(nx / l, ny / l, nz / l);
      uvs.push(i / nu, c01((p[1] - y0) / (y1 - y0)));
      patch.push(rows[j][1]);
    }
  }
  for (let j = 0; j < rows.length - 1; j++) {
    if (rows[j][1] !== rows[j + 1][1]) continue;       // fra la riga del taglio (sopra) e quella (sotto) niente triangoli
    for (let i = 0; i < nu; i++) { const a = j * W + i, b = a + 1, cc = a + W, d = cc + 1; idx.push(a, cc, b, b, cc, d); }
  }
  // verso dei triangoli: fuori
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  {
    const k = (idx.length / 6 | 0) * 3 + 0, ia = idx[k], ib = idx[k + 1], ic = idx[k + 2];
    const A = [pos[ia * 3], pos[ia * 3 + 1], pos[ia * 3 + 2]], Bv = [pos[ib * 3], pos[ib * 3 + 1], pos[ib * 3 + 2]], C = [pos[ic * 3], pos[ic * 3 + 1], pos[ic * 3 + 2]];
    const ux = Bv[0] - A[0], uy = Bv[1] - A[1], uz = Bv[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    if (fx * nrm[ia * 3] + fy * nrm[ia * 3 + 1] + fz * nrm[ia * 3 + 2] < 0) for (let q = 0; q < idx.length; q += 3) { const t = idx[q + 1]; idx[q + 1] = idx[q + 2]; idx[q + 2] = t; }
  }
  g.setIndex(idx);
  g.userData.patch = Uint8Array.from(patch);
  return g;
}

// ─── mappa di profondità della pelle (per appoggiare occhi, sopracciglia, nasi…) ──
function depthMap(meshes, o) {
  const x0 = o.x0, y0 = o.y0, st = o.step, NX = Math.ceil((o.x1 - x0) / st) + 1, NY = Math.ceil((o.y1 - y0) / st) + 1;
  const Z = new Float32Array(NX * NY).fill(-1e9);
  for (const m of meshes) {
    m.updateMatrix();
    const g = m.geometry, p = g.attributes.position.array, ix = g.index ? g.index.array : null, e = m.matrix.elements;
    const T = (i, o3) => { const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2]; o3[0] = e[0] * x + e[4] * y + e[8] * z + e[12]; o3[1] = e[1] * x + e[5] * y + e[9] * z + e[13]; o3[2] = e[2] * x + e[6] * y + e[10] * z + e[14]; };
    const A = [0, 0, 0], Bq = [0, 0, 0], C = [0, 0, 0];
    const n = ix ? ix.length : p.length / 3;
    for (let k = 0; k < n; k += 3) {
      T(ix ? ix[k] : k, A); T(ix ? ix[k + 1] : k + 1, Bq); T(ix ? ix[k + 2] : k + 2, C);
      const nz = (Bq[0] - A[0]) * (C[1] - A[1]) - (Bq[1] - A[1]) * (C[0] - A[0]);
      if (Math.abs(nz) < 1e-9) continue;
      const minx = Math.max(0, Math.floor((Math.min(A[0], Bq[0], C[0]) - x0) / st)), maxx = Math.min(NX - 1, Math.ceil((Math.max(A[0], Bq[0], C[0]) - x0) / st));
      const miny = Math.max(0, Math.floor((Math.min(A[1], Bq[1], C[1]) - y0) / st)), maxy = Math.min(NY - 1, Math.ceil((Math.max(A[1], Bq[1], C[1]) - y0) / st));
      for (let gy = miny; gy <= maxy; gy++) for (let gx = minx; gx <= maxx; gx++) {
        const px = x0 + gx * st, py = y0 + gy * st;
        const w0 = ((Bq[0] - px) * (C[1] - py) - (Bq[1] - py) * (C[0] - px)) / nz, w1 = ((C[0] - px) * (A[1] - py) - (C[1] - py) * (A[0] - px)) / nz, w2 = 1 - w0 - w1;
        if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
        const z = w0 * A[2] + w1 * Bq[2] + w2 * C[2], q = gy * NX + gx; if (z > Z[q]) Z[q] = z;
      }
    }
  }
  const at = (gx, gy) => Z[Math.max(0, Math.min(NY - 1, gy)) * NX + Math.max(0, Math.min(NX - 1, gx))];
  const zRaw = (x, y) => {
    const fx = (x - x0) / st, fy = (y - y0) / st, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const a = at(ix, iy), b = at(ix + 1, iy), c = at(ix, iy + 1), d = at(ix + 1, iy + 1);
    if (a < -1e8 || b < -1e8 || c < -1e8 || d < -1e8) return Math.max(a, b, c, d);
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };
  // fuori dalla pelle: si prende il bordo più vicino andando verso il centro (niente punte verso l'infinito)
  const zAt = (x, y) => {
    let z = zRaw(x, y); if (z > -1e8) return z;
    for (let k = 1; k <= 16; k++) { const f = 1 - k / 16; z = zRaw(x * f, y * f); if (z > -1e8) return z - (1 - f) * 2; }
    return 0;
  };
  const nAt = (x, y, out) => { const h = .35, dx = (zAt(x + h, y) - zAt(x - h, y)) / (2 * h), dy = (zAt(x, y + h) - zAt(x, y - h)) / (2 * h); const l = Math.hypot(dx, dy, 1); out[0] = -dx / l; out[1] = -dy / l; out[2] = 1 / l; return out; };
  return { z: zAt, n: nAt };
}

// ─── occhio ──────────────────────────────────────────────────────────────
// texture del bulbo: il polo della sfera guarda avanti (+z); pixel → coordinate sul piano frontale dell'occhio
function eyeTex(THREE, o) {
  const W = 512, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), img = x.createImageData(W, H), d = img.data;
  const sc = new THREE.Color(o.sclera === undefined ? 0xf6f2ec : o.sclera), scB = sc.clone().lerp(new THREE.Color(o.scleraEdge === undefined ? 0xd9c9c4 : o.scleraEdge), 1);
  const ir = o.iris === null ? null : new THREE.Color(o.iris === undefined ? 0x4a7bd1 : o.iris);
  const irL = ir ? ir.clone().lerp(new THREE.Color(0xffffff), .35) : null, irD = ir ? ir.clone().multiplyScalar(.45) : null;
  const pc = new THREE.Color(o.pupilColor === undefined ? 0x0d0a0a : o.pupilColor);
  const R = o.irisR === undefined ? .62 : o.irisR, pr = o.pupilR === undefined ? .32 : o.pupilR, kind = o.pupil || 'round';
  const aa = 2.2 / H * PI;
  for (let row = 0; row < H; row++) {
    const th = (row + .5) / H * PI, st = Math.sin(th);
    for (let col = 0; col < W; col++) {
      const uu = (col + .5) / W, X = -Math.cos(2 * PI * uu) * st, Y = -Math.sin(2 * PI * uu) * st;
      // sclera: un filo più scura verso i lati (rotondità)
      let col3 = [sc.r, sc.g, sc.b];
      const edge = ss(.9, 2.2, th); col3 = [col3[0] + (scB.r - col3[0]) * edge, col3[1] + (scB.g - col3[1]) * edge, col3[2] + (scB.b - col3[2]) * edge];
      if (th < PI / 2) {
        const dd = Math.hypot(X, Y);
        if (ir) {
          const fi = 1 - ss(R - aa, R + aa, dd);
          if (fi > 0) {
            const k = dd / R, ang = Math.atan2(Y, X);
            const fib = 1 + .1 * Math.sin(ang * 37 + Math.sin(ang * 11) * 2) * ss(.35, .7, k) + .06 * Math.sin(ang * 83);
            let cr = irL.r + (ir.r - irL.r) * ss(.2, .75, k), cg = irL.g + (ir.g - irL.g) * ss(.2, .75, k), cb = irL.b + (ir.b - irL.b) * ss(.2, .75, k);
            const limb = ss(.72, .98, k); cr += (irD.r - cr) * limb; cg += (irD.g - cg) * limb; cb += (irD.b - cb) * limb;
            const top = ss(.0, .9, Y / R) * .25; cr *= 1 - top; cg *= 1 - top; cb *= 1 - top;       // ombra della palpebra in alto
            cr *= fib; cg *= fib; cb *= fib;
            col3 = [col3[0] + (cr - col3[0]) * fi, col3[1] + (cg - col3[1]) * fi, col3[2] + (cb - col3[2]) * fi];
          }
        }
        let q;
        if (kind === 'slit') q = Math.hypot(X / (pr * .3), Y / (pr * 1.25));
        else if (kind === 'hslit') q = Math.hypot(X / (pr * 1.35), Y / (pr * .42));
        else q = dd / pr;
        if (pr > 0) { const fp = 1 - ss(1 - aa / pr * 1.2, 1 + aa / pr * 1.2, q); col3 = [col3[0] + (pc.r - col3[0]) * fp, col3[1] + (pc.g - col3[1]) * fp, col3[2] + (pc.b - col3[2]) * fp]; }
      }
      const q4 = (row * W + col) * 4;
      // colori lineari → sRGB per la texture
      d[q4] = Math.round(Math.pow(c01(col3[0]), 1 / 2.2) * 255); d[q4 + 1] = Math.round(Math.pow(c01(col3[1]), 1 / 2.2) * 255); d[q4 + 2] = Math.round(Math.pow(c01(col3[2]), 1 / 2.2) * 255); d[q4 + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; return tex;
}
const CAPA = PI / 2 + .21;          // apertura delle calotte delle palpebre (102°)
/** Occhio: bulbo con texture + vernice lucida, riflessi fermi, palpebre sopra/sotto con bordo scuro.
 *  o: { x,y,z, r, side, ry, rx, iris, irisR, pupilR, pupil:'round'|'slit'|'hslit', sclera, lidMat, open (°), low (°),
 *       liner: colore|false, lashes, look: [orizz, vert] in rad, scale: [sx,sy,sz] } */
export function eye(THREE, h, P, o) {
  const r = o.r || 2.0, side = o.side || 1;
  const sock = new THREE.Group(); sock.position.set(o.x || 0, o.y || 0, o.z || 0); sock.rotation.set(o.rx || 0, o.ry || 0, 0, 'YXZ');
  if (o.scale) sock.scale.set(o.scale[0], o.scale[1], o.scale[2]);
  const ball = new THREE.Group(); sock.add(ball);
  const geo = new THREE.SphereGeometry(r, 36, 24); geo.rotateX(PI / 2);
  const tex = o.tex || eyeTex(THREE, o);
  const eyeMat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: .16, metalness: 0, clearcoat: 1, clearcoatRoughness: .03 });
  ball.add(new THREE.Mesh(geo, eyeMat));
  // riflessi da cartone: fermi rispetto all'orbita (non seguono lo sguardo)
  if (o.hl !== false) {
    const hlM = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    const put = (el, az, sz) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), hlM); const ce = Math.cos(el * D2R); m.position.set(Math.sin(az * D2R) * ce * r * 1.004, Math.sin(el * D2R) * r * 1.004, Math.cos(az * D2R) * ce * r * 1.004); m.lookAt(m.position.clone().multiplyScalar(2)); m.scale.set(sz * r, sz * r, sz * r * .25); sock.add(m); return m; };
    put(o.hlEl || 30, (o.hlAz === undefined ? -24 : o.hlAz), o.hlSize || .2);
    put(-18, 26, (o.hlSize || .2) * .45);
  }
  const lr = r * (o.lidR || 1.07);
  const lidMat = o.lidMat || M(h, o.lid || 0xcccccc);
  const up = new THREE.Group(); sock.add(up);
  up.add(new THREE.Mesh(new THREE.SphereGeometry(lr, 32, 14, 0, 2 * PI, 0, CAPA), lidMat));
  const low = new THREE.Group(); sock.add(low);
  const lowCap = new THREE.Mesh(new THREE.SphereGeometry(lr * .995, 32, 10, 0, 2 * PI, 0, CAPA), o.lowMat || lidMat); lowCap.rotation.z = PI; low.add(lowCap);
  if (o.liner !== false) {
    const lm = M(h, o.liner === undefined ? 0x1a1414 : o.liner, { roughness: .5 });
    const rr = lr * Math.sin(CAPA), yy = lr * Math.cos(CAPA);
    const t = new THREE.Mesh(new THREE.TorusGeometry(rr, r * (o.linerW || .085), 6, 40, PI * 1.2), lm);
    t.rotation.x = PI / 2; t.rotation.z = -PI * .1; t.position.y = yy; up.add(t);
    // ciglia: piccoli coni curvi sul bordo
    for (let i = 0; i < (o.lashes || 0); i++) {
      const a = (o.lashes > 1 ? (i / (o.lashes - 1) - .5) : 0) * 1.3 + side * .35;
      const l = new THREE.Mesh(new THREE.ConeGeometry(r * .07, r * .55, 6), lm);
      const px = Math.sin(a) * rr, pz = Math.cos(a) * rr; l.position.set(px, yy + r * .1, pz);
      l.rotation.set(-.9, 0, -a * .8); up.add(l);
    }
  }
  const E = { sock, ball, up, low, side, r, open: o.open === undefined ? 52 : o.open, lowRest: o.low === undefined ? -50 : o.low,
    look: o.look || [.5, .34], squintK: o.squintK === undefined ? 1 : o.squintK, blinkLow: o.blinkLow === undefined ? -24 : o.blinkLow, roll: o.roll || 0 };
  P.eyes.push(E); setLids(E, E.open, E.lowRest);
  return sock;
}
function setLids(E, eU, eL) {
  const capD = CAPA / D2R - 90;
  E.up.rotation.x = -(eU + capD) * D2R; E.low.rotation.x = (capD - eL) * D2R;
  if (E.roll) { E.up.rotation.z = E.roll * E.side; E.low.rotation.z = -E.roll * E.side * .5; }
}

// ─── sopracciglio rigido (scene col viso vero) ───────────────────────────────
export function rigidBrow(THREE, h, P, o) {
  const w = o.w || 3.2, th = o.th || .45, side = o.side || 1;
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-w / 2, 0, 0), new THREE.Vector3(0, o.arch === undefined ? .6 : o.arch, .25), new THREE.Vector3(w / 2, 0, 0));
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, th, 10, false), o.mat || M(h, o.color || 0x333333));
  const c1 = new THREE.Mesh(new THREE.SphereGeometry(th, 10, 8), m.material); c1.position.x = -w / 2;
  const c2 = c1.clone(); c2.position.x = w / 2; m.add(c1, c2);
  const grp = new THREE.Group(); grp.add(m); grp.position.set(o.x || 0, o.y || 0, o.z || 0); grp.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0);
  P.rbrows.push({ obj: grp, y: grp.position.y, rz: grp.rotation.z, side, k: o.k || 1 });
  return grp;
}

// ─── molle (inerzia) ─────────────────────────────────────────────────────────
/** Molla su un oggetto (orecchio, baffo, ciuffo): ruota attorno alla sua posa di riposo, spinta dalla velocità
 *  di rotazione/spostamento della testa (resta indietro e poi rimbalza), dalla gravità (flosci) e dalle espressioni.
 *  o: { k: rigidità (1/s²), c: smorzamento (1/s), drive: [x,y,z] quanto la spinge la rotazione della testa,
 *       lin: quanto la spinge lo spostamento, grav: flosci 0..1, expr(s, t, out) → bersagli [x,y,z] in rad, max } */
export function spring(P, obj, o) {
  o = o || {};
  const S = { obj, rx: obj.rotation.x, ry: obj.rotation.y, rz: obj.rotation.z, a: [0, 0, 0], v: [0, 0, 0], tg: [0, 0, 0],
    k: o.k || 90, c: o.c || 9, drive: o.drive || [.09, .07, .09], lin: o.lin === undefined ? .006 : o.lin, grav: o.grav || 0, expr: o.expr || null, max: o.max || .9, side: o.side || 0 };
  P.springs.push(S); return S;
}

// ─── stato delle espressioni (dai blendshape calibrati) ──────────────────────
function readState(s, bs) {
  s.jaw = B(bs, 'jawOpen');
  s.smileL = B(bs, 'mouthSmileLeft'); s.smileR = B(bs, 'mouthSmileRight'); s.smile = (s.smileL + s.smileR) / 2;
  s.frownL = B(bs, 'mouthFrownLeft'); s.frownR = B(bs, 'mouthFrownRight'); s.frown = (s.frownL + s.frownR) / 2;
  s.pucker = B(bs, 'mouthPucker'); s.funnel = B(bs, 'mouthFunnel');
  s.blinkL = B(bs, 'eyeBlinkLeft'); s.blinkR = B(bs, 'eyeBlinkRight');
  s.squintL = B(bs, 'eyeSquintLeft'); s.squintR = B(bs, 'eyeSquintRight');
  s.wideL = B(bs, 'eyeWideLeft'); s.wideR = B(bs, 'eyeWideRight');
  s.browIn = B(bs, 'browInnerUp'); s.browOutL = B(bs, 'browOuterUpLeft'); s.browOutR = B(bs, 'browOuterUpRight');
  s.browDnL = B(bs, 'browDownLeft'); s.browDnR = B(bs, 'browDownRight');
  s.puff = B(bs, 'cheekPuff'); s.tongue = B(bs, 'tongueOut');
  s.jawRaw = s.jaw; s.jaw = Math.max(s.jaw, s.tongue * .32);
  s.sneer = (B(bs, 'noseSneerLeft') + B(bs, 'noseSneerRight')) / 2;
  // sguardo: la "Left" è l'occhio sinistro della persona = lato +x del personaggio (dove guarda: +x)
  s.lookX = ((B(bs, 'eyeLookOutLeft') - B(bs, 'eyeLookInLeft')) + (B(bs, 'eyeLookInRight') - B(bs, 'eyeLookOutRight'))) / 2;
  s.lookY = ((B(bs, 'eyeLookUpLeft') + B(bs, 'eyeLookUpRight')) - (B(bs, 'eyeLookDownLeft') + B(bs, 'eyeLookDownRight'))) / 2;
  // compatibilità coi nomi di prima
  s.lookXL = s.lookXR = s.lookX; s.lookYL = s.lookYR = s.lookY;
}

// ═══ RIG della testa ════════════════════════════════════════════════════════
/** Testa completa. o = {
 *   head:   { r:[rx,ry,rz], c:[x,y,z], boxy, lift, mat, nu, nv }            testa (con la fessura della bocca)
 *   skins:  [{ r, c, mat, nu, nv }]                                         altri ellissoidi che stanno sulla bocca (muso…)
 *   extra:  [mesh]                                                          pelle fissa da usare per appoggiare le parti
 *   mouth:  { y, w, open (cm), curve (sorriso a riposo, cm), lip: { color, r, mat }, inside, tongue: {color,…}|false,
 *             teeth: { color, up, low }|false, rot (quota rotazione 0..1), kiss (cm in avanti), smileK, frownK }
 *   eyes:   { x, y, r, ry, sink, …opzioni di eye() }  (false: niente)
 *   brows:  { x, y, w, th, color|mat, arch, k, tilt }  (false: niente)
 *   cheeks: { x, y, r, color, puff (cm), blush (r) }    (false: niente) }
 *  Ritorna F con: root, P, head, skins, surf(x,y), norm(x,y,out), follow(obj, patch, anchor), skin(mesh), fx(fn). */
export function rig(THREE, h, g, o) {
  const P = reg(g);
  const root = mkRoot(THREE, g, o.fit === null ? null : (o.fit || HEAD_FIT));
  const F = { root, P, g, skins: [], o };
  g.userData.F = F;
  const noMouth = o.mouth === false;
  const mo = Object.assign({ y: -6.4, w: 3.4, open: 4.6, curve: .25, rot: .55, kiss: 2.0, smileK: 1.15, frownK: .85, widen: .55 }, o.mouth || {});
  const hd = o.head;
  // pelle
  const mkSkin = (s, xform) => {
    const main = s === hd;
    const geo = slitShell(THREE, { c: s.c, r: s.r, ys: noMouth || s.noSlit ? undefined : mo.y, nu: s.nu || (main ? 72 : 48), nv: s.nv || (main ? 48 : 36), xform });
    const m = new THREE.Mesh(geo, s.mat); root.add(m); F.skins.push(m); return m;
  };
  if (hd) F.head = mkSkin(hd, headXform(hd.boxy === undefined ? .8 : hd.boxy, hd.lift === undefined ? .1 : hd.lift));
  for (const s of (o.skins || [])) s.mesh = mkSkin(s, null);
  const dm = depthMap(F.skins.concat(o.extra || []), { x0: -17, x1: 17, y0: -19, y1: 21, step: .25 });
  {
    const ells = [hd ? { c: hd.c, r: hd.r, m: F.head, top: true } : null].concat((o.skins || []).map(s => ({ c: s.c, r: s.r, m: s.mesh }))).filter(Boolean);
    for (const A of ells) cullInside(A.m, ells.filter(Bq => Bq !== A));
  }
  F.surf = dm.z; F.norm = dm.n;
  // ── bocca: parametri del campo ──
  const hc = hd ? hd.c : [0, 0, -2.7], hr = hd ? hd.r : [11, 12, 11];
  const zf = dm.z(0, mo.y);
  const hy = mo.y + (mo.hingeY === undefined ? 1.2 : mo.hingeY), hz = mo.hingeZ === undefined ? hc[2] - .5 : mo.hingeZ;
  const dist = Math.hypot(mo.y - hy, zf - hz);
  const ck = o.cheeks || {};
  const m = F.m = {
    ym: mo.y, W: mo.w, zf, hy, hz, A: mo.open * mo.rot / dist, T: mo.open * (1 - mo.rot), Hu: mo.open * .1,
    Rn: mo.near || 1.35, Ru: 1.1, Rj: mo.jawDepth || 2.6, Wj: mo.jawW || hr[0] * .78, Rp: 1.5, zb: hz + .5, zr: mo.zRange || 4.5,
    ks: mo.smileK, kf: mo.frownK, kw: mo.widen, kz: mo.kiss, curve0: mo.curve,
    cx: ck.x || (mo.w + 2.8), cy: ck.y === undefined ? mo.y + 3.0 : ck.y, cr: ck.r || 3.0, kc: o.cheeks === false ? 0 : (ck.puff === undefined ? 1.6 : ck.puff),
    hc, hr, noMouth, jf: mo.jawFade || 0,
  };
  F.field = (x, y, z, patch, s, out) => fieldAt(m, x, y, z, patch, s, out);
  // ── interno della bocca: sacca vista da dentro (lato posteriore), più scura in fondo ──
  if (!noMouth) {
    const bw = mo.w + .25, bh = mo.bagH || Math.max(2.4, mo.open * .72), bd = mo.bagD || 2.8;
    const bg = new THREE.SphereGeometry(1, 36, 24); const pp = bg.attributes.position, col = new Float32Array(pp.count * 3);
    const cIn = new THREE.Color(mo.inside === undefined ? 0x5a1a22 : mo.inside), cDeep = cIn.clone().multiplyScalar(.28), cTop = cIn.clone().multiplyScalar(.55);
    for (let i = 0; i < pp.count; i++) {
      const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i);
      const k = c01((1 - z) / 1.6), tc = cIn.clone().lerp(cDeep, k).lerp(cTop, c01(y) * .5);
      col[i * 3] = tc.r; col[i * 3 + 1] = tc.g; col[i * 3 + 2] = tc.b;
      pp.setXYZ(i, x * bw, mo.y - .15 + y * bh, zf - bd + .35 + z * bd);
    }
    // resta dietro la pelle (a bocca chiusa non deve spuntare da nessuna parte)
    // ai lati si stringe verso il centro (vista di 3/4: non deve uscire dalla guancia)
    for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), y = pp.getY(i), zs = dm.z(x, y), ax = Math.abs(x) / bw; if (zs > -1e8) pp.setZ(i, Math.min(pp.getZ(i), zs - .35 - ax * ax * 1.2)); }
    bg.setAttribute('color', new THREE.BufferAttribute(col, 3)); bg.computeVertexNormals();
    const bag = new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .9, metalness: 0, side: THREE.BackSide, envMapIntensity: .25 }));
    root.add(bag); F.bag = bag; regSkin(F, bag, 0);
  }
  // lingua
  if (!noMouth && mo.tongue !== false) {
    const to = Object.assign({ color: 0xe86a82, w: mo.w * .6, len: mo.w * .75, out: 2.8 }, mo.tongue || {});
    const tg = new THREE.SphereGeometry(1, 28, 18); const tp = tg.attributes.position;
    for (let i = 0; i < tp.count; i++) { let x = tp.getX(i), y = tp.getY(i), z = tp.getZ(i); if (y > 0) y -= .35 * Math.exp(-x * x * 6) * y; z += (z > 0 ? .15 * z * z : 0); tp.setXYZ(i, x * to.w, y * .55, z * to.len); }
    tg.translate(0, 0, -to.len * 1.15); tg.computeVertexNormals();
    const tongue = new THREE.Mesh(tg, PM(THREE, to.color, { roughness: .42, sheen: .5, sheenColor: 0xffc0cc, sheenRoughness: .5 }));
    const tgrp = new THREE.Group(); tgrp.add(tongue); root.add(tgrp);
    const anchor = [0, mo.y - .75, zf - .75];
    tgrp.position.set(anchor[0], anchor[1], anchor[2]);
    F.tongue = { grp: tgrp, mesh: tongue, anchor, rest: anchor.slice(), out: to.out };
  }
  // denti
  if (!noMouth && mo.teeth) {
    const tc = mo.teeth, tm = glossMat(THREE, tc.color || 0xfbf7ee, { roughness: .25, clearcoat: .6 });
    const mk = (y, dn) => {
      const n = tc.n || 6, grp = new THREE.Group();
      for (let i = 0; i < n; i++) {
        const u = (i + .5) / n * 2 - 1, x = u * mo.w * (tc.span || .62), big = 1 - Math.abs(u) * .35;
        const t = new THREE.Mesh(new THREE.CapsuleGeometry(.36 * big, .35 * big, 4, 8), tm);
        t.scale.set(1, 1, .55); t.position.set(x, dn ? .05 : -.05, -Math.abs(u) * Math.abs(u) * 1.2); grp.add(t);
      }
      grp.position.set(0, y, zf - (tc.back || .95)); root.add(grp); return grp;
    };
    if (tc.up !== false) followObj(F, mk(mo.y + .1 - .55, false), 1, [0, mo.y + .2, zf]);
    if (tc.low) followObj(F, mk(mo.y - .1 + .5, true), 2, [0, mo.y - .2, zf]);
  }
  // labbra: due tubi sulla cucitura (sopra e sotto); a riposo coincidono e fanno la riga della bocca
  if (!noMouth) {
    const lo = Object.assign({ color: 0x3a2420, r: .26 }, mo.lip || {});
    const lmat = lo.mat || PM(THREE, lo.color, { roughness: .45, clearcoat: .3 });
    for (const patch of [1, 2]) lipTube(THREE, F, lmat, patch, lo.r * (patch === 2 ? .96 : 1), lo.lowMat && patch === 2 ? lo.lowMat : null);
  }
  // occhi
  if (o.eyes) {
    const eo = Object.assign({ r: 2.0, x: 3.8, y: 3.0, ry: .16, sink: .38 }, o.eyes);
    const tex = eyeTex(THREE, eo);
    for (const sd of [1, -1]) {
      const x = sd * eo.x, z = dm.z(x, eo.y) - eo.r * eo.sink;
      root.add(eye(THREE, h, P, Object.assign({}, eo, { tex, side: sd, x, y: eo.y, z, ry: sd * eo.ry })));
    }
  }
  // sopracciglia (sulla pelle)
  if (o.brows) {
    const bo = Object.assign({ x: 3.9, y: 6.0, w: 3.0, th: .42, arch: .55, k: 1, tilt: -.25, lift: .12 }, o.brows);
    const bm = bo.mat || PM(THREE, bo.color === undefined ? 0x2a1e18 : bo.color, { roughness: .7, sheen: .3 });
    for (const sd of [1, -1]) surfBrow(THREE, F, bm, Object.assign({}, bo, { side: sd }));
  }
  // guance: fard morbido appoggiato sulla pelle (si gonfia con la pelle)
  if (o.cheeks && o.cheeks.color !== undefined) {
    const br = o.cheeks.blush || 1.9;
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const cx = cv.getContext('2d');
    const gr = cx.createRadialGradient(32, 32, 0, 32, 32, 32); const cc = new THREE.Color(o.cheeks.color);
    const rgb = `${Math.round(cc.r * 255)},${Math.round(cc.g * 255)},${Math.round(cc.b * 255)}`;
    const al = o.cheeks.alpha || .5;
    gr.addColorStop(0, `rgba(${rgb},${al})`); gr.addColorStop(.5, `rgba(${rgb},${al * .55})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    cx.fillStyle = gr; cx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const bmat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: .8, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    for (const sd of [1, -1]) {
      const cx0 = sd * m.cx, cy0 = m.cy, N = 10;
      const geo = surf(THREE, N, N, (u, v) => { const x = cx0 + (u - .5) * 2 * br * 1.25, y = cy0 + (v - .5) * 2 * br; return [x, y, dm.z(x, y) + .04]; }, false);
      const bl = new THREE.Mesh(geo, bmat); bl.renderOrder = 2; root.add(bl); regSkin(F, bl, 1);
    }
  }
  F.followObj = (obj, patch, anchor) => followObj(F, obj, patch, anchor);
  F.skin = (mesh, patch, post) => { regSkin(F, mesh, patch || 0); if (post) F.P.skins[F.P.skins.length - 1].post = post; return mesh; };
  F.fx = (fn) => P.fx.push(fn);
  F.onSurf = (obj, x, y, lift) => { obj.position.set(x, y, dm.z(x, y) + (lift || 0)); return obj; };
  // la pelle segue il campo (la testa e il muso con la fessura)
  for (const sk of F.skins) regSkin(F, sk, -1);
  return F;
}
// toglie i triangoli di mesh che stanno tutti dentro uno degli ellissoidi others (a riposo)
function cullInside(mesh, others) {
  if (!others.length) return;
  const p = mesh.geometry.attributes.position.array, ix = mesh.geometry.index.array, keep = [];
  const inside = (i) => { const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2]; for (const e of others) { if (e.top && y > e.c[1] + e.r[1] * .25) continue; const q = ((x - e.c[0]) / e.r[0]) ** 2 + ((y - e.c[1]) / e.r[1]) ** 2 + ((z - e.c[2]) / e.r[2]) ** 2; if (q < .94) return true; } return false; };
  const ins = new Uint8Array(p.length / 3); for (let i = 0; i < ins.length; i++) ins[i] = inside(i) ? 1 : 0;
  for (let k = 0; k < ix.length; k += 3) if (!(ins[ix[k]] && ins[ix[k + 1]] && ins[ix[k + 2]])) keep.push(ix[k], ix[k + 1], ix[k + 2]);
  mesh.geometry.setIndex(keep);
}
// mesh deformata dal campo: patch -1 = dalla geometria (fessura), 0 = sopra/sotto la bocca secondo y, 1/2 fisso
const WS = 14;   // pesi per vertice del campo (vedi fieldW)
function fieldW(m, x, y, z, patch, W, q) {
  const fw = ss(m.zb, m.zb + m.zr, z); W[q] = fw; if (fw <= 0) return;
  const u = x / m.W, au = Math.abs(u), dyS = y - m.ym, near = Math.exp(-(dyS * dyS) / (m.Rn * m.Rn));
  const mouth = m.noMouth ? 0 : 1;
  W[q + 1] = mouth * (au <= 1 ? au * au : Math.exp(-(au - 1) * (au - 1) / .3)) * near;
  W[q + 2] = ss(-.4, .4, u);
  W[q + 3] = mouth * Math.max(-1.25, Math.min(1.25, u)) * near * Math.exp(-Math.max(0, au - 1.25) * Math.max(0, au - 1.25) * 2);
  const g2 = mouth * Math.exp(-(u * u) / .9 - (dyS * dyS) / (m.Rp * m.Rp)); W[q + 4] = g2 * x; W[q + 5] = g2;
  W[q + 6] = mouth * Math.exp(-(u * u) / .14) * near * (patch === 2 ? -1 : .7);
  const t = ss(0, m.Rj, -dyS), lens = au < 1 ? Math.pow(1 - au * au, .62) : 0, wide = Math.exp(-Math.pow(x / m.Wj, 4));
  W[q + 7] = patch === 2 ? mouth * (lens + (wide - lens) * t) * (m.jf ? Math.exp(-Math.pow(Math.max(0, -dyS - m.jf), 2) / (m.jf * m.jf)) : 1) : 0;
  W[q + 8] = y - m.hy; W[q + 9] = z - m.hz;
  W[q + 10] = patch === 2 ? 0 : mouth * (au < 1 ? Math.sqrt(1 - au * au) : 0) * Math.exp(-(dyS * dyS) / (m.Ru * m.Ru));
  for (let sd = 1, k = 11; sd >= -1; sd -= 2, k++) { const gx = (x - sd * m.cx) / (m.cr * 1.25), gy = (y - m.cy) / m.cr; W[q + k] = m.kc > 0 ? Math.exp(-(gx * gx + gy * gy)) : 0; }
  W[q + 13] = patch;
}
function applyW(m, W, q, s, o) {
  const fw = W[q]; o.a = 0; if (fw <= 0) { o.x = 0; o.y = 0; o.z = 0; return o; }
  const side = W[q + 2], sm = s.smileR + (s.smileL - s.smileR) * side, fr = s.frownR + (s.frownL - s.frownR) * side;
  let dy = (sm * m.ks - fr * m.kf + m.curve0) * W[q + 1], dx = sm > 0 ? sm * m.kw * W[q + 3] : 0, dz = 0;
  const pk = s.pucker, fn = s.funnel;
  if (pk + fn > 0) { dx -= (pk * .62 + fn * .4) * W[q + 4]; dz += (pk + fn * .5) * m.kz * W[q + 5]; dy += W[q + 6] * (pk * .45 + fn * .6); }
  const wl = W[q + 7];
  if (wl > 0 && s.jaw > 0) {
    const jw = s.jaw * wl, a = jw * m.A, ry = W[q + 8], rz = W[q + 9], ca = Math.cos(a), sa = Math.sin(a);
    dy += (ry * ca - rz * sa - ry) - jw * m.T; dz += (ry * sa + rz * ca - rz); o.a = a * fw;
  } else if (W[q + 10] > 0) dy += s.jaw * m.Hu * W[q + 10];
  if (s.puff > 0 || s.smile > 0) {
    const gR = W[q + 11], gL = W[q + 12];
    if (gR > .01) { const k = s.puff * m.kc * gR; dx += k * .95; dz += k * .45; dy += -k * .12 + s.smileL * .55 * gR; }
    if (gL > .01) { const k = s.puff * m.kc * gL; dx -= k * .95; dz += k * .45; dy += -k * .12 + s.smileR * .55 * gL; }
  }
  o.x = dx * fw; o.y = dy * fw; o.z = dz * fw; return o;
}
function regSkin(F, mesh, patch) {
  mesh.updateMatrix();
  const pos = mesh.geometry.attributes.position, rest = Float32Array.from(pos.array), n = pos.count;
  const pt = new Uint8Array(n), e = mesh.matrix.elements;
  // il campo è nello spazio della radice: se la mesh ha una trasformazione, la si porta lì una volta sola
  const ident = e[0] === 1 && e[5] === 1 && e[10] === 1 && e[12] === 0 && e[13] === 0 && e[14] === 0 && e[1] === 0 && e[2] === 0 && e[4] === 0 && e[6] === 0 && e[8] === 0 && e[9] === 0;
  if (!ident) {
    for (let i = 0; i < n; i++) { const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2]; rest[i * 3] = e[0] * x + e[4] * y + e[8] * z + e[12]; rest[i * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; rest[i * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14]; }
    pos.array.set(rest); mesh.position.set(0, 0, 0); mesh.rotation.set(0, 0, 0); mesh.scale.set(1, 1, 1); mesh.updateMatrix();
    mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere();
  }
  const gp = mesh.geometry.userData.patch;
  for (let i = 0; i < n; i++) pt[i] = patch === -1 && gp ? gp[i] : patch > 0 ? patch : (rest[i * 3 + 1] >= F.m.ym ? 1 : 2);
  mesh.frustumCulled = false;
  const nrm = mesh.geometry.attributes.normal; const nrest = nrm ? Float32Array.from(nrm.array) : null;
  const W = new Float32Array(n * WS); for (let i = 0; i < n; i++) fieldW(F.m, rest[i * 3], rest[i * 3 + 1], rest[i * 3 + 2], pt[i], W, i * WS);
  F.P.skins.push({ mesh, pos, rest, pt, n, nrm, nrest, W });
}
function followObj(F, obj, patch, anchor) {
  F.P.follow.push({ obj, patch, anchor: anchor || [obj.position.x, obj.position.y, obj.position.z], rest: obj.position.clone(), rx: obj.rotation.x });
  return obj;
}
// tubo delle labbra lungo la cucitura (centro sulla pelle, anelli nel piano verticale)
function lipTube(THREE, F, mat, patch, r0, mat2) {
  const m = F.m, N = 40, R = 8, W = m.W * 1.03;
  const n3 = [0, 0, 0];
  const C = new Float32Array((N + 1) * 3), NR = new Float32Array((N + 1) * 3), RAD = new Float32Array(N + 1);
  for (let k = 0; k <= N; k++) {
    const x = -W + 2 * W * k / N, u = x / m.W; F.norm(x, m.ym, n3);
    C[k * 3] = x; C[k * 3 + 1] = m.ym; C[k * 3 + 2] = F.surf(x, m.ym) - r0 * .25;
    NR.set(n3, k * 3); RAD[k] = r0 * (.3 + .7 * Math.pow(c01(1 - u * u), .45));
  }
  const nv = (N + 1) * (R + 1), pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), idx = [];
  for (let k = 0; k < N; k++) for (let j = 0; j < R; j++) { const a = k * (R + 1) + j, b = a + 1, c = a + R + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); g.setIndex(idx);
  const mesh = new THREE.Mesh(g, mat2 || mat); mesh.frustumCulled = false; F.root.add(mesh);
  const L = { mesh, patch, C, NR, RAD, N, R, pos, nrm, d: { x: 0, y: 0, z: 0 } };
  F.P.lips.push(L);
  // tappi rotondi alle estremità sono già dati dal raggio che cala
  updateLip(F, L, null);
  return mesh;
}
const ZERO = { jaw: 0, smileL: 0, smileR: 0, smile: 0, frownL: 0, frownR: 0, frown: 0, pucker: 0, funnel: 0, puff: 0, tongue: 0 };
function updateLip(F, L, s) {
  const { C, NR, RAD, N, R, pos, nrm, d } = L, m = F.m;
  const pk = s ? Math.max(s.pucker, s.funnel * .7) : 0;
  for (let k = 0; k <= N; k++) {
    const cx = C[k * 3], cy = C[k * 3 + 1], cz = C[k * 3 + 2];
    fieldAt(m, cx, cy, cz, L.patch, s || ZERO, d);
    const nx = NR[k * 3], ny = NR[k * 3 + 1], nz = NR[k * 3 + 2];
    // asse "su" perpendicolare alla normale (nel piano verticale)
    let ux = -nx * ny, uy = 1 - ny * ny, uz = -nz * ny; const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
    const rr = RAD[k] * (1 + pk * 3.2 * Math.exp(-((cx / m.W) ** 2) * 1.2));
    for (let j = 0; j <= R; j++) {
      const a = j / R * 2 * PI, ca = Math.cos(a), sa = Math.sin(a);
      const ox = ux * ca + nx * sa, oy = uy * ca + ny * sa, oz = uz * ca + nz * sa, q = (k * (R + 1) + j) * 3;
      pos[q] = cx + d.x + ox * rr; pos[q + 1] = cy + d.y + oy * rr * .85; pos[q + 2] = cz + d.z + oz * rr;
      nrm[q] = ox; nrm[q + 1] = oy; nrm[q + 2] = oz;
    }
  }
  L.mesh.geometry.attributes.position.needsUpdate = true; L.mesh.geometry.attributes.normal.needsUpdate = true;
}
function applyCheeksOnly(m, x, y, z, s, fw, o) {
  let dx = 0, dy = 0, dz = 0;
  for (let sd = -1; sd <= 1; sd += 2) { const gx = (x - sd * m.cx) / (m.cr * 1.25), gy = (y - m.cy) / m.cr, gc = m.kc > 0 ? Math.exp(-(gx * gx + gy * gy)) : 0; if (gc < .01) continue; const k = s.puff * m.kc * gc; dx += sd * k * .95; dz += k * .45; dy += -k * .12 + (sd > 0 ? s.smileL : s.smileR) * .55 * gc; }
  o.x = dx * fw; o.y = dy * fw; o.z = dz * fw; return o;
}
/** Campo di spostamento (spazio della radice) per un punto a riposo (x,y,z) della pelle sopra (1) o sotto (2) la bocca */
function fieldAt(m, x, y, z, patch, s, o) {
  const fw = ss(m.zb, m.zb + m.zr, z);
  o.a = 0;
  if (fw <= 0 || m.noMouth) { if (m.noMouth && fw > 0) return applyCheeksOnly(m, x, y, z, s, fw, o); o.x = 0; o.y = 0; o.z = 0; return o; }
  const u = x / m.W, au = Math.abs(u), dyS = y - m.ym;
  const near = Math.exp(-(dyS * dyS) / (m.Rn * m.Rn));
  const side = ss(-.4, .4, u);
  const sm = s.smileR + (s.smileL - s.smileR) * side, fr = s.frownR + (s.frownL - s.frownR) * side;
  let dx = 0, dy = 0, dz = 0;
  // angoli della bocca: su col sorriso, giù col broncio (u², poi sfuma oltre l'angolo)
  const corner = au <= 1 ? au * au : Math.exp(-(au - 1) * (au - 1) / .3);
  dy += (sm * m.ks - fr * m.kf + m.curve0) * corner * near;
  // il sorriso allarga la bocca
  if (sm > 0) dx += sm * m.kw * Math.max(-1.25, Math.min(1.25, u)) * near * Math.exp(-Math.max(0, au - 1.25) * Math.max(0, au - 1.25) * 2);
  // bacio e "O": la bocca si stringe e va avanti
  const pk = s.pucker, fn = s.funnel;
  if (pk + fn > 0) {
    const g2 = Math.exp(-(u * u) / .9 - (dyS * dyS) / (m.Rp * m.Rp));
    dx -= (pk * .62 + fn * .4) * x * g2; dz += (pk + fn * .5) * m.kz * g2;
    // bocca a "o": al centro le labbra si staccano (poco col bacio, di più con la O)
    const o2 = Math.exp(-(u * u) / .14) * near * (pk * .45 + fn * .6);
    dy += patch === 2 ? -o2 : o2 * .7;
  }
  if (patch === 2) {
    // mandibola: ruota attorno al cardine e scende; vicino al taglio ha la forma della bocca (angoli fermi)
    if (s.jaw > 0) {
      const t = ss(0, m.Rj, -dyS);
      const lens = au < 1 ? Math.pow(1 - au * au, .62) : 0;
      const wide = Math.exp(-Math.pow(x / m.Wj, 4));
      const wl = (lens + (wide - lens) * t) * (m.jf ? Math.exp(-Math.pow(Math.max(0, -dyS - m.jf), 2) / (m.jf * m.jf)) : 1);
      const jw = s.jaw * wl, a = jw * m.A, ry = y - m.hy, rz = z - m.hz, ca = Math.cos(a), sa = Math.sin(a);
      dy += (ry * ca - rz * sa - ry) - jw * m.T; dz += (ry * sa + rz * ca - rz); o.a = a * fw;
    }
  } else if (s.jaw > 0) dy += s.jaw * m.Hu * (au < 1 ? Math.sqrt(1 - au * au) : 0) * Math.exp(-(dyS * dyS) / (m.Ru * m.Ru));
  // guance: si gonfiano verso fuori e salgono col sorriso
  if (m.kc > 0 && (s.puff > 0 || s.smile > 0)) {
    for (let sd = -1; sd <= 1; sd += 2) {
      const gx = (x - sd * m.cx) / (m.cr * 1.25), gy = (y - m.cy) / m.cr, gc = Math.exp(-(gx * gx + gy * gy));
      if (gc < .01) continue;
      // verso i lati e un po' avanti: di fronte la faccia si allarga
      const k = s.puff * m.kc * gc; dx += sd * k * .95; dz += k * .45; dy -= k * .12;
      dy += (sd > 0 ? s.smileL : s.smileR) * .55 * gc;
    }
  }
  o.x = dx * fw; o.y = dy * fw; o.z = dz * fw; return o;
}
// sopracciglio appoggiato sulla pelle: tubo con centro su una curva (interno → esterno) che si piega con le espressioni
function surfBrow(THREE, F, mat, o) {
  const N = 14, R = 8, side = o.side;
  const nv = (N + 1) * (R + 1), pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), idx = [];
  for (let k = 0; k < N; k++) for (let j = 0; j < R; j++) { const a = k * (R + 1) + j, b = a + 1, c = a + R + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  // tappi: le estremità si chiudono con il raggio che va a zero
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); g.setIndex(idx);
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; F.root.add(mesh);
  const Bw = { mesh, o, side, N, R, pos, nrm, n3: [0, 0, 0], last: -1 };
  F.P.brows.push(Bw); updateBrow(F, Bw, 0, 0); return mesh;
}
function updateBrow(F, Bw, di, dout) {
  const { o, side, N, R, pos, nrm, n3 } = Bw;
  const key = di * 1000 + dout; if (Math.abs(key - Bw.last) < 1e-4) return; Bw.last = key;
  const xIn = side * (o.x - o.w / 2), xOut = side * (o.x + o.w / 2);
  for (let k = 0; k <= N; k++) {
    const sN = k / N;
    const x = xIn + (xOut - xIn) * sN;
    const y = o.y + o.arch * 4 * sN * (1 - sN) + o.tilt * (sN - .5) + di * (1 - sN) + dout * sN;
    F.norm(x, y, n3);
    const z = F.surf(x, y) + o.th * .35 + (o.lift || 0);
    // tangente (2D) e laterale
    const x2 = xIn + (xOut - xIn) * Math.min(1, sN + .05), x1 = xIn + (xOut - xIn) * Math.max(0, sN - .05);
    const ty = (o.arch * 4 * (2 * .05) * (1 - 2 * sN) + (o.tilt + dout - di) * .1);
    let tx = (x2 - x1), tyy = ty; const tl = Math.hypot(tx, tyy) || 1; tx /= tl; tyy /= tl;
    // asse perpendicolare alla tangente nel piano della pelle
    let px = -tyy, py = tx, pz = 0; const dp = px * n3[0] + py * n3[1]; px -= dp * n3[0]; py -= dp * n3[1]; pz -= dp * n3[2]; const pl = Math.hypot(px, py, pz) || 1; px /= pl; py /= pl; pz /= pl;
    // spessore: pieno all'interno, cala verso l'esterno, tappi rotondi
    const end = Math.sin(Math.min(1, sN / .12) * PI / 2) * Math.sqrt(Math.max(0, Math.min(1, (1 - sN) / .1)));
    const th = o.th * (1 - .45 * sN) * Math.max(.05, end);
    for (let j = 0; j <= R; j++) {
      const a = j / R * 2 * PI, ca = Math.cos(a), sa = Math.sin(a);
      const ox = px * ca + n3[0] * sa, oy = py * ca + n3[1] * sa, oz = pz * ca + n3[2] * sa, q = (k * (R + 1) + j) * 3;
      pos[q] = x + ox * th; pos[q + 1] = y + oy * th; pos[q + 2] = z + oz * th * .7;
      nrm[q] = ox; nrm[q + 1] = oy; nrm[q + 2] = oz;
    }
  }
  Bw.mesh.geometry.attributes.position.needsUpdate = true; Bw.mesh.geometry.attributes.normal.needsUpdate = true;
}

// ═══ aggiornamento a ogni fotogramma ═══════════════════════════════════════
const _d = { x: 0, y: 0, z: 0, a: 0 };
export function kitUpdate(g, bs, t, h) {
  const P = g.userData.P; if (!P) return; const ud = g.userData;
  const s = ud.s || (ud.s = {}); readState(s, bs);
  // tempo e posa della testa (per le molle)
  const pv = ud.pv || (ud.pv = { t: -1, yaw: 0, pitch: 0, roll: 0, x: 0, y: 0, wy: 0, wp: 0, wr: 0, vx: 0, vy: 0, pitch0: 0, roll0: 0 });
  let dt = pv.t < 0 ? 0 : t - pv.t; pv.t = t; if (!(dt > 0) || dt > .25) dt = 0;
  const pose = h && h.pose;
  if (pose && dt > 0) {
    const k = 1 - Math.exp(-dt / .06);
    pv.wy += ((pose.yaw - pv.yaw) / dt - pv.wy) * k; pv.wp += ((pose.pitch - pv.pitch) / dt - pv.wp) * k; pv.wr += ((pose.roll - pv.roll) / dt - pv.wr) * k;
    pv.vx += ((pose.x - pv.x) / dt - pv.vx) * k; pv.vy += ((pose.y - pv.y) / dt - pv.vy) * k;
  } else { pv.wy = pv.wp = pv.wr = pv.vx = pv.vy = 0; }
  if (pose) { pv.yaw = pose.yaw; pv.pitch = pose.pitch; pv.roll = pose.roll; pv.x = pose.x; pv.y = pose.y; }
  const F = ud.F;
  // ── pelle e parti che la seguono ──
  if (F) {
    const key = s.jaw * 1.1 + s.smileL * 2.3 + s.smileR * 3.7 + s.frownL * 5.1 + s.frownR * 7.3 + s.pucker * 11.7 + s.funnel * 13.1 + s.puff * 17.9;
    const changed = ud._fk === undefined || Math.abs(key - ud._fk) > 1e-4;
    if (changed) ud._fk = key;
    for (const sk of P.skins) {
      if (!changed && !sk.post) continue;
      {
        const a = sk.pos.array, r = sk.rest, pt = sk.pt;
        const na = sk.nrm && sk.nrm.array, nr = sk.nrest;
        for (let i = 0; i < sk.n; i++) {
          const q = i * 3; applyW(F.m, sk.W, i * WS, s, _d);
          a[q] = r[q] + _d.x; a[q + 1] = r[q + 1] + _d.y; a[q + 2] = r[q + 2] + _d.z;
          if (na) { const ca = Math.cos(_d.a), sa = Math.sin(_d.a), ny = nr[q + 1], nz = nr[q + 2]; na[q + 1] = ny * ca - nz * sa; na[q + 2] = ny * sa + nz * ca; }
        }
        if (sk.post) sk.post(a, r, t);
        sk.pos.needsUpdate = true; if (na) sk.nrm.needsUpdate = true;
      }
    }
    if (changed) {
      for (const L of P.lips) updateLip(F, L, s);
      for (const f of P.follow) { const an = f.anchor; fieldAt(F.m, an[0], an[1], an[2], f.patch, s, _d); f.obj.position.set(f.rest.x + _d.x, f.rest.y + _d.y, f.rest.z + _d.z); if (f.patch === 2) f.obj.rotation.x = f.rx + s.jaw * F.m.A * .6; }
    }
    // lingua: con la mandibola, e fuori con tongueOut
    const T = F.tongue;
    if (T) {
      const an = T.rest; fieldAt(F.m, an[0], an[1], an[2], 2, s, _d);
      const out = s.tongue;
      T.grp.position.set(an[0] + _d.x, an[1] + _d.y - out * .55, an[2] + _d.z + out * T.out);
      T.grp.rotation.set(s.jaw * F.m.A * .8 + out * .28, Math.sin(t * 6.5) * .1 * out, Math.sin(t * 4.3) * .05 * out);
      T.mesh.scale.set(1 - out * .1, 1, 1 + out * .45);
    }
    // sopracciglia: interno/esterno
    for (const Bw of P.brows) {
      const L = Bw.side > 0, k = Bw.o.k;
      const dn = L ? s.browDnL : s.browDnR, ou = L ? s.browOutL : s.browOutR, sq = L ? s.squintL : s.squintR, wd = L ? s.wideL : s.wideR;
      const di = (s.browIn * 1.9 - dn * 1.25 - sq * .3 + wd * .45 + s.frown * .25) * k;
      const dout = (ou * 1.6 + s.browIn * .45 - dn * .5 - sq * .2 + wd * .4 - s.frown * .2) * k;
      updateBrow(F, Bw, di, dout);
    }
  }
  // ── occhi: palpebre e sguardo ──
  for (const E of P.eyes) {
    const L = E.side > 0;
    const bl = L ? s.blinkL : s.blinkR, sq = (L ? s.squintL : s.squintR) * E.squintK, wd = L ? s.wideL : s.wideR, sm = L ? s.smileL : s.smileR;
    const ly = s.lookY;
    let eU = E.open + wd * 14 + ly * 12 - sq * 16;
    let eL = E.lowRest + sq * 30 + sm * 12 - wd * 6 + (ly < 0 ? ly * 8 : 0);
    eL = lerp(eL, E.blinkLow, bl * .7);
    eU = lerp(eU, eL - 4, bl);           // chiuso: la palpebra di sopra passa un filo sotto quella di sotto
    setLids(E, eU, eL);
    E.ball.rotation.set(-s.lookY * E.look[1], s.lookX * E.look[0], 0);
  }
  // sopracciglia rigide (scene)
  for (const b of P.rbrows) {
    const L = b.side > 0; const out = L ? s.browOutL : s.browOutR, dn = L ? s.browDnL : s.browDnR;
    b.obj.position.y = b.y + (s.browIn * .9 + out * .6 - dn * .75) * b.k;
    b.obj.rotation.z = b.rz + b.side * (-s.browIn * .22 + dn * .2 + out * .1);
  }
  // ── molle ──
  if (P.springs.length) {
    const steps = dt > 0 ? Math.min(4, Math.ceil(dt / (1 / 120))) : 0, h2 = steps ? dt / steps : 0;
    for (const S of P.springs) {
      const tg = S.tg; tg[0] = tg[1] = tg[2] = 0;
      if (S.expr) S.expr(s, t, tg);
      if (S.grav && pose) { tg[0] += -pose.pitch * S.grav * .7; tg[2] += -pose.roll * S.grav; }
      const dr = S.drive;
      const f0 = -pv.wp * dr[0] - pv.vy * S.lin, f1 = -pv.wy * dr[1], f2 = -pv.wr * dr[2] + pv.vx * S.lin;
      if (!steps) { S.a[0] = tg[0]; S.a[1] = tg[1]; S.a[2] = tg[2]; S.v[0] = S.v[1] = S.v[2] = 0; }
      for (let n = 0; n < steps; n++) for (let c = 0; c < 3; c++) {
        const goal = tg[c] + (c === 0 ? f0 : c === 1 ? f1 : f2);
        S.v[c] += (S.k * (goal - S.a[c]) - S.c * S.v[c]) * h2; S.a[c] += S.v[c] * h2;
        if (S.a[c] > S.max) { S.a[c] = S.max; S.v[c] = 0; } else if (S.a[c] < -S.max) { S.a[c] = -S.max; S.v[c] = 0; }
      }
      S.obj.rotation.set(S.rx + S.a[0], S.ry + S.a[1], S.rz + S.a[2]);
    }
  }
  for (const f of P.fx) f(s, t, bs, F, dt);
  for (const f of P.ring) f(s);
}

// ═══ scene col viso vero (cornici, costumi aperti davanti) ═══════════════════
const FACE_OVAL_IDS = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
// rim(a) → {r, z}: distanza dal centro (0,cy) e profondità del contorno del viso nella direzione a (radianti)
export function ovalRim(h, o) {
  o = o || {}; const cy = o.cy === undefined ? -0.5 : o.cy, N = 120;
  const pts = FACE_OVAL_IDS.map(i => { const v = h.lm(i); return { a: Math.atan2(v.y - cy, v.x), r: Math.hypot(v.x, v.y - cy), z: v.z }; }).sort((p, q) => p.a - q.a);
  const R = new Float32Array(N), Z = new Float32Array(N);
  for (let k = 0; k < N; k++) {
    const a = -PI + (k / N) * 2 * PI; let j = pts.findIndex(p => p.a > a); if (j < 0) j = 0;
    const p2 = pts[j], p1 = pts[(j + pts.length - 1) % pts.length];
    let a1 = p1.a, a2 = p2.a, aa = a; if (a2 <= a1) a2 += 2 * PI; if (aa < a1) aa += 2 * PI;
    const t = c01((aa - a1) / ((a2 - a1) || 1)); R[k] = p1.r + (p2.r - p1.r) * t; Z[k] = p1.z + (p2.z - p1.z) * t;
  }
  for (let it = 0; it < 3; it++) for (const A of [R, Z]) { const c = A.slice(); for (let k = 0; k < N; k++) A[k] = (c[(k + N - 1) % N] + 2 * c[k] + c[(k + 1) % N]) / 4; }
  const kt = o.top || 1.06, ks = o.side || 1.1, kb = o.bottom || 1.16;
  const f = (a) => {
    let u = ((a + PI) / (2 * PI)) * N; u = ((u % N) + N) % N; const k0 = Math.floor(u), k1 = (k0 + 1) % N, t = u - k0;
    const sn = Math.sin(a); const m = ks + (kt - ks) * Math.max(0, sn) ** 2 + (kb - ks) * Math.max(0, -sn) ** 2;
    return { r: (R[k0] + (R[k1] - R[k0]) * t) * m, z: Z[k0] + (Z[k1] - Z[k0]) * t };
  };
  f.cy = cy; return f;
}
// guscio attorno alla finestra del viso. prof: righe [k, z, w]. userData.jw = peso "mandibola" per vertice.
export function faceRing(THREE, h, rim, o) {
  const prof = o.prof, nu = o.nu || 96, nv = o.nv || 32, cy = rim.cy, sx = o.sx || 1, sy = o.sy || 1;
  const jw = [];
  const fn = (u, v) => {
    const a = u * 2 * PI - PI / 2, p = crom(prof, v), rm = rim(a), k = o.shape ? o.shape(a, v) : 1;
    const w = c01(p[2] === undefined ? 0 : p[2]);
    const ex = 1 + (sx - 1) * c01(v * 2), ey = 1 + (sy - 1) * c01(v * 2);
    return [rm.r * p[0] * k * Math.cos(a) * ex, cy + rm.r * p[0] * k * Math.sin(a) * ey, (1 - w) * (rm.z + p[1]) + w * p[1]];
  };
  const g = surf(THREE, nu, nv, (u, v) => { const a = u * 2 * PI - PI / 2; jw.push(c01((-Math.sin(a) - .15) / .6) * Math.max(0, 1 - v * (o.jawFall || 3))); return fn(u, v); });
  g.userData.fn = fn; g.userData.jw = jw; return g;
}
export function rimCurve(THREE, rim, k, dz, n) {
  const pts = []; n = n || 72;
  for (let i = 0; i < n; i++) { const a = (i / n) * 2 * PI - PI / 2, r = rim(a); pts.push(new THREE.Vector3(r.r * k * Math.cos(a), rim.cy + r.r * k * Math.sin(a), r.z + dz)); }
  return new THREE.CatmullRomCurve3(pts, true);
}
export function rimTube(THREE, mat, rim, k, dz, th, P, amt) {
  const m = new THREE.Mesh(new THREE.TubeGeometry(rimCurve(THREE, rim, k, dz, 72), 144, th, 10, true), mat);
  if (P) { const pos = m.geometry.attributes.position, jw = []; for (let i = 0; i < pos.count; i++) jw.push(c01((-(pos.getY(i) - rim.cy) / 9 - .15) / .6)); m.geometry.userData.jw = jw; regRingJaw(P, m, amt); }
  return m;
}
// Il mento vero scende di ~1,2–1,6 cm a bocca spalancata (misurato col modello): il bordo sotto scende un po' di più
export const RING_JAW = 1.7;
// la parte bassa del bordo scende col mento (jawOpen): morph sui vertici
export function regRingJaw(P, mesh, amt) {
  const pos = mesh.geometry.attributes.position; const base = Float32Array.from(pos.array); const jw = mesh.geometry.userData.jw; if (!jw) return;
  let last = -1; const A = amt || RING_JAW;
  P.ring.push((s) => { const d = -A * s.jaw; if (Math.abs(d - last) < .005) return; last = d; for (let i = 0; i < pos.count; i++) pos.array[i * 3 + 1] = base[i * 3 + 1] + d * jw[i]; pos.needsUpdate = true; });
}
// Scene col viso vero: l'occlusore del viso nell'app è "transparent", copre solo gli oggetti disegnati dopo di lui:
// tutto "transparent" (opacità invariata) così ciò che sta dietro al viso non spunta mai davanti.
export function sceneFinish(root) {
  root.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) { if (!m.transparent) { m.transparent = true; m.opacity = m.opacity === undefined ? 1 : m.opacity; } } });
}
export function ringColors(THREE, geo, nu, fn) {
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  const nv = pos.count / (nu + 1) - 1;
  for (let i = 0; i < pos.count; i++) { c.set(fn(pos.getX(i), pos.getY(i), pos.getZ(i), Math.floor(i / (nu + 1)) / nv)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); return geo;
}
export function rimTeeth(THREE, P, root, rim, o) {
  const teeth = [], Y = new THREE.Vector3(0, 1, 0), mat = o.mat;
  for (let i = 0; i < o.n; i++) {
    const a = (i + .5) / o.n * 2 * PI - PI / 2; if (o.filter && !o.filter(a)) continue;
    const r = rim(a), k = o.k || 1.04, x = r.r * k * Math.cos(a), y = rim.cy + r.r * k * Math.sin(a);
    const len = (o.len || 1.8) * (o.lenFn ? o.lenFn(a) : 1);
    const m = new THREE.Mesh(new THREE.ConeGeometry(o.r || .55, len, 10), mat); m.geometry.translate(0, len / 2, 0);
    const dir = new THREE.Vector3(-Math.cos(a), -Math.sin(a), o.fwd === undefined ? .25 : o.fwd).normalize();
    m.quaternion.setFromUnitVectors(Y, dir); m.position.set(x, y, r.z + (o.dz || 1.6)); root.add(m);
    teeth.push({ m, y, w: c01((-Math.sin(a) - .15) / .6) });
  }
  const A = o.jaw || RING_JAW;
  P.ring.push((s) => { const d = -A * s.jaw; for (const t of teeth) t.m.position.y = t.y + d * t.w; });
  return teeth;
}
export function chestPlate(THREE, o) {
  o = o || {}; const W = o.w || 19, y0 = o.top === undefined ? -12.5 : o.top, y1 = o.bottom === undefined ? -32 : o.bottom, z0 = o.z || 4.4, bz = o.bulge === undefined ? 5 : o.bulge, sh = o.shoulder === undefined ? 4.5 : o.shoulder;
  return surf(THREE, o.nu || 40, o.nv || 14, (u, v) => {
    const x = W - 2 * W * u, ax = Math.abs(x) / W, yt = y0 - sh * ax * ax, y = yt + (y1 - yt) * v;
    return [x, y, z0 + bz * Math.sqrt(Math.max(0, 1 - ax * ax)) * (.65 + .35 * (1 - v))];
  }, false);
}
export function rimDome(THREE, mat, rim, k, dz, zF) {
  return new THREE.Mesh(surf(THREE, 72, 12, (u, v) => {
    const a = u * 2 * PI - PI / 2, r = rim(a), rho = 1 - v, z0 = r.z + dz;
    return [r.r * k * rho * Math.cos(a), rim.cy + r.r * k * rho * Math.sin(a), z0 + (zF - z0) * Math.sqrt(Math.max(0, 1 - rho * rho))];
  }), mat);
}
/** peso "mandibola" per una mesh qualsiasi attorno alla finestra (parte bassa) e registrazione */
export function ringJawMesh(P, m, cy, amt) { const pos = m.geometry.attributes.position, jw = []; for (let i = 0; i < pos.count; i++) jw.push(c01((-(pos.getY(i) - cy) / 9 - .15) / .6)); m.geometry.userData.jw = jw; regRingJaw(P, m, amt); return m; }

// ═══ aiuti per i personaggi ═════════════════════════════════════════════════
/** Coppia di orecchie con molla. make(ear, sd) riempie il gruppo (coordinate dell'orecchio: base all'origine, punta verso +y).
 *  o: { x, y, z, rx, ry, rz (per il lato +x; specchiati per -x), floppy 0..1, perk, back, k, c, drive } */
export function earPair(THREE, F, o, make) {
  const out = [];
  for (const sd of [1, -1]) {
    const ear = new THREE.Group(); ear.position.set(sd * o.x, o.y, o.z); ear.rotation.set(o.rx || 0, sd * (o.ry || 0), sd * (o.rz || 0), 'YXZ');
    make(ear, sd); F.root.add(ear); out.push(ear);
    const fl = o.floppy || 0, perk = o.perk === undefined ? 1 : o.perk, back = o.back === undefined ? 1 : o.back, ph = sd * 1.7 + (o.phase || 0);
    spring(F.P, ear, {
      k: o.k || (fl ? 38 : 105), c: o.c || (fl ? 4.5 : 9.5), drive: o.drive || (fl ? [.3, .14, .34] : [.09, .06, .11]), lin: fl ? .012 : .005, grav: fl, max: fl ? 1.1 : .7,
      expr: (s, t, a) => {
        const dn = sd > 0 ? s.browDnL : s.browDnR, up = s.browIn * .7 + (sd > 0 ? s.browOutL : s.browOutR) * .3, wd = (s.wideL + s.wideR) * .5;
        a[0] = (up * .14 + wd * .1) * perk - dn * .2 * back;             // sorpresa: su e avanti; arrabbiato: indietro
        a[2] = sd * ((up * .14 + wd * .08) * perk - dn * .22 * back - s.frown * .12 * back);
        // ogni tanto un piccolo scatto (orecchio che si muove da solo)
        const tw = Math.pow(Math.max(0, Math.sin(t * .83 + ph)), 60);
        a[1] = tw * .22 * sd; a[2] += tw * .12 * sd;
      },
    });
  }
  return out;
}
/** Baffi: ciuffi di peli sottili ai lati del muso, seguono il labbro di sopra (sorriso) e hanno inerzia.
 *  o: { x, y, z?, n, len, r, color|mat, spread, droop, ry } */
export function whiskers(THREE, F, o) {
  const mat = o.mat || PM(THREE, o.color === undefined ? 0xf6f2ea : o.color, { roughness: .4 });
  const out = [];
  for (const sd of [1, -1]) {
    const grp = new THREE.Group(); const x = sd * o.x, z = (o.z === undefined ? F.surf(x, o.y) : o.z) - .1;
    grp.position.set(x, o.y, z); F.root.add(grp);
    const n = o.n || 3, L = o.len || 6;
    for (let i = 0; i < n; i++) {
      const a = ((n > 1 ? i / (n - 1) : .5) - .5) * (o.spread || .5) - (o.droop || .08), cy = Math.sin(a), cx = Math.cos(a);
      const pts = []; for (let k = 0; k <= 4; k++) { const t = k / 4; pts.push([sd * cx * L * t, cy * L * t - t * t * L * .07, -t * L * (o.back || .18)]); }
      grp.add(strand(THREE, mat, pts, o.r || .07, (o.r || .07) * .3, 8));
    }
    grp.rotation.y = sd * (o.ry || 0);
    followObj(F, grp, 1);
    spring(F.P, grp, { k: 70, c: 5, drive: [.12, .14, .16], lin: .01, max: .5,
      expr: (s, t, a) => { a[2] = sd * ((sd > 0 ? s.smileL : s.smileR) * .22 - s.frown * .12 + s.sneer * .15) + Math.sin(t * 2.6 + sd) * .015; a[1] = -sd * (s.pucker * .25); } });
    out.push(grp);
  }
  return out;
}
/** Orecchio a punta morbido: sagoma (larghezza w, altezza ht) estrusa con smusso, piegata a coppa. */
export function softEarGeo(THREE, w, ht, th, o) {
  o = o || {};
  const sh = new THREE.Shape(), r = o.tip === undefined ? .18 : o.tip;
  sh.moveTo(-w / 2, 0); sh.quadraticCurveTo(-w * .48, ht * .55, -w * r * .5, ht * (1 - r * .3)); sh.quadraticCurveTo(0, ht * (1 + r * .25), w * r * .5, ht * (1 - r * .3));
  sh.quadraticCurveTo(w * .48, ht * .55, w / 2, 0); sh.quadraticCurveTo(0, -ht * .06, -w / 2, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: true, bevelThickness: th * .6, bevelSize: Math.min(w, ht) * .07, bevelSegments: 4, curveSegments: 14 });
  g.translate(0, 0, -th / 2);
  const p = g.attributes.position, cup = o.cup === undefined ? .22 : o.cup, bend = o.bend || 0;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, p.getZ(i) - cup * x * x / w + bend * y * y / ht); }
  g.computeVertexNormals(); return g;
}
/** Becco a due metà (sopra fisso, sotto sul cardine, interno scuro). o: { y, z?, w, h, len, color, lowColor, open (rad), inside } */
export function beak(THREE, F, o) {
  const mat = o.mat || glossMat(THREE, o.color || 0xf3a02a, { roughness: .35, clearcoat: .5 });
  const lowMat = o.lowMat || glossMat(THREE, o.lowColor || o.color || 0xe08a20, { roughness: .4, clearcoat: .4 });
  const z0 = (o.z === undefined ? F.surf(0, o.y) : o.z) - (o.sink === undefined ? .8 : o.sink);
  // metà becco: sezione a mezzo ovale, profilo che parte tondo alla base e finisce a punta morbida
  const half = (upper, L, W, H) => {
    const nu = 28, nv = 16, sharp = o.sharp === undefined ? 1.0 : o.sharp;
    return surf(THREE, nu, nv, (u, v) => {
      const t = v, r = Math.min(1, Math.sqrt(t / .1)) * Math.pow(Math.max(0, 1 - t), sharp * .85) * .98 + (t >= 1 ? 0 : .02);
      const a = PI * u; const cx = Math.cos(a), cy = Math.sin(a) * (upper ? 1 : -1);
      const hook = upper ? -Math.pow(t, 3) * (o.hook || 0) * H : 0;
      return [cx * W * r, cy * H * (upper ? 1 : .75) * r + hook, t * L];
    }, false);
  };
  const up = new THREE.Mesh(half(true, o.len, o.w, o.h), mat); up.material.side = THREE.DoubleSide; up.position.set(0, o.y, z0); F.root.add(up);
  const jaw = new THREE.Group(); jaw.position.set(0, o.y, z0); F.root.add(jaw);
  const lo = new THREE.Mesh(half(false, o.len * .9, o.w * .92, o.h * .85), lowMat); jaw.add(lo);
  // dentro: superficie scura appena sopra la metà di sotto
  const ins = new THREE.Mesh(surf(THREE, 16, 10, (u, v) => { const r = Math.min(1, Math.sqrt(v / .1)) * Math.pow(Math.max(0, 1 - v), .85) * .92; return [(u - .5) * 2 * o.w * r, .02, v * o.len * .9]; }, false), new THREE.MeshStandardMaterial({ color: o.inside || 0x6a2230, roughness: .8, side: THREE.DoubleSide })); jaw.add(ins);
  const tongue = ell(THREE, PM(THREE, 0xe86a82, { roughness: .45 }), o.w * .45, o.h * .14, o.len * .28, 0, -o.h * .12, o.len * .3, 16); jaw.add(tongue);
  const B2 = { up, jaw, open: o.open || .7, y: o.y, z0 };
  F.fx((s, t) => { const j = Math.max(s.jaw, s.tongue * .4); jaw.rotation.x = j * B2.open; up.rotation.x = -j * B2.open * .3 - s.pucker * .05; up.position.z = jaw.position.z = z0 + s.pucker * .9; up.scale.x = jaw.scale.x = 1 - s.pucker * .15 + s.smile * .1; up.scale.y = jaw.scale.y = 1 + s.pucker * .15; tongue.position.z = o.len * .3 + s.tongue * o.len * .4; });
  return B2;
}
function M2(THREE, c) { return new THREE.MeshStandardMaterial({ color: c, roughness: .8 }); }
/** Colori sulla pelle (macchie, maschere): fn(x, y, z) → hex o null; moltiplica il colore del materiale (vertexColors). */
export function paintSkin(THREE, mesh, fn) {
  const p = mesh.geometry.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const v = fn(p.getX(i), p.getY(i), p.getZ(i)); c.set(v === null || v === undefined ? 0xffffff : v); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  mesh.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3)); mesh.material = mesh.material.clone(); mesh.material.vertexColors = true; return mesh;
}
/** Naso arrotondato lucido (ellissoide deformato): shape 'heart' | 'tri' | 'round'. Appoggiato alla pelle in (x, y). */
export function nose(THREE, F, o) {
  const g = new THREE.SphereGeometry(1, 28, 18), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (o.shape === 'tri') { x *= 1 - .55 * c01(-y * .9 + .1); y *= .85; }
    else if (o.shape === 'heart') { x *= 1 - .4 * Math.max(0, -y); y = y * 1.0 + .22 * Math.abs(x) * Math.max(0, y); }
    p.setXYZ(i, x * o.w, y * o.h, z * o.d);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, o.mat || glossMat(THREE, o.color === undefined ? 0x2a1a16 : o.color));
  F.onSurf(m, 0, o.y, o.lift === undefined ? o.d * .45 : o.lift); if (o.rx) m.rotation.x = o.rx; F.root.add(m);
  if (o.nostrils) for (const sd of [1, -1]) { const n = ell(THREE, M2(THREE, o.nostrils), o.w * .16, o.h * .14, o.d * .1, sd * o.w * .38, -o.h * .05, o.d * .92, 10); n.rotation.z = sd * .5; m.add(n); }
  F.fx((s, t) => { const k = 1 + s.puff * .1 + s.sneer * .12; m.scale.set(k * (1 + s.smile * .04), k, k); m.position.y = o.y + s.sneer * .25 + (o.sniff ? Math.sin(t * 9) * .06 * (.3 + s.browIn) : 0); });
  return m;
}
// forma disegnata (alfa) → maschera in grigio per alphaMap (legge il verde), con bordo morbido
// senza ctx.filter (Safari non lo ha): due passate di sfocatura a scatola
function softAlpha(x2, S, r) {
  const img = x2.getImageData(0, 0, S, S), d = img.data, a = new Float32Array(S * S), b = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) a[i] = d[i * 4 + 3] / 255;
  for (let pass = 0; pass < (r > 0 ? 2 : 0); pass++) {
    for (let y = 0; y < S; y++) { let acc = 0; for (let x = -r; x <= r; x++) acc += a[y * S + Math.max(0, Math.min(S - 1, x))]; for (let x = 0; x < S; x++) { b[y * S + x] = acc / (2 * r + 1); acc += a[y * S + Math.min(S - 1, x + r + 1)] - a[y * S + Math.max(0, x - r)]; } }
    for (let x = 0; x < S; x++) { let acc = 0; for (let y = -r; y <= r; y++) acc += b[Math.max(0, Math.min(S - 1, y)) * S + x]; for (let y = 0; y < S; y++) { a[y * S + x] = acc / (2 * r + 1); acc += b[Math.min(S - 1, y + r + 1) * S + x] - b[Math.max(0, y - r) * S + x]; } }
  }
  for (let i = 0; i < S * S; i++) { const v = Math.round(a[i] * 255); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  x2.putImageData(img, 0, 0);
}
/** Decalcomania appoggiata alla pelle (macchie, maschere, segni): griglia che segue la superficie con texture a bordo morbido.
 *  o: { x, y, rx, ry, rot, color, alpha, soft (0..1 bordo sfumato), lift, draw(ctx, S) (forma su canvas, bianco = pieno),
 *       mat (opz.), patch (1 sopra la bocca, 2 sotto, 0 automatico), order } */
export function decal(THREE, F, o) {
  const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S; const x2 = cv.getContext('2d');
  const col = new THREE.Color(o.color === undefined ? 0x141317 : o.color);
  if (o.draw) { o.draw(x2, S); softAlpha(x2, S, o.blur === undefined ? 3 : o.blur); }
  else {
    const soft = o.soft === undefined ? .12 : o.soft, gr = x2.createRadialGradient(S / 2, S / 2, S / 2 * (1 - soft), S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x2.fillStyle = gr; x2.beginPath(); x2.arc(S / 2, S / 2, S / 2, 0, 2 * PI); x2.fill();
    softAlpha(x2, S, 0);
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = o.mat || new THREE.MeshStandardMaterial({ color: col, alphaMap: tex, transparent: true, opacity: o.alpha === undefined ? 1 : o.alpha, depthWrite: false, roughness: o.roughness === undefined ? .8 : o.roughness, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  if (o.mat && !o.mat.alphaMap) { o.mat.alphaMap = tex; o.mat.transparent = true; o.mat.depthWrite = false; }
  const N = o.n || 18, c = Math.cos(o.rot || 0), sn = Math.sin(o.rot || 0);
  const geo = surf(THREE, N, N, (u, v) => { const lx = (u - .5) * 2 * o.rx, ly = (v - .5) * 2 * o.ry, x = o.x + lx * c - ly * sn, y = o.y + lx * sn + ly * c; return [x, y, F.surf(x, y) + (o.lift === undefined ? .03 : o.lift)]; }, false);
  // uv: u → x della texture, v → y (in alto = alto)
  const m = new THREE.Mesh(geo, mat); m.renderOrder = o.order || 3; F.root.add(m); regSkin(F, m, o.patch || 0);
  return m;
}
/** Forma morbida a foglia/orecchio/ala/petalo: ellissoide che si stringe alla base e in punta.
 *  Base all'origine, punta verso +y; w = mezza larghezza, ht = altezza, d = mezzo spessore.
 *  o: { tip: 'round'|'point', point (0.6 tondo … 1.4 aguzzo), base (0..1 quanto è larga la base), cup (conca davanti), bend (piega in avanti) } */
export function leafGeo(THREE, w, ht, d, o) {
  o = o || {};
  const g = new THREE.SphereGeometry(1, o.seg || 26, o.seg ? Math.max(8, o.seg * .75 | 0) : 20), p = g.attributes.position;
  const base = o.base === undefined ? .35 : o.base, pt = o.point === undefined ? (o.tip === 'point' ? 1.1 : .55) : o.point, cup = o.cup || 0, bend = o.bend || 0, sk = o.skew === undefined ? .42 : o.skew;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = (y + 1) / 2;
    // profilo: largo verso sk, stretto in punta (pt) e alla base (base)
    const up = t > sk ? Math.pow(Math.max(0, 1 - (t - sk) / (1 - sk)), pt) : 1;
    const lo = t < sk ? base + (1 - base) * Math.sin(PI / 2 * t / sk) : 1;
    const r = Math.sqrt(Math.max(0, 1 - y * y)) > 1e-6 ? up * lo / Math.sqrt(Math.max(1e-6, 1 - y * y)) : 0;
    let X = x * r * w, Z = z * r * d;
    Z += -cup * (X * X) / w + bend * t * t * ht * .25;
    p.setXYZ(i, X, t * ht, Z);
  }
  g.computeVertexNormals(); return g;
}
