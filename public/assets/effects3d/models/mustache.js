// Baffi a manubrio: scuri, folti al centro e arricciati in su alle punte; seguono il labbro superiore.
export const meta = { label: 'Baffi a manubrio', labelEn: 'Handlebar mustache', category: 'accessori', icon: '👨' };

function tubeVar(THREE, pts, rFn, segs = 40, radial = 20) {
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
  const hair = h.mat(0x22130b, { roughness: .95 });
  for (const s of [-1, 1]) {
    // dal centro sotto il naso, lungo il labbro, poi in fuori e in su con il ricciolo
    const pts = [[0, -2.55, 6.55], [s * 1.3, -2.75, 6.5], [s * 2.6, -2.85, 6.1], [s * 3.8, -2.5, 5.5], [s * 4.7, -1.6, 5.0], [s * 4.9, -0.6, 4.9], [s * 4.3, 0.0, 5.0]];
    const geo = tubeVar(THREE, pts, t => 0.95 * Math.pow(1 - t, 0.55) * (1 - 0.45 * Math.max(0, 1 - t * 4)) + 0.09, 48, 20);
    // "peli": piccola increspatura della superficie
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = 0.04 * Math.sin(x * 9 + y * 11) * Math.cos(z * 7); p.setXYZ(i, x + n, y + n * 0.5, z + n); }
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, hair));
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), hair); tip.position.set(s * 4.3, 0.0, 5.0); g.add(tip);
  }
  // raccordo centrale sotto il naso
  const mid = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 10), hair); mid.scale.set(1.2, 0.75, 0.8); mid.position.set(0, -2.55, 6.5); g.add(mid);
  g.userData.base = g.position.clone();
  return g;
}

export function update(g, bs, t) {
  // segue l'apertura della bocca: si abbassa un poco con la mascella e si allarga col sorriso
  g.position.y = -(bs.jawOpen || 0) * 0.5;
  const sm = ((bs.mouthSmileLeft || 0) + (bs.mouthSmileRight || 0)) / 2;
  g.scale.x = 1 + sm * 0.12;
}
