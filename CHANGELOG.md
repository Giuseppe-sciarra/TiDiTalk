# Changelog

## 1.5.6

### Changed
- **Home → Recent** shows the last 5 meetings; the others open with
  *Show more (N)* (and close again with *Show less*). Removing one from the
  list brings the next one up
- **Home**: camera and microphone stay open for **10 minutes** with the tab in
  the background (were 2), then they are released as before

### Fixed
- **Ghost buttons on hover** (e.g. *Test* next to *Speakers* on the home
  page): the generic button hover gave them the full accent background with
  text of the same colour, so the label disappeared. They now get a light
  tint with accent text and border, readable in dark and light theme

## 1.5.5

### Fixed
- **Home: the speakers test always played on the system output** on Firefox,
  whatever was chosen in *Speakers*. The test used `AudioContext.setSinkId`,
  which Firefox does not have, so the choice was silently ignored. It now
  plays through an audio element with `setSinkId`, the same way the meeting
  does (where switching output already worked). If the chosen output cannot
  be used a message says so and the sound plays on the system output
- **Home: switching tab during the device check closed camera and
  microphone and reopened them on return.** With USB headsets (microphone and
  output are the same device) every close/reopen reconfigures the headset:
  music skipping, a click, sound ducking. They now stay open and are released
  only if the tab stays hidden for more than 2 minutes (then everything
  reopens on return, as before). If the browser suspended capture in the
  background and does not resume it, the full check runs again on return

## 1.5.4

### Added
- **Speakers are a separate control.** New *Speakers* button next to the
  microphone (shortcut `A`): it silences only what you hear from the others.
  Microphone, recording and notification sounds do not change, and muting the
  microphone never touches the speakers. Its ▾ opens **Audio output**: choice
  of output (with *System default*), output level, **test sound** and
  **"Can't hear anything? Reconnect the audio"**
- **Network & quality → Participants** shows each person's **voice bitrate**
  (`voice N kbps`, `silence`, `muted`): if someone talks and it stays on
  *silence*, their microphone is not capturing

### Changed
- The microphone ▾ is only about the microphone (title *Microphone*). The
  two sections used to be called "Audio" and "Speaker", and the translation
  turned "Speaker" into "Relatore" (presenter)
- **No output device is picked automatically any more**: without a choice the
  system default is used. Before, the first device of the list was chosen —
  on Firefox (no "default" entry) that was usually *MacBook speakers* even
  with headphones on. If the chosen output disappears, audio goes back to the
  system default; on device changes the others' audio is re-attached
- **Uniform control bar**: every button is filled like the
  microphone/speakers/camera groups (half of them used to be bare icons);
  *Leave* stays red on hover
- Phones: the speakers button has no ▾ (the phone picks the output), and the
  bar still fits on one line down to 360 px

### Fixed
- With **noise reduction (RNNoise)** on, Firefox stayed on "Configuring
  media…" when entering from the home page without clicking. While the
  browser keeps the audio engine suspended the normal microphone is sent, and
  the filter switches in as soon as the engine starts; if the filter cannot
  take the microphone (different sample rates on Firefox) it turns itself off
  instead of failing
- Tablets and narrow windows (641–820 px): button labels spilled out under
  the buttons
- The *Chat* label was shown as "Gatto" (clash with a face-effect name in
  the translations)

## 1.5.3

### Fixed
- **Docker build failing** with `gyp ERR! configure error … FetchError …
  node-v22…-headers.tar.gz`. On the alpine image `node-gyp` downloads the
  Node headers from unofficial-builds.nodejs.org, even when there is nothing
  to compile (better-sqlite3 13.0.0/13.0.1 run `node-gyp rebuild` on
  install); if that site does not answer, the whole build stops. The
  builder now uses the headers already in the image
  (`ENV npm_config_nodedir=/usr/local`), so no download is needed. Every
  release bumps `server/package.json`, so the `npm install` layer is rebuilt
  on each update and the problem showed up right after updating

## 1.5.2

Bug-fix release after a full review of the project (server, room page, home,
login, guest, schedule, settings).

### Fixed — meetings and invitations
- "Copy invite link" on a room of a past scheduled meeting (reopened from
  Recent) returned the meeting's **expired** guest token → guests saw
  "link not valid". A valid token is now generated and saved
- Meetings created through the external API did not save their guest token,
  so the CRM link and the panel's "Copy link" differed; room ids with `_`
  were accepted by the API but refused at join
- Scheduling a meeting in the past is now refused (client and server)
  instead of sending invites for a meeting that never shows up
- Invitation e-mails are sent in parallel (with many invitees the request
  could exceed the proxy timeout although the meeting was created)
- Recent: with a reused room code, every past row of that code showed
  "live" while the room was open
- `PUT /api/meetings/:id` returned 404 for meetings created by other users
  or by the API (now behaves like DELETE)

### Fixed — room page
- Microphone: when the permission is granted later (or "Retry" from the
  banner) while you are muted, the new audio stream was **live for the
  others** although everyone saw you muted. It now starts paused
- A new microphone track after unplug/replug stayed enabled while muted
  (recordings and "speaking" indicator); microphone acquired after a failed
  pre-join was invisible to recordings and the speaking indicator
- Camera: denied at pre-join then allowed, or unplugged and replugged,
  could not be turned on again ("Retry" failed forever). Camera is now
  reopened like the microphone; a dead camera also turns the button off
- Automatic reload after a reconnection (or after the host left) now saves
  a running **recording** first instead of losing it behind the browser's
  "leave page?" prompt
- "Present" for guests follows the room rule changed live by the host, not
  only the default of the admin panel
- Clicking the connection-quality bars no longer pins/unpins the tile
- Microphone watchdog: with the input muted at OS/headset level it showed
  "microphone restored" every 30 s in a loop
- Recording: a participant with the camera off was drawn as a black box or
  as a frozen last frame instead of the avatar
- Participants list: your own mute / camera-off / raised-hand state was
  never shown
- Keyboard shortcuts (M, V, S…) were active on the pre-join screen
- Call settings: "mirror my video" flipped the shared screen while
  presenting; the Info participants count included screen tiles
- "Mobile window" left the ⋮ button highlighted
- Poll votes are tied to the person, not to the connection: after a
  network drop the vote is kept and cannot be cast twice

### Fixed — other pages and server
- A stale guest link opened earlier in the same tab made a logged-in host
  join as a guest (or logged them out); hosts now always join as hosts and
  the login clears the guest token
- Login `?next=` accepted `//evil.com` (open redirect)
- Home → "Join with code": pasting an invitation link (`/join/…`) created
  a junk room instead of following the link
- Home device check: two concurrent starts (tab back in foreground + device
  change) could leave a camera/microphone running
- `/join/<token>/` with a trailing slash failed
- Brand texts containing `$$`, `$'` or `$&` broke every page
  (`String.replace` special patterns)
- Room lifecycle: a destroyed room could remove a newer room with the same
  code from the registry; joining a second room on the same connection left
  a ghost peer in the first; "room full" was reported only after removing
  the guest from the waiting list

## 1.5.1

### Added
- **Network & quality → Participants** (hosts): every participant's
  connection as the server sees it — quality level, bitrate in and out,
  latency, jitter, packet loss, direct or TURN path, browser and device
  network. Own streams in the Streams list are now labelled "You"
- **Audio diagnostics in the server log**: what the listener's browser did
  with the audio now reaches `docker logs tdt-app | grep CONN` as
  `audio ev=…` lines (`join` summary, `play-ok`, `play-blocked`, `unblocked`,
  `unblock-failed`, `no-data` after 8 s without packets, `consume-error`,
  `sink-error`), plus `rejoin` lines when someone comes back after a drop.
  New socket events `clientMedia` (client → server) and `roomNetStats`
  (hosts)

### Changed
- **Admission survives network drops**: a guest admitted from the waiting
  room gets a ticket that lasts for the whole meeting. After a reload or a
  network drop they come straight back in — no second admission, even if the
  room was locked in the meantime. Removing a guest revokes the ticket. The
  ticket also survives 90 s after the room empties (host leaving and the
  last guest reloading at the same time)
- **Automatic rejoin after a drop**: after "Connection lost… reconnected" the
  page reloads straight into the meeting with the same name, microphone,
  camera and devices — no pre-join screen (guests and hosts alike). Same
  when the host leaves and guests go back to waiting
- When the same browser tab comes back (reload after a drop) the old,
  dead connection is closed at once instead of lingering as a duplicate
  tile or waiting-room entry until the ping timeout; a duplicated tab is
  told "Meeting opened elsewhere"
- "Server namespace disconnect" is now explained in the CONN log

### Fixed
- **"Browser blocked the audio" banner**: it used to close by itself after
  60 s saying "Audio enabled" even when the browser still blocked playback,
  so whoever had not tapped in time stayed deaf without knowing. It now
  stays until the audio really plays, any tap on the page unblocks it, and
  "Audio enabled" appears only on success
- **Read-aloud "explosion"**: the first syllables of a chat message read
  aloud started with a burst (`cancel()` immediately followed by `speak()`);
  the notification chimes could also pop when the audio context was
  suspended (first interaction, tab back in foreground)

## 1.5.0

### Added
- **Waiting room like Google Meet**: guests wait until a host admits them
  (on by default, Settings → Meetings). Hosts see a card at the top right
  with name, waiting time, **Admit / Deny / Admit all**, a sound and a badge
  on the People button; guests see a "you're in the waiting room" screen and
  get in without reloading. Registered users always get straight in. Guests
  already admitted stay admitted if the last host drops and comes back
- **Call settings window** (gear in the header or ⋮ → Settings), with
  sections: **Audio & video** (microphone, camera, speakers, live mic level,
  automatic gain, RNNoise, mirror my video), **Room** (hosts only: waiting
  room on/off *for this meeting*, **lock the room**, guest screen sharing,
  drawing for everyone, **mute everyone**, copy invite link), **Recording**
  (video quality 1.2 / 2.5 / 5 / 8 Mbps), **Appearance** (theme, grid or
  speaker view, data saver, sounds, language), **Shortcuts** and **Info**
- Hosts can **remove a guest** from the People list (× next to the name)
- **New home page**, centred in the viewport, with an animated background of
  floating geometric shapes: tabs *New meeting / Schedule / Join with code /
  Recent* that slide in from the right, room code updated live while typing,
  microphone and camera "on entry" switches. On the right a full **device
  check**: camera preview, live microphone level, microphone / camera /
  speakers selectors and a speakers test. Greeting by time of day and date
- **Animated background of geometric shapes on every page** (replaces the
  accent beam), tinted with the brand colour and different on each page:
  rising with mouse parallax on the home page, slowly orbiting around the
  card on login and invite pages, flowing right-to-left on Schedule, almost
  still on Settings, falling like confetti on the end-of-call page, sparse
  behind the pre-join screen and pulsing around the guest waiting screen.
  It pauses when the tab is hidden and stops once you are in the call
- Texts never sit on the moving shapes: page titles, settings menu, login
  logo and company info, the home columns, the pre-join panel, the guest
  waiting screen and the version pill are on solid cards; the top bar is
  solid too
- **Registered users go straight into the meeting**: devices checked on the
  home page are used as they are and the pre-join screen is skipped (guests
  still get it; if a device fails the pre-join appears as before)
- **Schedule tab** on the home page: the next meetings on the calendar with
  invite link and one-tap join, plus a shortcut to schedule a new one
- README with a screenshot gallery (`docs/screenshots`, EN and IT)
- **Recent meetings** stored on the server: start date and time, duration,
  number of people, who took part, "live" badge with the number of people
  currently inside; one tap to rejoin, × to remove from your list. Each user
  only sees the meetings they joined
- API: `GET /api/rooms/recent`, `DELETE /api/rooms/recent/:id`; socket
  events `lobbyAdmit`, `lobbyDeny`, `roomRules`, `muteAll`, `kickPeer`

### Changed
- Guest screen sharing and "everyone can draw" are now per-room rules
  (initialised from Settings → Meetings, changeable by hosts during the call)
- Brand name no longer wraps letter by letter in the header on narrow phones
- Leaving the meeting: immediate "leaving…" screen on click, and hosts go
  straight to the home page (before: room → login page → home, two page
  loads with no feedback, so it felt like the button needed a second click)

### Fixed
- Waiting room: admitting a guest needed a second click — the guest stayed in
  the hosts' list until their browser had fully joined, and the hosts were
  not notified when they did. Now the row disappears on the first click
- Call settings window: the content was cut off at the bottom instead of
  scrolling (Room and Recording sections on smaller screens)
- Call settings → Appearance: proper icons for Grid / Speaker
- Name under the avatar duplicated the tile label (overlapping in the side
  strip); the "powered by" bar no longer shows a dark band in the light theme

## 1.4.0

### Added
- **End-of-call page for guests** (`/bye`): two-column branded layout — logo,
  title and subtitle on an accent-colour (or image) panel; on the right an
  animated **constellation of the participants** (or check-mark / duration
  ring / none), call stats (duration, participants, date), optional **1–5
  star rating with comment** (stored, visible to admins in Settings → End of
  call), contact card (name, role, email, phone, photo) and up to 3 buttons.
  Hosts and registered users still return to the home page
- Reached from the Leave button, when the host closes the meeting (choice:
  end-of-call page or waiting room) and on lost connection; alternatively
  redirect guests to an external URL
- Settings → **End of call** tab: enable/disable, dedicated logo with size
  (44/80/120/170 px), white box and name toggles, texts with placeholders
  (`{nome}`, `{host}`, `{durata}`, `{partecipanti}`, `{azienda}`), background
  image, animation, stats, rating, contact card, buttons; table of received
  ratings
- End-of-call page: wider card, buttons stay on one line, Close button;
  admin-written texts are not auto-translated
- Login page shows the company info from Settings → Company; the animated
  accent beam of the login page is now on every page
- API: `POST /api/feedback` (rate-limited), `GET/DELETE /api/feedback` (admin);
  new upload kinds `byebg` and `contact`

### Fixed / security
- Turning advanced noise reduction on from the microphone popup stopped the raw
  microphone (mediasoup `replaceTrack` stops the previous track by default) →
  silence for up to 30 s; the audio producer now uses `stopTracks: false` and
  the switch-off order was corrected
- Erase/undo on annotations re-sent the whole surface to everyone: now a delta
  event (`annErased`); per-surface cap on total points
- A socket disconnecting while its room was being created left a ghost peer
  (router never closed, lobby bypass) — now detected and cleaned up
- Feedback endpoint: IP map swept periodically, IPv6 limited per /64, global
  cap, generic error messages; `NODE_ENV=production` and a final JSON error
  handler (no stack traces in HTTP error responses)
- Polls: own rate-limit bucket, options list bounded before processing;
  annotation text bounded before processing
- Mute-warning detector could leak a microphone clone when stopped during
  start-up (fast unmute / push-to-talk)
- Host closing the meeting while a guest was recording lost the recording
- Copying the invite link on Safari after an `await` could fail silently
  (now shows the link to copy)
- Push-to-talk: pressing again right after release no longer leaves the mic
  muted; network monitor per-stream bitrate uses real elapsed time
- End-of-call page: contact role and company name are HTML-escaped; URLs are
  re-validated when read from the database

## 1.3.0

### Added
- **Polls**: hosts create a poll (question, 2–10 options, anonymous or with
  names), everyone votes with a tap, live results with bars, change your vote
  while open, close/delete. Panel in the "More" menu, badge on new polls
- **Network & quality** window (More → Network & quality): live graphs of
  upload/download bandwidth and latency/jitter over the last 60 s, packet
  loss, per-stream bitrate/resolution/fps, direct vs TURN path, device network
  type, smoothed quality badge with hysteresis
- **Push-to-talk**: hold Space while muted to talk, release to mute again,
  with on-screen pill and audio cues
- **Advanced noise reduction** (RNNoise, WebAssembly AudioWorklet): switch in
  the microphone popup, remembered per browser; survives microphone switches
  and automatic recoveries. ~110 KB downloaded once, nothing leaves the device
- Annotations: **text** tool (multiline, Enter to confirm), **eraser** (own
  strokes; hosts and presenter can erase anyone's), **hide drawings** for
  yourself, **save PNG** of the shared screen with the drawings
- Leave: while recording, a dialog asks to save first and the file is
  saved before the page changes (previously the recording could be lost); the
  browser also warns when closing the tab during a recording
- Native share sheet for the invite link on phones and tablets
- Recording download fixed on mobile (anchor attached to the DOM)

### Changed
- Screen sharing on Safari uses the browser default resolution (forced
  1080p constraints made the capture blurry)
- Annotation toolbar is more compact and scrolls on short screens

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
