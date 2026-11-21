#!/bin/bash
# setup-fonts.sh
# Scarica i font dell'interfaccia (Bricolage Grotesque e Instrument Sans, SIL Open Font
# License 1.1) da Google Fonts in public/assets/vendor/fonts/, con il loro fonts.css.
#
# 1.9.1: prima i file stavano nel repository e non li aggiornava nessuno. Ora li scarica
# questo script, sempre nell'ultima versione pubblicata da Google (solo latino e latino
# esteso, pesi 400–700, Bricolage con le dimensioni ottiche come prima), e l'aggiornamento
# notturno (aggiorna-tutto.sh) lo rilancia quando ne esce una nuova. Le pagine caricano
# /assets/css/fonts.css, che rimanda a public/assets/vendor/fonts/fonts.css.
#
# Uso:
#   bash setup-fonts.sh              # scarica tutto
#   bash setup-fonts.sh --versioni   # dice solo le versioni («VERSIONE font-<nome> vN»)

set -e

DEST="public/assets/vendor/fonts"
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36"
CSS_URL="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..700&family=Instrument+Sans:wght@400..700&display=swap"
CURL=(curl -fsSL --retry 2 --retry-delay 3)
# famiglia|sottoinsieme|nome del file
VOGLIO=(
  "Bricolage Grotesque|latin-ext|BricolageGrotesque-latin-ext.woff2"
  "Bricolage Grotesque|latin|BricolageGrotesque-latin.woff2"
  "Instrument Sans|latin-ext|InstrumentSans-normal-latin-ext.woff2"
  "Instrument Sans|latin|InstrumentSans-normal-latin.woff2"
)

CSS=$("${CURL[@]}" -m 20 -A "$UA" "$CSS_URL" 2>/dev/null) || { echo "FALLITO: Google Fonts non risponde"; exit 1; }
# una riga per blocco: sottoinsieme|famiglia|stile|peso|indirizzo|unicode-range
BLOCCHI=$(printf '%s\n' "$CSS" | awk '
  /\/\*.*\*\// { s = $0; sub(/^[[:space:]]*\/\*[[:space:]]*/, "", s); sub(/[[:space:]]*\*\/[[:space:]]*$/, "", s); sub_ = s; next }
  /font-family:/ { f = $0; sub(/.*font-family:[[:space:]]*/, "", f); sub(/;.*/, "", f); gsub(/'\''/, "", f); fam = f }
  /font-style:/  { st = $0; sub(/.*font-style:[[:space:]]*/, "", st); sub(/;.*/, "", st) }
  /font-weight:/ { w = $0; sub(/.*font-weight:[[:space:]]*/, "", w); sub(/;.*/, "", w) }
  /src:/         { u = $0; sub(/.*url\(/, "", u); sub(/\).*/, "", u) }
  /unicode-range:/ { r = $0; sub(/.*unicode-range:[[:space:]]*/, "", r); sub(/;.*/, "", r); print sub_ "|" fam "|" st "|" w "|" u "|" r }')

trova() { printf '%s\n' "$BLOCCHI" | awk -F'|' -v s="$2" -v f="$1" '$1 == s && $2 == f' | head -1; }
VERS=""
for v in "${VOGLIO[@]}"; do
  IFS='|' read -r fam sub file <<< "$v"
  riga=$(trova "$fam" "$sub")
  url=$(printf '%s' "$riga" | cut -d'|' -f5)
  [[ "$url" =~ ^https://fonts\.gstatic\.com/s/([a-z0-9]+)/(v[0-9]+)/[A-Za-z0-9_-]+\.woff2$ ]] \
    || { echo "FALLITO: $fam ($sub) non c'è più su Google Fonts o ha un indirizzo strano"; exit 1; }
  VERS+="font-${BASH_REMATCH[1]} ${BASH_REMATCH[2]}"$'\n'
done
printf '%s' "$VERS" | sort -u | sed 's/^/VERSIONE /'
[ "${1:-}" = "--versioni" ] && exit 0

mkdir -p "$DEST"
CSSOUT="/* Font dell'interfaccia (SIL Open Font License 1.1), da Google Fonts: li scarica setup-fonts.sh */"$'\n'
for v in "${VOGLIO[@]}"; do
  IFS='|' read -r fam sub file <<< "$v"
  IFS='|' read -r _ _ st w url rng <<< "$(trova "$fam" "$sub")"
  "${CURL[@]}" -m 60 -o "$DEST/$file" "$url" || { echo "FALLITO: $url"; exit 1; }
  [ "$(head -c 4 "$DEST/$file")" = "wOF2" ] || { echo "FALLITO: $file non è un font woff2"; exit 1; }
  CSSOUT+="@font-face{font-family:'$fam';font-style:${st:-normal};font-weight:${w:-400 700};font-display:swap;src:url('/assets/vendor/fonts/$file') format('woff2');unicode-range:$rng;}"$'\n'
  echo "  ✓ $file ($sub)"
done
printf '%s' "$CSSOUT" > "$DEST/fonts.css"
echo "✓ Font pronti (la cartella è montata nel container: basta ricaricare la pagina)"
