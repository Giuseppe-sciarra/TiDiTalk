// Tiditalk AR, effetto "parrucca_arcobaleno" — la geometria comune di capelli e barbe sta in _kit_hair.js
import { TAU, bobHair, fin, mixc, rgb } from './_kit_hair.js';
export const meta = { label: 'Parrucca arcobaleno', labelEn: 'Rainbow wig', category: 'capelli', icon: '🌈' };
export default function build(THREE, h) {
  const g = new THREE.Group();
  // 6 colori a strisce verticali (24 strisce attorno alla testa); per ogni colore: radice scura, tinta piena, luce
  const RB = [0xe0202c, 0xf5820f, 0xf6cc00, 0x22a95c, 0x1b74d8, 0x7d3bb0].map(x => { const c = rgb(THREE, x); return [mixc(c, [0, 0, 0], 0.6), c, mixc(c, [1, 1, 1], 0.35)]; });
  const palAt = (th) => RB[((Math.floor(((th + Math.PI) / TAU) * 24 + 0.5) % 6) + 6) % 6];
  bobHair(THREE, g, { palAt, vol: 3.7, side: 2.9, N: 48, len: -8.6, seed: 5, gloss: 0.5, rough: 0.6, spec: 0.25 });
  return fin(g);
}
