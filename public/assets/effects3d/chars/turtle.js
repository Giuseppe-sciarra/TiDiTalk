// Tartaruga — testa intera con becco-bocca vera e guscio (fxchars 1.8.0, kit in _kit.js)
import { PI, rig, kitUpdate, skinMat, furMat, PM, ell, decal } from './_kit.js';

export const meta = { label: 'Tartaruga', labelEn: 'Turtle', labelFr: 'Tortue', labelDe: 'Schildkröte', category: 'personaggi', icon: '🐢' };
export const hideHead = true;

export default function build(THREE, h) {
  const g = new THREE.Group();
  const skin = skinMat(THREE, 0x92cf5a, 0x56983a, { mid: 0x74b448, opt: { clearcoat: .3 } });
  const skinD = skinMat(THREE, 0x4f8a2e, 0x386a20);
  const shell = skinMat(THREE, 0x9a7440, 0x5e4526, { opt: { clearcoat: .5, clearcoatRoughness: .4 } });
  const shellD = skinMat(THREE, 0x6a4a22, 0x3e2a14, { opt: { clearcoat: .5 } });
  const F = rig(THREE, h, g, {
    head: { r: [11.0, 12.2, 11.6], c: [0, 0, -2.7], boxy: .45, mat: skin },
    skins: [{ r: [4.8, 2.6, 3.8], c: [0, -4.8, 7.0], mat: skin }],
    mouth: { y: -6.2, w: 4.4, open: 5.0, curve: .55, smileK: 1.2, inside: 0x5a1a22, lip: { color: 0x3e6e24, r: .26 }, teeth: false, tongue: { color: 0xe46a7a } },
    eyes: { r: 2.25, x: 4.3, y: 3.4, ry: .22, sink: .44, iris: 0x3a7a32, irisR: .64, pupilR: .34, lidMat: skinD, open: 38, low: -40, liner: 0x2a4a18, hlSize: .22 },
    brows: { x: 4.3, y: 6.5, w: 2.8, th: .4, mat: skinD, arch: .4, tilt: -.15 },
    cheeks: { x: 6.8, y: -3.0, r: 2.6, puff: 2.2, color: 0xb6e07a, blush: 1.8, alpha: .5 },
  });
  for (const sd of [1, -1]) { const n = ell(THREE, PM(THREE, 0x3a6a24), .4, .32, .25, 0, 0, 0, 8); F.onSurf(n, sd * 1.1, -2.9, -.05); F.root.add(n); }
  for (const [x, y, r] of [[-5.8, 7.6, 1.1], [5.2, 8.4, .9], [0, 10.6, .8], [-7.6, 1.2, .8], [7.8, .4, 1.0]]) decal(THREE, F, { x, y, rx: r, ry: r * .8, color: 0x5a9a36, soft: .35, patch: 1 });
  // guscio dietro la testa: cupola con piastre esagonali in rilievo e bordo
  const shellG = new THREE.Group(); shellG.position.set(0, -.5, -8.2); shellG.rotation.x = -PI / 2 + .5; F.root.add(shellG);
  const R = 14.2;
  shellG.add(new THREE.Mesh(new THREE.SphereGeometry(R, 48, 24, 0, 2 * PI, 0, PI * .5), shell));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 1.4, 12, 64), shellD); rim.rotation.x = PI / 2; shellG.add(rim);
  const up = new THREE.Vector3(0, 1, 0);
  const plate = (dir, r) => { const sc = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, .7, 6, 1), shellD); sc.position.copy(dir).multiplyScalar(R + .05); sc.quaternion.setFromUnitVectors(up, dir); shellG.add(sc); };
  plate(up.clone(), 2.8);
  for (let ring = 0; ring < 2; ring++) { const n = ring ? 12 : 6, el = ring ? .35 : .85; for (let i = 0; i < n; i++) { const a = (i + ring * .5) / n * 2 * PI; plate(new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)).normalize(), ring ? 2.2 : 2.5); } }
  // la testa si ritrae un po' quando strizzi gli occhi e aggrotti
  F.fx((s, t) => { const r = Math.min(1, (s.squintL + s.squintR + s.blinkL + s.blinkR) * .25 * (s.browDnL + s.browDnR)); shellG.position.z = -8.2 + r * 4 + Math.sin(t * 1.2) * .15; });
  return g;
}
export function update(g, bs, t, h) { kitUpdate(g, bs, t, h); }
