// Benda da pirata sull'occhio sinistro (di chi la porta), con laccio che gira attorno alla testa.
export const meta = { label: 'Benda da pirata', labelEn: 'Eye patch', category: 'accessori', icon: '🏴‍☠️' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const leather = h.mat(0x15131a, { roughness: .75 });
  const s = 1;   // +X = occhio sinistro di chi indossa

  // benda: calotta sferica bombata rivolta verso la camera, bordo arrotondato e cucitura chiara
  const capGeo = new THREE.SphereGeometry(4.2, 32, 20, 0, Math.PI * 2, 0, 0.85);
  capGeo.scale(1, 0.45, 1); capGeo.rotateX(Math.PI / 2);          // il polo (+Y) ora punta verso +Z
  const patch = new THREE.Mesh(capGeo, leather);
  const edgeR = 4.2 * Math.sin(0.85), edgeZ = 4.2 * Math.cos(0.85) * 0.45;
  const edge = new THREE.Mesh(new THREE.TorusGeometry(edgeR, 0.16, 8, 48), leather); edge.position.z = edgeZ;
  const stitch = new THREE.Mesh(new THREE.TorusGeometry(edgeR - 0.45, 0.05, 6, 48), h.mat(0x8f8778, { roughness: .9 })); stitch.position.z = edgeZ + 0.33;
  const holder = new THREE.Group(); holder.add(patch, edge, stitch);
  holder.position.set(s * 3.1, 2.6, 4.4);
  holder.rotation.y = s * 0.25; holder.rotation.x = -0.08;
  holder.scale.set(1, 0.9, 1);
  g.add(holder);

  // laccio: dalla benda (lato interno, in alto) attraversa la fronte in diagonale verso la tempia opposta, gira dietro e torna all'esterno della benda
  const pts = [
    [s * 1.8, 4.3, 5.5], [0, 5.0, 5.8], [-s * 3.0, 5.5, 5.0], [-s * 5.6, 5.6, 3.3], [-s * 7.2, 5.2, -0.3], [-s * 7.3, 4.8, -5.0], [-s * 4.5, 4.4, -9.4],
    [0, 4.2, -10.9], [s * 4.5, 4.0, -9.5], [s * 7.5, 3.4, -5.2], [s * 7.9, 2.8, -1.2], [s * 6.8, 2.7, 3.0], [s * 5.4, 2.9, 4.8],
  ];
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)), false, 'catmullrom', 0.5);
  const strap = new THREE.TubeGeometry(curve, 120, 0.32, 8);
  // appiattisco il tubo: sezione a nastro (sottile radialmente rispetto alla testa)
  const sp = strap.attributes.position, HEAD = new THREE.Vector3(0, 2.5, -3.0);
  for (let i = 0; i < sp.count; i++) {
    const v = new THREE.Vector3(sp.getX(i), sp.getY(i), sp.getZ(i));
    const seg = Math.floor(i / 9); const c = curve.getPointAt(Math.min(1, seg / 120));
    const radial = c.clone().sub(HEAD).normalize();                 // direzione "fuori dalla testa"
    const d = v.clone().sub(c); const along = d.dot(radial);
    v.sub(radial.clone().multiplyScalar(along * 0.75));              // schiaccio in direzione radiale
    sp.setXYZ(i, v.x, v.y, v.z);
  }
  strap.computeVertexNormals();
  g.add(new THREE.Mesh(strap, leather));
  // occlusore del viso (solo profondità, rigido, rientrato di 0.3 cm): nell'app l'occlusore del viso è nel passaggio
  // trasparente e non nasconde gli oggetti opachi, quindi girando la testa l'asta lontana si vedrebbe attraverso la guancia
  { const f = h.face, geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(Array.from(f.pos), 3)); geo.setIndex(Array.from(f.idx)); geo.computeVertexNormals();
    const pp = geo.attributes.position, nn = geo.attributes.normal;
    for (let i = 0; i < pp.count; i++) pp.setXYZ(i, pp.getX(i) - nn.getX(i) * 0.3, pp.getY(i) - nn.getY(i) * 0.3, pp.getZ(i) - nn.getZ(i) * 0.3);
    const occ = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false })); occ.renderOrder = -1; occ.name = 'faceOccluder'; g.add(occ); }
  return g;
}
