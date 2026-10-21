// Pink bob — CC-BY, Elvaerwyn (MakeHuman community asset repository)
// Modello: mh_short_daisy.glb — rifatto per Tiditalk 1.8.0: in cm sul viso canonico, calotta appoggiata sul cranio (non dentro la
// fronte), frangia sopra le sopracciglia e centrata, radici più scure, ombra fra gli strati, bordi delle ciocche morbidi.
import { buildWig } from './_wig.js';
export const meta = {"label": "Caschetto rosa", "labelEn": "Pink bob", "category": "capelli", "icon": "💇"};

export default function build(THREE, h) {
  return buildWig(THREE, h, new URL('./mh_short_daisy.glb', import.meta.url).href, { name: 'mh_short_daisy', rough: 0.66, spec: 0.16, specColor: 0xf0d2cc, sheen: 0.3, sheenColor: 0xd9aea8, inner: 0.55, tint: 0xe6e0e0, env: 0.15 });
}
