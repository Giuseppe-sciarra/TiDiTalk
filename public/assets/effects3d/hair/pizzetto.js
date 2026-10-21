// Tiditalk AR, effetto "pizzetto" — la geometria comune di capelli e barbe sta in _kit_hair.js
import { D2R, beardHair, fin, moustache, rgb, smooth, beardUpdate } from './_kit_hair.js';
export const meta = { label: 'Pizzetto', labelEn: 'Goatee', category: 'barba', icon: '🐐' };
export default function build(THREE, h) {
  const g = new THREE.Group();
  const pal = [rgb(THREE, 0x0a0705), rgb(THREE, 0x22180f), rgb(THREE, 0x4e3e2e)];
  // solo mento, dal labbro inferiore a sotto il mento, che scende un poco a punta
  beardHair(THREE, g, {
    pal, TH: 26, N: 40, seed: 5, segT: 48,
    topY: [[0, -5.3], [10, -5.4], [18, -5.9], [26, -7.2]],
    jawY: [[0, -9.3], [12, -9.1], [20, -8.7], [26, -8.3]],
    thick: (th, v) => 1.0 * (1 - 0.55 * smooth(12, 26, Math.abs(th) / D2R)),
    len: (th) => 2.4 * (1 - smooth(4, 22, Math.abs(th) / D2R)) + 0.2,
    drapeIn: 0.4, tufts: 26, tuftLen: 1.0, tuftR: 0.55, fade: 0.25, tipJag: 0.4,
  });
  // baffetti sottili che si uniscono al pizzetto ai lati della bocca
  moustache(THREE, g, pal, [[0, -2.75, 6.95], [1.3, -2.95, 6.75], [2.5, -3.6, 6.05], [2.9, -4.6, 5.55], [2.6, -5.6, 5.5]], (t) => 0.32 * (t < 0.05 ? 0.6 : 1) * (1 - 0.3 * t) * (t > 0.95 ? (1 - t) / 0.05 + 0.2 : 1), 36);
  return fin(g);
}
// la barba segue la mascella quando si apre la bocca (bs.jawOpen 0..1 calibrato)
export function update(g, bs) { beardUpdate(g, bs); }
