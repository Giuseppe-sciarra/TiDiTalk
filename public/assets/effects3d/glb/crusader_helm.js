// Great helm — CC0-1.0, Lucian Pavel
// Modello: crusader_helm.glb. 1.8.0: acciaio (prima sembrava gesso), normali lisce sui lati del cilindro. Posizione sulla testa invariata (provata a testa girata e inclinata).
import { loadHead } from './_glbhead.js';
export const meta = {"label": "Elmo crociato", "labelEn": "Great helm", "category": "costumi", "icon": "⚔️"};
const P = {"c": [0.0002, 1.66711, 0.06222], "s": 106.21, "p": [0.0, 3.0, -2.5], "r": [0, 0, 0]};
const O = {"env": 0.9, "metal": 0.72, "rough": 0.42, "tint": 0.92, "crease": 35};

export default async function build(THREE, h) {
  const { g } = await loadHead(THREE, h, new URL('./crusader_helm.glb', import.meta.url).href, P, O, 'crusader_helm');
  return g;
}
