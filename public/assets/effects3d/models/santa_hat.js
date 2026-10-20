// Cappello di Babbo Natale: cono rosso morbido che ricade di lato, bordo di pelliccia bianca e pompon.
export const meta = { label: 'Cappello di Babbo Natale', labelEn: 'Santa hat', category: 'costumi', icon: '🎅' };

function tubeVar(THREE, pts, rFn, segs = 48, radial = 32) {
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

function fluffy(THREE, geo, amp, freq) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = amp * (Math.sin(x * freq + y * freq * 0.7) * Math.cos(z * freq * 0.9 - y * freq * 0.5) + 0.5 * Math.sin(x * freq * 2.1 + z * freq * 1.7));
    const nx = geo.attributes.normal ? geo.attributes.normal.getX(i) : x, ny = geo.attributes.normal ? geo.attributes.normal.getY(i) : y, nz = geo.attributes.normal ? geo.attributes.normal.getZ(i) : z;
    p.setXYZ(i, x + nx * n, y + ny * n, z + nz * n);
  }
  geo.computeVertexNormals();
  return geo;
}

export default function build(THREE, h) {
  const g = new THREE.Group();
  const velvet = h.mat(0xa8121d, { roughness: .8 });
  const fur = h.mat(0xeee8de, { roughness: 1 });

  // cono che sale e poi ricade sul lato destro (+X) con la punta in giù
  const spine = [[0, 0, 0], [0, 6, 0], [0.8, 11, -0.6], [3.5, 15, -1.6], [8.0, 15.8, -2.4], [12.0, 13.0, -2.4], [13.6, 9.0, -1.8]];
  g.add(new THREE.Mesh(tubeVar(THREE, spine, t => 8.7 * Math.pow(1 - t, 1.25) + 0.25, 64, 40), velvet));
  // tappo inferiore
  g.add(new THREE.Mesh(new THREE.CircleGeometry(8.7, 48), velvet).rotateX(Math.PI / 2));

  // bordo di pelliccia: toro spesso con superficie "pelosa"
  const trimGeo = fluffy(THREE, new THREE.TorusGeometry(8.9, 2.0, 24, 96), 0.22, 2.2);
  const trim = new THREE.Mesh(trimGeo, fur); trim.rotation.x = Math.PI / 2; trim.position.y = 0.3;
  g.add(trim);

  // pompon in punta
  const pomGeo = fluffy(THREE, new THREE.SphereGeometry(2.3, 32, 24), 0.3, 2.6);
  const pom = new THREE.Mesh(pomGeo, fur); pom.position.set(13.8, 7.6, -1.7); g.add(pom);

  g.position.set(0, 8.0, -2.4);
  g.rotation.x = -0.14;
  g.userData.pom = pom;
  // occlusore "testa + capelli" dentro il cappello (solo profondità, invisibile): nell'app l'occlusore del cranio è
  // piccolo all'altezza della tesa e i capelli veri non nascondono nulla, quindi vista dal basso si vedrebbe il retro
  // della tesa/fascia attraverso la fronte. Nell'harness di sviluppo (h.preview) è marrone = capelli.
  { const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), h.preview ? h.mat(0x4a3526, { roughness: 1 }) : new THREE.MeshBasicMaterial({ colorWrite: false }));
    occ.scale.set(7.8, 6, 7.8); occ.position.set(0, -2.5, 0); occ.renderOrder = -1; occ.name = 'headOccluder'; g.add(occ); }
  return g;
}

export function update(g, bs, t) {
  const p = g.userData.pom; if (!p) return;
  p.position.x = 13.8 + Math.sin(t * 1.8) * 0.25; p.position.y = 7.6 + Math.cos(t * 2.3) * 0.15;
}
