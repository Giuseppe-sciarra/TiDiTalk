// Conical straw hat — CC-BY-4.0, MushyDay
// Modello: conical_hat.glb (ottimizzato: <25k triangoli, texture ≤512 px, niente Draco/meshopt).
// 1.8.9: calzato sulla testa vera. Prima il cono stava 1–4 cm sopra la testa (sospeso, soprattutto davanti). Ora è più
// basso e più indietro, un po' inclinato all'indietro come si porta, e l'interno del cono tocca la testa tutto intorno.
// Il sotto del cono (paglia) resta visibile come in quello vero; dove c'è la testa lo nasconde il riempitivo invisibile
// con la forma della testa vera.
import { loadHead, realHeadOccluder, faceCopyOccluder } from './_glbhead.js';
export const meta = {"label": "Cappello di paglia conico", "labelEn": "Conical straw hat", "category": "costumi", "icon": "👒"};
const P = {"c": [-0.06465, -0.18936, -0.35895], "s": 2.3081, "k": [1.128, 1.092, 1.22], "p": [0.0, 7.34, -5.2], "r": [-6.6, 0, 0]};   // c = centro del modello (unità del file), s = scala → cm, k = scala in più per asse, p = posizione sulla testa canonica, r = rotazione (gradi)
const O = {"env": 0.6, "hideMats": ["rope"]};   // 1.8.9: senza il cordino (finiva a mezz’aria davanti alle guance)

export default async function build(THREE, h) {
  const { g } = await loadHead(THREE, h, new URL('./conical_hat.glb', import.meta.url).href, P, O, 'conical_hat');
  g.add(realHeadOccluder(THREE));
  if (h.face) g.add(faceCopyOccluder(THREE, h));
  return g;
}
