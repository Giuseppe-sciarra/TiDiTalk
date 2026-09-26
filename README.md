# Tiditalk — videoriunioni self-hosted

Piattaforma di videoconferenza WebRTC (mediasoup SFU) pensata per essere
installata su un proprio server e rivenduta con il proprio marchio: nome,
logo, colori, footer e regole delle stanze si cambiano dal pannello
Impostazioni, senza toccare il codice.

- Stanze con lobby: gli ospiti entrano solo quando c'è un organizzatore
- Inviti via email con evento per il calendario
- Condivisione schermo con **disegno in diretta** sopra a ciò che si presenta:
  penna, evidenziatore, frecce, riquadri e puntatore laser visibili a tutti
- Registrazione locale, sfondi virtuali, effetti viso, chat, reazioni
- Tema chiaro e scuro, interfaccia italiana, tooltip e mini-guida per gli ospiti

## Installazione

```bash
cp .env.template .env
nano .env        # SERVER_SECRET, BASE_URL, ANNOUNCED_IP, TURN_*, USERS
docker compose up -d --build
docker compose logs -f app
```

Al primo avvio gli utenti indicati in `USERS` vengono creati nel database.
Poi si accede da `BASE_URL` e si completa tutto da **Impostazioni**.

## Utenti e ruoli

| Dove            | Come                                                                 |
|-----------------|----------------------------------------------------------------------|
| `.env`          | `USERS=utente:password:Nome:ruolo,...` — `USERS_MODE=create` o `sync` |
| Pannello        | Impostazioni → Utenti (creazione, password, ruolo, eliminazione)      |

- **admin**: impostazioni, utenti, branding
- **host**: crea e conduce riunioni

Con `USERS_MODE=sync` il file `.env` comanda a ogni riavvio e quegli utenti
non sono modificabili dal pannello.

## Cosa sta dove

| Cosa                                          | Dove si cambia          |
|-----------------------------------------------|-------------------------|
| Nome, logo, favicon, colore, tema, footer, azienda | Impostazioni → Brand |
| Ospiti che presentano, disegno aperto a tutti, mini-guida | Impostazioni → Riunioni |
| SMTP, TURN, IP, porte, chiavi, utenti iniziali | `.env`                  |

## Firewall

- TCP `PORT` (default 3010) dietro reverse proxy con WebSocket abilitato
- UDP + TCP `RTC_MIN_PORT`–`RTC_MAX_PORT` inoltrati direttamente alla macchina
- UDP 3478 e `TURN_MIN_PORT`–`TURN_MAX_PORT` per coturn

## Aggiornamenti

### Automatici (consigliato)

```bash
bash install-cron.sh          # ogni giorno alle 08:00
bash install-cron.sh 6        # ...o all'ora che preferisci
bash auto-update.sh --dry-run # prova a vuoto: dice solo cosa farebbe
```

Ogni mattina `auto-update.sh`:

1. controlla se c'è una riunione in corso e in caso rimanda (fino a 3 volte,
   15 minuti l'una — si cambia in `.env`);
2. porta **tutte** le dipendenze all'ultima versione, major comprese;
3. ricostruisce l'immagine e riavvia il servizio;
4. se il servizio non risponde entro 3 minuti ripristina `package.json` e
   l'immagine precedente (rollback automatico);
5. manda una email a `UPDATE_NOTIFY_EMAIL` con la tabella di cosa è cambiato e
   l'etichetta **major / minor / patch** per ogni pacchetto.

Log: `logs/auto-update.log`. Togliere il cron: `bash install-cron.sh --remove`.

### A mano

```bash
bash auto-update.sh                # stesso aggiornamento del cron, subito
docker compose up -d --build app   # dopo modifiche a server/
docker compose restart app         # dopo modifiche a CSS/JS/HTML (montati live)
```

## Scorciatoie in riunione

`M` microfono · `V` videocamera · `S` presenta · `D` disegna · `H` mano ·
`C` chat · `U` persone · in modalità disegno `P` penna, `E` evidenziatore,
`A` freccia, `R` riquadro, `O` cerchio, `L` laser, `Ctrl+Z` annulla, `Esc` esci.
