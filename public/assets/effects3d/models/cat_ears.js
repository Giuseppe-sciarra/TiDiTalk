// Orecchie da gatto: cerchietto nero con due orecchie triangolari, interno rosa, un filo di pelo sui bordi.
import { finish } from './_kit_acc.js';
export const meta = { label: 'Orecchie da gatto', labelEn: 'Cat ears', category: 'costumi', icon: '🐱' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const fur = h.mat(0x24222a, { roughness: .95 });
  const pink = h.mat(0xf0a2b4, { roughness: .9 });

  const band = [];
  // cerchietto sopra i CAPELLI veri (che sporgono 2–4 cm oltre il cranio): arco largo 8.6, colmo a y≈13.8;
  // sezione schiacciata (larga 1.1 cm in profondità, spessa 0.7) come un cerchietto vero
  for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI; band.push(new THREE.Vector3(Math.cos(a) * 8.6, 1.0 + Math.sin(a) * 12.8, -3.0)); }
  g.add(new THREE.Mesh((() => { const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(band), 72, 0.35, 10); const p = tg.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, -3.0 + (p.getZ(i) + 3.0) * 1.6); tg.computeVertexNormals(); return tg; })(), fur));

  const tri = (w, hgt, round) => {
    const s = new THREE.Shape();
    s.moveTo(-w, 0); s.lineTo(w, 0); s.quadraticCurveTo(w * 0.55, hgt * 0.55, round, hgt); s.quadraticCurveTo(-round, hgt, -w * 0.55, hgt * 0.55); s.closePath();
    return s;
  };
  const ear = (s) => {
    const e = new THREE.Group();
    const outer = new THREE.Mesh(new THREE.ExtrudeGeometry(tri(3.3, 6.0, 0.35), { depth: 1.0, bevelEnabled: true, bevelSize: .35, bevelThickness: .3, bevelSegments: 3, curveSegments: 12 }), fur);
    outer.position.z = -0.5;
    const inner = new THREE.Mesh(new THREE.ExtrudeGeometry(tri(2.0, 4.0, 0.25), { depth: 0.3, bevelEnabled: true, bevelSize: .15, bevelThickness: .1, bevelSegments: 2, curveSegments: 12 }), pink);
    inner.position.set(0, 0.7, 0.45);
    e.add(outer, inner);
    // ciuffetti di pelo in cima (piccoli coni)
    for (let i = 0; i < 3; i++) { const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.1, 6), fur); tuft.position.set((i - 1) * 0.35, 6.2 + (i == 1 ? 0.5 : 0.1), 0); tuft.rotation.z = (i - 1) * -0.35; e.add(tuft); }
    e.position.set(s * 4.6, 11.4, -3.0);
    e.rotation.z = -s * 0.42; e.rotation.y = s * 0.35; e.rotation.x = -0.1;
    return e;
  };
  const eL = ear(1), eR = ear(-1);
  g.add(eL, eR); g.userData.ears = [eL, eR];
  return finish(THREE, g);
}

export function update(g, bs, t) {
  const [a, b] = g.userData.ears;
  const wig = Math.sin(t * 2.4) * 0.04;
  const smile = ((bs.mouthSmileLeft || 0) + (bs.mouthSmileRight || 0)) / 2;
  a.rotation.z = -0.42 + wig + smile * 0.2; b.rotation.z = 0.42 - wig - smile * 0.2;
}
