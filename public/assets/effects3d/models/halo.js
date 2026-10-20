// Aureola: anello dorato luminoso che fluttua sopra la testa e ondeggia piano.
export const meta = { label: 'Aureola', labelEn: 'Halo', category: 'accessori', icon: '😇' };

export default function build(THREE, h) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(6.8, 0.75, 20, 72),
    new THREE.MeshStandardMaterial({ color: 0xffe27a, emissive: 0xffc83d, emissiveIntensity: .9, roughness: .3, metalness: .6 }));
  ring.rotation.x = Math.PI / 2;
  // alone morbido: secondo toro più grande, trasparente e additivo
  const glow = new THREE.Mesh(new THREE.TorusGeometry(6.8, 1.6, 16, 72),
    new THREE.MeshBasicMaterial({ color: 0xffd45a, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.rotation.x = Math.PI / 2;
  g.add(ring, glow);
  g.position.set(0, 15.0, -2.8);
  g.rotation.x = -0.18;
  g.userData.base = g.position.clone();
  return g;
}

export function update(g, bs, t) {
  const b = g.userData.base;
  g.position.y = b.y + Math.sin(t * 1.6) * 0.5;
  g.rotation.z = Math.sin(t * 0.9) * 0.08;
  g.rotation.x = -0.18 + Math.cos(t * 1.2) * 0.06;
}
