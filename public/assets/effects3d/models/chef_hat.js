// Toque da chef: fascia bianca e cupola gonfia a pieghe verticali.
export const meta = { label: 'Cappello da chef', labelEn: 'Chef hat', category: 'costumi', icon: '👨‍🍳' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const cotton = h.mat(0xc4bdb0, { roughness: 1 });
  const puffMat = h.mat(0xf0ece4, { roughness: 1, vertexColors: true });
  const lathe = (pts, seg = 96) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg);

  // fascia rigida
  g.add(new THREE.Mesh(lathe([[8.5, -1.0], [8.75, 1.0], [8.75, 5.2], [8.5, 5.8], [8.2, 5.8], [8.2, -1.0], [8.5, -1.0]]), cotton));
  // cucitura orizzontale sulla fascia
  const seam = new THREE.Mesh(new THREE.TorusGeometry(8.78, 0.07, 6, 96), h.mat(0xcfc9be, { roughness: .9 })); seam.rotation.x = Math.PI / 2; seam.position.y = 4.8; g.add(seam);

  // cupola gonfia: si allarga sopra la fascia, cima morbida; pieghe verticali con onda sul raggio
  const puffGeo = lathe([[8.3, 5.4], [9.4, 6.6], [10.3, 9.0], [10.6, 12.0], [10.2, 14.8], [9.0, 17.0], [6.5, 18.4], [3.4, 19.0], [0, 19.1]]);
  const p = puffGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z);
    if (r < 0.3) continue;
    const a = Math.atan2(z, x);
    const amp = 0.07 * Math.min(1, (y - 5.4) / 2.5) * Math.min(1, r / 6);       // le pieghe partono dolci sopra la fascia
    const k = 1 + amp * Math.cos(a * 18) + 0.012 * Math.cos(a * 5 + y);          // più un po' di irregolarità
    p.setXYZ(i, x * k, y, z * k);
  }
  puffGeo.computeVertexNormals();
  // ombra nelle pieghe e sotto lo sbuffo (profondità: niente bianco piatto sopra il video)
  const col = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
    const fold = 0.5 + 0.5 * Math.cos(a * 18), under = Math.min(1, Math.max(0, (y - 5.4) / 3));
    const b = (0.80 + 0.12 * fold) * (0.86 + 0.14 * under);
    col.push(0.84 * b, 0.82 * b, 0.78 * b);
  }
  puffGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.add(new THREE.Mesh(puffGeo, puffMat));

  g.position.set(0, 8.4, -2.4);
  g.rotation.x = -0.1;
  // occlusore "testa + capelli" dentro il cappello (solo profondità, invisibile): nell'app l'occlusore del cranio è
  // piccolo all'altezza della tesa e i capelli veri non nascondono nulla, quindi vista dal basso si vedrebbe il retro
  // della tesa/fascia attraverso la fronte. Nell'harness di sviluppo (h.preview) è marrone = capelli.
  { const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), h.preview ? h.mat(0x4a3526, { roughness: 1 }) : new THREE.MeshBasicMaterial({ colorWrite: false }));
    occ.scale.set(7.9, 6, 7.9); occ.position.set(0, -3.0, 0); occ.renderOrder = -1; occ.name = 'headOccluder'; g.add(occ); }
  return g;
}
