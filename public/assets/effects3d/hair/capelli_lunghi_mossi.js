// Tiditalk AR, effetto "capelli_lunghi_mossi" — la geometria comune di capelli e barbe sta in _kit_hair.js
import { fin, longHair, rgb } from './_kit_hair.js';
export const meta = { label: 'Capelli lunghi mossi', labelEn: 'Long wavy hair', category: 'capelli', icon: '👱‍♀️' };
export default function build(THREE, h) {
  const g = new THREE.Group();
  longHair(THREE, g, { pal: [rgb(THREE, 0x2e1c0a), rgb(THREE, 0x84622e), rgb(THREE, 0xc6a464)], vol: 4.3, side: 3.3, len: -25, N: 26, wave: 1.1, seed: 4 });
  return fin(g);
}
