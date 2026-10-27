// Tiditalk AR, effetto "barba_piena" — la geometria comune di capelli e barbe sta in _kit_hair.js
import { D2R, beardHair, fin, rgb, smooth, beardUpdate } from './_kit_hair.js';
export const meta = { label: 'Barba piena', labelEn: 'Full beard', category: 'barba', icon: '🧔' };
export default function build(THREE, h) {
  const g = new THREE.Group();
  // nera e folta: dalle basette lungo tutta la mascella, guance basse, mento e sotto il mento; bocca libera (niente baffi)
  beardHair(THREE, g, {
    pal: [rgb(THREE, 0x030202), rgb(THREE, 0x110c09), rgb(THREE, 0x4a3a2e)], TH: 86, N: 80, seed: 3,
    topY: [[0, -5.4], [10, -5.3], [18, -4.8], [26, -3.6], [36, -2.2], [48, -1.0], [60, 0.2], [72, 1.4], [86, 2.6]],
    jawY: [[0, -9.3], [17, -8.9], [30, -8.2], [48, -7.1], [60, -6.0], [73, -4.6], [86, -2.2]],
    thick: (th, v) => { const a = Math.abs(th) / D2R; return 1.3 + 0.6 * (1 - smooth(30, 86, a)); },
    len: (th) => { const a = Math.abs(th) / D2R; return 4.2 * (1 - smooth(40, 84, a)) + 0.8; },
    drapeIn: 0.7, tufts: 80, tuftLen: 1.3, tuftR: 0.7, fade: 0.28, tipJag: 0.7,
  });
  return fin(g);
}
// la barba segue la mascella quando si apre la bocca (bs.jawOpen 0..1 calibrato)
export function update(g, bs) { beardUpdate(g, bs); }
