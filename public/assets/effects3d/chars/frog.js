// Ranocchio — testa larga con boccona vera e occhi sporgenti (fxchars 1.8.0, kit in _kit.js)
import { PI, rig, kitUpdate, skinMat, PM, ell, eye, decal } from './_kit.js';

export const meta = { label: 'Ranocchio', labelEn: 'Frog', labelFr: 'Grenouille', labelDe: 'Frosch', category: 'personaggi', icon: '🐸' };
export const hideHead = true;

export default function build(THREE, h) {
  const g = new THREE.Group();
  const skin = skinMat(THREE, 0x86d050, 0x4c962c, { mid: 0x6cb63e, opt: { clearcoat: .55, clearcoatRoughness: .3 } });
  const belly = skinMat(THREE, 0xe4ee9e, 0xbccd6a, { opt: { clearcoat: .3 } });
  const F = rig(THREE, h, g, {
    head: { r: [12.8, 11.4, 11.6], c: [0, -.6, -2.9], boxy: .25, lift: 0, mat: skin },
    skins: [{ r: [8.0, 3.6, 3.4], c: [0, -9.4, 4.4], mat: belly }],
    // bocca enorme da parte a parte, a riposo un sorriso largo
    mouth: { y: -5.0, w: 7.2, open: 5.6, curve: .9, smileK: 1.3, widen: .25, inside: 0x6a1f2a, lip: { color: 0x2e6a1c, r: .28 }, teeth: false, tongue: { color: 0xec5a7a, w: 2.6, len: 3.4, out: 5.0 }, jawW: 11.5 },
    eyes: false,
    brows: false,
    cheeks: { x: 8.2, y: -2.2, r: 3.0, puff: 2.4, color: 0xf4927a, blush: 1.6, alpha: .4 },
  });
  // occhi sporgenti sopra la testa, in "torrette" di pelle
  for (const sd of [1, -1]) {
    const x = sd * 5.4, y = 8.6;
    F.root.add(ell(THREE, skin, 3.7, 3.4, 3.4, x, y, 1.0, 30));
    F.root.add(eye(THREE, h, F.P, { side: sd, r: 2.55, x, y: y + .5, z: 2.4, ry: sd * .22, rx: -.12, iris: 0xe8b23a, irisR: .66, pupilR: .38, pupil: 'hslit', lidMat: skin, open: 40, low: -36, liner: 0x2e6a1c, hlSize: .2 }));
  }
  // narici
  for (const sd of [1, -1]) { const n = ell(THREE, PM(THREE, 0x2e6a1c), .45, .3, .25, 0, 0, 0, 10); F.onSurf(n, sd * 1.4, 1.0, -.05); F.root.add(n); }
  // macchie
  for (const [x, y, r] of [[-6.2, 4.8, 1.2], [6.6, 3.2, .9], [-2.0, 4.4, .8], [2.8, 6.4, 1.0], [-8.6, -.6, .9], [8.8, -1.2, 1.1]]) decal(THREE, F, { x, y, rx: r, ry: r * .85, color: 0x3c7a24, soft: .35, patch: 1 });
  // sacca golare: si gonfia con le guance (e un po' quando parli)
  const sac = ell(THREE, belly, 4.8, 2.6, 2.6, 0, -10.6, 5.6, 28); F.root.add(sac);
  F.fx((s, t) => { const p = s.puff + s.jaw * .25; sac.scale.set(4.8 * (1 + p * .4), 2.6 * (1 + p * .8), 2.6 * (1 + p * .8)); sac.position.y = -10.6 - p * .9 - s.jaw * 1.6; });
  return g;
}
export function update(g, bs, t, h) { kitUpdate(g, bs, t, h); }
