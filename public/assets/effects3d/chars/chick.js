// Pulcino — testa intera con becco che si apre (fxchars 1.8.0, kit in _kit.js)
import { PI, rig, kitUpdate, furMat, glossMat, PM, ell, strand, spring, surf, beak, leafGeo } from './_kit.js';

export const meta = { label: 'Pulcino', labelEn: 'Chick', labelFr: 'Poussin', labelDe: 'Küken', category: 'personaggi', icon: '🐥' };
export const hideHead = true;

export default function build(THREE, h) {
  const g = new THREE.Group();
  const yel = furMat(THREE, 0xf8c832, 0xdc8a10, { mid: 0xf0aa1e });
  const yelD = furMat(THREE, 0xf2b42a, 0xd88a10);
  const shell = PM(THREE, 0xf6efe4, { roughness: .45, clearcoat: .4, side: THREE.DoubleSide });
  const F = rig(THREE, h, g, {
    head: { r: [11.4, 12.0, 11.4], c: [0, 0, -2.7], boxy: .55, mat: yel },
    mouth: false,
    eyes: { r: 2.1, x: 3.8, y: 2.4, ry: .2, sink: .38, iris: 0x2a2018, irisR: .78, pupilR: .46, lidMat: yelD, open: 50, low: -48, liner: 0x3a2410, hlSize: .26 },
    brows: { x: 3.9, y: 5.7, w: 2.5, th: .34, color: 0xc07a10, arch: .5, tilt: -.25 },
    cheeks: { x: 6.2, y: -1.6, r: 2.6, puff: 2.0, color: 0xf58a6a, blush: 1.7, alpha: .5 },
  });
  // becco a due metà, si apre con la bocca
  beak(THREE, F, { y: -2.2, w: 2.7, h: 1.7, len: 3.4, color: 0xf58a1e, lowColor: 0xe0701a, open: .8, sink: .35, sharp: .8 });
  // guscio d'uovo rotto in testa (bordo a zig-zag, spesso)
  const capG = surf(THREE, 64, 10, (u, v) => {
    const a = u * 2 * PI, zig = Math.abs(((u * 9) % 1) - .5) * 2; const phi = v * (PI * .32 + zig * .16);
    return [Math.sin(phi) * Math.cos(a) * 9.4, Math.cos(phi) * 7.2, Math.sin(phi) * Math.sin(a) * 9.4];
  });
  const cap = new THREE.Mesh(capG, shell); cap.position.set(0, 7.0, -3.2); cap.rotation.set(-.12, 0, .12); F.root.add(cap);
  // ciuffo di piume (molla)
  const tuft = new THREE.Group(); tuft.position.set(0, 14.4, -3); F.root.add(tuft);
  for (let i = 0; i < 3; i++) tuft.add(strand(THREE, yelD, [[(i - 1) * .3, 0, 0], [(i - 1) * 1.4, 2.6, .6], [(i - 1) * 2.6, 2.6, 1.6]], .5, .14, 10));
  spring(F.P, tuft, { k: 45, c: 4, drive: [.18, .12, .22], expr: (s, t, o) => { o[0] = -s.browIn * .35; } });
  // alette (sbattono col sorriso)
  const wingG = leafGeo(THREE, 1.7, 7.0, 1.4, { point: .7, base: .6, skew: .5 });
  for (const sd of [1, -1]) {
    const w = new THREE.Group(); w.position.set(sd * 10.0, -4.2, -3.0); w.add(new THREE.Mesh(wingG, yelD).rotateZ(PI)); w.rotation.z = sd * .3; F.root.add(w);
    F.fx((s, t) => { w.rotation.z = sd * (.3 + s.smile * .9 + s.browIn * .3) + Math.sin(t * 9 + sd) * .1 * (.2 + s.smile); });
  }
  F.fx((s, t) => { cap.rotation.z = .12 + Math.sin(t * 1.3) * .03 - s.browIn * .1; cap.position.y = 7.0 + s.browIn * .9 + (s.wideL + s.wideR) * .3; });
  return g;
}
export function update(g, bs, t, h) { kitUpdate(g, bs, t, h); }
