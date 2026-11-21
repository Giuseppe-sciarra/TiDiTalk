#!/bin/bash
# setup-emoji.sh
# Prepara le emoji del selettore «+» delle reazioni (nome e parole chiave in italiano,
# inglese, francese e tedesco) in public/assets/vendor/emoji/emoji-<lingua>.json,
# dai dati di emojibase (emojibase-data, MIT, https://emojibase.dev).
#
# 1.9.1: prima i file stavano nel repository (fatti a mano con tools/build-emoji.py da
# emojibase-data 16) e non li aggiornava nessuno. Ora li prepara questo script, sempre
# dall'ultima versione di emojibase-data, e l'aggiornamento notturno (aggiorna-tutto.sh) lo
# rilancia quando ne esce una nuova. Si tengono le emoji fino alla versione 15.1 (le più
# nuove su molti computer e telefoni non si vedono ancora), senza i «componenti» (tonalità,
# capelli) e senza le bandiere delle regioni.
# Per prepararle serve Node.js: se sul computer non c'è, si usa un container usa e getta
# con l'immagine node che c'è già (quella di Tiditalk), senza rete.
# Per fermare la versione a mano: EMOJIBASE_VER=18.0.0 bash setup-emoji.sh
#
# Uso:
#   bash setup-emoji.sh              # scarica e prepara
#   bash setup-emoji.sh --versioni   # dice solo l'ultima versione («VERSIONE emojibase-data x.y.z»)

set -e

DEST="public/assets/vendor/emoji"
PKG="emojibase-data"
MAXV="15.1"
LINGUE="it en fr de"
CURL=(curl -fsSL --retry 2 --retry-delay 3)

VER="${EMOJIBASE_VER:-latest}"
if [ "$VER" = latest ]; then
  VER=$("${CURL[@]}" -m 20 "https://registry.npmjs.org/$PKG/latest" 2>/dev/null \
    | grep -o '"version":[[:space:]]*"[^"]*"' | head -1 | sed -E 's/.*"([^"]*)"$/\1/')
fi
if [[ ! "$VER" =~ ^[0-9A-Za-z._+-]+$ ]]; then
  echo "FALLITO: non riesco a sapere l'ultima versione di $PKG (registro npm non raggiungibile?)"
  exit 1
fi
echo "VERSIONE $PKG $VER"
[ "${1:-}" = "--versioni" ] && exit 0

# cartella di lavoro qui dentro (il container usa e getta vede solo questa cartella)
LAV=".emoji-lavoro"
rm -rf "$LAV"; mkdir -p "$LAV/src" "$LAV/out"
trap 'rm -rf "$LAV"' EXIT
for l in $LINGUE; do
  "${CURL[@]}" -m 120 -o "$LAV/src/$l.json" "https://cdn.jsdelivr.net/npm/$PKG@${VER}/$l/data.json" \
    || { echo "FALLITO: $PKG $VER/$l/data.json"; exit 1; }
done

cat > "$LAV/prepara.js" <<'JS'
// emojibase-data/<lingua>/data.json → [[emoji, gruppo, nome, parole chiave, (5 tonalità)], …]
const fs = require('fs');
const [src, out, maxv, ...lingue] = process.argv.slice(2);
const MAXV = parseFloat(maxv);
const GROUPS = [0, 1, 3, 4, 5, 6, 7, 8, 9];        // 2 = componenti: esclusi
const MODS = ['1F3FB', '1F3FC', '1F3FD', '1F3FE', '1F3FF'];
function tones(e) {                                 // varianti con UNA sola tonalità (tutte le persone uguali)
  const sk = e.skins || [], res = [];
  for (const m of MODS) {
    const c = sk.filter(s => s.hexcode.includes('1F3F') && s.hexcode.split('-').filter(p => MODS.includes(p)).every(p => p === m));
    if (!c.length) return null;
    res.push(c[0].emoji);
  }
  return res;
}
for (const l of lingue) {
  const data = JSON.parse(fs.readFileSync(`${src}/${l}.json`, 'utf8'));
  const rows = [];
  for (const e of data.slice().sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9))) {
    if (!GROUPS.includes(e.group) || (e.version ?? 99) > MAXV || e.order == null) continue;
    if (e.group === 9 && e.subgroup === 99) continue;           // bandiere di regioni (Scozia…): spesso non si vedono
    const r = [e.emoji, GROUPS.indexOf(e.group), e.label || '', (e.tags || []).join(' ')];
    const t = tones(e); if (t) r.push(t);
    rows.push(r);
  }
  if (rows.length < 1000) { console.log(`FALLITO: ${l}: solo ${rows.length} emoji (formato di emojibase cambiato?)`); process.exit(1); }
  fs.writeFileSync(`${out}/emoji-${l}.json`, JSON.stringify(rows));
  console.log(`  ✓ emoji-${l}.json: ${rows.length} emoji`);
}
JS

if command -v node >/dev/null 2>&1; then
  node "$LAV/prepara.js" "$LAV/src" "$LAV/out" "$MAXV" $LINGUE
elif command -v docker >/dev/null 2>&1; then
  IMG=$(docker image ls --format '{{.Repository}}:{{.Tag}}' 2>/dev/null | grep -m1 -E '^node:[0-9]+(-alpine)?$' || true)
  [ -n "$IMG" ] || IMG="node:26-alpine"
  echo "  (Node.js non c'è: uso un container usa e getta $IMG, senza rete)"
  docker run --rm --network none -u "$(id -u):$(id -g)" -v "$PWD/$LAV:/w" -w /w "$IMG" \
    node prepara.js src out "$MAXV" $LINGUE
else
  echo "FALLITO: per preparare le emoji serve Node.js oppure Docker"
  exit 1
fi

mkdir -p "$DEST"
for l in $LINGUE; do
  [ -s "$LAV/out/emoji-$l.json" ] || { echo "VUOTO: emoji-$l.json"; exit 1; }
  cp "$LAV/out/emoji-$l.json" "$DEST/emoji-$l.json"
done
echo "✓ Emoji da $PKG $VER (fino alla versione $MAXV) pronte (la cartella è montata nel container: basta ricaricare la pagina)"
