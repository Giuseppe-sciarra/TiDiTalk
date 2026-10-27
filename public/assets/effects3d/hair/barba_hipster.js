// Tiditalk AR, effetto "barba_hipster" — la geometria comune di capelli e barbe sta in _kit_hair.js
import { D2R, beardHair, fin, moustache, rgb, smooth, beardUpdate } from './_kit_hair.js';
export const meta = { label: 'Barba hipster con baffi', labelEn: 'Hipster beard and moustache', category: 'barba', icon: '🧔‍♂️' };
export default function build(THREE, h) {
  const g = new THREE.Group();
  const pal = [rgb(THREE, 0x100703), rgb(THREE, 0x3a200e), rgb(THREE, 0x7a4c28)];
  // castana, voluminosa e arrotondata sotto il mento (fino a y≈-16)
  beardHair(THREE, g, {
    pal, TH: 86, N: 64, seed: 9,
    topY: [[0, -5.4], [10, -5.3], [18, -4.8], [26, -3.6], [36, -2.2], [48, -1.0], [60, 0.2], [72, 1.4], [86, 2.6]],
    jawY: [[0, -9.3], [17, -8.9], [30, -8.2], [48, -7.1], [60, -6.0], [73, -4.6], [86, -2.2]],
    thick: (th, v) => { const a = Math.abs(th) / D2R; return 1.6 + 1.0 * (1 - smooth(30, 86, a)); },
    len: (th) => { const a = Math.abs(th) / D2R; return 7.0 * Math.pow(1 - smooth(10, 84, a), 0.8) + 0.8; },
    belly: (s) => 0.8 + 0.5 * Math.sin(Math.PI * Math.min(1, s * 0.9)) - 0.6 * smooth(0.75, 1, s),
    drapeIn: 0.8, tufts: 90, tuftLen: 1.5, tuftR: 0.8, fade: 0.28, tipJag: 0.8, drapeSegs: 16,
  });
  // baffi a manubrio: partono sotto il naso, girano ai lati della bocca e si arricciano in su
  moustache(THREE, g, pal, [[0, -2.8, 7.0], [1.3, -2.95, 6.8], [2.7, -3.5, 6.0], [3.9, -4.3, 5.4], [4.9, -4.1, 5.0], [5.3, -3.1, 4.95], [4.9, -2.4, 5.1]],
    (t) => (0.5 + 0.35 * Math.sin(Math.PI * Math.min(1, t * 1.5))) * (1 - 0.65 * smooth(0.6, 1, t)) * (t > 0.95 ? (1 - t) / 0.05 + 0.15 : 1), 48);
  return fin(g);
}
// la barba segue la mascella quando si apre la bocca (bs.jawOpen 0..1 calibrato)
export function update(g, bs) { beardUpdate(g, bs); }
