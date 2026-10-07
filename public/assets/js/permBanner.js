'use strict';

/**
 * PermBanner — guida "a prova di scimmia" per i permessi di microfono e
 * videocamera, sul modello di Google Meet.
 *
 * Tre cose, tutte a schermo intero e con parole semplici:
 *
 *  1. ASK     — mentre il browser mostra la sua richiesta ("Consenti?") compare
 *               un pannello gigante con una freccia verso la richiesta, una
 *               finta anteprima della finestra del browser con il tasto
 *               «Consenti» evidenziato e, per ogni browser, il modo di far
 *               ricordare la scelta (così non la richiede ogni volta).
 *  2. BLOCKED — se l'utente ha negato (o il sistema operativo blocca il
 *               browser) compaiono i passaggi esatti per sbloccare, con freccia
 *               verso il lucchetto della barra dell'indirizzo. Si chiude da
 *               solo appena i permessi risultano concessi.
 *  3. NOTICE  — una barra in alto (non bloccante) quando il microfono c'è ma
 *               non arriva alcun suono: silenziato dal sistema, tasto mute
 *               della cuffia, volume di ingresso a zero…
 *
 * La scelta viene ricordata dal browser stesso (HTTPS): qui ci si limita a
 * memorizzare che l'utente ha già dato il consenso almeno una volta, per non
 * mostrare il pannello ASK quando la richiesta non compare davvero e per
 * insistere sul «Ricorda la decisione» se invece il browser lo richiede ancora.
 *
 * API:
 *   const req = PermBanner.beginRequest();      // prima di getUserMedia
 *   req.done(stream)                             // ok → chiude + ricorda
 *   req.fail(err, { onRetry })                   // errore → pannello giusto
 *   PermBanner.fromError(err, { onRetry })       // sceglie il pannello dall'errore
 *   PermBanner.show({ onRetry })                 // = blocked (compatibilità)
 *   PermBanner.hide()
 *   PermBanner.notice('micMuted' | 'micSilent' | 'camMuted', on = true)
 *   PermBanner.remembered() / PermBanner.remember()
 */
(function () {

  const REMEMBER_KEY = 'tdt_perm_ok';
  const T = (s) => (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t(s) : s;

  // ─── Rilevamento browser / sistema ─────────────────────────────────────────
  function detectBrowser() {
    const ua = navigator.userAgent || '';
    const isIOS = /iPhone|iPad|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/.test(ua);

    if (/CriOS\//.test(ua))  return isIOS ? 'chrome-ios' : 'chrome';
    if (/FxiOS\//.test(ua))  return 'firefox-ios';
    if (/EdgiOS\//.test(ua)) return 'edge-ios';
    if (/SamsungBrowser\//.test(ua)) return 'samsung';
    if (/Edg\//.test(ua))    return 'edge';
    if (/OPR\//.test(ua))    return 'opera';
    if (/Firefox\//.test(ua)) return isAndroid ? 'firefox-android' : 'firefox';
    if (/Chrome\//.test(ua)) return isAndroid ? 'chrome-android' : 'chrome';
    if (/Safari\//.test(ua)) return isIOS ? 'safari-ios' : 'safari-mac';
    return 'generic';
  }

  function detectOS() {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
    if (/Android/.test(ua)) return 'android';
    if (/Windows/.test(ua)) return 'windows';
    if (/Macintosh/.test(ua)) return 'mac';
    if (/CrOS/.test(ua)) return 'chromeos';
    if (/Linux/.test(ua)) return 'linux';
    return 'generic';
  }

  const isMobile = () => /android|iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const BROWSER_NAMES = {
    'chrome': 'Google Chrome', 'chrome-android': 'Chrome (Android)', 'chrome-ios': 'Chrome (iPhone/iPad)',
    'edge': 'Microsoft Edge', 'edge-ios': 'Edge (iPhone/iPad)',
    'firefox': 'Mozilla Firefox', 'firefox-android': 'Firefox (Android)', 'firefox-ios': 'Firefox (iPhone/iPad)',
    'safari-mac': 'Safari', 'safari-ios': 'Safari (iPhone/iPad)',
    'opera': 'Opera', 'samsung': 'Samsung Internet', 'generic': 'il tuo browser',
  };

  // ─── Icone ─────────────────────────────────────────────────────────────────
  const ICO = {
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5M8.5 21.5h7"/></svg>',
    cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10.5l6-3.5v10l-6-3.5z"/></svg>',
    micOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M9 9v2a3 3 0 0 0 5.1 2.1M15 10.3V5.5a3 3 0 0 0-5.8-1"/><path d="M5 11a7 7 0 0 0 11.3 5.5M19 11a7 7 0 0 1-.6 2.8M12 18v3.5M8.5 21.5h7"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>',
    hand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11.5V4.5a1.5 1.5 0 0 1 3 0V12M14 11.5V6a1.5 1.5 0 0 1 3 0v6M17 12V9.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-5-2.7L4.3 13.8a1.6 1.6 0 0 1 2.6-1.9L8 13.5"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5L2.5 20h19L12 3.5z"/><path d="M12 10v4.5M12 17.5v.5"/></svg>',
    arrow: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M32 58V12"/><path d="M14 30l18-18 18 18"/></svg>',
  };

  // ─── Testi per il pannello ASK (richiesta del browser aperta) ───────────────
  // where: dove compare la richiesta nativa → posizione della freccia
  function askConfig(b) {
    const map = {
      'chrome': {
        where: 'top-left',
        hint: 'Premi «Consenti durante le visite al sito» (non «Consenti questa volta»): così non te lo chiederà più.',
        allowLabel: 'Consenti durante le visite al sito',
      },
      'edge': {
        where: 'top-left',
        hint: 'Premi «Consenti»: Edge ricorda la scelta per questo sito.',
        allowLabel: 'Consenti',
      },
      'opera': {
        where: 'top-left',
        hint: 'Premi «Consenti»: Opera ricorda la scelta per questo sito.',
        allowLabel: 'Consenti',
      },
      'firefox': {
        where: 'top-left',
        hint: 'Metti la spunta su «Ricorda questa decisione» e poi premi «Consenti»: così non te lo chiederà più.',
        allowLabel: 'Consenti',
        remember: 'Ricorda questa decisione',
      },
      'safari-mac': {
        where: 'top-center',
        hint: 'Premi «Consenti». Se Safari te lo chiede a ogni riunione: menu Safari → Impostazioni → Siti web → Microfono e Fotocamera → «Consenti».',
        allowLabel: 'Consenti',
      },
      'safari-ios': {
        where: 'center',
        hint: 'Tocca «Consenti» nella finestra che è comparsa.',
        allowLabel: 'Consenti',
      },
      'chrome-android': {
        where: 'bottom',
        hint: 'Tocca «Consenti durante l\'uso dell\'app» (o «Consenti»).',
        allowLabel: 'Consenti',
      },
      'firefox-android': {
        where: 'bottom',
        hint: 'Tocca «Consenti» e, se compare, spunta «Ricorda la decisione».',
        allowLabel: 'Consenti',
      },
      'samsung': {
        where: 'bottom',
        hint: 'Tocca «Consenti».',
        allowLabel: 'Consenti',
      },
      'chrome-ios':  { where: 'center', hint: 'Tocca «Consenti» nella finestra che è comparsa.', allowLabel: 'Consenti' },
      'firefox-ios': { where: 'center', hint: 'Tocca «Consenti» nella finestra che è comparsa.', allowLabel: 'Consenti' },
      'edge-ios':    { where: 'center', hint: 'Tocca «Consenti» nella finestra che è comparsa.', allowLabel: 'Consenti' },
      'generic':     { where: 'top-left', hint: 'Premi «Consenti» nella richiesta del browser.', allowLabel: 'Consenti' },
    };
    return map[b] || map.generic;
  }

  // ─── Passaggi per sbloccare permessi NEGATI dal browser ─────────────────────
  // Ogni passaggio è una frase intera (si traduce meglio) + eventuale tasto.
  function blockedSteps(b) {
    const map = {
      'chrome': { arrow: true, steps: [
        'Clicca sull\'icona del lucchetto (o sull\'icona delle impostazioni) a sinistra dell\'indirizzo, in alto.',
        'Metti «Microfono» e «Fotocamera» su «Consenti».',
        'Ricarica la pagina e riprova.',
      ]},
      'edge': { arrow: true, steps: [
        'Clicca sull\'icona del lucchetto a sinistra dell\'indirizzo, in alto.',
        'In «Autorizzazioni per questo sito» metti «Microfono» e «Fotocamera» su «Consenti».',
        'Ricarica la pagina e riprova.',
      ]},
      'opera': { arrow: true, steps: [
        'Clicca sull\'icona del lucchetto a sinistra dell\'indirizzo, in alto.',
        'Metti «Microfono» e «Fotocamera» su «Consenti».',
        'Ricarica la pagina e riprova.',
      ]},
      'firefox': { arrow: true, steps: [
        'Clicca sulle icone barrate del microfono e della videocamera (o sul lucchetto) a sinistra dell\'indirizzo, in alto.',
        'Premi la «✕» accanto a «Microfono bloccato» e «Fotocamera bloccata».',
        'Ricarica la pagina: alla nuova richiesta spunta «Ricorda questa decisione» e premi «Consenti».',
      ]},
      'safari-mac': { arrow: false, steps: [
        'Apri il menu Safari → Impostazioni… → scheda «Siti web».',
        'Nelle sezioni «Microfono» e «Fotocamera» cerca questo sito e scegli «Consenti».',
        'Ricarica la pagina e riprova.',
      ]},
      'safari-ios': { arrow: false, steps: [
        'Tocca «AA» (o l\'icona delle impostazioni) nella barra dell\'indirizzo → «Impostazioni sito web».',
        'Metti «Microfono» e «Fotocamera» su «Consenti».',
        'Se non li trovi: Impostazioni iPhone → App → Safari → Microfono e Fotocamera → «Consenti».',
        'Ricarica la pagina e riprova.',
      ]},
      'chrome-android': { arrow: false, steps: [
        'Tocca l\'icona del lucchetto a sinistra dell\'indirizzo → «Autorizzazioni».',
        'Attiva «Microfono» e «Fotocamera».',
        'Se non compaiono: Impostazioni Android → App → Chrome → Autorizzazioni.',
        'Ricarica la pagina e riprova.',
      ]},
      'chrome-ios': { arrow: false, steps: [
        'Apri Impostazioni iPhone → App → Chrome.',
        'Attiva «Microfono» e «Fotocamera».',
        'Torna qui e ricarica la pagina.',
      ]},
      'firefox-android': { arrow: false, steps: [
        'Tocca l\'icona del lucchetto a sinistra dell\'indirizzo.',
        'In «Autorizzazioni» sblocca «Microfono» e «Fotocamera».',
        'Ricarica la pagina e riprova.',
      ]},
      'firefox-ios': { arrow: false, steps: [
        'Apri Impostazioni iPhone → App → Firefox.',
        'Attiva «Microfono» e «Fotocamera».',
        'Torna qui e ricarica la pagina.',
      ]},
      'edge-ios': { arrow: false, steps: [
        'Apri Impostazioni iPhone → App → Edge.',
        'Attiva «Microfono» e «Fotocamera».',
        'Torna qui e ricarica la pagina.',
      ]},
      'samsung': { arrow: false, steps: [
        'Tocca l\'icona del lucchetto nella barra dell\'indirizzo → «Autorizzazioni».',
        'Attiva «Microfono» e «Fotocamera».',
        'Ricarica la pagina e riprova.',
      ]},
      'generic': { arrow: false, steps: [
        'Cerca l\'icona del lucchetto vicino all\'indirizzo del sito.',
        'Consenti l\'accesso a «Microfono» e «Fotocamera».',
        'Ricarica la pagina e riprova.',
      ]},
    };
    return map[b] || map.generic;
  }

  // ─── Passaggi quando è il SISTEMA OPERATIVO a bloccare il browser ───────────
  function systemSteps(os, browserName) {
    const map = {
      'windows': [
        'Apri Impostazioni di Windows → Privacy e sicurezza → Microfono.',
        'Attiva «Accesso al microfono» e «Consenti alle app desktop di accedere al microfono».',
        'Fai lo stesso in Privacy e sicurezza → Fotocamera.',
        'Chiudi e riapri il browser, poi riprova.',
      ],
      'mac': [
        'Apri Impostazioni di Sistema → Privacy e sicurezza → Microfono.',
        'Attiva l\'interruttore accanto a ' + browserName + '.',
        'Fai lo stesso in Privacy e sicurezza → Fotocamera.',
        'Chiudi e riapri il browser, poi riprova.',
      ],
      'ios': [
        'Apri Impostazioni iPhone → App → ' + browserName + '.',
        'Attiva «Microfono» e «Fotocamera».',
        'Torna qui e ricarica la pagina.',
      ],
      'android': [
        'Apri Impostazioni Android → App → ' + browserName + ' → Autorizzazioni.',
        'Attiva «Microfono» e «Fotocamera».',
        'Torna qui e ricarica la pagina.',
      ],
      'generic': [
        'Nelle impostazioni di privacy del computer consenti a ' + browserName + ' di usare microfono e videocamera.',
        'Chiudi e riapri il browser, poi riprova.',
      ],
    };
    return map[os] || map.generic;
  }

  // ─── Suggerimenti per microfono presente ma MUTO ────────────────────────────
  function mutedHints(os) {
    const map = {
      'windows': [
        'Controlla il tasto mute sulla cuffia o sul microfono.',
        'Impostazioni di Windows → Sistema → Audio → Input: scegli il microfono giusto e alza il volume di ingresso.',
      ],
      'mac': [
        'Controlla il tasto mute sulla cuffia o sul microfono.',
        'Impostazioni di Sistema → Suono → Ingresso: scegli il microfono giusto e alza il volume di ingresso.',
      ],
      'generic': [
        'Controlla il tasto mute sulla cuffia o sul microfono.',
        'Nelle impostazioni audio del dispositivo scegli il microfono giusto e alza il volume di ingresso.',
      ],
    };
    return map[os] || map.generic;
  }

  // ─── Stato interno ─────────────────────────────────────────────────────────
  let _el = null;        // overlay corrente
  let _mode = null;      // 'ask' | 'blocked' | 'system' | 'nodevice' | 'busy'
  let _onRetry = null;
  let _permWatchers = [];
  let _autoRetryDone = false;
  let _noticeEl = null;
  const _notices = new Set();

  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function _shell(cls, inner, opts = {}) {
    const wrap = document.createElement('div');
    wrap.id = 'permBanner';
    wrap.className = 'perm-banner ' + cls;
    wrap.innerHTML =
      (opts.arrow ? '<div class="pb-arrow pb-arrow-' + opts.arrow + '" aria-hidden="true">' + ICO.arrow + '</div>' : '') +
      '<div class="pb-card" role="alertdialog" aria-labelledby="pbTitle">' + inner +
        (opts.closable ? '<button type="button" class="pb-close" id="pbClose" aria-label="Chiudi">✕</button>' : '') +
      '</div>';
    wrap.querySelector('#pbClose')?.addEventListener('click', hide);
    return wrap;
  }

  const chips = () =>
    '<div class="pb-chips">' +
      '<div class="pb-chip"><span class="pb-chip-ico">' + ICO.mic + '</span><span>Microfono</span><span class="pb-chip-ok">' + ICO.check + '</span></div>' +
      '<div class="pb-chip"><span class="pb-chip-ico">' + ICO.cam + '</span><span>Videocamera</span><span class="pb-chip-ok">' + ICO.check + '</span></div>' +
    '</div>';

  // ── ASK: il browser sta chiedendo ────────────────────────────────────────────
  function _buildAsk(again) {
    const b = detectBrowser();
    const cfg = askConfig(b);
    const host = window.location.host;

    // finta richiesta del browser, con il tasto giusto evidenziato
    const fake =
      '<div class="pb-fake" aria-hidden="true">' +
        '<div class="pb-fake-bar"><span class="pb-fake-lock">' + ICO.lock + '</span><span class="pb-fake-host">' + esc(host) + '</span></div>' +
        '<div class="pb-fake-body">' +
          '<div class="pb-fake-q"><span>' + esc(host) + '</span> <span>vuole usare</span></div>' +
          '<div class="pb-fake-row">' + ICO.mic + '<span>il microfono</span></div>' +
          '<div class="pb-fake-row">' + ICO.cam + '<span>la videocamera</span></div>' +
          (cfg.remember ? '<label class="pb-fake-remember"><span class="pb-fake-box">' + ICO.check + '</span><span>' + esc(cfg.remember) + '</span></label>' : '') +
          '<div class="pb-fake-btns"><span class="pb-fake-btn">Blocca</span><span class="pb-fake-btn pb-fake-allow">' + esc(cfg.allowLabel) + '</span></div>' +
        '</div>' +
        '<div class="pb-cursor" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 8.5-6.3 1.4L16 19l-2.6 1.4-3.3-6-4.1 4.9z"/></svg></div>' +
      '</div>';

    const inner =
      '<div class="pb-icon pb-icon-ask">' + ICO.hand + '</div>' +
      '<h2 id="pbTitle">Consenti microfono e videocamera</h2>' +
      '<p class="pb-sub">' + (again
        ? 'Il browser te lo sta chiedendo di nuovo. Premi «Consenti» e fagli ricordare la scelta.'
        : 'Il browser ti sta chiedendo il permesso. Premi «Consenti» nella richiesta comparsa.') + '</p>' +
      chips() +
      fake +
      '<p class="pb-hint">' + esc(cfg.hint) + '</p>' +
      '<p class="pb-note">Senza questi permessi nessuno potrà vederti né sentirti.</p>' +
      '<div class="pb-actions"><button type="button" class="pb-btn pb-btn-ghost" id="pbNoPrompt">Non vedo nessuna richiesta</button></div>';

    const el = _shell('pb-mode-ask pb-where-' + cfg.where, inner, { arrow: cfg.where });
    el.querySelector('#pbNoPrompt').addEventListener('click', () => {
      // La richiesta è stata chiusa o il sito è già bloccato: mostra come sbloccare
      hide(true);
      show({ onRetry: _onRetry });
    });
    return el;
  }

  // ── BLOCKED: negato dal browser ──────────────────────────────────────────────
  function _buildBlocked() {
    const b = detectBrowser();
    const cfg = blockedSteps(b);
    const name = BROWSER_NAMES[b] || BROWSER_NAMES.generic;
    const inner =
      '<div class="pb-icon pb-icon-bad">' + ICO.micOff + '</div>' +
      '<h2 id="pbTitle">Microfono e videocamera bloccati</h2>' +
      '<p class="pb-sub">Il browser sta bloccando i permessi: nessuno può vederti né sentirti. Si sistema in pochi secondi.</p>' +
      '<p class="pb-browser"><span>Passaggi per</span> <b>' + esc(name) + '</b></p>' +
      '<ol class="pb-steps">' + cfg.steps.map(s => '<li>' + esc(s) + '</li>').join('') + '</ol>' +
      '<div class="pb-actions">' +
        '<button type="button" class="pb-btn pb-btn-primary" id="pbRetry">Fatto, riprova ora</button>' +
        '<button type="button" class="pb-btn pb-btn-ghost" id="pbReload">Ricarica la pagina</button>' +
      '</div>' +
      '<div class="pb-note" id="pbNote">Il pannello si chiude da solo appena i permessi risultano attivi.</div>';
    const el = _shell('pb-mode-blocked', inner, { arrow: cfg.arrow ? 'top-left' : null, closable: true });
    el.querySelector('#pbReload').addEventListener('click', () => window.location.reload());
    el.querySelector('#pbRetry').addEventListener('click', _doRetry);
    return el;
  }

  // ── SYSTEM: bloccato dal sistema operativo ───────────────────────────────────
  function _buildSystem() {
    const b = detectBrowser();
    const os = detectOS();
    const name = BROWSER_NAMES[b] || BROWSER_NAMES.generic;
    const steps = systemSteps(os, name);
    const inner =
      '<div class="pb-icon pb-icon-bad">' + ICO.warn + '</div>' +
      '<h2 id="pbTitle">Il sistema blocca microfono e videocamera</h2>' +
      '<p class="pb-sub">Non è il browser: sono le impostazioni di privacy del computer (o del telefono) a impedire l\'accesso.</p>' +
      '<ol class="pb-steps">' + steps.map(s => '<li>' + esc(s) + '</li>').join('') + '</ol>' +
      '<div class="pb-actions">' +
        '<button type="button" class="pb-btn pb-btn-primary" id="pbRetry">Fatto, riprova ora</button>' +
        '<button type="button" class="pb-btn pb-btn-ghost" id="pbReload">Ricarica la pagina</button>' +
      '</div>' +
      '<div class="pb-note" id="pbNote">Il pannello si chiude da solo appena i permessi risultano attivi.</div>';
    const el = _shell('pb-mode-system', inner, { closable: true });
    el.querySelector('#pbReload').addEventListener('click', () => window.location.reload());
    el.querySelector('#pbRetry').addEventListener('click', _doRetry);
    return el;
  }

  // ── NODEVICE / BUSY ─────────────────────────────────────────────────────────
  function _buildSimple(kind) {
    const isBusy = kind === 'busy';
    const inner =
      '<div class="pb-icon pb-icon-warn">' + ICO.warn + '</div>' +
      '<h2 id="pbTitle">' + (isBusy ? 'Microfono o videocamera occupati' : 'Nessun microfono o videocamera trovati') + '</h2>' +
      '<p class="pb-sub">' + (isBusy
        ? 'Un\'altra applicazione li sta usando (Zoom, Teams, OBS, FaceTime, un\'altra scheda del browser…).'
        : 'Il browser non vede nessun dispositivo collegato.') + '</p>' +
      '<ol class="pb-steps">' + (isBusy ? [
        'Chiudi l\'altra applicazione o la scheda che usa microfono e videocamera.',
        'Premi «Fatto, riprova ora».',
      ] : [
        'Collega il microfono o la videocamera (o la cuffia).',
        'Se è una USB, scollegala e ricollegala.',
        'Premi «Fatto, riprova ora».',
      ]).map(s => '<li>' + esc(s) + '</li>').join('') + '</ol>' +
      '<div class="pb-actions">' +
        '<button type="button" class="pb-btn pb-btn-primary" id="pbRetry">Fatto, riprova ora</button>' +
        '<button type="button" class="pb-btn pb-btn-ghost" id="pbReload">Ricarica la pagina</button>' +
      '</div>' +
      '<div class="pb-note" id="pbNote">Puoi comunque entrare: gli altri non ti vedranno né sentiranno finché non risolvi.</div>';
    const el = _shell('pb-mode-' + kind, inner, { closable: true });
    el.querySelector('#pbReload').addEventListener('click', () => window.location.reload());
    el.querySelector('#pbRetry').addEventListener('click', _doRetry);
    return el;
  }

  async function _doRetry() {
    const btn = _el?.querySelector('#pbRetry');
    if (btn) { btn.disabled = true; btn.textContent = T('Controllo in corso…'); }
    let ok = false;
    try { ok = _onRetry ? !!(await _onRetry()) : false; } catch { ok = false; }
    if (ok) { hide(); return; }
    // se nel frattempo _onRetry ha mostrato un altro pannello, non toccarlo
    const b2 = _el?.querySelector('#pbRetry');
    if (b2 && b2 === btn) {
      btn.disabled = false;
      btn.textContent = T('Fatto, riprova ora');
      btn.classList.add('pb-shake');
      setTimeout(() => btn.classList.remove('pb-shake'), 500);
      const note = _el?.querySelector('#pbNote');
      if (note) note.textContent = T('Ancora bloccati… controlla i passaggi qui sopra, oppure ricarica la pagina.');
    }
  }

  // Osserva i PermissionStatus: se l'utente concede dal lucchetto senza
  // ricaricare, riproviamo in automatico e chiudiamo il pannello.
  async function _watchPermissions() {
    if (!navigator.permissions?.query) return;
    for (const name of ['microphone', 'camera']) {
      try {
        const st = await navigator.permissions.query({ name });
        const handler = () => {
          if (st.state === 'granted' && !_autoRetryDone && _onRetry) {
            _autoRetryDone = true;
            _doRetry().finally(() => { _autoRetryDone = false; });
          }
        };
        st.addEventListener?.('change', handler);
        _permWatchers.push({ st, handler });
      } catch { /* browser senza query({name:'camera'}) */ }
    }
  }
  function _unwatchPermissions() {
    _permWatchers.forEach(({ st, handler }) => st.removeEventListener?.('change', handler));
    _permWatchers = [];
  }

  function _mount(el, mode) {
    hide(true);
    _el = el; _mode = mode;
    document.body.appendChild(_el);
    requestAnimationFrame(() => _el?.classList.add('visible'));
    if (mode !== 'ask') _watchPermissions();
  }

  // ─── Memoria del consenso ──────────────────────────────────────────────────
  function remembered() { try { return localStorage.getItem(REMEMBER_KEY) === '1'; } catch { return false; } }
  function remember() { try { localStorage.setItem(REMEMBER_KEY, '1'); } catch { } }

  async function permState() {
    if (!navigator.permissions?.query) return { mic: null, cam: null };
    const q = async (name) => { try { return (await navigator.permissions.query({ name })).state; } catch { return null; } };
    return { mic: await q('microphone'), cam: await q('camera') };
  }

  // ─── Classificazione errori getUserMedia ──────────────────────────────────
  function classify(err) {
    const n = err?.name || '';
    const m = String(err?.message || '').toLowerCase();
    if (n === 'NotAllowedError' || n === 'PermissionDeniedError' || n === 'SecurityError') {
      // Chrome/Edge: "Permission denied by system" quando è l'OS a bloccare
      if (/by system|system denied|denied by the system/.test(m)) return 'system';
      return 'blocked';
    }
    if (n === 'NotFoundError' || n === 'DevicesNotFoundError') return 'nodevice';
    if (n === 'NotReadableError' || n === 'TrackStartError' || n === 'AbortError') {
      // su Windows il blocco di privacy arriva spesso come NotReadableError
      if (/could not start|starting video|starting audio|device in use/.test(m) && detectOS() === 'windows') return 'busy';
      return 'busy';
    }
    return null;
  }

  // ─── API pubblica ──────────────────────────────────────────────────────────
  function show(opts = {}) {          // compatibilità: = blocked
    _onRetry = opts.onRetry || _onRetry;
    if (_el && _mode === 'blocked') return;
    _mount(_buildBlocked(), 'blocked');
  }
  function showSystem(opts = {}) {
    _onRetry = opts.onRetry || _onRetry;
    if (_el && _mode === 'system') return;
    _mount(_buildSystem(), 'system');
  }
  function showSimple(kind, opts = {}) {
    _onRetry = opts.onRetry || _onRetry;
    if (_el && _mode === kind) return;
    _mount(_buildSimple(kind), kind);
  }
  function ask(opts = {}) {
    _onRetry = opts.onRetry || _onRetry;
    if (_el && _mode === 'ask') return;
    _mount(_buildAsk(!!opts.again), 'ask');
  }

  function fromError(err, opts = {}) {
    const kind = classify(err);
    if (!kind) { hide(); return null; }
    if (kind === 'blocked') show(opts);
    else if (kind === 'system') showSystem(opts);
    else showSimple(kind, opts);
    return kind;
  }

  function hide(silent) {
    _unwatchPermissions();
    if (!_el) return;
    const el = _el; _el = null; _mode = null;
    el.classList.remove('visible');
    setTimeout(() => el.remove(), silent ? 0 : 250);
  }

  /**
   * Da chiamare subito PRIMA di getUserMedia. Se il browser non risponde entro
   * poco (= sta mostrando la sua richiesta) compare il pannello ASK. Se i
   * permessi sono già concessi gUM risolve subito e non si vede nulla.
   */
  function beginRequest(opts = {}) {
    const again = remembered();
    let timer = null, closed = false;
    const start = async () => {
      let delay = again ? 900 : 350;
      try {
        const st = await permState();
        if (st.mic === 'granted' && st.cam === 'granted') return;         // niente richiesta: non serve il pannello
        if (st.mic === 'denied' && st.cam === 'denied') return;           // gUM fallirà → fromError
        if (st.mic === 'prompt' || st.cam === 'prompt') delay = 150;      // la richiesta sta comparendo adesso
      } catch { }
      if (closed) return;
      timer = setTimeout(() => { if (!closed) ask({ onRetry: opts.onRetry, again }); }, delay);
    };
    start();
    return {
      done(stream) {
        closed = true; clearTimeout(timer);
        if (stream) remember();
        if (_mode === 'ask' || !_el) hide();
        else hide();
      },
      fail(err, o = {}) {
        closed = true; clearTimeout(timer);
        return fromError(err, { onRetry: o.onRetry || opts.onRetry });
      },
      cancel() { closed = true; clearTimeout(timer); if (_mode === 'ask') hide(); },
    };
  }

  // ─── NOTICE: barra in alto, non bloccante ──────────────────────────────────
  const NOTICE_TEXT = {
    micMuted:  { title: 'Il microfono è disattivato dal sistema', sub: 'Il browser lo vede ma non riceve alcun suono: è silenziato dal computer o dalla cuffia.' },
    micSilent: { title: 'Il microfono non sente nulla', sub: 'Nessun suono in ingresso da diversi secondi: gli altri non ti sentono.' },
    camMuted:  { title: 'La videocamera non invia immagini', sub: 'È coperta, spenta dal tasto fisico o usata da un\'altra applicazione.' },
  };

  function _renderNotice() {
    const kind = ['micMuted', 'micSilent', 'camMuted'].find(k => _notices.has(k));
    if (!kind) { if (_noticeEl) { _noticeEl.classList.remove('visible'); const e = _noticeEl; _noticeEl = null; setTimeout(() => e.remove(), 250); } return; }
    const txt = NOTICE_TEXT[kind];
    const hints = kind === 'camMuted'
      ? ['Scopri l\'obiettivo o accendi la videocamera con il suo tasto.', 'Chiudi le altre applicazioni che la usano.']
      : mutedHints(detectOS());
    if (!_noticeEl) {
      _noticeEl = document.createElement('div');
      _noticeEl.id = 'permNotice';
      _noticeEl.className = 'perm-notice';
      document.body.appendChild(_noticeEl);
      requestAnimationFrame(() => _noticeEl?.classList.add('visible'));
    }
    if (_noticeEl.dataset.kind === kind) return;
    _noticeEl.dataset.kind = kind;
    _noticeEl.innerHTML =
      '<div class="pn-ico">' + (kind === 'camMuted' ? ICO.cam : ICO.micOff) + '</div>' +
      '<div class="pn-body">' +
        '<div class="pn-title">' + esc(txt.title) + '</div>' +
        '<div class="pn-sub">' + esc(txt.sub) + '</div>' +
        '<ul class="pn-hints">' + hints.map(h => '<li>' + esc(h) + '</li>').join('') + '</ul>' +
      '</div>' +
      '<button type="button" class="pn-close" aria-label="Chiudi">✕</button>';
    _noticeEl.querySelector('.pn-close').addEventListener('click', () => { _notices.clear(); _renderNotice(); });
  }

  function notice(kind, on = true) {
    if (!NOTICE_TEXT[kind]) return;
    const had = _notices.has(kind);
    if (on && !had) _notices.add(kind);
    else if (!on && had) _notices.delete(kind);
    else return;
    _renderNotice();
  }

  window.PermBanner = {
    show, hide, ask, fromError, beginRequest, notice,
    showSystem, showSimple, classify, remembered, remember, permState,
    detectBrowser, detectOS, isMobile,
  };
})();
