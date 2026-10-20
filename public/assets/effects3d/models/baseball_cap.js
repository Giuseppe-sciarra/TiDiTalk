// Cappellino da baseball: cupola a 6 spicchi con cuciture, bottone, visiera curva, occhielli.
export const meta = { label: 'Cappellino da baseball', labelEn: 'Baseball cap', category: 'accessori', icon: '🧢' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const cloth = h.mat(0x2457a8, { roughness: .85 });
  const clothDark = h.mat(0x1b3f7a, { roughness: .85 });
  const lathe = (pts, seg = 72) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg);

  // cupola (leggermente più profonda dietro grazie all'inclinazione del gruppo)
  const dome = lathe([[8.6, -1.2], [8.75, 0.8], [8.6, 3.0], [8.0, 5.2], [6.6, 7.0], [4.4, 8.2], [2.0, 8.8], [0, 8.9]]);
  g.add(new THREE.Mesh(dome, cloth));
  // fascia interna (bordo) un filo più scura
  g.add(new THREE.Mesh(lathe([[8.8, -1.25], [8.85, -0.2], [8.6, -0.2], [8.6, -1.25], [8.8, -1.25]]), clothDark));

  // cuciture dei 6 spicchi: meridiani come tubi sottili
  const seam = h.mat(0x163668, { roughness: .9 });
  for (let k = 0; k < 6; k++) {
    const a = k * Math.PI / 3 + Math.PI / 6;
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      // segui il profilo della cupola
      const t = i / 12, y = 0.8 + t * 8.1;
      const r = (y < 3 ? 8.75 - (y - 0.8) * 0.07 : y < 5.2 ? 8.6 - (y - 3) * 0.27 : y < 7 ? 8.0 - (y - 5.2) * 0.78 : y < 8.2 ? 6.6 - (y - 7) * 1.83 : 4.4 - (y - 8.2) * 6.2) + 0.12;
      pts.push(new THREE.Vector3(Math.cos(a) * Math.max(r, 0.2), y, Math.sin(a) * Math.max(r, 0.2)));
    }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.09, 6), seam));
  }
  // bottone in cima
  const btn = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), clothDark); btn.scale.y = .55; btn.position.y = 8.9; g.add(btn);
  // occhielli di aerazione
  const eyeletGeo = new THREE.TorusGeometry(0.3, 0.09, 6, 14);
  for (let k = 0; k < 6; k++) {
    const a = k * Math.PI / 3; const r = 6.1;
    const e = new THREE.Mesh(eyeletGeo, clothDark);
    e.position.set(Math.cos(a) * r, 6.6, Math.sin(a) * r); e.lookAt(Math.cos(a) * 20, 12, Math.sin(a) * 20); g.add(e);
  }

  // visiera: ovale davanti, bordo posteriore ad arco che segue la cupola (r 8.7), poi curvata ai lati
  const sh = new THREE.Shape();
  sh.moveTo(-8, -7.5); sh.absellipse(0, -7.5, 8, 6.6, Math.PI, 2 * Math.PI, false);
  sh.lineTo(8, -2.6); sh.absarc(0, 0, 8.4, -0.315, -2.826, true); sh.closePath();
  const vis = new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: true, bevelSize: .12, bevelThickness: .1, bevelSegments: 2, curveSegments: 28 });
  vis.rotateX(Math.PI / 2); vis.rotateY(Math.PI);     // shape y → -z, quindi la parte ellittica finisce davanti (+z)
  // curvatura solo nella parte che sporge oltre la cupola (r > 8.4): attaccata alla cupola resta piatta, niente fessure
  const bend = (x, z) => { const f = Math.min(1, Math.max(0, (Math.hypot(x, z) - 8.4) / 4.5)); return -0.03 * x * x * f - 0.006 * Math.max(0, z - 9) ** 2; };
  const vp = vis.attributes.position;
  for (let i = 0; i < vp.count; i++) { const x = vp.getX(i), z = vp.getZ(i); vp.setY(i, vp.getY(i) + bend(x, z)); }
  vis.translate(0, 0, -8.5);           // perno sul bordo posteriore (davanti della cupola)
  vis.computeVertexNormals();
  const visor = new THREE.Mesh(vis, cloth);
  visor.position.set(0, -1.25, 8.5); visor.rotation.x = 0.1;   // attaccata sotto il bordo, quasi orizzontale
  g.add(visor);
  // sottovisiera verde scuro (come i cappellini veri): stessa sagoma, rivolta in basso, appena sotto la faccia inferiore
  const ug = new THREE.ShapeGeometry(sh, 28);
  ug.rotateX(Math.PI / 2); ug.rotateY(Math.PI);
  const up = ug.attributes.position;
  for (let i = 0; i < up.count; i++) { const x = up.getX(i) * 0.97, z = up.getZ(i) * 0.97 + 0.2; up.setXYZ(i, x, -0.66 + bend(x, z), z - 8.5); }
  ug.computeVertexNormals();
  const under = new THREE.Mesh(ug, h.mat(0x23402c, { roughness: .9 }));
  under.position.copy(visor.position); under.rotation.copy(visor.rotation); g.add(under);
  // bordino cucito lungo l'ovale
  const edge = [];
  for (let i = 0; i <= 44; i++) { const a = Math.PI + i / 44 * Math.PI; const x = Math.cos(a) * 8, z = 7.5 - Math.sin(a) * 6.6; edge.push(new THREE.Vector3(x, -0.25 + bend(x, z), z - 8.5)); }
  const edgeMesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge), 64, 0.3, 8), clothDark);
  edgeMesh.position.copy(visor.position); edgeMesh.rotation.copy(visor.rotation); g.add(edgeMesh);

  g.scale.set(1.05, 1.08, 1.05);     // un po' più grande della testa nuda: deve stare sopra i capelli veri
  g.position.set(0, 7.9, -2.5);
  g.rotation.x = -0.08;
  // occlusore "testa + capelli" dentro il cappello (solo profondità, invisibile): nell'app l'occlusore del cranio è
  // piccolo all'altezza della tesa e i capelli veri non nascondono nulla, quindi vista dal basso si vedrebbe il retro
  // della tesa/fascia attraverso la fronte. Nell'harness di sviluppo (h.preview) è marrone = capelli.
  { const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), h.preview ? h.mat(0x4a3526, { roughness: 1 }) : new THREE.MeshBasicMaterial({ colorWrite: false }));
    occ.scale.set(8.1, 6, 8.1); occ.position.set(0, -3.2, 0); occ.renderOrder = -1; occ.name = 'headOccluder'; g.add(occ); }
  return g;
}
