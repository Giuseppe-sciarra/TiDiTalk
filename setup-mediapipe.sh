#!/bin/bash
# setup-mediapipe.sh
# Scarica TUTTI i file MediaPipe FaceMesh dal CDN jsdelivr
# Usa l'API di jsdelivr per ottenere la lista completa dei file del package
# così non ne sfugge nessuno.
#
# Uso:
#   chmod +x setup-mediapipe.sh
#   ./setup-mediapipe.sh

set -e

DEST_DIR="public/assets/vendor/mediapipe"
DEST_SEG="public/assets/vendor/mediapipe_selfie"
PACKAGE="@mediapipe/face_mesh"
LIST_URL="https://data.jsdelivr.com/v1/package/npm/@mediapipe/face_mesh/flat"
BASE_URL="https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh"
SEG_BASE="https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation"

echo "→ Creo directory: $DEST_DIR"
mkdir -p "$DEST_DIR"
echo "→ Creo directory: $DEST_SEG"
mkdir -p "$DEST_SEG"

# Lista dei file effettivamente necessari per la solution JS in browser
# Include tutti i binari, tflite e il .binarypb che è referenziato runtime
FILES=(
  "face_mesh.js"
  "face_mesh.binarypb"
  "face_mesh_solution_packed_assets.data"
  "face_mesh_solution_packed_assets_loader.js"
  "face_mesh_solution_simd_wasm_bin.js"
  "face_mesh_solution_simd_wasm_bin.wasm"
  "face_mesh_solution_wasm_bin.js"
  "face_mesh_solution_wasm_bin.wasm"
)

# SelfieSegmentation per sfondi virtuali (blur + immagini)
SEG_FILES=(
  "selfie_segmentation.js"
  "selfie_segmentation.binarypb"
  "selfie_segmentation_solution_packed_assets.data"
  "selfie_segmentation_solution_packed_assets_loader.js"
  "selfie_segmentation_solution_simd_wasm_bin.js"
  "selfie_segmentation_solution_simd_wasm_bin.wasm"
  "selfie_segmentation_solution_wasm_bin.js"
  "selfie_segmentation_solution_wasm_bin.wasm"
  "selfie_segmentation_landscape.tflite"
)

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

FAILED=()

for f in "${FILES[@]}"; do
  echo -n "→ $f ... "
  if DOWNLOAD "$BASE_URL/$f" "$DEST_DIR/$f" 2>/dev/null; then
    size=$(stat -c%s "$DEST_DIR/$f" 2>/dev/null || stat -f%z "$DEST_DIR/$f" 2>/dev/null || echo 0)
    if [ "$size" -gt 0 ]; then
      echo "OK (${size} bytes)"
    else
      echo "VUOTO — rimuovo"
      rm -f "$DEST_DIR/$f"
      FAILED+=("$f")
    fi
  else
    echo "FALLITO"
    rm -f "$DEST_DIR/$f"
    FAILED+=("$f")
  fi
done

echo ""
echo "=== SelfieSegmentation (sfondi virtuali) ==="
for f in "${SEG_FILES[@]}"; do
  echo -n "→ selfie/$f ... "
  if DOWNLOAD "$SEG_BASE/$f" "$DEST_SEG/$f" 2>/dev/null; then
    size=$(stat -c%s "$DEST_SEG/$f" 2>/dev/null || stat -f%z "$DEST_SEG/$f" 2>/dev/null || echo 0)
    if [ "$size" -gt 0 ]; then
      echo "OK (${size} bytes)"
    else
      echo "VUOTO — rimuovo"
      rm -f "$DEST_SEG/$f"
      FAILED+=("selfie/$f")
    fi
  else
    echo "FALLITO"
    rm -f "$DEST_SEG/$f"
    FAILED+=("selfie/$f")
  fi
done

echo ""
echo "=== File scaricati ==="
ls -lh "$DEST_DIR" | tail -n +2

if [ ${#FAILED[@]} -gt 0 ]; then
  echo ""
  echo "⚠ Alcuni file non sono stati scaricati (alcuni sono opzionali):"
  for f in "${FAILED[@]}"; do
    echo "  - $f"
  done
  echo ""
  echo "Se face_mesh.binarypb è fra i falliti, prova manualmente:"
  echo "  curl -fsSL $BASE_URL/face_mesh.binarypb -o $DEST_DIR/face_mesh.binarypb"
  echo ""
  echo "Altrimenti puoi elencare i file disponibili con:"
  echo "  curl -s '$LIST_URL' | python3 -m json.tool | grep '\"name\"'"
fi

TOTAL=$(du -sh "$DEST_DIR" | cut -f1)
echo ""
echo "✓ Totale scaricato: $TOTAL"
echo ""
echo "Ora rebuild il container:"
echo "  docker compose down && docker compose up -d --build"

# ── 1.7.0: effetti viso 3D — MediaPipe Tasks (Face Landmarker) + three.js ─────
# Face Landmarker dà la posizione 3D della testa e le 52 espressioni; three.js
# disegna cappelli, parrucche, personaggi. Entrambi in locale, niente CDN a runtime.
TASKS_VER="1.1.1"
THREE_VER="0.186.1"
DEST_TASKS="public/assets/vendor/mediapipe_tasks"
DEST_THREE="public/assets/vendor/three"
echo "→ MediaPipe Tasks ${TASKS_VER} in $DEST_TASKS"
mkdir -p "$DEST_TASKS/wasm" "$DEST_THREE/jsm/loaders" "$DEST_THREE/jsm/environments" "$DEST_THREE/jsm/utils"
TB="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VER}"
curl -fsSL -o "$DEST_TASKS/vision_bundle.mjs" "$TB/vision_bundle.mjs"
for f in vision_wasm_internal.js vision_wasm_internal.wasm vision_wasm_nosimd_internal.js vision_wasm_nosimd_internal.wasm vision_wasm_module_internal.js vision_wasm_module_internal.wasm; do
  curl -fsSL -o "$DEST_TASKS/wasm/$f" "$TB/wasm/$f"
done
curl -fsSL -o "$DEST_TASKS/face_landmarker.task" "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
echo "→ three.js ${THREE_VER} in $DEST_THREE"
H="https://cdn.jsdelivr.net/npm/three@${THREE_VER}"
curl -fsSL -o "$DEST_THREE/three.module.js" "$H/build/three.module.js"
curl -fsSL -o "$DEST_THREE/three.core.js" "$H/build/three.core.js"
for f in loaders/GLTFLoader.js environments/RoomEnvironment.js utils/BufferGeometryUtils.js utils/SkeletonUtils.js; do
  curl -fsSL -o "$DEST_THREE/jsm/$f" "$H/examples/jsm/$f"
done
echo "✓ Effetti 3D pronti"
