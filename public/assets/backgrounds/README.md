# Sfondi virtuali preset

Metti qui le immagini di sfondo disponibili a tutti gli utenti.

## Foto incluse
`setup-backgrounds.sh` (nella cartella principale) scarica 56 foto da
[Unsplash](https://unsplash.com/license) — uso libero, anche commerciale — con
le miniature in `thumbs/`. Non sono nel repository: lancia lo script una volta
(`--force` per riscaricarle). Nel repository restano i 6 SVG e 3 illustrazioni
originali (synthwave e pixel art, disegnate per Tiditalk).

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
- Un numero davanti decide l'ordine e non si vede: `03-sala-riunioni.jpg` →
  "Sala riunioni", dopo `02-…`
- Miniatura facoltativa: `thumbs/<stesso-nome>.jpg` (es. 384x216). Se c'è, il
  pannello mostra quella e scarica la foto intera solo quando la scegli

## Come aggiungere sfondi
1. Copia il file in questa cartella
2. Nessun restart necessario, l'API `/api/backgrounds` legge la cartella ad ogni richiesta
