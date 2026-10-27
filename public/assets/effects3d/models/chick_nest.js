// Pulcino nel nido in testa: nido di rametti intrecciati appoggiato sui capelli, pulcino giallo che si dondola e apre il becco
// quando apri la bocca; un pezzo di guscio d'uovo sul bordo.
import { finish, plastic } from './_kit_acc.js';
export const meta = { label: 'Pulcino nel nido', labelEn: 'Chick in a nest', category: 'divertenti', icon: '🐣' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const nest = new THREE.Group();
  // conca interna scura
  nest.add(new THREE.Mesh(new THREE.LatheGeometry([[0.01, -1.4], [3.5, -1.2], [5.6, 0.0], [6.3, 1.3], [5.4, 1.1], [3.4, 0.0], [0.01, -0.3]].map(p => new THREE.Vector2(p[0], p[1])), 48), h.mat(0x4a3220, { roughness: 1, side: THREE.DoubleSide })));
  // rametti: tubi sottili avvolti attorno al bordo con andamento casuale deterministico
  const twigCols = [0x7a5530, 0x8c6338, 0x6b4826, 0x9b7444, 0x5e3f22].map(c => h.mat(c, { roughness: .95 }));
  for (let k = 0; k < 34; k++) {
    const pts = [], a0 = k * 0.71, len = 1.6 + (k % 5) * 0.35, lev = (k % 7) / 6;
    for (let i = 0; i <= 8; i++) {
      const a = a0 + i / 8 * len, r = 5.4 + 0.9 * Math.sin(k * 1.3 + i * 0.9) + 0.4 * lev;
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0.1 + 1.6 * lev + 0.5 * Math.sin(k + i * 1.7), Math.sin(a) * r));
    }
    nest.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.22 + (k % 3) * 0.05, 5), twigCols[k % 5]));
  }
  // qualche rametto che sporge
  for (let k = 0; k < 6; k++) { const a = k * 1.05 + 0.3; const st = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 2.6, 5), twigCols[k % 5]); st.position.set(Math.cos(a) * 6.6, 1.2, Math.sin(a) * 6.6); st.rotation.set(0.6 * Math.sin(a), 0, -0.9 * Math.cos(a)); nest.add(st); }
  // pezzo di guscio sul bordo
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 12, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), h.mat(0xe9e0cf, { roughness: .6, side: THREE.DoubleSide }));
  shell.scale.y = 1.25; shell.position.set(4.6, 1.7, 2.6); shell.rotation.z = 0.5; nest.add(shell);

  // pulcino
  const chick = new THREE.Group();
  const fluff = new THREE.MeshStandardMaterial({ color: 0xf6c21c, roughness: 1 });
  const bodyGeo = new THREE.SphereGeometry(2.7, 32, 24);
  { const p = bodyGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = 1 + 0.025 * Math.sin(x * 7 + y * 5) * Math.cos(z * 6); p.setXYZ(i, x * n, y * n, z * n); } bodyGeo.computeVertexNormals(); }
  const body = new THREE.Mesh(bodyGeo, fluff); body.scale.set(1, 0.92, 0.95); chick.add(body);
  const head = new THREE.Group(); head.position.set(0, 3.1, 0.6); chick.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(2.0, 28, 20), fluff));
  // ciuffo
  for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.2, 6), fluff); t.position.set((i - 1) * 0.35, 2.2, -0.2); t.rotation.z = (i - 1) * -0.5; head.add(t); }
  // occhi neri lucidi con riflesso
  const eyeMat = plastic(THREE, 0x111111, 0.50);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10), eyeMat); e.position.set(s * 0.8, 0.35, 1.72); head.add(e);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); hl.position.set(s * 0.8 + 0.1, 0.48, 2.04); head.add(hl);
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), h.mat(0xf59a7a, { roughness: 1 })); cheek.scale.z = 0.3; cheek.position.set(s * 1.25, -0.35, 1.55); head.add(cheek);
  }
  // becco a due valve (l'inferiore si apre)
  const beakMat = h.mat(0xf08a1c, { roughness: .5 });
  const upper = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.1, 12), beakMat); upper.rotation.x = Math.PI / 2; upper.scale.y = 1; upper.scale.z = 0.55; upper.position.set(0, -0.15, 2.3); head.add(upper);
  const lowerPivot = new THREE.Group(); lowerPivot.position.set(0, -0.35, 1.9); head.add(lowerPivot);
  const lower = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.8, 12), beakMat); lower.rotation.x = Math.PI / 2; lower.scale.z = 0.45; lower.position.set(0, 0, 0.35); lowerPivot.add(lower);
  // alette
  const wings = [];
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.SphereGeometry(1.2, 14, 10), h.mat(0xe8b012, { roughness: 1 })); w.scale.set(0.45, 1.0, 0.8); w.position.set(s * 2.5, 0.1, 0.2); w.rotation.z = s * 0.35; chick.add(w); wings.push(w); }
  chick.position.y = 2.6; chick.scale.setScalar(1.1);    // esce bene dal nido: dalla camera (all'altezza degli occhi) il bordo non lo copre
  nest.add(chick);
  nest.position.set(0, 13.2, -3.0); nest.rotation.x = 0.12;   // 1.8.9: 1,2 cm più su, il fondo appoggia sulla calotta del cranio vero (prima ci entrava)
  g.add(nest);
  // occlusore "testa + capelli" sotto il nido (solo profondità)
  const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), h.preview ? h.mat(0x4a3526, { roughness: 1 }) : new THREE.MeshBasicMaterial({ colorWrite: false }));
  occ.scale.set(8.3, 12.6, 9.2); occ.position.set(0, 1.0, -3.2); occ.renderOrder = -1; occ.name = 'hairOccluder'; if (!h.preview) g.add(occ);
  g.userData = { chick, head, lowerPivot, wings };
  update(g, {}, 0.3);
  return finish(THREE, g);
}

export function update(g, bs, t) {
  const u = g.userData;
  // pigola da solo ogni tanto; con la bocca aperta (0..1 calibrato) il becco si apre del tutto
  const chirp = Math.max(Math.min(1, (bs.jawOpen || 0) * 1.2), (t % 2.6) < 0.25 ? 0.6 : 0);
  u.lowerPivot.rotation.x = 0.55 * chirp;
  u.chick.rotation.z = Math.sin(t * 2.0) * 0.12; u.chick.position.y = 2.6 + Math.abs(Math.sin(t * 2.0)) * 0.3;
  u.head.rotation.y = Math.sin(t * 0.9) * 0.35; u.head.rotation.x = -0.1 * chirp;
  u.wings.forEach((w, i) => { w.rotation.z = (i ? 1 : -1) * (0.35 + 0.35 * Math.max(0, Math.sin(t * 9)) * chirp); });
}
