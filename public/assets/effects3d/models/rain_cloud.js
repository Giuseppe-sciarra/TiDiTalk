// Nuvoletta di pioggia sopra la testa: nuvola grigia soffice che ondeggia, gocce che cadono sui capelli, ogni tanto un fulmine.
export const meta = { label: 'Nuvola di pioggia', labelEn: 'Rain cloud', category: 'divertenti', icon: '🌧️' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const cloud = new THREE.Group();
  // nuvola: sfere sovrapposte, sopra più chiare e sotto più scure (colore per vertice in base all'altezza)
  const puffs = [[0, 0.6, 0, 3.6], [-3.6, -0.2, 0.3, 2.9], [3.7, -0.1, 0.2, 3.0], [-6.4, -0.9, 0, 2.0], [6.5, -0.9, -0.2, 2.1], [-1.8, 2.4, -0.4, 2.7], [2.0, 2.2, 0.3, 2.6], [0.2, -1.2, 1.6, 2.6], [0, -0.6, -2.0, 3.0], [-3.8, 0.6, -1.6, 2.2], [3.9, 0.7, -1.5, 2.3]];
  const top = new THREE.Color(0xb7c0cc), bot = new THREE.Color(0x58616f), tmp = new THREE.Color();
  for (const [x, y, z, r] of puffs) {
    const geo = new THREE.SphereGeometry(r, 28, 20);
    const p = geo.attributes.position, col = [];
    for (let i = 0; i < p.count; i++) {
      const vy = p.getY(i) + y, k = Math.min(1, Math.max(0, (vy + 2.6) / 6.0));
      const n = 1 + 0.035 * Math.sin(p.getX(i) * 3.1 + p.getY(i) * 2.3) * Math.cos(p.getZ(i) * 2.7);   // bordo un po' irregolare
      p.setXYZ(i, p.getX(i) * n, p.getY(i) * n, p.getZ(i) * n);
      tmp.copy(bot).lerp(top, k); col.push(tmp.r, tmp.g, tmp.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    m.position.set(x, y, z); cloud.add(m);
  }
  cloud.position.set(0, 21.0, -2.5);
  g.add(cloud);
  // gocce: gocce allungate azzurrine che cadono dalla nuvola fino ai capelli
  const dropGeo = new THREE.SphereGeometry(0.27, 10, 8); dropGeo.scale(1, 2.6, 1);
  const dropMat = new THREE.MeshPhysicalMaterial({ color: 0x8fc7ff, roughness: .05, transparent: true, opacity: .75, clearcoat: 1, depthWrite: false });
  const drops = [];
  for (let i = 0; i < 34; i++) {
    const d = new THREE.Mesh(dropGeo, dropMat);
    const a = (i * 2.399) % (Math.PI * 2), r = 1.5 + ((i * 37) % 50) / 50 * 5.5;
    drops.push({ d, x: Math.cos(a) * r, z: -2.5 + Math.sin(a) * r * 0.6, ph: ((i * 0.618) % 1) });
    g.add(d);
  }
  // fulmine: zig-zag giallo emissivo, visibile solo per un attimo ogni ~4 s
  const bolt = new THREE.Shape(); bolt.moveTo(0.4, 0); bolt.lineTo(1.6, 0); bolt.lineTo(0.6, -2.4); bolt.lineTo(1.6, -2.4); bolt.lineTo(-0.9, -6.6); bolt.lineTo(0.0, -3.4); bolt.lineTo(-0.9, -3.4); bolt.closePath();
  const boltMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(bolt, { depth: 0.3, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0xffe14d, emissive: 0xffc400, emissiveIntensity: 1.6 }));
  boltMesh.position.set(2.2, 19.0, 0.4); g.add(boltMesh);
  const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), new THREE.MeshBasicMaterial({ colorWrite: false }));
  occ.scale.set(8.5, 13.0, 9.6); occ.position.set(0, 1.0, -3.2); occ.renderOrder = -1; occ.name = 'hairOccluder'; if (!h.preview) g.add(occ);
  g.userData = { cloud, drops, boltMesh };
  update(g, {}, 0.7);
  return g;
}

export function update(g, bs, t) {
  const u = g.userData;
  u.cloud.position.x = Math.sin(t * 0.6) * 0.8; u.cloud.position.y = 21.0 + Math.sin(t * 1.1) * 0.35;
  u.cloud.rotation.z = Math.sin(t * 0.7) * 0.04;
  const sad = Math.max(bs.mouthFrownLeft || 0, bs.mouthFrownRight || 0);
  for (const d of u.drops) {
    const ph = (t * (1.1 + 0.6 * sad) + d.ph) % 1;
    d.d.position.set(d.x + u.cloud.position.x, 18.6 - ph * 6.5, d.z);
    d.d.visible = ph < 0.97;
  }
  const flash = (t % 4.0) > 3.55 && (t % 4.0) < 3.75;
  u.boltMesh.visible = flash;
  u.boltMesh.position.x = 2.2 + u.cloud.position.x;
}
