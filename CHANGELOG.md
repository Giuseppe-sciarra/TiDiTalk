# Changelog

## 1.2.0

### Added
- Google-Meet-style permission guide: a full-screen panel while the browser
  asks for microphone/camera ("press Allow", with a mock of the browser prompt
  and per-browser advice to remember the choice), exact unblocking steps when
  permissions are denied by the browser or by the operating system, a panel
  for busy/missing devices, and a non-blocking notice when the microphone is
  muted at system level or receives no sound (pre-join and in the room)
- Version number (from `server/package.json`) always visible in the footer of
  every page next to the "powered by" line, in the room footer and in the
  room Info window; also returned by `GET /api/health` and `/api/settings/public`
- `ticker.js`: Web Worker timer for canvas pipelines (see Fixed)

### Fixed
- Face effects, virtual background and local recording froze for the other
  participants (or in the recorded file) when the tab went to the background:
  the canvas was driven by `requestAnimationFrame`, which browsers suspend on
  hidden tabs. A Web Worker timer (`ticker.js`) now keeps the pipelines running
- Join race: a `newProducer` received before the receive transport existed was
  silently dropped (peer without audio/video until they re-produced). Pending
  producers are queued and consumed once transports are ready
- Camera turned on after enabling a background/effect sent the raw camera (the
  button said "background active" while others saw the real room); the local
  preview also reverted to raw after camera off/on
- A presenter losing their microphone (headset unplugged) made everybody lose the
  shared-screen tile: `producerClosed` removed it for any media type
- Producers closed by a dead transport (ICE/DTLS failure) never notified the
  other clients: frozen screen share / camera tile forever
- Unplugging the selected microphone caused an endless `OverconstrainedError`
  loop on every recovery path; now falls back to the default microphone
- Background ↔ face effect/colour style exclusion in both directions (two
  MediaPipe pipelines running together, stale UI state, camera switch blocked)
- Effect/background pipelines kept running at full CPU with the camera off
- Consumers of a peer who left were never closed client-side (transceiver and
  memory leak on long meetings)
- Recording lost the local voice after a microphone switch or automatic mic
  recovery; audio sources are now keyed by track and refreshed on every change
- Floating window (Document PiP) did not refresh participants/speaker while the
  main tab was hidden
- Own reactions rendered twice; own hand badge, network-quality indicator and
  stats popover on the local tile never worked (`local` vs socket id)
- Lobby: a second `waitingForHost` answer (host left immediately) dropped the
  guest into an empty room without the overlay
- Mute-warning detector and in-progress recording kept the old microphone after
  switching device while muted
- Hand-raise state out of sync with the server auto-lower; style highlight lost
  when picking a face effect; flickering decorations in some effects
- Server: transport leaked when a peer disconnected during creation; audio-level
  observer polling loop never ended on failure; duplicate `joinRoom` left orphan
  transports; socket handlers now tolerate a missing ack callback

## 1.1.0

### Added
- Live annotations on shared screens: pen, highlighter, arrow, rectangle,
  circle and laser pointer, with server-side permissions
- Recording includes annotations and laser pointer
- Branding panel (name, tagline, logo, favicon, accent color, default theme,
  footer, company info) and room rules
- Users with admin/host roles, from the panel or from `USERS` in `.env`
- Light and dark theme; accent color automatically adjusted for contrast
- UI and emails in Italian, English, French and German
- Tooltips and keyboard shortcuts on every control; optional first-join guide
- Language selector inline in the room header (compact globe on phones)
- Grid view sizes tiles to the available space: every participant visible,
  same size, 16:9, last row centered, recomputed on resize and join/leave
- Floating window with the whole meeting (Document Picture-in-Picture) in
  Chrome/Edge: all participants, speaker highlight, mic/camera/hand/leave;
  opens automatically when switching tabs. Single-video PiP disabled
- Microphone popup: live microphone and speaker level meters, and a switch to
  turn off automatic gain control (off by default on macOS, where the browser
  AGC lowers the system input volume)
- Microphone health watchdog: detects a mic silenced by the OS or another app
  and digital silence, swaps in a fresh track without renegotiation, logs to
  the connection log; `tdMicInfo()` in the console
- Automatic daily updates (`auto-update.sh`) with email report, major/minor/patch
  tagging, rollback instructions and automatic rollback on failure
- `GET /api/health` endpoint

### Fixed
- Light theme: device list, effects picker and other room popups had white
  text on a white background
- Automatic gain control back on by default (it was off on macOS, making
  built-in microphones too quiet)
- `install-cron.sh` now installs a persistent systemd timer (cron only as a
  fallback) and has `--status`: in LXC containers cron is often missing, so
  scheduled updates never ran
- Stored XSS through participant names
- Login rate limit bypass through a spoofed `X-Forwarded-For`
- Guests in the waiting room receiving chat and reactions from the meeting
- Deleted users keeping access until token expiry
- Unescaped meeting title and notes in invitation emails; non-compliant ICS files
- Uploads accepting renamed non-image files
- Screen share transport leak and lost effects when cancelling the picker
- Camera resolution dropping after removing an effect or background
- Microphone silently dying when removing a face effect/style (or switching to a
  background): the effect pipeline stopped the real mic track along with its
  own canvas track
- Mobile layout: toolbar overflow, participant strip, portrait cameras

## 1.0.0

- First release: mediasoup SFU rooms with waiting room, scheduled meetings with
  email invitations, chat, reactions, virtual backgrounds, face effects, local
  recording, connection diagnostics, external REST API.
