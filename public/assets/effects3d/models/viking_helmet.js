// Elmo vichingo: calotta in ferro con fascia e rivetti in ottone, nasale, due corna ricurve.
export const meta = { label: 'Elmo vichingo', labelEn: 'Viking helmet', category: 'costumi', icon: '🪖' };

function tubeVar(THREE, pts, rFn, segs = 48, radial = 24) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)), false, 'catmullrom', 0.5);
  const fr = curve.computeFrenetFrames(segs, false);
  const P = [], UV = [], I = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, c = curve.getPointAt(t), r = rFn(t), n = fr.normals[i], b = fr.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = j / radial * Math.PI * 2, cx = Math.cos(a), sx = Math.sin(a);
      P.push(c.x + r * (cx * n.x + sx * b.x), c.y + r * (cx * n.y + sx * b.y), c.z + r * (cx * n.z + sx * b.z));
      UV.push(j / radial, t);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; I.push(a, a + 1, b, b, a + 1, b + 1); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  geo.setIndex(I); geo.computeVertexNormals(); return geo;
}

export default function build(THREE, h) {
  const g = new THREE.Group();
  const iron = h.mat(0x9da3ab, { roughness: .42, metalness: .85 });
  const brass = h.mat(0xc9a24a, { roughness: .35, metalness: .9 });
  const horn = h.mat(0xf0e6cf, { roughness: .55 });
  const lathe = (pts, seg = 72) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg);

  // calotta
  g.add(new THREE.Mesh(lathe([[8.7, -1.5], [8.9, 1.0], [8.7, 3.5], [8.0, 6.0], [6.6, 8.0], [4.4, 9.4], [2.0, 10.1], [0, 10.3]]), iron));
  // fascia inferiore e fascia a croce in ottone
  g.add(new THREE.Mesh(lathe([[8.95, -1.6], [9.05, -0.6], [9.05, 0.6], [8.95, 1.0], [8.5, 1.0], [8.5, -1.6], [8.95, -1.6]]), brass));
  const prof = [[8.7, -1.5], [8.9, 1.0], [8.7, 3.5], [8.0, 6.0], [6.6, 8.0], [4.4, 9.4], [2.0, 10.1], [0, 10.3]];
  const domeR = (y) => { for (let i = 1; i < prof.length; i++) if (y <= prof[i][1]) { const t = (y - prof[i - 1][1]) / (prof[i][1] - prof[i - 1][1]); return prof[i - 1][0] + (prof[i][0] - prof[i - 1][0]) * t; } return 0; };
  const meridian = (th) => {
    const pts = [];
    for (let i = 0; i <= 30; i++) { const ang = (i / 30 - 0.5) * Math.PI; const y = 1.0 + Math.cos(ang) * 9.6; const r = Math.abs(Math.sin(ang)) * (domeR(Math.min(10.29, y)) + 0.25); const s = Math.sign(Math.sin(ang) || 1); pts.push(new THREE.Vector3(Math.cos(th) * r * s, Math.min(10.5, y + 0.2 * (1 - Math.abs(Math.sin(ang)))), Math.sin(th) * r * s)); }
    return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.42, 8), brass);
  };
  g.add(meridian(Math.PI / 2), meridian(0));
  // rivetti
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + 0.26; const r = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), brass); r.position.set(Math.cos(a) * 9.0, -0.3, Math.sin(a) * 9.0); g.add(r); }
  // nasale
  const nasal = new THREE.Mesh(new THREE.BoxGeometry(1.4, 4.0, 0.5), brass); nasal.position.set(0, -3.0, 8.2); nasal.rotation.x = 0.12; g.add(nasal);

  // corna: dalla tempia escono di lato, salgono e si curvano verso l'interno
  for (const s of [-1, 1]) {
    const pts = [[s * 7.8, 2.5, -1.5], [s * 11.0, 4.0, -1.8], [s * 13.5, 7.5, -2.0], [s * 13.6, 11.5, -2.0], [s * 11.6, 14.8, -1.8]];
    const geo = tubeVar(THREE, pts, t => 1.7 * (1 - t) + 0.08, 36, 20);
    g.add(new THREE.Mesh(geo, horn));
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), horn); tip.position.set(s * 11.6, 14.8, -1.8); g.add(tip);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 1.0, 20), brass); base.position.set(s * 8.3, 2.6, -1.5); base.rotation.z = s * -Math.PI / 2 - s * 0.2; g.add(base);
  }

  g.position.set(0, 7.8, -2.4);
  g.rotation.x = -0.08;
  // occlusore "testa + capelli" dentro il cappello (solo profondità, invisibile): nell'app l'occlusore del cranio è
  // piccolo all'altezza della tesa e i capelli veri non nascondono nulla, quindi vista dal basso si vedrebbe il retro
  // della tesa/fascia attraverso la fronte. Nell'harness di sviluppo (h.preview) è marrone = capelli.
  { const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), h.preview ? h.mat(0x4a3526, { roughness: 1 }) : new THREE.MeshBasicMaterial({ colorWrite: false }));
    occ.scale.set(8.2, 6, 8.2); occ.position.set(0, -3.5, 0); occ.renderOrder = -1; occ.name = 'headOccluder'; g.add(occ); }
  return g;
}
