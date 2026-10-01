# Changelog

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
