// Monocolo dorato sull'occhio destro, con catenella che scende lungo la guancia.
import { finish, lens as lensMaterial } from './_kit_acc.js';
export const meta = { label: 'Monocolo', labelEn: 'Monocle', category: 'accessori', icon: '🧐' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const gold = h.mat(0xd8b35a, { roughness: .25, metalness: .95 });
  const lensMat = lensMaterial(THREE, 0xdfe8f2, 0.06, { side: THREE.DoubleSide });

  // sull'occhio destro di chi lo porta (−X)
  const s = -1;
  const M = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.22, 10, 48), gold);
  const rim2 = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.12, 8, 48), gold); rim2.position.z = -0.25;
  const lens = new THREE.Mesh(new THREE.CircleGeometry(2.6, 40), lensMat);
  // piccolo anello per la catenella, in basso verso l'esterno
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 6, 14), gold); loop.position.set(s * 2.3, -1.9, 0); loop.rotation.y = Math.PI / 2;
  // rotellina decorativa in alto
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 12), gold); knob.position.set(s * 1.1, 2.75, 0); knob.rotation.z = Math.PI / 2;
  M.add(rim, rim2, lens, loop, knob);
  M.position.set(s * 3.1, 2.7, 5.9);
  M.rotation.y = s * 0.2;
  g.add(M);

  // catenella: curva che scende dalla lente lungo la guancia fino sotto lo zigomo/verso il colletto
  const pts = [[s * 5.4, 0.9, 5.3], [s * 6.2, -1.5, 5.0], [s * 6.6, -4.5, 4.6], [s * 6.3, -7.5, 4.4], [s * 5.2, -10.5, 4.2], [s * 3.8, -13.2, 3.8]];
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)), false, 'catmullrom', 0.5);
  const N = 34, linkGeo = new THREE.TorusGeometry(0.22, 0.06, 6, 12);
  for (let i = 0; i <= N; i++) {
    const t = i / N, p = curve.getPointAt(t), tg = curve.getTangentAt(t);
    const link = new THREE.Mesh(linkGeo, gold);
    link.position.copy(p);
    link.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tg);
    link.rotateZ(i % 2 ? Math.PI / 2 : 0);   // maglie alternate
    link.rotateX(Math.PI / 2);
    g.add(link);
  }
  // clip finale
  const clip = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), gold); clip.position.set(s * 3.8, -13.3, 3.8); g.add(clip);
  // occlusore del viso (solo profondità, rigido, rientrato di 0.3 cm): nell'app l'occlusore del viso è nel passaggio
  // trasparente e non nasconde gli oggetti opachi, quindi girando la testa l'asta lontana si vedrebbe attraverso la guancia
  { const f = h.face, geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(Array.from(f.pos), 3)); geo.setIndex(Array.from(f.idx)); geo.computeVertexNormals();
    const pp = geo.attributes.position, nn = geo.attributes.normal;
    for (let i = 0; i < pp.count; i++) pp.setXYZ(i, pp.getX(i) - nn.getX(i) * 0.3, pp.getY(i) - nn.getY(i) * 0.3, pp.getZ(i) - nn.getZ(i) * 0.3);
    const occ = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false })); occ.renderOrder = -1; occ.name = 'faceOccluder'; g.add(occ); }
  return finish(THREE, g);
}
