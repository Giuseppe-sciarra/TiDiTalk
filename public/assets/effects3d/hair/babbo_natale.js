// Tiditalk AR, effetto "babbo_natale" — la geometria comune di capelli e barbe sta in _kit_hair.js
import { D2R, beardHair, fin, moustache, rgb, smooth, beardUpdate } from './_kit_hair.js';
export const meta = { label: 'Barba di Babbo Natale', labelEn: 'Santa beard', category: 'barba', icon: '🎅' };
export default function build(THREE, h) {
  const g = new THREE.Group();
  // "bianco" = grigio chiaro: con le luci dell'app un bianco vero brucia e perde ogni volume
  const pal = [rgb(THREE, 0x303034), rgb(THREE, 0x76767c), rgb(THREE, 0xa8a8b0)];
  beardHair(THREE, g, {
    pal, TH: 88, N: 40, seed: 11,
    topY: [[0, -5.2], [10, -5.1], [18, -4.6], [26, -3.4], [36, -2.0], [48, -0.6], [60, 0.6], [72, 1.8], [88, 3.0]],
    jawY: [[0, -9.3], [17, -8.9], [30, -8.2], [48, -7.1], [60, -6.0], [73, -4.6], [88, -2.0]],
    thick: (th, v) => { const a = Math.abs(th) / D2R; return 2.2 + 1.2 * (1 - smooth(30, 88, a)); },
    len: (th) => { const a = Math.abs(th) / D2R; return 11.5 * Math.pow(1 - smooth(10, 86, a), 0.7) + 1.2; },
    belly: (s) => 0.9 + 0.7 * Math.sin(Math.PI * Math.min(1, s * 0.85)) - 0.7 * smooth(0.75, 1, s),
    drapeIn: 0.7, tufts: 150, tuftLen: 1.6, tuftR: 0.9, fade: 0.25, tipJag: 1.6, drapeSegs: 18,
  });
  // baffoni folti
  moustache(THREE, g, pal, [[0, -2.8, 7.1], [1.5, -3.0, 6.9], [3.0, -3.6, 6.2], [4.3, -4.5, 5.5], [5.4, -4.8, 5.0], [6.0, -4.2, 4.7]],
    (t) => (0.65 + 0.6 * Math.sin(Math.PI * Math.min(1, t * 1.4))) * (1 - 0.5 * smooth(0.7, 1, t)) * (t > 0.93 ? (1 - t) / 0.07 + 0.2 : 1), 48);
  return fin(g);
}
// la barba segue la mascella quando si apre la bocca (bs.jawOpen 0..1 calibrato)
export function update(g, bs) { beardUpdate(g, bs); }
