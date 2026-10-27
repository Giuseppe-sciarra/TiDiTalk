// Tiditalk AR, effetto "ricci_medi" — la geometria comune di capelli e barbe sta in _kit_hair.js
// 1.8.9: calzati fuori dalla calotta del cranio vero del motore (useCranium): prima il cuscino di ricci, fatto sul profilo
// piccolo della testa, in cima stava dentro la testa vera (il 22 % della superficie si sarebbe perso).
import { afroHair, fin, rgb, useCranium } from './_kit_hair.js';
export const meta = { label: 'Ricci medi', labelEn: 'Medium curly hair', category: 'capelli', icon: '👩‍🦱' };
export default function build(THREE, h) { useCranium(0.25); try { return make(THREE, h); } finally { useCranium(0); } }
function make(THREE, h) {
  const g = new THREE.Group();
  // caschetto riccio fino alla mascella: stesso sistema dell'afro (cuscino scuro + riccioli), ma più aderente e lungo ai lati
  afroHair(THREE, g, {
    pal: [rgb(THREE, 0x120703), rgb(THREE, 0x4a2612), rgb(THREE, 0x8a5428)], vol: 3.4, n: 262, rMin: 1.2, rMax: 1.8, seed: 23,
    hairline: [[0, 8.1], [25, 7.7], [45, 6.4], [55, 5.0], [62, 3.2], [70, -0.5], [80, -5.0], [95, -7.4], [130, -7.6], [180, -7.2]],
  });
  return fin(g);
}
