// Pesce palla — si gonfia con le guance (e un po' a bocca aperta) (fxchars 1.8.0, kit in _kit.js)
import { PI, rig, kitUpdate, skinMat, glossMat, PM, ell, leafGeo, spring } from './_kit.js';

export const meta = { label: 'Pesce palla', labelEn: 'Puffer fish', labelFr: 'Poisson-globe', labelDe: 'Kugelfisch', category: 'personaggi', icon: '🐡' };
export const hideHead = true;

export default function build(THREE, h) {
  const g = new THREE.Group();
  const skin = skinMat(THREE, 0xf8c040, 0xdc861c, { mid: 0xf0a42e, opt: { clearcoat: .6, clearcoatRoughness: .25 } });
  const belly = skinMat(THREE, 0xfaeec0, 0xe6cc8e, { opt: { clearcoat: .4 } });
  const spikeMat = glossMat(THREE, 0xfbe9b8, { roughness: .4, clearcoat: .5 });
  const finMat = PM(THREE, 0xf2a640, { roughness: .5, transparent: true, opacity: .92, side: THREE.DoubleSide, clearcoat: .3 });
  const F = rig(THREE, h, g, {
    head: { r: [11.8, 11.6, 11.8], c: [0, .2, -2.9], boxy: .2, lift: 0, mat: skin },
    skins: [{ r: [8.6, 6.4, 4.4], c: [0, -5.6, 3.8], mat: belly }],
    // bocca piccola a "o" con labbroni (bacio = bocca a ventosa)
    mouth: { y: -4.8, w: 1.8, open: 3.2, curve: .2, smileK: .8, kiss: 2.4, inside: 0x6a2a2a, lip: { color: 0xe8805a, r: .45 }, teeth: false, tongue: { color: 0xe8607a, w: 1.0, len: 1.4, out: 1.8 } },
    eyes: { r: 2.7, x: 4.6, y: 2.6, ry: .28, sink: .45, iris: 0x2e3a4a, irisR: .62, pupilR: .4, lidMat: skin, open: 54, low: -50, liner: 0x8a4a10, hlSize: .22 },
    brows: { x: 4.7, y: 6.6, w: 2.8, th: .36, color: 0xb86a1c, arch: .5, tilt: -.2 },
    cheeks: { x: 7.6, y: -1.6, r: 3.2, puff: 2.6, color: 0xf2906a, blush: 1.8, alpha: .5 },
  });
  // spine: coni morbidi sulla sfera (non sul viso), crescono quando si gonfia
  // (una sola InstancedMesh: un disegno per tutte le spine)
  const spikes = [], N = 76, phi = PI * (3 - Math.sqrt(5)), sg = new THREE.ConeGeometry(.6, 3.0, 12); sg.translate(0, 1.5, 0);
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = phi * i;
    const dir = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
    if (dir.z > .3 && Math.abs(dir.y) < .78) continue; if (dir.y < -.55 && dir.z > -.2) continue;
    spikes.push({ p: new THREE.Vector3(dir.x * 11.4, .2 + dir.y * 11.2, -2.9 + dir.z * 11.4), q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir) });
  }
  const inst = new THREE.InstancedMesh(sg, spikeMat, spikes.length); F.root.add(inst);
  const m4 = new THREE.Matrix4(), sc = new THREE.Vector3();
  // pinne laterali, dorsale e coda (si muovono)
  const finG = leafGeo(THREE, 2.4, 5.2, .25, { point: .7, base: .5, skew: .55 });
  const fins = [];
  for (const sd of [1, -1]) { const grp = new THREE.Group(); grp.position.set(sd * 11.4, -1.0, -3.5); const f = new THREE.Mesh(finG, finMat); f.rotation.z = sd * -PI / 2; grp.add(f); F.root.add(grp); fins.push({ grp, sd }); }
  const dorsal = new THREE.Mesh(finG, finMat); dorsal.position.set(0, 12.6, -4.5); dorsal.rotation.y = PI / 2; F.root.add(dorsal);
  const tail = new THREE.Group(); tail.position.set(0, .4, -14.4); F.root.add(tail); const tf = new THREE.Mesh(leafGeo(THREE, 3.2, 5.6, .25, { point: .5, base: .4, skew: .65 }), finMat); tf.rotation.set(-PI / 2, 0, PI / 2); tail.add(tf);
  spring(F.P, tail, { k: 40, c: 3.5, drive: [.1, .25, .1], max: .5, expr: (s, t, o) => { o[1] = Math.sin(t * 3) * .3; } });
  F.fx((s, t) => {
    const p = Math.max(s.puff, s.jaw * .45, (s.wideL + s.wideR) * .25);       // quanto si gonfia
    F.root.scale.setScalar(1 + p * .14);
    spikes.forEach((sp, i) => { const k = .4 + p * .9 + Math.sin(t * 2 + i) * .03; sc.set(1 + p * .4, k, 1 + p * .4); m4.compose(sp.p, sp.q, sc); inst.setMatrixAt(i, m4); });
    inst.instanceMatrix.needsUpdate = true;
    fins.forEach(({ grp, sd }) => { grp.rotation.y = sd * Math.sin(t * 6) * (.45 + p * .3); });
    dorsal.rotation.z = Math.sin(t * 2.5) * .15;
  });
  return g;
}
export function update(g, bs, t, h) { kitUpdate(g, bs, t, h); }
