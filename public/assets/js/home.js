'use strict';

/**
 * Home — nuova riunione / pianifica / entra con codice / recenti, con il
 * controllo completo dei dispositivi (videocamera, microfono con livello,
 * altoparlanti con suono di prova).
 *   • I pannelli scorrono da destra a sinistra, la pill dei tab scivola.
 *   • Il codice stanza si aggiorna mentre scrivi (stessa regola del server).
 *   • Dispositivi scelti e stato mic/cam finiscono in sessionStorage
 *     (tdt_home_pref): per gli utenti registrati la stanza salta il prejoin
 *     ed entra direttamente. Gli ospiti hanno sempre il prejoin.
 *   • Recenti: GET /api/rooms/recent · Pianifica: GET /api/meetings.
 */
(function () {
  const $ = (s) => document.querySelector(s);
  const T = (s) => (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t(s) : s;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const loc = () => window.I18n?.locale || 'it';
  const nameIn = $('#roomNameInput'), idIn = $('#roomIdInput');
  const pref = { mic: true, cam: true, audioId: null, videoId: null, speakerId: null, checked: false };
  let stream = null, tab = 'new', user = null, meter = null, checkState = 'wait';
  const ls = { get: (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) { } } };

  // ── animazione d'ingresso: da destra, a cascata ───────────────────────────
  function reveal(root, step = 70, from = 0) {
    const els = [...(root.matches('.hr') ? [root] : []), ...root.querySelectorAll('.hr')];
    els.forEach((e, i) => { e.classList.remove('in'); setTimeout(() => e.classList.add('in'), from + i * step); });
    return from + els.length * step;
  }

  // ── saluto e data ─────────────────────────────────────────────────────────
  function greet() {
    const h = new Date().getHours();
    $('#greeting').textContent = T(h < 13 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera');
    const d = new Date().toLocaleDateString(loc(), { weekday: 'long', day: 'numeric', month: 'long' });
    $('#todayLine').textContent = d.charAt(0).toUpperCase() + d.slice(1);
  }

  // ── tab ───────────────────────────────────────────────────────────────────
  const tabs = $('#homeTabs'), pill = tabs.querySelector('.tabs-pill');
  const order = ['new', 'plan', 'join', 'recent'];
  function movePill() {
    const b = tabs.querySelector(`[data-t="${tab}"]`); if (!b) return;
    pill.style.left = b.offsetLeft + 'px'; pill.style.width = b.offsetWidth + 'px';
    b.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
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
    if (t === 'plan') loadPlan();
    if (focus && prev !== t) setTimeout(() => (t === 'new' ? nameIn : t === 'join' ? idIn : null)?.focus(), 350);
    ls.set('tdt_home_tab', t);
  }
  tabs.addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (b) setTab(b.dataset.t); });
  window.addEventListener('resize', movePill);
  document.fonts?.ready?.then(movePill);
  window.addEventListener('languagechange', () => { greet(); movePill(); });

  // ── nuova riunione ────────────────────────────────────────────────────────
  const codeOf = (v) => Tdt.roomCode(v) || 'NUOVA-RIUNIONE';
  nameIn.addEventListener('input', () => { $('#roomPreview').textContent = codeOf(nameIn.value); });
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
    const roomId = (url.match(/\/room\/([^/?#]+)/) || [])[1] || '';
    // sveglia l'audio dentro il gesto dell'utente: la stanza eredita il permesso di riprodurre
    try { const c = new (window.AudioContext || window.webkitAudioContext)(); c.resume?.().catch(() => { }); setTimeout(() => c.close().catch(() => { }), 300); } catch (_) { }
    try { sessionStorage.setItem('tdt_home_pref', JSON.stringify({ ...pref, roomId, name: user?.displayName || '', checked: checkState === 'ok' || checkState === 'warn' })); } catch (_) { }
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
    const hasVideo = !!stream?.getVideoTracks().length;
    $('#homeTile').classList.toggle('cam-off', !pref.cam || !hasVideo);
    if (stream) { stream.getVideoTracks().forEach(t => t.enabled = pref.cam); }
    $('#homeMicHint').textContent = pref.mic ? T('parla per vedere il livello') : T('entrerai con il microfono spento');
    $('#homeMicBar').parentElement.classList.toggle('off', !pref.mic);
  }
  ['togMic', 'prevMic'].forEach(id => document.getElementById(id).addEventListener('click', () => { pref.mic = !pref.mic; syncToggles(); }));
  ['togCam', 'prevCam'].forEach(id => document.getElementById(id).addEventListener('click', () => { pref.cam = !pref.cam; syncToggles(); }));

  // ── stato del controllo ───────────────────────────────────────────────────
  function setStatus(state, text) {
    checkState = state;
    const el = $('#devStatus'); el.className = 'home-status ' + state; el.querySelector('span').textContent = T(text);
  }

  // ── dispositivi ───────────────────────────────────────────────────────────
  async function fillDevices() {
    let list = [];
    try { list = await navigator.mediaDevices.enumerateDevices(); } catch (_) { }
    const fill = (sel, kind, cur, fallback) => {
      const items = list.filter(d => d.kind === kind);
      sel.innerHTML = items.length ? items.map((d, i) => `<option value="${esc(d.deviceId)}">${esc(d.label || T(fallback) + ' ' + (i + 1))}</option>`).join('') : `<option value="">${T('Nessun dispositivo')}</option>`;
      if (cur && items.some(d => d.deviceId === cur)) sel.value = cur; else if (items[0]) sel.value = items[0].deviceId;
      sel.disabled = !items.length;
      return items;
    };
    fill($('#selMic'), 'audioinput', stream?.getAudioTracks()[0]?.getSettings?.().deviceId || pref.audioId, 'Microfono');
    fill($('#selCam'), 'videoinput', stream?.getVideoTracks()[0]?.getSettings?.().deviceId || pref.videoId, 'Videocamera');
    const spk = fill($('#selSpk'), 'audiooutput', pref.speakerId, 'Altoparlanti');
    const canSink = typeof document.createElement('audio').setSinkId === 'function';
    if (!canSink) { $('#selSpk').disabled = true; $('#selSpk').innerHTML = `<option value="">${T('Scelta dal sistema')}</option>`; }
    pref.audioId = $('#selMic').value || null; pref.videoId = $('#selCam').value || null; pref.speakerId = canSink ? ($('#selSpk').value || null) : null;
    if (!spk.length) $('#btnTestSpk').disabled = false;
  }
  $('#selMic').addEventListener('change', () => { pref.audioId = $('#selMic').value || null; ls.set('vc_audioId', pref.audioId || ''); startPreview(); });
  $('#selCam').addEventListener('change', () => { pref.videoId = $('#selCam').value || null; ls.set('vc_videoId', pref.videoId || ''); startPreview(); });
  $('#selSpk').addEventListener('change', () => { pref.speakerId = $('#selSpk').value || null; ls.set('vc_speakerId', pref.speakerId || ''); });
  $('#btnTestSpk').addEventListener('click', async () => {
    const b = $('#btnTestSpk'); b.disabled = true;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') await ctx.resume();
      if (pref.speakerId && typeof ctx.setSinkId === 'function') { try { await ctx.setSinkId(pref.speakerId === 'default' ? '' : pref.speakerId); } catch (_) { } }
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine';
      const t0 = ctx.currentTime;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.25, t0 + .04);
      o.frequency.setValueAtTime(523, t0); o.frequency.setValueAtTime(659, t0 + .18); o.frequency.setValueAtTime(784, t0 + .36);
      g.gain.setValueAtTime(.25, t0 + .5); g.gain.exponentialRampToValueAtTime(.0001, t0 + .9);
      o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + .95);
      setTimeout(() => { ctx.close().catch(() => { }); b.disabled = false; }, 1100);
    } catch (e) { b.disabled = false; Tdt.toast(T('Non riesco a riprodurre il suono di prova')); }
  });
  navigator.mediaDevices?.addEventListener?.('devicechange', () => fillDevices());

  // ── anteprima: videocamera + microfono (livello) ─────────────────────────
  function stopMeter() { if (meter) { meter(); meter = null; } $('#homeMicBar').style.width = '0'; }
  function startMeter() {
    stopMeter();
    const track = stream?.getAudioTracks()[0]; const bar = $('#homeMicBar');
    if (!track || track.readyState !== 'live') return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(new MediaStream([track]));
      const an = ctx.createAnalyser(); an.fftSize = 512; src.connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      let peak = 0, heard = false;
      const t = setInterval(() => {
        an.getByteTimeDomainData(buf); let m = 0; for (const x of buf) m = Math.max(m, Math.abs(x - 128));
        peak = Math.max(m, peak * .85);
        bar.style.width = Math.min(100, Math.round(peak / 128 * 240)) + '%';
        if (!heard && m > 6 && pref.mic) { heard = true; $('#homeMicHint').textContent = T('il microfono funziona'); }
      }, 70);
      meter = () => { clearInterval(t); try { src.disconnect(); ctx.close(); } catch (_) { } };
    } catch (_) { }
  }
  async function startPreview() {
    const note = $('#homeTileNote');
    stopPreview();
    if (!navigator.mediaDevices?.getUserMedia) { note.textContent = T('Anteprima non disponibile su questo browser'); note.classList.remove('hidden'); setStatus('bad', 'Browser non supportato'); syncToggles(); return; }
    setStatus('wait', 'Controllo in corso…');
    const vid = pref.videoId, aud = pref.audioId;
    const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true, ...(aud ? { deviceId: { ideal: aud } } : {}) };
    const video = { width: { ideal: 1280 }, height: { ideal: 720 }, ...(vid ? { deviceId: { ideal: vid } } : {}) };
    let err = null;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio, video }); }
    catch (e1) {
      err = e1;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio }); } catch (e2) { try { stream = await navigator.mediaDevices.getUserMedia({ video }); } catch (e3) { stream = null; } }
    }
    const v = $('#homeVideo');
    note.classList.add('hidden');
    if (stream) {
      v.srcObject = stream; v.play?.().catch(() => { });
      stream.getTracks().forEach(t => t.addEventListener('ended', () => { if (stream) { stream = null; syncToggles(); setStatus('bad', 'Dispositivo scollegato'); } }));
      const hasV = !!stream.getVideoTracks().length, hasA = !!stream.getAudioTracks().length;
      if (hasV && hasA) setStatus('ok', 'Tutto pronto');
      else if (hasA) { setStatus('warn', 'Videocamera non disponibile'); note.textContent = T('Nessuna videocamera: entrerai in solo audio'); note.classList.remove('hidden'); }
      else { setStatus('warn', 'Microfono non disponibile'); note.textContent = T('Nessun microfono trovato'); note.classList.remove('hidden'); }
      startMeter();
    } else {
      const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
      setStatus('bad', denied ? 'Permessi negati' : 'Nessun dispositivo');
      note.textContent = denied ? T('Consenti microfono e videocamera dall\'icona accanto all\'indirizzo, poi ricarica') : T('Nessun microfono o videocamera trovati');
      note.classList.remove('hidden');
    }
    await fillDevices();
    syncToggles();
  }
  function stopPreview() { stopMeter(); try { stream?.getTracks().forEach(t => t.stop()); } catch (_) { } stream = null; }
  window.addEventListener('pagehide', stopPreview);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stopPreview(); syncToggles(); } else if (!stream) startPreview(); });

  // ── formattazione date ────────────────────────────────────────────────────
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  const fmtWhen = (ts) => {
    const d = new Date(ts * 1000), now = new Date();
    const y = new Date(now); y.setDate(now.getDate() - 1);
    const tm = new Date(now); tm.setDate(now.getDate() + 1);
    const time = d.toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit' });
    if (sameDay(d, now)) return `${T('Oggi')} ${time}`;
    if (sameDay(d, y)) return `${T('Ieri')} ${time}`;
    if (sameDay(d, tm)) return `${T('Domani')} ${time}`;
    return `${d.toLocaleDateString(loc(), { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`;
  };
  const fmtDur = (s) => { s = Math.max(0, s | 0); if (s < 60) return `${s} s`; const m = Math.round(s / 60); if (m < 60) return `${m} min`; return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`; };
  const slideIn = (box) => requestAnimationFrame(() => box.querySelectorAll('.hr').forEach(e => e.classList.add('in')));

  // ── recenti ───────────────────────────────────────────────────────────────
  let recentLoaded = false, recentBusy = false;
  async function loadRecent(force) {
    const box = $('#recentList');
    if ((recentLoaded && !force) || recentBusy) return;
    recentBusy = true;
    try {
      const list = await Tdt.api('/api/rooms/recent?limit=12');
      recentLoaded = true;
      const badge = $('#recentCount'); const live = list.filter(r => r.live);
      badge.textContent = live.length; badge.classList.toggle('hidden', !live.length);
      const ll = $('#liveLine');
      if (live.length) { ll.innerHTML = `<i></i>${esc(live.length === 1 ? T('1 riunione in corso') : T('{0} riunioni in corso').replace('{0}', live.length))}`; ll.classList.remove('hidden'); } else ll.classList.add('hidden');
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
      slideIn(box);
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

  // ── pianifica: prossime riunioni in calendario ────────────────────────────
  let planLoaded = false, planBusy = false;
  async function loadPlan(force) {
    const box = $('#planList');
    if ((planLoaded && !force) || planBusy) return;
    planBusy = true;
    try {
      const list = (await Tdt.api('/api/meetings')) || [];
      planLoaded = true;
      const now = Date.now() / 1000;
      const upcoming = list.filter(m => m.scheduled_at > now - 3600).sort((a, b) => a.scheduled_at - b.scheduled_at).slice(0, 8);
      const badge = $('#planCount'); const today = upcoming.filter(m => sameDay(new Date(m.scheduled_at * 1000), new Date())).length;
      badge.textContent = today; badge.classList.toggle('hidden', !today);
      if (!upcoming.length) { box.innerHTML = `<div class="recent-empty">${T('Nessuna riunione in calendario. Con «Pianifica una riunione» scegli data, durata e invitati: ricevono email e link.')}</div>`; return; }
      box.innerHTML = upcoming.map((m, i) => {
        const isNow = m.scheduled_at < now + 300, isSoon = !isNow && m.scheduled_at < now + 1800;
        const inv = (m.invitees || []).length;
        return `<div class="rc hr" style="transition-delay:${i * 50}ms" data-room="${esc(m.room_id)}">
          <div class="rc-main">
            <b translate="no">${esc(m.title)}</b>
            <small><span translate="no">${fmtWhen(m.scheduled_at)}</span> · ${m.duration_min} min${inv ? ` · ${inv} ${inv === 1 ? T('invitato') : T('invitati')}` : ''}${isNow ? ` · <span class="rc-live">● ${T('adesso')}</span>` : isSoon ? ` · <span class="rc-soon">${T('tra poco')}</span>` : ''}</small>
            <small class="rc-who" translate="no">${esc(m.room_id)}</small>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" data-act="copy" data-tip="Copia il link d'invito">${T('Copia link')}</button>
          <button type="button" class="btn btn-sm rc-go" data-act="go">${T('Entra')}</button>
        </div>`;
      }).join('');
      slideIn(box);
    } catch (e) {
      box.innerHTML = `<div class="recent-empty">${esc(e.message)}</div>`;
    } finally { planBusy = false; }
  }
  $('#planList').addEventListener('click', async (e) => {
    const card = e.target.closest('.rc'); if (!card) return;
    const btn = e.target.closest('[data-act]'); const act = btn?.dataset.act || 'go';
    if (act === 'copy') {
      try {
        const { url } = await Tdt.api(`/api/room/${card.dataset.room}/invite`, { method: 'POST' });
        await navigator.clipboard.writeText(url);
        btn.textContent = T('Copiato'); setTimeout(() => btn.textContent = T('Copia link'), 2000);
      } catch (err) { Tdt.toast(err.message); }
      return;
    }
    go(`/room/${card.dataset.room}`);
  });

  // ── avvio ─────────────────────────────────────────────────────────────────
  (async () => {
    user = await Tdt.requireAuth(); if (!user) return;
    greet();
    const ini = String(user.displayName || '?').trim().split(/\s+/).map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '?';
    document.querySelectorAll('[data-user-initials]').forEach(el => el.textContent = ini);
    pref.audioId = ls.get('vc_audioId') || null; pref.videoId = ls.get('vc_videoId') || null; pref.speakerId = ls.get('vc_speakerId') || null;
    // ?room=xxx (link dal CRM) → tab "Entra" precompilata
    const room = new URLSearchParams(window.location.search).get('room');
    let start = 'new';
    if (room) { idIn.value = room; start = 'join'; window.history.replaceState({}, '', window.location.pathname); }
    else { start = ls.get('tdt_home_tab') || 'new'; if (!order.includes(start)) start = 'new'; }
    setTab(start, false);
    document.querySelectorAll('.pane').forEach(p => p.classList.add('ready'));
    const t = reveal(document.querySelector('.home-left'), 80);
    reveal(document.querySelector('.home-right'), 0, Math.min(t, 420));
    setTimeout(() => (start === 'join' ? idIn : nameIn).focus({ preventScroll: true }), t + 100);
    loadRecent(); loadPlan(); // i badge servono anche se la tab non è aperta
    startPreview();
  })();
})();
