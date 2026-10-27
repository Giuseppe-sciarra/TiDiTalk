// Pinguino — testa intera con becco che si apre (fxchars 1.8.0, kit in _kit.js)
import { PI, rig, kitUpdate, furMat, glossMat, PM, ell, leafGeo, strand, spring, beak } from './_kit.js';

export const meta = { label: 'Pinguino', labelEn: 'Penguin', labelFr: 'Pingouin', labelDe: 'Pinguin', category: 'personaggi', icon: '🐧' };
export const hideHead = true;

export default function build(THREE, h) {
  const g = new THREE.Group();
  const black = furMat(THREE, 0x2e3644, 0x161a22, { opt: { sheen: .45, sheenColor: 0x7a8aa8, roughness: .6 } });
  const white = furMat(THREE, 0xf2efe8, 0xd0cac0);
  const gold = furMat(THREE, 0xffc93a, 0xf29a18);
  const F = rig(THREE, h, g, {
    head: { r: [11.4, 12.2, 11.4], c: [0, 0, -2.7], boxy: .55, mat: black },
    // maschera bianca a cuore sul viso
    skins: [{ r: [4.6, 5.6, 2.4], c: [2.7, .4, 6.4], mat: white, noSlit: true }, { r: [4.6, 5.6, 2.4], c: [-2.7, .4, 6.4], mat: white, noSlit: true }, { r: [5.4, 4.2, 2.6], c: [0, -4.2, 6.5], mat: white, noSlit: true }],
    mouth: false,
    eyes: { r: 1.9, x: 3.5, y: 2.6, ry: .18, sink: .38, iris: 0x2a2a34, irisR: .74, pupilR: .44, lidMat: white, open: 50, low: -48, liner: 0x1a1a22, hlSize: .26 },
    brows: { x: 3.6, y: 5.9, w: 2.5, th: .38, color: 0x161a22, arch: .5, tilt: -.25 },
    cheeks: { x: 5.8, y: -1.6, r: 2.4, puff: 2.0, color: 0xf29aa8, blush: 1.5, alpha: .55 },
  });
  // macchie dorate ai lati (pinguino imperatore)
  for (const sd of [1, -1]) { const p = ell(THREE, gold, 1.7, 3.9, 2.6, sd * 10.1, -1.0, -.6, 22); p.rotation.z = sd * -.35; F.root.add(p); }
  beak(THREE, F, { y: -2.8, w: 2.1, h: 1.4, len: 4.2, color: 0xf28a1c, lowColor: 0xd4721a, open: .72, sink: .35, sharp: .9 });
  // pinne (sbattono col sorriso)
  const wG = leafGeo(THREE, 1.6, 8.0, 3.0, { point: .7, base: .6, skew: .5 });
  for (const sd of [1, -1]) {
    const w = new THREE.Group(); w.position.set(sd * 10.2, -6.0, -3.5); w.add(new THREE.Mesh(wG, black).rotateZ(PI)); w.rotation.z = sd * .3; F.root.add(w);
    F.fx((s, t) => { w.rotation.z = sd * (.3 + s.smile * .9 + s.puff * .5) + Math.sin(t * 7 + sd) * .1 * (.2 + s.smile); });
  }
  // ciuffetto (molla)
  const tuft = new THREE.Group(); tuft.position.set(0, 12.6, -1); F.root.add(tuft);
  for (let i = 0; i < 3; i++) tuft.add(strand(THREE, black, [[0, -.3, 0], [(i - 1) * 1.2, 1.9, 1], [(i - 1) * 2.2, 1.6, 2.6]], .34, .1, 10));
  spring(F.P, tuft, { k: 50, c: 4.5, drive: [.16, .1, .2], expr: (s, t, o) => { o[0] = -s.browIn * .3; } });
  return g;
}
export function update(g, bs, t, h) { kitUpdate(g, bs, t, h); }
