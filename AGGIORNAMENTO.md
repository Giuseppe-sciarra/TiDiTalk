# Pacchetto completo della tua installazione

Contiene TUTTO il lavoro fatto finora. Sostituisci la cartella `~/videochat`
tenendo solo:
- `.env`   (il tuo)
- `data/`  (database: utenti, riunioni, impostazioni)
- `public/assets/uploads/` (logo e favicon caricati dal pannello)

## Perché ti è arrivata l'email "aggiornamenti disponibili" senza che si aggiornasse
Quella email la manda il VECCHIO controllo (`server/update-check.js`), che si
limita a segnalare. L'aggiornamento automatico vero è `auto-update.sh`, che
gira dal cron sull'host: se ti arriva ancora quella email vuol dire che
- nel container gira ancora il vecchio `update-check.js`, oppure
- nel `.env` c'è `UPDATE_CHECK=1`, e/o
- il cron dell'aggiornamento automatico non è installato.

## Passi (in quest'ordine)
    cd ~/videochat

    # 1. nel .env: spegni la vecchia segnalazione e controlla il destinatario
    #    UPDATE_CHECK=0
    #    UPDATE_NOTIFY_EMAIL=info@tastieredigitali.it
    nano .env

    # 2. rebuild (porta dentro update-report.js, /api/health, stanza, traduzioni)
    docker compose up -d --build app

    # 3. cron alle 8 (se c'era già viene sostituito, non duplicato)
    bash install-cron.sh
    crontab -l | grep tiditalk          # deve comparire la riga

    # 4. prova SUBITO, senza aspettare domattina
    bash auto-update.sh

Il punto 4 aggiorna adesso i pacchetti che l'email ti segnalava, ricostruisce,
verifica che il servizio risponda e ti manda l'email "aggiornato" con la
tabella prima/dopo e l'etichetta MAJOR / MINOR / PATCH, più i comandi per
tornare indietro. Se non c'è niente da aggiornare non manda email (per
riceverla comunque: `UPDATE_MAIL_ALWAYS=1` nel .env).

Log dell'aggiornamento automatico: `tail -f ~/videochat/logs/auto-update.log`
