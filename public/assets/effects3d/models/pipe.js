// Pipa di legno all'angolo della bocca: cannello ricurvo, fornello in radica, ghiera metallica e un filo di fumo.
export const meta = { label: 'Pipa', labelEn: 'Pipe', category: 'accessori', icon: '🪵' };

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
  const wood = new THREE.MeshPhysicalMaterial({ color: 0x7a3f1e, roughness: .35, clearcoat: .7, clearcoatRoughness: .25 });
  const stemMat = h.mat(0x1a1a1a, { roughness: .35 });
  const metal = h.mat(0xd5d8dc, { roughness: .3, metalness: .9 });
  const s = 1;   // angolo sinistro della bocca di chi la porta (+X)
  const M = [s * 2.5, -4.4, 4.6];   // angolo della bocca
  // cannello: dal bocchino (dentro le labbra) in fuori e in basso, con curva
  const stemPts = [[s * 2.0, -4.3, 4.3], [s * 3.4, -4.7, 5.6], [s * 5.0, -5.6, 7.2], [s * 6.4, -6.9, 8.4]];
  g.add(new THREE.Mesh(tubeVar(THREE, stemPts, t => 0.32 + 0.1 * t, 24, 14), stemMat));
  // cannello in legno (parte finale verso il fornello)
  const woodPts = [[s * 6.2, -6.7, 8.3], [s * 7.2, -7.6, 9.0], [s * 8.0, -8.4, 9.4]];
  g.add(new THREE.Mesh(tubeVar(THREE, woodPts, t => 0.45 + 0.15 * t, 16, 14), wood));
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 16), metal);
  ring.position.set(s * 6.3, -6.8, 8.35); ring.lookAt(s * 7.2, -7.6, 9.0); ring.rotateX(Math.PI / 2); g.add(ring);
  // fornello: lathe in radica, leggermente inclinato
  const bowl = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [1.1, 0], [1.55, 0.6], [1.7, 1.6], [1.6, 2.7], [1.45, 3.0], [1.2, 3.0], [1.15, 2.4], [1.1, 2.4], [0, 2.4]].map(p => new THREE.Vector2(p[0], p[1])), 32), wood);
  bowl.position.set(s * 8.2, -9.6, 9.6); bowl.rotation.z = -s * 0.15; bowl.rotation.x = 0.15;
  g.add(bowl);
  // tabacco acceso in cima
  const ember = new THREE.Mesh(new THREE.CircleGeometry(1.05, 24), new THREE.MeshStandardMaterial({ color: 0x3a2412, emissive: 0xff5a1a, emissiveIntensity: .35, roughness: 1 }));
  ember.position.set(s * 8.2, -9.6 + 2.45, 9.6); ember.rotation.x = -Math.PI / 2 + 0.15; ember.rotation.z = -s * 0.15; g.add(ember);
  // fumo: tre sfere traslucide che salgono (animate)
  const smokeMat = new THREE.MeshBasicMaterial({ color: 0xf4f4f4, transparent: true, opacity: .35, depthWrite: false });
  const puffs = [];
  for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.45 + i * 0.18, 12, 10), smokeMat.clone()); p.position.set(s * 8.2, -7.0 + i * 1.3, 9.6); g.add(p); puffs.push(p); }
  g.userData.puffs = puffs; g.userData.s = s;
  return g;
}

export function update(g, bs, t) {
  const s = g.userData.s;
  g.userData.puffs.forEach((p, i) => {
    const ph = (t * 0.5 + i * 0.25) % 1;
    p.position.set(s * (8.2 + Math.sin(ph * 6 + i) * 0.5), -7.2 + ph * 7.5, 9.6 + Math.cos(ph * 5) * 0.3);
    const k = 0.6 + ph * 1.6; p.scale.setScalar(k);
    p.material.opacity = 0.35 * (1 - ph);
  });
}
