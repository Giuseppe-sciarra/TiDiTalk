// Tiditalk AR, effetto "caschetto" — la geometria comune di capelli e barbe sta in _kit_hair.js
import { bobHair, fin, rgb } from './_kit_hair.js';
export const meta = { label: 'Caschetto con frangia', labelEn: 'Bob with bangs', category: 'capelli', icon: '💇‍♀️' };
export default function build(THREE, h) {
  const g = new THREE.Group();
  const pal = [rgb(THREE, 0x040305), rgb(THREE, 0x110e15), rgb(THREE, 0x3a3844)];
  bobHair(THREE, g, { palAt: () => pal, vol: 3.6, side: 2.6, N: 46, len: -8.4, seed: 2, gloss: 0.9 });
  return fin(g);
}
