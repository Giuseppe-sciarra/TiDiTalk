// Coniglietto — testa intera con bocca vera (fxchars 1.8.0, kit in _kit.js)
import { PI, rig, kitUpdate, furMat, skinMat, PM, ell, leafGeo, earPair, whiskers, nose, glossMat } from './_kit.js';

export const meta = { label: 'Coniglietto', labelEn: 'Bunny', labelFr: 'Petit lapin', labelDe: 'Häschen', category: 'personaggi', icon: '🐰' };
export const hideHead = true;

export default function build(THREE, h) {
  const g = new THREE.Group();
  const fur = furMat(THREE, 0xd6cdc2, 0x9e9284, { mid: 0xbcb2a4 });
  const muz = furMat(THREE, 0xf4f0ea, 0xd2cac0);
  const pink = skinMat(THREE, 0xf4a6ba, 0xe08098, { opt: { roughness: .55, clearcoat: .1 } });
  const F = rig(THREE, h, g, {
    head: { r: [11.0, 12.2, 11.0], c: [0, 0, -2.7], boxy: .6, mat: fur },
    // musetto a due cuscinetti
    skins: [{ r: [2.6, 2.1, 2.2], c: [1.9, -4.7, 6.8], mat: muz }, { r: [2.6, 2.1, 2.2], c: [-1.9, -4.7, 6.8], mat: muz }, { r: [2.4, 1.8, 2.0], c: [0, -6.9, 6.2], mat: muz }],
    mouth: { y: -6.1, w: 2.3, open: 3.8, curve: .35, inside: 0x5a1e2a, lip: { color: 0xb07282, r: .16 }, teeth: { color: 0xfffbf2, n: 2, span: .28, back: .6 }, tongue: { color: 0xe86a82 } },
    eyes: { r: 2.05, x: 3.9, y: 3.1, ry: .22, sink: .42, iris: 0x7a4e2a, irisR: .66, pupilR: .34, lidMat: fur, open: 50, low: -48, liner: 0x5a4038, lashes: 3, hlSize: .24 },
    brows: { x: 3.9, y: 6.3, w: 2.4, th: .3, color: 0x7a6c5e, arch: .5, tilt: -.25 },
    cheeks: { x: 6.0, y: -3.0, r: 2.6, puff: 2.3, color: 0xf3a0b4, blush: 1.7, alpha: .55 },
  });
  nose(THREE, F, { y: -3.2, w: .95, h: .72, d: .6, shape: 'tri', mat: glossMat(THREE, 0xef8aa4), lift: .3, sniff: true });
  whiskers(THREE, F, { x: 3.6, y: -4.6, n: 3, len: 6.2, r: .05, color: 0xd8d0c6, spread: .45, back: .2 });
  // orecchie lunghe (si piegano con l'inerzia e quando sei triste)
  const earG = leafGeo(THREE, 2.3, 11.0, 1.0, { point: .7, base: .55, cup: .45, skew: .45 });
  const inG = leafGeo(THREE, 1.4, 8.6, .4, { point: .7, base: .5, cup: .55, skew: .45 });
  const ears = earPair(THREE, F, { x: 3.9, y: 10.6, z: -3.3, rx: -.18, ry: -.1, rz: -.2, k: 60, c: 5.5, drive: [.2, .12, .22], back: 1.6 }, (ear) => {
    ear.add(new THREE.Mesh(earG, fur));
    const i = new THREE.Mesh(inG, pink); i.position.set(0, .8, .65); ear.add(i);
  });
  return g;
}
export function update(g, bs, t, h) { kitUpdate(g, bs, t, h); }
