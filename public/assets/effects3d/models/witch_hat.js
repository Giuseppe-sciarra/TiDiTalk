// Cappello da strega: cono nero con la punta ricurva, tesa larga, fascia viola con fibbia dorata.
export const meta = { label: 'Cappello da strega', labelEn: 'Witch hat', category: 'costumi', icon: '🧙‍♀️' };

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

export default function build(THREE, h) {
  const g = new THREE.Group();
  const cloth = h.mat(0x151418, { roughness: .95 });
  const lathe = (pts, seg = 56) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg);

  // cono alto, punta che si ripiega all'indietro e in giù con una piccola "gobba"
  const spine = [[0, 0, 0], [0, 8, 0], [0.2, 14, -0.2], [0.4, 19, -1.2], [0.3, 22.5, -3.5], [-0.5, 23.8, -6.5], [-1.6, 23.0, -9.5]];
  g.add(new THREE.Mesh(tubeVar(THREE, spine, t => 8.5 * Math.pow(1 - t, 1.1) + 0.04, 60, 40), cloth));
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), cloth); tip.position.set(-1.6, 23.0, -9.5); g.add(tip);
  g.add(new THREE.Mesh(new THREE.CircleGeometry(8.5, 48), cloth).rotateX(Math.PI / 2));

  // tesa larga, leggermente ondulata, bordo arrotondato
  const R0 = 7.8, R1 = 16;
  const brimGeo = lathe([[R0, 0.2], [R1, 0.05], [R1 + 0.2, 0.35], [R1, 0.65], [R0, 0.8], [R0, 0.2]], 80);
  const q = brimGeo.attributes.position;
  for (let i = 0; i < q.count; i++) {
    const x = q.getX(i), z = q.getZ(i), r = Math.hypot(x, z), th = Math.atan2(z, x);
    const f = Math.max(0, (r - R0) / (R1 - R0));
    q.setY(i, q.getY(i) + (0.8 * Math.sin(2 * th + 1.1) + 0.4 * Math.sin(5 * th) + 0.5) * f * f);
  }
  brimGeo.computeVertexNormals();
  g.add(new THREE.Mesh(brimGeo, cloth));

  // fascia viola e fibbia dorata quadrata davanti
  g.add(new THREE.Mesh(lathe([[8.6, 0.6], [8.55, 3.0], [8.0, 3.0], [8.0, 0.6], [8.6, 0.6]]), h.mat(0x5b2a86, { roughness: .6 })));
  const gold = h.mat(0xd4a93a, { roughness: .3, metalness: .9 });
  const sq = new THREE.Shape(); sq.moveTo(-1.5, -1.3); sq.lineTo(1.5, -1.3); sq.lineTo(1.5, 1.3); sq.lineTo(-1.5, 1.3); sq.closePath();
  const hole = new THREE.Path(); hole.moveTo(-0.9, -0.7); hole.lineTo(0.9, -0.7); hole.lineTo(0.9, 0.7); hole.lineTo(-0.9, 0.7); hole.closePath(); sq.holes.push(hole);
  const buckle = new THREE.Mesh(new THREE.ExtrudeGeometry(sq, { depth: 0.35, bevelEnabled: true, bevelSize: .08, bevelThickness: .08, bevelSegments: 2 }), gold);
  buckle.position.set(0, 1.95, 8.45); buckle.lookAt(0, 2.2, 20);
  const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.6, 0.22), gold); tongue.position.set(0.4, 1.95, 8.75); g.add(buckle, tongue);

  g.position.set(0, 8.6, -2.2);
  g.rotation.x = -0.1;
  // occlusore "testa + capelli" dentro il cappello (solo profondità, invisibile): nell'app l'occlusore del cranio è
  // piccolo all'altezza della tesa e i capelli veri non nascondono nulla, quindi vista dal basso si vedrebbe il retro
  // della tesa/fascia attraverso la fronte. Nell'harness di sviluppo (h.preview) è marrone = capelli.
  { const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), h.preview ? h.mat(0x4a3526, { roughness: 1 }) : new THREE.MeshBasicMaterial({ colorWrite: false }));
    occ.scale.set(7.5, 6, 7.5); occ.position.set(0, -2.5, 0); occ.renderOrder = -1; occ.name = 'headOccluder'; g.add(occ); }
  return g;
}
