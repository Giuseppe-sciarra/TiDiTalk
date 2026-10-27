// Topolino — testa intera con bocca vera (fxchars 1.8.0, kit in _kit.js)
import { PI, rig, kitUpdate, furMat, skinMat, PM, ell, earPair, whiskers, nose, glossMat } from './_kit.js';

export const meta = { label: 'Topolino', labelEn: 'Mouse', labelFr: 'Souriceau', labelDe: 'Mäuschen', category: 'personaggi', icon: '🐭' };
export const hideHead = true;

export default function build(THREE, h) {
  const g = new THREE.Group();
  const fur = furMat(THREE, 0x9a96a2, 0x625e6c, { mid: 0x827e8c });
  const light = furMat(THREE, 0xe2dcd6, 0xbcb4ae);
  const pink = skinMat(THREE, 0xf6b4c2, 0xe08aa0, { opt: { roughness: .55, clearcoat: .1 } });
  const F = rig(THREE, h, g, {
    head: { r: [10.8, 12.6, 11.0], c: [0, 0, -2.7], boxy: .6, mat: fur },
    skins: [{ r: [4.0, 3.0, 4.8], c: [0, -4.4, 6.6], mat: light }],
    mouth: { y: -6.0, w: 2.2, open: 3.8, curve: .35, inside: 0x5a1e2a, lip: { color: 0x6a4a52, r: .17 }, teeth: { color: 0xfffbf0, n: 2, span: .28, back: .55 }, tongue: { color: 0xe86a82 } },
    eyes: { r: 2.1, x: 3.7, y: 3.2, ry: .2, sink: .42, iris: 0x1e1618, irisR: .8, pupilR: .5, lidMat: fur, open: 50, low: -48, liner: 0x2a2028, hlSize: .26 },
    brows: { x: 3.7, y: 6.4, w: 2.4, th: .32, color: 0x4a4650, arch: .5, tilt: -.25 },
    cheeks: { x: 5.8, y: -2.8, r: 2.4, puff: 2.2, color: 0xf2a0b0, blush: 1.6, alpha: .55 },
  });
  // nasino rosa lucido in punta al muso (annusa)
  nose(THREE, F, { y: -2.6, w: .95, h: .8, d: .75, shape: 'round', mat: glossMat(THREE, 0xf08aa4), lift: .45, sniff: true });
  // dentini già nel rig (2 grandi davanti); baffi lunghi scuri
  whiskers(THREE, F, { x: 3.0, y: -3.8, n: 3, len: 6.8, r: .05, color: 0x3a3640, spread: .45, back: .25 });
  // orecchie enormi e sottili con interno rosa (molla morbida)
  earPair(THREE, F, { x: 7.6, y: 10.0, z: -3.0, rx: -.05, ry: -.3, rz: -.35, k: 70, c: 6, drive: [.14, .1, .16] }, (ear) => {
    ear.add(ell(THREE, fur, 5.3, 5.2, .8, 1.4, 3.2, 0, 32));
    const i = ell(THREE, pink, 4.0, 3.9, .4, 1.4, 3.1, .55, 28); ear.add(i);
  });
  return g;
}
export function update(g, bs, t, h) { kitUpdate(g, bs, t, h); }
