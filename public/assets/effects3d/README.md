# Effetti viso 3D

Effetti "come Meet" disegnati con three.js sopra la videocamera e agganciati alla testa con MediaPipe
Face Landmarker (posizione 3D della testa + 52 espressioni). Il motore è `public/assets/js/faceAR.js`
(il rilevamento gira in un Web Worker: `faceAR-worker.js`).

| Cartella | Contenuto |
|----------|-----------|
| `models/` | cappelli, corone, occhiali, cuffie, orecchie, accessori (procedurali) |
| `hair/`   | parrucche e barbe (procedurali) |
| `chars/`  | personaggi che copiano le espressioni e scene con la faccia in una cornice (procedurali) |
| `paints/` | maschere dipinte sulla pelle: texture sulla mesh del viso che segue l'espressione |
| `glb/`    | modelli gratuiti (CC0 / CC-BY / Apache-2.0) già ottimizzati — crediti in `glb/CREDITS.md` |
| `thumbs/` | miniature del pannello (generate) |
| `catalog.js` | catalogo per il pannello (generato) |
| `facemesh.json` | mesh canonica del viso di MediaPipe (468 punti, UV e triangoli) — Apache-2.0, © Google LLC, da `mediapipe/modules/face_geometry/data/canonical_face_model.obj` |

## Aggiungere un effetto
1. Scrivi un modulo ES nella cartella giusta (vedi un file esistente):
   ```js
   export const meta = { label: 'Cappello da pirata', labelEn: 'Pirate hat', category: 'costumi', icon: '🏴‍☠️' };
   export default function build(THREE, h) { /* Group in cm, spazio del viso canonico */ }
   export function update(g, bs, t, h) { /* facoltativo: anima con le 52 espressioni (bs.jawOpen, bs.eyeBlinkLeft…) */ }
   export const hideHead = false; // true per i personaggi che sostituiscono la testa
   ```
   Le maschere (`paints/`) esportano invece `paint(ctx, size, h)` e disegnano sulla texture UV del viso.
   Coordinate: centimetri, origine al centro della testa, +X verso la destra di chi guarda, +Y su, +Z verso la camera.
   Occlusori: nell'app la testa vera è "nascosta" da forme invisibili (viso deformato dai 468 punti, cranio,
   collo, spalle) che scrivono solo la profondità. L'occlusore del viso viene disegnato nel passaggio dei
   materiali trasparenti: le parti opache che stanno dietro la faccia (lati di una parrucca, barba sotto la
   mascella) vanno fatte con materiali `transparent: true` (anche con `opacity: 1`), altrimenti si vedono
   sopra il viso. Per le parti dietro la nuca un occlusore proprio (mesh con `colorWrite: false`) va bene;
   nelle miniature gli occlusori dell'effetto vengono spenti, perché lì c'è il manichino.
2. Rigenera catalogo e miniature: `python3 tools/build-effects3d.py`
3. Le etichette nuove vanno tradotte in `i18n.json` (fr/de) e nelle traduzioni dell'app.

Categorie del pannello: `personaggi`, `divertenti`, `costumi`, `capelli`, `barba`, `accessori`, `maschere`
(+ "Novità" scelte in `featured.json`).
