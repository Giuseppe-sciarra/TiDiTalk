// Disco volante con alieno sopra la testa: piattino metallico con luci colorate che girano, cupola di vetro con un alieno verde
// che saluta, raggio traente che scende sulla testa; il disco ondeggia.
export const meta = { label: 'UFO con alieno', labelEn: 'UFO with alien', category: 'divertenti', icon: '🛸' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const ufo = new THREE.Group();
  const hull = h.mat(0xa9b0ba, { roughness: .28, metalness: .9 });
  const hullDark = h.mat(0x5d646e, { roughness: .35, metalness: .85 });
  // piattino: profilo lenticolare (lathe), sotto più scuro
  ufo.add(new THREE.Mesh(new THREE.LatheGeometry([[0.01, 1.1], [3.5, 1.05], [6.8, 0.6], [9.0, 0.0], [9.2, -0.25]].map(p => new THREE.Vector2(p[0], p[1])), 64), hull));
  ufo.add(new THREE.Mesh(new THREE.LatheGeometry([[9.2, -0.25], [8.6, -0.7], [6.0, -1.3], [3.2, -1.6], [0.01, -1.65]].map(p => new THREE.Vector2(p[0], p[1])), 64), hullDark));
  // anello di bordo
  const rim = new THREE.Mesh(new THREE.TorusGeometry(9.1, 0.28, 8, 96), h.mat(0xd6dbe2, { roughness: .2, metalness: .95 })); rim.rotation.x = Math.PI / 2; rim.position.y = -0.15; ufo.add(rim);
  // luci sul bordo
  const lightCols = [0xff4d6d, 0xffd23f, 0x3fd2ff, 0x7dff6a];
  const lights = [];
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    const m = new THREE.MeshStandardMaterial({ color: lightCols[i % 4], emissive: lightCols[i % 4], emissiveIntensity: 1 });
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), m); l.position.set(Math.cos(a) * 7.6, 0.25, Math.sin(a) * 7.6); ufo.add(l); lights.push(m);
  }
  // alieno: testa a goccia rovesciata, occhioni neri lucidi, antenne, corpo e braccio che saluta
  const alien = new THREE.Group();
  const skin = h.mat(0x7ed957, { roughness: .55 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(1.6, 24, 18), skin); head.scale.set(1.1, 1.0, 0.95); head.position.y = 3.6; alien.add(head);
  const chin = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), skin); chin.position.set(0, 2.5, 0.25); alien.add(chin);
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0x0d0d12, roughness: .05, clearcoat: 1 });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), eyeMat); e.scale.set(1.25, 0.8, 0.55); e.position.set(s * 0.72, 3.55, 1.25); e.rotation.z = s * 0.45; alien.add(e);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); hl.position.set(s * 0.55, 3.75, 1.6); alien.add(hl);
    const ant = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(s * 0.6, 4.9, 0), new THREE.Vector3(s * 1.0, 5.8, 0.1), new THREE.Vector3(s * 1.5, 6.4, 0.2)]), 10, 0.08, 5), skin); alien.add(ant);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffb000, emissiveIntensity: .8 })); ball.position.set(s * 1.5, 6.45, 0.2); alien.add(ball);
  }
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 1.0, 6, 12), skin); body.position.y = 1.4; alien.add(body);
  const arm = new THREE.Group(); arm.position.set(1.0, 1.9, 0.2);
  const armM = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.3, 4, 8), skin); armM.position.y = 0.75; arm.add(armM);
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), skin); hand.position.y = 1.55; arm.add(hand);
  alien.add(arm);
  alien.position.y = 0.6; ufo.add(alien);
  // cupola di vetro
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4.0, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ color: 0xbfe8ff, roughness: .03, transparent: true, opacity: .25, clearcoat: 1, depthWrite: false }));
  dome.scale.y = 1.15; dome.position.y = 0.9; ufo.add(dome);
  const domeRing = new THREE.Mesh(new THREE.TorusGeometry(4.0, 0.25, 8, 64), hullDark); domeRing.rotation.x = Math.PI / 2; domeRing.position.y = 0.95; ufo.add(domeRing);
  // raggio traente: cono aperto additivo verso la testa
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 7.6, 5.8, 40, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x9dffb0, transparent: true, opacity: .16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = -4.6; ufo.add(beam);
  ufo.position.set(0, 19.4, -2.0); ufo.rotation.x = 0.18; ufo.scale.setScalar(0.82);   // compatto: sta nel frame anche con poca aria sopra la testa
  g.add(ufo);
  const occ = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), new THREE.MeshBasicMaterial({ colorWrite: false }));
  occ.scale.set(8.5, 13.0, 9.6); occ.position.set(0, 1.0, -3.2); occ.renderOrder = -1; occ.name = 'hairOccluder'; if (!h.preview) g.add(occ);
  g.userData = { ufo, lights, arm, beam };
  update(g, {}, 0.4);
  return g;
}

export function update(g, bs, t) {
  const u = g.userData;
  u.ufo.position.y = 19.4 + Math.sin(t * 1.4) * 0.5; u.ufo.position.x = Math.sin(t * 0.7) * 1.2;
  u.ufo.rotation.z = Math.sin(t * 1.1) * 0.08;
  u.lights.forEach((m, i) => { m.emissiveIntensity = 0.3 + 1.4 * Math.max(0, Math.sin(t * 5 - i * 0.8)); });
  u.arm.rotation.z = -0.5 + 0.6 * Math.sin(t * 6);
  u.beam.material.opacity = 0.12 + 0.06 * Math.sin(t * 7);
}
