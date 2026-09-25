# Sfondi virtuali preset

Metti qui le immagini di sfondo disponibili a tutti gli utenti.

## Formati supportati
- JPG, PNG, WebP, SVG

## Dimensioni consigliate
- 1920x1080 (16:9), min 1280x720
- JPG a qualità 80-85 è ottimo per peso/qualità
- Max ~2MB per file (altrimenti rallenta il caricamento)

## Convenzioni nome file
- Il nome del file (senza estensione) diventa l'etichetta visibile nell'app
- Usa trattini `-` o underscore `_` per gli spazi
- Esempio: `ufficio-moderno.jpg` → "Ufficio moderno"

## File inclusi di default
Ho incluso 6 SVG leggeri come placeholder. Sostituiscili con foto reali quando vuoi.

## Come aggiungere sfondi
1. Copia il file in questa cartella
2. Nessun restart necessario, l'API `/api/backgrounds` legge la cartella ad ogni richiesta
