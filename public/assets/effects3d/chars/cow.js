// Mucca — testa intera con bocca vera (fxchars 1.8.0, kit in _kit.js)
import { PI, rig, kitUpdate, furMat, skinMat, PM, ell, horn, earPair, leafGeo, decal, glossMat, lathe, spring, strand } from './_kit.js';

export const meta = { label: 'Mucca', labelEn: 'Cow', labelFr: 'Vache', labelDe: 'Kuh', category: 'personaggi', icon: '🐮' };
export const hideHead = true;

export default function build(THREE, h) {
  const g = new THREE.Group();
  const white = furMat(THREE, 0xf0ebe2, 0xc8bfb2, { mid: 0xe0d8cc });
  const pink = skinMat(THREE, 0xf4b2bc, 0xd6808e, { opt: { roughness: .5, clearcoat: .15 } });
  const F = rig(THREE, h, g, {
    head: { r: [11.0, 12.4, 11.0], c: [0, .2, -2.7], boxy: .6, mat: white },
    skins: [{ r: [6.0, 3.8, 4.0], c: [0, -6.0, 6.6], mat: pink }],
    mouth: { y: -7.6, w: 3.8, open: 4.8, curve: .35, inside: 0x6a1e2a, lip: { color: 0xa0566a, r: .22 }, teeth: { color: 0xfffbf2, n: 6, span: .6, back: .9 }, tongue: { color: 0xe25a78, w: 2.4, len: 3.0, out: 3.6 } },
    eyes: { r: 2.0, x: 4.2, y: 3.4, ry: .26, sink: .42, iris: 0x3a2618, irisR: .72, pupilR: .4, lidMat: white, open: 44, low: -46, liner: 0x1e1614, lashes: 4, hlSize: .24 },
    brows: { x: 4.2, y: 6.4, w: 2.5, th: .32, color: 0x3a3230, arch: .5, tilt: -.25 },
    cheeks: { x: 6.8, y: -2.4, r: 2.6, puff: 2.2 },
  });
  // macchie nere morbide (a forma irregolare)
  const blob = (seed) => (x2, S) => { x2.fillStyle = '#fff'; x2.beginPath(); const N = 9; for (let i = 0; i <= N; i++) { const a = i / N * 2 * PI, r = S * (.36 + .1 * Math.sin(a * 3 + seed) + .05 * Math.cos(a * 5 + seed * 2)); const x = S / 2 + Math.cos(a) * r, y = S / 2 + Math.sin(a) * r; i ? x2.lineTo(x, y) : x2.moveTo(x, y); } x2.closePath(); x2.fill(); };
  decal(THREE, F, { x: -5.6, y: 6.4, rx: 3.6, ry: 3.2, rot: .3, color: 0x2a2624, draw: blob(1), patch: 1 });
  decal(THREE, F, { x: 6.8, y: -.4, rx: 2.8, ry: 3.4, rot: -.4, color: 0x2a2624, draw: blob(4), patch: 1 });
  decal(THREE, F, { x: 1.6, y: 10.4, rx: 2.4, ry: 1.8, rot: .1, color: 0x2a2624, draw: blob(7), patch: 1 });
  // narici sul muso
  for (const sd of [1, -1]) { const n = ell(THREE, PM(THREE, 0x7a2a3e, { roughness: .5 }), .75, 1.05, .45, 0, 0, 0, 14); n.rotation.z = sd * .35; F.onSurf(n, sd * 2.4, -5.0, -.15); F.root.add(n); F.skin(n, 1); }
  // corna corte e lucide
  const hornM = glossMat(THREE, 0xeee2c8, { roughness: .35, clearcoat: .5 });
  for (const sd of [1, -1]) F.root.add(horn(THREE, hornM, [[sd * 4.8, 10.0, -1.6], [sd * 7.0, 12.0, -1.4], [sd * 7.8, 14.2, -.6]], 1.15, .25, 14));
  // ciuffo
  const tuft = new THREE.Group(); tuft.position.set(0, 11.9, 1.6); F.root.add(tuft);
  const tm = furMat(THREE, 0x7a4a2a, 0x4e2c16);
  for (let i = 0; i < 4; i++) tuft.add(strand(THREE, tm, [[(i - 1.5) * .7, -.3, 0], [(i - 1.5) * 1.2, 1.6, .8], [(i - 1.5) * 1.9, .9, 2.8]], .5, .14, 10));
  spring(F.P, tuft, { k: 55, c: 5, drive: [.15, .1, .18], expr: (s, t, o) => { o[0] = -s.browIn * .3; } });
  // orecchie orizzontali (molla: sventolano)
  const earG = leafGeo(THREE, 1.9, 5.2, .7, { point: .8, base: .55, cup: .35, skew: .45 });
  earPair(THREE, F, { x: 10.0, y: 6.2, z: -2.4, ry: -.3, rz: -1.75, k: 70, c: 6, drive: [.12, .1, .18] }, (ear) => {
    ear.add(new THREE.Mesh(earG, white)); const i = new THREE.Mesh(leafGeo(THREE, 1.2, 3.8, .3, { point: .8, base: .5, cup: .45, skew: .45 }), pink); i.position.set(0, .5, .45); ear.add(i);
  });
  // campanaccio
  const strap = new THREE.Mesh(new THREE.TorusGeometry(9.2, .75, 12, 56), PM(THREE, 0x7a3a22, { roughness: .6 })); strap.rotation.x = PI / 2; strap.position.set(0, -11.6, -2.4); strap.scale.set(1, 1, .92); F.root.add(strap);
  const bell = new THREE.Group(); bell.position.set(0, -12.2, 6.2); F.root.add(bell);
  bell.add(lathe(THREE, glossMat(THREE, 0xd9a83a, { metalness: .8, roughness: .28 }), [[.4, 0], [1.4, -.4], [1.8, -2.4], [2.6, -3.8], [2.7, -4.1]], { n: 14, seg: 28 }));
  F.fx((s, t) => { bell.rotation.z = Math.sin(t * 3.2) * .15 + s.jaw * .1; });
  return g;
}
export function update(g, bs, t, h) { kitUpdate(g, bs, t, h); }
