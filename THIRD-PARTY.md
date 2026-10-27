# Third-party components

Tiditalk is released under AGPL-3.0-or-later. It uses the following
third-party components, each under its own license.

## Runtime dependencies (installed by npm)

| Component | License |
|-----------|---------|
| [mediasoup](https://mediasoup.org) / mediasoup-client | ISC |
| [Socket.IO](https://socket.io) | MIT |
| [Express](https://expressjs.com) | MIT |
| [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) | MIT |
| [Nodemailer](https://nodemailer.com) | MIT-0 |
| [bcryptjs](https://github.com/dcodeIO/bcrypt.js) | BSD-3-Clause |
| [dotenv](https://github.com/motdotla/dotenv) | BSD-2-Clause |
| [cors](https://github.com/expressjs/cors) | MIT |

`public/assets/js/mediasoup-client.min.js` is a bundle of mediasoup-client
(ISC), regenerated at every Docker build.

## Downloaded by the setup scripts (not stored in the repository)

| Component | License | Script |
|-----------|---------|--------|
| [MediaPipe Face Mesh / Selfie Segmentation](https://github.com/google-ai-edge/mediapipe) | Apache-2.0 | `setup-mediapipe.sh` |
| [MediaPipe Tasks Vision](https://github.com/google-ai-edge/mediapipe) (Face Landmarker: 3D head pose and 52 expressions, used by the 3D face effects) | Apache-2.0 | `setup-mediapipe.sh` |
| [three.js](https://threejs.org) (3D rendering of the face effects) | MIT | `setup-mediapipe.sh` |
| [Twemoji](https://github.com/jdecked/twemoji) graphics used by face effects | CC-BY 4.0 — © Twitter, Inc and other contributors | `setup-effects.sh` |
| Background photos (56, with thumbnails) from [Unsplash](https://unsplash.com) | [Unsplash License](https://unsplash.com/license) — free to use, no attribution required | `setup-backgrounds.sh` |

## Bundled assets

| Asset | License |
|-------|---------|
| [RNNoise](https://gitlab.xiph.org/xiph/rnnoise) noise suppression, WebAssembly build from [@jitsi/rnnoise-wasm](https://github.com/jitsi/rnnoise-wasm) (`public/assets/vendor/rnnoise/rnnoise.wasm`) | RNNoise: BSD-3-Clause — © Xiph.Org, Mozilla; wasm build: Apache-2.0 — © 8x8 / Jitsi (license text alongside the file) |
| Fonts: [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque), [Instrument Sans](https://fonts.google.com/specimen/Instrument+Sans) (`public/assets/fonts`) | SIL Open Font License 1.1 |
| Reaction sounds (`public/assets/sounds`) | from [MiroTalk SFU](https://github.com/miroslavpejic85/mirotalksfu), AGPL-3.0 — © Miroslav Pejic |
| Canonical face mesh (`public/assets/effects3d/facemesh.json`: vertices, UVs and triangles of MediaPipe's `canonical_face_model.obj`) | Apache-2.0 — © Google LLC |
| 3D face effects (`public/assets/effects3d/{models,hair,chars,paints,premium,premium2,premium3,premium4,premium5,premium6}`: hats, glasses, wigs, beards, characters, animals, costumes, accessories, fun effects, face paints — procedural, written for Tiditalk) and their thumbnails | part of Tiditalk, AGPL-3.0 |
| Free 3D models in `public/assets/effects3d/glb/` | CC0 / CC-BY 4.0 / Apache-2.0 — authors and sources in [`public/assets/effects3d/glb/CREDITS.md`](public/assets/effects3d/glb/CREDITS.md) |
| Background placeholders (`public/assets/backgrounds/*.svg`) and illustrations (`public/assets/backgrounds/6*-*.png`: synthwave, pixel art) | part of Tiditalk, AGPL-3.0 |
