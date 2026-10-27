// Fisherman hat — CC0-1.0, PierreB3D (Poly Haven)
// Modello: fisherman_hat.glb (ottimizzato: <25k triangoli, texture ≤512 px, niente Draco/meshopt).
// 1.8.9: calzato sulla testa vera. Prima la cupola (tonda, 14 cm) stava sopra la testa e in avanti: su una testa calva
// restava 2–3 cm più su e, vista da sotto, si vedeva l'interno chiaro come un coperchio. Ora la fascia è ovale come una
// testa (scala per asse k), più indietro e più in basso, e tocca la testa vera (calotta del motore) tutto intorno;
// fodera scura, tappo invisibile sull'apertura e riempitivi con la forma della testa vera (hatFit in _glbhead.js).
import { loadHead, hatFit } from './_glbhead.js';
export const meta = {"label": "Cappello da pescatore", "labelEn": "Fisherman hat", "category": "accessori", "icon": "🎣"};
const P = {"c": [-0.00044, 0.02754, 0.00273], "s": 75.716, "k": [1.108, 1.05, 1.225], "p": [0.0, 10.46, -4.08], "r": [0.0, 0, 0]};   // c = centro del modello (unità del file), s = scala → cm, k = scala in più per asse, p = posizione sulla testa canonica, r = rotazione (gradi)
const O = {"env": 0.6};

export default async function build(THREE, h) {
  const { g, wrap } = await loadHead(THREE, h, new URL('./fisherman_hat.glb', import.meta.url).href, P, O, 'fisherman_hat');
  return hatFit(THREE, h, g, wrap, { rimY: -2.1 });
}
