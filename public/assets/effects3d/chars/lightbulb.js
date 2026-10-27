// lightbulb — scena col viso vero (fxchars 1.8.0: kit comune in _kit.js, valori calibrati 0..1)
import { PI, c01, M, PM, gradMat, glossMat, skinMat, furMat, ell, cap, surf, crom, lathe, horn, strand, leafGeo, mixHex, HEAD_FIT, mkRoot, reg, eye, rigidBrow, spring, kitUpdate, ovalRim, faceRing, rimCurve, rimTube, regRingJaw, ringJawMesh, RING_JAW, sceneFinish, ringColors, rimTeeth, chestPlate, rimDome } from './_kit.js';


export const meta = { label: 'Lampadina', labelEn: 'Light bulb', category: 'divertenti', icon: '💡' };
export const hideHead = false;

export default function build(THREE, h) {
  const g = new THREE.Group(); const P = reg(g);
  const root = mkRoot(THREE, g, hideHead ? HEAD_FIT : null);
  // vetro: bulbo attorno a tutta la testa (trasparente), collo verso la base sotto il mento
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xfff1b8, roughness: .06, metalness: .05, transparent: true, opacity: .16, depthWrite: false, side: THREE.FrontSide, emissive: 0xffe2a0, emissiveIntensity: .35 });
  const bulb = lathe(THREE, glassMat, [[0, 15.8], [6.5, 15.0], [11.5, 10.5], [13.4, 3.5], [12.8, -3.5], [10.4, -8.0], [7.4, -10.6], [6.2, -11.9], [6.1, -12.4]], { n: 40, seg: 56, pos: [0, 0, -1.0] });
  root.add(bulb);
  // riflesso
  const gl = ell(THREE, new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: .3, roughness: .1, depthWrite: false }), 1.2, 5.5, .4, -7.5, 6.0, 7.6, 10); gl.rotation.z = .3; root.add(gl);
  // base a vite: anello di raccordo + filettatura + isolante + contatto
  const metal = M(h, 0xc9ccd2, { roughness: .35, metalness: .85 });
  // (tutta sopra y≈-15.5: sotto c'è l'occlusore del busto)
  const neckRing = new THREE.Mesh(new THREE.CylinderGeometry(6.3, 6.4, 1.2, 40), M(h, 0x8a8f96, { roughness: .4, metalness: .8 })); neckRing.position.set(0, -12.7, -1.0); root.add(neckRing);
  const screw = new THREE.Mesh(new THREE.CylinderGeometry(5.8, 5.5, 3.4, 40), metal); screw.position.set(0, -14.9, -1.0); root.add(screw);
  for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(5.8 - i * .1, .42, 10, 48), metal); r.rotation.x = PI / 2; r.position.set(0, -13.8 - i * 1.1, -1.0); root.add(r); }
  const insul = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 3.6, 1.2, 40), M(h, 0x1f1f24, { roughness: .6 })); insul.position.set(0, -17.2, -1.0); root.add(insul);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(2.0, 20, 12), M(h, 0xb8bcc2, { roughness: .3, metalness: .9 })); tip.scale.y = .5; tip.position.set(0, -17.9, -1.0); root.add(tip);
  // bagliore: anello luminoso dietro la testa + raggi che compaiono quando "si accende" (bocca aperta / sopracciglia su)
  const glow = new THREE.Mesh(new THREE.CircleGeometry(16, 48), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: .12, depthWrite: false })); glow.position.set(0, 1.5, -13.5); root.add(glow);
  const rays = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * 2 * PI + .3; const r = new THREE.Mesh(new THREE.ConeGeometry(.9, 5, 3), new THREE.MeshBasicMaterial({ color: 0xffd34a, transparent: true, opacity: 0 }));
    r.position.set(Math.cos(a) * 16.5, 1.5 + Math.sin(a) * 16.5, -12); r.rotation.z = a - PI / 2; r.scale.set(1, 1, .3); root.add(r); rays.push({ r, a });
  }
  P.fx.push((s, t) => {
    // si accende con l'idea: sopracciglia su o occhi sgranati (+ un po' col sorriso)
    const on = Math.min(1, Math.max(s.browIn, (s.wideL + s.wideR) * .5, s.browOutL * .8) * .9 + s.smile * .25);
    glassMat.opacity = .16 + on * .1; glassMat.emissiveIntensity = .35 + on * .6;
    glow.material.opacity = .12 + on * .4 + Math.sin(t * 8) * .03 * on;
    rays.forEach(({ r, a }, i) => { r.material.opacity = on * .9; const k = 1 + on * .6 + Math.sin(t * 6 + i) * .15; r.scale.set(1, k, .3); r.position.set(Math.cos(a) * (16.5 + on), 1.5 + Math.sin(a) * (16.5 + on), -12); });
  });
  sceneFinish(root);
  return g;
}
export function update(g, bs, t, h) { kitUpdate(g, bs, t, h); }
