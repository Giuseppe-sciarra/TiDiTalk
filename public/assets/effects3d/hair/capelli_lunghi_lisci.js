// Tiditalk AR, effetto "capelli_lunghi_lisci" — la geometria comune di capelli e barbe sta in _kit_hair.js
import { fin, longHair, rgb } from './_kit_hair.js';
export const meta = { label: 'Capelli lunghi lisci', labelEn: 'Long straight hair', category: 'capelli', icon: '👩' };
export default function build(THREE, h) {
  const g = new THREE.Group();
  longHair(THREE, g, { pal: [rgb(THREE, 0x100703), rgb(THREE, 0x2e180a), rgb(THREE, 0x6e4626)], vol: 4.0, side: 3.0, len: -25, N: 30, wave: 0, seed: 1 });
  return fin(g);
}
