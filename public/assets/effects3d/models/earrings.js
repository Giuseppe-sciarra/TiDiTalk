// Orecchini pendenti: perno con brillantino, cerchio d'oro inclinato (si vede anche di fronte) e perla che dondola.
export const meta = { label: 'Orecchini', labelEn: 'Earrings', category: 'accessori', icon: '💎' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const gold = h.mat(0xdcb44e, { roughness: .25, metalness: .95 });
  const pearl = new THREE.MeshPhysicalMaterial({ color: 0xeee6da, roughness: .22, sheen: 1, sheenColor: 0xffe2ee, clearcoat: .7 });
  const gem = new THREE.MeshPhysicalMaterial({ color: 0x7ec8ff, roughness: .05, clearcoat: 1, emissive: 0x2a6fa8, emissiveIntensity: .25 });
  const drops = [];
  for (const s of [-1, 1]) {
    // lobo: dietro la mandibola, sotto il trago
    const lobe = new THREE.Group(); lobe.position.set(s * 7.75, -1.3, -3.7);   // lobo: un po' dietro il bordo del viso
    const stud = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), gem); stud.position.x = s * 0.15; lobe.add(stud);
    const cup = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.08, 6, 16), gold); cup.rotation.y = Math.PI / 2; cup.position.x = s * 0.15; lobe.add(cup);
    // pendente che oscilla attorno al lobo
    const swing = new THREE.Group(); lobe.add(swing);
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.12, 10, 48), gold);
    hoop.position.set(s * 0.2, -1.55, 0); hoop.rotation.y = s * 0.85;           // inclinato: di fronte si vede come un ovale, non come una riga
    swing.add(hoop);
    const link = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6), gold); link.position.set(s * 0.2, -1.2, 0); swing.add(link);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), gold); cap.position.set(s * 0.2, -1.62, 0); swing.add(cap);
    const pr = new THREE.Mesh(new THREE.SphereGeometry(0.48, 18, 14), pearl); pr.scale.set(1, 1.15, 1); pr.position.set(s * 0.2, -2.1, 0); swing.add(pr);
    g.add(lobe); drops.push(swing);
  }
  // occlusore del viso (solo profondità, rigido, rientrato di 0.3 cm): girando la testa l'orecchino lontano va nascosto dalla guancia
  { const f = h.face, geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(Array.from(f.pos), 3)); geo.setIndex(Array.from(f.idx)); geo.computeVertexNormals();
    const pp = geo.attributes.position, nn = geo.attributes.normal;
    for (let i = 0; i < pp.count; i++) pp.setXYZ(i, pp.getX(i) - nn.getX(i) * 0.3, pp.getY(i) - nn.getY(i) * 0.3, pp.getZ(i) - nn.getZ(i) * 0.3);
    const occ = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false })); occ.renderOrder = -1; occ.name = 'faceOccluder'; g.add(occ); }
  g.userData.drops = drops;
  return g;
}

export function update(g, bs, t) {
  g.userData.drops.forEach((d, i) => { d.rotation.z = Math.sin(t * 2.4 + i * 1.3) * 0.12; d.rotation.x = Math.cos(t * 1.9 + i) * 0.08; });
}
