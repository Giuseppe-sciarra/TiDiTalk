// Occhiali a stella: montatura gialla lucida a forma di stella, lenti dorate semitrasparenti.
import { finish, lens as lensMaterial, plastic } from './_kit_acc.js';
export const meta = { label: 'Occhiali a stella', labelEn: 'Star glasses', category: 'accessori', icon: '🌟' };

function star(THREE, R, r, n = 5, rot = -Math.PI / 2) {
  const s = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) {
    const a = i / (n * 2) * Math.PI * 2 + rot, rr = i % 2 ? r : R;
    i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  s.closePath(); return s;
}

export default function build(THREE, h) {
  const g = new THREE.Group();
  const frameMat = plastic(THREE, 0xffc928, 0.50);
  const lensMat = lensMaterial(THREE, 0x8a5c0a, 0.55, { side: THREE.DoubleSide });

  for (const s of [-1, 1]) {
    const L = new THREE.Group();
    const outer = star(THREE, 3.6, 2.0), inner = star(THREE, 2.9, 1.55);
    outer.holes.push(inner);
    const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: 0.5, bevelEnabled: true, bevelSize: .1, bevelThickness: .1, bevelSegments: 2 }), frameMat); frame.position.z = -0.25;
    const lens = new THREE.Mesh(new THREE.ShapeGeometry(star(THREE, 3.0, 1.6)), lensMat);
    L.add(frame, lens);
    L.position.set(s * 3.3, 2.75, 5.8);
    L.rotation.y = s * 0.22; L.rotation.z = s * 0.1;
    g.add(L);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.5), frameMat); bridge.position.set(0, 3.0, 5.6); g.add(bridge);
  for (const s of [-1, 1]) {
    const pts = [[s * 6.0, 3.4, 5.0], [s * 6.8, 3.3, 4.2], [s * 7.3, 2.8, 1.2], [s * 7.5, 2.3, -1.6], [s * 7.5, 1.9, -2.6], [s * 7.3, 0.8, -4.0]];
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 32, 0.2, 8), frameMat));
  }
  // piccole stelline decorative agli angoli esterni
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(star(THREE, 0.7, 0.3), { depth: 0.3, bevelEnabled: false }), h.mat(0xffffff, { roughness: .3, emissive: 0xfff3b0, emissiveIntensity: .4 }));
    m.position.set(s * 6.3, 4.6, 4.9); m.rotation.y = s * 0.3; g.add(m);
  }
  // occlusore del viso (solo profondità, rigido, rientrato di 0.3 cm): nell'app l'occlusore del viso è nel passaggio
  // trasparente e non nasconde gli oggetti opachi, quindi girando la testa l'asta lontana si vedrebbe attraverso la guancia
  { const f = h.face, geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(Array.from(f.pos), 3)); geo.setIndex(Array.from(f.idx)); geo.computeVertexNormals();
    const pp = geo.attributes.position, nn = geo.attributes.normal;
    for (let i = 0; i < pp.count; i++) pp.setXYZ(i, pp.getX(i) - nn.getX(i) * 0.3, pp.getY(i) - nn.getY(i) * 0.3, pp.getZ(i) - nn.getZ(i) * 0.3);
    const occ = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false })); occ.renderOrder = -1; occ.name = 'faceOccluder'; g.add(occ); }
  return finish(THREE, g);
}
