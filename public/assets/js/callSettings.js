'use strict';

/**
 * Impostazioni della chiamata — finestra a sezioni (stile MiroTalk SFU):
 *   Audio e video · Stanza (organizzatori) · Registrazione · Aspetto ·
 *   Scorciatoie · Info.
 * Si apre dall'ingranaggio in alto o dal menu ⋮. Le preferenze personali
 * restano nel browser (localStorage); le regole della stanza vanno al server
 * con l'evento 'roomRules' e valgono per tutti finché la stanza è aperta.
 */
(function () {
  let modal = null, socket = null, section = 'av', rules = null;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const T = (s) => (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t(s) : s;
  const isHost = () => !!window.__isHostRole;
  const ls = { get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (_) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) { } } };
  const ROOM_ID = window.location.pathname.split('/').pop();
  const ICO = {
    av: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/></svg>',
    room: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M2 21h20M16 11h4v10"/><circle cx="12" cy="12" r="1"/></svg>',
    rec: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>',
    look: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg>',
    keys: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/></svg>',
    info: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M12 11v5.5M12 7.6h.01" stroke-width="2.2"/></svg>',
  };
  const SECTIONS = () => [
    ['av', 'Audio e video'], ...(isHost() ? [['room', 'Stanza']] : []), ['rec', 'Registrazione'], ['look', 'Aspetto'], ['keys', 'Scorciatoie'], ['info', 'Info'],
  ];
  const sw = (id, label, on, hint) => `<label class="cs-switch"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span class="dp-track"></span><span class="cs-sw-txt"><span>${label}</span>${hint ? `<small>${hint}</small>` : ''}</span></label>`;

  function build() {
    modal = document.createElement('div');
    modal.className = 'cs-modal hidden';
    modal.innerHTML = `
      <div class="cs-box" role="dialog" aria-modal="true">
        <aside class="cs-nav">
          <div class="cs-nav-title">Impostazioni</div>
          <div class="cs-nav-list"></div>
        </aside>
        <div class="cs-main">
          <div class="cs-head"><h3 class="cs-title"></h3><button type="button" class="cs-x" aria-label="Chiudi">×</button></div>
          <div class="cs-body"></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    modal.querySelector('.cs-x').addEventListener('click', close);
    modal.querySelector('.cs-nav-list').addEventListener('click', (e) => { const b = e.target.closest('[data-sec]'); if (b) show(b.dataset.sec); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) { e.stopPropagation(); close(); } }, true);
    // le scorciatoie della stanza (m, v, c…) non devono scattare scrivendo nel pannello
    modal.addEventListener('keydown', (e) => e.stopPropagation());
  }

  function renderNav() {
    const list = modal.querySelector('.cs-nav-list');
    list.innerHTML = SECTIONS().map(([id, label]) => `<button type="button" class="cs-nav-item ${id === section ? 'on' : ''}" data-sec="${id}"><span class="cs-nav-ico">${ICO[id]}</span><span>${label}</span></button>`).join('');
    // su mobile la barra è orizzontale: porta in vista la voce attiva
    list.querySelector('.on')?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }

  function show(id) {
    if (!SECTIONS().some(s => s[0] === id)) id = 'av';
    section = id;
    renderNav();
    modal.querySelector('.cs-title').textContent = T(SECTIONS().find(s => s[0] === id)[1]);
    const body = modal.querySelector('.cs-body');
    body.scrollTop = 0;
    ({ av: renderAv, room: renderRoom, rec: renderRec, look: renderLook, keys: renderKeys, info: renderInfo })[id](body);
  }

  // ── Audio e video ────────────────────────────────────────────────────────
  async function renderAv(body) {
    const ds = window._deviceSelector;
    body.innerHTML = `<div class="cs-loading">Cerco i dispositivi…</div>`;
    try { await ds?._loadDevices(); } catch (_) { }
    const d = ds?.devices || { audioinput: [], videoinput: [], audiooutput: [] };
    const micId = window._localMicTrack?.getSettings?.()?.deviceId || '';
    const camId = window._localCamTrack?.getSettings?.()?.deviceId || '';
    const spkId = window._tdmeetSpeakerId || '';
    const opts = (list, cur, fallback) => list.length ? list.map((x, i) => `<option value="${esc(x.deviceId)}" ${x.deviceId === cur ? 'selected' : ''}>${esc(x.label || fallback + ' ' + (i + 1))}</option>`).join('') : `<option value="">${T('Nessun dispositivo')}</option>`;
    const canSink = typeof document.createElement('audio').setSinkId === 'function';
    const agcOn = !!window._tdmeetAgc?.();
    const rnnOk = !!window.TdtNoise?.supported?.();
    const rnnOn = !!(window.TdtNoise?.enabled || window.TdtNoise?.wanted?.());
    body.innerHTML = `
      <div class="cs-group">
        <div class="cs-field"><label for="csMic">Microfono</label><select id="csMic" class="cs-select">${opts(d.audioinput, micId, T('Microfono'))}</select></div>
        <div class="cs-meter-row"><span class="dp-lbl">Livello</span><div class="dp-meter"><i id="csMicBar"></i></div></div>
        <div class="cs-field"><label for="csCam">Videocamera</label><select id="csCam" class="cs-select">${opts(d.videoinput, camId, T('Videocamera'))}</select></div>
        <div class="cs-field"><label for="csSpk">Altoparlanti</label><select id="csSpk" class="cs-select" ${canSink ? '' : 'disabled'}>${opts(d.audiooutput, spkId, T('Altoparlanti'))}</select>${canSink ? '' : `<small class="cs-hint">${T('Questo browser non permette di scegliere l\'uscita audio: usa le impostazioni di sistema.')}</small>`}</div>
      </div>
      <div class="cs-group">
        ${sw('csAgc', T('Volume del microfono automatico'), agcOn, T('Se il volume d\'ingresso si abbassa da solo durante le chiamate, spegnilo.'))}
        ${rnnOk ? sw('csRnn', T('Riduzione rumore avanzata (RNNoise)'), rnnOn, T('Toglie tastiera, ventole e traffico con una rete neurale che gira nel browser.')) : ''}
        ${sw('csMirror', T('Specchia il mio video'), ls.get('tdt_mirror', '1') !== '0', T('Solo per te: gli altri ti vedono sempre nel verso giusto.'))}
      </div>`;
    const bind = (id, type) => body.querySelector(id)?.addEventListener('change', (e) => { if (e.target.value) ds?._switch(type, e.target.value); });
    bind('#csMic', 'audioinput'); bind('#csCam', 'videoinput'); bind('#csSpk', 'audiooutput');
    body.querySelector('#csAgc').addEventListener('change', (e) => ds?.setAgc(e.target.checked));
    body.querySelector('#csRnn')?.addEventListener('change', async (e) => { e.target.disabled = true; try { await ds?.setRnn(e.target.checked); } catch (_) { e.target.checked = false; } finally { e.target.disabled = false; } });
    body.querySelector('#csMirror').addEventListener('change', (e) => {
      ls.set('tdt_mirror', e.target.checked ? '1' : '0');
      const v = document.querySelector('#video-local video, .video-tile.local video'); if (v) v.style.transform = e.target.checked ? 'scaleX(-1)' : 'none';
    });
    startMicMeter(body);
  }
  let meterStop = null;
  function startMicMeter(body) {
    stopMicMeter();
    const track = window._localMicTrack; const bar = body.querySelector('#csMicBar');
    if (!track || track.readyState !== 'live' || !bar) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(new MediaStream([track]));
      const an = ctx.createAnalyser(); an.fftSize = 512; src.connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      const t = setInterval(() => { an.getByteTimeDomainData(buf); let m = 0; for (const x of buf) m = Math.max(m, Math.abs(x - 128)); bar.style.width = Math.min(100, Math.round(m / 128 * 220)) + '%'; }, 80);
      meterStop = () => { clearInterval(t); try { src.disconnect(); ctx.close(); } catch (_) { } };
    } catch (_) { }
  }
  function stopMicMeter() { if (meterStop) { meterStop(); meterStop = null; } }

  // ── Stanza (solo organizzatori) ──────────────────────────────────────────
  function renderRoom(body) {
    const r = rules || window._tdRoomRules || {};
    const waiting = window.TdtLobby?.waiting?.length || 0;
    body.innerHTML = `
      <div class="cs-group">
        <div class="cs-group-title">Ingresso</div>
        ${sw('csWait', T('Sala d\'attesa'), r.waitingRoom !== false, T('Gli ospiti entrano solo quando un organizzatore li ammette. Gli utenti registrati entrano sempre.'))}
        ${waiting ? `<button type="button" class="cs-btn cs-btn-accent" id="csShowLobby">🚪 ${T('{0} in attesa: mostra le richieste').replace('{0}', waiting)}</button>` : ''}
        ${sw('csLock', T('Blocca la stanza'), !!r.locked, T('Nessun nuovo ospite può entrare, nemmeno col link. Chi è già dentro resta.'))}
      </div>
      <div class="cs-group">
        <div class="cs-group-title">Permessi degli ospiti</div>
        ${sw('csGss', T('Possono condividere lo schermo'), r.guestScreenShare !== false)}
        ${sw('csAnn', T('Tutti possono disegnare sullo schermo condiviso'), !!r.annotateAll, T('Spento: disegnano solo chi presenta e gli organizzatori.'))}
      </div>
      <div class="cs-group">
        <div class="cs-group-title">Moderazione</div>
        <div class="cs-row">
          <button type="button" class="cs-btn" id="csMuteAll">🔇 <span>Silenzia tutti</span></button>
          <button type="button" class="cs-btn" id="csInvite">🔗 <span>Copia link d'invito</span></button>
        </div>
        <small class="cs-hint">${T('Per rimuovere una persona apri Persone e usa la × accanto al nome.')}</small>
      </div>
      <small class="cs-hint cs-hint-foot">${T('Queste regole valgono solo per questa riunione. I valori di partenza si cambiano in Impostazioni → Riunioni.')}</small>`;
    const send = (data, el) => { el.disabled = true; socket?.emit('roomRules', data, (res) => { el.disabled = false; if (res?.error) { window.showToast?.(res.error, 2500); renderRoom(body); } else if (res?.rules) { rules = res.rules; window._tdRoomRules = res.rules; } }); };
    body.querySelector('#csWait').addEventListener('change', (e) => send({ waitingRoom: e.target.checked }, e.target));
    body.querySelector('#csLock').addEventListener('change', (e) => send({ locked: e.target.checked }, e.target));
    body.querySelector('#csGss').addEventListener('change', (e) => send({ guestScreenShare: e.target.checked }, e.target));
    body.querySelector('#csAnn').addEventListener('change', (e) => send({ annotateAll: e.target.checked }, e.target));
    body.querySelector('#csShowLobby')?.addEventListener('click', () => { close(); window.TdtLobby?.show(); });
    body.querySelector('#csMuteAll').addEventListener('click', (e) => {
      if (!confirm(T('Silenziare il microfono di tutti i partecipanti?'))) return;
      e.currentTarget.disabled = true;
      socket?.emit('muteAll', {}, (res) => { e.target.closest('button').disabled = false; window.showToast?.(res?.error || T('Tutti silenziati'), 2500); });
    });
    body.querySelector('#csInvite').addEventListener('click', () => { close(); document.getElementById('btnCopyLink')?.click(); });
  }

  // ── Registrazione ────────────────────────────────────────────────────────
  function renderRec(body) {
    const cur = parseInt(ls.get('tdt_rec_bps', '2500000')) || 2500000;
    const Q = [[1200000, 'Leggera (1,2 Mbps)', 'file piccoli, va bene per parlato e slide'], [2500000, 'Standard (2,5 Mbps)', 'buon compromesso (consigliata)'], [5000000, 'Alta (5 Mbps)', 'video nitido, file circa doppi'], [8000000, 'Massima (8 Mbps)', 'per demo con molto movimento']];
    body.innerHTML = `
      <div class="cs-group">
        <div class="cs-group-title">Qualità video</div>
        <div class="cs-radio-list">${Q.map(([v, l, h]) => `<label class="cs-radio"><input type="radio" name="csRecQ" value="${v}" ${v === cur ? 'checked' : ''}><span class="cs-radio-dot"></span><span class="cs-sw-txt"><span>${T(l)}</span><small>${T(h)}</small></span></label>`).join('')}</div>
        <small class="cs-hint">${T('Vale dalla prossima registrazione. Audio sempre a 128 kbps.')}</small>
      </div>
      <div class="cs-group">
        <div class="cs-group-title">Come funziona</div>
        <ul class="cs-list">
          <li>${T('La registrazione avviene sul tuo computer: nulla viene caricato sul server.')}</li>
          <li>${T('Registra la vista che hai davanti (griglia o relatore, schermo condiviso compreso) con l\'audio di tutti.')}</li>
          <li>${T('Quando la fermi, il file .webm (o .mp4 su Safari) si scarica da solo.')}</li>
          <li>${T('Se chiudi la scheda mentre registri, il browser ti chiede conferma e il file viene salvato.')}</li>
        </ul>
        <button type="button" class="cs-btn cs-btn-accent" id="csRecGo">⏺ <span>Avvia / ferma registrazione</span></button>
      </div>`;
    body.querySelectorAll('input[name="csRecQ"]').forEach(r => r.addEventListener('change', () => { ls.set('tdt_rec_bps', r.value); window.showToast?.(T('Qualità registrazione salvata'), 2000); }));
    body.querySelector('#csRecGo').addEventListener('click', () => { close(); document.getElementById('btnRecord')?.click(); });
  }

  // ── Aspetto ──────────────────────────────────────────────────────────────
  function renderLook(body) {
    const theme = ls.get('tdt_theme', '') || 'auto';
    const spot = document.getElementById('videoGrid')?.dataset.spotlight === 'true';
    const langs = ['auto', 'it', 'en', 'fr', 'de'], langNames = { auto: 'Automatica (browser)', it: 'Italiano', en: 'English', fr: 'Français', de: 'Deutsch' };
    const lang = window.I18n?.preference || 'auto';
    body.innerHTML = `
      <div class="cs-group">
        <div class="cs-group-title">Tema</div>
        <div class="cs-seg" id="csTheme">
          <button type="button" data-v="dark" class="${theme === 'dark' ? 'on' : ''}">🌙 <span>Scuro</span></button>
          <button type="button" data-v="light" class="${theme === 'light' ? 'on' : ''}">☀️ <span>Chiaro</span></button>
          <button type="button" data-v="auto" class="${theme === 'auto' ? 'on' : ''}">🖥 <span>Come il sistema</span></button>
        </div>
      </div>
      <div class="cs-group">
        <div class="cs-group-title">Vista</div>
        <div class="cs-seg" id="csLayout">
          <button type="button" data-v="grid" class="${spot ? '' : 'on'}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8"/></svg><span>Griglia</span></button>
          <button type="button" data-v="spot" class="${spot ? 'on' : ''}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="4" width="13" height="16" rx="2"/><rect x="18" y="4" width="3.5" height="4.5" rx="1"/><rect x="18" y="9.75" width="3.5" height="4.5" rx="1"/><rect x="18" y="15.5" width="3.5" height="4.5" rx="1"/></svg><span>Relatore</span></button>
        </div>
        ${sw('csDs', T('Risparmio dati'), !!window._tdDataSaver?.get(), T('Ricevi i video a bassa risoluzione: utile con connessioni lente o da telefono.'))}
      </div>
      <div class="cs-group">
        <div class="cs-group-title">Suoni e lingua</div>
        ${sw('csSnd', T('Suoni di notifica'), !window.sounds?.muted, T('Ingressi, uscite, chat e reazioni.'))}
        <div class="cs-field"><label for="csLang">Lingua</label><select id="csLang" class="cs-select">${langs.map(l => `<option value="${l}" ${l === lang ? 'selected' : ''}>${T(langNames[l])}</option>`).join('')}</select></div>
      </div>`;
    body.querySelector('#csTheme').addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      if (b.dataset.v === 'auto') { try { localStorage.removeItem('tdt_theme'); } catch (_) { } window.TdtTheme?.apply('auto', false); }
      else window.TdtTheme?.apply(b.dataset.v, true);
      renderLook(body);
    });
    body.querySelector('#csLayout').addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      const now = document.getElementById('videoGrid')?.dataset.spotlight === 'true';
      if ((b.dataset.v === 'spot') !== now) document.getElementById('btnLayout')?.click();
      renderLook(body);
    });
    body.querySelector('#csDs').addEventListener('change', () => window._tdDataSaver?.toggle());
    body.querySelector('#csSnd').addEventListener('change', () => document.getElementById('btnSoundToggle')?.click());
    body.querySelector('#csLang').addEventListener('change', (e) => { window.I18n?.setLanguage?.(e.target.value); show('look'); });
  }

  // ── Scorciatoie ──────────────────────────────────────────────────────────
  function renderKeys(body) {
    const K = [['M', 'Microfono on/off'], ['V', 'Videocamera on/off'], ['S', 'Condividi lo schermo'], ['D', 'Disegna sullo schermo condiviso'], ['H', 'Alza / abbassa la mano'], ['C', 'Apri / chiudi la chat'], ['U', 'Apri / chiudi Persone'], ['Spazio (tieni premuto)', 'Parla mentre sei muto (push-to-talk)'], ['Esc', 'Chiudi pannelli e finestre']];
    body.innerHTML = `<div class="cs-group"><table class="cs-keys">${K.map(([k, d]) => `<tr><td><kbd>${k}</kbd></td><td>${T(d)}</td></tr>`).join('')}</table><small class="cs-hint">${T('Le scorciatoie non scattano mentre scrivi in chat o in un campo di testo.')}</small></div>`;
  }

  // ── Info ─────────────────────────────────────────────────────────────────
  function renderInfo(body) {
    const B = window.__BRAND || {};
    const name = B.branding?.platformName || document.title.split('·').pop().trim();
    const link = `${location.origin}/room/${ROOM_ID}`;
    const n = (document.querySelectorAll('.video-tile:not(.screen-tile)').length) || 1;
    body.innerHTML = `
      <div class="cs-group cs-info">
        <div class="cs-info-row"><span>Riunione</span><b translate="no">${esc(ROOM_ID)}</b></div>
        <div class="cs-info-row"><span>Link</span><b translate="no" class="cs-link">${esc(link)}</b></div>
        <div class="cs-info-row"><span>Partecipanti</span><b>${n}</b></div>
        <div class="cs-info-row"><span>Tuo ruolo</span><b>${isHost() ? T('Organizzatore') : T('Ospite')}</b></div>
        <div class="cs-row"><button type="button" class="cs-btn cs-btn-accent" id="csCopy">🔗 <span>Copia link</span></button><button type="button" class="cs-btn" id="csNet">📶 <span>Qualità della connessione</span></button></div>
      </div>
      <div class="cs-group cs-info">
        <div class="cs-info-row"><span>Piattaforma</span><b translate="no">${esc(name)}</b></div>
        <div class="cs-info-row"><span>Versione</span><b translate="no">v${esc(B.version || '')}</b></div>
        ${B.info?.companyName ? `<div class="cs-info-row"><span>Gestita da</span><b translate="no">${esc(B.info.companyName)}</b></div>` : ''}
        ${B.sourceUrl ? `<div class="cs-info-row"><span>Sorgente</span><b><a href="${esc(B.sourceUrl)}" target="_blank" rel="noopener" translate="no">${esc(B.sourceUrl.replace(/^https?:\/\//, ''))}</a></b></div>` : ''}
      </div>`;
    body.querySelector('#csCopy').addEventListener('click', () => { close(); document.getElementById('btnCopyLink')?.click(); });
    body.querySelector('#csNet').addEventListener('click', () => { close(); document.getElementById('btnNetMon')?.click(); });
  }

  function open(sec) {
    if (!modal) build();
    document.getElementById('moreMenu')?.classList.add('hidden');
    modal.classList.remove('hidden');
    show(sec || section);
  }
  function close() { if (!modal) return; modal.classList.add('hidden'); stopMicMeter(); }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btnCallSettings')?.addEventListener('click', () => open());
    document.getElementById('btnSettingsHdr')?.addEventListener('click', () => open());
    document.addEventListener('tdt:devices', () => { if (modal && !modal.classList.contains('hidden') && section === 'av') show('av'); });
  });

  window.TdtCallSettings = {
    open, close, bind(s) { socket = s; },
    onRules(r) { if (!r) return; rules = r; if (modal && !modal.classList.contains('hidden') && section === 'room') show('room'); },
    get isOpen() { return !!modal && !modal.classList.contains('hidden'); },
  };
})();
