// Orecchie da coniglio: cerchietto con due lunghe orecchie bianche (interno rosa), una leggermente piegata.
import { finish } from './_kit_acc.js';
export const meta = { label: 'Orecchie da coniglio', labelEn: 'Bunny ears', category: 'costumi', icon: '🐰' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const white = h.mat(0xece6df, { roughness: .95 });
  const pink = h.mat(0xe9849f, { roughness: .9 });

  // cerchietto: arco ellittico sopra la testa, da orecchio a orecchio
  const band = [];
  // cerchietto sopra i CAPELLI veri (che sporgono 2–4 cm oltre il cranio): arco largo 8.6, colmo a y≈13.8;
  // sezione schiacciata (larga 1.1 cm in profondità, spessa 0.7) come un cerchietto vero
  for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI; band.push(new THREE.Vector3(Math.cos(a) * 8.6, 1.0 + Math.sin(a) * 12.8, -3.0)); }
  g.add(new THREE.Mesh((() => { const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(band), 72, 0.35, 10); const p = tg.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, -3.0 + (p.getZ(i) + 3.0) * 1.6); tg.computeVertexNormals(); return tg; })(), h.mat(0xe07a98, { roughness: .5 })));

  const ear = (s, bend) => {
    const e = new THREE.Group();
    const outer = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 32), white); outer.scale.set(2.3, 7.6, 0.9); outer.position.y = 7.0;
    const inner = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 28), pink); inner.scale.set(1.35, 5.8, 0.5); inner.position.set(0, 7.3, 0.55);
    e.add(outer, inner);
    // piega: la parte alta dell'orecchio si inclina (deformazione dei vertici sopra una certa altezza)
    for (const m of [outer, inner]) {
      m.updateMatrix();
      const geo = m.geometry.clone(); geo.applyMatrix4(m.matrix); m.geometry = geo; m.position.set(0, 0, 0); m.scale.set(1, 1, 1);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i); if (y < 8) continue;
        const t = (y - 8) / 6.6, ang = bend * t * t;
        const x = p.getX(i), z = p.getZ(i);
        // ruota attorno all'asse Z passante per y=8
        const yy = y - 8;
        p.setXYZ(i, x * Math.cos(ang) - yy * Math.sin(ang), 8 + x * Math.sin(ang) + yy * Math.cos(ang), z);
      }
      geo.computeVertexNormals();
    }
    e.position.set(s * 3.6, 12.2, -3.0);
    e.rotation.z = -s * 0.22; e.rotation.x = -0.12;
    return e;
  };
  const eL = ear(1, 0.0), eR = ear(-1, -0.9);
  g.add(eL, eR);
  g.userData.ears = [eL, eR];
  return finish(THREE, g);
}

export function update(g, bs, t) {
  const [a, b] = g.userData.ears;
  a.rotation.x = -0.12 + Math.sin(t * 1.7) * 0.05;
  b.rotation.x = -0.12 + Math.cos(t * 1.3) * 0.05;
  // sorriso → le orecchie si drizzano un po'
  const smile = ((bs.mouthSmileLeft || 0) + (bs.mouthSmileRight || 0)) / 2;
  a.rotation.z = -0.22 + smile * 0.15; b.rotation.z = 0.22 - smile * 0.15;
}
