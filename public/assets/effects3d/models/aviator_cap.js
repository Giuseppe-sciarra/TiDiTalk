// Cuffia da aviatore in pelle con paraorecchie, cuciture e occhialoni in ottone alzati sulla fronte.
export const meta = { label: 'Cuffia da aviatore', labelEn: 'Aviator cap', category: 'costumi', icon: '🛩️' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const leather = h.mat(0x6b3f22, { roughness: .55 });
  const leatherDark = h.mat(0x4a2a15, { roughness: .6 });
  const fleece = h.mat(0xe9dcc2, { roughness: 1 });
  const brass = h.mat(0xc9a24a, { roughness: .35, metalness: .9 });
  const lathe = (pts, seg = 72) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg);

  // calotta che avvolge il cranio fino sopra le orecchie
  const cap = lathe([[8.5, -2.0], [8.8, 0.5], [8.8, 3.0], [8.2, 5.5], [6.8, 7.6], [4.6, 9.0], [2.2, 9.7], [0, 9.9]]);
  // davanti la calotta si ferma più in alto: taglio ottenuto spostando in su i vertici frontali bassi
  const p = cap.attributes.position;
  // rimappatura monotòna (nessuna piega): sotto y=2.2 i vertici frontali salgono verso 2.2 in proporzione
  const lift = (z) => Math.pow(Math.max(0, z / 8.8), 1.5) * 0.85;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), z = p.getZ(i);
    if (y < 2.2) p.setY(i, y + (2.2 - y) * lift(z));
  }
  cap.computeVertexNormals();
  g.add(new THREE.Mesh(cap, leather));
  // bordo arrotolato in pelle lungo il taglio (sulla fronte sale, ai lati/dietro scende)
  const rimPts = [];
  for (let i = 0; i < 72; i++) { const ph = i / 72 * Math.PI * 2, x = 8.55 * Math.sin(ph), z = 8.55 * Math.cos(ph); rimPts.push(new THREE.Vector3(x, -2.0 + 4.2 * lift(z), z)); }
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts, true), 144, 0.38, 8, true), leatherDark));
  // cuciture: meridiano centrale e due laterali
  const seamMat = h.mat(0xc9a86a, { roughness: .9 });
  const prof = [[8.5, -2.0], [8.8, 0.5], [8.8, 3.0], [8.2, 5.5], [6.8, 7.6], [4.6, 9.0], [2.2, 9.7], [0, 9.9]];
  const capR = (y) => { for (let i = 1; i < prof.length; i++) if (y <= prof[i][1]) { const t = (y - prof[i - 1][1]) / (prof[i][1] - prof[i - 1][1]); return prof[i - 1][0] + (prof[i][0] - prof[i - 1][0]) * t; } return 0; };
  for (const th of [Math.PI / 2, Math.PI / 2 + 0.9, Math.PI / 2 - 0.9]) {
    const pts = [];
    // le cuciture partono sopra il bordo della fronte (y > 2.8): niente fili che "galleggiano" sulla pelle
    for (let i = 0; i <= 24; i++) { const ang = (i / 24) * Math.PI / 2; const y = 0.5 + Math.cos(ang) * 9.4 - 0.5 * (1 - Math.cos(ang)); if (y < 2.8) continue; const r = Math.sin(ang) * (capR(Math.min(9.89, y)) + 0.12); pts.push(new THREE.Vector3(Math.cos(th) * r, Math.min(10.0, y), Math.sin(th) * r)); }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.09, 6), seamMat));
  }

  // paraorecchie: due lembi che scendono sulle orecchie, con bordo di pile
  for (const s of [-1, 1]) {
    const flap = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), leather);
    flap.scale.set(1.3, 4.8, 3.6); flap.position.set(s * 8.1, -1.2, -2.6); flap.rotation.z = s * 0.08; g.add(flap);
    const fl = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), fleece);
    fl.scale.set(1.0, 2.6, 2.0); fl.position.set(s * 8.5, -4.4, -2.6); g.add(fl);
    // cinturino sotto il mento (parte dal lembo e scende): solo l'inizio con fibbia
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3.0, 0.25), leatherDark); strap.position.set(s * 7.9, -6.8, 0.2); strap.rotation.z = s * 0.25; g.add(strap);
    const buckle = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.12, 6, 16), brass); buckle.position.set(s * 7.6, -8.1, 0.4); g.add(buckle);
  }

  // occhialoni alzati sulla fronte: due coppe in ottone con lenti scure, ponte, cinghia attorno alla calotta
  const goggles = new THREE.Group();
  const lensMat = new THREE.MeshPhysicalMaterial({ color: 0x223344, roughness: .1, metalness: .3, transparent: true, opacity: .75, clearcoat: 1 });
  for (const s of [-1, 1]) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.9, 1.6, 28), brass); cup.rotation.x = Math.PI / 2; cup.position.set(s * 3.3, 0, 0);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(2.3, 28), lensMat); lens.position.set(s * 3.3, 0, 0.85);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.22, 8, 36), brass); rim.position.set(s * 3.3, 0, 0.82);
    goggles.add(cup, lens, rim);
    const screw = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), h.mat(0x8a7a40, { roughness: .4, metalness: .9 })); screw.position.set(s * 5.9, 0.4, 0.4); goggles.add(screw);
  }
  const bridge = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.22, 8, 20, Math.PI), brass); bridge.position.set(0, 0.2, 0.3); goggles.add(bridge);
  // posizione: sulla fronte/calotta, inclinati seguendo la curva della testa
  goggles.position.set(0, 7.2, 6.3); goggles.rotation.x = -0.55;
  g.add(goggles);
  // cinghia degli occhiali attorno alla calotta: nastro (box chiuso) che segue la calotta, più alto davanti
  const N = 72, P = [], I = [];
  for (let i = 0; i <= N; i++) {
    const a = i / N * Math.PI * 2;
    const y = 6.2 + 1.4 * Math.sin(a), r = capR(Math.min(9.5, y)) + 0.12;
    const cx = Math.cos(a), cz = Math.sin(a);
    // 4 vertici per sezione: dentro-basso, fuori-basso, fuori-alto, dentro-alto
    P.push(cx * r, y - 0.55, cz * r, cx * (r + 0.35), y - 0.55, cz * (r + 0.35), cx * (r + 0.35), y + 0.55, cz * (r + 0.35), cx * r, y + 0.55, cz * r);
  }
  for (let i = 0; i < N; i++) for (let k = 0; k < 4; k++) {
    const a = i * 4 + k, b = i * 4 + (k + 1) % 4, c = (i + 1) * 4 + k, d = (i + 1) * 4 + (k + 1) % 4;
    I.push(a, c, b, b, c, d);
  }
  const strapGeo = new THREE.BufferGeometry();
  strapGeo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); strapGeo.setIndex(I); strapGeo.computeVertexNormals();
  g.add(new THREE.Mesh(strapGeo, h.mat(0x4a2a15, { roughness: .6, side: THREE.DoubleSide })));

  g.scale.setScalar(1.1);      // un po' più grande del cranio: sta sopra i capelli veri
  g.position.set(0, 6.1, -2.6);
  g.rotation.x = -0.1;
  // occlusore "testa + capelli" dentro il cappello (solo profondità, invisibile): nell'app l'occlusore del cranio è
  // piccolo all'altezza della tesa e i capelli veri non nascondono nulla, quindi vista dal basso si vedrebbe il retro
  // della tesa/fascia attraverso la fronte. Nell'harness di sviluppo (h.preview) è marrone = capelli.
  { const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), h.preview ? h.mat(0x4a3526, { roughness: 1 }) : new THREE.MeshBasicMaterial({ colorWrite: false }));
    occ.scale.set(8.2, 6, 8.2); occ.position.set(0, -3.0, 0); occ.renderOrder = -1; occ.name = 'headOccluder'; g.add(occ); }
  return g;
}
