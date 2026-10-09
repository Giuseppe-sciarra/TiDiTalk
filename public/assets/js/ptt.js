'use strict';

/**
 * Push-to-talk — tieni premuta la barra spaziatrice quando sei muto per
 * parlare; al rilascio il microfono torna muto. Come nei walkie-talkie e in
 * Teams/Discord. Non fa nulla se il microfono è già acceso, se stai scrivendo
 * in un campo di testo o se usi Spazio con Ctrl/Alt/Cmd.
 *
 * Si appoggia a window._tdSetMicMuted / _tdIsMicMuted esposti da room.js.
 */
(function () {
  const KEY = ' ';
  const MIN_HOLD_MS = 120;   // sotto questa soglia è un tocco involontario: si rimuta subito
  let active = false, downAt = 0, pill = null, ctx = null, pendingMute = null;

  const typing = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

  function tone(freq, ms, gain = 0.06) {
    try {
      if (window.sounds && window.sounds.muted) return;
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume().catch(() => { });
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);
      o.connect(g).connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + ms / 1000 + 0.02);
    } catch (_) { }
  }

  function showPill(on) {
    if (on) {
      if (!pill) {
        pill = document.createElement('div');
        pill.className = 'ptt-pill';
        pill.innerHTML = '<span class="ptt-dot"></span><span class="ptt-ico"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5M8.5 21.5h7"/></svg></span><span>Stai parlando: rilascia Spazio per tornare muto</span>';
        document.body.appendChild(pill);
      }
      requestAnimationFrame(() => pill?.classList.add('visible'));
    } else if (pill) {
      pill.classList.remove('visible');
    }
  }

  async function press() {
    if (active) return;
    if (!window._tdSetMicMuted) return;
    // ri-pressione subito dopo il rilascio: il mute in attesa si annulla e si resta in trasmissione
    if (pendingMute) { clearTimeout(pendingMute); pendingMute = null; active = true; downAt = Date.now(); document.body.classList.add('ptt-active'); showPill(true); return; }
    if (!window._tdIsMicMuted?.()) return;
    active = true; downAt = Date.now();
    document.body.classList.add('ptt-active');
    showPill(true);
    tone(880, 90);
    try { await window._tdSetMicMuted(false); } catch (_) { }
  }

  async function release() {
    if (!active) return;
    active = false;
    document.body.classList.remove('ptt-active');
    showPill(false);
    tone(520, 110);
    const held = Date.now() - downAt;
    const doMute = async () => { pendingMute = null; try { await window._tdSetMicMuted(true); } catch (_) { } };
    if (held < MIN_HOLD_MS) pendingMute = setTimeout(doMute, MIN_HOLD_MS - held);
    else await doMute();
  }

  window.addEventListener('keydown', (e) => {
    if (e.key !== KEY || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (typing(e.target)) return;
    if (document.body.classList.contains('ann-mode')) return;         // mentre si disegna Spazio non c'entra
    if (document.querySelector('.leave-modal:not(.hidden), .info-modal:not(.hidden), .bg-modal:not(.hidden), .cs-modal:not(.hidden)')) return;
    if (!pendingMute && !window._tdIsMicMuted?.()) return;             // mic già acceso: lascia stare
    e.preventDefault();
    press();
  }, true);
  window.addEventListener('keyup', (e) => {
    if (e.key !== KEY || !active) return;
    e.preventDefault();
    release();
  }, true);
  window.addEventListener('blur', () => { if (active) release(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && active) release(); });

  window.TdtPtt = { get active() { return active; } };
})();
