// Football helmet — CC-BY-4.0, IronEqual
// Modello: football_helmet.glb. 1.8.0: guscio verniciato (base opaca + vernice lucida sottile), normali lisce. Posizione sulla testa invariata (provata a testa girata e inclinata).
import { loadHead } from './_glbhead.js';
export const meta = {"label": "Casco da football", "labelEn": "Football helmet", "category": "costumi", "icon": "🏈"};
const P = {"c": [-0.00068, 0.02565, -0.06417], "s": 21.211, "p": [0.0, 3.0, -2.5], "r": [0, 0, 0]};
const O = {"env": 0.5, "rough": 0.5, "clearcoat": 0.8, "matRough": {"lambert3SG": 0.7}, "crease": 40};

export default async function build(THREE, h) {
  const { g } = await loadHead(THREE, h, new URL('./football_helmet.glb', import.meta.url).href, P, O, 'football_helmet');
  return g;
}
