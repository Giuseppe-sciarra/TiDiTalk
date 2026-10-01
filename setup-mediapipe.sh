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
