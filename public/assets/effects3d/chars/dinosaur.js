// dinosaur — scena col viso vero (fxchars 1.8.0: kit comune in _kit.js, valori calibrati 0..1)
import { PI, c01, M, PM, gradMat, glossMat, skinMat, furMat, ell, cap, surf, crom, lathe, horn, strand, leafGeo, mixHex, HEAD_FIT, mkRoot, reg, eye, rigidBrow, spring, kitUpdate, ovalRim, faceRing, rimCurve, rimTube, regRingJaw, ringJawMesh, RING_JAW, sceneFinish, ringColors, rimTeeth, chestPlate, rimDome } from './_kit.js';


export const meta = { label: 'Dinosauro', labelEn: 'Dinosaur', category: 'divertenti', icon: '🦖' };
export const hideHead = false;

export default function build(THREE, h) {
  const g = new THREE.Group(); const P = reg(g);
  const root = mkRoot(THREE, g, hideHead ? HEAD_FIT : null);
  // costume da T-rex: il viso spunta dalle fauci; mascella superiore col muso sopra la fronte
  const rim = ovalRim(h, { top: 1.12, side: 1.1, bottom: 1.18 }); const CY = rim.cy;
  const NU = 80;
  const prof = [[1.0, .4, 0], [1.07, 1.8, 0], [1.22, 2.4, 0], [1.42, 1.0, .2], [1.6, -2.4, .6], [1.64, -7, 1], [1.48, -12, 1], [.95, -16, 1], [0, -18, 1]];
  const shape = (a, v) => 1 + .1 * Math.max(0, Math.sin(a)) * Math.min(1, v * 2.2);
  const geo = faceRing(THREE, h, rim, { prof, shape, sy: 1.06, nu: NU, nv: 34, jawFall: 1.1 }); const fn = geo.userData.fn;
  ringColors(THREE, geo, NU, (x, y, z, v) => {
    if (v < .1) return mixHex(0x8e2a3a, 0xc4566a, v / .1);
    const belly = c01((CY - 3 - y) / 6 + .5) * c01((z + 4) / 6);
    return mixHex(mixHex(0x3f8a34, 0x6cbf52, c01((y + 6) / 20)), 0xe9d27a, belly);
  });
  const skinV = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: .5, clearcoat: .35, clearcoatRoughness: .4 });
  const body = new THREE.Mesh(geo, skinV); root.add(body); regRingJaw(P, body);
  const green = gradMat(THREE, h, 0x74c85a, 0x3f8a34, { roughness: .6 });
  const greenD = M(h, 0x2f6a28, { roughness: .6 });
  const toothM = M(h, 0xf3ecd8, { roughness: .35 });
  // gengive + denti: grossi sopra, più piccoli sotto
  const gum = rimTube(THREE, M(h, 0xb04656, { roughness: .55 }), rim, 1.03, 1.0, .45); root.add(gum);
  ringJawMesh(P, gum, CY);
  rimTeeth(THREE, P, root, rim, { n: 22, k: 1.05, dz: 1.5, r: .7, len: 2.2, mat: toothM, fwd: .3, lenFn: (a) => .7 + .5 * Math.max(0, Math.sin(a)) });
  const at = (a, v) => fn(((a + PI / 2) / (2 * PI) + 1) % 1, v);
  // muso superiore sporgente sopra la fronte, con narici
  const top = at(PI / 2, .22);
  const snout = ell(THREE, green, 8.4, 4.4, 8.0, 0, top[1] + 1.0, top[2] + .2, 26); root.add(snout);
  for (const sd of [1, -1]) root.add(ell(THREE, M(h, 0x1f4a1c), .7, .45, .5, sd * 2.4, top[1] + 2.4, top[2] + 7.9, 10));
  // occhi sopra il muso, con arcate arrabbiate
  for (const sd of [1, -1]) {
    const x = sd * 6.4, y = top[1] + 5.0, z = top[2] + 1.6;
    root.add(ell(THREE, green, 2.6, 2.2, 2.4, x, y - .4, z - .4, 18));
    root.add(eye(THREE, h, P, { side: sd, r: 1.75, x, y, z: z + .9, iris: 0xe8b020, irisR: .7, pupilR: .3, pupil: 'slit', lidMat: greenD, open: 42, low: -44, liner: 0x1e4a1a, ry: sd * .35, hlSize: .22 }));
    root.add(rigidBrow(THREE, h, P, { side: sd, x: x - sd * .2, y: y + 2.2, z: z + 1.4, w: 3.0, th: .55, mat: greenD, rz: sd * .3, arch: .2, k: 1.2 }));
  }
  // spine lungo la schiena
  const spikes = [];
  for (let i = 0; i < 7; i++) { const v = .4 + i * .085, p = at(PI / 2, v); const sp = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3.4 - Math.abs(i - 2) * .3, 4), M(h, 0xf0a030, { roughness: .5 })); sp.scale.x = .45; sp.position.set(0, p[1] + .6, p[2]); sp.rotation.x = -(.2 + i * .35); root.add(sp); spikes.push(sp); }
  // costume: corpo verde con pancia gialla davanti all'occlusore del busto + braccini corti sul petto
  root.add(new THREE.Mesh(chestPlate(THREE, { w: 19, top: -13.2, bottom: -32, z: 4.6, bulge: 4.5, shoulder: 3.8 }), Object.assign(green.clone(), { side: THREE.DoubleSide })));
  const bellyM = gradMat(THREE, h, 0xf0dc8a, 0xd8b85a, { roughness: .7, side: THREE.DoubleSide });
  root.add(new THREE.Mesh(chestPlate(THREE, { w: 7.5, top: -14.5, bottom: -32, z: 9.25, bulge: .55, shoulder: 0 }), bellyM));
  for (let i = 0; i < 5; i++) { const st = new THREE.Mesh(new THREE.TorusGeometry(6.4, .16, 6, 24, PI * .5), M(h, 0xc8a048)); st.position.set(0, -17 - i * 3.2 + 6.4, 9.9); st.rotation.z = -PI * .75; st.scale.y = .2; root.add(st); }
  const arms = [];
  for (const sd of [1, -1]) { const a = new THREE.Group(); a.position.set(sd * 6.8, -17.5, 9.6); a.add(cap(THREE, green, 1.0, 2.6, 0, -1.6, 0)); for (let k = 0; k < 2; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(.3, 1.0, 6), toothM); c.position.set((k - .5) * .7, -4.0, 0); c.rotation.x = PI; a.add(c); } a.rotation.set(-1.1, 0, sd * .25); root.add(a); arms.push({ a, sd }); }
  P.fx.push((s, t) => {
    spikes.forEach((sp, i) => { sp.scale.y = 1 + s.browIn * .3 + s.jaw * .2 + Math.sin(t * 2 + i) * .04; });
    for (const { a, sd } of arms) a.rotation.z = sd * (.25 + s.smile * .5) + Math.sin(t * 4 + sd) * .1;
    snout.position.y = top[1] + 1.0 + s.jaw * .4 + s.browIn * .3;
  });
  sceneFinish(root);
  return g;
}
export function update(g, bs, t, h) { kitUpdate(g, bs, t, h); }
