// Tiditalk AR, effetto "barba_mago" — la geometria comune di capelli e barbe sta in _kit_hair.js
import { D2R, beardHair, fin, moustache, rgb, smooth, beardUpdate } from './_kit_hair.js';
export const meta = { label: 'Barba da mago', labelEn: 'Wizard beard', category: 'barba', icon: '🧙' };
export default function build(THREE, h) {
  const g = new THREE.Group();
  const pal = [rgb(THREE, 0x2a2a2e), rgb(THREE, 0x6c6c72), rgb(THREE, 0xa0a0a8)];
  // lunghissima fino al petto, si restringe a punta, ciocche ondulate; la parte bassa passa DAVANTI al busto (z>4)
  beardHair(THREE, g, {
    pal, TH: 86, N: 44, seed: 13,
    topY: [[0, -5.3], [10, -5.2], [18, -4.7], [26, -3.5], [36, -2.1], [48, -0.8], [60, 0.4], [72, 1.6], [86, 2.8]],
    jawY: [[0, -9.3], [17, -8.9], [30, -8.2], [48, -7.1], [60, -6.0], [73, -4.6], [86, -2.2]],
    thick: (th, v) => { const a = Math.abs(th) / D2R; return 1.5 + 0.8 * (1 - smooth(30, 86, a)); },
    len: (th) => { const a = Math.abs(th) / D2R; return 25 * Math.pow(1 - smooth(0, 62, a), 2.0) + 1.0 * (1 - smooth(50, 86, a)) + 0.3; },
    belly: (s, th) => 1.0 + 0.7 * Math.sin(s * 11 + th * 3) * s,
    drapeIn: -1.4, taper: 0.75, tufts: 0, fade: 0.25, tipJag: 1.0, drapeSegs: 30,
  });
  // baffi lunghi che scendono ai lati della bocca (le labbra restano libere)
  moustache(THREE, g, pal, [[0, -2.8, 7.0], [1.4, -3.0, 6.8], [2.9, -3.7, 6.1], [4.2, -5.0, 5.5], [4.8, -6.6, 5.4], [4.7, -8.6, 5.6]],
    (t) => (0.6 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.6))) * (1 - 0.4 * t) * (t > 0.92 ? (1 - t) / 0.08 + 0.15 : 1), 44);
  return fin(g);
}
// la barba segue la mascella quando si apre la bocca (bs.jawOpen 0..1 calibrato)
export function update(g, bs) { beardUpdate(g, bs); }
