// Berretto di lana a coste con risvolto e pompon: calza il cranio, davanti si ferma sopra le sopracciglia.
export const meta = { label: 'Berretto di lana', labelEn: 'Beanie', category: 'accessori', icon: '🧶' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const wool = h.mat(0xa8232a, { roughness: 1 });
  const lathe = (pts, seg = 96) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg);

  // corpo: dalla base (sopra le orecchie) fino alla sommità leggermente morbida
  const body = lathe([[8.6, 0], [8.9, 2.5], [8.9, 5.0], [8.4, 7.5], [7.2, 9.4], [5.2, 10.8], [2.5, 11.5], [0, 11.7]]);
  // coste verticali: raggio modulato con l'angolo
  const p = body.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const r = Math.hypot(x, z); if (r < 0.3) continue;
    const a = Math.atan2(z, x);
    const k = 1 + 0.028 * Math.cos(a * 28) * Math.min(1, r / 4);
    p.setXYZ(i, x * k, y, z * k);
  }
  body.computeVertexNormals();
  g.add(new THREE.Mesh(body, wool));

  // risvolto: anello più spesso con coste orizzontali (profilo ondulato)
  const prof = [];
  for (let i = 0; i <= 14; i++) { const y = -1.2 + i * (4.2 / 14); prof.push([9.35 + 0.22 * Math.sin(i * Math.PI), y]); }
  prof.push([8.5, 3.0], [8.5, -1.2], [9.35, -1.2]);
  const cuffGeo = lathe(prof);
  const q = cuffGeo.attributes.position;
  for (let i = 0; i < q.count; i++) {
    const x = q.getX(i), z = q.getZ(i), r = Math.hypot(x, z), a = Math.atan2(z, x);
    const k = 1 + 0.02 * Math.cos(a * 28);
    q.setXYZ(i, x * k, q.getY(i), z * k);
  }
  cuffGeo.computeVertexNormals();
  g.add(new THREE.Mesh(cuffGeo, wool));

  // pompon lanoso
  const pomGeo = new THREE.SphereGeometry(2.6, 32, 24);
  const pp = pomGeo.attributes.position;
  for (let i = 0; i < pp.count; i++) {
    const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i);
    const n = 1 + 0.14 * Math.sin(x * 7.1 + y * 5.3) * Math.cos(z * 6.7 - y * 4.1) + 0.06 * Math.sin(x * 13 + z * 11);
    pp.setXYZ(i, x * n, y * n, z * n);
  }
  pomGeo.computeVertexNormals();
  const pom = new THREE.Mesh(pomGeo, h.mat(0xe9e2d6, { roughness: 1 })); pom.position.y = 12.9; g.add(pom);

  g.position.set(0, 6.4, -2.5);
  g.rotation.x = -0.22;   // davanti sale sopra le sopracciglia, dietro copre la nuca
  // occlusore "testa + capelli" dentro il cappello (solo profondità, invisibile): nell'app l'occlusore del cranio è
  // piccolo all'altezza della tesa e i capelli veri non nascondono nulla, quindi vista dal basso si vedrebbe il retro
  // della tesa/fascia attraverso la fronte. Nell'harness di sviluppo (h.preview) è marrone = capelli.
  { const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), h.preview ? h.mat(0x4a3526, { roughness: 1 }) : new THREE.MeshBasicMaterial({ colorWrite: false }));
    occ.scale.set(8.2, 6, 8.2); occ.position.set(0, -3.2, 0); occ.renderOrder = -1; occ.name = 'headOccluder'; g.add(occ); }
  return g;
}
