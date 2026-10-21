// Gufo — testa intera con becco che si apre e occhioni (fxchars 1.8.0, kit in _kit.js)
import { PI, rig, kitUpdate, furMat, glossMat, PM, ell, leafGeo, earPair, beak, decal } from './_kit.js';

export const meta = { label: 'Gufo', labelEn: 'Owl', labelFr: 'Hibou', labelDe: 'Eule', category: 'personaggi', icon: '🦉' };
export const hideHead = true;

export default function build(THREE, h) {
  const g = new THREE.Group();
  const brown = furMat(THREE, 0xa06a38, 0x6e4422, { mid: 0x8a5a2e });
  const brownD = furMat(THREE, 0x6a4220, 0x4a2c14);
  const cream = furMat(THREE, 0xf0dcb6, 0xd2b88c);
  const F = rig(THREE, h, g, {
    head: { r: [11.8, 12.0, 11.4], c: [0, .2, -2.9], boxy: .55, mat: brown },
    // disco facciale chiaro attorno agli occhi
    skins: [{ r: [5.3, 5.6, 1.9], c: [4.0, 2.1, 6.2], mat: cream, noSlit: true }, { r: [5.3, 5.6, 1.9], c: [-4.0, 2.1, 6.2], mat: cream, noSlit: true }],
    mouth: false,
    eyes: { r: 3.0, x: 4.15, y: 2.3, ry: .12, sink: .45, iris: 0xf0a420, irisR: .74, pupilR: .44, lidMat: brownD, open: 56, low: -54, liner: 0x2a1a0c, hlSize: .22, look: [.35, .25] },
    brows: { x: 4.4, y: 6.9, w: 4.4, th: .5, color: 0x5a3818, arch: .3, tilt: .5 },
    cheeks: false,
  });
  beak(THREE, F, { y: -2.3, w: 1.9, h: 2.0, len: 3.0, color: 0xf0a83a, lowColor: 0xd48f2c, open: .7, hook: .45, sharp: 1.1, sink: .3 });
  // piume sul petto (tre file di gocce)
  const fG = leafGeo(THREE, 1.5, 2.6, .55, { point: .7, base: .7, skew: .45, seg: 14 });
  for (let r = 0; r < 3; r++) for (let i = -3; i <= 3; i++) {
    const a = i * .28 + (r % 2) * .14, y = -7.8 - r * 1.6, R = 11.0 - r * 1.1;
    const f = new THREE.Mesh(fG, r === 2 ? cream : brown); f.position.set(Math.sin(a) * R, y, Math.cos(a) * R - 3.2); f.rotation.set(-.4, a, PI); F.root.add(f);
  }
  // ciuffi (orecchie) con molla
  const tG = leafGeo(THREE, 1.3, 5.2, .8, { point: 1.1, base: .8, skew: .3, seg: 16 });
  earPair(THREE, F, { x: 7.0, y: 9.4, z: -3.2, rx: -.25, rz: -.45, k: 80, c: 7, perk: 1.4 }, (ear, sd) => {
    for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(tG, i === 1 ? brownD : brown); c.position.set((i - 1) * .8 * sd, -i * .3, (i - 1) * .35); c.rotation.z = sd * -(.15 + i * .12); c.scale.setScalar(1 - i * .15); ear.add(c); }
  });
  // alette
  const wG = leafGeo(THREE, 1.6, 7.5, 2.4, { point: .8, base: .6, skew: .5 });
  for (const sd of [1, -1]) {
    const w = new THREE.Group(); w.position.set(sd * 10.4, -4.8, -4); w.add(new THREE.Mesh(wG, brownD).rotateZ(PI)); w.rotation.z = sd * .25; F.root.add(w);
    F.fx((s, t) => { w.rotation.z = sd * (.25 + s.smile * .8 + s.puff * .5) + Math.sin(t * 2.2 + sd) * .05; });
  }
  return g;
}
export function update(g, bs, t, h) { kitUpdate(g, bs, t, h); }
