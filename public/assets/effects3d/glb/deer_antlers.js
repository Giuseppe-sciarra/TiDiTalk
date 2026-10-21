// Deer antlers — CC-BY-4.0, IronEqual
// Modello: deer_antlers.glb. 1.8.0: normali lisce (niente facce piatte), corno opaco. Posizione sulla testa invariata (provata a testa girata e inclinata).
import { loadHead } from './_glbhead.js';
export const meta = {"label": "Corna di cervo", "labelEn": "Deer antlers", "category": "divertenti", "icon": "🦌"};
const P = {"c": [0.0, 7.78214, 3.83001], "s": 1.0839, "p": [0.0, 17.96, -0.5], "r": [0, 0, 0]};
const O = {"color": [0.36, 0.25, 0.16], "rough": 0.85, "env": 0.3, "crease": 55};

export default async function build(THREE, h) {
  const { g } = await loadHead(THREE, h, new URL('./deer_antlers.glb', import.meta.url).href, P, O, 'deer_antlers');
  return g;
}
