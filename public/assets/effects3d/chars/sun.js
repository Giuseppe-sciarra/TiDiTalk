// sun — scena col viso vero (fxchars 1.8.0: kit comune in _kit.js, valori calibrati 0..1)
import { PI, c01, M, PM, gradMat, glossMat, skinMat, furMat, ell, cap, surf, crom, lathe, horn, strand, leafGeo, mixHex, HEAD_FIT, mkRoot, reg, eye, rigidBrow, spring, kitUpdate, ovalRim, faceRing, rimCurve, rimTube, regRingJaw, ringJawMesh, RING_JAW, sceneFinish, ringColors, rimTeeth, chestPlate, rimDome } from './_kit.js';


export const meta = { label: 'Sole', labelEn: 'Sun', category: 'divertenti', icon: '☀️' };
export const hideHead = false;

export default function build(THREE, h) {
  const g = new THREE.Group(); const P = reg(g);
  const root = mkRoot(THREE, g, hideHead ? HEAD_FIT : null);
  const yellow = gradMat(THREE, h, 0xffcc1f, 0xf5a000, { roughness: .5 });
  const orange = gradMat(THREE, h, 0xffa21a, 0xf2740b, { roughness: .55 });
  const rim = ovalRim(h, { top: 1.1, side: 1.06, bottom: 1.15 }); const CY = rim.cy;
  // anello frontale attorno al viso (cornice) con sfumatura
  const ring = new THREE.Mesh(faceRing(THREE, h, rim, { nu: 80, nv: 12, prof: [[1, .3, 0], [1.06, 1.5, 0], [1.2, 2.0, 0], [1.34, 1.3, 0], [1.45, -.6, 0]], jawFall: .9 }), yellow); root.add(ring); regRingJaw(P, ring);
  // disco dietro la testa
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(14.5, 14.5, 1.2, 64), yellow); disc.rotation.x = PI / 2; disc.position.set(0, 0.5, -6); root.add(disc);
  // raggi: triangoli alternati lunghi/corti
  const rays = [];
  const rayGeo = (len) => { const sh = new THREE.Shape(); sh.moveTo(-2.4, 0); sh.lineTo(0, len); sh.lineTo(2.4, 0); sh.closePath(); return new THREE.ExtrudeGeometry(sh, { depth: 1.0, bevelEnabled: true, bevelThickness: .3, bevelSize: .3, bevelSegments: 2 }); };
  const gLong = rayGeo(9), gShort = rayGeo(6);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * 2 * PI; const grp = new THREE.Group(); grp.position.set(0, 0.5, -7.5);
    const m = new THREE.Mesh(i % 2 ? gShort : gLong, i % 2 ? orange : yellow); m.position.y = 13.6; grp.add(m);
    grp.rotation.z = a; root.add(grp); rays.push({ grp, a, i });
  }
  // guanciotte rosse sull'anello
  const cheeks = [];
  for (const sd of [1, -1]) { const a = sd > 0 ? -.35 : PI + .35, rm = rim(a); const c = ell(THREE, PM(THREE, 0xff6a55, { roughness: .6 }), 1.5, 1.0, .5, rm.r * 1.22 * Math.cos(a), CY + rm.r * 1.22 * Math.sin(a), rm.z + 2.3, 18); c.rotation.y = sd * .2; root.add(c); cheeks.push(c); }
  // occhialini da sole appoggiati sopra l'anello (si abbassano con browDown)
  const rTop = rim(PI / 2); const GY = CY + rTop.r * 1.3; const glasses = new THREE.Group(); glasses.position.set(0, GY, rTop.z + 1.6); root.add(glasses);
  const lensMat = PM(THREE, 0x1b1b24, { roughness: .35, clearcoat: .6, clearcoatRoughness: .2, envMapIntensity: .5 });
  for (const sd of [1, -1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, .5, 24), lensMat); l.rotation.x = PI / 2; l.position.x = sd * 3.2; glasses.add(l); }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.4, .4, .4), lensMat); glasses.add(bridge);
  for (const sd of [1, -1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(.4, .4, 8), lensMat); arm.position.set(sd * 5.8, 0, -4); glasses.add(arm); }
  glasses.rotation.x = -.5;
  P.fx.push((s, t) => {
    const e = s.smile * .6 + s.browIn * .4 + s.jaw * .3;
    for (const c of cheeks) { const k = 1 + s.puff * .6 + s.smile * .25; c.scale.set(1.5 * k, 1.0 * k, .5 * (1 + s.puff)); }
    rays.forEach(({ grp, a, i }) => { grp.rotation.z = a + t * .12 * (i % 2 ? 1 : -1) * 0 + Math.sin(t * .6) * .05; grp.scale.setScalar(1 + e * .25 + Math.sin(t * 2.2 + i) * .04); });
    disc.rotation.z = t * .05;
    glasses.position.y = GY - (s.browDnL + s.browDnR) * 1.5 + Math.sin(t * 1.3) * .1;
  });
  sceneFinish(root);
  return g;
}
export function update(g, bs, t, h) { kitUpdate(g, bs, t, h); }
