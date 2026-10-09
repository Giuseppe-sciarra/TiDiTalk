'use strict';

/**
 * Home — nuova riunione / entra con codice / recenti, con anteprima video.
 *   • I pannelli scorrono da destra a sinistra, la pill dei tab scivola.
 *   • Il codice stanza si aggiorna mentre scrivi (stessa regola del server).
 *   • Microfono e videocamera "all'ingresso" finiscono nel prejoin tramite
 *     sessionStorage (tdt_home_pref); l'anteprima usa solo la videocamera.
 *   • Recenti: GET /api/rooms/recent (registro server), un tocco per rientrare.
 */
(function () {
  const $ = (s) => document.querySelector(s);
  const T = (s) => (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t(s) : s;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nameIn = $('#roomNameInput'), idIn = $('#roomIdInput');
  const pref = { mic: true, cam: true };
  let stream = null, tab = 'new';

  // ── animazione d'ingresso: da destra, a cascata ───────────────────────────
  function reveal(root, step = 70, from = 0) {
    const els = [...(root.matches('.hr') ? [root] : []), ...root.querySelectorAll('.hr')];
    els.forEach((e, i) => { e.classList.remove('in'); setTimeout(() => e.classList.add('in'), from + i * step); });
    return from + els.length * step;
  }

  // ── tab ───────────────────────────────────────────────────────────────────
  const tabs = $('#homeTabs'), pill = tabs.querySelector('.tabs-pill');
  const order = ['new', 'join', 'recent'];
  function movePill() {
    const b = tabs.querySelector(`[data-t="${tab}"]`); if (!b) return;
    pill.style.left = b.offsetLeft + 'px'; pill.style.width = b.offsetWidth + 'px';
  }
  function setTab(t, focus = true) {
    const prev = tab; tab = t;
    tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    movePill();
    document.querySelectorAll('.pane').forEach(p => {
      const id = p.id.replace('pane-', '');
      p.classList.toggle('on', id === t);
      p.classList.toggle('left', order.indexOf(id) < order.indexOf(t));
    });
    if (t === 'recent') loadRecent();
    if (focus && prev !== t) setTimeout(() => (t === 'new' ? nameIn : t === 'join' ? idIn : null)?.focus(), 350);
    try { localStorage.setItem('tdt_home_tab', t); } catch (_) { }
  }
  tabs.addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (b) setTab(b.dataset.t); });
  window.addEventListener('resize', movePill);
  document.fonts?.ready?.then(movePill);

  // ── nuova riunione ────────────────────────────────────────────────────────
  const codeOf = (v) => Tdt.roomCode(v) || 'NUOVA-RIUNIONE';
  nameIn.addEventListener('input', () => { const c = codeOf(nameIn.value); $('#roomPreview').textContent = c; $('#prevCode').textContent = c; });
  nameIn.addEventListener('keydown', e => { if (e.key === 'Enter') $('#btnNewRoom').click(); });
  $('#btnNewRoom').addEventListener('click', async () => {
    const roomName = Tdt.roomCode(nameIn.value);
    if (!roomName) { nameIn.focus(); Tdt.toast(T('Scrivi prima un nome per la riunione')); return; }
    const btn = $('#btnNewRoom');
    btn.disabled = true; btn.textContent = T('Creo la stanza…');
    try {
      const data = await Tdt.api('/api/room', { method: 'POST', body: JSON.stringify({ roomName }) });
      go(`/room/${data.roomId}`);
    } catch (e) {
      Tdt.toast(e.message);
      btn.disabled = false; btn.textContent = T('Crea ed entra');
    }
  });

  // ── entra con codice (accetta anche un link intero) ───────────────────────
  function codeFromInput(v) {
    v = String(v || '').trim();
    const m = v.match(/\/room\/([A-Za-z0-9-]+)/); if (m) v = m[1];
    return Tdt.roomCode(v) || v.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 32);
  }
  $('#btnJoinRoom').addEventListener('click', () => {
    const code = codeFromInput(idIn.value);
    if (!code) { idIn.focus(); return; }
    go(`/room/${code}`);
  });
  idIn.addEventListener('keydown', e => { if (e.key === 'Enter') $('#btnJoinRoom').click(); });
  idIn.addEventListener('paste', () => setTimeout(() => { const c = codeFromInput(idIn.value); if (c && /\/room\//.test(idIn.value)) idIn.value = c; }, 0));

  function go(url) {
    try { sessionStorage.setItem('tdt_home_pref', JSON.stringify(pref)); } catch (_) { }
    stopPreview();
    window.location.href = url;
  }

  // ── microfono / videocamera all'ingresso ─────────────────────────────────
  function syncToggles() {
    for (const [k, ids] of [['mic', ['togMic', 'prevMic']], ['cam', ['togCam', 'prevCam']]]) {
      ids.forEach(id => { const el = document.getElementById(id); el?.classList.toggle('on', pref[k]); el?.classList.toggle('off', !pref[k]); });
    }
    $('#togMic').dataset.tip = pref.mic ? T('Entrerai con il microfono acceso') : T('Entrerai con il microfono spento');
    $('#togCam').dataset.tip = pref.cam ? T('Entrerai con la videocamera accesa') : T('Entrerai con la videocamera spenta');
    const tile = $('#homeTile');
    tile.classList.toggle('cam-off', !pref.cam || !stream);
    if (stream) stream.getVideoTracks().forEach(t => t.enabled = pref.cam);
  }
  ['togMic', 'prevMic'].forEach(id => document.getElementById(id).addEventListener('click', () => { pref.mic = !pref.mic; syncToggles(); }));
  ['togCam', 'prevCam'].forEach(id => document.getElementById(id).addEventListener('click', () => { pref.cam = !pref.cam; syncToggles(); }));

  // ── anteprima video (solo videocamera, niente microfono) ─────────────────
  async function startPreview() {
    const v = $('#homeVideo'), note = $('#homeTileNote');
    if (!navigator.mediaDevices?.getUserMedia) { note.textContent = T('Anteprima non disponibile su questo browser'); note.classList.remove('hidden'); syncToggles(); return; }
    try {
      const vid = localStorage.getItem('vc_videoId');
      const c = { video: vid ? { deviceId: { ideal: vid }, width: { ideal: 1280 }, height: { ideal: 720 } } : { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false };
      stream = await navigator.mediaDevices.getUserMedia(c);
      v.srcObject = stream; v.play?.().catch(() => { });
      stream.getVideoTracks()[0]?.addEventListener('ended', () => { stream = null; syncToggles(); });
    } catch (e) {
      stream = null;
      note.textContent = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? T('Videocamera non consentita: potrai attivarla nella schermata successiva') : T('Nessuna videocamera trovata');
      note.classList.remove('hidden');
    }
    syncToggles();
  }
  function stopPreview() { try { stream?.getTracks().forEach(t => t.stop()); } catch (_) { } stream = null; }
  window.addEventListener('pagehide', stopPreview);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stopPreview(); syncToggles(); } else if (!stream) startPreview(); });

  // ── recenti ───────────────────────────────────────────────────────────────
  const fmtWhen = (ts) => {
    const d = new Date(ts * 1000), now = new Date(), loc = window.I18n?.locale || 'it';
    const sameDay = (a, b) => a.toDateString() === b.toDateString();
    const y = new Date(now); y.setDate(now.getDate() - 1);
    const time = d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
    if (sameDay(d, now)) return `${T('Oggi')} ${time}`;
    if (sameDay(d, y)) return `${T('Ieri')} ${time}`;
    return `${d.toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`;
  };
  const fmtDur = (s) => { s = Math.max(0, s | 0); if (s < 60) return `${s} s`; const m = Math.round(s / 60); if (m < 60) return `${m} min`; return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`; };
  let recentLoaded = false, recentBusy = false;
  async function loadRecent(force) {
    const box = $('#recentList');
    if ((recentLoaded && !force) || recentBusy) return;
    recentBusy = true;
    try {
      const list = await Tdt.api('/api/rooms/recent?limit=12');
      recentLoaded = true;
      const badge = $('#recentCount'); const live = list.filter(r => r.live).length;
      badge.textContent = live; badge.classList.toggle('hidden', !live);
      if (!list.length) { box.innerHTML = `<div class="recent-empty">${T('Nessuna riunione recente: le vedrai qui dopo la prima.')}</div>`; return; }
      box.innerHTML = list.map((r, i) => {
        const title = r.title || r.roomId.toLowerCase().replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const who = (r.participants || []).slice(0, 4).map(esc).join(', ') + ((r.participants || []).length > 4 ? ` +${r.participants.length - 4}` : '');
        return `<div class="rc hr" style="transition-delay:${i * 50}ms" data-room="${esc(r.roomId)}" data-id="${r.id}">
          <div class="rc-main">
            <b translate="no">${esc(title)}</b>
            <small><span translate="no">${fmtWhen(r.startedAt)}</span> · ${fmtDur(r.durationSec)} · ${r.peakPeers || 1} ${(r.peakPeers || 1) === 1 ? T('persona') : T('persone')}${r.live ? ` · <span class="rc-live">● ${T('in corso')}${r.liveCount ? ` (${r.liveCount})` : ''}</span>` : ''}</small>
            ${who ? `<small class="rc-who" translate="no">${who}</small>` : ''}
          </div>
          <button type="button" class="rc-x" data-act="hide" data-tip="Togli dall'elenco" aria-label="Togli">×</button>
          <button type="button" class="btn btn-sm rc-go" data-act="go">${r.live ? T('Rientra') : T('Riapri')}</button>
        </div>`;
      }).join('');
      requestAnimationFrame(() => box.querySelectorAll('.hr').forEach(e => e.classList.add('in')));
    } catch (e) {
      box.innerHTML = `<div class="recent-empty">${esc(e.message)}</div>`;
    } finally { recentBusy = false; }
  }
  $('#recentList').addEventListener('click', async (e) => {
    const card = e.target.closest('.rc'); if (!card) return;
    const act = e.target.closest('[data-act]')?.dataset.act || 'go';
    if (act === 'hide') {
      card.style.opacity = '.3';
      try { await Tdt.api(`/api/rooms/recent/${card.dataset.id}`, { method: 'DELETE' }); card.remove(); if (!$('#recentList').children.length) loadRecent(true); }
      catch (err) { card.style.opacity = ''; Tdt.toast(err.message); }
      return;
    }
    go(`/room/${card.dataset.room}`);
  });

  // ── avvio ─────────────────────────────────────────────────────────────────
  (async () => {
    const u = await Tdt.requireAuth(); if (!u) return;
    const ini = String(u.displayName || '?').trim().split(/\s+/).map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '?';
    document.querySelectorAll('[data-user-initials]').forEach(el => el.textContent = ini);
    // ?room=xxx (link dal CRM) → tab "Entra" precompilata
    const room = new URLSearchParams(window.location.search).get('room');
    let start = 'new';
    if (room) { idIn.value = room; start = 'join'; window.history.replaceState({}, '', window.location.pathname); }
    else { try { start = localStorage.getItem('tdt_home_tab') || 'new'; } catch (_) { } if (!order.includes(start)) start = 'new'; }
    setTab(start, false);
    document.querySelectorAll('.pane').forEach(p => p.classList.add('ready'));
    const t = reveal(document.querySelector('.home-left'), 80);
    reveal(document.querySelector('.home-right'), 0, Math.min(t, 420));
    setTimeout(() => (start === 'join' ? idIn : nameIn).focus({ preventScroll: true }), t + 100);
    if (start === 'recent') loadRecent();
    loadRecent(); // il badge "in corso" serve anche se la tab non è aperta
    startPreview();
  })();
})();
