// Occhiali a cuore rosa: montatura in plastica lucida, lenti rosa trasparenti.
export const meta = { label: 'Occhiali a cuore', labelEn: 'Heart sunglasses', category: 'accessori', icon: '😍' };

function heart(THREE, size) {
  const s = new THREE.Shape();
  const k = size;
  s.moveTo(0, -1.0 * k);
  s.bezierCurveTo(-0.55 * k, -0.55 * k, -1.2 * k, -0.15 * k, -1.2 * k, 0.35 * k);
  s.bezierCurveTo(-1.2 * k, 0.85 * k, -0.7 * k, 1.05 * k, -0.45 * k, 0.95 * k);
  s.bezierCurveTo(-0.2 * k, 0.85 * k, 0, 0.6 * k, 0, 0.45 * k);
  s.bezierCurveTo(0, 0.6 * k, 0.2 * k, 0.85 * k, 0.45 * k, 0.95 * k);
  s.bezierCurveTo(0.7 * k, 1.05 * k, 1.2 * k, 0.85 * k, 1.2 * k, 0.35 * k);
  s.bezierCurveTo(1.2 * k, -0.15 * k, 0.55 * k, -0.55 * k, 0, -1.0 * k);
  return s;
}

export default function build(THREE, h) {
  const g = new THREE.Group();
  const frameMat = new THREE.MeshPhysicalMaterial({ color: 0xff4f9a, roughness: .25, clearcoat: 1, clearcoatRoughness: .1 });
  const lensMat = new THREE.MeshPhysicalMaterial({ color: 0xff8fc4, roughness: .05, transparent: true, opacity: .5, clearcoat: 1, side: THREE.DoubleSide });

  for (const s of [-1, 1]) {
    const L = new THREE.Group();
    const outer = heart(THREE, 2.75), inner = heart(THREE, 2.2);
    outer.holes.push(inner);
    const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: 0.5, bevelEnabled: true, bevelSize: .12, bevelThickness: .1, bevelSegments: 2, curveSegments: 14 }), frameMat);
    frame.position.z = -0.25;
    const lens = new THREE.Mesh(new THREE.ShapeGeometry(heart(THREE, 2.3), 14), lensMat);
    L.add(frame, lens);
    L.position.set(s * 3.2, 2.5, 5.8);
    L.rotation.y = s * 0.22;
    L.rotation.z = s * -0.12;   // cuori leggermente inclinati verso l'esterno
    g.add(L);
  }
  // ponte
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 0.5), frameMat); bridge.position.set(0, 3.0, 5.6); g.add(bridge);
  // aste
  for (const s of [-1, 1]) {
    const pts = [[s * 5.9, 3.3, 5.0], [s * 6.7, 3.2, 4.3], [s * 7.3, 2.8, 1.2], [s * 7.5, 2.3, -1.6], [s * 7.5, 1.9, -2.6], [s * 7.3, 0.8, -4.0]];
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 32, 0.22, 8);
    g.add(new THREE.Mesh(geo, frameMat));
  }
  // occlusore del viso (solo profondità, rigido, rientrato di 0.3 cm): nell'app l'occlusore del viso è nel passaggio
  // trasparente e non nasconde gli oggetti opachi, quindi girando la testa l'asta lontana si vedrebbe attraverso la guancia
  { const f = h.face, geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(Array.from(f.pos), 3)); geo.setIndex(Array.from(f.idx)); geo.computeVertexNormals();
    const pp = geo.attributes.position, nn = geo.attributes.normal;
    for (let i = 0; i < pp.count; i++) pp.setXYZ(i, pp.getX(i) - nn.getX(i) * 0.3, pp.getY(i) - nn.getY(i) * 0.3, pp.getZ(i) - nn.getZ(i) * 0.3);
    const occ = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false })); occ.renderOrder = -1; occ.name = 'faceOccluder'; g.add(occ); }
  return g;
}
