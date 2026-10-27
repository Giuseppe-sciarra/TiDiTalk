// Panda — testa intera con bocca vera (fxchars 1.8.0, kit in _kit.js)
import { PI, rig, kitUpdate, furMat, glossMat, PM, ell, strand, earPair, spring, decal, nose, HEAD_FIT } from './_kit.js';

export const meta = { label: 'Panda', labelEn: 'Panda', labelFr: 'Panda', labelDe: 'Panda', category: 'personaggi', icon: '🐼' };
export const hideHead = true;

export default function build(THREE, h) {
  const g = new THREE.Group();
  const white = furMat(THREE, 0xe9e5dc, 0xc9c2b4);
  const black = furMat(THREE, 0x2e2c32, 0x18171b, { opt: { sheen: .5, sheenColor: 0x6a6a78 } });
  const F = rig(THREE, h, g, {
    head: { r: [11.8, 12.2, 11.4], c: [0, 0, -2.7], boxy: .65, mat: white },
    skins: [{ r: [4.2, 3.0, 3.0], c: [0, -5.6, 6.4], mat: white }],
    mouth: { y: -6.9, w: 2.5, open: 4.2, curve: .3, inside: 0x5a1a26, lip: { color: 0x2a262c, r: .19 }, teeth: { color: 0xfbf7ee, n: 4, span: .5, back: .8 }, tongue: { color: 0xe46a82 } },
    eyes: { r: 1.75, x: 3.9, y: 2.7, ry: .22, sink: .3, iris: 0x3a2618, irisR: .7, pupilR: .36, lidMat: black, open: 50, low: -48, liner: 0x0e0d10, hlSize: .24 },
    brows: { x: 3.9, y: 6.4, w: 2.4, th: .3, color: 0x1a191d, arch: .5, tilt: -.25 },
    cheeks: { x: 6.6, y: -3.0, r: 2.7, puff: 2.2, color: 0xf2a2ac, blush: 1.8, alpha: .5 },
  });
  // macchie nere attorno agli occhi (a goccia inclinata, bordo morbido)
  const drop = (x2, S) => { x2.fillStyle = '#fff'; x2.beginPath(); x2.moveTo(S * .5, S * .04); x2.bezierCurveTo(S * .98, S * .1, S * .98, S * .62, S * .62, S * .93); x2.bezierCurveTo(S * .4, S * 1.02, S * .06, S * .86, S * .08, S * .5); x2.bezierCurveTo(S * .1, S * .18, S * .26, S * .02, S * .5, S * .04); x2.fill(); };
  for (const sd of [1, -1]) decal(THREE, F, { x: sd * 4.05, y: 2.35, rx: 3.0, ry: 3.6, rot: sd * .55, color: 0x18171b, draw: drop, roughness: .85, patch: 1 });
  nose(THREE, F, { y: -3.6, w: 1.35, h: .95, d: .8, shape: 'heart', color: 0x16151a });
  // filtro
  { const ph = strand(THREE, PM(THREE, 0x2a262c, { roughness: .5 }), [[0, -4.3, F.surf(0, -4.3) + .04], [0, -6.0, F.surf(0, -6.0) + .04], [0, -6.85, F.surf(0, -6.85) + .02]], .11, .09, 6); F.root.add(ph); F.skin(ph, 1); }
  earPair(THREE, F, { x: 8.2, y: 9.2, z: -3.2, rx: -.15, ry: -.25, rz: -.3 }, (ear) => {
    ear.add(ell(THREE, black, 3.3, 3.2, 1.6, 0, 2.2, 0, 28));
    ear.add(ell(THREE, furMat(THREE, 0x48444e, 0x2e2c32), 2.0, 1.9, .6, 0, 2.1, 1.1, 20));
  });
  // ramo di bambù: lo tiene in bocca, cade un po' quando apre la bocca
  const bam = new THREE.Group(); F.root.add(bam);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, 7.5, 14), glossMat(THREE, 0x7fbf4a, { roughness: .45, clearcoat: .3 })); stem.rotation.z = -1.15; stem.position.set(3.0, -1.2, 0); bam.add(stem);
  for (const k of [-1.2, 1.6]) { const r = new THREE.Mesh(new THREE.TorusGeometry(.36, .1, 6, 16), glossMat(THREE, 0x5f9a34)); r.position.set(3.0 + Math.cos(-1.15 + PI / 2) * k, -1.2 + Math.sin(-1.15 + PI / 2) * k, 0); r.rotation.set(PI / 2, 0, -1.15); bam.add(r); }
  const leafM = PM(THREE, 0x5aa636, { roughness: .5, side: THREE.DoubleSide, sheen: .3 });
  for (let i = 0; i < 3; i++) { const l = ell(THREE, leafM, 1.7, .45, .12, 6.3 + i * .25, -.1 + i * .85, .2, 14); l.rotation.z = -.2 + i * .45; bam.add(l); }
  bam.position.set(1.4, -7.0, F.surf(1.4, -7.0) - .1);
  F.fx((s, t) => { bam.position.y = -7.0 - s.jaw * 2.4; bam.rotation.z = Math.sin(t * 1.3) * .06 - s.smile * .2 + s.jaw * .35; bam.rotation.x = -s.jaw * .4; });
  return g;
}
export function update(g, bs, t, h) { kitUpdate(g, bs, t, h); }
