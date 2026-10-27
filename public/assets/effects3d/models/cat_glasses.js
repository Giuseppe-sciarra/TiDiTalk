// Gattina con occhiali (combo stile Meet): orecchie da gatto nere su cerchietto + occhiali cat-eye neri con punte dorate.
// 1.8.9: il cerchietto segue la calotta del cranio vero del motore (appoggia sulla testa vera, calva o con i capelli).
import { finish, lens, plastic } from './_kit_acc.js';
export const meta = { label: 'Gattina con occhiali', labelEn: 'Cat ears & cat-eye glasses', category: 'costumi', icon: '😼' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const fur = h.mat(0x24222a, { roughness: .95 });
  const pink = h.mat(0xf0a2b4, { roughness: .9 });
  const black = plastic(THREE, 0x141416, 0.50);
  const gold = h.mat(0xd9b24a, { roughness: .25, metalness: .95 });

  // cerchietto + orecchie da gatto
  const band = [];
  // 1.8.9: l'arco segue la calotta del cranio vero (HEAD.cranium del motore) 4,5 mm fuori: sopra un cerchio di raggio
  // 7,98 attorno a (0, 5,6), ai lati scende dritto fino a y = 1 (prima a metà altezza entrava di ~4 mm nella testa vera)
  band.push(new THREE.Vector3(7.9, 1.0, -3.0), new THREE.Vector3(7.98, 3.3, -3.0));
  for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI; band.push(new THREE.Vector3(Math.cos(a) * 7.98, 5.6 + Math.sin(a) * 7.98, -3.0)); }
  band.push(new THREE.Vector3(-7.98, 3.3, -3.0), new THREE.Vector3(-7.9, 1.0, -3.0));
  const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(band), 72, 0.35, 10);
  { const p = tg.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, -3.0 + (p.getZ(i) + 3.0) * 1.6); tg.computeVertexNormals(); }
  g.add(new THREE.Mesh(tg, fur));
  const tri = (w, hgt, round) => { const s = new THREE.Shape(); s.moveTo(-w, 0); s.lineTo(w, 0); s.quadraticCurveTo(w * 0.55, hgt * 0.55, round, hgt); s.quadraticCurveTo(-round, hgt, -w * 0.55, hgt * 0.55); s.closePath(); return s; };
  const ears = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Group();
    const outer = new THREE.Mesh(new THREE.ExtrudeGeometry(tri(3.3, 6.0, 0.35), { depth: 1.0, bevelEnabled: true, bevelSize: .35, bevelThickness: .3, bevelSegments: 3, curveSegments: 12 }), fur); outer.position.z = -0.5;
    const inner = new THREE.Mesh(new THREE.ExtrudeGeometry(tri(2.0, 4.0, 0.25), { depth: 0.3, bevelEnabled: true, bevelSize: .15, bevelThickness: .1, bevelSegments: 2, curveSegments: 12 }), pink); inner.position.set(0, 0.7, 0.45);
    e.add(outer, inner);
    e.position.set(s * 4.6, 11.4, -3.0); e.rotation.z = -s * 0.42; e.rotation.y = s * 0.35; e.rotation.x = -0.1;
    g.add(e); ears.push(e);
  }
  // occhiali cat-eye: montatura spessa con le punte esterne rialzate
  const lensMat = lens(THREE, 0x1a1626, 0.6, { side: THREE.DoubleSide });
  const catEye = (s, k) => {
    const sh = new THREE.Shape(), P = [];
    for (let i = 0; i <= 48; i++) {
      const a = i / 48 * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
      let x = c * 2.9 * k, y = sn * 2.0 * k * (sn > 0 ? 0.9 : 1.05);
      const outer = Math.max(0, c * s);                         // lato esterno (verso la tempia)
      y += 1.1 * k * Math.pow(outer, 3) * Math.max(0, sn + 0.4);  // punta all'insù
      x += 0.5 * k * Math.pow(outer, 4) * Math.max(0, sn);
      P.push(new THREE.Vector2(x, y));
    }
    sh.setFromPoints(P); return sh;
  };
  for (const s of [-1, 1]) {
    const L = new THREE.Group();
    const o = catEye(s, 1.0); o.holes.push(new THREE.Path(catEye(s, 0.78).getPoints(48)));
    const fr = new THREE.Mesh(new THREE.ExtrudeGeometry(o, { depth: 0.45, bevelEnabled: true, bevelSize: .1, bevelThickness: .1, bevelSegments: 2, curveSegments: 6 }), black); fr.position.z = -0.22; L.add(fr);
    L.add(new THREE.Mesh(new THREE.ShapeGeometry(catEye(s, 0.8), 6), lensMat));
    // brillantini dorati sulla punta
    for (let i = 0; i < 3; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), gold); d.position.set(s * (2.2 + i * 0.42), 1.25 + i * 0.32, 0.35); L.add(d); }
    L.position.set(s * 3.2, 2.65, 5.8); L.rotation.y = s * 0.22; g.add(L);
  }
  const bridge = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.26, 10, 20, Math.PI), black); bridge.position.set(0, 3.0, 5.85); g.add(bridge);
  for (const s of [-1, 1]) {
    const pts = [[s * 6.1, 3.6, 4.9], [s * 6.8, 3.4, 4.1], [s * 7.3, 2.9, 1.2], [s * 7.5, 2.3, -1.6], [s * 7.5, 1.9, -2.6], [s * 7.3, 0.8, -4.0]];
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 32, 0.22, 8), black));
  }
  { const f = h.face, geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(Array.from(f.pos), 3)); geo.setIndex(Array.from(f.idx)); geo.computeVertexNormals();
    const pp = geo.attributes.position, nn = geo.attributes.normal;
    for (let i = 0; i < pp.count; i++) pp.setXYZ(i, pp.getX(i) - nn.getX(i) * 0.3, pp.getY(i) - nn.getY(i) * 0.3, pp.getZ(i) - nn.getZ(i) * 0.3);
    const occ = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false })); occ.renderOrder = -1; occ.name = 'faceOccluder'; g.add(occ); }
  g.userData.ears = ears;
  return finish(THREE, g);
}

export function update(g, bs, t) {
  const [a, b] = g.userData.ears;
  const wig = Math.sin(t * 2.4) * 0.04, smile = ((bs.mouthSmileLeft || 0) + (bs.mouthSmileRight || 0)) / 2;
  a.rotation.z = 0.42 + wig + smile * 0.2; b.rotation.z = -0.42 - wig - smile * 0.2;
}
