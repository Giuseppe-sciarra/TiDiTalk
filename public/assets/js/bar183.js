'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   TIDITALK 1.8.3 — Telefono (idea 19): in verticale (≤ 640 px) e in orizzontale
   ───────────────────────────────────────────────────────────────────────────
   Solo sul telefono, computer e tablet restano come nella 1.8.2:
     • in alto solo codice stanza, gira la videocamera e casse;
     • in basso 5 tasti grandi: microfono, camera, mano, Altro, Esci;
     • tutto il resto (Presenta, Disegna, Reazioni, Persone, Info, Vista,
       Attività, registra, tema, suoni, lingua, guida, link, impostazioni) in Altro;
     • la chat ha un pulsante flottante a destra sopra la barra, col numero dei
       non letti; sparisce quando la chat è aperta;
     • tu in finestrella (layout.js) se nel tasto Vista non hai scelto altro.

   Nessun pulsante di room.js viene spostato o rifatto: sul telefono il CSS li
   nasconde e le voci nuove di Altro li «premono». Così scorciatoie, stati
   (.off, .active, .recording…) e agganci degli altri file restano gli stessi.
   Le voci nuove esistono sempre, ma fuori dal telefono sono nascoste (bar183.css).
   Unica cosa che si sposta: la tendina della lingua (i18n.js), che sul
   telefono va dentro Altro e sul computer torna nella fascia in alto.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  const T = (s) => (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t(s) : s;
  const $ = (id) => document.getElementById(id);
  // stessa condizione di bar183.css (e di notify.css): telefono in verticale o in orizzontale
  const PHONE = window.matchMedia('(max-width: 640px), (max-height: 500px) and (pointer: coarse) and (orientation: landscape)');
  const COARSE = window.matchMedia('(pointer: coarse)');
  const SVG = (inner, w = 18) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  const ICO = {
    // fotocamera con le due frecce che girano
    flip: '<path d="M4.5 8h2.2l1.5-2h7.6l1.5 2h2.2a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-8A1.5 1.5 0 0 1 4.5 8z"/><path d="M9 13.2a3 3 0 0 1 5.4-1.6M15 12.8a3 3 0 0 1-5.4 1.6"/><path d="M14.6 10.2v1.6H13M9.4 15.8v-1.6H11"/>',
    help: '<circle cx="12" cy="12" r="9.5"/><path d="M9.3 9.2a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.3-2.7 4"/><path d="M12 17.3h.01" stroke-width="2.4"/>',
    lang: '<circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5c2.6 2.7 3.9 5.9 3.9 9.5s-1.3 6.8-3.9 9.5c-2.6-2.7-3.9-5.9-3.9-9.5s1.3-6.8 3.9-9.5z"/>',
    chat: '<path d="M20.5 14.5a2 2 0 0 1-2 2H8l-4.5 4v-14a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/>',
  };
  const KEY_OF = { btnScreen: 'S', btnAnnotate: 'D', btnParticipants: 'U' };

  let menu, fab, flipBtn, spkBtn;
  const proxies = [];   // voci di Altro che fanno le veci di un tasto nascosto

  // ── utilità ──────────────────────────────────────────────────────────────
  function el(tag, cls, attrs, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (html != null) n.innerHTML = html;
    return n;
  }
  // icona di un tasto esistente (la stessa che si vede nella barra)
  function iconOf(btn) {
    const ic = btn?.querySelector('.ctrl-icon svg, svg');
    return ic ? ic.outerHTML.replace(/width="\d+"/, 'width="18"').replace(/height="\d+"/, 'height="18"') : '';
  }
  // premere un tasto dopo che il clic sulla voce ha finito il suo giro:
  // i pannelli che si chiudono «cliccando fuori» non devono richiudersi subito
  function press(id) {
    window.closeMoreMenu?.();
    setTimeout(() => $(id)?.click(), 0);
  }
  const rendered = (n) => !!n && n.offsetParent !== null && getComputedStyle(n).visibility !== 'hidden';
  function peopleCount() {
    const m = String($('peerCount')?.textContent || '').match(/\d+/);
    return m ? m[0] : '1';
  }

  // ── menu Altro: voci per il telefono ─────────────────────────────────────
  function item(id, icon, label, extra) {
    return el('button', 'more-menu-item b183-mi', { type: 'button', id }, `<span class="more-menu-ico">${icon}</span><span class="b183-mi-lbl">${label}</span>${extra || ''}`);
  }
  // voce che sostituisce un tasto della barra che sul telefono non c'è
  function proxy(srcId, label, opts = {}) {
    const src = $(srcId);
    if (!src) return null;
    const k = KEY_OF[srcId];
    const b = item('b183p-' + srcId, iconOf(src), label, (opts.count ? '<span class="b183-mi-n" translate="no"></span>' : '') + (k ? `<kbd class="b183-kbd">${k}</kbd>` : ''));
    b.addEventListener('click', () => press(srcId));
    proxies.push({ id: srcId, btn: b, src, label, opts, count: b.querySelector('.b183-mi-n') });
    return b;
  }
  function syncProxies() {
    proxies.forEach(p => {
      const s = p.src;
      // si vede solo se il tasto vero c'è ma non è nella barra
      let show = !s.classList.contains('hidden') && !s.classList.contains('unsupported') && !rendered(s);
      if (p.opts.noTouch && COARSE.matches) show = false;   // registrare dal telefono non è praticabile
      p.btn.classList.toggle('hidden', !show);
      const on = s.classList.contains('active') || s.classList.contains('recording');
      p.btn.classList.toggle('active', on);
      const lbl = p.btn.querySelector('.b183-mi-lbl');
      const txt = on && p.opts.onLabel ? p.opts.onLabel : p.label;
      if (lbl && lbl.dataset.k !== txt) { lbl.dataset.k = txt; lbl.textContent = txt; }
      if (p.count) p.count.textContent = peopleCount();
    });
    menu?.querySelector('.b183-quick')?.classList.toggle('hidden', !proxies.some(p => !p.btn.classList.contains('hidden')));
  }
  function syncTheme() {
    const b = $('b183Theme'); if (!b) return;
    const txt = document.documentElement.dataset.theme === 'light' ? 'Passa al tema scuro' : 'Passa al tema chiaro';
    const lbl = b.querySelector('.b183-mi-lbl');
    if (lbl.dataset.k !== txt) { lbl.dataset.k = txt; lbl.textContent = txt; }
  }
  function syncSound() {
    const b = $('b183Sound'); if (!b) return;
    const on = !$('soundOnIcon')?.classList.contains('hidden');
    b.setAttribute('aria-checked', on ? 'true' : 'false');
    b.querySelector('.b183-ico-on')?.classList.toggle('hidden', !on);
    b.querySelector('.b183-ico-off')?.classList.toggle('hidden', on);
  }

  function buildMenu() {
    menu = $('moreMenu');
    if (!menu || menu.querySelector('.b183-mi')) return;

    // in cima, i tasti della barra che sul telefono non ci sono
    const quick = el('div', 'b183-quick hidden');
    [
      proxy('btnScreen', 'Presenta', { onLabel: 'Smetti di presentare' }),
      proxy('btnAnnotate', 'Disegna'),
      proxy('btnReactions', 'Reazioni'),
      proxy('btnParticipants', 'Persone', { count: true }),
      proxy('btnInfo', 'Informazioni'),
      proxy('btnLayout', 'Vista'),
      proxy('btnRecord', 'Registra', { noTouch: true, onLabel: 'Ferma la registrazione' }),
    ].forEach(b => b && quick.appendChild(b));
    menu.prepend(quick);

    // in fondo, quello che sul computer sta nella fascia in alto
    const tail = el('div', 'b183-tail');
    const th = $('btnTheme');
    const theme = item('b183Theme', `<span class="ico-dark">${th?.querySelector('.ico-dark')?.innerHTML || ''}</span><span class="ico-light hidden">${th?.querySelector('.ico-light')?.innerHTML || ''}</span>`, '');
    theme.setAttribute('data-theme-toggle', '');      // theme.js fa il resto
    theme.addEventListener('click', () => { window.closeMoreMenu?.(); setTimeout(syncTheme, 0); });

    const sOn = $('soundOnIcon')?.innerHTML || '', sOff = $('soundOffIcon')?.innerHTML || '';
    const sound = item('b183Sound', `<span class="b183-ico-on">${sOn}</span><span class="b183-ico-off hidden">${sOff}</span>`, 'Suoni di notifica', '<span class="b183-sw" aria-hidden="true"></span>');
    sound.setAttribute('role', 'menuitemcheckbox');
    // il menu resta aperto e si vede l'interruttore: il clic non risale al
    // documento (lì room.js chiude il menu per ogni clic fuori da Altro)
    sound.addEventListener('click', (e) => {
      e.stopImmediatePropagation();
      $('btnSoundToggle')?.dispatchEvent(new MouseEvent('click', { bubbles: false, cancelable: true }));
      syncSound();
    });

    const lang = el('div', 'more-menu-item b183-mi b183-lang', { id: 'b183Lang' }, `<span class="more-menu-ico">${SVG(ICO.lang)}</span><label class="b183-mi-lbl" for="language-select">Lingua</label>`);
    const help = item('b183Help', SVG(ICO.help), 'Guida rapida ai comandi');
    help.addEventListener('click', () => press('btnHelp'));
    tail.append(theme, sound, lang, help);
    menu.appendChild(tail);

    syncTheme(); syncSound();
    document.addEventListener('tdt:theme', syncTheme);
    const so = $('soundOnIcon');
    if (so) new MutationObserver(syncSound).observe(so, { attributes: true, attributeFilter: ['class'] });

    // all'apertura sul telefono: voci aggiornate e menu che sta nello schermo
    new MutationObserver(() => {
      if (menu.classList.contains('hidden')) return;
      if (PHONE.matches) { syncProxies(); fitMenu(); } else menu.style.removeProperty('max-height');
    }).observe(menu, { attributes: true, attributeFilter: ['class'] });
  }
  function fitMenu() {
    const r = $('btnMore')?.getBoundingClientRect();
    if (!r || !r.height) return;
    const top = (document.querySelector('.room-header')?.getBoundingClientRect().bottom || 0) + 8;
    menu.style.maxHeight = Math.max(160, Math.round(r.top - 10 - top)) + 'px';
  }

  // la tendina della lingua (i18n.js): sul telefono in Altro, altrimenti nella fascia in alto
  let langTries = 0;
  function placeLanguage() {
    const ls = $('language-switcher'), row = $('b183Lang');
    const hr = document.querySelector('.room-header .header-right');
    if (!row || !hr) return;
    if (!ls) { if (langTries++ < 20) setTimeout(placeLanguage, 150); return; }
    if (!ls._b183) {
      ls._b183 = true;
      // cambiare lingua dal menu non deve chiuderlo (il clic arriverebbe al documento)
      ls.addEventListener('click', (e) => { if (ls.parentNode === row) e.stopPropagation(); });
    }
    if (PHONE.matches) { if (ls.parentNode !== row) row.appendChild(ls); }
    else if (ls.parentNode !== hr) hr.insertBefore(ls, $('b183Flip'));   // di nuovo ultimo, come in 1.8.2
  }

  // ── in alto: gira la videocamera e casse ──────────────────────────────────
  function buildTop() {
    const hr = document.querySelector('.room-header .header-right');
    if (!hr || $('b183Flip')) return;
    flipBtn = el('button', 'btn-icon b183-top hidden', { type: 'button', id: 'b183Flip', 'data-tip': 'Gira la videocamera', 'aria-label': 'Gira la videocamera' }, SVG(ICO.flip, 20));
    flipBtn.addEventListener('click', flipCamera);
    const sp = $('btnSpeaker');
    spkBtn = el('button', 'btn-icon b183-top', { type: 'button', id: 'b183Spk', 'data-tip': 'Casse: senti o silenzia gli altri. Il microfono non cambia', 'aria-label': 'Casse' },
      sp ? sp.querySelector('.ctrl-icon').innerHTML : '');
    spkBtn.addEventListener('click', () => sp?.click());
    const syncSpk = () => {
      const off = !!sp?.classList.contains('off');
      spkBtn.classList.toggle('off', off);
      spkBtn.setAttribute('aria-pressed', off ? 'false' : 'true');
      spkBtn.querySelector('.icon-on')?.classList.toggle('hidden', off);
      spkBtn.querySelector('.icon-off')?.classList.toggle('hidden', !off);
    };
    if (sp) new MutationObserver(syncSpk).observe(sp, { attributes: true, attributeFilter: ['class'], subtree: true });
    syncSpk();
    hr.append(flipBtn, spkBtn);
    // classi d'aggancio per il CSS del telefono (niente :has)
    sp?.closest('.ctrl-btn-group')?.classList.add('b183-spk-group');
    $('btnMic')?.closest('.ctrl-btn-group')?.classList.add('b183-av-group');
    $('btnCamera')?.closest('.ctrl-btn-group')?.classList.add('b183-av-group');
    // prima del permesso il browser elenca una videocamera sola: si ricontrolla
    // dopo l'ingresso, quando cambiano i dispositivi e dopo un cambio di camera
    checkCams();
    navigator.mediaDevices?.addEventListener?.('devicechange', () => setTimeout(checkCams, 400));
    document.addEventListener('tdt:devices', () => setTimeout(checkCams, 300));
    const ls = $('loadingScreen');
    if (ls) new MutationObserver(() => { if (ls.classList.contains('hidden')) [300, 2500].forEach(t => setTimeout(checkCams, t)); })
      .observe(ls, { attributes: true, attributeFilter: ['class'] });
    [2500, 7000].forEach(t => setTimeout(checkCams, t));
  }
  async function camList() {
    const ds = window._deviceSelector;
    try {
      if (ds && typeof ds._loadDevices === 'function') { await ds._loadDevices(); return ds.devices.videoinput || []; }
      const all = await navigator.mediaDevices.enumerateDevices();
      return all.filter(d => d.kind === 'videoinput');
    } catch (_) { return []; }
  }
  // il tasto c'è solo con almeno due videocamere (anteriore e posteriore)
  async function checkCams() {
    if (!flipBtn) return;
    const cams = await camList();
    flipBtn.classList.toggle('hidden', cams.length < 2);
  }
  let flipping = false;
  async function flipCamera() {
    const ds = window._deviceSelector;
    if (flipping || !ds || typeof ds._switch !== 'function') return;
    flipping = true;
    flipBtn.classList.add('b183-spin');
    try {
      const cams = await camList();
      if (cams.length < 2) { window.showToast?.('C\'è una sola videocamera'); return; }
      const cur = window._localCamTrack?.getSettings?.().deviceId || window._tdmeetSelectedVideo;
      const i = cams.findIndex(c => c.deviceId === cur);
      await ds._switch('videoinput', cams[(i + 1) % cams.length].deviceId);   // devices.js: stesso giro del menu dispositivi
    } finally {
      flipping = false;
      setTimeout(() => flipBtn.classList.remove('b183-spin'), 450);
    }
  }

  // ── pulsante flottante della chat ─────────────────────────────────────────
  function buildFab() {
    if ($('b183ChatFab')) return;
    fab = el('button', 'b183-fab', { type: 'button', id: 'b183ChatFab', 'data-tip': 'Chat della riunione', 'aria-label': 'Apri la chat' },
      `${SVG(ICO.chat, 22)}<span class="b183-fab-n hidden" translate="no"></span>`);
    fab.addEventListener('click', () => press('btnChat'));
    document.body.appendChild(fab);
    const badge = $('chatBadge'), panel = $('chatPanel');
    const n = fab.querySelector('.b183-fab-n');
    const sync = () => {
      const v = String(badge?.textContent || '').trim();
      const hid = !badge || badge.classList.contains('hidden') || !v || v === '0';
      n.classList.toggle('hidden', hid);
      n.textContent = hid ? '' : v;
      fab.setAttribute('aria-label', hid ? 'Apri la chat' : `${T('Apri la chat')}: ${v}`);
      const open = !!panel && !panel.classList.contains('hidden');
      fab.classList.toggle('b183-off', open);
      document.body.classList.toggle('b183-fab-on', PHONE.matches && !open);
    };
    if (badge) new MutationObserver(sync).observe(badge, { attributes: true, childList: true, characterData: true, subtree: true });
    if (panel) new MutationObserver(sync).observe(panel, { attributes: true, attributeFilter: ['class'] });
    PHONE.addEventListener?.('change', sync);
    sync();
  }

  // altezza occupata in basso dalla barra (per il pulsante della chat)
  function trackBarHeight() {
    const bar = document.querySelector('.controls-bar');
    if (!bar) return;
    const set = () => document.documentElement.style.setProperty('--b183-bh', Math.max(0, Math.round(window.innerHeight - bar.getBoundingClientRect().top)) + 'px');
    set();
    if (window.ResizeObserver) new ResizeObserver(set).observe(bar);
    window.addEventListener('resize', set);
  }

  // la guida rapida, sul telefono, non può dire «con il ? in alto»: il ? sta in Altro
  function patchTour() {
    const tour = window.TdtTour;
    if (!tour || tour._b183) return;
    const start = tour.start.bind(tour);
    tour.start = (steps, opts) => start(!PHONE.matches ? steps : (steps || []).map(s => (s && /\? in alto/.test(s.text || ''))
      ? Object.assign({}, s, { text: 'Quando hai finito, esci da qui. Puoi rivedere questa guida da Altro, alla voce «Guida rapida ai comandi».' }) : s), opts);
    tour._b183 = true;
  }

  // scorciatoie sul telefono (con una tastiera collegata): tooltip.js preme solo
  // i tasti visibili; quelli che sul telefono stanno in Altro (C, U, S, D…) si
  // premono da qui, se tooltip.js non ha già fatto nulla
  function bindKeys() {
    document.addEventListener('keydown', (e) => {
      if (!PHONE.matches || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (document.querySelector('.tdt-tour.on') || document.getElementById('guestWaitOverlay')) return;
      const pj = $('prejoinScreen'), ld = $('loadingScreen');
      if ((pj && !pj.classList.contains('hidden')) || (ld && !ld.classList.contains('hidden'))) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : '';
      if (!k) return;
      const b = [...document.querySelectorAll(`.controls-bar [data-key="${CSS.escape(k)}"]`)]
        .find(x => !x.disabled && !x.classList.contains('hidden') && !x.classList.contains('unsupported'));
      if (b) { e.preventDefault(); b.click(); }
    });
  }

  // ── avvio ────────────────────────────────────────────────────────────────
  function boot() {
    if (document.body.classList.contains('b183')) return;
    document.body.classList.add('b183');
    buildMenu();
    buildTop();
    placeLanguage();
    buildFab();
    trackBarHeight();
    patchTour();
    bindKeys();
    PHONE.addEventListener?.('change', () => { window.closeMoreMenu?.(); placeLanguage(); });
  }
  window.TdtBar183 = { syncProxies };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
