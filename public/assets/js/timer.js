'use strict';

/**
 * 1.8.0 — Timer della riunione (scheda «Timer» del pannello Attività + pillola).
 *   • Un organizzatore avvia un conto alla rovescia (1, 3, 5, 10, 15 minuti o
 *     una durata a scelta, titolo facoltativo); può metterlo in pausa, dare un
 *     minuto in più o annullarlo.
 *   • Tutti lo vedono in una pillola in alto al centro, sopra il video. La
 *     posizione si calcola dalle misure vere (griglia, schermo condiviso, badge
 *     REC): funziona con e senza la fascia in alto, non copre la fila di
 *     persone durante la presentazione e si sposta sotto il REC se serve.
 *   • Lo stato è sul server; qui si conta con l'orologio del server
 *     (TDTActivities.serverNow), così due computer con l'ora diversa vedono
 *     lo stesso numero. Chi entra tardi lo riceve con l'ingresso.
 *   • Alla fine (lo decide il server) suona — suoni di notifica di sounds.js,
 *     quindi niente suono se li hai spenti — e compare un avviso.
 * Server: timerStart / timerPause / timerResume / timerAdd / timerCancel → timerUpdate.
 */
(function () {
  const A = () => window.TDTActivities;
  const T = (s) => (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t(s) : s;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isHost = () => !!window.__isHostRole;
  const now = () => (A()?.serverNow ? A().serverNow() : Date.now());
  const svg = (d, w = 16, extra = '') => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
  const ICO = {
    pause: svg('<path d="M9 5.5v13M15 5.5v13"/>'),
    play: svg('<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke-width="1.6"/>'),
    plus1: '<span class="tmr-plus1" aria-hidden="true">+1</span>',
    x: svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'),
    clock: svg('<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2M9.5 2.8h5M12 2.8V6"/>', 18, 'stroke-width="1.8"'),
    bell: svg('<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>', 18, 'stroke-width="1.8"'),
  };
  const PRESETS = [1, 3, 5, 10, 15];
  const LS_DUR = 'tdt_timer_last';
  const R = 15.5, CIRC = 2 * Math.PI * R; // anello della pillola
  const R2 = 52, CIRC2 = 2 * Math.PI * R2; // anello grande nel pannello

  let timer = null;         // vista dal server: { id, title, durationMs, paused, endsAt, remainingMs, startedByName }
  let ended = null;         // { id, title, at } → avviso di fine in corso
  let endedTimer = 0, tick = 0, sec = null, socket = null, visible = false, lastShown = '';
  let chosenSec = 300;
  try { const v = parseInt(localStorage.getItem(LS_DUR), 10); if (v >= 5 && v <= 10800) chosenSec = v; } catch (_) { }

  // ── Suono di fine (aggiunto al SoundManager di sounds.js) ───────────────
  // Usa _play: rispetta «Suoni di notifica» spenti e l'uscita audio scelta.
  if (window.SoundManager && !window.SoundManager.prototype.timerEnd) {
    window.SoundManager.prototype.timerEnd = function () {
      const n = (f, d, v, delay) => ({ freq: f, dur: d, vol: v, delay });
      // due rintocchi a campanello, il secondo un po' più alto
      this._play([
        n(784, 0.18, 0.26), n(1175, 0.32, 0.18, 0.02),
        n(880, 0.18, 0.26, 0.42), n(1319, 0.45, 0.18, 0.44),
      ], 0.06);
    };
  }
  function ring() {
    try {
      const s = (typeof sounds !== 'undefined' && sounds) ? sounds : window.sounds; // eslint-disable-line no-undef
      s?.timerEnd?.();
    } catch (_) { }
  }

  // ── Tempo ───────────────────────────────────────────────────────────────
  function remainingMs() {
    if (!timer) return 0;
    return timer.paused ? Math.max(0, timer.remainingMs) : Math.max(0, timer.endsAt - now());
  }
  function fmt(ms) {
    const s = Math.ceil(Math.max(0, ms) / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    const p = (n) => String(n).padStart(2, '0');
    return h ? `${h}:${p(m)}:${p(ss)}` : `${p(m)}:${p(ss)}`;
  }
  function fmtDur(totalSec) {
    const m = Math.floor(totalSec / 60), s = totalSec % 60;
    if (!m) return `${s} s`;
    return s ? `${m} min ${s} s` : `${m} min`;
  }
  const spoken = (ms) => {
    const s = Math.ceil(ms / 1000), m = Math.floor(s / 60), r = s % 60;
    return m ? `${m} min ${r ? r + ' s' : ''}`.trim() : `${r} s`;
  };

  // ── Pillola in alto ─────────────────────────────────────────────────────
  let pill = null;
  function buildPill() {
    if (pill) return pill;
    pill = document.createElement('div');
    pill.id = 'tdtTimerPill';
    pill.className = 'tmr-pill hidden';
    pill.innerHTML = `
      <button type="button" class="tmr-main" id="tmrPillOpen" aria-label="Timer della riunione: apri le attività">
        <span class="tmr-ring" aria-hidden="true">
          <svg viewBox="0 0 36 36" width="30" height="30"><circle class="tmr-ring-bg" cx="18" cy="18" r="${R}"/><circle class="tmr-ring-fg" cx="18" cy="18" r="${R}" stroke-dasharray="${CIRC.toFixed(2)}" stroke-dashoffset="0"/></svg>
          <span class="tmr-ring-ico">${ICO.clock}</span>
        </span>
        <span class="tmr-txt">
          <span class="tmr-title" translate="no"></span>
          <span class="tmr-state"></span>
        </span>
        <span class="tmr-time" role="timer" aria-live="off">00:00</span>
      </button>
      <span class="tmr-ctrls"></span>
      <span class="tmr-sr" aria-live="polite"></span>`;
    document.body.appendChild(pill);
    pill.querySelector('#tmrPillOpen').addEventListener('click', () => A()?.open('timer'));
    window.addEventListener('resize', schedulePlace);
    window.addEventListener('orientationchange', schedulePlace);
    try {
      const ro = new ResizeObserver(schedulePlace);
      const g = document.getElementById('videoGrid'); if (g) ro.observe(g);
      ro.observe(document.body);
    } catch (_) { }
    try {
      const mo = new MutationObserver(schedulePlace);
      const g = document.getElementById('videoGrid');
      if (g) mo.observe(g, { attributes: true, attributeFilter: ['data-screen', 'data-spotlight', 'data-pinned', 'data-count'] });
      const rec = document.getElementById('recIndicator');
      if (rec) mo.observe(rec, { attributes: true, attributeFilter: ['class', 'style'] });
      mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    } catch (_) { }
    return pill;
  }

  function pillCtrls() {
    const c = pill.querySelector('.tmr-ctrls');
    const want = isHost() && timer && !ended ? (timer.paused ? 'p' : 'r') : (ended ? 'e' : '');
    if (c.dataset.mode === want) return;
    c.dataset.mode = want;
    if (want === 'e') {
      c.innerHTML = `<button type="button" class="tmr-btn" data-act="dismiss" data-tip="Chiudi l'avviso" aria-label="Chiudi l'avviso">${ICO.x}</button>`;
    } else if (want) {
      c.innerHTML = `
        <button type="button" class="tmr-btn" data-act="${timer.paused ? 'resume' : 'pause'}" data-tip="${timer.paused ? 'Riprendi il timer' : 'Metti in pausa'}" aria-label="${timer.paused ? 'Riprendi il timer' : 'Metti in pausa'}">${timer.paused ? ICO.play : ICO.pause}</button>
        <button type="button" class="tmr-btn" data-act="add" data-tip="Aggiungi un minuto" aria-label="Aggiungi un minuto">${ICO.plus1}</button>
        <button type="button" class="tmr-btn tmr-btn-x" data-act="cancel" data-tip="Annulla il timer per tutti" aria-label="Annulla il timer per tutti">${ICO.x}</button>`;
    } else c.innerHTML = '';
    c.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); act(b.dataset.act); }));
  }

  // Dove mettere la pillola: centrata sull'area del video (si stringe quando
  // c'è un pannello aperto), appena sotto il bordo alto della zona principale.
  // Con uno schermo condiviso si appoggia sullo schermo, SOTTO la fila di persone.
  let placeRaf = 0;
  function schedulePlace() { if (!pill || pill.classList.contains('hidden') || placeRaf) return; placeRaf = requestAnimationFrame(() => { placeRaf = 0; place(); }); }
  function place() {
    if (!pill) return;
    const grid = document.getElementById('videoGrid');
    let area = grid ? grid.getBoundingClientRect() : { left: 0, width: innerWidth, top: 60, right: innerWidth, bottom: innerHeight };
    let top = area.top + 10;
    if (grid) {
      const main = grid.querySelector('.video-tile.spotlight-main');
      if (main && main.offsetParent !== null) {
        const r = main.getBoundingClientRect();
        if (r.width > 120 && r.height > 80) { area = r; top = r.top + 10; }
      }
      // fila di persone sopra lo schermo: la pillola va sotto
      if (grid.dataset.screen === 'true') {
        const col = grid.querySelector('.spotlight-col');
        if (col && col.offsetParent !== null) { const cr = col.getBoundingClientRect(); if (cr.height) top = Math.max(top, cr.bottom + 8); }
      }
    }
    const pw = pill.offsetWidth || 220, ph = pill.offsetHeight || 40;
    let cx = area.left + area.width / 2;
    cx = Math.max(pw / 2 + 8, Math.min(cx, innerWidth - pw / 2 - 8));
    top = Math.max(top, 6 + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0));
    // badge REC e avvisi temporanei in alto (permessi, push-to-talk): se sono
    // sulla stessa traiettoria la pillola scende sotto, non ci finisce sopra
    // (anche l'etichetta «… presenta» sullo schermo condiviso, che sul telefono è sotto la pillola)
    const obst = [...document.querySelectorAll('#recIndicator.visible, .perm-notice.visible, .ptt-pill.visible, #videoGrid .presenter-chip')]
      .map(el => el.getBoundingClientRect()).filter(r => r.width && r.height).sort((a, b) => a.top - b.top);
    for (const rr of obst) {
      const overlapX = rr.right > cx - pw / 2 - 6 && rr.left < cx + pw / 2 + 6;
      const overlapY = rr.bottom > top - 6 && rr.top < top + ph + 6;
      if (overlapX && overlapY) top = rr.bottom + 8;
    }
    pill.style.left = Math.round(cx) + 'px';
    pill.style.top = Math.round(top) + 'px';
  }

  let placeIv = 0;
  function renderPill() {
    buildPill();
    const show = !!(timer || ended);
    if (show && !placeIv) placeIv = setInterval(place, 1000);
    if (!show && placeIv) { clearInterval(placeIv); placeIv = 0; }
    if (!show) {
      if (!pill.classList.contains('hidden')) { pill.classList.add('tmr-out'); setTimeout(() => { if (!timer && !ended) { pill.classList.add('hidden'); pill.classList.remove('tmr-out'); } }, 260); }
      return;
    }
    const wasHidden = pill.classList.contains('hidden');
    pill.classList.remove('hidden', 'tmr-out');
    const rem = remainingMs();
    const title = ended ? ended.title : timer.title;
    pill.classList.toggle('is-ended', !!ended);
    pill.classList.toggle('is-paused', !ended && !!timer?.paused);
    pill.classList.toggle('is-soon', !ended && rem <= 60000 && rem > 10000);
    pill.classList.toggle('is-final', !ended && rem <= 10000);
    pill.classList.toggle('has-title', !!title);
    pill.classList.toggle('is-host', isHost());
    pill.querySelector('.tmr-title').textContent = title || '';
    const st = pill.querySelector('.tmr-state');
    const stTxt = ended ? 'Tempo scaduto' : (timer.paused ? 'In pausa' : '');
    if (st.textContent !== stTxt) st.textContent = stTxt;
    pill.querySelector('.tmr-time').textContent = ended ? '00:00' : fmt(rem);
    pill.querySelector('.tmr-ring-ico').innerHTML = ended ? ICO.bell : ICO.clock;
    const frac = ended ? 0 : (timer.durationMs ? rem / timer.durationMs : 0);
    pill.querySelector('.tmr-ring-fg').setAttribute('stroke-dashoffset', (CIRC * (1 - Math.max(0, Math.min(1, frac)))).toFixed(2));
    pill.querySelector('#tmrPillOpen').setAttribute('aria-label', (ended ? T('Tempo scaduto') : T('Timer della riunione') + ': ' + spoken(rem) + (timer.paused ? ', ' + T('In pausa') : '')) + (title ? ' · ' + title : ''));
    pillCtrls();
    if (wasHidden) { pill.classList.remove('tmr-in'); void pill.offsetWidth; pill.classList.add('tmr-in'); }
    place();
  }

  // ── Scheda nel pannello Attività ────────────────────────────────────────
  let sec$ = null;
  function mount(sec) {
    sec$ = sec;
    if (!sec) return;
    sec.classList.add('tmr-sec');
    renderSec(true);
  }
  function renderSec(force) {
    if (!sec$) return;
    const mode = timer ? 'run' : (isHost() ? 'form' : 'idle');
    if (!force && sec$.dataset.mode === mode && mode !== 'run') return;
    if (mode === 'run' && sec$.dataset.mode === 'run' && sec$.dataset.tid === timer.id && sec$.dataset.host === String(isHost())) { updateSecLive(); return; }
    sec$.dataset.mode = mode;
    sec$.dataset.tid = timer?.id || '';
    sec$.dataset.host = String(isHost());
    if (mode === 'idle') {
      sec$.innerHTML = `
        <div class="act-empty">
          <div class="act-empty-ico" aria-hidden="true">${ICO.clock}</div>
          <div>Nessun timer in corso</div>
          <div class="act-hint">Gli organizzatori possono avviare un conto alla rovescia: lo vedrete tutti in alto, al centro.</div>
        </div>`;
      return;
    }
    if (mode === 'form') {
      const isPreset = PRESETS.includes(chosenSec / 60);
      sec$.innerHTML = `
        <form class="tmr-form" id="tmrForm" autocomplete="off" novalidate>
          <div class="act-lbl" id="tmrDurLbl">Durata</div>
          <div class="tmr-chips" role="radiogroup" aria-labelledby="tmrDurLbl">
            ${PRESETS.map(m => `<button type="button" class="tmr-chip${isPreset && chosenSec === m * 60 ? ' on' : ''}" role="radio" aria-checked="${isPreset && chosenSec === m * 60}" data-min="${m}"><b>${m}</b> <span>min</span></button>`).join('')}
            <button type="button" class="tmr-chip tmr-chip-custom${isPreset ? '' : ' on'}" role="radio" aria-checked="${!isPreset}" data-min="custom"><span>A scelta</span></button>
          </div>
          <div class="tmr-custom${isPreset ? ' hidden' : ''}" id="tmrCustom">
            <label class="tmr-num"><input type="number" id="tmrMin" inputmode="numeric" min="0" max="180" step="1" value="${Math.floor(chosenSec / 60)}" aria-label="Minuti"><span>min</span></label>
            <label class="tmr-num"><input type="number" id="tmrSec" inputmode="numeric" min="0" max="59" step="1" value="${chosenSec % 60}" aria-label="Secondi"><span>s</span></label>
          </div>
          <label class="act-lbl" for="tmrTitle">Titolo <span class="act-opt">(facoltativo)</span></label>
          <input type="text" class="act-input" id="tmrTitle" maxlength="60" placeholder="Es. Pausa caffè, Brainstorming…">
          <button type="submit" class="act-primary" id="tmrStart">${ICO.clock}<span>Avvia il timer</span></button>
          <div class="act-hint">Lo vedono tutti in alto, al centro. Alla fine suona per tutti (a chi ha i suoni di notifica accesi).</div>
        </form>`;
      const chips = [...sec$.querySelectorAll('.tmr-chip')];
      const custom = sec$.querySelector('#tmrCustom');
      chips.forEach(c => c.addEventListener('click', () => {
        chips.forEach(x => { x.classList.toggle('on', x === c); x.setAttribute('aria-checked', x === c ? 'true' : 'false'); });
        const isC = c.dataset.min === 'custom';
        custom.classList.toggle('hidden', !isC);
        if (isC) setTimeout(() => sec$.querySelector('#tmrMin')?.focus(), 30);
        else chosenSec = parseInt(c.dataset.min, 10) * 60;
      }));
      sec$.querySelector('#tmrForm').addEventListener('submit', (e) => { e.preventDefault(); start(); });
      return;
    }
    // timer in corso
    const host = isHost();
    sec$.innerHTML = `
      <div class="tmr-big" role="group" aria-label="Timer in corso">
        <div class="tmr-big-ring">
          <svg viewBox="0 0 120 120" aria-hidden="true"><circle class="tmr-ring-bg" cx="60" cy="60" r="${R2}"/><circle class="tmr-ring-fg" cx="60" cy="60" r="${R2}" stroke-dasharray="${CIRC2.toFixed(2)}" stroke-dashoffset="0"/></svg>
          <div class="tmr-big-in">
            <div class="tmr-big-time">00:00</div>
            <div class="tmr-big-state"></div>
          </div>
        </div>
        <div class="tmr-big-title" translate="no"></div>
        <div class="tmr-big-meta"><span>Avviato da</span> <span translate="no" class="tmr-by"></span> · <span class="tmr-dur"></span></div>
      </div>
      ${host ? `<div class="tmr-actions">
        <button type="button" class="act-btn" data-act="pp"></button>
        <button type="button" class="act-btn" data-act="add">${ICO.plus1}<span>Un minuto in più</span></button>
        <button type="button" class="act-btn act-btn-danger" data-act="cancel">${ICO.x}<span>Annulla</span></button>
      </div>` : `<div class="act-hint tmr-guest-hint">Lo gestiscono gli organizzatori. Alla fine sentirai un suono, se hai i suoni di notifica accesi.</div>`}`;
    sec$.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
      const a = b.dataset.act === 'pp' ? (timer?.paused ? 'resume' : 'pause') : b.dataset.act;
      act(a);
    }));
    updateSecLive(true);
  }
  function updateSecLive(full) {
    if (!sec$ || !timer || sec$.dataset.mode !== 'run') return;
    const rem = remainingMs();
    const q = (s) => sec$.querySelector(s);
    q('.tmr-big-time').textContent = fmt(rem);
    q('.tmr-big-state').textContent = timer.paused ? 'In pausa' : (rem <= 0 ? 'Tempo scaduto' : 'rimanenti');
    const frac = timer.durationMs ? rem / timer.durationMs : 0;
    q('.tmr-ring-fg').setAttribute('stroke-dashoffset', (CIRC2 * (1 - Math.max(0, Math.min(1, frac)))).toFixed(2));
    const big = q('.tmr-big');
    big.classList.toggle('is-paused', !!timer.paused);
    big.classList.toggle('is-soon', rem <= 60000 && rem > 10000);
    big.classList.toggle('is-final', rem <= 10000);
    if (full) {
      q('.tmr-big-title').textContent = timer.title || '';
      q('.tmr-big-title').classList.toggle('hidden', !timer.title);
      q('.tmr-by').textContent = timer.startedByName || '';
      q('.tmr-dur').textContent = fmtDur(Math.round(timer.durationMs / 1000));
      const pp = q('[data-act="pp"]');
      if (pp) pp.innerHTML = timer.paused ? `${ICO.play}<span>Riprendi</span>` : `${ICO.pause}<span>Pausa</span>`;
    }
  }

  // ── Azioni (solo organizzatori: il server lo ricontrolla) ───────────────
  function emit(ev, data, ok) {
    if (!socket) return;
    socket.emit(ev, data || {}, (r) => {
      if (r?.error) { window.showToast?.(r.error, 3000); return; }
      ok?.(r);
    });
  }
  function start() {
    let s = chosenSec;
    const custom = sec$?.querySelector('.tmr-chip-custom.on');
    if (custom) {
      const m = Math.max(0, Math.min(180, parseInt(sec$.querySelector('#tmrMin').value, 10) || 0));
      const ss = Math.max(0, Math.min(59, parseInt(sec$.querySelector('#tmrSec').value, 10) || 0));
      s = m * 60 + ss;
      if (s < 5) { window.showToast?.('Scegli una durata di almeno 5 secondi', 2600); return; }
      if (s > 10800) s = 10800;
    }
    chosenSec = s;
    try { localStorage.setItem(LS_DUR, String(s)); } catch (_) { }
    const title = (sec$?.querySelector('#tmrTitle')?.value || '').trim().slice(0, 60);
    const btn = sec$?.querySelector('#tmrStart'); if (btn) btn.disabled = true;
    socket?.emit('timerStart', { durationSec: s, title }, (r) => {
      if (btn) btn.disabled = false;
      if (r?.error) window.showToast?.(r.error, 3000);
    });
  }
  function act(a) {
    if (a === 'dismiss') { clearEnded(); return; }
    const map = { pause: 'timerPause', resume: 'timerResume', add: 'timerAdd', cancel: 'timerCancel' };
    if (!map[a]) return;
    emit(map[a], a === 'add' ? { sec: 60 } : {});
  }

  // ── Stato ───────────────────────────────────────────────────────────────
  function setTimer(t) {
    timer = t && typeof t === 'object' && t.id ? t : null;
    if (timer && !timer.paused && !Number.isFinite(timer.endsAt)) timer.endsAt = now() + (timer.remainingMs || 0);
    if (timer) clearEnded(true);
    loop();
    renderPill();
    renderSec();
  }
  function clearEnded(silent) {
    if (!ended) return;
    ended = null; clearTimeout(endedTimer);
    if (!silent) { renderPill(); }
  }
  function showEnded(info) {
    ended = { id: info?.id, title: info?.title || '', at: Date.now() };
    clearTimeout(endedTimer);
    endedTimer = setTimeout(() => clearEnded(), 12000);
    renderPill();
    const sr = pill?.querySelector('.tmr-sr');
    if (sr) sr.textContent = T('Tempo scaduto') + (ended.title ? ': ' + ended.title : '');
  }

  // Un solo intervallo, acceso solo mentre c'è un timer che corre
  function loop() {
    clearInterval(tick); tick = 0;
    if (!timer || timer.paused) return;
    tick = setInterval(() => {
      if (!timer) { clearInterval(tick); tick = 0; return; }
      const s = Math.ceil(remainingMs() / 1000);
      if (s === sec) return;
      sec = s;
      renderPill();
      if (visible) updateSecLive();
      // il server non ha (ancora) chiuso il timer dopo 3 s dallo zero: rete
      // assente → si chiude qui, senza suono (non sappiamo se è vero)
      if (s <= 0 && remainingMs() <= 0 && now() - timer.endsAt > 3000) { const t = timer; timer = null; showEnded(t); loop(); renderSec(); }
    }, 200);
  }

  function onUpdate(m) {
    if (!m) return;
    const prev = timer;
    const meId = socket?.id;
    if (m.action === 'end') {
      timer = null; loop();
      showEnded(m.ended || prev);
      renderSec(true);
      ring();
      const title = m.ended?.title || prev?.title || '';
      window.showToast?.('⏰ ' + T('Tempo scaduto') + (title ? ': ' + title : ''), 6000);
      return;
    }
    if (m.action === 'cancel') {
      timer = null; loop(); clearEnded(true);
      renderPill(); renderSec(true);
      if (m.bySid !== meId && m.by) window.showToast?.(T('Timer annullato da') + ' ' + m.by, 3000);
      return;
    }
    setTimer(m.timer);
    if (m.action === 'start' && m.bySid === meId) {
      // chi l'ha avviato vede la pillola apparire; il pannello passa al timer in corso
      renderSec(true);
    }
    if (m.action === 'pause' && m.bySid !== meId && m.by) window.showToast?.(T('Timer in pausa') + ' · ' + m.by, 2500);
  }

  // ── Registrazione nel pannello Attività ─────────────────────────────────
  const mod = {
    mount,
    show() { visible = true; renderSec(true); },
    hide() { visible = false; },
    refresh() { renderSec(true); renderPill(); },
    load(t) { setTimer(t || null); },
    bind(sock) {
      socket = sock;
      sock.on('timerUpdate', onUpdate);
    },
    badge() { return 0; },
  };
  window.addEventListener('tdt:clock', () => { if (timer) { renderPill(); if (visible) updateSecLive(); } });
  window.addEventListener('languagechange', () => { if (pill && !pill.classList.contains('hidden')) renderPill(); });
  window.TdtTimer = { get state() { return timer ? { ...timer, remainingMs: remainingMs() } : null; }, get ended() { return ended; }, place, fmt };
  if (window.TDTActivities) window.TDTActivities.register('timer', mod);
  else window.addEventListener('DOMContentLoaded', () => window.TDTActivities?.register('timer', mod), { once: true });
})();
