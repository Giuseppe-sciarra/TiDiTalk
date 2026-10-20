// Elmo da cavaliere: calotta e guanciali in acciaio, visiera a feritoie sollevata sulla fronte, pennacchio rosso.
export const meta = { label: 'Elmo da cavaliere', labelEn: 'Knight helmet', category: 'costumi', icon: '⚔️' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const steel = h.mat(0xb9bec6, { roughness: .3, metalness: .9 });
  const steelDark = h.mat(0x6f757d, { roughness: .4, metalness: .85 });
  const brass = h.mat(0xc9a24a, { roughness: .35, metalness: .9 });
  const lathe = (pts, seg = 72) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg);

  // calotta superiore (fino alla fronte)
  g.add(new THREE.Mesh(lathe([[9.0, 0], [9.2, 2.0], [9.0, 4.5], [8.2, 7.0], [6.6, 9.0], [4.2, 10.4], [1.8, 11.0], [0, 11.1]]), steel));
  // cresta centrale
  const crest = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.4, 14), steelDark); crest.position.set(0, 10.2, -0.5);
  const cp = crest.geometry.attributes.position;
  for (let i = 0; i < cp.count; i++) { const z = cp.getZ(i); cp.setY(i, cp.getY(i) - 0.011 * z * z); }
  crest.geometry.computeVertexNormals(); g.add(crest);

  // parte bassa: avvolge nuca e guance ma lascia libero il viso (apertura davanti)
  const lower = new THREE.Mesh(new THREE.CylinderGeometry(9.2, 9.0, 9.5, 72, 1, true, Math.PI * 0.24, Math.PI * 1.52), steel);   // apertura di ~86° davanti: i guanciali coprono le tempie
  lower.position.y = -4.75; g.add(lower);
  // bordo inferiore e bordi dell'apertura in ottone
  const rimPts = [];
  for (let i = 0; i <= 48; i++) { const th = Math.PI * 0.24 + i / 48 * Math.PI * 1.52; rimPts.push(new THREE.Vector3(Math.sin(th) * 9.05, -9.4, Math.cos(th) * 9.05)); }
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts), 64, 0.3, 8), brass));
  for (const s of [-1, 1]) {
    const ang = Math.PI * 0.24 + (s < 0 ? Math.PI * 1.52 : 0);
    const e = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 9.6, 10), brass);
    e.position.set(Math.sin(ang) * 9.1, -4.75, Math.cos(ang) * 9.1); g.add(e);
  }

  // visiera sollevata: lamiera curva con feritoie, incernierata alle tempie, inclinata verso l'alto
  const visor = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 9.6, 5.2, 48, 1, true, -Math.PI * 0.42, Math.PI * 0.84), steel);
  visor.add(plate);
  // feritoie orizzontali (barre scure) e nervatura centrale
  for (const yy of [-0.9, 0.6]) {
    const slit = new THREE.Mesh(new THREE.CylinderGeometry(9.62, 9.62, 0.5, 48, 1, true, -Math.PI * 0.34, Math.PI * 0.68), h.mat(0x1a1a1e, { roughness: .9 }));
    slit.position.y = yy; visor.add(slit);
  }
  const vrib = new THREE.Mesh(new THREE.BoxGeometry(0.8, 5.4, 0.6), steelDark); vrib.position.set(0, 0, 9.5); visor.add(vrib);
  // rivetti sui bordi della visiera
  for (let i = -3; i <= 3; i++) { const a = i * 0.2; const r = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), brass); r.position.set(Math.sin(a) * 9.7, -2.2, Math.cos(a) * 9.7); visor.add(r); }
  visor.position.set(0, 4.2, 0); visor.rotation.x = -0.72;    // sollevata sulla fronte
  g.add(visor);
  // cerniere alle tempie
  for (const s of [-1, 1]) { const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.6, 16), brass); hinge.rotation.z = Math.PI / 2; hinge.position.set(s * 9.35, 4.2, 0); g.add(hinge); }

  // pennacchio: piume rosse come ellissoidi schiacciati che si aprono all'indietro
  const red = h.mat(0xc21f2b, { roughness: .9 });
  for (let i = 0; i < 7; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), red);
    const t = i / 6;
    f.scale.set(1.15 - t * 0.3, 4.6 - t * 1.2, 0.55);
    f.position.set((i % 2 ? 0.5 : -0.5) * (i / 3), 14.2 + Math.sin(t * 2.2) * 2.0 - t * 1.6, -1.2 - t * 6.0);
    f.rotation.x = -0.15 - t * 0.85; f.rotation.z = (i % 2 ? 0.1 : -0.1);
    g.add(f);
  }
  const plumeBase = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, 1.6, 12), brass); plumeBase.position.set(0, 11.2, -1.5); g.add(plumeBase);

  g.position.set(0, 7.8, -2.6);
  g.rotation.x = -0.06;
  // occlusore "testa + capelli" dentro il cappello (solo profondità, invisibile): nell'app l'occlusore del cranio è
  // piccolo all'altezza della tesa e i capelli veri non nascondono nulla, quindi vista dal basso si vedrebbe il retro
  // della tesa/fascia attraverso la fronte. Nell'harness di sviluppo (h.preview) è marrone = capelli.
  { const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), h.preview ? h.mat(0x4a3526, { roughness: 1 }) : new THREE.MeshBasicMaterial({ colorWrite: false }));
    occ.scale.set(8.5, 7, 8.5); occ.position.set(0, -2.5, 0); occ.renderOrder = -1; occ.name = 'headOccluder'; g.add(occ); }
  return g;
}
