// Cagnolino — testa intera con bocca vera (fxchars 1.8.0, kit in _kit.js)
// (da sostituire coi cuccioli nuovi dell'agente fxpremium: tenuto aggiornato finché non ci sono)
import { PI, rig, kitUpdate, furMat, PM, ell, leafGeo, earPair, nose, decal, glossMat } from './_kit.js';

export const meta = { label: 'Cagnolino', labelEn: 'Dog', labelFr: 'Petit chien', labelDe: 'Hündchen', category: 'personaggi', icon: '🐶' };
export const hideHead = true;

export default function build(THREE, h) {
  const g = new THREE.Group();
  const fur = furMat(THREE, 0xc98a4c, 0x8e5a2c, { mid: 0xb0743a });
  const furD = furMat(THREE, 0x7a4a26, 0x4e2c14);
  const cream = furMat(THREE, 0xf0dcb6, 0xd0b48a);
  const F = rig(THREE, h, g, {
    head: { r: [11.2, 12.0, 11.0], c: [0, 0, -2.7], boxy: .6, mat: fur },
    skins: [{ r: [5.0, 3.4, 4.0], c: [0, -4.8, 6.4], mat: cream }],
    mouth: { y: -6.2, w: 3.3, open: 5.0, curve: .45, smileK: 1.25, inside: 0x5a1a22, lip: { color: 0x3a2418, r: .2 }, teeth: { color: 0xfffbf2, n: 4, span: .55, back: .9 }, tongue: { color: 0xec6a84, w: 2.2, len: 2.8, out: 3.4 } },
    eyes: { r: 2.0, x: 3.9, y: 2.9, ry: .2, sink: .42, iris: 0x5a3416, irisR: .68, pupilR: .36, lidMat: fur, open: 48, low: -48, liner: 0x2a1a10, hlSize: .24 },
    brows: { x: 3.9, y: 6.0, w: 2.6, th: .44, color: 0x6a3e1e, arch: .45, tilt: -.2 },
    cheeks: { x: 6.4, y: -3.0, r: 2.6, puff: 2.2 },
  });
  // macchia scura sull'occhio
  decal(THREE, F, { x: -4.0, y: 3.3, rx: 3.3, ry: 3.6, rot: -.3, color: 0x6a3e1e, soft: .25, patch: 1 });
  nose(THREE, F, { y: -2.75, w: 1.6, h: 1.15, d: 1.0, shape: 'heart', color: 0x1a1414, lift: .55 });
  // orecchie flosce (gravità + inerzia: dondolano quando giri la testa)
  const earG = leafGeo(THREE, 3.0, 10.0, .95, { point: .5, base: .55, cup: -.25, skew: .6 });
  earPair(THREE, F, { x: 9.6, y: 7.6, z: -.6, rx: .15, ry: .3, rz: -2.9, floppy: .8, perk: .5, back: .6 }, (ear) => {
    ear.add(new THREE.Mesh(earG, furD));
  });
  // collare con medaglietta
  const collar = new THREE.Mesh(new THREE.TorusGeometry(9.4, .85, 12, 56), PM(THREE, 0xd2473c, { roughness: .45, clearcoat: .3 })); collar.rotation.x = PI / 2; collar.position.set(0, -11.2, -2.6); collar.scale.set(1, 1, .9); F.root.add(collar);
  const tag = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, .3, 28), glossMat(THREE, 0xf0c050, { metalness: .7, roughness: .25 })); tag.rotation.x = PI / 2; tag.position.set(0, -12.9, 5.8); F.root.add(tag);
  F.fx((s, t) => { tag.rotation.z = Math.sin(t * 2.5) * .25; });
  return g;
}
export function update(g, bs, t, h) { kitUpdate(g, bs, t, h); }
