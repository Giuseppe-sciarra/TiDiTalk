// Cat-ear headphones — CC-BY-4.0, miren_max
// Modello: catear_headphones.glb. 1.8.0: materiali opachi (prima metallo cromato: mancava metallicFactor → 1), plastica morbida rosa/bianco, normali lisce. Posizione sulla testa invariata (provata a testa girata e inclinata).
import { loadHead } from './_glbhead.js';
export const meta = {"label": "Cuffie con orecchie da gatto", "labelEn": "Cat-ear headphones", "category": "accessori", "icon": "🎧"};
const P = {"c": [0.0, 0.35965, 0.0], "s": 42.974, "p": [0.0, 9.0, -3.3], "r": [0, 0, 0]};
const O = {"env": 0.35, "metal": 0, "matRough": {"Material.001": 0.42, "Material.005": 0.32, "Material.003": 0.3, "Material.006": 0.4, "Material.004": 0.55, "Material.007": 0.6}, "matColor": {"Material.001": [0.93, 0.9, 0.92], "Material.005": [0.96, 0.82, 0.88]}, "emissive": 0.8, "crease": 50};

export default async function build(THREE, h) {
  const { g } = await loadHead(THREE, h, new URL('./catear_headphones.glb', import.meta.url).href, P, O, 'catear_headphones');
  return g;
}
