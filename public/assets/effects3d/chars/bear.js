// Orsetto — testa intera con bocca vera (fxchars 1.8.0, kit comune in _kit.js)
import { PI, rig, kitUpdate, furMat, glossMat, PM, ell, strand, spring, HEAD_FIT } from './_kit.js';

export const meta = { label: 'Orsetto', labelEn: 'Bear', labelFr: 'Ourson', labelDe: 'Bärchen', category: 'personaggi', icon: '🐻' };
export const hideHead = true;

export default function build(THREE, h) {
  const g = new THREE.Group();
  const fur = furMat(THREE, 0x7e4f2c, 0x4a2c16, { mid: 0x6a4024 });
  const muzzleM = furMat(THREE, 0xd8b385, 0xb48a5c);
  const innerEar = furMat(THREE, 0xc99872, 0xa4734c);
  const F = rig(THREE, h, g, {
    fit: HEAD_FIT,
    head: { r: [11.2, 12.4, 11.2], c: [0, 0, -2.7], boxy: .7, mat: fur },
    skins: [{ r: [5.0, 3.6, 3.7], c: [0, -5.1, 6.6], mat: muzzleM }],
    mouth: { y: -6.55, w: 2.7, open: 4.6, curve: .3, inside: 0x5a1e24, lip: { color: 0x3a2216, r: .2 }, teeth: { color: 0xfbf6ea, n: 4, span: .5, back: .8 }, tongue: { color: 0xe76a7c } },
    eyes: { r: 1.95, x: 3.85, y: 2.9, ry: .2, sink: .4, iris: 0x5a3416, irisR: .64, pupilR: .3, lidMat: fur, open: 50, low: -48, liner: 0x2a1a10 },
    brows: { x: 3.9, y: 6.1, w: 2.8, th: .42, color: 0x4a2c16, arch: .5, tilt: -.2 },
    cheeks: { x: 6.2, y: -3.2, r: 2.8, puff: 2.2, color: 0xe2806e, blush: 1.8, alpha: .45 },
  });
  const root = F.root;
  // naso: cuscinetto lucido a cuore + riflesso
  const noseG = new THREE.SphereGeometry(1, 28, 18), np = noseG.attributes.position;
  for (let i = 0; i < np.count; i++) { const x = np.getX(i), y = np.getY(i), z = np.getZ(i); np.setXYZ(i, x * (1.6 - .45 * Math.max(0, -y)), y * 1.05 + .25 * Math.abs(x) * Math.max(0, y), z * 1.0); }
  noseG.computeVertexNormals();
  const nose = new THREE.Mesh(noseG, glossMat(THREE, 0x2a1812)); F.onSurf(nose, 0, -3.25, .25); root.add(nose);
  // filtro (riga dal naso alla bocca)
  const phil = strand(THREE, PM(THREE, 0x3a2216, { roughness: .5 }), [[0, -4.3, F.surf(0, -4.3) + .05], [0, -5.4, F.surf(0, -5.4) + .05], [0, -6.45, F.surf(0, -6.45) + .02]], .11, .09, 6);
  root.add(phil); F.skin(phil, 1);
  // orecchie tonde con interno chiaro, con molla (inerzia)
  for (const sd of [1, -1]) {
    const ear = new THREE.Group(); ear.position.set(sd * 7.7, 9.3, -2.8); ear.rotation.set(-.1, sd * -.25, sd * -.4);
    const outer = ell(THREE, fur, 3.3, 3.2, 1.55, 0, 2.2, 0, 28); ear.add(outer);
    const inner = ell(THREE, innerEar, 2.1, 2.0, .7, 0, 2.05, 1.05, 22); ear.add(inner);
    root.add(ear);
    spring(F.P, ear, { k: 110, c: 10, drive: [.08, .05, .1], expr: (s, t, o) => { o[0] = -(s.browIn * .25 + (s.wideL + s.wideR) * .1); o[2] = sd * (s.smile * .08 - (s.browDnL + s.browDnR) * .06); } });
  }
  // ciuffetto in testa (molla)
  const tuft = new THREE.Group(); tuft.position.set(0, 12.6, 1.4); root.add(tuft);
  const tuftM = furMat(THREE, 0x6a4024, 0x4a2c16);
  for (let i = 0; i < 3; i++) tuft.add(strand(THREE, tuftM, [[(i - 1) * .7, -.5, 0], [(i - 1) * 1.1, 1.3, .8], [(i - 1) * 1.9, 1.6, 2.4]], .55, .14, 10));
  spring(F.P, tuft, { k: 60, c: 6, drive: [.14, .1, .16], expr: (s, t, o) => { o[0] = -s.browIn * .3; } });
  F.fx((s, t) => { nose.scale.setScalar(1 + s.puff * .12 + s.sneer * .1); });
  return g;
}
export function update(g, bs, t, h) { kitUpdate(g, bs, t, h); }
