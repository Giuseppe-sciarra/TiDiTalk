// strawberry — scena col viso vero (fxchars 1.8.0: kit comune in _kit.js, valori calibrati 0..1)
import { PI, c01, M, PM, gradMat, glossMat, skinMat, furMat, ell, cap, surf, crom, lathe, horn, strand, leafGeo, mixHex, HEAD_FIT, mkRoot, reg, eye, rigidBrow, spring, kitUpdate, ovalRim, faceRing, rimCurve, rimTube, regRingJaw, ringJawMesh, RING_JAW, sceneFinish, ringColors, rimTeeth, chestPlate, rimDome } from './_kit.js';


export const meta = { label: 'Fragola', labelEn: 'Strawberry', category: 'divertenti', icon: '🍓' };
export const hideHead = false;

export default function build(THREE, h) {
  const g = new THREE.Group(); const P = reg(g);
  const root = mkRoot(THREE, g, hideHead ? HEAD_FIT : null);
  const red = gradMat(THREE, h, 0xe02a37, 0xa8182a, { roughness: .45 });
  const green = gradMat(THREE, h, 0x6fc24a, 0x3f8f2c, { roughness: .6 });

  // corpo attorno alla finestra: il bordo segue l'ovale del viso vero (+ margine), poi si allarga a goccia
  const rim = ovalRim(h, { top: 1.1, side: 1.04, bottom: 1.15 }); const CY = rim.cy;
  const prof = [[1.0, .5, 0], [1.1, 1.5, 0], [1.3, 1.3, .15], [1.52, -1.0, .55], [1.64, -4.5, 1], [1.55, -9.5, 1], [1.05, -13.5, 1], [0, -15.5, 1]];
  const shape = (a, v) => 1 + 0.16 * Math.sin(a) * Math.min(1, v * 3);
  const bodyGeo = faceRing(THREE, h, rim, { prof, shape, nu: 96, nv: 44, jawFall: 1.1 }); const pt = bodyGeo.userData.fn;
  const body = new THREE.Mesh(bodyGeo, red); root.add(body); regRingJaw(P, body);
  // bordo interno della finestra (labbro)
  const lipT = rimTube(THREE, M(h, 0xb81f2b, { roughness: .5 }), rim, 1.02, .9, .28); root.add(lipT); ringJawMesh(P, lipT, CY);
  // semi: piccoli ellissoidi gialli disposti sulla superficie (a scacchiera)
  const seedGeo = new THREE.SphereGeometry(.42, 8, 6); seedGeo.scale(1, 1.5, .5);
  const seeds = []; const ROWS = 7, COLS = 18;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const v = .2 + r * .1, u = (c + (r % 2) * .5) / COLS; const p = pt(u, v); if (p[2] < -11) continue;
    seeds.push({ p, u, v, w: c01((-Math.sin(u * 2 * PI - PI / 2) - .15) / .6) * Math.max(0, 1 - v * 1.1) });
  }
  const inst = new THREE.InstancedMesh(seedGeo, M(h, 0xf7e27a, { roughness: .5 }), seeds.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 0, 1);
  seeds.forEach((sd, i) => {
    const p1 = pt(sd.u + .01, sd.v), p2 = pt(sd.u, sd.v + .01);
    const n = new THREE.Vector3().crossVectors(new THREE.Vector3(p1[0] - sd.p[0], p1[1] - sd.p[1], p1[2] - sd.p[2]), new THREE.Vector3(p2[0] - sd.p[0], p2[1] - sd.p[1], p2[2] - sd.p[2])).normalize();
    if (n.dot(new THREE.Vector3(sd.p[0], sd.p[1] - CY, sd.p[2] + 4)) < 0) n.negate();
    q.setFromUnitVectors(up, n);
    sd.pos = new THREE.Vector3(sd.p[0] + n.x * .15, sd.p[1] + n.y * .15, sd.p[2] + n.z * .15); sd.q = q.clone();
    m4.compose(sd.pos, q, new THREE.Vector3(1, 1, 1)); inst.setMatrixAt(i, m4);
  });
  // i semi della parte bassa seguono il mento come il guscio
  { const one = new THREE.Vector3(1, 1, 1), tp = new THREE.Vector3(); let last = 0;
    P.fx.push((s) => { const d = -1.8 * s.jaw; if (Math.abs(d - last) < .01) return; last = d;
      seeds.forEach((sd, i) => { if (!sd.w) return; tp.copy(sd.pos); tp.y += d * sd.w; m4.compose(tp, sd.q, one); inst.setMatrixAt(i, m4); }); inst.instanceMatrix.needsUpdate = true; }); }
  root.add(inst);
  // foglie (calice) in cima + picciolo
  const leaves = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * 2 * PI; const lf = new THREE.Group(); lf.position.set(0, 14.4, -4.6);
    const m = ell(THREE, green, 1.5, 4.4, .5, 0, 3.4, 0, 14); lf.add(m);
    lf.rotation.set(0, 0, 0); lf.rotation.z = -Math.sin(a) * 0; lf.rotation.x = Math.cos(a) * 1.25; lf.rotation.z = Math.sin(a) * 1.25;
    root.add(lf); leaves.push({ lf, a });
  }
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.5, .7, 4.5, 10), M(h, 0x4f8f2c)); stem.position.set(0, 16.0, -4.6); stem.rotation.z = .2; root.add(stem);
  P.fx.push((s, t) => {
    leaves.forEach(({ lf, a }, i) => { const k = 1.25 - s.browIn * .35 - s.smile * .2 + Math.sin(t * 1.3 + i) * .04; lf.rotation.x = Math.cos(a) * k; lf.rotation.z = Math.sin(a) * k; });
    
    stem.rotation.z = .2 + Math.sin(t * 1.1) * .08;
  });
  sceneFinish(root);
  return g;
}
export function update(g, bs, t, h) { kitUpdate(g, bs, t, h); }
