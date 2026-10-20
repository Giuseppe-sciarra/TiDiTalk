// Coniglietto con occhiali (combo stile Meet): cerchietto con orecchie da coniglio + occhiali tondi rosa con lenti chiare
// e nasino rosa.
export const meta = { label: 'Coniglietto con occhiali', labelEn: 'Bunny ears & glasses', category: 'costumi', icon: '🐇' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const white = h.mat(0xece6df, { roughness: .95 });
  const pink = h.mat(0xe9849f, { roughness: .9 });
  const frameMat = new THREE.MeshPhysicalMaterial({ color: 0xe25d8f, roughness: .25, clearcoat: 1 });

  // cerchietto sopra i capelli
  const band = [];
  for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI; band.push(new THREE.Vector3(Math.cos(a) * 8.6, 1.0 + Math.sin(a) * 12.8, -3.0)); }
  const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(band), 72, 0.35, 10);
  { const p = tg.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, -3.0 + (p.getZ(i) + 3.0) * 1.6); tg.computeVertexNormals(); }
  g.add(new THREE.Mesh(tg, h.mat(0xe07a98, { roughness: .5 })));
  // orecchie (una diritta, una piegata), interno rosa
  const ears = [];
  for (const [s, bend] of [[1, 0], [-1, -0.9]]) {
    const e = new THREE.Group();
    for (const [m, sc, pos] of [[white, [2.3, 7.6, 0.9], [0, 7.0, 0]], [pink, [1.35, 5.8, 0.5], [0, 7.3, 0.55]]]) {
      const geo = new THREE.SphereGeometry(1, 24, 32); geo.scale(...sc); geo.translate(...pos);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < 8) continue; const t = (y - 8) / 6.6, ang = bend * t * t, x = p.getX(i), yy = y - 8; p.setXY(i, x * Math.cos(ang) - yy * Math.sin(ang), 8 + x * Math.sin(ang) + yy * Math.cos(ang)); }
      geo.computeVertexNormals(); e.add(new THREE.Mesh(geo, m));
    }
    e.position.set(s * 3.6, 12.2, -3.0); e.rotation.z = -s * 0.22; e.rotation.x = -0.12;
    g.add(e); ears.push(e);
  }
  // occhiali tondi rosa
  const lensMat = new THREE.MeshPhysicalMaterial({ color: 0xffe0ec, roughness: .03, transparent: true, opacity: .15, clearcoat: 1, side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    const L = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.32, 12, 48), frameMat); L.add(rim);
    L.add(new THREE.Mesh(new THREE.CircleGeometry(2.6, 40), lensMat));
    L.position.set(s * 3.15, 2.7, 5.8); L.rotation.y = s * 0.22; g.add(L);
  }
  const bridge = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.24, 10, 20, Math.PI), frameMat); bridge.position.set(0, 2.95, 5.85); g.add(bridge);
  for (const s of [-1, 1]) {
    const pts = [[s * 5.85, 3.2, 5.0], [s * 6.7, 3.1, 4.2], [s * 7.3, 2.8, 1.2], [s * 7.5, 2.3, -1.6], [s * 7.5, 1.9, -2.6], [s * 7.3, 0.8, -4.0]];
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 32, 0.2, 8), frameMat));
  }
  // nasino rosa sulla punta del naso
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.75, 18, 12), new THREE.MeshPhysicalMaterial({ color: 0xe9638c, roughness: .3, clearcoat: .8 }));
  nose.scale.set(1.25, 0.85, 0.7); nose.position.set(0, -0.75, 7.55); g.add(nose);
  // occlusore del viso (solo profondità, rigido, rientrato di 0.3 cm)
  { const f = h.face, geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(Array.from(f.pos), 3)); geo.setIndex(Array.from(f.idx)); geo.computeVertexNormals();
    const pp = geo.attributes.position, nn = geo.attributes.normal;
    for (let i = 0; i < pp.count; i++) pp.setXYZ(i, pp.getX(i) - nn.getX(i) * 0.3, pp.getY(i) - nn.getY(i) * 0.3, pp.getZ(i) - nn.getZ(i) * 0.3);
    const occ = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false })); occ.renderOrder = -1; occ.name = 'faceOccluder'; g.add(occ); }
  g.userData.ears = ears;
  return g;
}

export function update(g, bs, t) {
  const [a, b] = g.userData.ears;
  const smile = ((bs.mouthSmileLeft || 0) + (bs.mouthSmileRight || 0)) / 2;
  a.rotation.x = -0.12 + Math.sin(t * 1.7) * 0.05; b.rotation.x = -0.12 + Math.cos(t * 1.3) * 0.05;
  a.rotation.z = -0.22 + smile * 0.15; b.rotation.z = 0.22 - smile * 0.15;
}
