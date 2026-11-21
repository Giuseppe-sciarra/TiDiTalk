#!/bin/bash
# setup-mediapipe.sh
# Scarica in locale le librerie del browser per effetti viso e sfondi virtuali:
#   • MediaPipe Tasks Vision: Face Landmarker (effetti viso 2D e 3D) e Image Segmenter
#     (sfondi virtuali)
#   • i modelli face_landmarker.task e selfie_segmenter.tflite (Google)
#   • three.js con gli addons che servono, più quelli da cui dipendono
#
# 1.9.1: prende SEMPRE l'ultima versione pubblicata (registro npm, modelli «latest» di
# Google) e poi la scarica con la versione scritta per esteso nell'indirizzo, così le
# versioni non si mischiano. L'aggiornamento notturno (aggiorna-tutto.sh) chiede ogni notte
# le ultime versioni con --versioni e rilancia lo script solo se ne è uscita una nuova.
# Tolti FaceMesh e SelfieSegmentation (@mediapipe/face_mesh, @mediapipe/selfie_segmentation):
# Google non li aggiorna più, al loro posto c'è Tasks Vision. Le cartelle vecchie
# vendor/mediapipe e vendor/mediapipe_selfie non servono più e si possono cancellare.
# Per fermare una versione a mano: TASKS_VER=1.2.3 THREE_VER=0.187.0 bash setup-mediapipe.sh
#
# Uso:
#   bash setup-mediapipe.sh              # scarica tutto
#   bash setup-mediapipe.sh --versioni   # dice solo le ultime versioni, non scarica niente
# Ogni versione esce in una riga «VERSIONE <nome> <versione>».

set -e

DEST_TASKS="public/assets/vendor/mediapipe_tasks"
DEST_THREE="public/assets/vendor/three"
MOD_FACE="https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task"
MOD_SEG="https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite"
CURL=(curl -fsSL --retry 2 --retry-delay 3)

# ── Ultime versioni (solo domande leggere, niente download) ──────────────────
npm_ultima() {   # $1 pacchetto npm → ultima versione pubblicata
  "${CURL[@]}" -m 20 "https://registry.npmjs.org/$1/latest" 2>/dev/null \
    | grep -o '"version":[[:space:]]*"[^"]*"' | head -1 | sed -E 's/.*"([^"]*)"$/\1/'
}
risolvi() {      # $1 pacchetto npm · $2 versione voluta («latest» = l'ultima)
  local v="$2"
  [ "$v" = latest ] && v=$(npm_ultima "$1")
  if [[ ! "$v" =~ ^[0-9A-Za-z._+-]+$ ]]; then
    echo "FALLITO: non riesco a sapere l'ultima versione di $1 (registro npm non raggiungibile?)" >&2
    return 1
  fi
  echo "$v"
}
impronta_modello() {   # $1 indirizzo → ETag del file (cambia quando Google pubblica un modello nuovo)
  local e
  e=$(curl -fsSI --retry 2 --retry-delay 3 -m 20 "$1" 2>/dev/null | tr -d '\r' \
      | grep -i '^etag:' | head -1 | sed -E 's/^[^:]*:[[:space:]]*//; s/^W\///; s/"//g')
  if [[ ! "$e" =~ ^[0-9A-Za-z._:+/=-]+$ ]]; then
    echo "FALLITO: non riesco a controllare $1" >&2
    return 1
  fi
  echo "$e"
}

TASKS_VER=$(risolvi @mediapipe/tasks-vision "${TASKS_VER:-latest}")        || exit 1
THREE_VER=$(risolvi three "${THREE_VER:-latest}")                          || exit 1
ETAG_FACE=$(impronta_modello "$MOD_FACE")                                  || exit 1
ETAG_SEG=$(impronta_modello "$MOD_SEG")                                    || exit 1
echo "VERSIONE @mediapipe/tasks-vision $TASKS_VER"
echo "VERSIONE three $THREE_VER"
echo "VERSIONE face_landmarker.task $ETAG_FACE"
echo "VERSIONE selfie_segmenter.tflite $ETAG_SEG"
[ "${1:-}" = "--versioni" ] && exit 0

# ── MediaPipe Tasks Vision + modelli ─────────────────────────────────────────
echo "→ MediaPipe Tasks ${TASKS_VER} in $DEST_TASKS"
mkdir -p "$DEST_TASKS/wasm"
TB="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VER}"
# i file wasm si prendono dall'elenco del pacchetto (cambiano tra una versione e l'altra:
# la 1.2 non ha più i «nosimd»); questi quattro servono per forza
ELENCO=$("${CURL[@]}" -m 30 "https://data.jsdelivr.com/v1/packages/npm/@mediapipe/tasks-vision@${TASKS_VER}?structure=flat") \
  || { echo "FALLITO: elenco dei file di tasks-vision ${TASKS_VER}"; exit 1; }
WASM=$(printf '%s\n' "$ELENCO" | grep -oE '"name":[[:space:]]*"/wasm/[A-Za-z0-9._-]+"' | sed -E 's#.*"/wasm/([^"]+)"$#\1#' | sort -u)
for f in vision_wasm_internal.js vision_wasm_internal.wasm vision_wasm_module_internal.js vision_wasm_module_internal.wasm; do
  printf '%s\n' "$WASM" | grep -qxF "$f" || { echo "FALLITO: in tasks-vision ${TASKS_VER} non c'è più wasm/$f"; exit 1; }
done
"${CURL[@]}" -o "$DEST_TASKS/vision_bundle.mjs" "$TB/vision_bundle.mjs"
for f in $WASM; do
  "${CURL[@]}" -o "$DEST_TASKS/wasm/$f" "$TB/wasm/$f"
done
echo "  wasm: $(printf '%s ' $WASM)"
"${CURL[@]}" -o "$DEST_TASKS/face_landmarker.task" "$MOD_FACE"
# separazione persona / sfondo per gli sfondi virtuali (Apache-2.0, ~250 KB)
"${CURL[@]}" -o "$DEST_TASKS/selfie_segmenter.tflite" "$MOD_SEG"
echo "  ✓ modelli: face_landmarker.task, selfie_segmenter.tflite"

# ── three.js (effetti viso 3D) ───────────────────────────────────────────────
echo "→ three.js ${THREE_VER} in $DEST_THREE"
H="https://cdn.jsdelivr.net/npm/three@${THREE_VER}"
# ogni file porta con sé quelli che importa con un percorso relativo (anche quelli che una
# versione nuova aggiunge), così non manca mai un pezzo
declare -A PRESI=()
percorso_pulito() {   # a/./b/../c.js → a/c.js; errore se esce dalla cartella di partenza
  local IFS=/ parte out=()
  set -f
  for parte in $1; do
    case "$parte" in
      ''|.) ;;
      ..) if ((${#out[@]} == 0)); then set +f; return 1; fi; unset 'out[${#out[@]}-1]' ;;
      *) out+=("$parte") ;;
    esac
  done
  set +f
  printf '%s\n' "${out[*]}"
}
scarica_modulo() {    # $1 indirizzo base · $2 cartella locale · $3 percorso relativo
  local base="$1" dir="$2" rel="$3" dep dove
  [ -n "${PRESI[$dir/$rel]:-}" ] && return 0
  PRESI[$dir/$rel]=1
  mkdir -p "$dir/$(dirname "$rel")"
  "${CURL[@]}" -o "$dir/$rel" "$base/$rel" || { echo "FALLITO: $base/$rel"; return 1; }
  echo "  ✓ $rel"
  while IFS= read -r dep; do
    [ -n "$dep" ] || continue
    dove=$(percorso_pulito "$(dirname "$rel")/$dep") || { echo "FALLITO: $rel importa $dep, fuori da $base"; return 1; }
    scarica_modulo "$base" "$dir" "$dove" || return 1
  done < <(grep -E -e "^[[:space:]]*(import|export)[[:space:]][^'\"]*['\"]\.{1,2}/[^'\"]+['\"]" \
                   -e "^[[:space:]]*\}[[:space:]]*from[[:space:]]*['\"]\.{1,2}/[^'\"]+['\"]" "$dir/$rel" \
           | sed -E "s/^.*['\"](\.{1,2}\/[^'\"]+)['\"].*$/\1/" | sort -u)
}
scarica_modulo "$H/build" "$DEST_THREE" three.module.js || exit 1
scarica_modulo "$H/build" "$DEST_THREE" three.core.js   || exit 1
for f in loaders/GLTFLoader.js environments/RoomEnvironment.js utils/BufferGeometryUtils.js utils/SkeletonUtils.js; do
  scarica_modulo "$H/examples/jsm" "$DEST_THREE/jsm" "$f" || exit 1
done
echo "✓ MediaPipe Tasks ${TASKS_VER} e three.js ${THREE_VER} pronti (le cartelle sono montate nel container: basta ricaricare la pagina)"
