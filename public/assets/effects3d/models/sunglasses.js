// Occhiali da sole aviator: lenti a goccia sfumate, montatura dorata sottile, doppio ponte, aste fino alle orecchie.
export const meta = { label: 'Occhiali da sole', labelEn: 'Sunglasses', category: 'accessori', icon: '🕶️' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const gold = h.mat(0xd8b35a, { roughness: .25, metalness: .95 });
  const lensMat = new THREE.MeshPhysicalMaterial({ color: 0x2a2a30, roughness: .05, metalness: .2, transparent: true, opacity: .8, clearcoat: 1, side: THREE.DoubleSide });

  // sagoma a goccia (più larga in alto, scende verso l'esterno-basso)
  const drop = (s) => {
    const sh = new THREE.Shape();
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const a = i / 40 * Math.PI * 2;
      // ellisse deformata: più piatta sopra, più tonda sotto, estesa verso l'esterno (s) in basso
      const rx = 2.9 + 0.3 * Math.max(0, -Math.sin(a)), ry = 2.4 + 0.5 * Math.max(0, -Math.sin(a));
      const x = Math.cos(a) * rx + s * 0.35 * Math.max(0, -Math.sin(a)), y = Math.sin(a) * ry * (Math.sin(a) > 0 ? 0.85 : 1);
      pts.push(new THREE.Vector2(x, y));
    }
    sh.setFromPoints(pts); return { sh, pts };
  };

  for (const s of [-1, 1]) {
    const L = new THREE.Group();
    const { sh, pts } = drop(s);
    const lens = new THREE.Mesh(new THREE.ShapeGeometry(sh, 24), lensMat);
    L.add(lens);
    const rimPts = pts.map(p => new THREE.Vector3(p.x, p.y, 0));
    L.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts, true), 80, 0.14, 8, true), gold));
    L.position.set(s * 3.1, 2.7, 5.8);
    L.rotation.y = s * 0.22;
    L.rotation.x = -0.06;
    g.add(L);
  }
  // ponte doppio
  const bridgeTop = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.9, 3.6, 5.75), new THREE.Vector3(0, 4.1, 5.75), new THREE.Vector3(0.9, 3.6, 5.75)]), 12, 0.13, 8), gold);
  const bridgeLow = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.9, 2.9, 5.7), new THREE.Vector3(0, 3.3, 5.6), new THREE.Vector3(0.9, 2.9, 5.7)]), 12, 0.12, 8), gold);
  g.add(bridgeTop, bridgeLow);
  // naselli
  for (const s of [-1, 1]) {
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), h.mat(0xeeeeee, { roughness: .3, transparent: true, opacity: .7 })); pad.scale.set(0.6, 1, 0.5);
    pad.position.set(s * 0.95, 2.3, 5.1); g.add(pad);
    const arm = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(s * 1.1, 3.0, 5.7), new THREE.Vector3(s * 0.95, 2.4, 5.2)]), 4, 0.08, 6), gold); g.add(arm);
  }
  // aste: dalla cerniera esterna indietro fino all'orecchio, poi ricurve
  for (const s of [-1, 1]) {
    const pts = [[s * 5.9, 3.25, 5.0], [s * 6.6, 3.2, 4.6], [s * 7.2, 2.9, 1.5], [s * 7.45, 2.4, -1.5], [s * 7.5, 2.0, -2.6], [s * 7.4, 0.9, -4.0], [s * 7.1, -0.4, -4.4]];
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 40, 0.13, 8), gold));
    const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.5), gold); hinge.position.set(s * 6.0, 3.25, 4.9); hinge.rotation.y = s * 0.3; g.add(hinge);
  }
  // occlusore del viso (solo profondità, rigido, rientrato di 0.3 cm): nell'app l'occlusore del viso è nel passaggio
  // trasparente e non nasconde gli oggetti opachi, quindi girando la testa l'asta lontana si vedrebbe attraverso la guancia
  { const f = h.face, geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(Array.from(f.pos), 3)); geo.setIndex(Array.from(f.idx)); geo.computeVertexNormals();
    const pp = geo.attributes.position, nn = geo.attributes.normal;
    for (let i = 0; i < pp.count; i++) pp.setXYZ(i, pp.getX(i) - nn.getX(i) * 0.3, pp.getY(i) - nn.getY(i) * 0.3, pp.getZ(i) - nn.getZ(i) * 0.3);
    const occ = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false })); occ.renderOrder = -1; occ.name = 'faceOccluder'; g.add(occ); }
  return g;
}
