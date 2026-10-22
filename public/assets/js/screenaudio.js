/* ═══════════════════════════════════════════════════════════════════════════
   1.8.7 — Audio di quello che presenti
   • chiede al browser l'audio della scheda / del sistema senza i filtri da voce
     (cancellazione eco, riduzione rumore e volume automatico rovinano musica e
     video) e con «Condividi l'audio di sistema» dove il browser lo permette;
   • se la presentazione parte SENZA audio lo dice a chi presenta, con cosa fare
     nel suo browser (scheda con «Condividi anche l'audio», schermo intero su
     Windows, Firefox e Safari che non lo permettono);
   • «Usa un dispositivo audio»: manda come audio della presentazione un ingresso
     audio a scelta (es. BlackHole sul Mac per far sentire DaVinci Resolve o un
     altro programma), stereo e senza filtri;
   • sul riquadro «Il tuo schermo» una pillola dice se gli altri sentono l'audio.
   room.js: captureOpts() nella getDisplayMedia, started()/stopped() all'avvio e
   alla fine, _tdSetScreenAudioTrack(track) per mandare l'audio scelto.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const T = (s) => (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t(s) : s;
  const ua = navigator.userAgent;
  const isFirefox = /Firefox\//.test(ua);
  const isSafari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(ua);
  const isMac = /Mac OS X/.test(ua), isWin = /Windows/.test(ua);
  const VIRTUAL = /blackhole|loopback|soundflower|vb-?audio|cable|stereo mix|missaggio stereo|virtual|monitor of/i;
  const toast = (m, d) => window.showToast?.(T(m), d || 3000);

  let card = null, extra = null, hasAudio = false, saidOk = false, cardShown = false, cardT = null;

  function captureOpts() {
    return {
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      systemAudio: 'include',        // Chrome/Edge: «Condividi l'audio di sistema» con lo schermo intero
      windowAudio: 'system',         // Chrome recenti: audio anche condividendo una finestra
      surfaceSwitching: 'include',   // cambiare scheda senza fermare la presentazione
      selfBrowserSurface: 'exclude', // non la scheda della riunione (rimbomberebbe)
      preferCurrentTab: false,
    };
  }

  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function helpText() {
    if (isFirefox) return T('Firefox non può condividere l\'audio dello schermo. Per un video con l\'audio presenta da Chrome o Edge, oppure manda l\'audio da un dispositivo (per esempio BlackHole sul Mac).');
    if (isSafari) return T('Safari non può condividere l\'audio dello schermo. Per un video con l\'audio presenta da Chrome o Edge, oppure manda l\'audio da un dispositivo (per esempio BlackHole sul Mac).');
    const tab = T('Video nel browser (YouTube…): presenta di nuovo, scegli la scheda e lascia acceso «Condividi anche l\'audio della scheda».');
    const app = isWin
      ? T('Un programma (DaVinci Resolve…): presenta di nuovo, scegli «Schermo intero» e accendi «Condividi anche l\'audio di sistema».')
      : isMac
        ? T('Un programma (DaVinci Resolve…): sul Mac il browser non prende l\'audio dei programmi; serve un dispositivo audio virtuale, per esempio BlackHole (gratuito), da scegliere con «Usa un dispositivo audio».')
        : T('Un programma: presenta di nuovo, scegli «Schermo intero» e accendi l\'audio, se il browser lo propone; altrimenti usa un dispositivo audio.');
    return `${tab}<br>${app}`;
  }

  function closeCard() { clearTimeout(cardT); if (card) { card.remove(); card = null; } }

  function showCard() {
    closeCard();
    card = el('div', 'sa-card');
    card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', T('Audio della presentazione'));
    const canRe = !isFirefox && !isSafari;
    card.innerHTML = `
      <div class="sa-head"><span class="sa-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg></span>
        <b>${esc(T('Gli altri non sentono l\'audio di quello che presenti'))}</b>
        <button type="button" class="sa-x" aria-label="${esc(T('Chiudi'))}" data-tip="${esc(T('Chiudi'))}">×</button></div>
      <div class="sa-text">${helpText()}</div>
      <div class="sa-acts">
        ${canRe ? `<button type="button" class="sa-btn sa-main" data-a="again">${esc(T('Presenta di nuovo con l\'audio'))}</button>` : ''}
        <button type="button" class="sa-btn" data-a="device">${esc(T('Usa un dispositivo audio'))}</button>
      </div>
      <div class="sa-dev hidden">
        <label class="sa-lbl" for="saDevSel">${esc(T('Audio da mandare agli altri'))}</label>
        <div class="sa-row"><select id="saDevSel" class="sa-sel"></select><button type="button" class="sa-btn sa-main" data-a="use">${esc(T('Manda questo audio'))}</button></div>
        <div class="sa-hint">${esc(T('Scegli il dispositivo virtuale in cui fai uscire l\'audio del programma, non il microfono.'))}</div>
      </div>`;
    card.addEventListener('click', onClick);
    document.body.appendChild(card);
    // si chiude da solo dopo 40 s se non lo si usa (resta la pillola «Senza audio»)
    cardT = setTimeout(() => { if (card && card.querySelector('.sa-dev.hidden')) closeCard(); }, 40000);
  }

  async function fillDevices() {
    const sel = card?.querySelector('#saDevSel'); if (!sel) return;
    let list = [];
    try { list = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications'); } catch (_) { }
    sel.innerHTML = list.length ? list.map(d => `<option value="${esc(d.deviceId)}">${esc(d.label || T('Ingresso audio'))}</option>`).join('') : `<option value="">${esc(T('Nessun ingresso audio trovato'))}</option>`;
    const v = list.find(d => VIRTUAL.test(d.label || ''));
    if (v) sel.value = v.deviceId;
  }

  async function useDevice() {
    const sel = card?.querySelector('#saDevSel'); const id = sel?.value; if (!id) return;
    const label = sel.options[sel.selectedIndex]?.textContent || '';
    try {
      const st = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: id }, echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 2 }, sampleRate: { ideal: 48000 } } });
      const tr = st.getAudioTracks()[0];
      try { tr.contentHint = 'music'; } catch (_) { }
      await window._tdSetScreenAudioTrack(tr);
      stopExtra(); extra = st; hasAudio = true;
      closeCard(); paintChip();
      window.showToast?.(T('Ora gli altri sentono: {0}').replace('{0}', label), 3500);
    } catch (e) { toast(e?.message || 'Non riesco ad aprire questo ingresso audio', 3500); }
  }

  function onClick(e) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.classList.contains('sa-x')) { closeCard(); return; }
    const a = b.dataset.a;
    if (a === 'again') { closeCard(); window._tdRestartScreenShare?.(); }
    else if (a === 'device') { card.querySelector('.sa-dev')?.classList.remove('hidden'); b.classList.add('hidden'); fillDevices(); }
    else if (a === 'use') useDevice();
  }

  // pillola sul riquadro «Il tuo schermo»: con o senza audio (clic = aiuto)
  function paintChip() {
    const tile = document.querySelector('[data-peer-id="local-screen"]'); if (!tile) return;
    let c = tile.querySelector('.sa-chip');
    if (!c) { c = el('button', 'sa-chip'); c.type = 'button'; c.addEventListener('click', (e) => { e.stopPropagation(); if (!hasAudio) showCard(); }); tile.appendChild(c); }
    c.classList.toggle('on', hasAudio);
    c.innerHTML = hasAudio
      ? `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9a4.5 4.5 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg><span>${esc(T('Con audio'))}</span>`
      : `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg><span>${esc(T('Senza audio'))}</span>`;
    c.setAttribute('aria-label', hasAudio ? T('Gli altri sentono anche l\'audio di quello che presenti') : T('Gli altri non sentono l\'audio di quello che presenti: come fare'));
    c.dataset.tip = c.getAttribute('aria-label');
  }

  function stopExtra() { if (extra) { try { extra.getTracks().forEach(t => t.stop()); } catch (_) { } extra = null; } }

  function started(stream, audioOn) {
    hasAudio = !!audioOn;
    setTimeout(paintChip, 0);
    if (hasAudio) { if (!saidOk) { saidOk = true; toast('Gli altri sentono anche l\'audio di quello che presenti', 3000); } closeCard(); }
    else if (!cardShown) { cardShown = true; showCard(); }   // la prima volta: poi basta la pillola
  }
  function stopped() { stopExtra(); closeCard(); hasAudio = false; }

  window.TdtScreenAudio = { captureOpts, started, stopped, showCard };
})();
