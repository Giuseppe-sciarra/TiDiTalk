// Blond bob — CC-BY, Elvaerwyn (MakeHuman community asset repository)
// Modello: mh_witchy_lil_bob.glb — rifatto per Tiditalk 1.8.0: in cm sul viso canonico, calotta appoggiata sul cranio (non dentro la
// fronte), frangia sopra le sopracciglia, biondo miele con radici più scure, ombra fra gli strati, bordi delle ciocche morbidi.
import { buildWig } from './_wig.js';
export const meta = {"label": "Caschetto biondo", "labelEn": "Blond bob", "category": "capelli", "icon": "💇"};

export default function build(THREE, h) {
  return buildWig(THREE, h, new URL('./mh_witchy_lil_bob.glb', import.meta.url).href, { name: 'mh_witchy_lil_bob', rough: 0.64, spec: 0.18, specColor: 0xf3e4c4, sheen: 0.3, sheenColor: 0xe0c99a, inner: 0.55, tint: 0xcfc4b4, env: 0.15 });
}
