// Propeller hat — CC-BY-4.0, IronEqual
// Modello: propeller_hat.glb. 1.8.0: normali lisce, plastica opaca con un filo di vernice. Posizione sulla testa invariata (provata a testa girata e inclinata).
import { loadHead } from './_glbhead.js';
export const meta = {"label": "Cappellino a elica", "labelEn": "Propeller hat", "category": "divertenti", "icon": "🚁"};
const P = {"c": [0.0, 2.32145, 0.12092], "s": 2.5557, "p": [0.0, 12.65, 0.0], "r": [0, 0, 0]};
const O = {"matColor": {"F44336": [0.82, 0.1, 0.08], "00BCD4": [0.0, 0.62, 0.78], "FFFFFF": [0.85, 0.85, 0.85]}, "rough": 0.6, "env": 0.4, "clearcoat": 0.35, "crease": 40};

export default async function build(THREE, h) {
  const { g } = await loadHead(THREE, h, new URL('./propeller_hat.glb', import.meta.url).href, P, O, 'propeller_hat');
  return g;
}
