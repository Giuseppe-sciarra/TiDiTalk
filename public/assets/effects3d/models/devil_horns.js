// Corna da diavolo: due corna rosse lucide e ricurve, ancorate ai lati del cranio.
export const meta = { label: 'Corna da diavolo', labelEn: 'Devil horns', category: 'costumi', icon: '😈' };

function tubeVar(THREE, pts, rFn, segs = 40, radial = 24) {
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
  const red = new THREE.MeshPhysicalMaterial({ color: 0xc41424, roughness: .3, metalness: 0, clearcoat: .6, clearcoatRoughness: .3 });
  // cerchietto rosso scuro sopra i capelli veri: dà una base credibile alle corna (come i cerchietti da costume)
  const band = [];
  for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI; band.push(new THREE.Vector3(Math.cos(a) * 8.6, 1.0 + Math.sin(a) * 12.8, -3.0)); }
  const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(band), 72, 0.33, 10);
  const tp = tg.attributes.position; for (let i = 0; i < tp.count; i++) tp.setZ(i, -3.0 + (tp.getZ(i) + 3.0) * 1.5); tg.computeVertexNormals();
  g.add(new THREE.Mesh(tg, h.mat(0x4a0c12, { roughness: .45 })));
  for (const s of [-1, 1]) {
    // base appoggiata sul cerchietto (x≈4.5 → y≈11.9), poi sale in fuori e si curva verso l'interno/avanti
    const pts = [[s * 4.3, 11.2, -3.0], [s * 5.5, 13.3, -2.8], [s * 6.9, 15.6, -2.4], [s * 7.2, 17.7, -1.8], [s * 6.2, 19.4, -1.0]];
    const geo = tubeVar(THREE, pts, t => 1.75 * Math.pow(1 - t, 0.9) + 0.06, 40, 24);
    // anelli di crescita: leggera ondulazione del raggio lungo il corno
    const p = geo.attributes.position, c = new THREE.CatmullRomCurve3(pts.map(q => new THREE.Vector3(...q)), false, 'catmullrom', 0.5);
    for (let i = 0; i < p.count; i++) {
      const t = (i / 25 | 0) / 40;
      const k = 1 + 0.05 * Math.sin(t * 40) * (1 - t);
      const cp = c.getPointAt(Math.min(1, t));
      p.setXYZ(i, cp.x + (p.getX(i) - cp.x) * k, cp.y + (p.getY(i) - cp.y) * k, cp.z + (p.getZ(i) - cp.z) * k);
    }
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, red));
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), red); tip.position.set(s * 6.2, 19.4, -1.0); g.add(tip);
  }
  return g;
}
