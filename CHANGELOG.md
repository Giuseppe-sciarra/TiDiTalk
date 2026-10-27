# Changelog

## 1.8.9

Hats, headbands and costumes sit on the real head in real calls, 19 new 3D
effects (411 in all), a search box for the 3D effects, the fix for Node's
Brotli flaw, and a nightly automatic update that now also brings new Node,
Alpine and coturn.

### Added
- **19 new 3D effects**, made on the measured real head: fedora (tips itself
  when you raise your brows), straw boater, flat cap, Robin Hood hat with a
  swinging feather, Nordic pom-pom beanie, Christmas stocking cap with a bell,
  earmuffs with frosty breath, alien antennae, New Year 2027 crown with
  confetti, holly headband, 80s sweatband, ski goggles on the forehead that
  drop onto your eyes, swim cap and goggles with bubbles, Saturn rings, a
  sleepy panda on your head that wakes up, mirrored aviators that slide down
  your nose, hippie shades, retro cat-eye glasses, googly-eye glasses
- **Search the 3D effects**: a box at the top of the 3D effects tab filters as
  you type, in every language of the app (Italian, English, French, German),
  by section ("masks", "costumes"…) or just "animals". Partial words work
  ("kitt" finds kittens); several words must all match. Esc or × clears it,
  Enter jumps to the first result
- **Nightly automatic update, rebuilt**:
  `aggiorna-tutto.sh`, scheduled by `installa-aggiornamento.sh` every night at
  05:00 Italian time (systemd timer, cron as a fallback). Every night it
  downloads the latest `node:22-alpine`, so security fixes in Node and Alpine
  actually arrive (before, the image downloaded the first time stayed forever);
  updates coturn when a new image is out, with its own check and rollback;
  rebuilds by itself after a patch, when Dockerfile or code differ from the
  last successful build; computes the npm updates in a throwaway container
  that only gets `package.json` and the lock file; holds back a dependency
  that has an upper limit (e.g. `"mediasoup": ">=3.14 <4"`); after the
  restart the app must answer and must not restart by itself for 20 seconds,
  otherwise everything goes back as it was. The email says what happened (app,
  Node, coturn) and gives the exact command to go back. Postponing during
  meetings, `--force`, realigning old versions inside the image and the
  major/minor/patch table all stay. `auto-update.sh` and `install-cron.sh`
  still work and hand over to the new names; the new installer removes the
  old 08:00 schedule. coturn gets up to 10 minutes to stay up on a new
  image (`AGG_ATTESA_SERVIZI`); if it doesn't, its state, health check,
  restarts, exit code and last log lines go into the log and the email before
  it goes back to the previous image

### Security
- **Node's Brotli flaw (CVE-2026-111497, October 2026)**: the server no longer
  accepts compressed request bodies (gzip, deflate, brotli: no Tiditalk client
  sends them), so the flaw can't be reached whatever the Node version. The
  Dockerfile stops the build with a clear message if the Node image is still
  an affected one (fixed in 22.23.4 / 24.22.1 / 26.12.1) and tells you to
  rebuild with `docker compose build --pull`. The nightly report also lists
  the Node version

### Fixed
- **Hats and headbands sit on the real head in real calls**. With a webcam a
  bit below the face, hats floated above the head and you could see inside
  them. The causes, rebuilt from real call screenshots:
  - the head the effects are drawn against stopped at the hairline: now it
    has the real skull (3–4 cm taller and longer), so the inside of hats and
    the back of bands and brims no longer show;
  - the head rotation from MediaPipe was off by 5–10° with a beard, a hand in
    front of the mouth or a turned head: now it is refined on the points of
    the upper face, on webcams only;
  - scarves, collars and capes followed the whole tilt of the head: now they
    bend less than the head, like a real neck;
  - many hats had their crown about 5 cm in front of the real axis of the head
    and some effects were fitted on thick hair: hats, caps, helmets,
    headbands, headphones, horns, ears and wigs were moved one by one onto the
    real head (bowler, fisherman, witch, wizard, chef, party, top hat, elf,
    bucket, cowboy, beanie, cat-ear headphones and the others)
- **coturn updates again**: the 2026 coturn images refuse `--no-dtls` (DTLS
  is already off unless `--dtls` is given) and stopped right after starting.
  The compose file now passes `--no-dtls` only to coturn versions that know it
- **Costumes and accessories**: Italy fan and Halloween witch hats now fit
  over the forehead with a dark lining (no light "lid" seen from below);
  scarves, ruffs, capes, wings, tail and the pirate's parrot follow the body;
  the starry and bunny hoods frame the face instead of sticking out in front
  of the cheeks; the far side of the Venetian mask hides when you turn; the
  puppy and hamster stay on your shoulder when you tilt your head; mushroom,
  strawberry, froggy and teddy hats and the sleepy zzz got dark linings

## 1.8.8

175 new 3D face effects (392 in all): animals with real fur, kawaii animals,
characters and costumes, cute accessories, fun and Halloween effects, new face
paints. Plus the fixes from a full check of 1.8.0–1.8.7.

### Added
- **Animals with real fur** (32): tabby kitten, black cat, white Persian,
  Siamese, ginger cat, shiba, golden and pug puppies, tiger and lion cubs, red
  panda, giant panda, raccoon, lop-eared bunny, hamster, red fox, koala joey,
  polar bear cub, wolf pup, piglet, penguin chick, little owl, unicorn. Soft fur
  that lags a little behind the head, glossy eyes that blink one at a time and
  look where you look, a real mouth with tongue that opens, smiles, frowns and
  kisses. On your own face: puppy, kitty, bunny, teddy and fawn faces, a kitten
  or a hamster on your head, kittens peeking from behind your shoulders, a
  puppy on your shoulder. On slow computers the fur gets lighter by itself
- **Kawaii animals** (29): round toy-like heads with big shiny eyes and pink
  cheeks — bunny, kitten, puppy, plush teddy, froggy, chick, chubby hamster,
  penguin, piglet, axolotl, fox cub, fawn, panda, koala, calf, lamb, baby seal,
  otter, hedgehog, octopus, sloth, mouse, lion cub, unicorn, baby dragon — plus
  a froggy and a duckling on your head, a bunny peeking from your shoulder and a
  hamster on your shoulder
- **Characters and costumes** (25): bearded pirate, viking, wizard, witch,
  Santa, Christmas elf, vampire count, fairy, caped hero and heroine, screen-face
  robot, hooded skeleton, mummy, stitched monster, Halloween zombie; Roman
  centurion, pirate with a parrot that squawks when you open your mouth, king,
  starry hood, samurai, pharaoh, fairy-tale princess, detective with a pipe,
  firefighter, snow queen. Picking an effect again is instant, and the video
  doesn't freeze while a character is prepared
- **Fun and Halloween** (37), triggered by your face: confetti, balloons,
  fireworks, fairy dust, autumn leaves and cherry blossoms when you smile; a
  rainbow, a ghost parade, a pie in the face or a jack-o'-lantern hat when you
  open your mouth wide; a head on fire or a storm cloud (sun and rainbow when you
  smile) when you frown; laser eyes or falling shades when you raise your
  brows; bubbles, a party blower, birthday candles and flying kisses when you
  blow; dizzy stars with your eyes closed; butterflies, heart eyes, cartoon
  tears, comic BOOM, angel wings, devil horns and tail, witch with bats, Santa
  hat with snow, reindeer, jester, Venetian mask, Easter bunny, Italy fan,
  chef, firefighter with hose, doctor, miner, pilot. Talking doesn't set them off
- **Cute accessories** (27): bouncy ear headbands (teddy, mouse with cheese,
  kitty with bow and bell, fox, floppy bunny) that perk up when you raise your
  brows and droop when you frown, blossom antlers, polka-dot and twin bows,
  teddy beanie, bunny hood, froggy hat whose eyes blink with yours, strawberry
  and toadstool hats, a chick in its eggshell, a cupcake, a melting ice cream, a
  donut, a smiling avocado and kawaii sushi on your head, kawaii blush, rainbow
  and little clouds, anime sweat drop and anger mark, sleepy zzz with a nose
  bubble when you close your eyes, a singing birdie, a little snail, a strolling
  ladybug and a buzzy bee that lands on your nose
- **25 new face paints**: tabby cat, white tiger, snow leopard, arctic fox,
  scaled dragon, mermaid, monarch butterfly, painted flower crown, Catrina, gold
  and black skull, harlequin, Colombina, black half-mask, Pierrot, spiral tattoo,
  neon cyber make-up, geometric glitter, festival gems, and the flags of
  Portugal, the Netherlands, Belgium, Switzerland, Japan, Mexico and Canada

### Fixed
- **Present again with audio**: cancelling the browser's screen picker ended
  the presentation that was running. Now you choose the screen first and the
  old presentation stops only after that
- **Use an audio device**: if sending the chosen input failed, it was left open
  (a microphone or BlackHole stayed on); now it is closed again
- **+N tile**: someone hidden in it who raises their hand now comes into view by
  themselves
- **Zoom on a shared screen**: Ctrl/⌘ + plus, minus and 0 did nothing (and
  Ctrl + plus zoomed the whole page) when the shared screen appeared under a
  mouse that had not moved
- **Pre-join**: initials of names with parentheses or symbols follow the 1.8.0
  rule there too («Giuseppe (Sciarra)» is GS, it was «G(»)
- **Questions**: the *Ask a question…* placeholder is translated in English,
  French and German

### Repository
- The 1.8.7 commit on GitHub contained only the 12 files of the update and
  removed the other 626 files of the project (styles, scripts, part of the
  server, fonts, sounds, backgrounds and all the 3D effects). They are back: the
  repository is again the complete program. Servers updated with the 1.8.7 zip
  were not affected

### Update
- Only `docker compose up -d --build`

## 1.8.7

The audio of what you present (a YouTube video, a DaVinci Resolve timeline).

### Fixed
- **Screen audio is captured as audio, not as a voice**: the browser is asked
  for tab and system audio without echo cancellation, noise suppression and
  automatic volume (they ruined music and videos), and for *Also share system
  audio* where the browser allows it. The meeting tab itself is no longer
  offered in the picker (it would echo)

### Added
- **Presenting without audio is no longer silent for the presenter**: if the
  presentation starts without audio, a card explains what to do in that
  browser: share the tab with *Also share tab audio* for YouTube and the like,
  *Entire screen* with *Also share system audio* on Windows for an app; on a Mac
  apps need a virtual audio device; Firefox and Safari can't share screen audio.
  *Present again with audio* restarts the sharing in one click. A pill on *Your
  screen* says *With audio* or *No audio* (click it for help)
- **Use an audio device**: send any audio input as the presentation audio
  (stereo, no voice filters), for example BlackHole on a Mac to let the others
  hear DaVinci Resolve or another app

## 1.8.6

3D face effects that recover by themselves when the browser briefly refuses 3D
graphics.

### Fixed
- **"3D effects are not available in this browser" until reloading the page**:
  Chrome can refuse 3D graphics (WebGL 2) for a moment, for example on older
  MacBooks when the graphics card is busy or Chrome's graphics process restarts.
  Tiditalk checked only once and kept that "no" until the page was reloaded.
  Now the "no" lasts a few seconds: the Effects panel says it will try again,
  retries by itself (and with *Try again now*) and fills the 3D tab as soon as
  the graphics are back
- **A 3D effect that fails to start** is tried again once by itself after a
  moment, and the 3D engine is created a second time if the browser refuses it
  the first time; a half-created engine is closed so it does not keep the
  graphics busy
- **3D graphics lost while an effect is on** (graphics card restarted): the
  effect is rebuilt by itself

### Added
- **Diagnostics in the server log**: when the browser refuses 3D graphics, an
  effect fails, the graphics come back or get lost, a `[CONN] … fx3d` line is
  written with the reason and the graphics card name
  (`docker logs tdt-app | grep fx3d`)

## 1.8.5

### Added
- **Written answers in Questions**: under each question hosts can *Write the
  answer*; it shows under the question for everyone (also for people who join
  later) and the question moves to *Answered*. Whoever wrote it can edit it
  (marked *edited*) or remove it (the question goes back to waiting). The Excel
  download has a *Written answer* column. Only hosts can answer, checked by the
  server
- **Meeting in progress on the home page**: at the top of the left card, with
  *Join* and *Join as a second screen*, no code to type again (the typical
  case: you are already in the meeting on the laptop and open the home page on
  the second device). The green "1 meeting in progress" line leads there

### Changed
- *Switch to audio* is now **Back to the call** (button, notices, server message)
- *Join as a second screen* is no longer under *Join with code*

### Fixed
- Long notices in the room went out of their pill: now they wrap inside it and
  stay centred

## 1.8.4

### Fixed
- Home page on Windows: a vertical scrollbar appeared on the left card in every
  tab (the hidden tabs counted in its height). Now the card never scrolls: only
  the list in *Recent* or *Schedule* scrolls, and only when it is longer than
  the card

## 1.8.3

Tiles that show who is talking, a ⋮ menu on tiles, a simpler room on phones
and the second screen always at hand.

### Added
- **Voice indicator on every tile**: a round badge at the top right with three
  bars that follow the voice while the person talks, or a crossed-out
  microphone on red when they are muted (also on your own tile). A solid ring
  in the accent colour around whoever is talking, drawn inside the tile so
  nothing moves. Smaller badge and ring on small tiles; nothing on shared
  screens and on the *+N* tile
- **Camera off**: the tile takes the colour of the person's avatar, with a large
  circle with the initials that scales with the tile and rings that spread out
  while the person talks
- **Phones** (portrait up to 640 px and landscape): at the top only the room
  code, *switch camera* (when there are at least two cameras) and the
  speakers; at the bottom five large buttons: microphone, camera, hand, More,
  Leave. *More* opens as a sheet from the bottom with a grid for Present,
  Draw, Reactions, People (with the count), Info, View and Record, then the
  usual items and theme, notification sounds, language, quick guide, invite
  and settings. The chat has a floating button on the right with the unread
  count. Your own video is a small draggable window by default (until you
  choose otherwise in *View*)
- **Menu ⋮ on every tile** (on mouse over) and next to every name in the People
  list. Hosts: *Pin for me*, *Pin for everyone* (up to 3 tiles, with "Pinned for
  everyone by …" on the tile; everyone can still *Unpin for me*), *Full
  screen*, *Mute* (that person only), *Send back to the waiting room* and
  *Remove* (with confirmation). Guests and participants: *Pin for me* and *Full
  screen*. Every host command is checked by the server
- **Join as a second screen from the home page**: under *Join* in *Join with
  code* and next to ongoing meetings in *Recent*, for registered users who
  skip the pre-join screen
- **Use as second screen** in *More* inside the room: microphone and camera
  close, speakers are muted and your tile disappears for the others, without
  leaving the meeting; *Switch to audio* brings everything back. It survives a
  reconnection

### Changed
- Home page: the two cards always have the same height on computers; long
  lists (Recent, Schedule) scroll inside the card
- The network signal on the tiles shows only on mouse over, and always when the
  connection is poor (on phones only when it is poor)
- The old speaking bar and the red mute dot at the bottom right of the tiles
  are replaced by the new badge
- Computers and tablets keep the top bar and the control bar exactly as in
  1.8.2

## 1.8.2

Chat, notifications and the shared screen, closer to Google Meet.

### Added
- **Pinned messages in the chat**: hosts pin up to 3 messages at the top of
  the chat (server-checked); people who join later see them too and a click
  jumps to the message
- **Reactions on chat messages**: 👍 ❤️ 😂 😮 🙏 with the count under the
  bubble; the tooltip says who reacted, the same emoji again removes yours
- **Reply with a quote**: *Reply* shows the quoted message above yours, a click
  on the quote jumps to the original (the server takes name and text from the
  history, the client only sends the message id)
- **Clickable links** in the chat: only http, https and www, opened in a new
  tab with noopener; everything else stays plain text
- **"Laura is typing…"** above the chat box
- **Notifications at the bottom left**: who joins and leaves, chat messages,
  recording started, stopped and saved arrive as cards stacked above the
  control bar, with the person's initials and colour and the time. Chat cards
  have a **Reply…** box that sends without opening the chat; older cards fade
  and leave by themselves, they stay while the mouse is over them. One compact
  card at a time on phones. The *raised hands* notice is the last card of the
  stack. Technical warnings (microphone, network, permissions) are unchanged
- **Zoom on a shared screen**: − % + and *Fit* bar, Ctrl/⌘ + wheel or trackpad
  pinch on the cursor point (100 % to 400 %), drag to move, a minimap to pick
  the area; Ctrl/⌘ + plus, minus and 0 only with the mouse over the shared
  screen. Pinch and one-finger drag on phones. Drawings and laser stay aligned
  with the content at any zoom; *Save image* and the recording still take the
  whole screen. Only for who is watching: nothing goes to the server
- **Open the shared screen in a new window** (for a second monitor): it uses the
  same video stream of the meeting (no extra download), with zoom, minimap,
  live drawings and laser; the room shows *Show the window* and *Bring it
  back*. If the window is closed the screen comes back to the room, when the
  presentation ends the window closes by itself

### Changed
- Joins, leaves and recording messages are no longer pills at the top: they
  are notification cards at the bottom left
- Your own replies sent from a notification do not count as unread messages
- The reactions column starts above the notification stack

## 1.8.1

3D face effects: the ones that did not work well are fixed, the weakest ones
are removed.

### Fixed
- **The effect appeared huge for a moment** when applied (or after standing
  still, switching tab or losing the face) and went back to normal only when
  moving. Two causes: an old pose left over from the previous effect, and a
  single wrong measurement drawn as is. The effect now appears only after a
  few consistent measurements of the face, impossible measurements are
  discarded, a sudden jump counts only if the next measurement confirms it,
  and the motion prediction is limited and reset after a pause
- **Wigs from free models**: the pink bob went down over the eyes, sat to
  one side and left a hole on the forehead (the cap went inside the head); the
  blond bob looked like a flat orange box (its colour texture and normal map
  were swapped). Both are rebuilt: cap on the skull, fringe centred above the
  eyebrows, natural colours with darker roots, soft-edged locks. Also rebuilt:
  dark bob (its fringe covered an eye), blond hair, long black hair

### Changed
- **Expressions follow your face**: MediaPipe gives small values (a wide open
  mouth is about 0.5 out of 1) and the effects used them as they came. The
  engine now learns each person's neutral face in about half a second and
  maps every expression to its full range, with a filter that removes jitter
  without delay. Effects receive calibrated values (0 = your neutral face,
  1 = full expression)
- **Characters rebuilt** (33): a real mouth with teeth and tongue that opens,
  smiles, kisses and puffs the cheeks; glossy cartoon eyes that blink, squint
  and look where you look; eyebrows; ears, whiskers and tufts that move with
  a little inertia
- **Heads from free models** (cube animals, monsters, wolf, werewolf, tiger,
  pumpkin, red panda, sugar skull): now with a mouth and eyes that copy your
  expressions
- **Hair and beards**: fine strands with a highlight along the hair, a
  hairline that rises gradually (no more "bowl"), afro and curls as a frizzy
  cloud, real braids; beards and moustaches follow the jaw when you open the
  mouth
- **Hats, glasses and accessories**: believable materials (felt, knit,
  leather, metal, tinted lenses instead of milky ones), rounded edges; on a
  bald head tilted down the back of a hat no longer shows through the
  forehead. The light bulb lights up with surprise, not when you talk
- **More menu**: *Polls* removed, it is already in *Activities* (button in the
  bar, or *Activities* in the More menu on narrow screens)

### Removed
- Effects that stayed poor: unicorn, sloth, smiley, butterflies, rain cloud,
  sushi hat, hair clips, earrings, dreadlocks, emo hair, red swept-back hair
  (228 → 217 effects)

### Update
- Only `docker compose up -d --build`

## 1.8.0

Ideas taken from Google Meet (only the idea: no code, icons or images from
Google), redone with Tiditalk's colors, fonts and panels.

### Added
- **Change layout** (*View* button): Auto, Grid, Spotlight or Sidebar,
  each with a small illustration; a slider for the maximum number of tiles
  (2 to 25; beyond that a **+N** tile with the initials of who is not shown,
  which opens the People list — people who raise their hand or speak move
  into view by themselves); **hide people with the camera off**, with a notice
  that says who is hidden and a *Show* button; **your own tile** in the grid,
  as a small window you drag to a corner, or hidden. Only for you, saved in
  the browser. On the phone it opens as a bottom sheet (max 8 tiles). Works
  with the presenter view and the row of people above the shared screen
- **Meeting timer**: an organizer starts a countdown (1, 3, 5, 10, 15 minutes
  or a custom length, with an optional title). Everyone sees it in a pill at
  the top; organizers can pause it, add a minute or cancel it. At the end it
  rings (respecting the sound settings) and shows a notice. It runs on the
  server clock, so it is the same for everyone, and people who join late see
  it already running
- **Questions and answers**: anyone asks a question, also **anonymously**
  (the name does not even reach the server), and the others vote for it (one
  vote each, can be taken back). Tabs *Top voted*, *Recent*, *Answered*.
  Organizers mark a question *Answering now* (highlighted for everyone) and
  *Answered*, hide off-topic ones and download the list as a CSV for Excel
- **Activities** button in the bar (next to People, with a counter): one
  panel with Polls, Timer and Questions. On narrow screens and phones it is
  in the *More* menu
- **Raised hands in a queue**: in the People list a *Raised hands* section in
  order of arrival, with how long ago and *Lower* for each one (organizers
  and the person themselves) and *Lower all* (organizers). The tile shows the
  place in the queue (✋ 2) and a notice at the bottom left (*3 raised
  hands*) opens the queue. The hand goes down by itself after about 4 seconds
  of speaking (it was 10 fixed seconds). Order and times come from the server
- **Reactions bar with skin tone and names**: a row of 9 reactions above the
  button, the skin tone (saved in the browser) and a **+** with every emoji
  and a search. Reactions rise along the left edge with the name of who sent
  them (from the server) and stay on that person's tile for a few seconds;
  the burst is kept when many people react together. The bar stays open after
  a click and closes with Esc, a click outside or the button
- **End the meeting for everyone**: pressing Leave, an organizer chooses
  between *Just leave* and *End the meeting for everyone*: everyone goes
  to the end-of-call page, including people still in the waiting room
- **Message to people waiting**: from the waiting room card an organizer
  writes to whoever is waiting (three quick replies or free text). The guest
  sees the message and their place in line (*You are 2nd in line*)
- **Join as a second screen**: from the pre-join page, join from the laptop in
  the meeting room without microphone, speakers or camera (so no echo). Chat,
  polls, hand, reactions and Present stay; the others don't see an extra tile
  and *Second screen* is shown next to the name in People and in the waiting
  room. *Switch to audio* turns it into a normal participant without
  rejoining. The server refuses microphone and camera from a second screen
- **New pre-join page, "Ready to join?"**: a large preview with your name and
  the microphone and camera buttons inside it; below, three pills for
  microphone, speakers and webcam; on the right who is already in the
  meeting (only with a valid link), your name, a large join button and
  *Other ways to join* (*Join as a second screen*, *Join and present*).
  In a column on the phone; everything fits on 768 px high screens

### Changed
- **Animations always run**: the rule that turned off almost every animation
  of the room when the system had *Reduce motion* enabled has been removed
- Initials of names with parentheses or symbols: «Giuseppe (Sciarra)» is
  now **GS** (it was «G(»), everywhere: tiles, People, waiting room, home,
  pre-join, floating window, end page

### Fixed
- **Phone, light theme**: the full-screen panels (Chat, People, Polls, Info,
  Backgrounds and effects, Settings) had a fixed dark background with dark
  text and names could not be read; the × of the Info window was white on
  white. They now use the theme colors (dark theme unchanged)
- **Mute everyone on Firefox** could leave a microphone on while its button
  showed it muted: the button now follows the real state of the track and a
  microphone that turns itself back on is muted again
- The *microphone muted* warning closed its audio part twice

### Update
- Only `docker compose up -d --build`: no new setup scripts to run

## 1.7.0

### Added
- **3D face effects, like Meet**: 228 effects that follow the head in 3D and
  copy your expressions, in a new **Effetti 3D** tab of the "Backgrounds and
  effects" panel, grouped like Meet: *New*, *Characters* (animals, robot,
  monsters, astronaut, strawberry… that open their mouth, blink and raise
  their eyebrows with you, and scenes with your face in a frame: shark,
  T-rex, diver, knight, sunflower), *Fun* (propeller cap, UFO, rain cloud
  that rains harder when you frown, orbiting hearts…), *Costumes* (hats and
  helmets), *Hair* (wigs: afro, long, bob, braids, mohawk…), *Beard*,
  *Accessories* (glasses, ears, headphones, crowns, earrings) and *Face paint*
  (zombie, old age, skulls, animals, clowns, superhero masks, gold and silver
  statue, flags on the cheeks… painted on the skin, they stretch with the
  mouth and the eyes). Each effect has a preview image. Hats and wigs are
  hidden behind the head when you turn, the painted masks stay on the skin
- The face is tracked by **MediaPipe Face Landmarker** (468 points of the face,
  head position and 52 expressions) in a separate thread (Web Worker): the
  call, the chat and the connection don't slow down while it works. The 3D is
  drawn with **three.js**; the position is predicted for the moment the frame
  is shown, so the effect does not lag behind fast head movements. On slow
  computers the 3D is drawn at a lower resolution by itself
- 40 effects come from free 3D models (CC0 / CC-BY 4.0 / Apache-2.0) in
  `public/assets/effects3d/glb/`, credits in `glb/CREDITS.md`; the others are
  written in code (AGPL like the rest). How to add one:
  `public/assets/effects3d/README.md`
- The libraries and the model (about 20 MB) are downloaded **only the first
  time** you open the *Effetti 3D* tab, with a notice; the browser keeps
  them afterwards

### Changed
- More → *Face effects* opens the **Effetti 3D** tab. The old 2D face effects
  (emoji stickers) are in their own **Classici** tab, exactly as before
- A 3D effect stays when you change color style and when you turn the camera
  off and on; choosing a virtual background turns it off, as with the
  classic effects
- Browsers without WebGL 2 graphics see a notice in the *Effetti 3D* tab and
  keep the classic effects; if a 3D effect fails to start, it goes back to
  *None* with a message instead of leaving a black video
- Tested on Chrome (and Edge, Brave, Opera, which use the same engine),
  Firefox and WebKit (Safari's engine). On Safari before 17, which has no
  graphics inside a Web Worker, the face tracking runs on the page

### Update
- **Run `bash setup-mediapipe.sh` again**: it now also downloads MediaPipe
  Tasks Vision and three.js into `public/assets/vendor/`. Then
  `docker compose up -d --build`

## 1.6.0

### Added
- **Presenting: participants in a row above the shared screen** (like Meet).
  While someone shares, the tiles sit in one row on top and the shared screen
  takes the rest; the tiles get smaller as more people join, down to a minimum
  size, then the row scrolls (also with the mouse wheel). Initials of people
  with the camera off scale with the tile. Same on the phone
- **"Backgrounds and effects" side panel** instead of the old windows: opens on
  the right like chat and polls (full screen on the phone), with a live
  preview of yourself ("only you can see it"), three tabs (Backgrounds, Face
  effects, Styles), the active choice marked with a check, and *Turn on
  camera* when the camera is off. It stays open while you try things. Opens
  from More → Virtual background / Face effects and from a button on your own
  tile (on hover). One panel at a time: opening chat, people or polls closes
  it and vice versa
- **59 new backgrounds**: 56 photos (offices, living rooms, libraries, Cinque
  Terre, Venice, the Colosseum, mountains, sea, space, abstract, video games)
  that `setup-backgrounds.sh` downloads from Unsplash (free license) with small
  thumbnails, so the panel loads quickly and the full photo is fetched only
  when chosen; plus 3 original illustrations in the repository (synthwave and
  two pixel-art scenes). The number in front of a file name
  (`03-meeting-room.jpg`) sets the order and is not shown in the label
- **Animated shapes background in the call too**, the same as the home page,
  always under everything (tiles, bars, panels), never on top

### Fixed
- **The speaking border flickered** even with continuous speech: it followed
  the audio level frame by frame and went off at every pause between words.
  It now turns on after a moment of real voice and stays on until about a
  second of silence, for you and for the others
- **Phone control bar during a presentation**: with *Present* and *Draw*
  both visible the buttons went off the screen edges (the microphone was cut
  on the left). When the buttons don't fit they now get a little smaller; no
  button is removed

## 1.5.9

### Added
- **The camera comes back by itself** after another app (FaceTime, Zoom,
  Teams…) took it or after it was unplugged and plugged back: while it is
  lost, Tiditalk retries every 3 seconds (every 10 after 2 minutes), only
  while the page is visible and always on the same camera — never another one
  in its place. A camera that opens but sends no images is not put on air.
  With a virtual background or face effect it comes back with the effect.
  *Retry* and the camera button keep working; turning the camera off on
  purpose stops the retries

### Fixed
- **Orphan video on the receiving side.** If someone's video was closed while
  another participant was still connecting to it, the "closed" notice arrived
  first and found nothing to close; the connection then completed anyway and
  stayed open: a dead stream, and sometimes a frozen or black tile. It is now
  discarded as soon as it is ready. Likely with a camera going off and on, and
  with screen sharing started and stopped quickly

## 1.5.8

### Fixed
- **Someone saw themselves twice after a dropped connection.** When the same
  browser tab came back, the server sent the list of participants before the
  old connection had been removed (its removal waits for the connection
  statistics); the browser then built the tiles a moment later, after the
  "left" notice had already passed, and the old self stayed as a ghost tile
  with a muted microphone. The list no longer contains the replaced
  connection, participants who leave while someone is joining are not
  recreated, and a participant announced twice gets a single tile
- **The camera did not come back after another app took it (FaceTime, Zoom,
  Teams…).** The browser ends the camera and the button turns off; turning it
  back on retried the dead camera, failed, and *Retry* failed every time until
  the page was reloaded (for a host, reloading also sends guests to the waiting
  room). Turning the camera on from the bar, or *Retry*, now reopens the webcam
  without leaving the meeting. If the other app still holds it, a message
  says so
- With a **virtual background or face effect** active, a camera taken by
  another app was not noticed (the others saw a frozen image). It is now
  detected like any other camera loss, and when the camera is turned back on
  the effect is rebuilt on it: the video without the effect is never sent
- **"The camera is not sending images"** notice when the browser keeps the
  camera but receives nothing (another app, lens cover, hardware switch): it
  disappears by itself when the camera resumes, and says to turn the camera
  off and on from the bar if it doesn't

## 1.5.7

### Added
- **Settings → Rooms: echo cancellation and noise reduction by default.** Two
  new switches in *Room rules*: **Echo cancellation** (the browser's, on by
  default as before) and **Advanced noise reduction (RNNoise)** (off by
  default as before). They apply to every participant of the meetings
- **Echo cancellation switch in the microphone popup** (and in Call settings
  → Audio & video), next to automatic volume and RNNoise: the microphone
  reopens with the new setting without leaving the meeting

### Changed
- Echo cancellation and RNNoise changed from the microphone popup apply **to
  that meeting only** (they survive a reload or a rejoin, the next meeting
  starts again from the default in Settings). RNNoise used to stay saved in the
  browser for every meeting
- The home device check uses the default echo cancellation from Settings

### Fixed
- The device popup could go off the top of the screen on short phones (and
  short desktop windows): it now fits the available space and scrolls

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
