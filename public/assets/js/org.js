'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   1.8.0 — Comandi degli organizzatori e ingresso "secondo schermo" (client)
   ───────────────────────────────────────────────────────────────────────────
   • 03 Termina per tutti: premendo Esci l'organizzatore sceglie «Esci solo tu»
     o «Termina la riunione per tutti» (server: endMeeting → meetingEnded)
   Il server controlla tutti i permessi (server/org.js): qui c'è solo l'interfaccia.
   room.js chiama window.TdtOrg con agganci di una riga.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  const T = (s) => (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t(s) : s;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  // stato di room.js (variabili globali dello script principale)
  const recording = () => { try { return typeof isRecording !== 'undefined' && !!isRecording; } catch (_) { return false; } };
  const leaving = () => { try { return typeof _leaving !== 'undefined' && !!_leaving; } catch (_) { return false; } };
  const setLeaving = () => { try { _leaving = true; } catch (_) { } };
  async function saveRecording() {
    if (!recording()) return;
    try { await stopRecording(); } catch (_) { }
    await sleep(600); // lascia partire il download prima di cambiare pagina
  }

  let socket = null;
  let ended = false, ending = false;

  // ── 03 · Esci / Termina per tutti ─────────────────────────────────────────
  let dlg = null;
  function buildDialog() {
    dlg = document.createElement('div');
    dlg.id = 'orgLeaveModal';
    dlg.className = 'leave-modal org-leave hidden';
    dlg.innerHTML = `
      <div class="leave-card org-leave-card" role="dialog" aria-modal="true" aria-labelledby="orgLeaveTitle">
        <h3 id="orgLeaveTitle">Vuoi uscire dalla riunione?</h3>
        <p class="leave-sub org-leave-rec hidden">Stai registrando: la registrazione viene salvata sul tuo computer prima di uscire.</p>
        <div class="org-leave-opts">
          <button type="button" class="org-leave-opt" data-org="self">
            <span class="org-leave-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5M5 12h11"/></svg></span>
            <span class="org-leave-txt"><b>Esci solo tu</b><small>Gli altri restano nella riunione</small></span>
          </button>
          <button type="button" class="org-leave-opt org-leave-end" data-org="end">
            <span class="org-leave-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.7 13.3a16 16 0 0 0 3.4 2.6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3.6 3.9a2 2 0 0 1 2-2.1h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.4 2.1L9.6 9.7" transform="rotate(135 12 12)"/></svg></span>
            <span class="org-leave-txt"><b>Termina la riunione per tutti</b><small>Escono tutti, anche chi è in sala d'attesa</small></span>
          </button>
        </div>
        <div class="leave-actions">
          <button type="button" class="leave-btn leave-btn-ghost" data-org="cancel">Resta</button>
        </div>
      </div>`;
    document.body.appendChild(dlg);
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) return closeDialog();
      const b = e.target.closest('[data-org]'); if (!b || b.disabled) return;
      if (b.dataset.org === 'cancel') closeDialog();
      else if (b.dataset.org === 'self') leaveSelf();
      else if (b.dataset.org === 'end') endForAll(b);
    });
    dlg.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDialog(); });
  }
  function openDialog() {
    if (!dlg) buildDialog();
    dlg.querySelectorAll('button').forEach(b => { b.disabled = false; });
    dlg.querySelector('.org-leave-end b').textContent = T('Termina la riunione per tutti');
    dlg.querySelector('.org-leave-rec').classList.toggle('hidden', !recording());
    dlg.classList.remove('hidden');
    requestAnimationFrame(() => dlg.classList.add('visible'));
    dlg.querySelector('[data-org="self"]').focus();
  }
  function closeDialog() {
    if (!dlg) return;
    dlg.classList.remove('visible');
    setTimeout(() => dlg.classList.add('hidden'), 180);
    document.getElementById('btnLeave')?.focus();
  }
  async function leaveSelf() {
    if (leaving()) return;
    setLeaving();
    dlg.querySelectorAll('button').forEach(b => { b.disabled = true; });
    await saveRecording();
    _leaveNow();
  }
  function endForAll(btn) {
    if (leaving() || !socket) return;
    dlg.querySelectorAll('button').forEach(b => { b.disabled = true; });
    btn.querySelector('b').textContent = T('Chiudo la riunione…');
    ending = true; // l'avviso 'meetingEnded' arriva anche a chi l'ha chiusa (prima della risposta)
    socket.emit('endMeeting', {}, async (r) => {
      if (!r || r.error) {
        ending = false;
        dlg.querySelectorAll('button').forEach(b => { b.disabled = false; });
        btn.querySelector('b').textContent = T('Termina la riunione per tutti');
        window.showToast?.(T(r?.error || 'Non è stato possibile terminare la riunione'), 3000);
        return;
      }
      ended = true;
      setLeaving();
      await saveRecording();
      _leaveNow();
    });
  }
  // true = il clic su Esci è gestito qui (solo per gli organizzatori)
  function onLeaveClick() {
    if (!window.__isHostRole) return false;
    if (!leaving()) openDialog();
    return true;
  }

  // la riunione è stata chiusa da un organizzatore: tutti alla pagina di fine chiamata
  async function onMeetingEnded(d) {
    if (ended || ending || leaving()) return; // chi l'ha chiusa (o chi sta uscendo) è già a posto
    ended = true;
    const by = String(d?.by || '').slice(0, 60) || T('L\'organizzatore');
    // ancora in sala d'attesa (o mai entrato): avviso e basta
    if (document.getElementById('guestWaitOverlay') || !window.__tdJoined) {
      showGuestStopScreen('La riunione è terminata', T('{0} ha chiuso la riunione per tutti.').replace('{0}', by));
      return;
    }
    setLeaving();
    try { document.getElementById('orgLeaveModal')?.remove(); document.getElementById('leaveModal')?.remove(); } catch (_) { }
    const o = document.createElement('div');
    o.id = 'leavingOverlay'; // _leaveNow non ne aggiunge un secondo
    o.className = 'leaving-overlay org-ended';
    o.innerHTML = '<div class="org-ended-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.7 13.3a16 16 0 0 0 3.4 2.6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3.6 3.9a2 2 0 0 1 2-2.1h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.4 2.1L9.6 9.7" transform="rotate(135 12 12)"/></svg></div><div class="org-ended-title"></div><div class="leaving-text"></div>';
    o.querySelector('.org-ended-title').textContent = T('La riunione è terminata');
    o.querySelector('.leaving-text').textContent = T('{0} ha chiuso la riunione per tutti.').replace('{0}', by);
    o.setAttribute('translate', 'no');
    document.body.appendChild(o);
    document.getElementById('btnLeave')?.setAttribute('disabled', '');
    const t0 = Date.now();
    await saveRecording();
    await sleep(Math.max(0, 1600 - (Date.now() - t0))); // il tempo di leggere l'avviso
    _leaveNow();
  }

  // ── 05 · Messaggio a chi aspetta ──────────────────────────────────────────
  // Organizzatore: nella scheda «Persone che vogliono entrare» (lobby.js) un
  // campo per scrivere a chi aspetta, con tre risposte rapide.
  const QUICK = ['Arrivo tra 2 minuti', 'Vi faccio entrare tra poco', 'Stiamo per cominciare'];
  const MSG_MAX = 200;
  function lobbyCard(card) {
    const box = document.createElement('div');
    box.className = 'org-lmsg';
    box.innerHTML = `
      <div class="org-lmsg-quick" role="group" aria-label="Risposte rapide">
        ${QUICK.map(q => `<button type="button" class="org-lmsg-chip" data-q="${esc(q)}">${esc(q)}</button>`).join('')}
      </div>
      <form class="org-lmsg-form">
        <input type="text" class="org-lmsg-input" maxlength="${MSG_MAX}" placeholder="Scrivi a chi aspetta…" aria-label="Messaggio a chi aspetta" autocomplete="off" />
        <button type="submit" class="org-lmsg-send" data-tip="Invia a chi aspetta" aria-label="Invia a chi aspetta"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 3L10 14"/><path d="M21 3l-6.5 18-4.5-7-7-4.5z"/></svg></button>
      </form>
      <div class="org-lmsg-sent hidden" aria-live="polite"></div>`;
    card.querySelector('.lobby-all')?.before(box);
    const input = box.querySelector('.org-lmsg-input'), sent = box.querySelector('.org-lmsg-sent');
    const send = (text) => {
      text = String(text || '').trim().slice(0, MSG_MAX);
      if (!text || !socket) { input.focus(); return; }
      box.querySelectorAll('button').forEach(b => { b.disabled = true; });
      socket.emit('lobbyMessage', { text }, (r) => {
        box.querySelectorAll('button').forEach(b => { b.disabled = false; });
        if (!r || r.error) { window.showToast?.(T(r?.error || 'Messaggio non inviato'), 2500); return; }
        input.value = '';
        sent.textContent = T('Inviato: «{0}»').replace('{0}', () => text);
        sent.classList.remove('hidden');
      });
    };
    box.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); send(input.value); });
    box.addEventListener('click', (e) => { const c = e.target.closest('[data-q]'); if (c) send(T(c.dataset.q)); });
    // tasti nella scheda: non devono finire nelle scorciatoie della stanza (M, V, …)
    input.addEventListener('keydown', (e) => e.stopPropagation());
  }

  // Ospite in sala d'attesa: «Sei il 2° in attesa» e il messaggio dell'organizzatore
  let lastInfo = null;
  function waitBox() {
    const card = document.querySelector('#guestWaitOverlay .gw-card');
    if (!card) return null;
    let b = card.querySelector('.org-wait');
    if (!b) {
      b = document.createElement('div');
      b.className = 'org-wait';
      b.innerHTML = '<div class="org-wait-pos hidden"></div><div class="org-wait-msg hidden" role="status" aria-live="polite"><span class="org-wait-from"></span><span class="org-wait-text" translate="no"></span></div>';
      card.querySelector('#gwBtnLeave')?.before(b);
    }
    return b;
  }
  function paintWait() {
    const b = waitBox(); if (!b) return;
    const admit = (document.getElementById('gwTitle')?.dataset.mode || '') === 'admit';
    const pos = b.querySelector('.org-wait-pos'), msg = b.querySelector('.org-wait-msg');
    const i = lastInfo;
    const n = i && Number.isInteger(i.position) && i.position > 0 ? i.position : 0;
    pos.classList.toggle('hidden', !(admit && n));
    if (admit && n) pos.textContent = n === 1 ? T('Sei il primo in attesa') : T('Sei il {0}° in attesa').replace('{0}', n);
    const m = i && i.message && i.message.text ? i.message : null;
    msg.classList.toggle('hidden', !(admit && m));
    if (admit && m) {
      msg.querySelector('.org-wait-from').textContent = T('{0} ti scrive').replace('{0}', () => String(m.byName || '').slice(0, 60) || T('L\'organizzatore'));
      const changed = msg.querySelector('.org-wait-text').textContent !== m.text;
      msg.querySelector('.org-wait-text').textContent = m.text;
      if (changed) { msg.classList.remove('org-wait-new'); void msg.offsetWidth; msg.classList.add('org-wait-new'); try { window.sounds?.chat?.(); } catch (_) { } }
    }
  }
  function onWait(mode) {
    const t = document.getElementById('gwTitle');
    if (t) t.dataset.mode = mode;
    paintWait();
  }
  function onLobbyInfo(d) {
    if (!d || typeof d !== 'object') return;
    lastInfo = {
      position: +d.position || 0, total: +d.total || 0,
      message: d.message && typeof d.message.text === 'string' ? { text: d.message.text.slice(0, MSG_MAX), byName: String(d.message.byName || '') } : null,
    };
    paintWait();
  }

  // ── 09 · Secondo schermo ─────────────────────────────────────────────────
  // Entrato dal pre-ingresso senza microfono, casse né videocamera: restano
  // chat, sondaggi, mano, reazioni e Presenta. Gli altri non hanno il suo
  // riquadro (room.js: peerJoined). «Passa all'audio» lo rende un partecipante
  // normale senza rientrare. Il server rifiuta comunque mic e camera (server/org.js).
  const isSS = () => !!window._tdSecondScreen;
  const SS_ICO = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="4" width="13" height="9.5" rx="1.6"/><path d="M6 17h6M9 13.5V17"/><rect x="17" y="8" width="4.5" height="12" rx="1.2"/><path d="M19.25 17.2h.01"/></svg>';
  let ssBtn = null, ssToastAt = 0;
  function ssResult(name) {
    return { displayName: name, stream: null, micMuted: true, camOff: true, audioDeviceId: null, videoDeviceId: null, speakerDeviceId: null, secondScreen: true };
  }
  function ssApply() {
    document.body.classList.toggle('org-ss', isSS());
    ['btnMic', 'btnSpeaker', 'btnCamera'].forEach(id => document.getElementById(id)?.closest('.ctrl-btn-group')?.classList.toggle('org-ss-hide', isSS()));
    if (isSS()) {
      try { _setSpkMuted(true); } catch (_) { } // casse mute: in sala l'audio arriva da un altro dispositivo
      // niente riquadro proprio (non c'è né video né voce da mostrare)
      try { const lt = peerTiles.get('local'); if (lt) { lt.remove(); peerTiles.delete('local'); updateGridLayout(); } } catch (_) { }
      if (!ssBtn) {
        ssBtn = document.createElement('button');
        ssBtn.type = 'button';
        ssBtn.id = 'btnOrgAudio';
        ssBtn.className = 'ctrl-btn org-ss-audio';
        ssBtn.dataset.tip = 'Passa all\'audio: usa microfono, casse e videocamera da questo dispositivo';
        ssBtn.setAttribute('aria-label', 'Passa all\'audio');
        ssBtn.innerHTML = `<div class="ctrl-icon">${SS_ICO}</div><span class="ctrl-label org-ss-label">Passa all'audio</span>`;
        ssBtn.addEventListener('click', switchToAudio);
      }
      const cc = document.querySelector('.controls-bar .controls-center');
      if (cc && ssBtn.parentNode !== cc) cc.prepend(ssBtn);
    } else if (ssBtn) { ssBtn.remove(); }
    // 1.8.3: «Usa come secondo schermo» in Altro solo per chi non lo è già
    document.getElementById('btnOrgToSS')?.classList.toggle('hidden', isSS());
  }
  // 1.8.3 · da partecipante normale a secondo schermo, senza uscire e rientrare.
  // Il server chiude i producer di microfono e videocamera (lo schermo condiviso
  // resta) e avvisa gli altri; qui si spengono i dispositivi e si fa come se si
  // fosse entrati come secondo schermo: «Passa all'audio» riporta indietro.
  let toSSBusy = false;
  function switchToSecondScreen() {
    if (isSS() || !socket || toSSBusy) return;
    toSSBusy = true;
    socket.emit('setSecondScreen', { on: true }, (r) => {
      toSSBusy = false;
      if (!r || r.error) { window.showToast?.(T(r?.error || 'Non è stato possibile usarlo come secondo schermo'), 3000); return; }
      window._tdSecondScreen = true; // vale anche per il rientro dopo una caduta (room.js: _saveRejoin)
      ssStopMedia();
      ssApply();
      try { refreshParticipants(); } catch (_) { }
      window.showToast?.(T('Ora è un secondo schermo: microfono, casse e videocamera sono spenti. Per tornare premi «Passa all\'audio»'), 5000);
      try { ssBtn?.focus(); } catch (_) { }
    });
  }
  // spegne microfono e videocamera di questo dispositivo (i producer sul server
  // sono già chiusi: qui solo quelli locali, senza avvisare di nuovo)
  function ssStopMedia() {
    ['audio', 'video'].forEach(k => { const p = producers.get(k); if (p) { try { p.close(); } catch (_) { } producers.delete(k); } });
    try { _camAutoStop(); } catch (_) { }
    try { stopMuteWarningDetection(); hideMuteWarning(); } catch (_) { }
    try { faceEffects?.setPaused?.(true); backgroundEffect?.setPaused?.(true); } catch (_) { }
    try { _stopCamSources(); } catch (_) { }
    const tracks = new Set([localMicTrack, localCamTrack, window._localMicTrack, window._localCamTrack, ...(rawCamStream?.getTracks?.() || [])]);
    tracks.forEach(t => { try { t && t.stop(); } catch (_) { } });
    // stesso stato di chi entra come secondo schermo (niente tracce): «Passa
    // all'audio» e poi i tasti le riaprono da zero (room.js: produceAudio/Video)
    rawCamStream = null; localMicTrack = null; localCamTrack = null;
    window._localMicTrack = null; window._localCamTrack = null;
    micMuted = true; camOff = true;
    const off = (id) => {
      document.getElementById(id)?.classList.add('off');
      document.querySelector(`#${id} .icon-on`)?.classList.add('hidden');
      document.querySelector(`#${id} .icon-off`)?.classList.remove('hidden');
    };
    off('btnMic'); off('btnCamera');
  }
  // true = il comando è bloccato perché questo è un secondo schermo
  function blockMedia(kind) {
    if (!isSS()) return false;
    if (Date.now() - ssToastAt > 2500) {
      ssToastAt = Date.now();
      window.showToast?.(T('Questo dispositivo è un secondo schermo: premi «Passa all\'audio» per usare microfono, casse e videocamera'), 4000);
    }
    if (ssBtn) { ssBtn.classList.remove('org-ss-nudge'); void ssBtn.offsetWidth; ssBtn.classList.add('org-ss-nudge'); }
    return true;
  }
  function switchToAudio() {
    if (!isSS() || !socket || ssBtn?.disabled) return;
    ssBtn.disabled = true;
    socket.emit('setSecondScreen', { on: false }, (r) => {
      if (ssBtn) ssBtn.disabled = false;
      if (!r || r.error) { window.showToast?.(T(r?.error || 'Non è stato possibile passare all\'audio'), 3000); return; }
      window._tdSecondScreen = false;
      ssApply();
      try { initLocalMedia(true, true); setTileMuted('local', true); } catch (_) { } // torna il proprio riquadro
      try { _setSpkMuted(false); } catch (_) { }
      try { refreshParticipants(); } catch (_) { }
      window.showToast?.(T('Ora senti gli altri. Accendi microfono e videocamera quando vuoi'), 3500);
      document.getElementById('btnMic')?.focus();
    });
  }
  // un altro partecipante è passato all'audio: ora ha il suo riquadro
  function onPeerSecondScreen(d) {
    if (!d || typeof d.peerId !== 'string') return;
    const p = peers.get(d.peerId);
    if (!p) return;
    // 1.8.3: è diventato un secondo schermo: via il suo riquadro
    if (d.on === true) {
      Object.assign(p, { secondScreen: true, audioMuted: true, videoOff: true });
      try {
        if (_spotlightPeer === d.peerId) _spotlightPeer = null;
        removeTile(d.peerId);
        peerStreams.delete(d.peerId);
        const iid = _remoteSpeakingIntervals.get(d.peerId);
        if (iid) { clearInterval(iid); _remoteSpeakingIntervals.delete(d.peerId); }
        refreshParticipants();
      } catch (_) { }
      return;
    }
    Object.assign(p, d.peer && typeof d.peer === 'object' ? { audioMuted: !!d.peer.audioMuted, videoOff: !!d.peer.videoOff, handRaised: !!d.peer.handRaised } : {}, { secondScreen: false });
    try {
      createTile(p.id, p.displayName);
      setTileMuted(p.id, p.audioMuted);
      if (p.handRaised) setTileHand(p.id, true);
      if (p.videoOff) setTileVideo(p.id, null, false);
      refreshParticipants();
    } catch (_) { }
  }
  // «Secondo schermo» accanto al nome nella lista Persone (prejoin.js:ParticipantList)
  const ssTag = () => `<span class="org-ss-tag">${esc(T('Secondo schermo'))}</span>`;
  if (window.ParticipantList) {
    const orig = window.ParticipantList.prototype.refresh;
    window.ParticipantList.prototype.refresh = function (peersMap) {
      orig.apply(this, arguments);
      try {
        const list = document.getElementById('participantsList'); if (!list) return;
        const mark = (id, on) => {
          const el = list.querySelector(`[data-peer-id="${CSS.escape(id)}"]`); if (!el) return;
          el.classList.toggle('org-ss-item', on);
          const info = el.querySelector('.participant-info');
          const tag = info?.querySelector(':scope > .org-ss-tag');
          if (on && info && !tag) info.querySelector('.participant-name')?.insertAdjacentHTML('afterend', ssTag());
          else if (!on && tag) tag.remove();
        };
        mark('local', isSS());
        peersMap?.forEach((p) => mark(p.id, !!p.secondScreen));
      } catch (_) { }
    };
  }

  // ── 16 · Pre-ingresso «Pronto a entrare?» ─────────────────────────────────
  // Il pre-ingresso resta quello di prejoin.js (dispositivi, prove, permessi):
  // qui solo il nome sull'anteprima, «Ci sono già …», le pillole senza
  // dispositivo e «Entra e presenta».
  const pj = (id) => document.getElementById(id);
  function listNames(names, count) {
    const n = names.length, more = Math.max(0, (count || n) - Math.min(n, 3));
    const shown = names.slice(0, 3);
    if (!n) return '';
    if (more > 0) return T('Ci sono già {0} e altre {1} persone').replace('{0}', () => shown.join(', ')).replace('{1}', more);
    if (n === 1) return T('C\'è già {0}').replace('{0}', () => shown[0]);
    return T('Ci sono già {0} e {1}').replace('{0}', () => shown.slice(0, -1).join(', ')).replace('{1}', () => shown[n - 1]);
  }
  let whoTimer = null;
  async function pollWho(roomId) {
    const box = pj('pjWho'); if (!box) return;
    if (pj('prejoinScreen')?.classList.contains('hidden')) { clearTimeout(whoTimer); return; }
    const gt = sessionStorage.getItem('tdmeet_guest_token');
    const at = localStorage.getItem('tdmeet_token');
    try {
      const r = await fetch('/api/room/' + encodeURIComponent(roomId) + '/who', { headers: gt ? { 'x-guest-token': gt } : (at ? { 'x-auth-token': at } : {}), cache: 'no-store' });
      if (r.status === 401 || r.status === 400) { box.classList.add('hidden'); return; } // link non valido: niente nomi, niente richieste
      if (r.ok) {
        const d = await r.json();
        const names = (Array.isArray(d.names) ? d.names : []).map(x => String(x).slice(0, 50)).filter(Boolean);
        const txt = names.length ? listNames(names, +d.count || names.length) : T('Non c\'è ancora nessuno');
        box.querySelector('.pj2-who-txt').textContent = txt;
        box.querySelector('.pj2-who-av').innerHTML = names.slice(0, 3).map(nm => `<i>${esc(nm.trim().split(/\s+/).map(w => w[0] || '').join('').toUpperCase().slice(0, 2))}</i>`).join('');
        box.classList.toggle('pj2-who-empty', !names.length);
        box.classList.remove('hidden');
      }
    } catch (_) { }
    clearTimeout(whoTimer);
    whoTimer = setTimeout(() => pollWho(roomId), 6000);
  }
  function syncPreviewName() {
    const v = (pj('pjName')?.value || '').trim();
    const el = pj('pjPreviewName'); if (el) el.textContent = v;
    const ai = pj('pjAvatarInitials'); if (ai && v) ai.textContent = v.split(/\s+/).map(w => w[0] || '').join('').toUpperCase().slice(0, 2);
  }
  // pillola senza dispositivi («Nessun microfono», «Nessuna videocamera»)
  function syncPills() {
    document.querySelectorAll('.pj2-pills .pj-pill').forEach(p => {
      const sel = p.querySelector('select'); if (!sel) return;
      p.classList.toggle('pj-pill-none', !sel.options.length);
      sel.disabled = !sel.options.length;
      const o = sel.options[sel.selectedIndex];
      p.title = o ? o.textContent : '';
    });
  }
  function prejoinSetup(roomId) {
    const name = pj('pjName');
    if (!name || name._tdOrg) return;
    name._tdOrg = true;
    name.addEventListener('input', syncPreviewName);
    syncPreviewName();
    ['pjAudioSelect', 'pjVideoSelect', 'pjSpeakerSelect'].forEach(id => {
      const s = pj(id); if (!s) return;
      s.addEventListener('change', syncPills);
      new MutationObserver(syncPills).observe(s, { childList: true });
    });
    syncPills();
    // «Entra e presenta»: lo schermo si sceglie ADESSO (serve il clic dell'utente),
    // poi si entra e la presentazione parte da sola (room.js usa _tdPendingScreen)
    const pres = pj('pjJoinPresent');
    if (pres) {
      if (!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)) pres.classList.add('hidden'); // telefoni e tablet
      pres.addEventListener('click', async () => {
        if (!(pj('pjName')?.value || '').trim()) { pj('pjName')?.focus(); return; }
        let st = null;
        try { st = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }); }
        catch (_) { window.showToast?.(T('Nessuno schermo scelto: puoi presentare anche dopo, dalla barra'), 3500); return; }
        window._tdPendingScreen = st;
        // se si chiude la condivisione prima di entrare, si entra e basta
        st.getVideoTracks()[0]?.addEventListener('ended', () => { if (window._tdPendingScreen === st) window._tdPendingScreen = null; });
        pj('pjJoinBtn')?.click();
      });
    }
    pollWho(roomId);
  }
  // dopo l'ingresso: presentazione scelta nel pre-ingresso
  async function startPendingScreen() {
    const st = window._tdPendingScreen;
    if (!st) return;
    if (st.getVideoTracks()[0]?.readyState !== 'live') { window._tdPendingScreen = null; return; }
    try { await produceScreen(); } catch (_) { }
    if (window._tdPendingScreen === st) { window._tdPendingScreen = null; try { st.getTracks().forEach(t => t.stop()); } catch (_) { } }
  }

  window.TdtOrg = {
    prejoinSetup,
    bind(sock) {
      socket = sock;
      sock.on('meetingEnded', onMeetingEnded);
      sock.on('lobbyInfo', onLobbyInfo);
      sock.on('peerSecondScreen', onPeerSecondScreen);
      const toSS = document.getElementById('btnOrgToSS');
      if (toSS && !toSS._tdOrg) { toSS._tdOrg = true; toSS.addEventListener('click', switchToSecondScreen); }
      ssApply();
    },
    afterJoin() { window.__tdJoined = true; ssApply(); setTimeout(startPendingScreen, 400); },
    ssResult,
    blockMedia,
    ssTag,
    onLeaveClick,
    lobbyCard,
    onWait,
    get ended() { return ended; },
  };
})();
