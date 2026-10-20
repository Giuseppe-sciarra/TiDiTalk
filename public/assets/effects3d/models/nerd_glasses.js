// Occhiali da nerd: montatura tonda nera e spessa, lenti quasi trasparenti con un riflesso, aste robuste.
export const meta = { label: 'Occhiali da nerd', labelEn: 'Nerd glasses', category: 'accessori', icon: '🤓' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const black = new THREE.MeshPhysicalMaterial({ color: 0x141416, roughness: .3, clearcoat: .8, clearcoatRoughness: .2 });
  const lensMat = new THREE.MeshPhysicalMaterial({ color: 0xdfe9f5, roughness: .02, transparent: true, opacity: .18, clearcoat: 1, side: THREE.DoubleSide });

  for (const s of [-1, 1]) {
    const L = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.75, 0.42, 12, 48), black);
    rim.scale.set(1, 0.92, 0.75);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(2.6, 40), lensMat); lens.scale.y = 0.92;
    L.add(rim, lens);
    L.position.set(s * 3.15, 2.7, 5.8);
    L.rotation.y = s * 0.22;
    g.add(L);
  }
  // ponte a sella (barra spessa) e naselli integrati
  const bridge = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.32, 10, 20, Math.PI), black); bridge.position.set(0, 2.95, 5.85); g.add(bridge);
  // cerniere e aste spesse
  for (const s of [-1, 1]) {
    const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), black); hinge.position.set(s * 6.25, 3.2, 4.9); hinge.rotation.y = s * 0.35; g.add(hinge);
    const pts = [[s * 6.5, 3.2, 4.8], [s * 7.1, 3.1, 3.4], [s * 7.45, 2.7, 0.6], [s * 7.55, 2.2, -1.8], [s * 7.5, 1.9, -2.7], [s * 7.3, 0.7, -4.1]];
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 32, 0.3, 8);
    g.add(new THREE.Mesh(geo, black));
  }
  // cerotto bianco sul ponte (dettaglio nerd)
  const tape = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 0.5), h.mat(0xf5f5f0, { roughness: .9 })); tape.position.set(0, 3.5, 5.9); tape.rotation.z = 0.3; g.add(tape);
  // occlusore del viso (solo profondità, rigido, rientrato di 0.3 cm): nell'app l'occlusore del viso è nel passaggio
  // trasparente e non nasconde gli oggetti opachi, quindi girando la testa l'asta lontana si vedrebbe attraverso la guancia
  { const f = h.face, geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(Array.from(f.pos), 3)); geo.setIndex(Array.from(f.idx)); geo.computeVertexNormals();
    const pp = geo.attributes.position, nn = geo.attributes.normal;
    for (let i = 0; i < pp.count; i++) pp.setXYZ(i, pp.getX(i) - nn.getX(i) * 0.3, pp.getY(i) - nn.getY(i) * 0.3, pp.getZ(i) - nn.getZ(i) * 0.3);
    const occ = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false })); occ.renderOrder = -1; occ.name = 'faceOccluder'; g.add(occ); }
  return g;
}
