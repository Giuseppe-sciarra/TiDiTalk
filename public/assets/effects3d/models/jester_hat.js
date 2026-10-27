// Cappello da giullare: calotta con fascia a rombi, tre punte morbide ricadenti (rosso, viola, giallo) con sonagli dorati che dondolano.
// 1.8.9: calzato sulla testa vera: fascia ovale come una testa, più indietro e più in basso (prima davanti e ai lati
// restava 1–2 cm sopra la testa e dietro ci entrava); riempitivo invisibile con la forma della testa vera, tappo
// sull'apertura e fodera scura (hatFit in glb/_glbhead.js).
import { finish, headOccluder, faceOccluder, afterFace } from './_kit_acc.js';
import { hatFit } from '../glb/_glbhead.js';
export const meta = { label: 'Cappello da giullare', labelEn: 'Jester hat', category: 'costumi', icon: '🃏' };

function tubeVar(THREE, pts, rFn, segs = 48, radial = 24) {
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
  geo.setIndex(I); geo.computeVertexNormals(); return { geo, curve };
}

export default function build(THREE, h) {
  const g = new THREE.Group();
  const red = h.mat(0xb8202e, { roughness: .8 }), purple = h.mat(0x5b2a8a, { roughness: .8 }), yellow = h.mat(0xe8a812, { roughness: .8 });
  const gold = h.mat(0xd9b24a, { roughness: .3, metalness: .9 });
  const lathe = (pts, seg = 96) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg);

  // calotta (metà rossa, metà viola: colori per vertice in base al lato)
  const cap = lathe([[8.7, 0], [8.9, 2.5], [8.4, 5.2], [7.0, 7.4], [4.6, 8.9], [0, 9.4]]);
  const cp = cap.attributes.position, col = [], cR = new THREE.Color(0xb8202e), cP = new THREE.Color(0x5b2a8a);
  for (let i = 0; i < cp.count; i++) { const c = cp.getX(i) >= 0 ? cR : cP; col.push(c.r, c.g, c.b); }
  cap.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.add(new THREE.Mesh(cap, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8 })));

  // fascia a rombi (texture) con bordo a punte
  const c = document.createElement('canvas'); c.width = 512; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#e8a812'; x.fillRect(0, 0, 512, 64);
  for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? '#5b2a8a' : '#b8202e'; x.beginPath(); x.moveTo(i * 32, 32); x.lineTo(i * 32 + 16, 4); x.lineTo(i * 32 + 32, 32); x.lineTo(i * 32 + 16, 60); x.closePath(); x.fill(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(2, 1);
  const band = new THREE.Mesh(lathe([[9.15, -0.5], [9.2, 2.3], [8.7, 2.3], [8.7, -0.5], [9.15, -0.5]]), new THREE.MeshStandardMaterial({ map: tex, roughness: .7 }));
  g.add(band);
  // punte del bordo (piccoli triangoli che ricadono sulla fronte) con sonaglini
  const bells = [];
  const bell = (r) => { const b = new THREE.Group(); const s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), gold); const slit = new THREE.Mesh(new THREE.TorusGeometry(r * 0.98, r * 0.08, 6, 20), h.mat(0x5a4510, { roughness: .6 })); slit.rotation.x = Math.PI / 2; b.add(s, slit); return b; };

  // tre punte morbide: sinistra, destra e una dietro-centro; partono dalla calotta, salgono e ricadono
  const horns = [
    { pts: [[3.0, 6.8, 0.6], [6.5, 9.6, 0.4], [10.0, 11.0, -0.4], [13.0, 9.6, -1.0], [14.6, 6.6, -1.2]], m: red },
    { pts: [[-3.0, 6.8, 0.6], [-6.5, 9.6, 0.4], [-10.0, 11.0, -0.4], [-13.0, 9.6, -1.0], [-14.6, 6.6, -1.2]], m: yellow },
    { pts: [[0, 7.6, -2.5], [0.4, 11.8, -3.6], [0.8, 14.8, -6.0], [0.9, 15.0, -9.2], [0.9, 12.8, -11.2]], m: purple },
  ];
  for (const hn of horns) {
    const { geo, curve } = tubeVar(THREE, hn.pts, t => 3.4 * Math.pow(1 - t, 1.2) + 0.25, 48, 24);
    g.add(new THREE.Mesh(geo, hn.m));
    const end = curve.getPointAt(1), b = bell(0.85); b.position.copy(end).add(new THREE.Vector3(0, -0.75, 0));
    const holder = new THREE.Group(); holder.position.copy(end); b.position.set(0, -0.8, 0); holder.add(b); g.add(holder); bells.push(holder);
  }
  g.scale.set(0.920, 1.000, 1.051);
  g.position.set(0, 7.85, -4.50);
  g.rotation.x = -0.100;
  { const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), h.preview ? h.mat(0x4a3526, { roughness: 1 }) : new THREE.MeshBasicMaterial({ colorWrite: false }));
    occ.scale.set(8.2, 5, 8.2); occ.position.set(0, -2.0, 0); occ.renderOrder = -1; occ.name = 'headOccluder'; g.add(occ); }
  g.userData.bells = bells;
  // occlusori nello spazio del viso (1.8.0): testa grande/calva inclinata in giù e viso davanti alle parti posteriori
  const root = new THREE.Group(); root.add(g); root.userData = g.userData;   // update() legge userData dal gruppo restituito
  root.add(faceOccluder(THREE, h, 0.2));
  return hatFit(THREE, h, afterFace(finish(THREE, root)), g, { rimY: -0.5, face: false });
}

export function update(g, bs, t) {
  g.userData.bells.forEach((b, i) => { b.rotation.z = Math.sin(t * 3.2 + i * 1.7) * 0.25; b.rotation.x = Math.cos(t * 2.6 + i) * 0.15; });
}
