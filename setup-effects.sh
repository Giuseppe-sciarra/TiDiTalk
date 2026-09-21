#!/bin/bash
# setup-effects.sh
# Scarica i PNG Twemoji per gli effetti viso dalla CDN jsDelivr.
# Licenza Twemoji: CC-BY 4.0 (Twitter Inc. + contributors) + MIT per il codice.
#
# Uso:
#   chmod +x setup-effects.sh
#   ./setup-effects.sh

set -e

DEST_DIR="public/assets/effects"
BASE_URL="https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72"

echo "→ Creo directory: $DEST_DIR"
mkdir -p "$DEST_DIR"

# Mappa: nome-file.png <codepoint-twemoji>
# Codepoints presi da https://unicode.org/emoji/charts/full-emoji-list.html
declare -A EMOJI=(
  # Copricapo
  ["crown"]="1f451"              # 👑 corona
  ["tophat"]="1f3a9"             # 🎩 cilindro
  ["partyhat"]="1f389"           # 🎉 cappello festa (usa "party popper")
  ["santahat"]="1f385"           # 🎅 Babbo Natale (useremo solo il cappello in JS)
  ["cowboyhat"]="1f920"          # 🤠 cowboy
  ["graduation"]="1f393"         # 🎓 tocco laurea
  ["halo"]="1f607"               # 😇 angelo con aureola
  ["helmet"]="26d1"              # ⛑️ elmetto
  ["tophat_magic"]="1f3a9"       # cilindro (duplicato per varianti)

  # Occhiali
  ["sunglasses"]="1f576"         # 🕶️ occhiali sole
  ["nerd"]="1f913"               # 🤓 occhiali nerd
  ["monocle"]="1f9d0"            # 🧐 monocolo
  ["heart_eyes"]="1f60d"         # 😍 occhi a cuore (come overlay viso)

  # Sulla faccia
  ["clown"]="1f921"              # 🤡 clown (per naso rosso)
  ["mask_theater"]="1f3ad"       # 🎭 maschera teatro
  ["mask_medical"]="1f637"       # 😷 mascherina
  ["mustache"]="1f472"           # 👲 (approx)
  ["kiss_lips"]="1f48b"          # 💋 bacio

  # Animali in testa
  ["cat_face"]="1f431"           # 🐱 gatto
  ["dog_face"]="1f436"           # 🐶 cane
  ["rabbit"]="1f430"             # 🐰 coniglio
  ["bear"]="1f43b"               # 🐻 orso
  ["panda"]="1f43c"              # 🐼 panda
  ["fox"]="1f98a"                # 🦊 volpe
  ["mouse"]="1f42d"              # 🐭 topo
  ["unicorn"]="1f984"            # 🦄 unicorno

  # Intorno al viso / decorazioni
  ["fire"]="1f525"               # 🔥 fuoco
  ["star"]="2b50"                # ⭐ stella
  ["sparkles"]="2728"            # ✨ scintille
  ["heart"]="2764"               # ❤️ cuore
  ["heart_sparkling"]="1f496"    # 💖 cuore brillante
  ["flower"]="1f33c"             # 🌼 fiore giallo
  ["rose"]="1f339"               # 🌹 rosa
  ["rainbow"]="1f308"            # 🌈 arcobaleno

  # Speciali
  ["devil_horns"]="1f608"        # 😈 diavolo (per corna)
  ["alien"]="1f47d"              # 👽 alieno
  ["ghost"]="1f47b"              # 👻 fantasma
  ["skull"]="1f480"              # 💀 teschio
  ["poop"]="1f4a9"               # 💩 cacca divertente
  ["robot"]="1f916"              # 🤖 robot
  ["pig_nose"]="1f43d"           # 🐽 muso di maiale
)

FAILED=()
TOTAL=${#EMOJI[@]}
COUNT=0

DOWNLOAD() {
  local url="$1"
  local out="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url" -o "$out"
  elif command -v wget >/dev/null 2>&1; then
    wget -q "$url" -O "$out"
  else
    echo "ERRORE: servono curl o wget" >&2
    exit 1
  fi
}

for name in "${!EMOJI[@]}"; do
  COUNT=$((COUNT + 1))
  code="${EMOJI[$name]}"
  out="$DEST_DIR/${name}.png"
  printf "  [%2d/%2d] %-20s " "$COUNT" "$TOTAL" "$name.png"
  if DOWNLOAD "$BASE_URL/$code.png" "$out" 2>/dev/null; then
    size=$(stat -c%s "$out" 2>/dev/null || stat -f%z "$out" 2>/dev/null || echo 0)
    if [ "$size" -gt 100 ]; then
      echo "OK ($size bytes)"
    else
      echo "VUOTO"
      rm -f "$out"
      FAILED+=("$name")
    fi
  else
    echo "FALLITO"
    rm -f "$out"
    FAILED+=("$name")
  fi
done

echo ""
echo "=== Riepilogo ==="
SUCCESS=$((TOTAL - ${#FAILED[@]}))
echo "✓ Scaricati: $SUCCESS / $TOTAL"

if [ ${#FAILED[@]} -gt 0 ]; then
  echo "✗ Falliti (${#FAILED[@]}):"
  for f in "${FAILED[@]}"; do echo "   - $f"; done
fi

TOTAL_SIZE=$(du -sh "$DEST_DIR" 2>/dev/null | cut -f1)
echo "✓ Dimensione totale: $TOTAL_SIZE"
echo ""
echo "Ora riavvia il container:"
echo "  docker compose restart app"
