// Maschera di Zorro 3D: fascia di stoffa nera che aderisce al viso (proiettata sulla mesh canonica), fori per gli occhi,
// laccio annodato dietro la testa con due code che dondolano.
import { finish } from './_kit_acc.js';
export const meta = { label: 'Maschera di Zorro', labelEn: 'Zorro mask', category: 'costumi', icon: '🦹' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const cloth = h.mat(0x141318, { roughness: .78, side: THREE.DoubleSide });

  // mesh del viso canonica per proiettare la maschera
  const f = h.face, fgeo = new THREE.BufferGeometry();
  fgeo.setAttribute('position', new THREE.Float32BufferAttribute(Array.from(f.pos), 3)); fgeo.setIndex(Array.from(f.idx)); fgeo.computeVertexNormals();
  const faceMesh = new THREE.Mesh(fgeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); faceMesh.updateMatrixWorld();
  const ray = new THREE.Raycaster();

  // sagoma 2D (x, y) della maschera: banda dalle sopracciglia a sotto gli occhi, punte verso le tempie, scende sul naso
  const top = (x) => 5.55 - 0.03 * x * x + 0.35 * Math.exp(-((Math.abs(x) - 6.3) ** 2) / 0.6);
  const bot = (x) => { const ax = Math.abs(x); return 1.1 + 0.32 * ax - 0.035 * ax * ax + (ax < 1.3 ? 0.5 * (1 - ax / 1.3) : 0); };
  const hole = (x, y) => { const ex = Math.abs(x) - 3.05, ey = y - 2.75; return (ex / 1.75) ** 2 + (ey / 1.0) ** 2 < 1; };
  const inside = (x, y) => Math.abs(x) < 7.0 && y < top(x) && y > bot(x) && !hole(x, y);

  // griglia fine (0.18 cm): celle incluse se il centro è dentro la sagoma; i vertici che cadono fuori vengono
  // portati sul contorno (bisezione verso il centro delle celle vicine) → bordo liscio. Poi proiezione sul viso
  // lungo -Z e spostamento fuori di 0.32 cm lungo la normale.
  const X0 = -7.0, X1 = 7.0, Y0 = 0.6, Y1 = 6.4, S = 0.18;
  const NX = Math.round((X1 - X0) / S), NY = Math.round((Y1 - Y0) / S), W = NX + 1;
  const vin = new Uint8Array(W * (NY + 1));
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) vin[j * W + i] = inside(X0 + i * S, Y0 + j * S) ? 1 : 0;
  // cella inclusa se almeno un angolo è dentro; gli angoli fuori vengono poi portati sul contorno
  const cellIn = new Uint8Array(NX * NY);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const a = j * W + i; cellIn[j * NX + i] = vin[a] | vin[a + 1] | vin[a + W] | vin[a + W + 1]; }
  const P = new Float32Array(W * (NY + 1) * 3), ok = new Uint8Array(W * (NY + 1));
  const dir = new THREE.Vector3(0, 0, -1), o = new THREE.Vector3(), nrm = new THREE.Vector3();
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
    let used = false;
    for (const [di, dj] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) { const ci = i + di, cj = j + dj; if (ci >= 0 && cj >= 0 && ci < NX && cj < NY && cellIn[cj * NX + ci]) used = true; }
    if (!used) continue;
    let x = X0 + i * S, y = Y0 + j * S;
    if (!vin[j * W + i]) {
      // vicino dentro più prossimo (prima i 4 ortogonali, poi le diagonali), bisezione sul segmento
      let best = null;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) { const ni = i + di, nj = j + dj; if (ni >= 0 && nj >= 0 && ni <= NX && nj <= NY && vin[nj * W + ni]) { best = [X0 + ni * S, Y0 + nj * S]; break; } }
      if (!best) continue;
      let ox = x, oy = y, [ix, iy] = best;
      for (let k = 0; k < 12; k++) { const mx = (ox + ix) / 2, my = (oy + iy) / 2; if (inside(mx, my)) { ix = mx; iy = my; } else { ox = mx; oy = my; } }
      x = ix; y = iy;
    }
    ray.set(o.set(x, y, 20), dir);
    const hit = ray.intersectObject(faceMesh, false)[0];
    if (!hit) continue;
    nrm.copy(hit.face.normal); if (nrm.z < 0) nrm.negate();
    const p = hit.point.clone().addScaledVector(nrm, 0.32), k = j * W + i;
    P[k * 3] = p.x; P[k * 3 + 1] = p.y; P[k * 3 + 2] = p.z; ok[k] = 1;
  }
  const I = [];
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    if (!cellIn[j * NX + i]) continue;
    const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
    if (ok[a] && ok[b] && ok[c] && ok[d]) I.push(a, b, c, b, d, c);
  }
  const mg = new THREE.BufferGeometry();
  mg.setAttribute('position', new THREE.BufferAttribute(P, 3)); mg.setIndex(I);
  mg.computeVertexNormals();
  const mask = new THREE.Mesh(mg, cloth);
  g.add(mask);
  // bordino in rilievo attorno ai fori degli occhi (anellini schiacciati sul viso)
  for (const s of [-1, 1]) {
    const pts = [];
    for (let i = 0; i < 48; i++) {
      const a = i / 48 * Math.PI * 2, x = s * 3.05 + Math.cos(a) * 1.78, y = 2.75 + Math.sin(a) * 1.03;
      ray.set(o.set(x, y, 20), dir); const hit = ray.intersectObject(faceMesh, false)[0];
      if (hit) { nrm.copy(hit.face.normal); if (nrm.z < 0) nrm.negate(); pts.push(hit.point.clone().addScaledVector(nrm, 0.38)); }
    }
    // levigatura (media mobile chiusa, 3 passate): i punti proiettati saltano tra faccette diverse
    for (let it = 0; it < 3 && pts.length > 8; it++) { const q = pts.map(v => v.clone()); for (let i = 0; i < pts.length; i++) pts[i].copy(q[(i + pts.length - 1) % pts.length]).add(q[i]).add(q[(i + 1) % pts.length]).multiplyScalar(1 / 3); }
    if (pts.length > 8) g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 96, 0.11, 6, true), h.mat(0x24222a, { roughness: .6 })));
  }

  // laccio: dalle punte della maschera alle tempie e attorno alla testa (sopra i capelli, dietro le orecchie)
  const band = [[7.05, 4.2, 0.3], [7.6, 4.1, -2.4], [7.95, 4.1, -5.5], [6.9, 4.2, -9.0], [3.8, 4.25, -11.3], [0, 4.3, -11.95], [-3.8, 4.25, -11.3], [-6.9, 4.2, -9.0], [-7.95, 4.1, -5.5], [-7.6, 4.1, -2.4], [-7.05, 4.2, 0.3]].map(p => new THREE.Vector3(...p));
  const bcurve = new THREE.CatmullRomCurve3(band);
  const bg = new THREE.TubeGeometry(bcurve, 80, 0.6, 8);
  { const p = bg.attributes.position; for (let i = 0; i < p.count; i++) { const c = bcurve.getPointAt(Math.min(1, Math.floor(i / 9) / 80)); const dx = p.getX(i) - c.x, dz = p.getZ(i) - c.z; p.setX(i, c.x + dx * 0.3); p.setZ(i, c.z + dz * 0.3); } bg.computeVertexNormals(); }
  g.add(new THREE.Mesh(bg, cloth));

  // nodo e code dietro
  const knot = new THREE.Group(); knot.position.set(0, 4.3, -12.1);
  const k0 = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 10), cloth); k0.scale.set(1.2, 1, 0.7); knot.add(k0);
  const tails = [];
  for (const s of [-1, 1]) {
    const t = new THREE.Group(); const strip = new THREE.Mesh(new THREE.BoxGeometry(1.0, 6.5, 0.12), cloth); strip.position.y = -3.25; t.add(strip);
    t.rotation.z = s * 0.35; t.position.x = s * 0.3; knot.add(t); tails.push(t);
  }
  g.add(knot);
  g.userData.tails = tails;
  return finish(THREE, g);
}

export function update(g, bs, t) {
  g.userData.tails.forEach((tl, i) => { tl.rotation.x = Math.sin(t * 2.0 + i) * 0.15; });
}
