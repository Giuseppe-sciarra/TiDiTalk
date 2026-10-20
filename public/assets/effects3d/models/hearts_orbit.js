// Cuori che girano attorno alla testa: 8 cuori lucidi (rosso, rosa, fucsia) su un'orbita inclinata, ruotano e pulsano;
// quando si sorride pulsano di più.
export const meta = { label: 'Cuori in orbita', labelEn: 'Orbiting hearts', category: 'divertenti', icon: '💕' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const s = new THREE.Shape(), k = 1;
  s.moveTo(0, -1.0 * k);
  s.bezierCurveTo(-0.55 * k, -0.55 * k, -1.2 * k, -0.15 * k, -1.2 * k, 0.35 * k);
  s.bezierCurveTo(-1.2 * k, 0.85 * k, -0.7 * k, 1.05 * k, -0.45 * k, 0.95 * k);
  s.bezierCurveTo(-0.2 * k, 0.85 * k, 0, 0.6 * k, 0, 0.45 * k);
  s.bezierCurveTo(0, 0.6 * k, 0.2 * k, 0.85 * k, 0.45 * k, 0.95 * k);
  s.bezierCurveTo(0.7 * k, 1.05 * k, 1.2 * k, 0.85 * k, 1.2 * k, 0.35 * k);
  s.bezierCurveTo(1.2 * k, -0.15 * k, 0.55 * k, -0.55 * k, 0, -1.0 * k);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: true, bevelSize: .28, bevelThickness: .3, bevelSegments: 3, curveSegments: 12 });
  geo.center();
  const cols = [0xd8122a, 0xff5c93, 0xc2185b, 0xff3d5a, 0xf06292, 0xb0102a, 0xff8fb1, 0xe91e63];
  const hearts = [];
  cols.forEach((c, i) => {
    const m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: c, roughness: .22, clearcoat: 1, clearcoatRoughness: .1, emissive: c, emissiveIntensity: .08 }));
    m.scale.setScalar(1.25 + (i % 3) * 0.2);
    g.add(m); hearts.push({ m, ph: i / cols.length * Math.PI * 2, s0: m.scale.x });
  });
  const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), new THREE.MeshBasicMaterial({ colorWrite: false }));
  occ.scale.set(8.5, 13.0, 9.6); occ.position.set(0, 1.0, -3.2); occ.renderOrder = -1; occ.name = 'hairOccluder'; if (!h.preview) g.add(occ);   // nell'harness coprirebbe il manichino
  g.userData.hearts = hearts;
  update(g, {}, 0.6);
  return g;
}

export function update(g, bs, t) {
  const smile = ((bs.mouthSmileLeft || 0) + (bs.mouthSmileRight || 0)) / 2;
  for (const hh of g.userData.hearts) {
    const a = hh.ph + t * 0.7;
    hh.m.position.set(Math.cos(a) * 12.0, 13.2 - 1.8 * Math.sin(a) + 0.4 * Math.sin(t * 3 + hh.ph), -3.2 + Math.sin(a) * 11.0);
    hh.m.rotation.set(0.15 * Math.sin(t + hh.ph), t * 1.2 + hh.ph, 0.2 * Math.sin(t * 1.3 + hh.ph));
    const beat = 1 + (0.06 + 0.12 * smile) * Math.max(0, Math.sin(t * 6 + hh.ph)) ** 4;
    hh.m.scale.setScalar(hh.s0 * beat);
  }
}
