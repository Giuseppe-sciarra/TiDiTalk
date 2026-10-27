// Elf hat — CC0-1.0, Teh_Bucket
// Modello: elf_hat.glb (ottimizzato: <25k triangoli, texture ≤512 px, niente Draco/meshopt).
// 1.8.9: calzato sulla testa vera. Prima la base (tonda, centrata sul viso) stava in avanti: davanti si staccava dalla
// fronte di 2–3 cm e dietro entrava nella testa. Ora la base è ovale come una testa (scala per asse k), più indietro,
// inclinata come si porta e tocca la testa tutto intorno; fodera scura, tappo invisibile sull'apertura e riempitivi
// con la forma della testa vera (hatFit in _glbhead.js).
import { loadHead, hatFit } from './_glbhead.js';
export const meta = {"label": "Cappello da elfo", "labelEn": "Elf hat", "category": "costumi", "icon": "🧝"};
const P = {"c": [0.00794, 0.25029, 0.00013], "s": 50.912, "k": [0.962, 0.988, 1.137], "p": [0.0, 18.37, -5.6], "r": [-6.0, 0, 0]};   // c = centro del modello (unità del file), s = scala → cm, k = scala in più per asse, p = posizione sulla testa canonica, r = rotazione (gradi)
const O = {"env": 0.6};

export default async function build(THREE, h) {
  const { g, wrap } = await loadHead(THREE, h, new URL('./elf_hat.glb', import.meta.url).href, P, O, 'elf_hat');
  return hatFit(THREE, h, g, wrap, { rimY: -12.8, band: 1.8 });
}
