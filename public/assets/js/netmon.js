'use strict';

/**
 * Monitor di rete — finestra con grafici live della chiamata:
 *   • banda in invio / ricezione (kbps, ultimi 60 s)
 *   • latenza (RTT) e jitter in ms
 *   • perdita pacchetti, tipo di collegamento (diretto o TURN), rete del
 *     dispositivo (Wi-Fi/4G, stima del browser)
 *   • giudizio "Buona / Instabile / Scarsa" smussato (media mobile +
 *     isteresi: non sfarfalla a ogni picco)
 *
 * I dati arrivano da getStats() dei transport mediasoup esposti da room.js
 * (window._tdNetSources). Si apre dal menu "Altro" → "Rete e qualità".
 */
(function () {
  const WINDOW = 60;          // secondi di storico
  const hist = { up: [], down: [], rtt: [], jit: [], loss: [] };
  let modal = null, timer = null, prev = null, smooth = null, level = 3, levelSince = 0;

  const push = (arr, v) => { arr.push(v); if (arr.length > WINDOW) arr.shift(); };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = (name, fallback) => (getComputedStyle(document.documentElement).getPropertyValue(name) || '').trim() || fallback;

  async function sample() {
    const src = window._tdNetSources?.();
    if (!src) return null;
    const now = performance.now();
    if (prev && now - prev.now < 600) return null;   // due campioni troppo vicini (apertura finestra) → valori gonfiati
    const out = { up: 0, down: 0, rtt: null, jit: null, lossUp: null, lossDown: null, relay: null, candidate: null, rows: [] };
    let bytesUp = 0, bytesDown = 0, lostDown = 0, recvDown = 0, jitSum = 0, jitN = 0;

    // ── invio ──
    try {
      if (src.sendTransport && !src.sendTransport.closed) {
        const st = await src.sendTransport.getStats();
        const byId = new Map(); st.forEach(r => byId.set(r.id, r));
        st.forEach(r => {
          if (r.type === 'outbound-rtp') bytesUp += r.bytesSent || 0;
          if (r.type === 'remote-inbound-rtp') {
            if (Number.isFinite(r.roundTripTime)) out.rtt = Math.max(out.rtt || 0, r.roundTripTime * 1000);
            if (Number.isFinite(r.fractionLost)) out.lossUp = Math.max(out.lossUp || 0, r.fractionLost * 100);
          }
          if (r.type === 'candidate-pair' && (r.nominated || r.selected) && r.state === 'succeeded') {
            if (Number.isFinite(r.currentRoundTripTime)) out.rtt = r.currentRoundTripTime * 1000;
            const loc = byId.get(r.localCandidateId), rem = byId.get(r.remoteCandidateId);
            if (loc) { out.relay = loc.candidateType === 'relay'; out.candidate = `${loc.candidateType || '?'} · ${loc.protocol || ''}`.trim(); }
            if (rem && rem.candidateType === 'relay') out.relay = true;
          }
        });
      }
    } catch (_) { }
    // ── ricezione ──
    try {
      if (src.recvTransport && !src.recvTransport.closed) {
        const st = await src.recvTransport.getStats();
        st.forEach(r => {
          if (r.type === 'inbound-rtp') {
            bytesDown += r.bytesReceived || 0;
            lostDown += r.packetsLost || 0; recvDown += r.packetsReceived || 0;
            if (Number.isFinite(r.jitter)) { jitSum += r.jitter * 1000; jitN++; }
          }
          if (r.type === 'candidate-pair' && (r.nominated || r.selected) && r.state === 'succeeded' && out.rtt == null && Number.isFinite(r.currentRoundTripTime)) out.rtt = r.currentRoundTripTime * 1000;
        });
      }
    } catch (_) { }

    if (jitN) out.jit = jitSum / jitN;
    if (prev) {
      const dt = Math.max(0.2, (now - prev.now) / 1000);
      out.up = Math.max(0, Math.round((bytesUp - prev.bytesUp) * 8 / dt / 1000));
      out.down = Math.max(0, Math.round((bytesDown - prev.bytesDown) * 8 / dt / 1000));
      const dl = lostDown - prev.lostDown, dr = recvDown - prev.recvDown;
      out.lossDown = (dl + dr) > 0 ? Math.max(0, dl / (dl + dr) * 100) : 0;
    }
    prev = { now, bytesUp, bytesDown, lostDown, recvDown };

    // ── righe per flusso (video/audio/schermo) ──
    const seen = new Set();
    try {
      for (const [kind, p] of src.producers || []) {
        if (!p || p.closed) continue;
        let kb = 0, res = '', fps = null, layers = 0;
        const stats = await p.getStats();
        const key = 'p:' + p.id; const pb = sample._b.get(key); let bytes = 0;
        stats.forEach(r => { if (r.type === 'outbound-rtp') { bytes += r.bytesSent || 0; if (r.active !== false && (r.bytesSent || 0) > 0) layers++; if (r.frameWidth) { res = `${r.frameWidth}×${r.frameHeight}`; fps = r.framesPerSecond; } } });
        if (pb) kb = Math.max(0, Math.round((bytes - pb.bytes) * 8 / Math.max(0.2, (now - pb.t) / 1000) / 1000)); sample._b.set(key, { bytes, t: now }); seen.add(key);
        out.rows.push({ dir: '↑', label: kind === 'video' ? 'Video' : kind === 'screen' ? 'Schermo' : kind === 'screen-audio' ? 'Audio schermo' : 'Audio', kb, res, fps, extra: kind === 'video' && layers ? `${layers} layer` : '' });
      }
      for (const [, c] of src.consumers || []) {
        if (!c || c.closed) continue;
        const name = src.peerName?.(c.appData?.producerPeerId) || 'Partecipante';
        let kb = 0, res = '', fps = null;
        const stats = await c.getStats();
        const key = 'c:' + c.id; const pb = sample._b.get(key); let bytes = 0;
        stats.forEach(r => { if (r.type === 'inbound-rtp') { bytes += r.bytesReceived || 0; if (r.frameWidth) { res = `${r.frameWidth}×${r.frameHeight}`; fps = r.framesPerSecond; } } });
        if (pb) kb = Math.max(0, Math.round((bytes - pb.bytes) * 8 / Math.max(0.2, (now - pb.t) / 1000) / 1000)); sample._b.set(key, { bytes, t: now }); seen.add(key);
        const mt = c.appData?.mediaType;
        // nome e tipo in due pezzi: così il tipo si traduce
        out.rows.push({ dir: '↓', label: name, sub: mt === 'screen' ? 'schermo' : mt === 'screen-audio' ? 'audio schermo' : c.kind === 'video' ? 'video' : 'audio', kb, res, fps, extra: '' });
      }
      for (const k of [...sample._b.keys()]) if (!seen.has(k)) sample._b.delete(k);   // flussi chiusi
    } catch (_) { }
    return out;
  }
  sample._b = new Map();

  // ── giudizio smussato ──────────────────────────────────────────────────
  function judge(o) {
    let score = 3;
    const rtt = o.rtt ?? 0, jit = o.jit ?? 0, loss = Math.max(o.lossUp ?? 0, o.lossDown ?? 0);
    if (rtt > 300 || loss > 6 || jit > 60) score = 1;
    else if (rtt > 150 || loss > 2 || jit > 30) score = 2;
    smooth = smooth == null ? score : smooth * 0.7 + score * 0.3;   // media mobile esponenziale
    const target = smooth >= 2.6 ? 3 : smooth >= 1.6 ? 2 : 1;
    const now = Date.now();
    // isteresi: per cambiare giudizio serve che il nuovo valore regga 3 s
    if (target !== level) { if (!levelSince) levelSince = now; else if (now - levelSince > 3000) { level = target; levelSince = 0; } }
    else levelSince = 0;
    return level;
  }

  // ── grafici ────────────────────────────────────────────────────────────
  function drawChart(canvas, series, opts) {
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W || !H) return;
    if (canvas.width !== W * dpr || canvas.height !== H * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const pad = { l: 44, r: 8, t: 8, b: 18 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    let max = opts.min || 1;
    series.forEach(s => s.data.forEach(v => { if (Number.isFinite(v) && v > max) max = v; }));
    max = niceMax(max);
    const grid = css('--hair-2', 'rgba(255,255,255,.14)'), txt = css('--paper-3', '#888');
    ctx.strokeStyle = grid; ctx.lineWidth = 1; ctx.fillStyle = txt; ctx.font = '11px ' + (css('--font', 'system-ui'));
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let i = 0; i <= 3; i++) {
      const y = pad.t + ih - ih * i / 3;
      ctx.beginPath(); ctx.moveTo(pad.l, y + .5); ctx.lineTo(W - pad.r, y + .5); ctx.stroke();
      ctx.fillText(fmt(max * i / 3, opts.unit), pad.l - 6, y);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('60 s', pad.l, pad.t + ih + 4); ctx.fillText((window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t('ora') : 'ora', W - pad.r, pad.t + ih + 4);
    series.forEach(s => {
      ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath(); let started = false;
      for (let i = 0; i < WINDOW; i++) {
        const idx = i - (WINDOW - s.data.length); const v = idx >= 0 ? s.data[idx] : null;
        if (!Number.isFinite(v)) { started = false; continue; }
        const x = pad.l + iw * i / (WINDOW - 1), y = pad.t + ih - ih * Math.min(1, v / max);
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
      if (s.fill) {
        ctx.globalAlpha = .12; ctx.fillStyle = s.color;
        ctx.lineTo(W - pad.r, pad.t + ih); ctx.lineTo(pad.l + iw * Math.max(0, WINDOW - s.data.length) / (WINDOW - 1), pad.t + ih); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
      }
    });
  }
  function niceMax(v) { const p = Math.pow(10, Math.floor(Math.log10(Math.max(1, v)))); const n = v / p; const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10; return m * p; }
  function fmt(v, unit) { if (unit === 'kbps') return v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + ' M' : Math.round(v) + ' k'; return Math.round(v) + (unit ? ' ' + unit : ''); }

  // ── finestra ───────────────────────────────────────────────────────────
  function build() {
    modal = document.createElement('div');
    modal.id = 'netMonModal';
    modal.className = 'netmon-modal hidden';
    modal.innerHTML = `
      <div class="netmon-card" role="dialog" aria-labelledby="netMonTitle">
        <div class="netmon-head">
          <h3 id="netMonTitle">Rete e qualità</h3>
          <span class="netmon-badge" id="nmBadge" data-level="3"><i></i><i></i><i></i><span>Connessione buona</span></span>
          <button type="button" class="netmon-close" id="nmClose" aria-label="Chiudi">✕</button>
        </div>
        <div class="netmon-kpis">
          <div class="nm-kpi"><span class="nm-k">Invio</span><b id="nmUp">—</b><span class="nm-u">kbps</span></div>
          <div class="nm-kpi"><span class="nm-k">Ricezione</span><b id="nmDown">—</b><span class="nm-u">kbps</span></div>
          <div class="nm-kpi"><span class="nm-k">Latenza</span><b id="nmRtt">—</b><span class="nm-u">ms</span></div>
          <div class="nm-kpi"><span class="nm-k">Jitter</span><b id="nmJit">—</b><span class="nm-u">ms</span></div>
          <div class="nm-kpi"><span class="nm-k">Persi</span><b id="nmLoss">—</b><span class="nm-u">%</span></div>
        </div>
        <div class="netmon-sec"><span>Banda</span><span class="nm-legend"><i style="--c:var(--accent)"></i>Invio <i style="--c:var(--ok)"></i>Ricezione</span></div>
        <canvas class="netmon-chart" id="nmChartBw" height="120"></canvas>
        <div class="netmon-sec"><span>Latenza e jitter</span><span class="nm-legend"><i style="--c:var(--warn)"></i>Latenza <i style="--c:var(--paper-2)"></i>Jitter</span></div>
        <canvas class="netmon-chart" id="nmChartLat" height="100"></canvas>
        <div class="netmon-sec"><span>Flussi</span></div>
        <div class="netmon-rows" id="nmRows"></div>
        <div class="netmon-foot" id="nmFoot"></div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    modal.querySelector('#nmClose').addEventListener('click', close);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) close(); });
  }

  function render(o) {
    if (!modal || !o) return;
    const q = (id) => modal.querySelector(id);
    q('#nmUp').textContent = o.up; q('#nmDown').textContent = o.down;
    q('#nmRtt').textContent = o.rtt == null ? '—' : Math.round(o.rtt);
    q('#nmJit').textContent = o.jit == null ? '—' : Math.round(o.jit);
    const loss = Math.max(o.lossUp ?? 0, o.lossDown ?? 0);
    q('#nmLoss').textContent = (o.lossUp == null && o.lossDown == null) ? '—' : loss.toFixed(loss < 10 ? 1 : 0);
    const lvl = level;
    const badge = q('#nmBadge'); badge.dataset.level = lvl;
    badge.querySelector('span').textContent = lvl === 3 ? 'Connessione buona' : lvl === 2 ? 'Connessione instabile' : 'Connessione scarsa';
    drawChart(q('#nmChartBw'), [{ data: hist.up, color: css('--accent', '#7b5ea7'), fill: true }, { data: hist.down, color: css('--ok', '#58b98c'), fill: true }], { unit: 'kbps', min: 100 });
    drawChart(q('#nmChartLat'), [{ data: hist.rtt, color: css('--warn', '#e8b04a') }, { data: hist.jit, color: css('--paper-2', '#aaa') }], { unit: 'ms', min: 50 });
    q('#nmRows').innerHTML = o.rows.length ? o.rows.map(r =>
      `<div class="nm-row"><span class="nm-dir">${r.dir}</span><span class="nm-lbl">${esc(r.label)}${r.sub ? ` · <span>${esc(r.sub)}</span>` : ''}</span><span class="nm-val">${r.kb} kbps</span><span class="nm-res">${esc(r.res || '')}${r.fps ? ` · ${Math.round(r.fps)} fps` : ''}${r.extra ? ` · ${esc(r.extra)}` : ''}</span></div>`
    ).join('') : '<div class="nm-row nm-empty">Nessun flusso attivo</div>';
    const conn = navigator.connection || {};
    const parts = [];
    if (o.candidate) parts.push(o.relay ? 'Collegamento tramite server TURN (relay): la rete blocca il percorso diretto' : `Collegamento diretto (${esc(o.candidate)})`);
    if (conn.effectiveType) parts.push(`Rete del dispositivo: ${esc(conn.effectiveType)}${conn.downlink ? ` · ~${conn.downlink} Mbps` : ''}${conn.saveData ? ' · risparmio dati attivo' : ''}`);
    q('#nmFoot').innerHTML = parts.map(p => `<div>${p}</div>`).join('');
  }

  let lastSample = null, busy = false;
  async function tick() {
    if (busy) return;                       // getStats su molti flussi può durare più di 1 s
    busy = true;
    let o = null;
    try { o = await sample(); } finally { busy = false; }
    if (!o) return;
    lastSample = o;
    judge(o);                               // giudizio smussato aggiornato anche a finestra chiusa
    push(hist.up, o.up); push(hist.down, o.down);
    push(hist.rtt, o.rtt); push(hist.jit, o.jit);
    push(hist.loss, Math.max(o.lossUp ?? 0, o.lossDown ?? 0));
    if (isOpen()) render(o);
  }

  function isOpen() { return !!modal && !modal.classList.contains('hidden'); }
  function open() {
    if (!modal) build();
    modal.classList.remove('hidden');
    requestAnimationFrame(() => modal.classList.add('visible'));
    start();
    if (lastSample) render(lastSample); else tick();
  }
  function close() {
    if (!modal) return;
    modal.classList.remove('visible');
    setTimeout(() => modal.classList.add('hidden'), 180);
  }
  function toggle() { isOpen() ? close() : open(); }

  // campionamento continuo (anche a finestra chiusa) così lo storico è già
  // pieno quando la si apre, e il giudizio smussato è stabile
  function start() { if (timer) return; timer = setInterval(tick, 1000); }
  function stop() { clearInterval(timer); timer = null; }

  window.TdtNetMon = { open, close, toggle, start, stop, get level() { return level; }, get history() { return hist; } };
  // parte da solo appena room.js espone le sorgenti
  const boot = setInterval(() => { if (window._tdNetSources?.()) { clearInterval(boot); start(); } }, 1500);
})();
