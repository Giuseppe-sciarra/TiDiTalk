// Corona reale: fascia d'oro con punte, gemme colorate e velluto rosso all'interno.
export const meta = { label: 'Corona', labelEn: 'Crown', category: 'costumi', icon: '👑' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const gold = h.mat(0xe6b93a, { roughness: .28, metalness: .95 });
  const velvet = h.mat(0x8f1b2a, { roughness: .9 });
  const lathe = (pts, seg = 64) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg);
  const R = 8.6;

  // fascia: anello spesso con bordini a rilievo
  g.add(new THREE.Mesh(lathe([[R - 0.3, 0], [R + 0.25, 0], [R + 0.25, 3.0], [R - 0.3, 3.0], [R - 0.3, 0]]), gold));
  for (const yy of [0.25, 2.75]) { const t = new THREE.Mesh(new THREE.TorusGeometry(R + 0.25, 0.22, 8, 64), gold); t.rotation.x = Math.PI / 2; t.position.y = yy; g.add(t); }
  // interno di velluto (cupola bassa)
  g.add(new THREE.Mesh(lathe([[R - 0.35, 0.2], [R - 0.4, 2.5], [7.5, 4.5], [5, 6.0], [0, 6.5]]), velvet));

  // punte: 8 triangoli con la punta arrotondata, leggermente inclinati verso l'esterno
  const N = 8;
  const pt = new THREE.Shape();
  pt.moveTo(-2.9, 0); pt.lineTo(2.9, 0); pt.lineTo(0.6, 5.2); pt.quadraticCurveTo(0, 6.4, -0.6, 5.2); pt.closePath();
  const ptGeo = new THREE.ExtrudeGeometry(pt, { depth: 0.5, bevelEnabled: true, bevelSize: .12, bevelThickness: .1, bevelSegments: 2 });
  const gemCols = [0xd62839, 0x2d7ff9, 0x2ec27e, 0xd62839, 0x2d7ff9, 0x2ec27e, 0xd62839, 0x2d7ff9];
  for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 2 + Math.PI / 2;
    const m = new THREE.Mesh(ptGeo, gold);
    m.position.set(Math.cos(a) * (R - 0.1), 2.9, Math.sin(a) * (R - 0.1));
    m.lookAt(Math.cos(a) * 30, 2.9 - 2.5, Math.sin(a) * 30);     // la faccia della punta guarda fuori, inclinata un po' all'esterno
    g.add(m);
    // sfera dorata in cima
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), gold);
    ball.position.set(Math.cos(a) * (R + 0.9), 9.0, Math.sin(a) * (R + 0.9)); g.add(ball);
    // gemma sulla fascia tra una punta e l'altra
    const ga = a + Math.PI / N;
    const gem = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), new THREE.MeshPhysicalMaterial({ color: gemCols[i], roughness: .1, metalness: 0, clearcoat: 1, emissive: gemCols[i], emissiveIntensity: .25 }));
    gem.scale.z = 0.7; gem.position.set(Math.cos(ga) * (R + 0.3), 1.5, Math.sin(ga) * (R + 0.3)); gem.lookAt(Math.cos(ga) * 30, 1.5, Math.sin(ga) * 30); g.add(gem);
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.1, 6, 20), gold); bezel.position.copy(gem.position); bezel.lookAt(Math.cos(ga) * 30, 1.5, Math.sin(ga) * 30); g.add(bezel);
    // gemma al centro di ogni punta
    const g2 = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .05, metalness: 0, clearcoat: 1, emissive: 0xdddddd, emissiveIntensity: .15 }));
    g2.position.set(Math.cos(a) * (R + 0.55), 5.0, Math.sin(a) * (R + 0.55)); g.add(g2);
  }

  g.position.set(0, 9.4, -2.4);
  g.rotation.x = -0.16;
  // occlusore "testa + capelli" dentro il cappello (solo profondità, invisibile): nell'app l'occlusore del cranio è
  // piccolo all'altezza della tesa e i capelli veri non nascondono nulla, quindi vista dal basso si vedrebbe il retro
  // della tesa/fascia attraverso la fronte. Nell'harness di sviluppo (h.preview) è marrone = capelli.
  { const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), h.preview ? h.mat(0x4a3526, { roughness: 1 }) : new THREE.MeshBasicMaterial({ colorWrite: false }));
    occ.scale.set(8.1, 6, 8.1); occ.position.set(0, -3.0, 0); occ.renderOrder = -1; occ.name = 'headOccluder'; g.add(occ); }
  return g;
}
