// effectsCatalog.js
// Manifest degli effetti viso: mappa nome-file → metadati di posizionamento
//
// anchor: dove si attacca
//   'head'       = sopra la testa (centrato)
//   'forehead'   = sulla fronte (alto)
//   'eyes'       = sugli occhi
//   'nose'       = sul naso
//   'mouth'      = sulla bocca
//   'face'       = copre tutto il viso
//   'side'       = lato destro/sinistro del viso (orecchie)
//   'float_top'  = galleggia sopra la testa senza toccarla (es. aureola)
//   'corners'    = ripetuto negli angoli della faccia (es. cuori che spuntano)
//
// scale: moltiplicatore rispetto alla larghezza del viso (1.0 = stessa larghezza viso)
// offsetY: shift verticale in percentuale altezza viso (negativo = su, positivo = giù)
// rotate: true/false — se ruotare con la testa (roll)
// perspective: true/false — se deformare con yaw/pitch

window.EFFECTS_CATALOG = [
  // ── Nessun effetto ──
  { id: 'none', label: 'Nessuno', emoji: '🚫', file: null },

  // ── Copricapo ──────────────────────────────────────────────────
  { id: 'crown',       label: 'Corona',          file: 'crown.png',       anchor: 'head',     scale: 1.2,  offsetY: -0.25, rotate: true,  perspective: true,  category: 'hat' },
  { id: 'tophat',      label: 'Cilindro',        file: 'tophat.png',      anchor: 'head',     scale: 1.15, offsetY: -0.35, rotate: true,  perspective: true,  category: 'hat' },
  { id: 'partyhat',    label: 'Festa',           file: 'partyhat.png',    anchor: 'head',     scale: 1.3,  offsetY: -0.30, rotate: true,  perspective: false, category: 'hat' },
  { id: 'santahat',    label: 'Natale',          file: 'santahat.png',    anchor: 'head',     scale: 1.4,  offsetY: -0.35, rotate: true,  perspective: true,  category: 'hat' },
  { id: 'cowboyhat',   label: 'Cowboy',          file: 'cowboyhat.png',   anchor: 'head',     scale: 1.4,  offsetY: -0.30, rotate: true,  perspective: true,  category: 'hat' },
  { id: 'graduation',  label: 'Laurea',          file: 'graduation.png',  anchor: 'head',     scale: 1.3,  offsetY: -0.30, rotate: true,  perspective: true,  category: 'hat' },
  { id: 'helmet',      label: 'Elmetto',         file: 'helmet.png',      anchor: 'head',     scale: 1.3,  offsetY: -0.25, rotate: true,  perspective: true,  category: 'hat' },
  { id: 'halo',        label: 'Aureola',         file: 'halo.png',        anchor: 'float_top', scale: 1.0, offsetY: -0.50, rotate: false, perspective: false, category: 'hat' },

  // ── Occhiali ──────────────────────────────────────────────────
  { id: 'sunglasses',  label: 'Sole',            file: 'sunglasses.png',  anchor: 'eyes',     scale: 1.1,  offsetY: 0,    rotate: true,  perspective: true,  category: 'glasses' },
  { id: 'nerd',        label: 'Nerd',            file: 'nerd.png',        anchor: 'eyes',     scale: 1.05, offsetY: 0,    rotate: true,  perspective: true,  category: 'glasses' },
  { id: 'monocle',     label: 'Monocolo',        file: 'monocle.png',     anchor: 'eyes',     scale: 0.6,  offsetY: 0,    rotate: true,  perspective: true,  category: 'glasses' },
  { id: 'heart_eyes',  label: 'Occhi cuore',     file: 'heart_eyes.png',  anchor: 'face',     scale: 1.1,  offsetY: 0,    rotate: true,  perspective: true,  category: 'glasses' },

  // ── Sul viso ──────────────────────────────────────────────────
  { id: 'clown',       label: 'Naso clown',      file: 'clown.png',       anchor: 'face',     scale: 1.1,  offsetY: 0,    rotate: true,  perspective: true,  category: 'face' },
  { id: 'mask_theater',label: 'Maschera',        file: 'mask_theater.png',anchor: 'face',     scale: 1.0,  offsetY: 0,    rotate: true,  perspective: true,  category: 'face' },
  { id: 'mask_medical',label: 'Mascherina',      file: 'mask_medical.png',anchor: 'face',     scale: 1.05, offsetY: 0.1,  rotate: true,  perspective: true,  category: 'face' },
  { id: 'kiss_lips',   label: 'Bacio',           file: 'kiss_lips.png',   anchor: 'mouth',    scale: 0.35, offsetY: 0,    rotate: true,  perspective: false, category: 'face' },

  // ── Animali in testa ─────────────────────────────────────────
  { id: 'cat_face',    label: 'Gatto',           file: 'cat_face.png',    anchor: 'head',     scale: 1.25, offsetY: -0.20, rotate: true,  perspective: true,  category: 'animal' },
  { id: 'dog_face',    label: 'Cane',            file: 'dog_face.png',    anchor: 'head',     scale: 1.25, offsetY: -0.20, rotate: true,  perspective: true,  category: 'animal' },
  { id: 'rabbit',      label: 'Coniglio',        file: 'rabbit.png',      anchor: 'head',     scale: 1.25, offsetY: -0.20, rotate: true,  perspective: true,  category: 'animal' },
  { id: 'bear',        label: 'Orso',            file: 'bear.png',        anchor: 'head',     scale: 1.25, offsetY: -0.20, rotate: true,  perspective: true,  category: 'animal' },
  { id: 'panda',       label: 'Panda',           file: 'panda.png',       anchor: 'head',     scale: 1.25, offsetY: -0.20, rotate: true,  perspective: true,  category: 'animal' },
  { id: 'fox',         label: 'Volpe',           file: 'fox.png',         anchor: 'head',     scale: 1.25, offsetY: -0.20, rotate: true,  perspective: true,  category: 'animal' },
  { id: 'mouse',       label: 'Topo',            file: 'mouse.png',       anchor: 'head',     scale: 1.25, offsetY: -0.20, rotate: true,  perspective: true,  category: 'animal' },
  { id: 'unicorn',     label: 'Unicorno',        file: 'unicorn.png',     anchor: 'head',     scale: 1.3,  offsetY: -0.25, rotate: true,  perspective: true,  category: 'animal' },
  { id: 'pig_nose',    label: 'Muso maiale',     file: 'pig_nose.png',    anchor: 'nose',     scale: 0.45, offsetY: 0,    rotate: true,  perspective: false, category: 'animal' },

  // ── Decorazioni fluttuanti ──────────────────────────────────
  { id: 'fire',        label: 'Fuoco',           file: 'fire.png',        anchor: 'float_top', scale: 0.7, offsetY: -0.45, rotate: false, perspective: false, category: 'deco' },
  { id: 'star',        label: 'Stella',          file: 'star.png',        anchor: 'float_top', scale: 0.6, offsetY: -0.45, rotate: false, perspective: false, category: 'deco' },
  { id: 'heart',       label: 'Cuore',           file: 'heart.png',       anchor: 'float_top', scale: 0.6, offsetY: -0.45, rotate: false, perspective: false, category: 'deco' },
  { id: 'rainbow',     label: 'Arcobaleno',      file: 'rainbow.png',     anchor: 'float_top', scale: 1.2, offsetY: -0.45, rotate: false, perspective: false, category: 'deco' },
  { id: 'flower',      label: 'Fiore',           file: 'flower.png',      anchor: 'forehead', scale: 0.35, offsetY: -0.05, rotate: true,  perspective: false, category: 'deco' },
  { id: 'rose',        label: 'Rosa',            file: 'rose.png',        anchor: 'forehead', scale: 0.35, offsetY: -0.05, rotate: true,  perspective: false, category: 'deco' },

  // ── Speciali ───────────────────────────────────────────────
  { id: 'devil_horns', label: 'Diavolo',         file: 'devil_horns.png', anchor: 'head',     scale: 1.2,  offsetY: -0.25, rotate: true,  perspective: true,  category: 'special' },
  { id: 'alien',       label: 'Alieno',          file: 'alien.png',       anchor: 'head',     scale: 1.25, offsetY: -0.15, rotate: true,  perspective: true,  category: 'special' },
  { id: 'ghost',       label: 'Fantasma',        file: 'ghost.png',       anchor: 'float_top', scale: 0.9, offsetY: -0.50, rotate: false, perspective: false, category: 'special' },
  { id: 'skull',       label: 'Teschio',         file: 'skull.png',       anchor: 'face',     scale: 1.1,  offsetY: 0,    rotate: true,  perspective: true,  category: 'special' },
  { id: 'robot',       label: 'Robot',           file: 'robot.png',       anchor: 'face',     scale: 1.1,  offsetY: 0,    rotate: true,  perspective: true,  category: 'special' },
];
