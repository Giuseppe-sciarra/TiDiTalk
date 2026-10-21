// Cerchietto da unicorno: corno a spirale con sfumatura pastello, fiorellini alla base e orecchiette bianche.
import { finish } from './_kit_acc.js';
export const meta = { label: 'Corno da unicorno', labelEn: 'Unicorn horn', category: 'costumi', icon: '🦄' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const white = h.mat(0xefe9f0, { roughness: .9 });
  const pink = h.mat(0xec95b8, { roughness: .9 });

  // cerchietto
  const band = [];
  // cerchietto sopra i CAPELLI veri (che sporgono 2–4 cm oltre il cranio): arco largo 8.6, colmo a y≈13.8;
  // sezione schiacciata (larga 1.1 cm in profondità, spessa 0.7) come un cerchietto vero
  for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI; band.push(new THREE.Vector3(Math.cos(a) * 8.6, 1.0 + Math.sin(a) * 12.8, -3.0)); }
  g.add(new THREE.Mesh((() => { const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(band), 72, 0.35, 10); const p = tg.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, -3.0 + (p.getZ(i) + 3.0) * 1.6); tg.computeVertexNormals(); return tg; })(), h.mat(0xd99ac4, { roughness: .5 })));

  // corno: cono con scanalatura a spirale e colori per vertice (rosa → lilla → azzurro)
  const H = 9.5, R = 1.75, segs = 60, radial = 32;
  const P = [], C = [], I = [];
  const c1 = new THREE.Color(0xffb3d1), c2 = new THREE.Color(0xc9a8ff), c3 = new THREE.Color(0x9fe3ff), tmp = new THREE.Color();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, r0 = R * (1 - t) + 0.06;
    for (let j = 0; j <= radial; j++) {
      const a = j / radial * Math.PI * 2;
      const groove = 1 + 0.16 * Math.cos(a * 2 - t * 22) * (1 - t * 0.5);   // doppia spirale
      const r = r0 * groove;
      P.push(Math.cos(a) * r, t * H, Math.sin(a) * r);
      tmp.copy(t < 0.5 ? c1 : c2).lerp(t < 0.5 ? c2 : c3, t < 0.5 ? t * 2 : (t - 0.5) * 2);
      C.push(tmp.r, tmp.g, tmp.b);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; I.push(a, b, a + 1, b, b + 1, a + 1); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  geo.setIndex(I); geo.computeVertexNormals();
  const horn = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: .25, metalness: .1, clearcoat: .8, sheen: 1, sheenColor: 0xffffff }));
  const hornGroup = new THREE.Group(); hornGroup.add(horn);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), h.mat(0x9fe3ff, { roughness: .3 })); cap.position.y = H; hornGroup.add(cap);
  // corno, fiori e foglie stanno sul colmo del nuovo cerchietto (sopra i capelli)
  const deco = new THREE.Group(); deco.position.set(0, 4.0, -2.6); g.add(deco);
  hornGroup.position.set(0, 9.4, 1.6); hornGroup.rotation.x = 0.42;   // inclinato in avanti
  deco.add(hornGroup);

  // fiorellini alla base del corno
  const flower = (col, x, y, z, sc) => {
    const f = new THREE.Group();
    for (let i = 0; i < 5; i++) { const pt = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), h.mat(col, { roughness: .8 })); pt.scale.set(1, 0.45, 1); const a = i / 5 * Math.PI * 2; pt.position.set(Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55); f.add(pt); }
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), h.mat(0xffe066, { roughness: .7 })); c.position.y = 0.12; f.add(c);
    f.position.set(x, y, z); f.scale.setScalar(sc); f.lookAt(x * 3, y + 6, z + 8); f.rotateX(Math.PI / 2);
    return f;
  };
  deco.add(flower(0xff8fb1, 2.2, 8.9, 2.4, 1.1), flower(0xb59cff, -2.0, 9.0, 2.5, 1.0), flower(0xffffff, 0.3, 8.6, 3.3, 0.8), flower(0x9fe3ff, -3.6, 8.1, 0.8, .9), flower(0xff8fb1, 3.8, 8.0, 0.6, .9));
  // foglioline
  for (const [x, y, z, r] of [[1.2, 8.9, 3.0, 0.6], [-1.0, 9.1, 3.1, -0.7], [3.0, 8.5, 1.8, 1.0], [-2.9, 8.6, 1.8, -1.0]]) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), h.mat(0x7cc47a, { roughness: .9 })); leaf.scale.set(1.6, 0.25, 0.8); leaf.position.set(x, y, z); leaf.rotation.y = r; deco.add(leaf);
  }

  // orecchiette bianche con interno rosa
  for (const s of [-1, 1]) {
    const e = new THREE.Group();
    const o = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 20), white); o.scale.set(1.3, 2.6, 0.6); o.position.y = 2.2;
    const i = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 18), pink); i.scale.set(0.75, 1.8, 0.35); i.position.set(0, 2.3, 0.4);
    e.add(o, i); e.position.set(s * 5.0, 11.0, -3.0); e.rotation.z = -s * 0.5; e.rotation.y = s * 0.3;
    g.add(e);
  }
  return finish(THREE, g);
}
