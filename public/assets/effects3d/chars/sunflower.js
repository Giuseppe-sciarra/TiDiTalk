// sunflower — scena col viso vero (fxchars 1.8.0: kit comune in _kit.js, valori calibrati 0..1)
import { PI, c01, M, PM, gradMat, glossMat, skinMat, furMat, ell, cap, surf, crom, lathe, horn, strand, leafGeo, mixHex, HEAD_FIT, mkRoot, reg, eye, rigidBrow, spring, kitUpdate, ovalRim, faceRing, rimCurve, rimTube, regRingJaw, ringJawMesh, RING_JAW, sceneFinish, ringColors, rimTeeth, chestPlate, rimDome } from './_kit.js';


export const meta = { label: 'Girasole', labelEn: 'Sunflower', category: 'divertenti', icon: '🌻' };
export const hideHead = false;

export default function build(THREE, h) {
  const g = new THREE.Group(); const P = reg(g);
  const root = mkRoot(THREE, g, hideHead ? HEAD_FIT : null);
  const rim = ovalRim(h, { top: 1.1, side: 1.06, bottom: 1.15 }); const CY = rim.cy;
  // disco di semi: texture procedurale a puntini
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#5a3a1e'; x.fillRect(0, 0, 256, 64);
  for (let i = 0; i < 700; i++) { const px = Math.random() * 256, py = Math.random() * 64; x.fillStyle = Math.random() < .5 ? '#7a5230' : '#3f2814'; x.beginPath(); x.ellipse(px, py, 2.2, 1.4, Math.random() * 3, 0, 7); x.fill(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(4, 1);
  const seedMat = h.mat(0xffffff, { map: tex, roughness: .9 });
  const disc = new THREE.Mesh(faceRing(THREE, h, rim, { nu: 72, nv: 10, prof: [[1, .3, 0], [1.08, 1.3, 0], [1.26, 1.1, 0], [1.42, .1, 0]], jawFall: .9 }), seedMat); root.add(disc); regRingJaw(P, disc);
  const inner = rimTube(THREE, M(h, 0x3f2814), rim, 1.02, .9, .3); root.add(inner); ringJawMesh(P, inner, CY);
  // petali: due corone
  const petalMat = gradMat(THREE, h, 0xffd23a, 0xf59e0b, { roughness: .55, side: THREE.DoubleSide });
  const petalMat2 = gradMat(THREE, h, 0xf5b60f, 0xd97706, { roughness: .6, side: THREE.DoubleSide });
  const petals = [];
  const petalGeo = (() => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(1.6, 2.5, 0.9, 6.2); sh.quadraticCurveTo(0.3, 7.6, 0, 8.2); sh.quadraticCurveTo(-0.3, 7.6, -0.9, 6.2); sh.quadraticCurveTo(-1.6, 2.5, 0, 0); return new THREE.ExtrudeGeometry(sh, { depth: .35, bevelEnabled: true, bevelThickness: .25, bevelSize: .25, bevelSegments: 2, curveSegments: 10 }); })();
  for (let ring = 0; ring < 2; ring++) {
    const N = 16;
    for (let i = 0; i < N; i++) {
      const a = (i + ring * .5) / N * 2 * PI; const k = 1.32 + ring * .08, rm = rim(a);
      const grp = new THREE.Group(); grp.position.set(rm.r * k * Math.cos(a), CY + rm.r * k * Math.sin(a), rm.z - .2 - ring * 1.0);
      const m = new THREE.Mesh(petalGeo, ring ? petalMat2 : petalMat); m.position.set(0, -0.5, 0); grp.add(m);
      grp.rotation.z = a - PI / 2; grp.rotation.x = -.25 - ring * .15; root.add(grp); petals.push({ grp, a, ring, rz: grp.rotation.z });
    }
  }
  // foglie verdi sotto + un pezzetto di gambo
  const leafMat = gradMat(THREE, h, 0x6fbf3a, 0x3f8a22, { roughness: .6, side: THREE.DoubleSide });
  for (const sd of [1, -1]) { const lf = ell(THREE, leafMat, 2.6, 6.5, .5, sd * 11.5, -19, 6.0, 16); lf.rotation.set(-.2, 0, sd * .9); root.add(lf); }
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 9, 12), M(h, 0x4f8f2c)); stem.position.set(0, -21, 6.0); root.add(stem);
  P.fx.push((s, t) => {
    petals.forEach(({ grp, a, ring, rz }, i) => {
      const open = s.smile * .25 + s.browIn * .15 + s.jaw * .1;
      grp.rotation.x = -.25 - ring * .15 - open + Math.sin(t * 1.4 + i * .7) * .04;
      grp.scale.setScalar(1 + open * .3);
    });
    root.rotation.z = Math.sin(t * .7) * .015;
  });
  sceneFinish(root);
  return g;
}
export function update(g, bs, t, h) { kitUpdate(g, bs, t, h); }
