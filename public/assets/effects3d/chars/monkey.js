// Scimmietta — testa intera con bocca vera (fxchars 1.8.0, kit in _kit.js)
import { PI, rig, kitUpdate, furMat, PM, ell, strand, earPair, spring } from './_kit.js';

export const meta = { label: 'Scimmietta', labelEn: 'Monkey', labelFr: 'Petit singe', labelDe: 'Äffchen', category: 'personaggi', icon: '🐵' };
export const hideHead = true;

export default function build(THREE, h) {
  const g = new THREE.Group();
  const fur = furMat(THREE, 0x7a4a2a, 0x4a2a16, { mid: 0x64391e });
  const skin = furMat(THREE, 0xf0c8a0, 0xd6a07a, { opt: { sheen: .15, roughness: .7 } });
  // maschera del viso: due cerchi sugli occhi (fronte a cuore) + muso grande sporgente
  const F = rig(THREE, h, g, {
    head: { r: [11.2, 12.2, 11.2], c: [0, 0, -2.7], boxy: .7, mat: fur },
    skins: [
      { r: [4.0, 3.8, 1.8], c: [2.9, 2.7, 6.6], mat: skin, noSlit: true }, { r: [4.0, 3.8, 1.8], c: [-2.9, 2.7, 6.6], mat: skin, noSlit: true },
      { r: [5.8, 4.0, 4.0], c: [0, -4.6, 6.2], mat: skin },
    ],
    mouth: { y: -5.9, w: 3.6, open: 5.0, curve: .45, smileK: 1.3, inside: 0x5a1a22, lip: { color: 0x7a3e2c, r: .22 }, teeth: { color: 0xfbf7ee, n: 6, span: .6, back: .9, low: true }, tongue: { color: 0xe66a80 } },
    eyes: { r: 1.85, x: 2.95, y: 2.8, ry: .16, sink: .42, iris: 0x4a2a14, irisR: .7, pupilR: .38, lidMat: skin, open: 48, low: -46, liner: 0x3a2014 },
    brows: { x: 3.1, y: 6.4, w: 2.8, th: .44, color: 0x3a2010, arch: .5, tilt: -.3 },
    cheeks: { x: 5.2, y: -3.0, r: 2.4, puff: 2.2, color: 0xe58a7a, blush: 1.5, alpha: .45 },
  });
  // narici
  for (const sd of [1, -1]) { const n = ell(THREE, PM(THREE, 0x5a3424, { roughness: .5 }), .42, .28, .25, sd * .85, -2.6, 0, 10); F.onSurf(n, sd * .85, -2.6, -.05); F.root.add(n); }
  // orecchie a "C" ai lati
  earPair(THREE, F, { x: 10.6, y: 1.8, z: -2.4, ry: -.45, k: 90, c: 8 }, (ear, sd) => {
    ear.add(ell(THREE, fur, 1.6, 3.6, 3.5, 0, 0, 0, 24));
    ear.add(ell(THREE, skin, .8, 2.6, 2.5, sd * .9, 0, .2, 20));
  });
  // ciuffo in testa (molla, si alza con la sorpresa)
  const tuft = new THREE.Group(); tuft.position.set(0, 11.6, 2.4); F.root.add(tuft);
  const furD = furMat(THREE, 0x4a2a16, 0x2e1a0c);
  for (let i = 0; i < 4; i++) tuft.add(strand(THREE, furD, [[(i - 1.5) * .8, -.3, 0], [(i - 1.5) * 1.2, 2.4, .6], [(i - 1.5) * 2.0 + .8, 2.2, 2.8]], .55 - i * .05, .14, 10));
  spring(F.P, tuft, { k: 50, c: 4.5, drive: [.16, .12, .2], expr: (s, t, o) => { o[0] = -(s.browIn + s.wideL * .5) * .35; } });
  return g;
}
export function update(g, bs, t, h) { kitUpdate(g, bs, t, h); }
