// Tiditalk AR, effetto "afro" — la geometria comune di capelli e barbe sta in _kit_hair.js
import { afroHair, fin, rgb } from './_kit_hair.js';
export const meta = { label: 'Afro', labelEn: 'Afro', category: 'capelli', icon: '🧑🏾‍🦱' };
export default function build(THREE, h) {
  const g = new THREE.Group();
  afroHair(THREE, g, { pal: [rgb(THREE, 0x0e0806), rgb(THREE, 0x2a1910), rgb(THREE, 0x5a3a24)], vol: 6.2, n: 250, rMin: 1.55, rMax: 2.4, seed: 11, hairline: [[0, 7.9], [25, 7.5], [45, 6.2], [60, 4.2], [72, 1.6], [84, -1.6], [100, -3.6], [130, -4.8], [160, -5.4], [180, -5.6]] });
  return fin(g);
}
