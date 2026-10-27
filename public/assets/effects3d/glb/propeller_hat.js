// Propeller hat — CC-BY-4.0, IronEqual
// Modello: propeller_hat.glb. 1.8.0: normali lisce, plastica opaca con un filo di vernice.
// 1.8.9: calzato sulla testa vera: prima ai lati restava 1,5 cm di vuoto fra cupola e testa. Ora la cupola è ovale come
// una testa (scala per asse k) e un po' più bassa; fodera scura e riempitivi con la forma della testa vera
// (hatFit in _glbhead.js).
import { loadHead, hatFit } from './_glbhead.js';
export const meta = {"label": "Cappellino a elica", "labelEn": "Propeller hat", "category": "divertenti", "icon": "🚁"};
const P = {"c": [0.0, 2.32145, 0.12092], "s": 2.5557, "k": [1.118, 0.998, 1.175], "p": [0.0, 11.7, -0.15], "r": [1.2, 0, 0]};
const O = {"matColor": {"F44336": [0.82, 0.1, 0.08], "00BCD4": [0.0, 0.62, 0.78], "FFFFFF": [0.85, 0.85, 0.85]}, "rough": 0.6, "env": 0.4, "clearcoat": 0.35, "crease": 40};

export default async function build(THREE, h) {
  const { g, wrap } = await loadHead(THREE, h, new URL('./propeller_hat.glb', import.meta.url).href, P, O, 'propeller_hat');
  return hatFit(THREE, h, g, wrap, { rimY: -5.5, band: 1.6, plug: false });   // (modello con pochi vertici: il tappo tagliava la visiera; basta il riempitivo)
}
