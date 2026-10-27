// Tocco da laurea: calotta nera, tavola quadrata con bottone e nappa dorata che pende sul lato.
// 1.8.9: calzato sulla testa vera: fascia ovale come una testa, più indietro e più in basso (prima davanti e ai lati
// restava 1–2 cm sopra la testa e dietro ci entrava); riempitivo invisibile con la forma della testa vera, tappo
// sull'apertura e fodera scura (hatFit in glb/_glbhead.js).
import { finish, headOccluder, faceOccluder, afterFace } from './_kit_acc.js';
import { hatFit } from '../glb/_glbhead.js';
export const meta = { label: 'Tocco di laurea', labelEn: 'Graduation cap', category: 'costumi', icon: '🎓' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const cloth = h.mat(0x16161c, { roughness: .9 });
  const gold = h.mat(0xe2b73c, { roughness: .55, metalness: .3 });
  const lathe = (pts, seg = 64) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg);

  // calotta che calza il cranio
  g.add(new THREE.Mesh(lathe([[8.7, -1.0], [8.8, 1.5], [8.4, 3.5], [7.4, 5.0], [5.5, 6.0], [0, 6.3]]), cloth));
  // bordino
  g.add(new THREE.Mesh(lathe([[8.95, -1.05], [8.95, 0.2], [8.6, 0.2], [8.6, -1.05], [8.95, -1.05]]), h.mat(0x24242c, { roughness: .8 })));

  // tavola quadrata (un angolo in avanti), leggermente in rilievo con un bordo
  const board = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(22, 0.6, 22), cloth);
  const under = new THREE.Mesh(new THREE.BoxGeometry(19, 0.6, 19), cloth); under.position.y = -0.5;
  board.add(top, under);
  board.rotation.y = Math.PI / 4;
  board.position.y = 6.3;
  g.add(board);
  // bottone centrale
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.5, 20), cloth); btn.position.y = 6.75; g.add(btn);

  // nappa: cordone dal bottone al bordo destro, poi pende
  const cordPts = [[0, 7.0, 0], [4.0, 6.95, 0.1], [9.0, 6.8, 0.3], [13.5, 6.7, 0.5], [15.4, 6.3, 0.6], [15.9, 5.3, 0.6], [15.8, 3.6, 0.5]];
  const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cordPts.map(p => new THREE.Vector3(...p)), false, 'catmullrom', .5), 48, 0.22, 8), gold);
  g.add(cord);
  const tassel = new THREE.Group();
  const knot = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.2, 16), gold); knot.position.y = 3.0;
  tassel.add(knot);
  // fili: cilindri sottili leggermente divergenti
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2, rr = 0.25 + (i % 3) * 0.18;
    const th = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 5.2, 6), gold);
    th.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr);
    th.rotation.z = Math.cos(a) * 0.12; th.rotation.x = -Math.sin(a) * 0.12;
    tassel.add(th);
  }
  tassel.position.set(15.8, 0, 0.5);
  g.add(tassel);
  // anno in metallo sul cordone
  const tag = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.2), h.mat(0xd9c27a, { roughness: .3, metalness: .9 })); tag.position.set(15.8, 4.6, 0.75); g.add(tag);
  g.scale.set(0.913, 1.048, 1.145);
  g.position.set(0, 6.90, -4.67);
  g.rotation.x = -0.181;
  g.userData.tassel = tassel;
  // occlusore "testa + capelli" dentro il cappello (solo profondità, invisibile): nell'app l'occlusore del cranio è
  // piccolo all'altezza della tesa e i capelli veri non nascondono nulla, quindi vista dal basso si vedrebbe il retro
  // della tesa/fascia attraverso la fronte. Nell'harness di sviluppo (h.preview) è marrone = capelli.
  { const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), h.preview ? h.mat(0x4a3526, { roughness: 1 }) : new THREE.MeshBasicMaterial({ colorWrite: false }));
    occ.scale.set(8.2, 6, 8.2); occ.position.set(0, -3.0, 0); occ.renderOrder = -1; occ.name = 'headOccluder'; g.add(occ); }
  // occlusori nello spazio del viso (1.8.0): testa grande/calva inclinata in giù e viso davanti alle parti posteriori
  const root = new THREE.Group(); root.add(g); root.userData = g.userData;   // update() legge userData dal gruppo restituito
  root.add(faceOccluder(THREE, h, 0.2));
  return hatFit(THREE, h, afterFace(finish(THREE, root)), g, { rimY: -1.06, face: false });
}

export function update(g, bs, t) {
  const ts = g.userData.tassel; if (!ts) return;
  ts.rotation.z = Math.sin(t * 2.1) * 0.08; ts.rotation.x = Math.cos(t * 1.7) * 0.06;
}
