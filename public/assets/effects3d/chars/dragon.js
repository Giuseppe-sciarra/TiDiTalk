// Draghetto — testa intera con bocca vera, corna e cresta (fxchars 1.8.0, kit in _kit.js)
import { PI, rig, kitUpdate, skinMat, glossMat, PM, ell, horn, leafGeo, earPair, decal, spring } from './_kit.js';

export const meta = { label: 'Draghetto', labelEn: 'Dragon', labelFr: 'Petit dragon', labelDe: 'Drache', category: 'personaggi', icon: '🐲' };
export const hideHead = true;

export default function build(THREE, h) {
  const g = new THREE.Group();
  const skin = skinMat(THREE, 0x4fbfa6, 0x26806c, { mid: 0x3aa28a, opt: { clearcoat: .45, clearcoatRoughness: .35 } });
  const skinD = skinMat(THREE, 0x2a7a68, 0x1a5a4c);
  const belly = skinMat(THREE, 0xf2dc90, 0xd8b862, { opt: { clearcoat: .2 } });
  const hornM = glossMat(THREE, 0xf2e3c0, { roughness: .35, clearcoat: .6 });
  const F = rig(THREE, h, g, {
    head: { r: [11.2, 12.2, 11.4], c: [0, 0, -2.7], boxy: .55, mat: skin },
    skins: [{ r: [5.6, 3.6, 4.8], c: [0, -4.4, 6.8], mat: skin }, { r: [4.2, 2.0, 2.6], c: [0, -8.6, 5.8], mat: belly }],
    mouth: { y: -6.3, w: 4.6, open: 5.6, curve: .55, smileK: 1.25, inside: 0x5a1a2a, lip: { color: 0x1f5a4d, r: .26 }, teeth: { color: 0xfbf4e0, n: 6, span: .7, back: 1.0, low: true }, tongue: { color: 0xe8607a, w: 2.0, len: 3.2, out: 4.0 } },
    eyes: { r: 2.15, x: 4.0, y: 3.1, ry: .2, sink: .44, iris: 0xf2c030, irisR: .72, pupilR: .3, pupil: 'slit', lidMat: skinD, open: 42, low: -44, liner: 0x123c34, roll: .1, hlSize: .22 },
    brows: { x: 4.0, y: 6.3, w: 3.4, th: .55, mat: skinD, arch: .35, tilt: .35 },
    cheeks: { x: 6.6, y: -3.0, r: 2.6, puff: 2.2 },
  });
  // narici sul muso
  for (const sd of [1, -1]) { const n = ell(THREE, PM(THREE, 0x184a40), .55, .4, .3, 0, 0, 0, 10); F.onSurf(n, sd * 1.5, -2.2, -.05); F.root.add(n); }
  // scaglie sulla fronte
  for (let i = 0; i < 7; i++) { const x = (i - 3) * 2.1, y = 8.2 - Math.abs(i - 3) * .7; decal(THREE, F, { x, y, rx: .9, ry: .7, color: 0x22705e, soft: .3, patch: 1 }); }
  // corna curve
  for (const sd of [1, -1]) F.root.add(horn(THREE, hornM, [[sd * 4.8, 9.6, -4], [sd * 6.4, 13.5, -5.5], [sd * 7.0, 16.4, -8.4]], 1.35, .15, 14));
  // cresta lungo la testa (molla: ondeggia)
  const crest = new THREE.Group(); F.root.add(crest);
  const spG = leafGeo(THREE, .9, 3.0, .4, { point: 1.2, base: .9, skew: .25, seg: 16 });
  for (let i = 0; i < 6; i++) { const a = .3 + i * .33, sp = new THREE.Mesh(spG, belly); sp.scale.setScalar(1 + (i < 3 ? i : 5 - i) * .18); sp.position.set(0, 12.0 * Math.cos(a), -2.7 - 11.4 * Math.sin(a)); sp.rotation.x = -a; crest.add(sp); }
  spring(F.P, crest, { k: 80, c: 7, drive: [.06, .05, .08], max: .15, expr: (s, t, o) => { o[0] = -s.browIn * .05; } });
  // orecchie a pinna
  const finG = leafGeo(THREE, 2.2, 5.6, .45, { point: 1.1, base: .8, cup: .3, skew: .3 });
  earPair(THREE, F, { x: 9.8, y: 4.8, z: -4.2, ry: -.4, rz: -1.2, k: 80, c: 7 }, (ear) => { ear.add(new THREE.Mesh(finG, skinD)); });
  return g;
}
export function update(g, bs, t, h) { kitUpdate(g, bs, t, h); }
