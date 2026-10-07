'use strict';

/**
 * Sondaggi — pannello laterale (stesso aspetto della chat).
 *   • Gli organizzatori creano un sondaggio (domanda + 2-10 opzioni, anonimo
 *     o con i nomi), lo chiudono e lo eliminano.
 *   • Tutti votano con un tocco; si può cambiare voto finché è aperto.
 *   • Risultati live con barre e percentuali; nei sondaggi non anonimi si
 *     vede chi ha scelto cosa.
 * Server: pollCreate / pollVote / pollClose / pollDelete → pollUpdate / pollDeleted.
 */
(function () {
  const polls = new Map();        // id → vista pubblica (con myVote)
  let panel = null, open = false, unseen = 0, socket = null;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isHost = () => !!window.__isHostRole;
  const T = (s) => (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t(s) : s;
  const ICO_X = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  function build() {
    panel = document.createElement('aside');
    panel.id = 'pollsPanel';
    panel.className = 'chat-panel polls-panel hidden';
    panel.innerHTML = `
      <div class="chat-header">
        <span>Sondaggi</span>
        <button class="btn-icon" id="btnClosePolls" data-tip="Chiudi">${ICO_X}</button>
      </div>
      <div class="polls-body" id="pollsBody"></div>
      <div class="polls-footer" id="pollsFooter"></div>`;
    (document.getElementById('roomLayout') || document.body).appendChild(panel);
    panel.querySelector('#btnClosePolls').addEventListener('click', () => toggle(false));
    renderFooter();
    render();
  }

  // ── footer: pulsante "Nuovo sondaggio" (solo organizzatori) + form ──────
  function renderFooter() {
    const f = panel.querySelector('#pollsFooter');
    if (!isHost()) { f.innerHTML = `<div class="polls-hint">Gli organizzatori possono creare sondaggi; qui vedi quelli attivi e voti con un tocco.</div>`; return; }
    f.innerHTML = `<button type="button" class="polls-new" id="pollsNew">+ <span>Nuovo sondaggio</span></button>`;
    f.querySelector('#pollsNew').addEventListener('click', showForm);
  }

  function showForm() {
    const f = panel.querySelector('#pollsFooter');
    f.innerHTML = `
      <form class="polls-form" id="pollsForm" autocomplete="off">
        <label class="polls-lbl">Domanda</label>
        <input type="text" class="polls-input" id="pfQ" maxlength="200" placeholder="Es. A che ora facciamo la prossima riunione?" required>
        <label class="polls-lbl">Opzioni</label>
        <div class="polls-opts" id="pfOpts">
          <input type="text" class="polls-input" maxlength="80" placeholder="Opzione 1" required>
          <input type="text" class="polls-input" maxlength="80" placeholder="Opzione 2" required>
        </div>
        <button type="button" class="polls-link" id="pfAdd">+ <span>Aggiungi opzione</span></button>
        <label class="polls-check"><input type="checkbox" id="pfAnon" checked> <span>Voto anonimo (non si vede chi ha scelto cosa)</span></label>
        <div class="polls-form-actions">
          <button type="button" class="polls-btn polls-btn-ghost" id="pfCancel">Annulla</button>
          <button type="submit" class="polls-btn polls-btn-primary">Avvia sondaggio</button>
        </div>
      </form>`;
    const opts = f.querySelector('#pfOpts');
    f.querySelector('#pfAdd').addEventListener('click', () => {
      if (opts.children.length >= 10) return;
      const i = document.createElement('input');
      i.type = 'text'; i.className = 'polls-input'; i.maxLength = 80; i.placeholder = T('Opzione') + ' ' + (opts.children.length + 1);
      opts.appendChild(i); i.focus();
    });
    f.querySelector('#pfCancel').addEventListener('click', renderFooter);
    f.querySelector('#pollsForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const question = f.querySelector('#pfQ').value.trim();
      const options = [...opts.querySelectorAll('input')].map(i => i.value.trim()).filter(Boolean);
      if (!question || options.length < 2) { window.showToast?.('Scrivi la domanda e almeno due opzioni', 2500); return; }
      const btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
      socket?.emit('pollCreate', { question, options, anonymous: f.querySelector('#pfAnon').checked }, (res) => {
        btn.disabled = false;
        if (res?.error) { window.showToast?.(res.error, 3000); return; }
        renderFooter();
      });
    });
    setTimeout(() => f.querySelector('#pfQ')?.focus(), 50);
    // le scorciatoie da tastiera della stanza non devono scattare mentre si scrive
    f.querySelectorAll('input').forEach(i => i.addEventListener('keydown', ev => ev.stopPropagation()));
  }

  // ── lista sondaggi ──────────────────────────────────────────────────────
  function render() {
    if (!panel) return;
    const body = panel.querySelector('#pollsBody');
    const list = [...polls.values()].sort((a, b) => (b.open - a.open) || (b.createdAt - a.createdAt));
    if (!list.length) {
      body.innerHTML = `<div class="polls-empty"><div class="polls-empty-ico">📊</div><div>Nessun sondaggio per ora.</div>${isHost() ? '<div class="polls-hint">Premi «Nuovo sondaggio» qui sotto per farne uno.</div>' : ''}</div>`;
      return;
    }
    body.innerHTML = list.map(p => {
      const total = p.total || 0;
      const opts = p.options.map(o => {
        const n = p.counts?.[o.id] || 0;
        const pct = total ? Math.round(n * 100 / total) : 0;
        const mine = p.myVote === o.id;
        const names = p.voters && p.voters[o.id]?.length ? `<div class="poll-voters">${p.voters[o.id].map(esc).join(', ')}</div>` : '';
        return `<button type="button" class="poll-opt ${mine ? 'mine' : ''} ${p.open ? '' : 'closed'}" data-poll="${esc(p.id)}" data-opt="${esc(o.id)}" ${p.open ? '' : 'disabled'}>
          <span class="poll-bar" style="width:${pct}%"></span>
          <span class="poll-opt-row"><span class="poll-opt-text">${mine ? '✓ ' : ''}${esc(o.text)}</span><span class="poll-opt-n">${pct}% <small>(${n})</small></span></span>
          ${names}
        </button>`;
      }).join('');
      const when = new Date(p.createdAt).toLocaleTimeString(window.I18n?.locale, { hour: '2-digit', minute: '2-digit' });
      const actions = isHost() ? `<div class="poll-actions">
          ${p.open ? `<button type="button" class="polls-link" data-act="close" data-poll="${esc(p.id)}">Chiudi votazione</button>` : ''}
          <button type="button" class="polls-link danger" data-act="delete" data-poll="${esc(p.id)}">Elimina</button>
        </div>` : '';
      return `<div class="poll ${p.open ? 'open' : 'closed'}" data-id="${esc(p.id)}">
        <div class="poll-head">
          <span class="poll-state">${p.open ? 'In corso' : 'Chiuso'}</span>
          <span class="poll-meta">${esc(p.createdByName || '')} · ${when}${p.anonymous ? '' : ' · <span>con nomi</span>'}</span>
        </div>
        <div class="poll-q">${esc(p.question)}</div>
        <div class="poll-opts">${opts}</div>
        <div class="poll-total"><span>${total}</span> <span>${total === 1 ? 'voto' : 'voti'}</span>${p.open && p.myVote == null ? ' · <span>Tocca un\'opzione per votare</span>' : ''}${p.open && p.myVote != null ? ' · <span>Puoi cambiare voto finché è aperto</span>' : ''}</div>
        ${actions}
      </div>`;
    }).join('');
    body.querySelectorAll('.poll-opt:not([disabled])').forEach(b => b.addEventListener('click', () => vote(b.dataset.poll, b.dataset.opt)));
    body.querySelectorAll('[data-act="close"]').forEach(b => b.addEventListener('click', () => socket?.emit('pollClose', { pollId: b.dataset.poll }, (r) => { if (r?.error) window.showToast?.(r.error, 2500); })));
    body.querySelectorAll('[data-act="delete"]').forEach(b => b.addEventListener('click', () => {
      if (!confirm(T('Eliminare questo sondaggio per tutti?'))) return;
      socket?.emit('pollDelete', { pollId: b.dataset.poll }, (r) => { if (r?.error) window.showToast?.(r.error, 2500); });
    }));
  }

  function vote(pollId, optionId) {
    const p = polls.get(pollId); if (!p || !p.open) return;
    if (p.myVote === optionId) return;
    socket?.emit('pollVote', { pollId, optionId }, (r) => { if (r?.error) window.showToast?.(r.error, 2500); });
  }

  function updateBadge() {
    const b = document.getElementById('pollsBadge');
    if (b) { b.textContent = unseen; b.classList.toggle('hidden', !unseen); }
    document.getElementById('btnMore')?.classList.toggle('has-badge', !!unseen);
  }

  // ── API ─────────────────────────────────────────────────────────────────
  function load(list) {
    polls.clear();
    (list || []).forEach(p => polls.set(p.id, p));
    if (panel) render();
    if (!open) { unseen = (list || []).filter(p => p.open && p.myVote == null).length; updateBadge(); }
  }
  function toggle(force) {
    if (!panel) build();
    open = typeof force === 'boolean' ? force : !open;
    panel.classList.toggle('hidden', !open);
    if (open) { unseen = 0; updateBadge(); render(); }
  }
  function bind(sock) {
    socket = sock;
    sock.on('pollUpdate', ({ poll }) => {
      if (!poll) return;
      const prev = polls.get(poll.id);
      polls.set(poll.id, poll);
      if (!prev && poll.createdBy !== sock.id) {
        window.showToast?.(T('Nuovo sondaggio') + ': ' + poll.question, 4500);
        try { window.sounds?.chat?.(); } catch (_) { }
        if (!open) { unseen++; updateBadge(); }
      } else if (prev && prev.open && !poll.open && poll.createdBy !== sock.id) {
        window.showToast?.(T('Sondaggio chiuso') + ': ' + poll.question, 3000);
      }
      if (panel) render();
    });
    sock.on('pollDeleted', ({ pollId }) => { polls.delete(pollId); if (panel) render(); });
  }

  window.TdtPolls = { load, toggle, bind, get open() { return open; } };
})();
