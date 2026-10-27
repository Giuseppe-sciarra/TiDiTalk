// Casco da cantiere giallo: calotta con nervature, visierina frontale, tesa tutt'attorno.
// 1.8.9: calzato sulla testa vera: fascia ovale come una testa, più indietro e più in basso (prima davanti e ai lati
// restava 1–2 cm sopra la testa e dietro ci entrava); riempitivo invisibile con la forma della testa vera, tappo
// sull'apertura e fodera scura (hatFit in glb/_glbhead.js).
import { finish, headOccluder, faceOccluder, afterFace } from './_kit_acc.js';
import { hatFit } from '../glb/_glbhead.js';
export const meta = { label: 'Casco da cantiere', labelEn: 'Hard hat', category: 'costumi', icon: '👷' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const plastic = h.mat(0xf5c518, { roughness: .32, metalness: .05 });
  const lathe = (pts, seg = 72) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg);

  // calotta
  g.add(new THREE.Mesh(lathe([[8.9, 0], [9.2, 2.0], [9.0, 4.5], [8.2, 7.0], [6.6, 9.0], [4.2, 10.3], [1.8, 10.9], [0, 11.0]]), plastic));

  // tesa: anello attorno, più lungo davanti (visierina) e con una gronda ai lati
  const R0 = 8.5;
  const brimGeo = lathe([[R0, -0.3], [10.4, -0.8], [10.6, -0.4], [10.4, 0.0], [R0, 0.3], [R0, -0.3]], 96);
  const bp = brimGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i), z = bp.getZ(i), r = Math.hypot(x, z);
    if (r < R0 + 0.01) continue;
    const th = Math.atan2(z, x);
    const front = Math.max(0, Math.sin(th));
    const ext = 1 + 1.9 * Math.pow(front, 3);             // davanti si allunga (visierina)
    const k = (R0 + (r - R0) * ext) / r;
    bp.setXYZ(i, x * k, bp.getY(i) - 0.9 * Math.pow(front, 3) * ((r - R0) / 1.9), z * k);
  }
  brimGeo.computeVertexNormals();
  g.add(new THREE.Mesh(brimGeo, plastic));

  // raggio della calotta a una certa altezza (interpolazione del profilo)
  const prof = [[8.9, 0], [9.2, 2.0], [9.0, 4.5], [8.2, 7.0], [6.6, 9.0], [4.2, 10.3], [1.8, 10.9], [0, 11.0]];
  const domeR = (y) => {
    for (let i = 1; i < prof.length; i++) if (y <= prof[i][1]) { const t = (y - prof[i - 1][1]) / (prof[i][1] - prof[i - 1][1]); return prof[i - 1][0] + (prof[i][0] - prof[i - 1][0]) * t; }
    return 0;
  };
  const onDome = (th, y, off = 0.25) => { const r = domeR(y) + off; return new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r); };
  // nervatura centrale davanti-dietro sulla sommità (da y≈7 davanti a y≈7 dietro)
  const ribPts = [];
  for (let i = 0; i <= 36; i++) {
    const ang = (i / 36 - 0.5) * 1.45;                        // -41° dietro … +41° davanti
    const y = 1.5 + Math.cos(ang) * 9.5;
    const r = Math.abs(Math.sin(ang)) * (domeR(Math.min(10.99, y)) + 0.3);
    ribPts.push(new THREE.Vector3(0, Math.min(11.25, y + 0.25 * (1 - Math.abs(Math.sin(ang)))), Math.sign(Math.sin(ang) || 1) * r));
  }
  const rib = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ribPts), 64, 0.5, 10), plastic);
  rib.scale.set(1.5, 1, 1); g.add(rib);
  // due nervature laterali corte che seguono la calotta
  for (const s of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 24; i++) { const th = (s > 0 ? 0 : Math.PI) + (i / 24 - 0.5) * 1.5; pts.push(onDome(th, 6.0 + 0.4 * Math.cos((i / 24 - 0.5) * Math.PI), 0.22)); }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.38, 8), plastic));
  }

  // targhetta frontale
  const tag = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.0, 0.25), h.mat(0xe8e8e8, { roughness: .5 }));
  tag.position.copy(onDome(Math.PI / 2, 4.6, 0.05)); tag.rotation.x = -0.12; g.add(tag);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 0.3), h.mat(0x2b2b2b, { roughness: .6 }));
  stripe.position.copy(onDome(Math.PI / 2, 4.85, 0.1)); stripe.rotation.x = -0.12; g.add(stripe);
  g.scale.set(0.919, 1.056, 1.092);
  g.position.set(0, 7.38, -4.53);
  g.rotation.x = -0.131;
  // occlusore "testa + capelli" dentro il cappello (solo profondità, invisibile): nell'app l'occlusore del cranio è
  // piccolo all'altezza della tesa e i capelli veri non nascondono nulla, quindi vista dal basso si vedrebbe il retro
  // della tesa/fascia attraverso la fronte. Nell'harness di sviluppo (h.preview) è marrone = capelli.
  { const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), h.preview ? h.mat(0x4a3526, { roughness: 1 }) : new THREE.MeshBasicMaterial({ colorWrite: false }));
    occ.scale.set(8.2, 6, 8.2); occ.position.set(0, -2.5, 0); occ.renderOrder = -1; occ.name = 'headOccluder'; g.add(occ); }
  // occlusori nello spazio del viso (1.8.0): testa grande/calva inclinata in giù e viso davanti alle parti posteriori
  const root = new THREE.Group(); root.add(g); root.userData = g.userData;   // update() legge userData dal gruppo restituito
  root.add(faceOccluder(THREE, h, 0.2));
  return hatFit(THREE, h, afterFace(finish(THREE, root)), g, { rimY: 0.0, face: false });
}
