// Maialino — testa intera con bocca vera (fxchars 1.8.0, kit in _kit.js)
import { PI, rig, kitUpdate, furMat, skinMat, glossMat, PM, ell, strand, earPair, softEarGeo, spring, HEAD_FIT } from './_kit.js';

export const meta = { label: 'Maialino', labelEn: 'Pig', labelFr: 'Petit cochon', labelDe: 'Schweinchen', category: 'personaggi', icon: '🐷' };
export const hideHead = true;

export default function build(THREE, h) {
  const g = new THREE.Group();
  const skin = skinMat(THREE, 0xf08aa6, 0xc95c7e, { mid: 0xe2789a, opt: { roughness: .6, clearcoat: .1, envMapIntensity: .6 } });
  const snoutM = skinMat(THREE, 0xf6a0b6, 0xd9708e, { opt: { roughness: .5, clearcoat: .2, envMapIntensity: .6 } });
  const F = rig(THREE, h, g, {
    head: { r: [11.4, 12.2, 11.2], c: [0, 0, -2.7], boxy: .7, mat: skin },
    skins: [{ r: [4.4, 3.0, 2.6], c: [0, -7.0, 6.0], mat: skin }],
    mouth: { y: -7.0, w: 3.0, open: 4.2, curve: .35, inside: 0x6a1e2c, lip: { color: 0xb8506c, r: .2 }, teeth: false, tongue: { color: 0xe25a78 } },
    eyes: { r: 1.9, x: 4.0, y: 3.2, ry: .2, sink: .42, iris: 0x4f86d8, irisR: .62, pupilR: .3, lidMat: skin, open: 48, low: -46, liner: 0x6a2a3c, lashes: 3 },
    brows: { x: 4.0, y: 6.3, w: 2.6, th: .36, color: 0xc26484, arch: .5, tilt: -.2 },
    cheeks: { x: 6.6, y: -3.4, r: 2.8, puff: 2.3, color: 0xe24e72, blush: 1.9, alpha: .45 },
  });
  const root = F.root;
  // grifo: cilindro morbido col disco davanti e le narici incavate (si muove col naso)
  const snout = new THREE.Group(); const zs = F.surf(0, -3.2); snout.position.set(0, -3.2, zs - .2); root.add(snout);
  snout.add(new THREE.Mesh(new THREE.LatheGeometry([[0, 2.3], [2.6, 2.3], [3.25, 2.05], [3.45, 1.4], [3.5, 0], [3.4, -1.2]].map(p => new THREE.Vector2(p[0], p[1])), 40), snoutM).rotateX(PI / 2));
  const discM = skinMat(THREE, 0xd8668a, 0xb84a6e, { opt: { roughness: .45, clearcoat: .3, envMapIntensity: .6 } });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(2.85, 40), discM); disc.position.z = 2.32; snout.add(disc);
  const rimT = new THREE.Mesh(new THREE.TorusGeometry(2.95, .42, 12, 48), snoutM); rimT.position.z = 2.2; snout.add(rimT);
  for (const sd of [1, -1]) { const n = ell(THREE, PM(THREE, 0x7a2a44, { roughness: .6 }), .62, .95, .4, sd * 1.15, -.05, 2.25, 16); n.rotation.z = sd * .2; snout.add(n); }
  snout.scale.set(1.05, .84, 1.15);
  F.fx((s, t) => { snout.position.y = -3.2 + s.sneer * .35 + s.smile * .2 - s.jaw * .25; snout.scale.set(1.05 + s.puff * .08, .84 + s.puff * .05 + s.sneer * .08, 1.15); snout.rotation.x = Math.sin(t * 7) * .02 * (.3 + s.browIn); });
  // orecchie a punta che si piegano in avanti (morbide)
  const earG = softEarGeo(THREE, 5.0, 6.4, .5, { cup: .5, bend: .5 });
  const earIn = skinMat(THREE, 0xf6aabd, 0xe08aa2, { opt: { roughness: .6, envMapIntensity: .6 } });
  earPair(THREE, F, { x: 7.1, y: 9.1, z: -3.2, rx: -.7, ry: -.35, rz: -.55, floppy: .35 }, (ear) => {
    const o = new THREE.Mesh(earG, skin); ear.add(o);
    const i = new THREE.Mesh(softEarGeo(THREE, 3.4, 4.6, .2, { cup: .6, bend: .5 }), earIn); i.position.set(0, .5, .45); ear.add(i);
  });
  // ciuffetto
  const tuft = new THREE.Group(); tuft.position.set(0, 12.2, 1.0); root.add(tuft);
  for (let i = 0; i < 3; i++) tuft.add(strand(THREE, skinMat(THREE, 0xe87896, 0xd0607e), [[(i - 1) * .5, -.4, 0], [(i - 1) * .9, 1.2, .6], [(i - 1) * 1.6, 1.5, 2.0]], .36, .1, 10));
  spring(F.P, tuft, { k: 55, c: 5, drive: [.15, .1, .18], expr: (s, t, o) => { o[0] = -s.browIn * .3; } });
  return g;
}
export function update(g, bs, t, h) { kitUpdate(g, bs, t, h); }
