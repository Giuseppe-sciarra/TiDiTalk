// Bandana annodata in testa (stile pirata/rocker): tessuto rosso a motivo paisley, nodo dietro con due code.
import { finish, headOccluder, faceOccluder, afterFace } from './_kit_acc.js';
export const meta = { label: 'Bandana', labelEn: 'Bandana', category: 'accessori', icon: '🏴' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  // tessuto: rosso con gocce paisley e puntini crema (texture procedurale)
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#a8192a'; x.fillRect(0, 0, 512, 256);
  const drop = (cx, cy, s, rot) => {
    x.save(); x.translate(cx, cy); x.rotate(rot); x.scale(s, s);
    x.beginPath(); x.moveTo(0, -14); x.bezierCurveTo(12, -10, 12, 8, 0, 12); x.bezierCurveTo(-9, 12, -10, 2, -4, -2); x.bezierCurveTo(0, -5, -2, -10, 0, -14); x.closePath();
    x.fillStyle = '#f0e6d2'; x.fill(); x.fillStyle = '#a8192a'; x.beginPath(); x.arc(1, 4, 4, 0, 6.3); x.fill(); x.fillStyle = '#1d2140'; x.beginPath(); x.arc(1, 4, 2, 0, 6.3); x.fill();
    x.restore();
  };
  for (let i = 0; i < 9; i++) for (let j = 0; j < 4; j++) drop(28 + i * 58 + (j % 2) * 29, 32 + j * 64, 1.15, (i + j) * 1.3);
  x.fillStyle = '#f0e6d2';
  for (let i = 0; i < 160; i++) { x.beginPath(); x.arc((i * 137) % 512, (i * 71) % 256, 2.2, 0, 6.3); x.fill(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(4, 1.4);
  const cloth = new THREE.MeshStandardMaterial({ map: tex, roughness: .85 });
  const clothDS = new THREE.MeshStandardMaterial({ map: tex, roughness: .85, side: THREE.DoubleSide });   // solo per le code (nastri sottili)
  const lathe = (pts, seg = 96) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg);

  // calotta di stoffa aderente sopra i capelli, con pieghe morbide (più marcate dietro, verso il nodo)
  const cap = lathe([[8.75, 0.0], [8.95, 2.4], [8.65, 5.0], [7.7, 7.4], [5.8, 9.2], [3.0, 10.25], [0, 10.5]]);
  const p = cap.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i), r = Math.hypot(vx, vz); if (r < 0.2) continue;
    const a = Math.atan2(vz, vx), back = Math.max(0, -vz / 8.9);
    const k = 1 + (0.012 + 0.03 * back) * Math.sin(a * 11 + vy * 0.6) * Math.min(1, (8 - Math.abs(vy - 3)) / 4);
    p.setXYZ(i, vx * k, vy, vz * k);
  }
  cap.computeVertexNormals();
  g.add(new THREE.Mesh(cap, cloth));
  // orlo arrotolato sul bordo
  const hem = new THREE.Mesh(new THREE.TorusGeometry(8.8, 0.28, 8, 96), cloth); hem.rotation.x = Math.PI / 2; hem.position.y = 0.05; g.add(hem);

  // nodo dietro + due "orecchie" del nodo + due code che pendono
  const knot = new THREE.Group();
  const k0 = new THREE.Mesh(new THREE.SphereGeometry(1.25, 16, 12), cloth); k0.scale.set(1.2, 0.9, 0.8); knot.add(k0);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), cloth); ear.scale.set(1.9, 0.8, 0.5); ear.position.set(s * 1.8, 0.5, -0.2); ear.rotation.z = s * 0.5; knot.add(ear);
    // coda: nastro piatto che scende e si apre (tubo schiacciato)
    const pts = [[s * 0.5, -0.4, -0.2], [s * 1.0, -2.5, -0.7], [s * 1.6, -4.8, -0.9], [s * 2.3, -6.8, -0.6]];
    const tail = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(q => new THREE.Vector3(...q))), 24, 0.75, 10);
    const tp = tail.attributes.position;
    for (let i = 0; i < tp.count; i++) { const zz = tp.getZ(i); tp.setZ(i, -0.6 + (zz + 0.6) * 0.25); }   // piatta
    tail.computeVertexNormals();
    knot.add(new THREE.Mesh(tail, clothDS));
  }
  knot.position.set(0, 0.6, -9.2);
  g.add(knot);

  g.position.set(0, 6.6, -2.7);
  g.rotation.x = -0.2;       // davanti il bordo sta sulla fronte alta, dietro scende sulla nuca
  { const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), h.preview ? h.mat(0x4a3526, { roughness: 1 }) : new THREE.MeshBasicMaterial({ colorWrite: false }));
    occ.scale.set(8.3, 5, 8.3); occ.position.set(0, -2.0, 0); occ.renderOrder = -1; occ.name = 'headOccluder'; g.add(occ); }
  g.userData.knot = knot;
  // occlusori nello spazio del viso (1.8.0): testa grande/calva inclinata in giù e viso davanti alle parti posteriori
  const root = new THREE.Group(); root.add(g); root.userData = g.userData;   // update() legge userData dal gruppo restituito
  root.add(headOccluder(THREE, h, { scale: [8.1, 10.0, 9.3], center: [0, 2.6, -4.3] }));
  root.add(faceOccluder(THREE, h, 0.2));
  return afterFace(finish(THREE, root));
}

export function update(g, bs, t) {
  const k = g.userData.knot; if (k) k.rotation.x = Math.sin(t * 1.6) * 0.05;
}
