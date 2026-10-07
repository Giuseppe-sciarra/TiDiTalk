# Tiditalk

**Self-hosted video meetings for teams and clients** — WebRTC with a mediasoup
SFU, on your own server, with Docker. No accounts for guests, no third-party
cloud, your branding.

🇮🇹 [Leggi in italiano](README.it.md)

---

## Features

**Meetings**
- Rooms with a server-side **waiting room**: guests wait until a host joins,
  and go back to waiting if the last host leaves
- **Scheduled meetings** with email invitations and `.ics` calendar event
- Guest links that expire, no sign-up — works in the browser on desktop and phone
- Grid view that **sizes every tile to the available space** (all participants
  visible, same size, 16:9, last row centered) and speaker view
- Portrait (phone) cameras shown in full instead of cropped

**Presenting**
- Screen sharing with **live annotations** on top of the shared screen: pen,
  highlighter, arrow, rectangle, circle and **laser pointer** with the
  presenter's name
- The presenter decides whether everyone can draw or only presenter and hosts
- Local **recording** that includes annotations and laser pointer

**In the room**
- Chat, reactions, raise hand, participant list
- **Floating window** with the whole meeting (Chrome/Edge): all participants,
  speaker highlight, mic/camera/hand/leave. Opens by itself when you switch tab
- Virtual backgrounds (blur or image), color styles and face effects (MediaPipe)
- Microphone popup with **live mic and speaker levels** and a switch for
  automatic gain control
- **Microphone watchdog**: a mic silenced by the OS or another app, or dead
  after a device change, is reopened without interrupting the call
- Per-tile connection quality with detailed stats, data saver mode
- Tooltips and keyboard shortcuts on every control, optional first-join guide
- Light and dark theme, UI in **Italian, English, French and German**

**Administration**
- Branding panel: name, tagline, logo, favicon, accent color (automatically
  adjusted for contrast in both themes), default theme, footer, company info
- Users with **admin** and **host** roles — from the panel or from `.env`
- Room rules: guest screen sharing, drawing permissions, first-join guide
- External REST API to create meetings and guest links from a CRM
- **Automatic daily updates** with email report, automatic rollback and
  ready-to-paste rollback commands

---

## Requirements

- A Linux server with **Docker** and the **Docker Compose** plugin
- A **public IP** and a domain name
- A reverse proxy with HTTPS and WebSocket support (Nginx Proxy Manager,
  Traefik, Caddy, plain Nginx…)
- `systemd` for scheduled updates (present on Debian/Ubuntu, LXC containers
  included); `cron` is used as a fallback
- These ports reachable from the internet:

| Port | Protocol | What |
|------|----------|------|
| `PORT` (default 3010) | TCP | Web app — behind your reverse proxy |
| `RTC_MIN_PORT`–`RTC_MAX_PORT` (default 40000–40400) | UDP + TCP | Media (mediasoup) — **directly**, not through the proxy |
| 3478 | UDP + TCP | STUN/TURN (coturn) |
| `TURN_MIN_PORT`–`TURN_MAX_PORT` (default 49152–49200) | UDP | TURN relay |

---

## Installation

```bash
git clone https://github.com/Giuseppe-TD/tiditalk.git
cd tiditalk

# 1. Configuration
cp .env.template .env
nano .env        # at least: SERVER_SECRET, BASE_URL, ANNOUNCED_IP, TURN_*, USERS, SMTP_*

# 2. Third-party assets (MediaPipe for backgrounds/effects, emoji images)
bash setup-mediapipe.sh
bash setup-effects.sh

# 3. Start
docker compose up -d --build
docker compose logs -f app

# 4. Daily automatic updates
bash install-cron.sh
```

Generate `SERVER_SECRET` with:

```bash
openssl rand -hex 32
```

`ANNOUNCED_IP` must be the **numeric public IP** of the server: mediasoup does
not resolve hostnames. Set `DEFAULT_UI_LANGUAGE` (`it`, `en`, `fr`, `de`) to
the language used for emails when the browser doesn't declare one.

Then open your `BASE_URL`, sign in with a user from `USERS` and finish the setup
from **Settings**.

---

## Users and roles

| Role | Can |
|------|-----|
| **admin** | everything, including Settings and user management |
| **host** | create, schedule and run meetings |
| guest | join through an invitation link, no account |

**From `.env`** — created at startup if missing:

```dotenv
USERS=alice:StrongPassword1:Alice Smith:admin,bob:StrongPassword2:Bob:host
USERS_MODE=create   # or "sync": .env becomes the source of truth
```

Passwords can also be bcrypt hashes (`$2b$...`; inside a compose env file write
`$` as `$$`). With `USERS_MODE=sync` those users are read-only in the panel.

**From the panel** — Settings → Users.

---

## What goes where

| What | Where |
|------|-------|
| Name, logo, favicon, accent color, theme, footer, company info | Settings → Branding |
| Guest screen sharing, drawing for everyone, first-join guide | Settings → Rooms |
| Users and passwords | Settings → Users, or `USERS` in `.env` |
| SMTP, TURN, IPs, ports, secrets, API keys, updates | `.env` |

---

## Updates

### Automatic (recommended)

```bash
bash install-cron.sh           # every day at 08:00 (server local time)
bash install-cron.sh 6         # ...or at another hour
bash install-cron.sh --status  # is it scheduled? next run? last result
bash install-cron.sh --remove  # stop it
```

`install-cron.sh` installs a **systemd timer** (persistent: if the server was
off at the scheduled time, the update runs as soon as it's back). Without
systemd it falls back to cron and checks that the cron service is running.
The hour is the server's local time — set the timezone first if needed:

```bash
timedatectl set-timezone Europe/Rome && bash install-cron.sh
```

Every run of `auto-update.sh`:

1. postpones if a meeting is in progress (3 × 15 minutes, then proceeds);
2. upgrades **every** dependency to its latest version, majors included, and
   also realigns versions that are older inside the image than on npm;
3. rebuilds the image and restarts the service;
4. if the service doesn't answer within 3 minutes, restores the previous
   `package.json`, lock file and image — **automatic rollback**;
5. emails `UPDATE_NOTIFY_EMAIL` a table of what changed, tagged
   **major / minor / patch**, with ready-to-paste rollback commands;
6. cleans Docker safely: keeps the last `UPDATE_KEEP_ROLLBACK` rollback images
   (default 5), removes stopped containers, untagged images and build cache
   older than 7 days. It never runs `prune -a`.

Backups: `backups/` (last 10). Log: `logs/auto-update.log`.

| Variable | Default | Meaning |
|----------|---------|---------|
| `UPDATE_NOTIFY_EMAIL` | — | where the report goes |
| `UPDATE_MAIL_ALWAYS` | `0` | `1` = email even when nothing changed |
| `UPDATE_SKIP_IF_BUSY` | `1` | postpone while people are connected |
| `UPDATE_BUSY_RETRIES` / `UPDATE_BUSY_WAIT` | `3` / `900` | how many times / every how many seconds |
| `UPDATE_KEEP_ROLLBACK` | `5` | rollback images to keep |
| `UPDATE_CHECK` | `0` | old "updates available" email, without updating |

### Manual

```bash
bash auto-update.sh --dry-run      # show what would change, touch nothing
bash auto-update.sh                # update now
docker compose up -d --build app   # after changing anything in server/ or public/assets/i18n
docker compose restart app         # after changing CSS/JS/HTML (mounted live)
```

---

## External API

Enabled when `EXTERNAL_API_KEY` is set. Send the key in the `x-api-key` header.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/external/health` | liveness |
| `POST` | `/api/external/generate-guest-token` | guest link for a room |
| `POST` | `/api/external/schedule-meeting` | create a meeting and send invitations |
| `DELETE` | `/api/external/meeting/:id` | delete a meeting |

`GET /api/health` (no key) returns `{ ok, uptime, rooms, peers, version }` and
is used by the updater to avoid restarting during a call.

---

## Keyboard shortcuts

`M` microphone · `V` camera · `S` present · `D` draw · `H` raise hand ·
`C` chat · `U` people. While drawing: `P` pen, `E` highlighter, `A` arrow,
`R` rectangle, `O` circle, `L` laser, `Ctrl+Z` undo, `Esc` exit.

---

## Troubleshooting

- **Video/audio doesn't connect for some users** — the RTC port range must be
  forwarded as **UDP and TCP** and `ANNOUNCED_IP` must be the public IP. Behind
  strict firewalls TURN is what saves the day: check `TURN_*`.
- **Camera or microphone blocked** — the page must be served over HTTPS.
- **Someone sounds too quiet** — microphone popup (arrow next to the mic): the
  level bar shows the real signal. If it barely moves, raise the input volume in
  the computer's sound settings. If the input volume keeps dropping by itself,
  turn off "Adjust microphone volume automatically".
- **Echo** — usually speakers without headphones, or two devices in the same room.
- **Invitations not delivered** — Settings → System shows the SMTP status and
  has a test button.
- **Updates not happening** — `bash install-cron.sh --status`.
- **Browser console diagnostics** (hosts):
  `tdConnLog('Name')` disconnections and microphone events of a participant,
  `tdMicInfo()` real state of your microphone,
  `tdCamInfo()` resolution of preview, sent video and camera.

---

## License

Tiditalk is free software released under the
**GNU Affero General Public License v3.0 or later** — see [LICENSE](LICENSE).

You can use, modify and redistribute it, commercially too. If you run a
**modified** version as a network service, you must offer its source code to
your users: the "About" window in every room links to the source — set
`SOURCE_URL` in `.env` to point to your fork.

Third-party components and their licenses: [THIRD-PARTY.md](THIRD-PARTY.md).

Copyright © Giuseppe Sciarra — [Tastiere Digitali](https://tastieredigitali.it)

---

## Support the project

If Tiditalk is useful to you, you can support its development:

**[paypal.me/raxiel87](https://paypal.me/raxiel87)**

Bug reports and pull requests are welcome.
