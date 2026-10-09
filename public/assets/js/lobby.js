'use strict';

/**
 * Sala d'attesa — lato organizzatore.
 * Quando un ospite chiede di entrare, in alto a destra compare una scheda
 * (come in Google Meet) con nome, da quanto aspetta e i tasti Ammetti /
 * Rifiuta; con più persone c'è anche «Ammetti tutti». Il contatore finisce
 * anche sul pulsante Persone. Gli ospiti non vedono nulla di tutto questo.
 * Server: lobbyUpdate → lobbyAdmit / lobbyDeny.
 */
(function () {
  let waiting = [], card = null, socket = null, known = new Set(), tick = null;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const T = (s) => (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t(s) : s;
  const ago = (ms) => { const s = Math.max(0, Math.round((Date.now() - ms) / 1000)); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`; };

  function ensure() {
    if (card) return card;
    card = document.createElement('div');
    card.className = 'lobby-card hidden';
    card.innerHTML = `
      <div class="lobby-head">
        <span class="lobby-ico">🚪</span>
        <span class="lobby-title"></span>
        <button type="button" class="lobby-x" data-tip="Nascondi" aria-label="Nascondi">×</button>
      </div>
      <div class="lobby-list"></div>
      <div class="lobby-all"><button type="button" class="lobby-btn lobby-btn-primary" data-act="all">Ammetti tutti</button></div>`;
    document.body.appendChild(card);
    card.querySelector('.lobby-x').addEventListener('click', () => { card.classList.add('hidden'); card._dismissed = waiting.map(w => w.peerId).join(','); });
    card.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const act = b.dataset.act, peerId = b.dataset.peer;
      b.disabled = true;
      if (act === 'all') socket?.emit('lobbyAdmit', { all: true }, (r) => { if (r?.error) window.showToast?.(r.error, 2500); });
      else if (act === 'admit') socket?.emit('lobbyAdmit', { peerId }, (r) => { if (r?.error) { b.disabled = false; window.showToast?.(r.error, 2500); } });
      else if (act === 'deny') socket?.emit('lobbyDeny', { peerId }, (r) => { if (r?.error) { b.disabled = false; window.showToast?.(r.error, 2500); } });
    });
    return card;
  }

  function render() {
    const c = ensure();
    const n = waiting.length;
    const badge = document.getElementById('lobbyBadge');
    if (badge) { badge.textContent = n; badge.classList.toggle('hidden', !n); }
    document.getElementById('btnParticipants')?.classList.toggle('has-lobby', !!n);
    if (!n) { c.classList.add('hidden'); clearInterval(tick); tick = null; return; }
    c.querySelector('.lobby-title').textContent = n === 1 ? T('Qualcuno vuole entrare') : T('{0} persone vogliono entrare').replace('{0}', n);
    c.querySelector('.lobby-list').innerHTML = waiting.map(w => `
      <div class="lobby-row" data-peer="${esc(w.peerId)}">
        <span class="lobby-av">${esc((w.displayName || '?').trim().split(/\s+/).map(x => x[0] || '').join('').toUpperCase().slice(0, 2))}</span>
        <span class="lobby-name"><b>${esc(w.displayName)}</b><small class="lobby-since" data-since="${w.since}">${ago(w.since)}</small></span>
        <button type="button" class="lobby-btn lobby-btn-ghost" data-act="deny" data-peer="${esc(w.peerId)}">Rifiuta</button>
        <button type="button" class="lobby-btn lobby-btn-primary" data-act="admit" data-peer="${esc(w.peerId)}">Ammetti</button>
      </div>`).join('');
    c.querySelector('.lobby-all').classList.toggle('hidden', n < 2);
    const key = waiting.map(w => w.peerId).join(',');
    if (c._dismissed !== key) c.classList.remove('hidden');
    if (!tick) tick = setInterval(() => c.querySelectorAll('.lobby-since').forEach(el => el.textContent = ago(+el.dataset.since)), 1000);
  }

  function update(list, rules) {
    waiting = Array.isArray(list) ? list : [];
    // avviso sonoro + toast solo per chi è appena arrivato
    const fresh = waiting.filter(w => !known.has(w.peerId));
    known = new Set(waiting.map(w => w.peerId));
    if (fresh.length) {
      try { window.sounds?.join?.(); } catch (_) { }
      if (card) card._dismissed = null;
      fresh.forEach(w => window.showToast?.(`🚪 ${w.displayName} ${T('chiede di entrare')}`, 3500));
    }
    render();
    if (rules) window.TdtCallSettings?.onRules(rules);
  }

  window.TdtLobby = {
    bind(sock) { socket = sock; },
    load(list, rules) { known = new Set((list || []).map(w => w.peerId)); waiting = list || []; render(); if (rules) window.TdtCallSettings?.onRules(rules); },
    update,
    get waiting() { return waiting; },
    show() { if (card) { card._dismissed = null; card.classList.toggle('hidden', !waiting.length); } },
  };
})();
