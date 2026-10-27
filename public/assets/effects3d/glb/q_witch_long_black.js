// Long black hair — CC0-1.0, Quaternius (quaternius.com)
// Modello: q_witch_long_black.glb — rifatto per Tiditalk 1.8.0: in cm sul viso canonico, appoggiato sul cranio (non dentro la
// fronte), guscio lisciato (niente facce piatte) con texture a fili e radici più scure, ciocche con bordi morbidi sopra,
// niente ciocche davanti agli occhi.
import { buildWig } from './_wig.js';
export const meta = {"label": "Capelli lunghi neri", "labelEn": "Long black hair", "category": "capelli", "icon": "💇"};

export default function build(THREE, h) {
  return buildWig(THREE, h, new URL('./q_witch_long_black.glb', import.meta.url).href, { name: 'q_witch_long_black', rough: 0.5, spec: 0.4, specColor: 0xb8bcd0, sheen: 0.35, sheenColor: 0x6a6880, inner: 0.6, env: 0.2 });
}
