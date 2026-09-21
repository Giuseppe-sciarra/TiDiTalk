# Technical analysis and verification

## Application structure

`server/index.js` provides an Express API and Socket.IO signaling. mediasoup supplies the WebRTC SFU; coturn supplies relay support. `server/db.js` initializes SQLite persistence for accounts, meetings, settings and operational records. `public/` contains login, home, guest, scheduling, settings and meeting pages. The meeting client includes prejoin device selection, participant controls, chat, annotations, recording, background effects and reactions. Invitations use SMTP and iCalendar attachments.

Authentication/bootstrap, SQLite storage, branding, mail templates, signaling configuration and public pages were inspected to identify user-visible text, secrets and runtime data. This is a source review for localization and release preparation, not a penetration test or a load test.

## Release changes

- Added four language catalogs, a browser-aware selector, saved preference and dynamic UI translation across all six pages. Preserved participant names, input values, room identifiers and chat messages. Localized dates, speech locale, invitation text and built-in controls.
- Adjusted the selector strip and prejoin scrolling so longer translated controls remain accessible on mobile screens.
- Removed the supplied `tdmeet.db`, `tdmeet.db-wal` and `tdmeet.db-shm`, environment credentials and runtime artifacts. Fresh volumes initialize a new schema without existing accounts/meetings/settings.
- Added `.env.example` and matching `.env.template` with blank secrets and bootstrap users. Initial accounts must be configured deliberately; original signing-key validation remains.
- Reworked the Docker image to use Node 22, the committed dependency lockfile, a generated browser bundle and an unprivileged runtime user. The supplied full-release Compose file uses named data/upload volumes and the bundle from the built image.
- Replaced setup/update scripts that could refresh dependencies automatically with explicit, repeatable builds. Disabled external update checking by default and removed the former installation's operational hostnames from examples.
- Added English documentation, catalog/source checks and source-validation CI. No live GitHub repository or remote deployment was created.

## Important integration details

The documented Compose deployment targets a Linux Docker host because coturn uses host networking. A reverse proxy handles HTTPS/WSS; RTP and TURN ports must also reach the appropriate host. Working HTTPS does not itself prove that calls can pass media.

The old Compose file mounts several frontend folders from the host. Replacing it with the full-release Compose file would select new named volumes and can make an existing database appear absent. To test languages on an existing installation, use the separate language-only patch and keep its original environment, Compose file and volume mappings.

Meeting recordings are produced on the client. Browser permissions, codec support, network traversal, simulcast and effects require real-device testing. Product branding and administrator-authored meeting notes are preserved as user content; changing the UI language does not translate them.

## Verification

- Checked non-vendor JavaScript syntax, catalog key/placeholder parity and correspondence between editable JSON and the generated bundle.
- Exercised login/home with simulated API responses in headless Edge, including language persistence, dynamic messages, user-name preservation and mobile layout.
- Exercised prejoin with simulated media devices, including the camera-unavailable fallback, localized messages and desktop/mobile layout. This did not connect to Socket.IO or a real mediasoup server.
- Scanned the source against original environment credentials and verified blank examples and exclusion of SQLite files, including WAL/SHM sidecars.
- Tested the separate language patch's installation, repeat application, backup/rollback and refusal to overwrite customized files; dummy environment/database files remained unchanged.

Docker is unavailable on the preparation machine. The image, native dependencies, fresh SQLite startup, real multi-party calls, ICE/TURN traversal, recordings, effects and SMTP delivery were not tested end to end. Run the deployment/network checks in the main README on your test server.

Run `node --test tests/i18n.test.cjs` and `python tests/check_release.py` from a clean source checkout. The release check intentionally rejects local `.env` and runtime databases. GitHub Actions runs the same source checks.
