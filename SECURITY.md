# Security policy

🇮🇹 [Versione italiana più sotto](#italiano)

## Supported versions

Only the latest release receives security fixes. If you run an older
version, update first and check whether the problem is still there.

| Version | Supported |
|---------|-----------|
| 1.5.x   | ✅        |
| < 1.5   | ❌        |

## Reporting a vulnerability

**Please do not open a public issue, discussion or pull request for a
security problem.** Report it privately instead:

👉 **[Report a vulnerability](https://github.com/Giuseppe-sciarra/TiDiTalk/security/advisories/new)**
(GitHub private vulnerability reporting — only the maintainer can see it)

A useful report contains:

- the version (`server/package.json`, also shown at the bottom of every page)
- what an attacker can do and what they need first (a guest link, a host
  account, network access to the TURN server…)
- steps to reproduce, or a proof of concept
- your deployment details if relevant (reverse proxy, browser, OS)

## What happens next

1. You get an acknowledgement as soon as possible, usually within a few
   working days.
2. The problem is confirmed and fixed in a new release, listed in the
   [CHANGELOG](CHANGELOG.md) and on the Releases page (watch the repository
   for releases to be notified).
3. Once the fix is out, a security advisory is published. You are credited
   in it unless you prefer to stay anonymous.

Please give a reasonable time to ship the fix before disclosing details
publicly.

## Scope

**In scope** — the code in this repository:

- login, sessions and roles (admin / host), guest invitation links
- the waiting room and the server-side room rules (who can join, present,
  draw, be removed)
- the Socket.IO signaling and the mediasoup media handling
- file uploads, the Settings API, the end-of-call feedback endpoint
- the external API (`/api/external/*`, `X-API-Key`)
- cross-site scripting through names, chat, polls, annotations or any text a
  participant can send

**Out of scope:**

- problems in your own deployment rather than in the code: reverse proxy or
  TLS configuration, an exposed or weak `.env`, open TURN credentials,
  firewall rules
- vulnerabilities in third-party software (Node.js, mediasoup, coturn,
  browsers, MediaPipe) — report them to their projects; if Tiditalk uses them
  in an unsafe way, that is in scope
- denial of service by pure traffic volume
- reports produced only by automated scanners without a working impact

## Hardening reminders

- Always run behind HTTPS (the browser blocks camera and microphone otherwise).
- Use a long random `SERVER_SECRET` and keep `.env` out of version control.
- Set TURN credentials and restrict the TURN relay ports on the firewall.
- Keep the automatic dependency updates on (see *Updates* in the
  [README](README.md)) and install new Tiditalk releases when they come out.

---

<a id="italiano"></a>

# Sicurezza (italiano)

## Versioni supportate

Le correzioni di sicurezza arrivano solo sull'ultima versione (oggi la
1.5.x). Se usi una versione precedente, aggiorna e verifica se il problema
c'è ancora.

## Come segnalare una vulnerabilità

**Non aprire una issue, una discussione o una pull request pubblica.**
Segnala in privato da qui:

👉 **[Segnala una vulnerabilità](https://github.com/Giuseppe-sciarra/TiDiTalk/security/advisories/new)**
(segnalazione privata di GitHub: la vede solo il manutentore)

Indica la versione (in basso su ogni pagina), cosa può fare un attaccante e
cosa gli serve prima (un link ospite, un account organizzatore…), i passaggi
per riprodurre il problema e, se serve, com'è fatta la tua installazione.

## Cosa succede dopo

Ricevi una risposta appena possibile, di solito entro qualche giorno
lavorativo. Il problema viene corretto in una nuova versione, annotata nel
[CHANGELOG](CHANGELOG.md) e nella pagina Releases (con "Watch → Releases"
ricevi la notifica). Poi viene pubblicato un avviso di sicurezza con il tuo
nome, se vuoi essere citato. Prima di rendere pubblici i dettagli,
lascia il tempo di rilasciare la correzione.

## Cosa rientra e cosa no

Rientra tutto il codice di questo repository: accesso e ruoli, link ospite,
sala d'attesa e regole della stanza, segnalazione Socket.IO e media
mediasoup, caricamento file, API delle impostazioni e API esterna, e
qualunque XSS tramite nomi, chat, sondaggi, annotazioni o altri testi inviati
dai partecipanti.

Non rientrano: problemi della singola installazione (proxy, TLS, `.env`
esposto, credenziali TURN), vulnerabilità di software di terzi (da segnalare
ai rispettivi progetti, salvo che Tiditalk li usi in modo insicuro), attacchi
di puro volume e segnalazioni di scanner automatici senza un impatto reale.
