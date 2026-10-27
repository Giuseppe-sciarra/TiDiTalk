// Tiditalk AR, effetto "barba_sottogola" — la geometria comune di capelli e barbe sta in _kit_hair.js
import { D2R, beardHair, fin, rgb, smooth, beardUpdate } from './_kit_hair.js';
export const meta = { label: 'Barba sottogola', labelEn: 'Chin strap beard', category: 'barba', icon: '🧔‍♂️' };
export default function build(THREE, h) {
  const g = new THREE.Group();
  // striscia sottile lungo la mascella da basetta a basetta (sopra e sotto il bordo della mandibola)
  beardHair(THREE, g, {
    pal: [rgb(THREE, 0x060504), rgb(THREE, 0x1a140f), rgb(THREE, 0x3c3128)], TH: 88, N: 90, seed: 7,
    topY: [[0, -7.4], [17, -7.1], [30, -6.4], [48, -5.2], [60, -4.0], [72, -2.4], [78, -0.4], [88, 2.4]],
    jawY: [[0, -9.3], [17, -8.9], [30, -8.2], [48, -7.1], [60, -6.0], [73, -4.6], [80, -2.6], [88, -0.4]],
    thick: (th, v) => 0.95,
    len: (th) => 1.8 * (1 - smooth(50, 86, Math.abs(th) / D2R)) + 0.5,
    drapeIn: 0.5, tufts: 0, fade: 0.35, tipJag: 0.25, drapeSegs: 8,
  });
  return fin(g);
}
// la barba segue la mascella quando si apre la bocca (bs.jawOpen 0..1 calibrato)
export function update(g, bs) { beardUpdate(g, bs); }
