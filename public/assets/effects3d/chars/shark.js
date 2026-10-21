// shark — scena col viso vero (fxchars 1.8.0: kit comune in _kit.js, valori calibrati 0..1)
import { PI, c01, M, PM, gradMat, glossMat, skinMat, furMat, ell, cap, surf, crom, lathe, horn, strand, leafGeo, mixHex, HEAD_FIT, mkRoot, reg, eye, rigidBrow, spring, kitUpdate, ovalRim, faceRing, rimCurve, rimTube, regRingJaw, ringJawMesh, RING_JAW, sceneFinish, ringColors, rimTeeth, chestPlate, rimDome } from './_kit.js';


export const meta = { label: 'Squalo', labelEn: 'Shark', category: 'divertenti', icon: '🦈' };
export const hideHead = false;

export default function build(THREE, h) {
  const g = new THREE.Group(); const P = reg(g);
  const root = mkRoot(THREE, g, hideHead ? HEAD_FIT : null);
  // il viso spunta dalla bocca spalancata dello squalo: il bordo della bocca segue l'ovale del viso vero
  const rim = ovalRim(h, { top: 1.12, side: 1.1, bottom: 1.18 }); const CY = rim.cy;
  const NU = 96;
  const prof = [[1.0, .4, 0], [1.07, 1.7, 0], [1.2, 2.2, 0], [1.4, .8, .2], [1.6, -2.6, .6], [1.66, -7, 1], [1.5, -12, 1], [.95, -16, 1], [0, -18, 1]];
  const shape = (a, v) => 1 + .16 * Math.max(0, Math.sin(a)) * Math.min(1, v * 2.2);
  const geo = faceRing(THREE, h, rim, { prof, shape, sy: 1.08, nu: NU, nv: 40, jawFall: 1.1 }); const fn = geo.userData.fn;
  ringColors(THREE, geo, NU, (x, y, z, v) => {
    if (v < .1) return mixHex(0x8e2a3a, 0xc4566a, v / .1);                     // gengive / interno bocca
    const belly = c01((CY - 2 - y) / 6 + .5) * c01((z + 6) / 6);               // pancia bianca sotto e davanti
    return mixHex(mixHex(0x5f7488, 0x8197aa, c01((y + 4) / 18)), 0xe7ebee, belly);
  });
  const skin = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: .45, metalness: 0, clearcoat: .5, clearcoatRoughness: .35 });
  const body = new THREE.Mesh(geo, skin); root.add(body); regRingJaw(P, body);
  // labbro/gengiva lungo la bocca + denti tutto attorno
  const gum = rimTube(THREE, M(h, 0xb04656, { roughness: .55 }), rim, 1.03, 1.0, .45); root.add(gum);
  ringJawMesh(P, gum, CY);
  rimTeeth(THREE, P, root, rim, { n: 28, k: 1.05, dz: 1.4, r: .55, len: 1.7, mat: M(h, 0xf3efe4, { roughness: .3 }), fwd: .3 });
  // dove stanno le parti sulla superficie: fn(u, v), u = angolo (0.5 = in alto, 0/1 = in basso)
  const at = (a, v) => fn(((a + PI / 2) / (2 * PI) + 1) % 1, v);
  // occhi ai lati del muso (neri lucidi, ammiccano) + arcata
  for (const sd of [1, -1]) {
    const a = sd > 0 ? .55 : PI - .55, p = at(a, .4);
    const lid = skinMat(THREE, 0x6a8094, 0x56697c);
    const e = eye(THREE, h, P, { side: sd, r: 1.6, x: p[0] - sd * .4, y: p[1], z: p[2] - .3, ry: sd * .95, iris: 0x1a2028, irisR: .82, pupilR: .5, sclera: 0x0e1014, scleraEdge: 0x0e1014, lidMat: lid, open: 52, low: -50, liner: 0x2a3644, hlSize: .26, look: [.3, .2] });
    root.add(e);
    root.add(rigidBrow(THREE, h, P, { side: sd, x: p[0] - sd * .2, y: p[1] + 2.1, z: p[2] - .1, w: 2.8, th: .42, mat: skinMat(THREE, 0x4e6276, 0x3e5064), rz: sd * -.2, ry: sd * 1.0, arch: .35, k: 1.2 }));
  }
  // narici sul muso
  for (const sd of [1, -1]) { const p = at(PI / 2 + sd * .22, .26); root.add(ell(THREE, M(h, 0x2a3440), .5, .25, .4, p[0], p[1] + .2, p[2] + .2, 8)); }
  // pinna dorsale + branchie
  const fin = new THREE.Mesh(new THREE.ConeGeometry(4.2, 8.5, 4), M(h, 0x5a6e82, { roughness: .5 })); fin.scale.set(.28, 1, 1); const pf = at(PI / 2, .62); fin.position.set(0, pf[1] + 3.2, pf[2] - 1.5); fin.rotation.x = -.45; root.add(fin);
  for (const sd of [1, -1]) for (let i = 0; i < 3; i++) {
    const a = sd > 0 ? -.15 - i * .02 : PI + .15 + i * .02, p = at(a, .5 + i * .05);
    const cv = new THREE.QuadraticBezierCurve3(new THREE.Vector3(p[0], p[1] + 2, p[2]), new THREE.Vector3(p[0] + sd * .5, p[1], p[2]), new THREE.Vector3(p[0], p[1] - 2, p[2]));
    root.add(new THREE.Mesh(new THREE.TubeGeometry(cv, 8, .18, 6), M(h, 0x3a4858)));
  }
  // pinne pettorali sotto
  const pecs = [];
  for (const sd of [1, -1]) { const pp = new THREE.Group(); const p = at(sd > 0 ? -.75 : PI + .75, .45); pp.position.set(p[0], p[1], p[2]); const f = new THREE.Mesh(new THREE.ConeGeometry(2.6, 7, 4), M(h, 0x5f7488, { roughness: .5 })); f.scale.set(1, 1, .25); f.rotation.z = sd * (PI / 2 + .7); f.position.set(sd * 2.6, -1.6, 0); pp.add(f); root.add(pp); pecs.push({ pp, sd }); }
  P.fx.push((s, t) => {
    for (const { pp, sd } of pecs) pp.rotation.z = sd * (Math.sin(t * 2.4) * .12 + s.smile * .3);
    fin.rotation.z = Math.sin(t * 1.3) * .06;
    root.rotation.z = Math.sin(t * .8) * .012;
  });
  sceneFinish(root);
  return g;
}
export function update(g, bs, t, h) { kitUpdate(g, bs, t, h); }
