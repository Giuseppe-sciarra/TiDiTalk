// Blond hair — CC0-1.0, Quaternius (quaternius.com)
// Modello: q_casual_blond.glb — rifatto per Tiditalk 1.8.0: in cm sul viso canonico, appoggiato sul cranio (non dentro la
// fronte), guscio lisciato (niente facce piatte) con texture a fili e radici più scure, ciocche con bordi morbidi sopra,
// niente ciocche davanti agli occhi.
import { buildWig } from './_wig.js';
export const meta = {"label": "Capelli biondi", "labelEn": "Blond hair", "category": "capelli", "icon": "💇"};

export default function build(THREE, h) {
  return buildWig(THREE, h, new URL('./q_casual_blond.glb', import.meta.url).href, { name: 'q_casual_blond', rough: 0.58, spec: 0.25, specColor: 0xf2e2c0, sheen: 0.3, sheenColor: 0xe0c690, inner: 0.55, env: 0.16 });
}
