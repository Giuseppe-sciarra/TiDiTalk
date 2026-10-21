// Leone — testa intera con bocca vera e criniera morbida (fxchars 1.8.0, kit in _kit.js)
import { PI, rig, kitUpdate, furMat, PM, ell, leafGeo, earPair, whiskers, nose, spring, glossMat } from './_kit.js';

export const meta = { label: 'Leone', labelEn: 'Lion', labelFr: 'Lion', labelDe: 'Löwe', category: 'personaggi', icon: '🦁' };
export const hideHead = true;

export default function build(THREE, h) {
  const g = new THREE.Group();
  const fur = furMat(THREE, 0xdc9a46, 0xa86624, { mid: 0xc8822e });
  const cream = furMat(THREE, 0xf6e0b4, 0xd8b884);
  const maneA = furMat(THREE, 0xb85e1c, 0x7a3a10, { mid: 0x9c4c16 });
  const maneB = furMat(THREE, 0xd47e2c, 0xa05618, { mid: 0xbc6a22 });
  const F = rig(THREE, h, g, {
    head: { r: [10.0, 11.0, 10.4], c: [0, -.8, -2.2], boxy: .45, lift: .05, mat: fur },
    skins: [{ r: [2.7, 2.1, 2.2], c: [1.95, -4.8, 6.9], mat: cream }, { r: [2.7, 2.1, 2.2], c: [-1.95, -4.8, 6.9], mat: cream }, { r: [2.5, 1.9, 2.1], c: [0, -7.1, 6.3], mat: cream }],
    mouth: { y: -6.2, w: 2.8, open: 5.0, curve: .4, smileK: 1.2, inside: 0x5a1a1e, lip: { color: 0x5a3020, r: .2 }, teeth: { color: 0xfffbf2, n: 4, span: .6, back: .8, low: true }, tongue: { color: 0xe46a7c } },
    eyes: { r: 1.95, x: 3.7, y: 2.4, ry: .2, sink: .42, iris: 0xd88a1a, irisR: .68, pupilR: .32, lidMat: fur, open: 44, low: -46, liner: 0x3a2010, roll: .08, hlSize: .22 },
    brows: { x: 3.7, y: 5.5, w: 2.7, th: .42, color: 0x8a4a1a, arch: .4, tilt: -.1 },
    cheeks: { x: 6.0, y: -3.4, r: 2.6, puff: 2.2 },
  });
  nose(THREE, F, { y: -3.2, w: 1.55, h: 1.0, d: .8, shape: 'tri', color: 0x6a3a2c, lift: .45 });
  for (const sd of [1, -1]) for (let i = 0; i < 3; i++) { const x = sd * (1.4 + i * .7), y = -4.6 + (i % 2) * .5; const d = ell(THREE, PM(THREE, 0x7a4a2a), .14, .14, .08, x, y, 0, 6); F.onSurf(d, x, y, .02); F.root.add(d); F.skin(d, 1); }
  whiskers(THREE, F, { x: 3.6, y: -4.9, n: 3, len: 5.2, r: .045, color: 0xfff6e6, spread: .4, back: .2 });
  // criniera: ciocche morbide a goccia su tre giri (molle: ondeggia quando muovi la testa)
  const mane = new THREE.Group(); mane.position.set(0, -.5, -3.8); F.root.add(mane);
  const tuftG = [leafGeo(THREE, 2.7, 6.0, 1.7, { point: .6, base: .75, skew: .4, seg: 12, bend: .6 }), leafGeo(THREE, 3.1, 7.0, 1.9, { point: .6, base: .75, skew: .4, seg: 12, bend: .6 })];
  const rings = [{ n: 20, r: [9.4, 10.2], z: 1.4, m: maneB, gi: 0, tilt: .5 }, { n: 18, r: [10.6, 11.5], z: -.6, m: maneA, gi: 1, tilt: .25 }, { n: 14, r: [9.0, 9.8], z: -3.4, m: maneA, gi: 1, tilt: -.1 }];
  // (le ciocche si fondono in una geometria per materiale: 2 disegni invece di 52)
  const parts = new Map(), tmp = new THREE.Object3D();
  rings.forEach((R, ri) => {
    for (let i = 0; i < R.n; i++) {
      const a = (i + ri * .5) / R.n * 2 * PI, ca = Math.cos(a), sa = Math.sin(a);
      tmp.position.set(R.r[0] * ca * .9, R.r[1] * sa * .9 + (sa < 0 ? sa * 1.2 : 0), R.z);
      tmp.rotation.set(0, 0, a - PI / 2); tmp.rotateX(R.tilt); tmp.scale.setScalar(.95 + ((i * 7 + ri * 3) % 5) * .05); tmp.updateMatrix();
      const gg = tuftG[R.gi].clone(); gg.applyMatrix4(tmp.matrix); if (!parts.has(R.m)) parts.set(R.m, []); parts.get(R.m).push(gg);
    }
  });
  for (const [mat, list] of parts) { const merged = h.BufferGeometryUtils.mergeGeometries(list, false); list.forEach(x => x.dispose()); mane.add(new THREE.Mesh(merged, mat)); }
  mane.add(ell(THREE, maneA, 11.4, 12.4, 6.5, 0, .3, -3.5, 20));
  spring(F.P, mane, { k: 70, c: 6, drive: [.05, .06, .08], lin: .004, max: .25, expr: (s, t, o) => { o[0] = Math.sin(t * 1.1) * .01; } });
  F.fx((s, t) => { const k = 1 + s.jaw * .06 + s.browIn * .04; mane.scale.set(k, k, 1); });
  // orecchie tonde dentro la criniera
  earPair(THREE, F, { x: 6.6, y: 8.4, z: -1.6, rz: -.3, k: 110, c: 10 }, (ear) => {
    ear.add(ell(THREE, fur, 2.4, 2.3, 1.2, 0, 1.6, 0, 22)); ear.add(ell(THREE, cream, 1.45, 1.4, .5, 0, 1.5, .85, 16));
  });
  return g;
}
export function update(g, bs, t, h) { kitUpdate(g, bs, t, h); }
