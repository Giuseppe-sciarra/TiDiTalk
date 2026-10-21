// Gattino — testa intera con bocca vera (fxchars 1.8.0, kit in _kit.js)
// (da sostituire coi gattini nuovi dell'agente fxpremium: tenuto aggiornato finché non ci sono)
import { PI, rig, kitUpdate, furMat, skinMat, PM, ell, leafGeo, earPair, whiskers, nose, glossMat, decal } from './_kit.js';

export const meta = { label: 'Gattino', labelEn: 'Cat', labelFr: 'Chaton', labelDe: 'Kätzchen', category: 'personaggi', icon: '🐱' };
export const hideHead = true;

export default function build(THREE, h) {
  const g = new THREE.Group();
  const fur = furMat(THREE, 0xec9440, 0xbe6420, { mid: 0xd87c2c });
  const cream = furMat(THREE, 0xf6ead4, 0xdcc6a2);
  const pink = skinMat(THREE, 0xf2a0b0, 0xdc8094, { opt: { roughness: .55 } });
  const F = rig(THREE, h, g, {
    head: { r: [11.4, 11.8, 11.0], c: [0, -.2, -2.7], boxy: .55, mat: fur },
    skins: [{ r: [2.5, 1.9, 2.0], c: [1.8, -4.7, 6.9], mat: cream }, { r: [2.5, 1.9, 2.0], c: [-1.8, -4.7, 6.9], mat: cream }, { r: [2.3, 1.7, 1.9], c: [0, -6.8, 6.3], mat: cream }],
    mouth: { y: -6.0, w: 2.4, open: 4.0, curve: .5, smileK: 1.2, inside: 0x5a1e2a, lip: { color: 0x7a4a3a, r: .16 }, teeth: { color: 0xfffbf2, n: 4, span: .55, back: .7 }, tongue: { color: 0xe86a82 } },
    eyes: { r: 2.2, x: 3.95, y: 3.0, ry: .2, sink: .42, iris: 0x7cc456, irisR: .74, pupilR: .3, pupil: 'slit', lidMat: fur, open: 46, low: -46, liner: 0x3a2214, lashes: 2, hlSize: .24 },
    brows: { x: 4.0, y: 6.3, w: 2.6, th: .3, color: 0x9a4c14, arch: .45, tilt: -.15 },
    cheeks: { x: 6.2, y: -3.0, r: 2.6, puff: 2.3, color: 0xf3a0a0, blush: 1.6, alpha: .45 },
  });
  nose(THREE, F, { y: -3.25, w: .9, h: .66, d: .55, shape: 'tri', mat: glossMat(THREE, 0xec8a9c), lift: .3 });
  whiskers(THREE, F, { x: 3.4, y: -4.6, n: 3, len: 7.0, r: .055, color: 0xfffaf2, spread: .5, back: .22 });
  // strisce sulla fronte
  for (let i = -1; i <= 1; i++) decal(THREE, F, { x: i * 2.0, y: 9.2 - Math.abs(i) * .6, rx: .55, ry: 1.8, rot: i * .25, color: 0xa4521a, soft: .5, patch: 1 });
  // orecchie a punta (morbide, con interno rosa)
  const earG = leafGeo(THREE, 3.2, 6.2, 1.0, { point: 1.05, base: .85, cup: .4, skew: .25 });
  const inG = leafGeo(THREE, 2.1, 4.4, .4, { point: 1.0, base: .8, cup: .5, skew: .25 });
  earPair(THREE, F, { x: 6.6, y: 9.0, z: -3.0, rx: -.15, ry: -.2, rz: -.36 }, (ear) => {
    ear.add(new THREE.Mesh(earG, fur));
    const i = new THREE.Mesh(inG, pink); i.position.set(0, .4, .62); ear.add(i);
  });
  return g;
}
export function update(g, bs, t, h) { kitUpdate(g, bs, t, h); }
