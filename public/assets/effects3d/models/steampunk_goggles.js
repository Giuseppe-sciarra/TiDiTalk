// Occhialoni steampunk: coppe in ottone con lenti verdastre, rivetti, ponte a vite, cinghia di cuoio attorno alla testa.
export const meta = { label: 'Occhialoni steampunk', labelEn: 'Steampunk goggles', category: 'accessori', icon: '⚙️' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const brass = h.mat(0xb8893c, { roughness: .38, metalness: .9 });
  const brassDark = h.mat(0x7a5a24, { roughness: .45, metalness: .85 });
  const leather = h.mat(0x4a2c17, { roughness: .7 });
  const lensMat = new THREE.MeshPhysicalMaterial({ color: 0x6fb07c, roughness: .05, metalness: .1, transparent: true, opacity: .5, clearcoat: 1, side: THREE.DoubleSide });

  for (const s of [-1, 1]) {
    const C = new THREE.Group();
    // coppa conica (più larga verso il viso), con bordo
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.0, 2.4, 36, 1, true), brass); cup.rotation.x = Math.PI / 2;
    const frontRim = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.3, 10, 40), brass); frontRim.position.z = 1.2;
    const backRim = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.32, 10, 40), brassDark); backRim.position.z = -1.2;
    const lens = new THREE.Mesh(new THREE.CircleGeometry(2.45, 36), lensMat); lens.position.z = 1.05;
    const lens2 = new THREE.Mesh(new THREE.CircleGeometry(2.3, 36), lensMat); lens2.position.z = 0.2;
    C.add(cup, frontRim, backRim, lens, lens2);
    // rivetti sul bordo anteriore
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const r = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), brassDark); r.position.set(Math.cos(a) * 2.6, Math.sin(a) * 2.6, 1.45); C.add(r); }
    // imbottitura di cuoio sul retro (verso il viso)
    const padR = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.45, 10, 40), leather); padR.position.z = -1.5; C.add(padR);
    // lente secondaria ribaltabile su un lato (solo sull'occhio sinistro)
    if (s > 0) {
      const flip = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.16, 8, 30), brass);
      const gl = new THREE.Mesh(new THREE.CircleGeometry(1.4, 30), new THREE.MeshPhysicalMaterial({ color: 0xffb060, roughness: .05, transparent: true, opacity: .5, side: THREE.DoubleSide }));
      flip.add(ring, gl);
      flip.position.set(1.9, 2.4, 1.3); flip.rotation.z = 0.5; flip.rotation.x = -0.4;
      C.add(flip);
      const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.8, 10), brassDark); hinge.position.set(2.2, 1.6, 1.3); hinge.rotation.z = 0.5; C.add(hinge);
    }
    C.position.set(s * 3.2, 2.7, 5.4);
    C.rotation.y = s * 0.2;
    g.add(C);
  }
  // ponte a vite tra le due coppe
  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 2.2, 12), brass); bridge.rotation.z = Math.PI / 2; bridge.position.set(0, 3.0, 5.6); g.add(bridge);
  const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.5, 6), brassDark); nut.rotation.z = Math.PI / 2; nut.position.set(0, 3.0, 5.6); g.add(nut);

  // cinghia di cuoio attorno alla testa (nastro), con fibbia sul lato
  const N = 72, P = [], I = [];
  for (let i = 0; i <= N; i++) {
    const a = Math.PI / 2 + i / N * Math.PI * 2;      // parte davanti
    // ellisse della testa all'altezza degli occhi: x ±7.9, z da -10.6 (nuca) a +5.2 (davanti, sotto le coppe)
    const x = Math.cos(a) * 8.0, z = -2.7 + Math.sin(a) * 7.9;
    const y = 2.9 + 0.5 * Math.max(0, -Math.sin(a));     // dietro sale un po'
    const nx = Math.cos(a), nz = Math.sin(a);
    P.push(x, y - 0.65, z, x + nx * 0.3, y - 0.65, z + nz * 0.3, x + nx * 0.3, y + 0.65, z + nz * 0.3, x, y + 0.65, z);
  }
  for (let i = 0; i < N; i++) for (let k = 0; k < 4; k++) { const a = i * 4 + k, b = i * 4 + (k + 1) % 4, c = (i + 1) * 4 + k, d = (i + 1) * 4 + (k + 1) % 4; I.push(a, c, b, b, c, d); }
  const strapGeo = new THREE.BufferGeometry(); strapGeo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); strapGeo.setIndex(I); strapGeo.computeVertexNormals();
  g.add(new THREE.Mesh(strapGeo, h.mat(0x4a2c17, { roughness: .7, side: THREE.DoubleSide })));
  const buckle = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.12, 6, 16), brass); buckle.scale.set(1, 1.1, 1); buckle.position.set(-8.35, 2.9, -3.5); buckle.rotation.y = Math.PI / 2; g.add(buckle);
  // occlusore del viso (solo profondità, rigido, rientrato di 0.3 cm): nell'app l'occlusore del viso è nel passaggio
  // trasparente e non nasconde gli oggetti opachi, quindi girando la testa l'asta lontana si vedrebbe attraverso la guancia
  { const f = h.face, geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(Array.from(f.pos), 3)); geo.setIndex(Array.from(f.idx)); geo.computeVertexNormals();
    const pp = geo.attributes.position, nn = geo.attributes.normal;
    for (let i = 0; i < pp.count; i++) pp.setXYZ(i, pp.getX(i) - nn.getX(i) * 0.3, pp.getY(i) - nn.getY(i) * 0.3, pp.getZ(i) - nn.getZ(i) * 0.3);
    const occ = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false })); occ.renderOrder = -1; occ.name = 'faceOccluder'; g.add(occ); }
  return g;
}
