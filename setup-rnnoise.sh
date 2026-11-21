#!/bin/bash
# setup-rnnoise.sh
# Scarica la riduzione del rumore avanzata: RNNoise (Xiph/Mozilla) compilata in WebAssembly
# dal pacchetto npm @jitsi/rnnoise-wasm, in public/assets/vendor/rnnoise/.
#
# 1.9.1: prima il file stava nel repository e non lo aggiornava nessuno. Ora lo scarica
# questo script, sempre all'ultima versione (con la versione scritta per esteso
# nell'indirizzo), e l'aggiornamento notturno (aggiorna-tutto.sh) lo rilancia quando ne
# esce una nuova. Le funzioni dentro il .wasm hanno nomi corti (a, b, c…) che cambiano a ogni
# build: lo script li legge dalla «colla» JavaScript dello stesso pacchetto e li scrive in
# rnnoise.names.json, che il worklet (rnnoise-worklet.js) usa per chiamarle.
# Per fermare la versione a mano: RNN_VER=0.2.1 bash setup-rnnoise.sh
#
# Uso:
#   bash setup-rnnoise.sh              # scarica tutto
#   bash setup-rnnoise.sh --versioni   # dice solo l'ultima versione («VERSIONE @jitsi/rnnoise-wasm x.y.z»)

set -e

DEST="public/assets/vendor/rnnoise"
PKG="@jitsi/rnnoise-wasm"
CURL=(curl -fsSL --retry 2 --retry-delay 3)

RNN_VER="${RNN_VER:-latest}"
if [ "$RNN_VER" = latest ]; then
  RNN_VER=$("${CURL[@]}" -m 20 "https://registry.npmjs.org/$PKG/latest" 2>/dev/null \
    | grep -o '"version":[[:space:]]*"[^"]*"' | head -1 | sed -E 's/.*"([^"]*)"$/\1/')
fi
if [[ ! "$RNN_VER" =~ ^[0-9A-Za-z._+-]+$ ]]; then
  echo "FALLITO: non riesco a sapere l'ultima versione di $PKG (registro npm non raggiungibile?)"
  exit 1
fi
echo "VERSIONE $PKG $RNN_VER"
[ "${1:-}" = "--versioni" ] && exit 0

B="https://cdn.jsdelivr.net/npm/$PKG@${RNN_VER}"
mkdir -p "$DEST"
COLLA=$(mktemp); trap 'rm -f "$COLLA" "$COLLA.1"' EXIT
"${CURL[@]}" -m 60 -o "$DEST/rnnoise.wasm" "$B/dist/rnnoise.wasm" || { echo "FALLITO: $B/dist/rnnoise.wasm"; exit 1; }
"${CURL[@]}" -m 60 -o "$DEST/LICENSE" "$B/LICENSE"                 || { echo "FALLITO: $B/LICENSE"; exit 1; }
"${CURL[@]}" -m 60 -o "$COLLA" "$B/dist/rnnoise.js"                || { echo "FALLITO: $B/dist/rnnoise.js"; exit 1; }
[ "$(head -c 4 "$DEST/rnnoise.wasm" | od -An -tx1 | tr -d ' \n')" = "0061736d" ] || { echo "FALLITO: rnnoise.wasm non è WebAssembly"; exit 1; }
tr '\n\r\t' '   ' < "$COLLA" > "$COLLA.1"     # una riga sola: le assegnazioni possono andare a capo

# ── nomi corti delle funzioni esportate, dalla colla di emscripten ───────────
# es. «_rnnoise_create = Module["_rnnoise_create"] = Module["asm"]["f"]»
#     «_rnnoise_create = Module["_rnnoise_create"] = wasmExports["f"]» · «… = wasmExports.f»
corto() {   # $1 nome C (rnnoise_create) → nome corto (f)
  grep -oE "_$1[[:space:]]*=[[:space:]]*(Module(\[\"_$1\"\]|\._$1)[[:space:]]*=[[:space:]]*)?(Module\[\"asm\"\]|wasmExports|asm)(\[\"[A-Za-z0-9_\$]+\"\]|\.[A-Za-z0-9_\$]+)" "$COLLA.1" \
    | head -1 | sed -E 's/.*(\["([^"]+)"\]|\.([A-Za-z0-9_$]+))$/\2\3/'
}
ESP=""
for n in rnnoise_create malloc rnnoise_process_frame free rnnoise_destroy rnnoise_init __wasm_call_ctors; do
  v=$(corto "$n")
  case "$n" in rnnoise_create|malloc|rnnoise_process_frame)
    [ -n "$v" ] || { echo "FALLITO: non trovo $n nella colla di $PKG $RNN_VER (formato cambiato?)"; exit 1; } ;;
  esac
  [ -n "$v" ] && ESP+="${ESP:+,}\"$n\":\"$v\""
done
# ── importazioni: «var asmLibraryArg = { "b": _emscripten_memcpy_big, "a": _emscripten_resize_heap }»
#    oppure «var wasmImports = { a: _emscripten_resize_heap, … }»
IMP=$(grep -oE "(asmLibraryArg|wasmImports)[[:space:]]*=[[:space:]]*\{[^}]*\}" "$COLLA.1" | head -1 \
      | grep -oE "\"?[A-Za-z0-9_\$]+\"?[[:space:]]*:[[:space:]]*_*[A-Za-z0-9_]+" \
      | sed -E 's/^"?([A-Za-z0-9_$]+)"?[[:space:]]*:[[:space:]]*_*([A-Za-z0-9_]+)$/"\1":"\2"/' | paste -sd, -)
printf '{"version":"%s","exports":{%s},"imports":{%s}}\n' "$RNN_VER" "$ESP" "$IMP" > "$DEST/rnnoise.names.json"
echo "  ✓ rnnoise.wasm ($(stat -c%s "$DEST/rnnoise.wasm" 2>/dev/null || wc -c < "$DEST/rnnoise.wasm") byte), LICENSE"
echo "  ✓ rnnoise.names.json: $(cat "$DEST/rnnoise.names.json")"
echo "✓ RNNoise $RNN_VER pronto (la cartella è montata nel container: basta ricaricare la pagina)"
