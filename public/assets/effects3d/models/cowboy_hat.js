// Cappello da cowboy: feltro marrone, corona con piega centrale, tesa larga rialzata ai lati, fascia in cuoio con fibbia.
// 1.8.9: calzato sulla testa vera: fascia ovale come una testa, più indietro e più in basso (prima davanti e ai lati
// restava 1–2 cm sopra la testa e dietro ci entrava); riempitivo invisibile con la forma della testa vera, tappo
// sull'apertura e fodera scura (hatFit in glb/_glbhead.js);
// tolto il fondo chiuso/disco sotto la cupola: da sotto si vedeva come un coperchio.
import { finish, headOccluder, faceOccluder, afterFace } from './_kit_acc.js';
import { hatFit } from '../glb/_glbhead.js';
export const meta = { label: 'Cappello da cowboy', labelEn: 'Cowboy hat', category: 'costumi', icon: '🤠' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const felt = h.mat(0x8a5a2e, { roughness: .9 });
  const leather = h.mat(0x3a2415, { roughness: .6 });
  const brass = h.mat(0xc9a24a, { roughness: .35, metalness: .85 });
  const lathe = (pts, seg = 56) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg);

  // corona con piega "cattleman": tre avvallamenti sulla sommità
  const crownGeo = lathe([[8.4, 0], [8.5, 3], [8.1, 6.5], [7.5, 9.0], [6.3, 10.8], [4.0, 11.9], [0, 12.1]]);
  const p = crownGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y > 7) {
      const t = (y - 7) / 5.1;                                     // 0 in basso → 1 in cima
      const centre = Math.max(0, 1 - (x / 3.2) ** 2);              // piega centrale davanti-dietro
      const sides = Math.max(0, 1 - ((Math.abs(x) - 5.0) / 2.2) ** 2) * Math.max(0, 1 - (z / 7) ** 2);
      p.setY(i, y - (2.2 * centre + 0.9 * sides) * t * t);
    }
  }
  crownGeo.computeVertexNormals();
  g.add(new THREE.Mesh(crownGeo, felt));

  // tesa: anello spesso, rialzato ai lati (±X) e leggermente abbassato davanti/dietro
  const R0 = 8.3, R1 = 15.5;
  const brimGeo = lathe([[R0, 0.3], [R1, 0.0], [R1 + 0.2, 0.3], [R1, 0.55], [R0, 0.7], [R0, 0.3]], 72);
  const q = brimGeo.attributes.position;
  for (let i = 0; i < q.count; i++) {
    const x = q.getX(i), y = q.getY(i), z = q.getZ(i);
    const r = Math.hypot(x, z), f = Math.max(0, (r - R0) / (R1 - R0));
    const side = (x * x) / (r * r || 1);                              // 1 ai lati, 0 davanti/dietro
    q.setY(i, y + (3.6 * side * side - 0.5 * (1 - side)) * f * f * (1 + 0.6 * f));
  }
  brimGeo.computeVertexNormals();
  g.add(new THREE.Mesh(brimGeo, felt));

  // fascia in cuoio con cuciture e fibbia
  g.add(new THREE.Mesh(lathe([[8.55, 0.8], [8.65, 1.6], [8.65, 2.6], [8.55, 3.2], [8.2, 3.2], [8.2, 0.8], [8.55, 0.8]]), leather));
  const stitchGeo = new THREE.TorusGeometry(8.62, 0.06, 6, 96);
  for (const yy of [1.05, 2.95]) { const s = new THREE.Mesh(stitchGeo, h.mat(0xc8a070, { roughness: .8 })); s.rotation.x = Math.PI / 2; s.position.y = yy; g.add(s); }
  const buckle = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.22, 8, 24), brass); frame.scale.set(1, 1.25, 1);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.2, 8), brass);
  buckle.add(frame, pin);
  buckle.position.set(7.4, 2.0, 4.1); buckle.lookAt(16, 2.0, 9);
  g.add(buckle);
  g.scale.set(0.901, 1.068, 1.058);
  g.position.set(0, 7.90, -4.70);
  g.rotation.x = -0.102;
  // occlusore "testa + capelli" dentro il cappello (solo profondità, invisibile): nell'app l'occlusore del cranio è
  // piccolo all'altezza della tesa e i capelli veri non nascondono nulla, quindi vista dal basso si vedrebbe il retro
  // della tesa/fascia attraverso la fronte. Nell'harness di sviluppo (h.preview) è marrone = capelli.
  { const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), h.preview ? h.mat(0x4a3526, { roughness: 1 }) : new THREE.MeshBasicMaterial({ colorWrite: false }));
    occ.scale.set(8.0, 6, 8.0); occ.position.set(0, -2.5, 0); occ.renderOrder = -1; occ.name = 'headOccluder'; g.add(occ); }
  // occlusori nello spazio del viso (1.8.0): testa grande/calva inclinata in giù e viso davanti alle parti posteriori
  const root = new THREE.Group(); root.add(g); root.userData = g.userData;   // update() legge userData dal gruppo restituito
  root.add(faceOccluder(THREE, h, 0.2));
  return hatFit(THREE, h, afterFace(finish(THREE, root)), g, { rimY: 0.0, face: false });
}
