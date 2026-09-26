# Round 11 — audit bug + fix (prima del restyle)

## Sicurezza
1. **XSS stored nei nomi** (room.js `createTile`, tile schermo, popover rete, lista partecipanti):
   il displayName di qualsiasi guest finiva crudo in innerHTML → JS eseguito nel browser
   dell'host con accesso al token. Ora escapato ovunque.
2. **Rate limit login aggirabile** (index.js `getClientIp`, connlog.js `clientIp`):
   si usava il primo valore di X-Forwarded-For (scritto dal client). Ora `trust proxy`
   + `req.ip`. Env opzionale `TRUST_PROXY`. Testato: 401,401,401,429,429.
3. **Guest in lobby riceveva chat/reazioni/lavagna** della riunione (socket.join in lobby).
4. **Guest rimesso in lobby poteva ancora chattare/creare transport** (currentPeer stale).
   Nuovo guard `_inRoom()` su tutti gli handler.
5. **wbDraw** salvava l'oggetto client così com'era → ora whitelist campi/tipi.
6. **Invitati meeting** non validati → ora email valide, max 50, durata clampata, date validate (anche PUT).

## Bug funzionali
7. `consumerProducerState` broadcast a tutta la stanza per ogni consumer (fan-out N²) → ora al solo socket interessato.
8. Screen share: effetti/sfondo persi se si annullava il selettore del browser; stream non fermato in caso di errore;
   transport dedicato mai chiuso (leak porte); 3 percorsi di stop divergenti (il pulsante ripristinava la camera RAW
   ignorando sfondo/effetto). Ora `stopScreenShare()` unico + evento `closeTransport` + `contentHint='detail'`.
9. `<audio>` remoto duplicato quando un peer ri-produce il microfono; non rimosso su producerClosed audio.
10. Lavagna: storico mai caricato al join; segmenti live + stroke finale entrambi nello storico (undo rotto);
    coordinate in pixel → tratti spostati su schermi diversi. Ora normalizzate 0..1.
11. Nome di default 'Anonimo' impediva di usare il displayName dell'account.

## Test (server reale, socket.io-client)
lobby senza leak chat ✅ · ammissione ✅ · storico lavagna pulito ✅ · guest evicted bloccato ✅ · rate limit con XFF spoofato ✅

## Deploy
    docker compose up -d --build td-meet

---

# Round 12 — restyle, disegno condiviso, impostazioni, utenti

## Nuovo
- **Tema Tiditalk** su tutte le pagine, chiaro e scuro con interruttore (il default si
  sceglie in Impostazioni → Brand, la preferenza resta nel browser di ognuno).
- **Disegno sullo schermo condiviso** (`annotate.js`): penna, evidenziatore,
  freccia, riquadro, cerchio e **puntatore laser** con alone e nome. Coordinate
  normalizzate sul contenuto reale del video: il tratto resta allineato su ogni
  schermo. La lavagna usa lo stesso motore.
- **Permessi disegno** verificati dal server: chi presenta e gli organizzatori;
  gli ospiti solo se il disegno viene aperto a tutti (interruttore nella barra).
- **Chi presenta si vede**: etichetta "X presenta", cornice accesa, bagliore
  quando qualcuno disegna, modalità a tutta pagina (doppio click o pulsante).
- **Tooltip su ogni comando** con scorciatoia, pressione lunga su telefono,
  mini-guida in 4 passi al primo ingresso (ripetibile dal "?").
- **Impostazioni in un punto solo**: Brand, Riunioni, Utenti, Sistema.
- **Utenti**: niente più hash nel codice. Si creano da `.env` (`USERS`,
  `USERS_MODE=create|sync`) o dal pannello, con ruoli admin/host.

## Corretto
- L'utente eliminato restava dentro fino alla scadenza del token (8 ore).
- Titolo e note delle riunioni finivano nell'HTML delle email senza escape.
- File ICS non conforme (escape e righe lunghe) — ora RFC 5545.
- Gli upload accettavano qualsiasi file rinominato: ora si controllano i byte.
- Confronto della API key esterna non a tempo costante.
- Pagina Pianifica: l'ora proposta era in UTC, gli invitati non erano validati.
- Rimosso ogni riferimento fisso a dominio, IP ed email nel codice e nel compose.
