'use strict';

/**
 * PermBanner — banner full-screen che compare quando l'utente ha NEGATO
 * i permessi di microfono/camera. Rileva il browser e mostra le istruzioni
 * esatte per sbloccarli, con freccia animata verso il lucchetto della URL bar.
 *
 * API:
 *   PermBanner.show({ onRetry: async () => boolean })  // onRetry ritorna true se i permessi ora sono ok
 *   PermBanner.hide()
 *
 * Auto-dismiss: osserva navigator.permissions e se l'utente concede i permessi
 * mentre il banner è aperto, riprova da solo e si chiude.
 */
(function () {

  // ─── Browser detection ─────────────────────────────────────────────────────
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

  const BROWSER_NAMES = {
    'chrome': 'Google Chrome', 'chrome-android': 'Chrome (Android)', 'chrome-ios': 'Chrome (iPhone/iPad)',
    'edge': 'Microsoft Edge', 'edge-ios': 'Edge (iPhone/iPad)',
    'firefox': 'Mozilla Firefox', 'firefox-android': 'Firefox (Android)', 'firefox-ios': 'Firefox (iPhone/iPad)',
    'safari-mac': 'Safari', 'safari-ios': 'Safari (iPhone/iPad)',
    'opera': 'Opera', 'samsung': 'Samsung Internet', 'generic': 'il tuo browser',
  };

  // Per ogni browser: lista di step (HTML consentito) + se mostrare la freccia verso la URL bar
  function getSteps(b, host) {
    const H = '<b>' + host + '</b>';
    const LOCK = '<span class="pb-inline-ico">🔒</span>';
    const map = {
      'chrome': {
        arrow: true,
        steps: [
          'Clicca sull\'icona ' + LOCK + ' (o <b>⚙ Impostazioni sito</b>) a sinistra dell\'indirizzo ' + H,
          'Imposta <b>Microfono</b> e <b>Fotocamera</b> su <b>"Consenti"</b>',
          'Ricarica la pagina (<b>F5</b>) e riprova',
        ],
      },
      'edge': {
        arrow: true,
        steps: [
          'Clicca sull\'icona ' + LOCK + ' a sinistra dell\'indirizzo ' + H,
          '<b>Autorizzazioni per questo sito</b> → <b>Microfono</b> e <b>Fotocamera</b> su <b>"Consenti"</b>',
          'Ricarica la pagina (<b>F5</b>) e riprova',
        ],
      },
      'firefox': {
        arrow: true,
        steps: [
          'Clicca sull\'icona ' + LOCK + ' (o sulle icone barrate 🎤🎥) a sinistra dell\'URL',
          'Rimuovi i blocchi: clicca la <b>✕</b> accanto a "Microfono bloccato" e "Fotocamera bloccata"',
          'Ricarica la pagina (<b>F5</b>): il browser richiederà i permessi → <b>Consenti</b>',
        ],
      },
      'safari-mac': {
        arrow: false,
        steps: [
          'Menu <b>Safari</b> → <b>Impostazioni…</b> → tab <b>Siti web</b>',
          'Sezioni <b>Microfono</b> e <b>Fotocamera</b> → trova ' + H + ' → imposta <b>"Consenti"</b>',
          'Ricarica la pagina (<b>Cmd+R</b>) e riprova',
        ],
      },
      'safari-ios': {
        arrow: false,
        steps: [
          'Tocca <b>"AA"</b> (o l\'icona impostazioni) nella barra dell\'indirizzo → <b>Impostazioni sito web</b>',
          '<b>Microfono</b> e <b>Fotocamera</b> → <b>"Consenti"</b>',
          'In alternativa: <b>Impostazioni iPhone → App → Safari → Fotocamera/Microfono → Consenti</b>',
          'Ricarica la pagina e riprova',
        ],
      },
      'chrome-android': {
        arrow: false,
        steps: [
          'Tocca l\'icona ' + LOCK + ' a sinistra dell\'indirizzo → <b>Autorizzazioni</b>',
          '<b>Microfono</b> e <b>Fotocamera</b> → <b>"Consenti"</b>',
          'Se non compaiono: <b>Impostazioni Android → App → Chrome → Autorizzazioni</b>',
          'Ricarica la pagina e riprova',
        ],
      },
      'chrome-ios': {
        arrow: false,
        steps: [
          'Apri <b>Impostazioni iPhone → App → Chrome</b>',
          'Attiva <b>Microfono</b> e <b>Fotocamera</b>',
          'Torna qui e ricarica la pagina',
        ],
      },
      'firefox-android': {
        arrow: false,
        steps: [
          'Tocca l\'icona ' + LOCK + ' a sinistra dell\'URL',
          '<b>Autorizzazioni</b> → sblocca <b>Microfono</b> e <b>Fotocamera</b>',
          'Ricarica la pagina e riprova',
        ],
      },
      'firefox-ios': {
        arrow: false,
        steps: [
          'Apri <b>Impostazioni iPhone → App → Firefox</b>',
          'Attiva <b>Microfono</b> e <b>Fotocamera</b>',
          'Torna qui e ricarica la pagina',
        ],
      },
      'edge-ios': {
        arrow: false,
        steps: [
          'Apri <b>Impostazioni iPhone → App → Edge</b>',
          'Attiva <b>Microfono</b> e <b>Fotocamera</b>',
          'Torna qui e ricarica la pagina',
        ],
      },
      'opera': {
        arrow: true,
        steps: [
          'Clicca sull\'icona ' + LOCK + ' a sinistra dell\'indirizzo',
          '<b>Microfono</b> e <b>Fotocamera</b> → <b>"Consenti"</b>',
          'Ricarica la pagina (<b>F5</b>) e riprova',
        ],
      },
      'samsung': {
        arrow: false,
        steps: [
          'Tocca l\'icona ' + LOCK + ' nella barra dell\'indirizzo → <b>Autorizzazioni</b>',
          'Attiva <b>Microfono</b> e <b>Fotocamera</b>',
          'Ricarica la pagina e riprova',
        ],
      },
      'generic': {
        arrow: false,
        steps: [
          'Cerca l\'icona del lucchetto ' + LOCK + ' vicino all\'indirizzo del sito',
          'Consenti l\'accesso a <b>Microfono</b> e <b>Fotocamera</b>',
          'Ricarica la pagina e riprova',
        ],
      },
    };
    return map[b] || map.generic;
  }

  // ─── Stato interno ─────────────────────────────────────────────────────────
  let _el = null;
  let _onRetry = null;
  let _permWatchers = [];
  let _autoRetryDone = false;

  function _buildDom() {
    const b = detectBrowser();
    const host = window.location.host;
    const cfg = getSteps(b, host);
    const name = BROWSER_NAMES[b] || BROWSER_NAMES.generic;

    const wrap = document.createElement('div');
    wrap.id = 'permBanner';
    wrap.className = 'perm-banner';
    wrap.innerHTML =
      (cfg.arrow ? '<div class="pb-arrow" aria-hidden="true">⤴</div>' : '') +
      '<div class="pb-card" role="alertdialog" aria-labelledby="pbTitle">' +
        '<div class="pb-icon">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">' +
            '<path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>' +
            '<path d="M19 10v1a7 7 0 0 1-14 0v-1"/>' +
            '<line x1="12" y1="18" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/>' +
            '<line x1="2" y1="2" x2="22" y2="22" stroke="#ff5252" stroke-width="2.2"/>' +
          '</svg>' +
        '</div>' +
        '<h2 id="pbTitle">Microfono e camera bloccati</h2>' +
        '<p class="pb-sub">Nessuno può vederti né sentirti: il browser sta bloccando i permessi.<br>' +
        'Niente panico — si sistema in 10 secondi. Segui i passaggi per <b>' + name + '</b>:</p>' +
        '<ol class="pb-steps">' +
          cfg.steps.map(s => '<li>' + s + '</li>').join('') +
        '</ol>' +
        '<div class="pb-actions">' +
          '<button type="button" class="pb-btn pb-btn-primary" id="pbRetry">✅ Fatto, riprova ora</button>' +
          '<button type="button" class="pb-btn pb-btn-ghost" id="pbReload">↻ Ricarica pagina</button>' +
        '</div>' +
        '<button type="button" class="pb-close" id="pbClose" aria-label="Chiudi">✕</button>' +
        '<div class="pb-note">Il banner si chiuderà da solo appena i permessi risultano attivi.</div>' +
      '</div>';

    wrap.querySelector('#pbClose').addEventListener('click', hide);
    wrap.querySelector('#pbReload').addEventListener('click', () => window.location.reload());
    wrap.querySelector('#pbRetry').addEventListener('click', _doRetry);
    return wrap;
  }

  async function _doRetry() {
    const btn = _el?.querySelector('#pbRetry');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Controllo permessi…'; }
    let ok = false;
    try { ok = _onRetry ? !!(await _onRetry()) : false; } catch { ok = false; }
    if (ok) { hide(); return; }
    if (btn) {
      btn.disabled = false;
      btn.textContent = '✅ Fatto, riprova ora';
      btn.classList.add('pb-shake');
      setTimeout(() => btn.classList.remove('pb-shake'), 500);
      const note = _el?.querySelector('.pb-note');
      if (note) note.textContent = 'Ancora bloccati… controlla i passaggi qui sopra, oppure ricarica la pagina.';
    }
  }

  // Osserva i PermissionStatus: se l'utente concede dal lucchetto senza ricaricare,
  // riproviamo in automatico e chiudiamo il banner.
  async function _watchPermissions() {
    if (!navigator.permissions?.query) return;
    for (const name of ['microphone', 'camera']) {
      try {
        const st = await navigator.permissions.query({ name });
        const handler = () => {
          if (st.state === 'granted' && !_autoRetryDone) {
            _autoRetryDone = true;
            _doRetry().finally(() => { _autoRetryDone = false; });
          }
        };
        st.addEventListener?.('change', handler);
        _permWatchers.push({ st, handler });
      } catch { /* browser che non supporta query({name:'camera'}) — pazienza */ }
    }
  }

  function _unwatchPermissions() {
    _permWatchers.forEach(({ st, handler }) => st.removeEventListener?.('change', handler));
    _permWatchers = [];
  }

  // ─── API pubblica ──────────────────────────────────────────────────────────
  function show(opts = {}) {
    _onRetry = opts.onRetry || null;
    if (_el) return; // già visibile
    _el = _buildDom();
    document.body.appendChild(_el);
    requestAnimationFrame(() => _el?.classList.add('visible'));
    _watchPermissions();
  }

  function hide() {
    _unwatchPermissions();
    if (!_el) return;
    const el = _el; _el = null;
    el.classList.remove('visible');
    setTimeout(() => el.remove(), 250);
  }

  window.PermBanner = { show, hide, detectBrowser };
})();
