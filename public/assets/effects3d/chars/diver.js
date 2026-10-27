// diver — scena col viso vero (fxchars 1.8.0: kit comune in _kit.js, valori calibrati 0..1)
import { PI, c01, M, PM, gradMat, glossMat, skinMat, furMat, ell, cap, surf, crom, lathe, horn, strand, leafGeo, mixHex, HEAD_FIT, mkRoot, reg, eye, rigidBrow, spring, kitUpdate, ovalRim, faceRing, rimCurve, rimTube, regRingJaw, ringJawMesh, RING_JAW, sceneFinish, ringColors, rimTeeth, chestPlate, rimDome } from './_kit.js';


export const meta = { label: 'Palombaro', labelEn: 'Diving helmet', category: 'divertenti', icon: '🤿' };
export const hideHead = false;

export default function build(THREE, h) {
  const g = new THREE.Group(); const P = reg(g);
  const root = mkRoot(THREE, g, hideHead ? HEAD_FIT : null);
  const brass = M(h, 0xc8923a, { roughness: .32, metalness: .85 });
  const brassD = M(h, 0x9a6a26, { roughness: .38, metalness: .85 });
  const copper = gradMat(THREE, h, 0xd8a050, 0xa86a2a, { roughness: .3, metalness: .8 });
  const dark = M(h, 0x1e2226, { roughness: .4 });
  const glassM = new THREE.MeshStandardMaterial({ color: 0xcfe8f0, roughness: .05, metalness: .1, transparent: true, opacity: .12, depthWrite: false });

  // casco tondo in rame: l'oblò frontale segue l'ovale del viso
  const rim = ovalRim(h, { top: 1.12, side: 1.08, bottom: 1.16 }); const CY = rim.cy;
  const geo = faceRing(THREE, h, rim, { prof: [[1.0, .6, 0], [1.07, 1.8, 0], [1.22, 1.2, .2], [1.45, -2.4, .6], [1.52, -6, 1], [1.45, -10.5, 1], [1.0, -14.5, 1], [0, -16.2, 1]], sy: 1.08, nu: 96, nv: 36, jawFall: 1.2 });
  const shell = new THREE.Mesh(geo, copper); root.add(shell); regRingJaw(P, shell);
  const fn = geo.userData.fn; const at = (a, v) => fn(((a + PI / 2) / (2 * PI) + 1) % 1, v);
  const jawW = (m) => { const pos = m.geometry.attributes.position, jw = []; for (let i = 0; i < pos.count; i++) jw.push(c01((-(pos.getY(i) - CY) / 9 - .15) / .6)); m.geometry.userData.jw = jw; regRingJaw(P, m); return m; };
  // cornice dell'oblò: anello spesso + anello sottile + bulloni
  root.add(jawW(rimTube(THREE, brass, rim, 1.05, 2.0, .95)));
  root.add(jawW(rimTube(THREE, brassD, rim, 1.15, 1.2, .38)));
  const bolts = [];
  for (let i = 0; i < 12; i++) { const a = (i + .5) / 12 * 2 * PI - PI / 2, r = rim(a); const b = new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, .6, 6), brassD); b.rotation.x = PI / 2; const y = CY + r.r * 1.2 * Math.sin(a); b.position.set(r.r * 1.2 * Math.cos(a), y, r.z + 2.1); root.add(b); bolts.push({ b, y, w: c01((-Math.sin(a) - .15) / .6) }); }
  // vetro dell'oblò + riflesso
  root.add(rimDome(THREE, glassM, rim, 1.05, 2.0, 11.5));
  const gl = ell(THREE, new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: .25, roughness: .1, depthWrite: false }), .9, 3.8, .3, -4.6, 3.6, 10.4, 10); gl.rotation.z = .4; root.add(gl);
  // oblò laterali con grata
  for (const sd of [1, -1]) {
    const p = at(sd > 0 ? .1 : PI - .1, .42); const port = new THREE.Group(); port.position.set(p[0], p[1], p[2]); port.rotation.y = sd * 1.25; root.add(port);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, .55, 10, 28), brass); port.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24), M(h, 0x2a3a44, { roughness: .1, metalness: .3 })); disc.position.z = -.1; port.add(disc);
    for (let k = -1; k <= 1; k++) { const bar = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, 4.8, 6), brassD); bar.position.set(k * 1.2, 0, .2); port.add(bar); }
  }
  // valvola in cima + gomito dell'aria dietro
  const pt = at(PI / 2, .55);
  const valve = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 2.6, 16), brass); valve.position.set(0, pt[1] + 1.0, pt[2]); root.add(valve);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(1.5, .25, 8, 20), brassD); wheel.rotation.x = PI / 2; wheel.position.set(0, pt[1] + 2.5, pt[2]); root.add(wheel);
  const hose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(9, 6, -8), new THREE.Vector3(14, 3, -6), new THREE.Vector3(16, -6, -2), new THREE.Vector3(17, -16, 5)]), 24, 1.1, 10), M(h, 0x2a2a2e, { roughness: .7 })); root.add(hose);
  // collare + corazza (davanti all'occlusore del busto) con bulloni
  const collar = new THREE.Mesh(new THREE.TorusGeometry(9.8, 1.6, 12, 48), brass); collar.rotation.x = PI / 2; collar.position.set(0, -13.6, -1.0); root.add(collar);
  root.add(new THREE.Mesh(chestPlate(THREE, { w: 18, top: -13.5, bottom: -30, z: 4.6, bulge: 4.5, shoulder: 3.5 }), gradMat(THREE, h, 0xd8a050, 0xa06428, { roughness: .32, metalness: .8, side: THREE.DoubleSide })));
  for (let i = 0; i < 9; i++) { const x = -14 + i * 3.5, ax = Math.abs(x) / 18; const b = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .5, 6), brassD); b.rotation.x = PI / 2; b.position.set(x, -15.5 - 3.5 * ax * ax, 4.6 + 4.5 * Math.sqrt(1 - ax * ax) * .97 + .3); root.add(b); }
  // bollicine che salgono
  const bubbles = [];
  for (let i = 0; i < 7; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.35 + (i % 3) * .2, 10, 8), new THREE.MeshStandardMaterial({ color: 0xdff4ff, transparent: true, opacity: .45, roughness: .05, depthWrite: false })); root.add(b); bubbles.push({ b, ph: i * .37, x: 10 + (i % 3) * 1.2 }); }
  P.fx.push((s, t) => {
    for (const { b, y, w } of bolts) b.position.y = y - RING_JAW * .85 * s.jaw * w;
    bubbles.forEach(({ b, ph, x }) => { const k = (t * (.25 + s.jaw * .4) + ph) % 1; b.position.set(x + Math.sin(t * 3 + ph * 9) * .6, 8 + k * 16, 2 + ph * 3); b.visible = k > .02; });
    wheel.rotation.z = t * .5 + s.browIn;
  });
  sceneFinish(root);
  return g;
}
export function update(g, bs, t, h) { kitUpdate(g, bs, t, h); }
