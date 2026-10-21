'use strict';

/**
 * 1.8.0 — Domande e risposte (scheda «Domande» del pannello Attività).
 *   • Chiunque scrive una domanda, anche in forma anonima: in quel caso al
 *     server arriva solo il testo (nessun nome) e il server non salva chi l'ha
 *     scritta. Chi l'ha fatta la riconosce solo nel suo browser (id salvato
 *     nella scheda, sessionStorage).
 *   • Un voto a persona, si può togliere. Schede «Più votate», «Recenti»,
 *     «Con risposta». La domanda «In risposta» sta in cima, evidenziata per tutti.
 *   • Organizzatori: «In risposta», «Risposta data», nascondi / mostra le fuori
 *     tema, scarica l'elenco per Excel (CSV UTF-8 con BOM, separatore ;).
 * Server: qnaAsk / qnaVote / qnaStatus / qnaHide → qnaUpdate (vista per persona).
 */
(function () {
  const A = () => window.TDTActivities;
  const T = (s) => (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t(s) : s;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isHost = () => !!window.__isHostRole;
  const svg = (d, w = 16, sw = 1.9) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICO = {
    up: svg('<path d="M12 19V6M6.5 11.5L12 6l5.5 5.5"/>', 16, 2.2),
    mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>', 15),
    check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 15, 2.2),
    eyeOff: svg('<path d="M3 3l18 18"/><path d="M10.6 5.2A9.8 9.8 0 0 1 12 5c5 0 8.5 4.4 9.5 7a12 12 0 0 1-2.7 3.8M6.4 6.4A12.4 12.4 0 0 0 2.5 12c1 2.6 4.5 7 9.5 7a9.6 9.6 0 0 0 4.6-1.2"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>', 15),
    eye: svg('<path d="M2.5 12c1-2.6 4.5-7 9.5-7s8.5 4.4 9.5 7c-1 2.6-4.5 7-9.5 7s-8.5-4.4-9.5-7z"/><circle cx="12" cy="12" r="3"/>', 15),
    undo: svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>', 15),
    dl: svg('<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>', 16),
    send: svg('<path d="M4.5 12h13M12.5 6.5L18 12l-5.5 5.5"/>', 17, 2.1),
    mask: svg('<path d="M3 9.5c0-1.5 1.2-2.5 2.7-2.5h12.6c1.5 0 2.7 1 2.7 2.5 0 4-2.7 7-5.6 7-1.7 0-2.4-1.6-3.4-1.6s-1.7 1.6-3.4 1.6C5.7 16.5 3 13.5 3 9.5z"/><path d="M7.5 10.8h2M14.5 10.8h2"/>', 15),
    q: svg('<path d="M20 12.5a7.5 7.5 0 0 1-11.2 6.5L4 20l1.1-4.3A7.5 7.5 0 1 1 20 12.5z"/><path d="M10.3 10.2a1.9 1.9 0 1 1 2.6 1.8c-.6.3-.9.7-.9 1.3v.4M12 16.4h.01"/>', 30, 1.6),
  };
  const MAX = 300;
  const VIEWS = [['top', 'Più votate'], ['new', 'Recenti'], ['done', 'Con risposta']];
  const LS_VIEW = 'tdt_qna_view', LS_ANON = 'tdt_qna_anon';

  const qs = new Map();          // id → vista dal server
  const drawn = new Set();       // id già disegnati: l'animazione d'ingresso solo per le nuove
  let socket = null, sec$ = null, visible = false, view = 'top', showHidden = false;
  let unseen = 0, draft = '', anon = false;
  let pendingAnon = 0; // domande anonime mie in viaggio: l'id torna dopo l'eco del server
  try { view = ['top', 'new', 'done'].includes(localStorage.getItem(LS_VIEW)) ? localStorage.getItem(LS_VIEW) : 'top'; } catch (_) { }
  try { anon = localStorage.getItem(LS_ANON) === '1'; } catch (_) { }

  // le MIE domande anonime: solo in questa scheda del browser (il server non lo sa)
  const roomKey = () => 'tdt_qna_mine_' + (location.pathname.split('/').pop() || '');
  const mineAnon = new Set();
  try { (JSON.parse(sessionStorage.getItem(roomKey()) || '[]') || []).forEach(id => mineAnon.add(String(id))); } catch (_) { }
  const saveMine = () => { try { sessionStorage.setItem(roomKey(), JSON.stringify([...mineAnon].slice(-60))); } catch (_) { } };
  const isMine = (q) => q.mine || mineAnon.has(q.id);

  const timeOf = (ms) => { try { return new Date(ms).toLocaleTimeString(window.I18n?.locale, { hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };
  const STATUS_LABEL = { open: 'Da rispondere', answering: 'In risposta', answered: 'Risposta data' };

  // ── Struttura della scheda ─────────────────────────────────────────────
  function mount(sec) {
    sec$ = sec;
    if (!sec) return;
    sec.classList.add('qna-sec');
    sec.innerHTML = `
      <div class="qna-views" role="tablist" aria-label="Ordina le domande">
        ${VIEWS.map(([k, l]) => `<button type="button" class="qna-view" role="tab" data-view="${k}" aria-selected="false"><span>${l}</span><span class="qna-view-n"></span></button>`).join('')}
      </div>
      <div class="qna-list" id="qnaList" aria-live="polite"></div>
      <div class="qna-foot" id="qnaFoot"></div>`;
    sec.querySelectorAll('.qna-view').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
    // clic sulla lista: voti e azioni degli organizzatori
    sec.querySelector('#qnaList').addEventListener('click', onListClick);
    renderFoot();
    render();
  }
  function setView(v) {
    view = v;
    try { localStorage.setItem(LS_VIEW, v); } catch (_) { }
    render();
  }

  function renderFoot() {
    if (!sec$) return;
    const f = sec$.querySelector('#qnaFoot');
    const host = isHost();
    f.innerHTML = `
      <form class="qna-form" id="qnaForm" autocomplete="off" novalidate>
        <label class="sr-only" for="qnaText">Fai una domanda</label>
        <div class="qna-field">
          <textarea id="qnaText" class="act-input qna-text" rows="2" maxlength="${MAX}" placeholder="Fai una domanda…"></textarea>
          <button type="submit" class="qna-send" id="qnaSend" data-tip="Invia la domanda" aria-label="Invia la domanda">${ICO.send}</button>
        </div>
        <div class="qna-form-row">
          <label class="qna-anon"><input type="checkbox" id="qnaAnon" ${anon ? 'checked' : ''}><span class="qna-anon-ico">${ICO.mask}</span><span>Chiedi in forma anonima</span></label>
          <span class="qna-count" id="qnaCount" aria-hidden="true">0/${MAX}</span>
        </div>
        <div class="qna-anon-note${anon ? '' : ' hidden'}" id="qnaAnonNote">Il tuo nome non viene inviato: non lo vede nessuno, nemmeno gli organizzatori.</div>
      </form>
      ${host ? `<button type="button" class="act-link qna-csv" id="qnaCsv">${ICO.dl}<span>Scarica le domande per Excel</span></button>` : ''}`;
    const ta = f.querySelector('#qnaText');
    ta.value = draft;
    const cnt = f.querySelector('#qnaCount');
    const upd = () => {
      draft = ta.value;
      const n = Array.from(ta.value).length;
      cnt.textContent = `${n}/${MAX}`;
      cnt.classList.toggle('warn', n > MAX - 30);
      f.querySelector('#qnaSend').disabled = !ta.value.trim();
      // altezza che segue il testo (fino a 6 righe circa)
      ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, 150) + 'px';
    };
    ta.addEventListener('input', upd);
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(); }
    });
    upd();
    f.querySelector('#qnaAnon').addEventListener('change', (e) => {
      anon = e.target.checked;
      try { localStorage.setItem(LS_ANON, anon ? '1' : '0'); } catch (_) { }
      f.querySelector('#qnaAnonNote').classList.toggle('hidden', !anon);
    });
    f.querySelector('#qnaForm').addEventListener('submit', (e) => { e.preventDefault(); ask(); });
    f.querySelector('#qnaCsv')?.addEventListener('click', downloadCsv);
  }

  // ── Lista ──────────────────────────────────────────────────────────────
  function lists() {
    const all = [...qs.values()];
    const vis = all.filter(q => !q.hidden);
    const answering = vis.filter(q => q.status === 'answering');
    const pending = vis.filter(q => q.status === 'open');
    const done = vis.filter(q => q.status === 'answered').sort((a, b) => (b.answeredAt || 0) - (a.answeredAt || 0));
    const top = [...pending].sort((a, b) => (b.votes - a.votes) || (a.createdAt - b.createdAt));
    const recent = [...pending].sort((a, b) => b.createdAt - a.createdAt);
    const hidden = all.filter(q => q.hidden).sort((a, b) => b.createdAt - a.createdAt);
    return { answering, top, recent, done, hidden, pendingCount: pending.length + answering.length };
  }

  function card(q, extraCls = '') {
    const host = isHost();
    const mine = isMine(q);
    const who = q.anonymous ? (mine ? T('Tu') + ' · ' + T('anonima') : T('Anonimo')) : (mine ? T('Tu') : q.author || '');
    const canVote = q.status !== 'answered' && !q.hidden;
    const voteLbl = q.voted ? T('Togli il voto') : T('Vota questa domanda');
    const status = q.status === 'answering'
      ? `<span class="qna-chip qna-chip-live">${ICO.mic}<span>In risposta</span></span>`
      : q.status === 'answered' ? `<span class="qna-chip qna-chip-done">${ICO.check}<span>Risposta data</span></span>` : '';
    const hiddenChip = q.hidden ? `<span class="qna-chip qna-chip-hidden">${ICO.eyeOff}<span>Nascosta</span></span>` : '';
    let actions = '';
    if (host) {
      const b = (act, ico, label, cls = '') => `<button type="button" class="qna-act ${cls}" data-act="${act}" data-id="${esc(q.id)}">${ico}<span>${label}</span></button>`;
      if (q.hidden) actions = b('show', ICO.eye, 'Mostra di nuovo');
      else if (q.status === 'open') actions = b('answering', ICO.mic, 'In risposta', 'qna-act-main') + b('answered', ICO.check, 'Risposta data') + b('hide', ICO.eyeOff, 'Nascondi');
      else if (q.status === 'answering') actions = b('answered', ICO.check, 'Risposta data', 'qna-act-main') + b('open', ICO.undo, 'Rimetti in attesa') + b('hide', ICO.eyeOff, 'Nascondi');
      else actions = b('open', ICO.undo, 'Rimetti in attesa') + b('hide', ICO.eyeOff, 'Nascondi');
    }
    const fresh = !drawn.has(String(q.id));
    return `<article class="qna-q ${extraCls}${fresh ? ' is-new' : ''}${q.status === 'answering' ? ' is-live' : ''}${q.status === 'answered' ? ' is-done' : ''}${q.hidden ? ' is-hidden' : ''}${mine ? ' is-mine' : ''}" data-id="${esc(q.id)}">
      <div class="qna-q-main">
        <div class="qna-q-head">
          <span class="qna-who${q.anonymous ? ' anon' : ''}" ${q.anonymous ? '' : 'translate="no"'}>${q.anonymous ? `<span class="qna-who-ico">${ICO.mask}</span>` : ''}${esc(who)}</span>
          <span class="qna-time">${esc(timeOf(q.createdAt))}</span>
          ${status}${hiddenChip}
        </div>
        <div class="qna-q-text" translate="no">${esc(q.text)}</div>
        ${actions ? `<div class="qna-acts">${actions}</div>` : ''}
      </div>
      <button type="button" class="qna-vote${q.voted ? ' on' : ''}" data-act="vote" data-id="${esc(q.id)}" ${canVote ? '' : 'disabled'} aria-pressed="${q.voted ? 'true' : 'false'}" aria-label="${esc(voteLbl)} (${q.votes})" data-tip="${canVote ? esc(voteLbl) : ''}">
        ${ICO.up}<span class="qna-vote-n">${q.votes}</span>
      </button>
    </article>`;
  }

  function render() {
    if (!sec$) return;
    const L = lists();
    // numeri sulle schede
    const n = { top: L.pendingCount, new: L.pendingCount, done: L.done.length };
    sec$.querySelectorAll('.qna-view').forEach(b => {
      const on = b.dataset.view === view;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      const c = b.querySelector('.qna-view-n');
      const v = n[b.dataset.view];
      c.textContent = v ? String(v) : '';
    });
    const list = sec$.querySelector('#qnaList');
    let html = '';
    let items = view === 'done' ? L.done : (view === 'new' ? L.recent : L.top);
    if (view !== 'done' && L.answering.length) html += L.answering.map(q => card(q)).join('');
    html += items.map(q => card(q)).join('');
    if (!html) {
      const empty = view === 'done'
        ? `<div>Nessuna domanda con risposta, per ora.</div><div class="act-hint">Quando un organizzatore segna «Risposta data», la domanda arriva qui.</div>`
        : `<div>Nessuna domanda, per ora.</div><div class="act-hint">Scrivi qui sotto: gli altri possono votare le domande che vogliono sentire per prime.</div>`;
      html = `<div class="act-empty"><div class="act-empty-ico" aria-hidden="true">${ICO.q}</div>${empty}</div>`;
    }
    if (isHost() && L.hidden.length) {
      html += `<button type="button" class="qna-hidden-toggle" id="qnaHiddenToggle" aria-expanded="${showHidden}">${showHidden ? ICO.eyeOff : ICO.eye}<span>${showHidden ? T('Chiudi le domande nascoste') : T('Domande nascoste')} (${L.hidden.length})</span></button>`;
      if (showHidden) html += `<div class="qna-hidden-list"><div class="act-hint">Le vedono solo gli organizzatori.</div>${L.hidden.map(q => card(q)).join('')}</div>`;
    }
    // conserva lo scorrimento mentre arrivano i voti
    const st = list.scrollTop;
    list.innerHTML = html;
    list.scrollTop = st;
    qs.forEach((_, id) => drawn.add(String(id)));
    list.querySelector('#qnaHiddenToggle')?.addEventListener('click', () => { showHidden = !showHidden; render(); });
  }

  function onListClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const id = b.dataset.id, q = qs.get(id);
    if (!q) return;
    const a = b.dataset.act;
    const cb = (r) => { if (r?.error) window.showToast?.(r.error, 2800); };
    if (a === 'vote') {
      // risposta immediata sul tasto, il numero vero arriva dal server
      const want = !q.voted;
      q.voted = want; q.votes = Math.max(0, q.votes + (want ? 1 : -1));
      render();
      socket?.emit('qnaVote', { id, on: want }, (r) => { if (r?.error) { q.voted = !want; q.votes = Math.max(0, q.votes + (want ? -1 : 1)); render(); cb(r); } });
      return;
    }
    if (a === 'hide' || a === 'show') { socket?.emit('qnaHide', { id, hidden: a === 'hide' }, cb); return; }
    if (['open', 'answering', 'answered'].includes(a)) socket?.emit('qnaStatus', { id, status: a }, cb);
  }

  function ask() {
    if (!sec$) return;
    const ta = sec$.querySelector('#qnaText');
    const text = (ta?.value || '').trim();
    if (!text) { ta?.focus(); return; }
    const isAnon = !!sec$.querySelector('#qnaAnon')?.checked;
    const btn = sec$.querySelector('#qnaSend'); if (btn) btn.disabled = true;
    // Anonima: SOLO testo e il flag. Nessun nome nel messaggio.
    const payload = isAnon ? { text, anonymous: true } : { text, anonymous: false };
    if (isAnon) pendingAnon++;
    socket?.emit('qnaAsk', payload, (r) => {
      if (isAnon) pendingAnon = Math.max(0, pendingAnon - 1);
      if (btn) btn.disabled = false;
      if (r?.error) { window.showToast?.(r.error, 3000); return; }
      if (isAnon && r?.id) { mineAnon.add(String(r.id)); saveMine(); render(); }
      draft = '';
      if (ta) { ta.value = ''; ta.dispatchEvent(new Event('input')); ta.focus(); }
      if (view === 'done') setView('new');
    });
  }

  // ── CSV per Excel ──────────────────────────────────────────────────────
  // BOM UTF-8 (Excel riconosce accenti ed emoji), separatore «;» (Excel
  // italiano/europeo), a capo CRLF. Le celle che iniziano con = + - @ prendono
  // un apostrofo davanti: niente formule eseguite aprendo il file.
  function csvCell(v) {
    let s = String(v == null ? '' : v).replace(/\r\n?/g, '\n');
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function buildCsv() {
    const rows = [[T('Domanda'), T('Autore'), T('Voti'), T('Stato'), T('Ora')]];
    const all = [...qs.values()].sort((a, b) => a.createdAt - b.createdAt);
    for (const q of all) {
      const st = q.hidden ? T('Nascosta') : T(STATUS_LABEL[q.status] || q.status);
      rows.push([q.text, q.anonymous ? T('Anonimo') : (q.author || ''), q.votes, st, timeOf(q.createdAt)]);
    }
    return '﻿' + rows.map(r => r.map(csvCell).join(';')).join('\r\n') + '\r\n';
  }
  function downloadCsv() {
    if (!qs.size) { window.showToast?.('Non ci sono ancora domande da scaricare', 2600); return; }
    const csv = buildCsv();
    const room = (location.pathname.split('/').pop() || 'riunione').replace(/[^A-Za-z0-9_-]/g, '');
    const d = new Date(), p = (n) => String(n).padStart(2, '0');
    const name = `${T('domande')}-${room}-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.csv`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener'; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1500);
    window.showToast?.(T('File scaricato') + ': ' + name, 3000);
  }

  // ── Dal server ─────────────────────────────────────────────────────────
  function load(list) {
    qs.clear();
    (Array.isArray(list) ? list : []).forEach(q => { if (q && q.id) qs.set(q.id, q); });
    unseen = 0;
    renderFoot();
    render();
  }
  function onUpdate(m) {
    if (!m) return;
    if (m.removed) { qs.delete(m.id); render(); A()?.refreshBadge(); return; }
    const q = m.q; if (!q || !q.id) return;
    const prev = qs.get(q.id);
    qs.set(q.id, q);
    const viewing = visible && A()?.isOpen;
    if (!prev && !q.hidden) {
      const own = isMine(q) || (q.anonymous && pendingAnon > 0);
      if (!own && !viewing) {
        unseen++;
        if (isHost()) window.showToast?.(T('Nuova domanda') + ': ' + (q.text.length > 80 ? q.text.slice(0, 78) + '…' : q.text), 4000);
      }
    }
    // «In risposta»: avviso a tutti (tranne chi l'ha segnata)
    if (q.status === 'answering' && (!prev || prev.status !== 'answering') && m.bySid !== socket?.id) {
      const short = q.text.length > 90 ? q.text.slice(0, 88) + '…' : q.text;
      window.showToast?.(T('In risposta') + ': «' + short + '»', 5000);
      if (isMine(q)) { try { if (typeof sounds !== 'undefined') sounds?.chat?.(); } catch (_) { } } // eslint-disable-line no-undef
    }
    render();
    A()?.refreshBadge();
  }

  const mod = {
    mount,
    show() { visible = true; unseen = 0; render(); A()?.refreshBadge(); },
    hide() { visible = false; },
    refresh() { renderFoot(); render(); },
    load,
    bind(sock) {
      socket = sock;
      sock.on('qnaUpdate', onUpdate);
    },
    badge() { return unseen; },
  };
  window.TdtQna = { get list() { return [...qs.values()]; }, buildCsv, get unseen() { return unseen; } };
  if (window.TDTActivities) window.TDTActivities.register('qna', mod);
  else window.addEventListener('DOMContentLoaded', () => window.TDTActivities?.register('qna', mod), { once: true });
})();
