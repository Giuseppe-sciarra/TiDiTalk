// Dark side bob — CC0-1.0, makehuman_system (MakeHuman community asset repository)
// Modello: mh_bob01.glb — rifatto per Tiditalk 1.8.0: in cm sul viso canonico, calotta appoggiata sul cranio (non dentro la
// fronte), frangia di lato rifatta sopra le sopracciglia (prima copriva un occhio), castano scurissimo con radici più
// scure, ombra fra gli strati, bordi delle ciocche morbidi.
import { buildWig } from './_wig.js';
export const meta = {"label": "Caschetto scuro", "labelEn": "Dark side bob", "category": "capelli", "icon": "💇"};

export default function build(THREE, h) {
  return buildWig(THREE, h, new URL('./mh_bob01.glb', import.meta.url).href, { name: 'mh_bob01', rough: 0.52, spec: 0.3, specColor: 0xd8c2ae, sheen: 0.3, sheenColor: 0x8a6a50, inner: 0.6, env: 0.16 });
}
