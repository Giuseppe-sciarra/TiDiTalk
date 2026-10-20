// Cilindro nero con fascia rossa: tesa leggermente arricciata, calzato basso sulla fronte.
export const meta = { label: 'Cilindro', labelEn: 'Top hat', category: 'costumi', icon: '🎩' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const lathe = (pts, seg = 56) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg);
  const felt = h.mat(0x1c1b21, { roughness: .92 });
  const satin = h.mat(0xa31d2f, { roughness: .45 });

  // tesa: profilo chiuso (sopra → bordo arricciato → sotto) per avere uno spessore vero
  const brim = new THREE.Mesh(lathe([
    [8.3, 0.0], [10.2, 0.0], [11.8, 0.12], [12.9, 0.55], [13.4, 1.15], [13.25, 1.55],
    [12.8, 1.35], [11.9, 0.7], [10.3, 0.35], [8.3, 0.32], [8.3, 0.0],
  ]), felt);
  g.add(brim);

  // corona: leggermente svasata in alto, con bordo arrotondato
  const crown = new THREE.Mesh(lathe([
    [0, 0.2], [8.35, 0.2], [8.45, 4.0], [8.6, 8.0], [8.9, 12.2], [8.75, 12.75], [8.3, 12.95], [0, 13.0],
  ]), felt);
  g.add(crown);

  // fascia di raso con un piccolo fiocco piatto sul lato
  const band = new THREE.Mesh(lathe([[8.6, 0.55], [8.6, 2.85], [8.3, 2.85], [8.3, 0.55], [8.6, 0.55]]), satin);
  g.add(band);
  const bow = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.5, 0.35), satin);
  bow.position.set(-8.2, 1.7, -2.9); bow.rotation.y = -0.33;
  g.add(bow);

  g.position.set(0, 8.6, -2.2);
  g.rotation.x = -0.10;
  // occlusore "testa + capelli" dentro il cappello (solo profondità, invisibile): nell'app l'occlusore del cranio è
  // piccolo all'altezza della tesa e i capelli veri non nascondono nulla, quindi vista dal basso si vedrebbe il retro
  // della tesa/fascia attraverso la fronte. Nell'harness di sviluppo (h.preview) è marrone = capelli.
  { const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), h.preview ? h.mat(0x4a3526, { roughness: 1 }) : new THREE.MeshBasicMaterial({ colorWrite: false }));
    occ.scale.set(8.0, 6, 8.0); occ.position.set(0, -2.5, 0); occ.renderOrder = -1; occ.name = 'headOccluder'; g.add(occ); }
  return g;
}
