'use strict';

/**
 * 1.8.0 — Pannello «Attività»: Sondaggi, Timer e Domande in un unico pannello
 * laterale (stesso telaio della chat: un pannello alla volta, a tutto schermo
 * sul telefono).
 *
 *   window.TDTActivities = { open(tab), close(), toggle(tab), badge, ... }
 *     tab: 'polls' | 'timer' | 'qna'   (anche 'sondaggi', 'domande')
 *   Numero da mostrare sul tasto: TDTActivities.badge oppure l'evento
 *     window 'tdt:activities-badge'  → detail { count, polls, timer, qna }
 *   Tasto #activitiesBtn nella barra (a destra, accanto a Persone): .active
 *   col pannello aperto, numero in #activitiesBadge. Sotto i 1150 px il tasto
 *   non c'è (activities.css) e Attività resta nel menu Altro (#btnActivities).
 *
 * Moduli: polls.js (TdtPolls.mount), timer.js e qna.js si registrano con
 * TDTActivities.register(nome, { mount, show, hide, load, bind, badge }).
 * Orologio del server: TDTActivities.serverNow() — misurato con 'actClock'
 * (andata e ritorno, si tiene il campione più veloce), come il countdown.
 */
(function () {
  const TABS = ['polls', 'timer', 'qna'];
  const ALIAS = { polls: 'polls', poll: 'polls', sondaggi: 'polls', timer: 'timer', qna: 'qna', domande: 'qna', questions: 'qna' };
  const LS_TAB = 'tdt_act_tab';
  const mods = {};
  let panel = null, isOpen = false, tab = null, socket = null, lastBadge = null, badgeNow = { count: 0, polls: 0, timer: 0, qna: 0 };

  const T = (s) => (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t(s) : s;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const svg = (d, w = 18) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICO = {
    x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    polls: svg('<path d="M5 20V10M12 20V4M19 20v-7"/><path d="M3 20h18"/>', 17),
    timer: svg('<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2M9.5 2.8h5M12 2.8V6"/>', 17),
    qna: svg('<path d="M20 12.5a7.5 7.5 0 0 1-11.2 6.5L4 20l1.1-4.3A7.5 7.5 0 1 1 20 12.5z"/><path d="M10.3 10.2a1.9 1.9 0 1 1 2.6 1.8c-.6.3-.9.7-.9 1.3v.4M12 16.4h.01"/>', 17),
  };

  // ── Orologio del server ────────────────────────────────────────────────
  // serverNow() = ultimo campione + tempo passato (performance.now: non salta
  // se l'utente cambia l'ora del computer). Il campione buono è quello con
  // l'andata e ritorno più corto: l'errore è al massimo metà di quel tempo.
  const clock = { server: 0, perf: 0, rtt: Infinity, ok: false };
  const pnow = () => (window.performance && performance.now) ? performance.now() : Date.now();
  function serverNow() { return clock.ok ? clock.server + (pnow() - clock.perf) : Date.now(); }
  function setRough(serverMs) {
    // valore senza misura dell'andata e ritorno (risposta di ingresso, eventi):
    // si usa solo finché non c'è un campione vero
    if (!Number.isFinite(serverMs) || clock.rtt !== Infinity) return;
    clock.server = serverMs; clock.perf = pnow(); clock.ok = true;
  }
  let syncing = false;
  function syncClock(n = 5) {
    if (!socket || syncing) return;
    syncing = true;
    clock.rtt = Infinity; // campioni nuovi: il vecchio potrebbe essere andato alla deriva (sospensione)
    let left = n;
    const one = () => {
      if (!socket || left-- <= 0) { syncing = false; return; }
      const t0 = pnow();
      let done = false;
      const fin = () => { if (done) return; done = true; setTimeout(one, 220); };
      setTimeout(fin, 3000);
      socket.emit('actClock', {}, (r) => {
        const t1 = pnow(), rtt = t1 - t0;
        if (r && Number.isFinite(r.now) && rtt < clock.rtt) {
          clock.rtt = rtt; clock.server = r.now + rtt / 2; clock.perf = t1; clock.ok = true;
          window.dispatchEvent(new CustomEvent('tdt:clock'));
        }
        fin();
      });
    };
    one();
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncClock(3); });
  setInterval(() => { if (!document.hidden) syncClock(3); }, 10 * 60 * 1000);

  // ── Pannello ───────────────────────────────────────────────────────────
  function build() {
    if (panel) return panel;
    panel = document.createElement('aside');
    panel.id = 'activitiesPanel';
    panel.className = 'chat-panel act-panel hidden';
    panel.setAttribute('aria-label', 'Attività');
    const tabBtn = (t, label) => `<button type="button" class="act-tab" role="tab" id="actTab-${t}" data-tab="${t}" aria-controls="actSec-${t}" aria-selected="false" tabindex="-1">${ICO[t]}<span>${label}</span><span class="act-tab-badge hidden" aria-hidden="true"></span></button>`;
    panel.innerHTML = `
      <div class="chat-header act-head">
        <span>Attività</span>
        <button type="button" class="btn-icon" id="btnCloseActivities" data-tip="Chiudi" aria-label="Chiudi">${ICO.x}</button>
      </div>
      <div class="act-tabs" role="tablist" aria-label="Attività">
        ${tabBtn('polls', 'Sondaggi')}${tabBtn('timer', 'Timer')}${tabBtn('qna', 'Domande')}
      </div>
      ${TABS.map(t => `<section class="act-sec hidden" id="actSec-${t}" data-sec="${t}" role="tabpanel" aria-labelledby="actTab-${t}"></section>`).join('')}`;
    (document.getElementById('roomLayout') || document.body).appendChild(panel);
    panel.querySelector('#btnCloseActivities').addEventListener('click', () => close());
    const tabs = [...panel.querySelectorAll('.act-tab')];
    tabs.forEach(b => b.addEventListener('click', () => select(b.dataset.tab)));
    panel.querySelector('.act-tabs').addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
      e.preventDefault();
      let i = TABS.indexOf(tab);
      if (e.key === 'ArrowRight') i = (i + 1) % TABS.length;
      else if (e.key === 'ArrowLeft') i = (i + TABS.length - 1) % TABS.length;
      else i = e.key === 'Home' ? 0 : TABS.length - 1;
      select(TABS[i]); panel.querySelector(`#actTab-${TABS[i]}`)?.focus();
    });
    panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
    // le scorciatoie della stanza (M, V, Spazio…) non devono scattare mentre si scrive qui
    panel.addEventListener('keydown', (e) => { const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) e.stopPropagation(); });
    panel.addEventListener('keyup', (e) => { const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) e.stopPropagation(); });
    // moduli: ognuno disegna la sua sezione
    for (const t of TABS) {
      const sec = panel.querySelector(`#actSec-${t}`);
      try {
        if (t === 'polls') window.TdtPolls?.mount?.(sec);
        else mods[t]?.mount?.(sec);
      } catch (e) { console.error('[attività]', t, e); }
    }
    watchOtherPanels();
    return panel;
  }

  function select(t) {
    t = ALIAS[t] || t;
    if (!TABS.includes(t)) t = 'polls';
    const prev = tab;
    tab = t;
    try { localStorage.setItem(LS_TAB, t); } catch (_) { }
    if (!panel) return;
    panel.querySelectorAll('.act-tab').forEach(b => {
      const on = b.dataset.tab === t;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    panel.querySelectorAll('.act-sec').forEach(s => s.classList.toggle('hidden', s.dataset.sec !== t));
    if (isOpen) {
      if (prev && prev !== t) hideMod(prev);
      showMod(t);
    }
  }
  function showMod(t) { try { t === 'polls' ? window.TdtPolls?._setVisible?.(true) : mods[t]?.show?.(); } catch (e) { console.error(e); } refreshBadge(); }
  function hideMod(t) { try { t === 'polls' ? window.TdtPolls?._setVisible?.(false) : mods[t]?.hide?.(); } catch (e) { console.error(e); } }

  // un pannello alla volta: chiude chat, persone, sfondi ed effetti
  function closeOthers() {
    try { if (typeof chatOpen !== 'undefined' && chatOpen && typeof toggleChat === 'function') toggleChat(); } catch (_) { }
    try { if (typeof participantList !== 'undefined' && participantList && participantList.open) participantList.toggle(); } catch (_) { }
    try { window.closeFxPanel?.(); } catch (_) { }
    try { window.closeMoreMenu?.(); } catch (_) { }
  }
  // …e si chiude da solo se si apre un altro pannello laterale (da qualunque tasto)
  let mo = null;
  function watchOtherPanels() {
    if (!window.MutationObserver) return;
    if (!mo) mo = new MutationObserver((list) => {
      if (!isOpen) return;
      for (const m of list) {
        const el = m.target;
        if (el !== panel && !el.classList.contains('hidden') && el.offsetParent !== null) { close(); return; }
      }
    });
    mo.disconnect();
    const others = new Set([...document.querySelectorAll('#roomLayout > aside, .chat-panel, .participants-panel')]);
    others.delete(panel);
    others.forEach(el => mo.observe(el, { attributes: true, attributeFilter: ['class'] }));
  }

  function open(t) {
    build();
    closeOthers();
    watchOtherPanels();
    let want = ALIAS[t] || null;
    if (!want) { try { want = ALIAS[localStorage.getItem(LS_TAB)] || null; } catch (_) { } }
    const wasOpen = isOpen;
    isOpen = true;
    panel.classList.remove('hidden');
    if (wasOpen && tab && tab !== (want || tab)) hideMod(tab);
    tab = null; // forza il giro di select → show del modulo
    select(want || 'polls');
    syncBtn();
    if (!wasOpen) setTimeout(() => { if (isOpen && !panel.contains(document.activeElement)) panel.querySelector('.act-tab.active')?.focus({ preventScroll: true }); }, 60);
  }
  function close() {
    if (!panel || !isOpen) return;
    isOpen = false;
    panel.classList.add('hidden');
    if (tab) hideMod(tab);
    syncBtn();
    refreshBadge();
  }
  function toggle(t) {
    const want = ALIAS[t] || null;
    if (isOpen && (!want || want === tab)) close(); else open(want);
  }
  function syncBtn() {
    const b = document.getElementById('activitiesBtn');
    if (b) { b.classList.toggle('active', isOpen); b.setAttribute('aria-expanded', isOpen ? 'true' : 'false'); }
    document.getElementById('btnActivities')?.classList.toggle('active', isOpen);
  }

  // ── Numeri (badge) ─────────────────────────────────────────────────────
  function refreshBadge() {
    const parts = { polls: 0, timer: 0, qna: 0 };
    try { parts.polls = (isOpen && tab === 'polls') ? 0 : (window.TdtPolls?.unseen || 0); } catch (_) { }
    for (const t of ['timer', 'qna']) { try { parts[t] = mods[t]?.badge?.() || 0; } catch (_) { } }
    const count = parts.polls + parts.timer + parts.qna;
    if (panel) for (const t of TABS) {
      const el = panel.querySelector(`#actTab-${t} .act-tab-badge`);
      if (el) { el.textContent = parts[t] > 99 ? '99+' : String(parts[t]); el.classList.toggle('hidden', !parts[t]); }
    }
    const mb = document.getElementById('activitiesMenuBadge');
    if (mb) { mb.textContent = count > 99 ? '99+' : String(count); mb.classList.toggle('hidden', !count); }
    const pb = document.getElementById('pollsBadge');
    if (pb) { pb.textContent = parts.polls; pb.classList.toggle('hidden', !parts.polls); }
    const ab = document.getElementById('activitiesBtn');
    if (ab) {
      ab.classList.toggle('has-badge', !!count);
      if (count) ab.dataset.badge = count > 99 ? '99+' : String(count); else delete ab.dataset.badge;
      const bb = document.getElementById('activitiesBadge');
      if (bb) { bb.textContent = count > 99 ? '99+' : String(count); bb.classList.toggle('hidden', !count); }
      const lbl = T('Attività: sondaggi, timer e domande');
      ab.setAttribute('aria-label', count ? `${lbl} (${count} ${T('novità')})` : lbl);
    }
    // il pallino su «Altro» solo se Attività sta (anche) lì: non se il tasto in barra è visibile
    const inBar = !!(ab && ab.offsetParent !== null);
    document.getElementById('btnMore')?.classList.toggle('has-badge', !!count && !inBar);
    badgeNow = { count, ...parts };
    const key = JSON.stringify(badgeNow);
    if (key !== lastBadge) {
      lastBadge = key;
      try { window.dispatchEvent(new CustomEvent('tdt:activities-badge', { detail: { ...badgeNow } })); } catch (_) { }
    }
  }

  // ── Collegamento con la stanza (room.js) ───────────────────────────────
  function bind(sock) {
    socket = sock;
    for (const t of ['timer', 'qna']) { try { mods[t]?.bind?.(sock); } catch (e) { console.error('[attività]', t, e); } }
    syncClock(5);
  }
  /** Risposta di ingresso: { serverNow, timer, qna } (chi entra tardi vede lo stato). */
  function load(snap) {
    if (snap && Number.isFinite(snap.serverNow)) setRough(snap.serverNow);
    for (const t of ['timer', 'qna']) { try { mods[t]?.load?.(snap ? snap[t] : null); } catch (e) { console.error('[attività]', t, e); } }
    // sezioni già disegnate prima di sapere se si è organizzatori: ridisegna
    if (panel) for (const t of ['timer', 'qna']) { try { mods[t]?.refresh?.(); } catch (_) { } }
    refreshBadge();
  }
  function register(name, mod) {
    mods[name] = mod;
    if (panel) { try { mod.mount?.(panel.querySelector(`#actSec-${name}`)); } catch (e) { console.error(e); } }
    if (socket) { try { mod.bind?.(socket); } catch (e) { console.error(e); } }
  }

  // Altro → Attività
  function wireMenu() {
    const b = document.getElementById('btnActivities');
    if (b && !b._tdtAct) { b._tdtAct = true; b.addEventListener('click', () => { window.closeMoreMenu?.(); toggle(); }); }
    // tasto nella barra (a destra, accanto a Persone)
    const ab = document.getElementById('activitiesBtn');
    if (ab && !ab._tdtAct) { ab._tdtAct = true; ab.addEventListener('click', (e) => { e.stopPropagation(); toggle(); }); }
    window.addEventListener('resize', () => { clearTimeout(wireMenu._t); wireMenu._t = setTimeout(refreshBadge, 150); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireMenu, { once: true }); else wireMenu();

  window.TDTActivities = {
    open, close, toggle, register, bind, load, refreshBadge, serverNow, syncClock,
    get isOpen() { return isOpen; },
    get tab() { return tab; },
    get badge() { return badgeNow.count; },
    get badgeParts() { return { ...badgeNow }; },
    get socket() { return socket; },
    _esc: esc, _T: T,
  };
})();
