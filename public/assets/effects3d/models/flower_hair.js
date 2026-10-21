// Fiore tra i capelli: grande ibisco rosa-corallo sopra l'orecchio sinistro, con foglie e un bocciolo; ondeggia appena.
import { finish } from './_kit_acc.js';
export const meta = { label: 'Fiore tra i capelli', labelEn: 'Flower in hair', category: 'accessori', icon: '🌺' };

// superficie "testa + capelli" (ellissoide più grande del cranio): x≈±8.5, sommità y≈14, fronte z≈4.7
const HC = [0, 1.0, -3.2], HR = [8.5, 13.0, 9.6];
function onHair(THREE, x, y, off = 0) {
  const ax = x / HR[0], ay = (y - HC[1]) / HR[1], rest = Math.max(0, 1 - ax * ax - ay * ay);
  const p = new THREE.Vector3(x, y, HC[2] + HR[2] * Math.sqrt(rest));
  const n = new THREE.Vector3(x / (HR[0] * HR[0]), (y - HC[1]) / (HR[1] * HR[1]), (p.z - HC[2]) / (HR[2] * HR[2])).normalize();
  return { p: p.addScaledVector(n, off), n };
}

export default function build(THREE, h) {
  const g = new THREE.Group();
  const flower = new THREE.Group();
  // petali: forma a ventaglio con bordo ondulato, leggermente a coppa; sfumatura (colori per vertice) dal centro scuro al bordo chiaro
  const pet = new THREE.Shape();
  pet.moveTo(0, 0); pet.bezierCurveTo(1.6, 0.6, 2.7, 2.2, 2.4, 3.6); pet.bezierCurveTo(1.9, 4.4, 0.8, 4.0, 0, 4.4); pet.bezierCurveTo(-0.8, 4.0, -1.9, 4.4, -2.4, 3.6); pet.bezierCurveTo(-2.7, 2.2, -1.6, 0.6, 0, 0);
  const pg = new THREE.ShapeGeometry(pet, 16);
  { const p = pg.attributes.position, col = [], c0 = new THREE.Color(0x7a0820), c1 = new THREE.Color(0xd8304c), c2 = new THREE.Color(0xef6f5e), tmp = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), r = Math.hypot(x, y) / 4.4;
      p.setZ(i, 0.35 * x * x / 6 + 0.25 * y - 0.06 * y * y + 0.08 * Math.sin(x * 4 + y * 3));   // coppa + ondulazione
      tmp.copy(r < 0.35 ? c0 : c1).lerp(r < 0.35 ? c1 : c2, r < 0.35 ? r / 0.35 : (r - 0.35) / 0.65); col.push(tmp.r, tmp.g, tmp.b);
    }
    pg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); pg.computeVertexNormals(); }
  const petMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .7, side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(pg, petMat); m.rotation.z = i / 5 * Math.PI * 2; m.rotateX(-0.25); flower.add(m); }
  // pistillo lungo con la punta gialla
  const stem = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.3, 0.6, 1.5), new THREE.Vector3(0.6, 1.4, 2.8)]), 12, 0.12, 6), h.mat(0xb3203a, { roughness: .5 }));
  flower.add(stem);
  for (let i = 0; i < 7; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), h.mat(0xf2c12e, { roughness: .6 })); const a = i / 7 * Math.PI * 2; d.position.set(0.6 + Math.cos(a) * 0.3, 1.4 + Math.sin(a) * 0.3, 2.8); flower.add(d); }
  // foglie dietro al fiore
  const leaf = new THREE.Shape(); leaf.moveTo(0, 0); leaf.quadraticCurveTo(1.6, 2.2, 0, 5.2); leaf.quadraticCurveTo(-1.6, 2.2, 0, 0);
  const lg = new THREE.ShapeGeometry(leaf, 10); { const p = lg.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, -0.12 * p.getX(i) * p.getX(i)); lg.computeVertexNormals(); }
  const lm = h.mat(0x3f7f3a, { roughness: .8, side: THREE.DoubleSide });
  for (const r of [2.2, 3.4, -2.6]) { const m = new THREE.Mesh(lg, lm); m.rotation.z = r; m.position.z = -0.5; flower.add(m); }
  // bocciolo
  const bud = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10), h.mat(0xd8455b, { roughness: .6 })); bud.scale.set(0.8, 1.5, 0.8); bud.position.set(-3.6, -2.6, -0.4); bud.rotation.z = 0.7; flower.add(bud);

  // sopra l'orecchio sinistro (+X), appoggiato sui capelli e girato un po' verso la camera
  const { p, n } = onHair(THREE, 7.0, 7.4, 0.9);
  const face = n.clone().lerp(new THREE.Vector3(0, 0, 1), 0.35).normalize();
  flower.position.copy(p);
  flower.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), face);
  flower.rotateZ(0.4);
  flower.scale.setScalar(1.05);
  g.add(flower);
  g.userData.flower = flower; g.userData.q0 = flower.quaternion.clone();
  return finish(THREE, g);
}

export function update(g, bs, t) {
  const f = g.userData.flower; if (!f) return;
  f.quaternion.copy(g.userData.q0); f.rotateZ(Math.sin(t * 1.3) * 0.05); f.rotateX(Math.sin(t * 0.9) * 0.04);
}
