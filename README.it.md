# Tiditalk

**Videoriunioni self-hosted per team e clienti** — WebRTC con SFU mediasoup, sul
tuo server con Docker. Nessun account per gli ospiti, nessun cloud di terzi, il
tuo marchio.

🇬🇧 [Read in English](README.md)

---

## Funzionalità

**Riunioni**
- Stanze con **sala d'attesa** lato server: gli ospiti aspettano che entri un
  organizzatore, e tornano in attesa se l'ultimo organizzatore esce
- **Riunioni pianificate** con inviti via email ed evento `.ics` per il calendario
- Link ospite con scadenza, senza registrazione — funziona nel browser, da
  computer e da telefono
- Vista griglia e relatore, impaginazione automatica per le camere verticali

**Presentare**
- Condivisione schermo con **disegno in diretta** sopra lo schermo condiviso:
  penna, evidenziatore, freccia, riquadro, cerchio e **puntatore laser** col
  nome di chi indica
- Chi presenta può aprire il disegno a tutti o tenerlo per sé e gli organizzatori
- **Registrazione** locale che include disegni e puntatore laser

**Nella stanza**
- Chat, reazioni, alzata di mano, elenco partecipanti
- Sfondi virtuali (sfocatura o immagine) ed effetti viso, con MediaPipe
- Qualità della connessione per ogni riquadro con statistiche, risparmio dati
- Scorciatoie da tastiera e tooltip su ogni comando
- Tema chiaro e scuro, interfaccia in **italiano, inglese, francese e tedesco**

**Amministrazione**
- Pannello brand: nome, sottotitolo, logo, favicon, colore accento, tema,
  footer, dati azienda
- Utenti con ruolo **amministratore** e **organizzatore** — dal pannello o da `.env`
- Regole delle stanze: condivisione schermo degli ospiti, permessi di disegno,
  guida al primo ingresso
- API REST esterna per creare riunioni e link ospite da un CRM
- **Aggiornamenti automatici** ogni mattina con email di riepilogo e rollback
  automatico

---

## Requisiti

- Un server Linux con **Docker** e **Docker Compose**
- Un **IP pubblico** e un dominio
- Un reverse proxy con HTTPS e WebSocket (Nginx Proxy Manager, Traefik, Caddy,
  Nginx…)
- Queste porte raggiungibili da internet:

| Porta | Protocollo | Cosa |
|-------|------------|------|
| `PORT` (default 3010) | TCP | Web app — dietro il reverse proxy |
| `RTC_MIN_PORT`–`RTC_MAX_PORT` (default 40000–40400) | UDP + TCP | Media (mediasoup) — **dirette**, non dal proxy |
| 3478 | UDP + TCP | STUN/TURN (coturn) |
| `TURN_MIN_PORT`–`TURN_MAX_PORT` (default 49152–49200) | UDP | Relay TURN |

---

## Installazione

```bash
git clone https://github.com/Giuseppe-TD/tiditalk.git
cd tiditalk

# 1. Configurazione
cp .env.template .env
nano .env        # almeno: SERVER_SECRET, BASE_URL, ANNOUNCED_IP, TURN_*, USERS

# 2. Asset di terze parti (MediaPipe per sfondi/effetti, immagini emoji)
bash setup-mediapipe.sh
bash setup-effects.sh

# 3. Avvio
docker compose up -d --build
docker compose logs -f app
```

`SERVER_SECRET` si genera con:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# oppure: openssl rand -hex 32
```

`ANNOUNCED_IP` deve essere l'**IP pubblico numerico** del server: mediasoup non
risolve i nomi a dominio. Per un'installazione in italiano metti
`DEFAULT_UI_LANGUAGE=it`.

Poi apri `BASE_URL`, entra con un utente di `USERS` e completa la configurazione
da **Impostazioni**.

---

## Utenti e ruoli

| Ruolo | Può |
|-------|-----|
| **admin** | tutto, comprese Impostazioni e gestione utenti |
| **host** | creare, pianificare e condurre riunioni |
| ospite | entrare da un link d'invito, senza account |

Due modi per creare gli utenti:

**Da `.env`** — creati all'avvio se mancano:

```dotenv
USERS=mario:PasswordRobusta1:Mario Rossi:admin,anna:PasswordRobusta2:Anna:host
USERS_MODE=create   # oppure "sync": .env diventa la fonte di verità
```

Le password possono essere anche hash bcrypt (`$2b$...`; dentro un env file di
compose il `$` si scrive `$$`). Con `USERS_MODE=sync` quegli utenti sono in sola
lettura nel pannello.

**Dal pannello** — Impostazioni → Utenti.

---

## Cosa sta dove

| Cosa | Dove |
|------|------|
| Nome, logo, favicon, colore, tema, footer, dati azienda | Impostazioni → Brand |
| Condivisione schermo ospiti, disegno per tutti, guida iniziale | Impostazioni → Riunioni |
| Utenti e password | Impostazioni → Utenti, oppure `USERS` in `.env` |
| SMTP, TURN, IP, porte, chiavi, API key | `.env` |

---

## Aggiornamenti

### Automatici (consigliato)

```bash
bash install-cron.sh          # ogni giorno alle 08:00
bash install-cron.sh 6        # ...o a un'altra ora
bash auto-update.sh --dry-run # mostra cosa cambierebbe, senza toccare niente
```

Ogni mattina `auto-update.sh`:

1. se c'è una riunione in corso rimanda (3 volte da 15 minuti, poi procede);
2. porta **tutte** le dipendenze all'ultima versione, major comprese;
3. ricostruisce l'immagine e riavvia il servizio;
4. se entro 3 minuti il servizio non risponde, ripristina `package.json`, lock
   file e immagine precedenti — **rollback automatico**;
5. manda a `UPDATE_NOTIFY_EMAIL` una tabella di cosa è cambiato, con etichetta
   **major / minor / patch** e i comandi pronti per tornare indietro.

I backup restano in `backups/` (ultimi 10), le immagini taggate
`tdt-meet:rollback-AAAAMMGG-HHMM`. Log: `logs/auto-update.log`.

### A mano

```bash
bash auto-update.sh                # come il cron, subito
docker compose up -d --build app   # dopo modifiche a server/
docker compose restart app         # dopo modifiche a CSS/JS/HTML (montati live)
```

---

## API esterna

Attiva se `EXTERNAL_API_KEY` è impostata. La chiave va nell'header `x-api-key`.

| Metodo | Endpoint | A cosa serve |
|--------|----------|--------------|
| `GET` | `/api/external/health` | stato |
| `POST` | `/api/external/generate-guest-token` | link ospite per una stanza |
| `POST` | `/api/external/schedule-meeting` | crea una riunione e manda gli inviti |
| `DELETE` | `/api/external/meeting/:id` | elimina una riunione |

`GET /api/health` (senza chiave) restituisce `{ ok, uptime, rooms, peers, version }`
ed è usato dall'aggiornamento automatico per non riavviare durante una chiamata.

---

## Scorciatoie da tastiera

`M` microfono · `V` videocamera · `S` presenta · `D` disegna · `H` alza la mano ·
`C` chat · `U` persone — mentre disegni: `P` penna, `E` evidenziatore,
`A` freccia, `R` riquadro, `O` cerchio, `L` laser, `Ctrl+Z` annulla, `Esc` esci.

---

## Problemi frequenti

- **Audio/video non si collega per alcuni** — controlla che l'intervallo delle
  porte RTC sia inoltrato in **UDP e TCP** e che `ANNOUNCED_IP` sia l'IP pubblico.
  Dietro firewall rigidi è il TURN che salva la situazione: controlla `TURN_*`.
- **Camera o microfono bloccati** — la pagina deve essere servita in HTTPS.
- **Gli inviti non arrivano** — Impostazioni → Sistema mostra lo stato SMTP e ha
  il pulsante per l'email di prova.
- **Diagnostica connessione** — gli organizzatori possono scrivere `tdConnLog()`
  nella console del browser per vedere le cadute con motivo e durata.

---

## Licenza

Tiditalk è software libero rilasciato sotto
**GNU Affero General Public License v3.0 o successiva** — vedi [LICENSE](LICENSE).

In breve: puoi usarlo, modificarlo e ridistribuirlo, anche commercialmente. Se
offri una versione **modificata** come servizio in rete, devi rendere disponibile
il suo codice sorgente a chi la usa. La finestra "Informazioni" di ogni stanza
porta al sorgente: imposta `SOURCE_URL` in `.env` perché punti al tuo fork.

Le componenti di terze parti e le loro licenze sono in
[THIRD-PARTY.md](THIRD-PARTY.md).

Copyright © Giuseppe Sciarra — [Tastiere Digitali](https://tastieredigitali.it)

---

## Sostieni il progetto

Se Tiditalk ti è utile, puoi sostenerne lo sviluppo con una donazione:

**[paypal.me/raxiel87](https://paypal.me/raxiel87)**

Segnalazioni di bug e pull request sono benvenute.
