// Tiditalk AR, effetto "afro_rosso" — la geometria comune di capelli e barbe sta in _kit_hair.js
import { afroHair, fin, rgb, tubeGeo } from './_kit_hair.js';
export const meta = { label: 'Afro rosso con occhiali', labelEn: 'Red afro with round shades', category: 'capelli', icon: '🤡' };
export default function build(THREE, h) {
  const g = new THREE.Group();
  afroHair(THREE, g, { pal: [rgb(THREE, 0x4a0606), rgb(THREE, 0xc0161a), rgb(THREE, 0xf2573a)], vol: 6.2, n: 232, rMin: 1.55, rMax: 2.4, seed: 11, hairline: [[0, 7.9], [25, 7.5], [45, 6.2], [60, 4.2], [72, 1.6], [84, -1.6], [100, -3.6], [130, -4.8], [160, -5.4], [180, -5.6]] });
  // occhiali tondi verdi (stile festa): montatura sul ponte del naso, aste verso le orecchie
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const frame = new THREE.MeshStandardMaterial({ color: 0x0f7a2a, roughness: 0.35, metalness: 0.1, envMapIntensity: 0.5 });
  const lensM = new THREE.MeshPhysicalMaterial({ color: 0x2e9e4a, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.55, side: THREE.DoubleSide, envMapIntensity: 0.8 });
  const gl = new THREE.Group();
  for (const sx of [-1, 1]) {
    const e = new THREE.Group();
    e.position.set(sx * 3.1, 2.6, 5.5); e.rotation.y = -sx * 0.3;
    e.add(new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.32, 10, 36), frame));
    e.add(new THREE.Mesh(new THREE.CircleGeometry(2.4, 36), lensM));
    gl.add(e);
    // asta: dal bordo esterno della montatura all'orecchio
    const arm = tubeGeo(THREE, [V(sx * 5.45, 2.65, 4.85), V(sx * 7.2, 2.7, 2.6), V(sx * 7.95, 2.5, -0.5), V(sx * 8.05, 2.1, -2.6), V(sx * 8.0, 0.6, -3.6)], (t) => 0.22 * (t > 0.95 ? (1 - t) / 0.05 : 1), 20, 6);
    gl.add(new THREE.Mesh(arm, frame));
  }
  gl.add(new THREE.Mesh(tubeGeo(THREE, [V(-0.8, 3.1, 6.1), V(0, 3.5, 6.4), V(0.8, 3.1, 6.1)], (t) => 0.26, 8, 6), frame)); // ponte
  g.add(gl);
  return fin(g);
}
