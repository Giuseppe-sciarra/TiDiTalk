// Naso da clown: pallina rossa lucida sulla punta del naso, con riflesso morbido.
export const meta = { label: 'Naso da clown', labelEn: 'Clown nose', category: 'accessori', icon: '🤡' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const nose = new THREE.Mesh(new THREE.SphereGeometry(2.3, 36, 28),
    new THREE.MeshPhysicalMaterial({ color: 0xe0202a, roughness: .28, clearcoat: .9, clearcoatRoughness: .15, sheen: .6, sheenColor: 0xff8080 }));
  // leggermente schiacciata e arretrata sul naso vero (punta a (0,-1.1,7.5))
  nose.scale.set(1, 0.95, 0.9);
  nose.position.set(0, -1.0, 6.55);
  g.add(nose);
  g.userData.nose = nose;
  return g;
}

export function update(g, bs, t) {
  // si gonfia un pelo quando si gonfiano le guance / si sorride
  const k = 1 + 0.12 * (bs.cheekPuff || 0) + 0.05 * ((bs.mouthSmileLeft || 0) + (bs.mouthSmileRight || 0)) / 2;
  g.userData.nose.scale.set(k, 0.95 * k, 0.9 * k);
}
