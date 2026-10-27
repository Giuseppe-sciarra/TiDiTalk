// Cappello di Babbo Natale: cono rosso morbido che ricade di lato, bordo di pelliccia bianca e pompon.
// 1.8.9: calzato sulla testa vera: fascia ovale come una testa, più indietro e più in basso (prima davanti e ai lati
// restava 1–2 cm sopra la testa e dietro ci entrava); riempitivo invisibile con la forma della testa vera, tappo
// sull'apertura e fodera scura (hatFit in glb/_glbhead.js);
// tolto il fondo chiuso/disco sotto la cupola: da sotto si vedeva come un coperchio.
import { afterFace, faceOccluder, felt, fiberBump, finish, headOccluder } from './_kit_acc.js';
import { hatFit } from '../glb/_glbhead.js';
export const meta = { label: 'Cappello di Babbo Natale', labelEn: 'Santa hat', category: 'costumi', icon: '🎅' };

function tubeVar(THREE, pts, rFn, segs = 48, radial = 32) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)), false, 'catmullrom', 0.5);
  const fr = curve.computeFrenetFrames(segs, false);
  const P = [], UV = [], I = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, c = curve.getPointAt(t), r = rFn(t), n = fr.normals[i], b = fr.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = j / radial * Math.PI * 2, cx = Math.cos(a), sx = Math.sin(a);
      P.push(c.x + r * (cx * n.x + sx * b.x), c.y + r * (cx * n.y + sx * b.y), c.z + r * (cx * n.z + sx * b.z));
      UV.push(j / radial, t);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; I.push(a, a + 1, b, b, a + 1, b + 1); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  geo.setIndex(I); geo.computeVertexNormals(); return geo;
}

function fluffy(THREE, geo, amp, freq) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = amp * (Math.sin(x * freq + y * freq * 0.7) * Math.cos(z * freq * 0.9 - y * freq * 0.5) + 0.5 * Math.sin(x * freq * 2.1 + z * freq * 1.7));
    const nx = geo.attributes.normal ? geo.attributes.normal.getX(i) : x, ny = geo.attributes.normal ? geo.attributes.normal.getY(i) : y, nz = geo.attributes.normal ? geo.attributes.normal.getZ(i) : z;
    p.setXYZ(i, x + nx * n, y + ny * n, z + nz * n);
  }
  geo.computeVertexNormals();
  return geo;
}

export default function build(THREE, h) {
  const g = new THREE.Group();
  const velvet = felt(THREE, 0x8c0e18, [10, 6], { sheen: 0.7, sheenRoughness: 0.4, sheenColor: new THREE.Color(0xd8404e) });
  // pelliccia sintetica: panna (non bianco puro: con le luci dell'app brucia e perde volume), lucentezza da pelo
  const fur = new THREE.MeshPhysicalMaterial({ color: 0xd9d2c6, roughness: 1, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(0xffffff), envMapIntensity: 0.3 }); fiberBump(fur, 0.8, 2.2);

  // cono che sale e poi ricade sul lato destro (+X) con la punta in giù
  const spine = [[0, 0, 0], [0, 6, 0], [0.8, 11, -0.6], [3.5, 15, -1.6], [8.0, 15.8, -2.4], [12.0, 13.0, -2.4], [13.6, 9.0, -1.8]];
  g.add(new THREE.Mesh(tubeVar(THREE, spine, t => 8.7 * Math.pow(1 - t, 1.25) + 0.25, 64, 40), velvet));

  // bordo di pelliccia: toro spesso con superficie "pelosa"
  const trimGeo = fluffy(THREE, new THREE.TorusGeometry(8.9, 2.0, 24, 96), 0.22, 2.2);
  const trim = new THREE.Mesh(trimGeo, fur); trim.rotation.x = Math.PI / 2; trim.position.y = 0.3;
  g.add(trim);

  // pompon in punta
  const pomGeo = fluffy(THREE, new THREE.SphereGeometry(2.3, 32, 24), 0.3, 2.6);
  const pom = new THREE.Mesh(pomGeo, fur); pom.position.set(13.8, 7.6, -1.7); g.add(pom);
  g.scale.set(0.944, 1.000, 1.100);
  g.position.set(0, 10.55, -4.90);
  g.rotation.x = -0.029;
  g.userData.pom = pom;
  // occlusore "testa + capelli" dentro il cappello (solo profondità, invisibile): nell'app l'occlusore del cranio è
  // piccolo all'altezza della tesa e i capelli veri non nascondono nulla, quindi vista dal basso si vedrebbe il retro
  // della tesa/fascia attraverso la fronte. Nell'harness di sviluppo (h.preview) è marrone = capelli.
  { const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), h.preview ? h.mat(0x4a3526, { roughness: 1 }) : new THREE.MeshBasicMaterial({ colorWrite: false }));
    occ.scale.set(7.8, 6, 7.8); occ.position.set(0, -2.5, 0); occ.renderOrder = -1; occ.name = 'headOccluder'; g.add(occ); }
  // occlusori nello spazio del viso (1.8.0): testa grande/calva inclinata in giù e viso davanti alle parti posteriori
  const root = new THREE.Group(); root.add(g); root.userData = g.userData;   // update() legge userData dal gruppo restituito
  root.add(faceOccluder(THREE, h, 0.2));
  return hatFit(THREE, h, afterFace(finish(THREE, root)), g, { rimY: 0.0, face: false });
}

export function update(g, bs, t) {
  const p = g.userData.pom; if (!p) return;
  p.position.x = 13.8 + Math.sin(t * 1.8) * 0.25; p.position.y = 7.6 + Math.cos(t * 2.3) * 0.15;
}
