// Volpe — testa intera con bocca vera (fxchars 1.8.0, kit in _kit.js)
import { PI, rig, kitUpdate, furMat, PM, ell, strand, earPair, leafGeo, whiskers, nose } from './_kit.js';

export const meta = { label: 'Volpe', labelEn: 'Fox', labelFr: 'Renard', labelDe: 'Fuchs', category: 'personaggi', icon: '🦊' };
export const hideHead = true;

export default function build(THREE, h) {
  const g = new THREE.Group();
  const fur = furMat(THREE, 0xe06a22, 0xa8420e, { mid: 0xcc5a18 });
  const cream = furMat(THREE, 0xf0e6d6, 0xd2c2a8);
  const dark = furMat(THREE, 0x3a2a24, 0x241812);
  const F = rig(THREE, h, g, {
    head: { r: [11.0, 12.0, 11.0], c: [0, 0, -2.7], boxy: .6, mat: fur },
    skins: [
      { r: [4.6, 3.2, 5.0], c: [0, -4.6, 5.6], mat: cream },
    ],
    mouth: { y: -6.1, w: 3.0, open: 4.6, curve: .5, smileK: 1.25, inside: 0x5a1a22, lip: { color: 0x2a1a14, r: .2 }, teeth: { color: 0xfbf7ee, n: 4, span: .55, back: 1.0 }, tongue: { color: 0xe86a80 } },
    eyes: { r: 1.95, x: 3.95, y: 3.0, ry: .2, sink: .42, iris: 0xe8a23a, irisR: .66, pupilR: .3, pupil: 'slit', lidMat: fur, open: 40, low: -44, liner: 0x2a1610, roll: .12, lashes: 2 },
    brows: { x: 4.0, y: 6.2, w: 2.8, th: .36, color: 0x8a3a10, arch: .4, tilt: .1 },
    cheeks: { x: 6.2, y: -3.2, r: 2.6, puff: 2.2 },
  });
  // guance bianche a ciuffo, appuntite verso fuori
  for (const sd of [1, -1]) for (let i = 0; i < 3; i++) {
    const t = new THREE.Mesh(leafGeo(THREE, 2.2 - i * .3, 5.2 - i * .6, 1.4, { point: 1.2, base: .9, skew: .35, seg: 18 }), cream);
    const x = sd * (6.3 + i * .6), y = -3.4 - i * 1.3; t.position.set(x, y, F.surf(x, y) - 1.6); t.rotation.set(-.2, sd * .6, sd * (-1.75 - i * .28)); F.root.add(t); F.skin(t, 1);
  }
  nose(THREE, F, { y: -2.9, w: 1.25, h: .9, d: .85, shape: 'heart', color: 0x1a1414, lift: .55 });
  whiskers(THREE, F, { x: 3.4, y: -4.0, n: 3, len: 5.8, r: .06, color: 0xfffaf0, spread: .45, back: .25 });
  // orecchie grandi a punta con punta nera e interno chiaro
  const earG = leafGeo(THREE, 3.2, 8.0, .9, { point: 1.15, base: .75, cup: .35, skew: .3 });
  const inG = leafGeo(THREE, 2.1, 5.8, .4, { point: 1.1, base: .7, cup: .45, skew: .3 });
  earPair(THREE, F, { x: 6.4, y: 9.2, z: -3.2, rx: -.15, ry: -.2, rz: -.42 }, (ear) => {
    const o = new THREE.Mesh(earG, fur); ear.add(o);
    const i = new THREE.Mesh(inG, cream); i.position.set(0, .4, .55); ear.add(i);
    const tip = new THREE.Mesh(leafGeo(THREE, 1.5, 3.0, .95, { point: 1.1, base: .9, skew: .2 }), dark); tip.position.set(0, 5.15, .05); ear.add(tip);
  });
  return g;
}
export function update(g, bs, t, h) { kitUpdate(g, bs, t, h); }
