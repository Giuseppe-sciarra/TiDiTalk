# Tiditalk

**Self-hosted video meetings for teams and clients** — WebRTC with a mediasoup SFU,
running on your own server with Docker. No accounts for guests, no third-party
cloud, your branding.

🇮🇹 [Leggi in italiano](README.it.md)

---

## Features

**Meetings**
- Rooms with a server-side **waiting room**: guests wait until a host joins,
  and go back to waiting if the last host leaves
- **Scheduled meetings** with email invitations and `.ics` calendar event
- Guest links that expire, no sign-up needed — works in the browser on desktop
  and mobile
- Grid and speaker views, automatic layout for portrait (phone) cameras

**Presenting**
- Screen sharing with **live annotations** on top of the shared screen: pen,
  highlighter, arrow, rectangle, circle and **laser pointer** with the
  presenter's name
- Presenters can open drawing to everyone, or keep it to themselves and hosts
- Local **recording** that includes annotations and laser pointer

**In the room**
- Chat, reactions, raise hand, participant list
- Virtual backgrounds (blur or image) and face effects, powered by MediaPipe
- Per-tile connection quality with detailed stats, data saver mode
- Keyboard shortcuts and tooltips on every control
- Light and dark theme, UI in **Italian, English, French and German**

**Administration**
- Branding panel: name, tagline, logo, favicon, accent color, default theme,
  footer, company info
- Users with **admin** and **host** roles — from the panel or from `.env`
- Room rules: guest screen sharing, drawing permissions, first-join guide
- External REST API to create meetings and guest links from a CRM
- **Automatic updates** every morning with email report and automatic rollback

---

## Requirements

- A Linux server with **Docker** and **Docker Compose**
- A **public IP** and a domain name
- A reverse proxy with HTTPS and WebSocket support (Nginx Proxy Manager,
  Traefik, Caddy, plain Nginx…)
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
nano .env        # at least: SERVER_SECRET, BASE_URL, ANNOUNCED_IP, TURN_*, USERS

# 2. Third-party assets (MediaPipe for backgrounds/effects, emoji images)
bash setup-mediapipe.sh
bash setup-effects.sh

# 3. Start
docker compose up -d --build
docker compose logs -f app
```

Generate `SERVER_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# or: openssl rand -hex 32
```

`ANNOUNCED_IP` must be the **numeric public IP** of the server: mediasoup does
not resolve hostnames.

Then open your `BASE_URL`, sign in with a user from `USERS` and finish the setup
from **Settings**.

---

## Users and roles

| Role | Can |
|------|-----|
| **admin** | everything, including Settings and user management |
| **host** | create, schedule and run meetings |
| guest | join through an invitation link, no account |

Users can be created in two ways:

**From `.env`** — created at startup if missing:

```dotenv
USERS=alice:StrongPassword1:Alice Smith:admin,bob:StrongPassword2:Bob:host
USERS_MODE=create   # or "sync": .env becomes the source of truth
```

Passwords can also be bcrypt hashes (`$2b$...`, write `$` as `$$` inside a
compose env file). With `USERS_MODE=sync` those users are read-only in the panel.

**From the panel** — Settings → Users.

---

## What goes where

| What | Where |
|------|-------|
| Name, logo, favicon, accent color, theme, footer, company info | Settings → Branding |
| Guest screen sharing, drawing for everyone, first-join guide | Settings → Rooms |
| Users and passwords | Settings → Users, or `USERS` in `.env` |
| SMTP, TURN, IPs, ports, secrets, API keys | `.env` |

---

## Updates

### Automatic (recommended)

```bash
bash install-cron.sh          # every day at 08:00
bash install-cron.sh 6        # ...or at another hour
bash auto-update.sh --dry-run # show what would change, touch nothing
```

Every morning `auto-update.sh`:

1. postpones if a meeting is in progress (3 × 15 minutes, then proceeds);
2. upgrades **every** dependency to its latest version, majors included;
3. rebuilds the image and restarts the service;
4. if the service does not answer within 3 minutes, restores the previous
   `package.json`, lock file and image — **automatic rollback**;
5. emails `UPDATE_NOTIFY_EMAIL` a table of what changed, tagged
   **major / minor / patch**, with ready-to-paste commands to roll back.

Backups are kept in `backups/` (last 10), images tagged
`tdt-meet:rollback-YYYYMMDD-HHMM`. Log: `logs/auto-update.log`.

### Manual

```bash
bash auto-update.sh                # same as the cron job, now
docker compose up -d --build app   # after changing anything in server/
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
`C` chat · `U` people — while drawing: `P` pen, `E` highlighter, `A` arrow,
`R` rectangle, `O` circle, `L` laser, `Ctrl+Z` undo, `Esc` exit.

---

## Troubleshooting

- **Video/audio does not connect for some users** — check that the RTC port
  range is forwarded as **UDP and TCP** and that `ANNOUNCED_IP` is the public IP.
  Behind strict firewalls TURN is what saves the day: check `TURN_*`.
- **Camera or microphone blocked** — the page must be served over HTTPS.
- **Invitations not delivered** — Settings → System shows the SMTP status and
  has a test button.
- **Connection diagnostics** — hosts can type `tdConnLog()` in the browser
  console to see disconnections with reason and duration.

---

## License

Tiditalk is free software released under the
**GNU Affero General Public License v3.0 or later** — see [LICENSE](LICENSE).

In short: you can use, modify and redistribute it, including commercially. If
you run a **modified** version as a network service, you must offer its source
code to your users. The "About" window in every room links to the source; set
`SOURCE_URL` in `.env` to point to your fork.

Third-party components and their licenses are listed in
[THIRD-PARTY.md](THIRD-PARTY.md).

Copyright © Giuseppe Sciarra — [Tastiere Digitali](https://tastieredigitali.it)

---

## Support the project

If Tiditalk is useful to you, you can support its development with a donation:

**[paypal.me/raxiel87](https://paypal.me/raxiel87)**

Bug reports and pull requests are welcome.
