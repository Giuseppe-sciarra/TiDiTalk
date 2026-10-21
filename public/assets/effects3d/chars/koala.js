// Koala — testa intera con bocca vera (fxchars 1.8.0, kit in _kit.js)
import { PI, rig, kitUpdate, furMat, glossMat, PM, ell, strand, earPair, spring, nose, decal } from './_kit.js';

export const meta = { label: 'Koala', labelEn: 'Koala', labelFr: 'Koala', labelDe: 'Koala', category: 'personaggi', icon: '🐨' };
export const hideHead = true;

export default function build(THREE, h) {
  const g = new THREE.Group();
  const fur = furMat(THREE, 0x8e8e94, 0x58585e, { mid: 0x76767c });
  const fluff = furMat(THREE, 0xe2ded8, 0xb8b2aa);
  const F = rig(THREE, h, g, {
    head: { r: [11.8, 12.0, 11.2], c: [0, -.2, -2.6], boxy: .6, mat: fur },
    skins: [{ r: [3.6, 2.4, 2.6], c: [0, -7.2, 5.9], mat: fluff }],
    mouth: { y: -7.3, w: 2.3, open: 3.9, curve: .3, inside: 0x5a1e28, lip: { color: 0x34343e, r: .18 }, teeth: false, tongue: { color: 0xe46a82 } },
    eyes: { r: 1.6, x: 4.3, y: 2.6, ry: .26, sink: .36, iris: 0x2e2218, irisR: .74, pupilR: .4, lidMat: fur, open: 44, low: -46, liner: 0x24242c, hlSize: .24 },
    brows: { x: 4.3, y: 5.4, w: 2.3, th: .3, color: 0x4a4a56, arch: .45, tilt: -.25 },
    cheeks: { x: 6.6, y: -3.2, r: 2.7, puff: 2.2, color: 0xe89aa2, blush: 1.7, alpha: .5 },
  });
  // nasone ovale lucido (il tratto del koala)
  nose(THREE, F, { y: -2.4, w: 2.05, h: 2.85, d: 1.5, shape: 'round', color: 0x2a2a34, lift: .8 });
  // orecchie enormi e soffici, con frangia di pelo chiaro sul bordo
  earPair(THREE, F, { x: 9.6, y: 6.8, z: -3.0, rx: -.1, ry: -.35, rz: -.2, k: 80, c: 7, drive: [.12, .08, .14] }, (ear) => {
    ear.add(ell(THREE, fur, 4.7, 4.5, 1.8, 1.6, .8, 0, 30));
    ear.add(ell(THREE, fluff, 3.4, 3.3, .9, 1.8, .7, 1.2, 24));
    for (let i = 0; i < 14; i++) { const a = (i / 13) * PI * 1.4 - PI * .32; const r = .85 + .3 * ((i * 7) % 3) / 2; const p = ell(THREE, fluff, r * 1.1, r, .75, 1.6 + Math.cos(a) * 4.45, .8 + Math.sin(a) * 4.25, .55, 12); ear.add(p); }
  });
  // ciuffetto in testa (molla)
  const tuft = new THREE.Group(); tuft.position.set(0, 11.2, 1.0); F.root.add(tuft);
  for (let i = 0; i < 3; i++) tuft.add(strand(THREE, fur, [[(i - 1) * .6, -.4, 0], [(i - 1) * 1.0, 1.2, .6], [(i - 1) * 1.8, 1.4, 2.0]], .45, .12, 10));
  spring(F.P, tuft, { k: 55, c: 5, drive: [.15, .1, .18], expr: (s, t, o) => { o[0] = -s.browIn * .3; } });
  return g;
}
export function update(g, bs, t, h) { kitUpdate(g, bs, t, h); }
