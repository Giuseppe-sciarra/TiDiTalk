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
| [Twemoji](https://github.com/jdecked/twemoji) graphics used by face effects | CC-BY 4.0 — © Twitter, Inc and other contributors | `setup-effects.sh` |

## Bundled assets

| Asset | License |
|-------|---------|
| Fonts: [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque), [Instrument Sans](https://fonts.google.com/specimen/Instrument+Sans) (`public/assets/fonts`) | SIL Open Font License 1.1 |
| Reaction sounds (`public/assets/sounds`) | from [MiroTalk SFU](https://github.com/miroslavpejic85/mirotalksfu), AGPL-3.0 — © Miroslav Pejic |
| Background placeholders (`public/assets/backgrounds/*.svg`) | part of Tiditalk, AGPL-3.0 |
