// Coroncina di fiori: ghirlanda di foglie e fiorellini pastello che cinge la testa.
import { finish, headOccluder, faceOccluder, afterFace } from './_kit_acc.js';
export const meta = { label: 'Coroncina di fiori', labelEn: 'Flower crown', category: 'costumi', icon: '🌸' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const vine = h.mat(0x5f7d3a, { roughness: .9 });
  const leafMat = h.mat(0x6fae5c, { roughness: .9 });
  const leafMat2 = h.mat(0x4f8f45, { roughness: .9 });
  const R = 8.6;

  // tralcio: anello leggermente ondulato
  const pts = [];
  for (let i = 0; i < 72; i++) { const a = i / 72 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * (R + 0.15 * Math.sin(a * 5)), 0.4 * Math.sin(a * 3), Math.sin(a) * (R + 0.15 * Math.sin(a * 5)))); }
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 144, 0.3, 8, true), vine));

  // foglie lungo il tralcio
  const leafGeo = new THREE.SphereGeometry(1, 10, 8);
  for (let i = 0; i < 40; i++) {
    const a = i / 40 * Math.PI * 2 + 0.07;
    const side = i % 2 ? 1 : -1;
    const leaf = new THREE.Mesh(leafGeo, i % 3 ? leafMat : leafMat2);
    leaf.scale.set(2.0, 0.25, 1.0);
    leaf.position.set(Math.cos(a) * (R + 0.4 * side), 0.4 * Math.sin(a * 3) + 0.15 * side, Math.sin(a) * (R + 0.4 * side));
    leaf.rotation.y = -a + (side > 0 ? 0.55 : -0.55); leaf.rotation.z = side * 0.35;
    g.add(leaf);
  }

  // fiori: margherite e fiorellini di vari colori
  const cols = [0xff9db5, 0xffffff, 0xffd166, 0xb8a1ff, 0xff7f6b, 0xfff0a8];
  const flower = (a, col, sc, petals) => {
    const f = new THREE.Group();
    for (let i = 0; i < petals; i++) {
      const pt = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), h.mat(col, { roughness: .85 }));
      pt.scale.set(1.15, 0.35, 0.65); const pa = i / petals * Math.PI * 2; pt.position.set(Math.cos(pa) * 0.75, 0, Math.sin(pa) * 0.75); pt.rotation.y = -pa;
      f.add(pt);
    }
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), h.mat(0xffcc33, { roughness: .7 })); c.position.y = 0.18; f.add(c);
    const r = R + 0.55;
    f.position.set(Math.cos(a) * r, 0.4 * Math.sin(a * 3) + 0.3, Math.sin(a) * r);
    f.lookAt(Math.cos(a) * 40, 10, Math.sin(a) * 40); f.rotateX(Math.PI / 2);
    f.scale.setScalar(sc);
    return f;
  };
  const N = 13;
  for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 2 + Math.PI / 2 + 0.15;
    g.add(flower(a, cols[i % cols.length], 1.2 + (i % 3) * 0.25, 5 + (i % 2)));
  }
  // qualche bocciolo piccolo tra i fiori
  for (let i = 0; i < N; i++) {
    const a = (i + 0.5) / N * Math.PI * 2 + Math.PI / 2 + 0.15;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), h.mat(cols[(i + 2) % cols.length], { roughness: .85 }));
    b.position.set(Math.cos(a) * (R + 0.5), 0.4 * Math.sin(a * 3) + 0.55, Math.sin(a) * (R + 0.5)); g.add(b);
  }

  g.position.set(0, 8.9, -2.3);
  g.rotation.x = -0.2;
  // occlusore "testa + capelli" dentro il cappello (solo profondità, invisibile): nell'app l'occlusore del cranio è
  // piccolo all'altezza della tesa e i capelli veri non nascondono nulla, quindi vista dal basso si vedrebbe il retro
  // della tesa/fascia attraverso la fronte. Nell'harness di sviluppo (h.preview) è marrone = capelli.
  { const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), h.preview ? h.mat(0x4a3526, { roughness: 1 }) : new THREE.MeshBasicMaterial({ colorWrite: false }));
    occ.scale.set(8.1, 5, 8.1); occ.position.set(0, -2.5, 0); occ.renderOrder = -1; occ.name = 'headOccluder'; g.add(occ); }
  // occlusori nello spazio del viso (1.8.0): testa grande/calva inclinata in giù e viso davanti alle parti posteriori
  const root = new THREE.Group(); root.add(g); root.userData = g.userData;   // update() legge userData dal gruppo restituito
  root.add(headOccluder(THREE, h, { scale: [8.1, 10.0, 9.3], center: [0, 2.6, -4.3] }));
  root.add(faceOccluder(THREE, h, 0.2));
  return afterFace(finish(THREE, root));
}
