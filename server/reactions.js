'use strict';
/**
 * 1.8.0 — Reazioni in barra: si accettano solo emoji vere (anche con la
 * tonalità della pelle e le sequenze ZWJ del selettore «+»). Il nome di chi
 * reagisce lo aggiunge il server dal peer, mai dal client.
 */
let RGI = null;
try { RGI = new RegExp('^\\p{RGI_Emoji}$', 'v'); } catch (_) { RGI = null; }   // Node ≥ 20
// ripiego (Node vecchi): solo simboli/pittogrammi, modificatori, ZWJ e selettori di variante
const FALLBACK = /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|[‍️⃣#*0-9])+$/u;

function validEmoji(e) {
  if (typeof e !== 'string' || !e || e.length > 32) return null;
  if (!RGI) return FALLBACK.test(e) && /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(e) ? e : null;
  if (RGI.test(e)) return e;
  // alcune piattaforme mandano l'emoji senza il selettore di variante (❤ → ❤️)
  const vs = e.replace(/^(\p{Extended_Pictographic})(?!️)/u, '$1️');
  return RGI.test(vs) ? vs : null;
}

module.exports = { validEmoji };
