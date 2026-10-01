'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   Finestra mobile della riunione (Document Picture-in-Picture)
   ───────────────────────────────────────────────────────────────────────────
   Prima, cambiando scheda, il browser tirava fuori UN solo video (quello che
   decideva lui). Ora:
   • il PiP del singolo video è disattivato su tutti i riquadri;
   • al posto suo si apre una finestra mobile con TUTTA la riunione: tutti i
     partecipanti, chi parla evidenziato, e i comandi microfono / camera /
     mano / esci / torna alla riunione;
   • su Chrome ed Edge si apre da sola quando cambi scheda (come Google Meet),
     oppure a mano da Altro → Finestra mobile;
   • su Firefox e Safari la Document PiP non esiste: niente finestra, e niente
     più singolo video strappato fuori.

   La finestra NON sposta gli elementi della pagina: li rispecchia (stessi
   MediaStream, nessun costo di rete in più) e i pulsanti premono quelli veri.
   Così la stanza non si rompe mai, qualunque cosa succeda alla finestra.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  const SUPPORTED = 'documentPictureInPicture' in window;
  let pipWin = null;
  let mo = null;
  let raf = 0;
  const pipTiles = new Map(); // peerId → { el, video, stream }

  const ICON = {
    mic: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5"/></svg>',
    micOff: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M9 9v2a3 3 0 0 0 5.1 2.1M15 10.3V5.5a3 3 0 0 0-5.8-1"/><path d="M5 11a7 7 0 0 0 11.3 5.5M12 18v3.5"/></svg>',
    cam: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10.5l6-3.5v10l-6-3.5z"/></svg>',
    camOff: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M15.5 12.5v3a2.5 2.5 0 0 1-2.5 2.5H5a2.5 2.5 0 0 1-2.5-2.5v-7A2.5 2.5 0 0 1 5 6h1.5M10.5 6H13a2.5 2.5 0 0 1 2.5 2.5v1l6-3.5v10"/></svg>',
    hand: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6.5a1.8 1.8 0 0 0-3.6 0V11M14.4 10V4.5a1.8 1.8 0 0 0-3.6 0V10M10.8 10.5V6a1.8 1.8 0 0 0-3.6 0v8.5"/><path d="M18 8.5a1.8 1.8 0 0 1 3.6 0V14a8 8 0 0 1-8 8h-1.5c-2.6 0-4.2-.9-5.6-2.3l-3.4-3.4a1.8 1.8 0 0 1 2.6-2.6L7.2 15.2"/></svg>',
    back: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M11 14l-3-3 3-3M8 11h8"/></svg>',
    leave: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.7 13.3a16 16 0 0 0 3.4 2.6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3.6 3.9a2 2 0 0 1 2-2.1h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.4 2.1L9.6 9.7" transform="rotate(135 12 12)"/></svg>',
  };

  // ── Il PiP del singolo <video> non deve più scattare ─────────────────────
  function disableVideoPip(root) {
    (root.querySelectorAll ? root.querySelectorAll('video') : []).forEach(v => {
      try { v.disablePictureInPicture = true; } catch (_) { }
      v.setAttribute('disablepictureinpicture', '');
      v.setAttribute('disableremoteplayback', '');
    });
  }
  function watchVideos() {
    disableVideoPip(document);
    new MutationObserver((muts) => {
      for (const m of muts) m.addedNodes.forEach(n => {
        if (n.nodeType !== 1) return;
        if (n.tagName === 'VIDEO') disableVideoPip(n.parentNode || document);
        else disableVideoPip(n);
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  // ── Stili della finestra (autonomi: la finestra non eredita la pagina) ───
  function css(accent) {
    return `
:root{color-scheme:dark;--accent:${accent || '#7b5ea7'}}
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:#121318;color:#ece7dc;font:500 13px/1.3 system-ui,-apple-system,"Segoe UI",sans-serif;overflow:hidden}
.wrap{display:flex;flex-direction:column;height:100%}
.grid{flex:1;min-height:0;display:flex;flex-wrap:wrap;align-content:center;justify-content:center;gap:6px;padding:6px}
.t{position:relative;background:#1f222b;border-radius:10px;overflow:hidden;border:1px solid rgba(236,231,220,.08)}
.t.speaking{box-shadow:0 0 0 2px var(--accent)}
.t video{width:100%;height:100%;object-fit:cover;display:block;background:#0b0c0f}
.t.portrait video{object-fit:contain}
.t .av{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.t .av span{width:44px;height:44px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px}
.t .n{position:absolute;left:6px;bottom:6px;max-width:80%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:rgba(14,15,19,.65);padding:2px 8px;border-radius:999px;font-size:11px}
.t .m{position:absolute;right:6px;bottom:6px;width:20px;height:20px;border-radius:50%;background:#c94a44;display:none;align-items:center;justify-content:center}
.t .m svg{width:12px;height:12px;color:#fff}
.t.muted .m{display:flex}
.bar{display:flex;justify-content:center;gap:6px;padding:6px 8px 8px}
.bar button{width:36px;height:36px;border-radius:50%;border:none;background:#282c37;color:#ece7dc;cursor:pointer;display:flex;align-items:center;justify-content:center}
.bar button:hover{background:#343947}
.bar button.off{background:#c94a44;color:#fff}
.bar button.on{background:var(--accent);color:#fff}
.bar button.leave{background:#e5534b;color:#fff;width:46px;border-radius:999px}
.empty{opacity:.6;font-size:12px}
`;
  }

  function initials(name) {
    return String(name || '?').trim().split(/\s+/).map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '?';
  }

  // ── Lettura dello stato della stanza principale ──────────────────────────
  function readTiles() {
    const out = [];
    document.querySelectorAll('#videoGrid .video-tile').forEach(tile => {
      const id = tile.dataset.peerId;
      if (!id) return;
      const v = tile.querySelector('video');
      const visible = v && v.srcObject && v.style.display !== 'none' && getComputedStyle(v).display !== 'none';
      const nameEl = tile.querySelector('.tile-name-always');
      const name = nameEl ? nameEl.textContent.replace(/\s*·\s*tu\s*$/i, '').trim() : '';
      const muted = !!tile.querySelector('.tile-mute-badge.visible');
      out.push({
        id, name: id === 'local' ? (name || 'Tu') : name,
        stream: visible ? v.srcObject : null,
        speaking: tile.classList.contains('is-speaking'),
        portrait: tile.classList.contains('is-portrait'),
        screen: tile.classList.contains('screenshare'),
        muted,
      });
    });
    // lo schermo condiviso per primo, poi chi parla, poi gli altri
    out.sort((a, b) => (b.screen - a.screen) || (b.speaking - a.speaking));
    return out;
  }

  function layout(doc, n) {
    const grid = doc.querySelector('.grid');
    if (!grid || !n) return;
    const W = grid.clientWidth - 12, H = grid.clientHeight - 12, gap = 6, R = 16 / 9;
    let best = { w: 0, cols: 1 };
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const w = Math.floor(Math.min((W - gap * (cols - 1)) / cols, ((H - gap * (rows - 1)) / rows) * R));
      if (w > best.w) best = { w, cols };
    }
    const w = Math.max(80, best.w), h = Math.floor(w / R);
    grid.querySelectorAll('.t').forEach(t => { t.style.width = w + 'px'; t.style.height = h + 'px'; });
  }

  function render() {
    raf = 0;
    if (!pipWin || pipWin.closed) return;
    const doc = pipWin.document;
    const grid = doc.querySelector('.grid');
    const data = readTiles();
    const seen = new Set();

    data.forEach((d, i) => {
      seen.add(d.id);
      let entry = pipTiles.get(d.id);
      if (!entry) {
        const el = doc.createElement('div');
        el.className = 't';
        el.innerHTML = `<video autoplay playsinline muted></video><div class="av"><span></span></div><div class="n"></div><div class="m">${ICON.micOff}</div>`;
        const video = el.querySelector('video');
        video.disablePictureInPicture = true;
        entry = { el, video, stream: null };
        pipTiles.set(d.id, entry);
      }
      const { el, video } = entry;
      if (grid.children[i] !== el) grid.insertBefore(el, grid.children[i] || null);
      if (entry.stream !== d.stream) {
        entry.stream = d.stream;
        video.srcObject = d.stream || null;
        if (d.stream) video.play().catch(() => { });
      }
      video.style.display = d.stream ? 'block' : 'none';
      el.querySelector('.av').style.display = d.stream ? 'none' : 'flex';
      el.querySelector('.av span').textContent = initials(d.name);
      el.querySelector('.n').textContent = d.screen ? `Schermo di ${d.name}` : (d.id === 'local' ? `${d.name} · tu` : d.name);
      el.classList.toggle('speaking', d.speaking);
      el.classList.toggle('portrait', d.portrait);
      el.classList.toggle('muted', d.muted);
    });

    for (const [id, entry] of pipTiles) {
      if (!seen.has(id)) { try { entry.video.srcObject = null; } catch (_) { } entry.el.remove(); pipTiles.delete(id); }
    }
    let empty = grid.querySelector('.empty');
    if (!data.length && !empty) { empty = doc.createElement('div'); empty.className = 'empty'; empty.textContent = 'Nessun partecipante'; grid.appendChild(empty); }
    if (data.length && empty) empty.remove();

    layout(doc, data.length);
    syncButtons();
  }
  const schedule = () => { if (!raf && pipWin) raf = requestAnimationFrame(render); };

  function syncButtons() {
    if (!pipWin) return;
    const doc = pipWin.document;
    const mainMic = document.getElementById('btnMic');
    const mainCam = document.getElementById('btnCamera');
    const mainHand = document.getElementById('btnHand');
    const micOff = !!mainMic?.classList.contains('off');
    const camOff = !!mainCam?.classList.contains('off');
    const b = (id) => doc.getElementById(id);
    if (b('pMic')) { b('pMic').classList.toggle('off', micOff); b('pMic').innerHTML = micOff ? ICON.micOff : ICON.mic; }
    if (b('pCam')) { b('pCam').classList.toggle('off', camOff); b('pCam').innerHTML = camOff ? ICON.camOff : ICON.cam; }
    if (b('pHand')) b('pHand').classList.toggle('on', !!mainHand?.classList.contains('active'));
  }

  async function open() {
    if (!SUPPORTED) { window.showToast?.('La finestra mobile funziona su Chrome ed Edge', 3500); return; }
    if (pipWin && !pipWin.closed) { try { pipWin.focus(); } catch (_) { } return; }
    try {
      pipWin = await window.documentPictureInPicture.requestWindow({ width: 440, height: 320 });
    } catch (e) {
      console.warn('[pip] apertura non riuscita:', e?.message);
      return;
    }
    const doc = pipWin.document;
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    doc.title = document.title;
    const st = doc.createElement('style'); st.textContent = css(accent); doc.head.appendChild(st);
    doc.body.innerHTML = `
      <div class="wrap">
        <div class="grid"></div>
        <div class="bar">
          <button id="pMic" title="Microfono (M)"></button>
          <button id="pCam" title="Videocamera (V)"></button>
          <button id="pHand" title="Alza la mano">${ICON.hand}</button>
          <button id="pBack" title="Torna alla riunione">${ICON.back}</button>
          <button id="pLeave" class="leave" title="Esci dalla riunione">${ICON.leave}</button>
        </div>
      </div>`;
    const press = (id) => document.getElementById(id)?.click();
    doc.getElementById('pMic').onclick = () => { press('btnMic'); setTimeout(syncButtons, 150); };
    doc.getElementById('pCam').onclick = () => { press('btnCamera'); setTimeout(syncButtons, 150); };
    doc.getElementById('pHand').onclick = () => { press('btnHand'); setTimeout(syncButtons, 150); };
    doc.getElementById('pBack').onclick = () => { try { window.focus(); } catch (_) { } pipWin?.close(); };
    doc.getElementById('pLeave').onclick = () => { pipWin?.close(); press('btnLeave'); };
    doc.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'm') press('btnMic');
      if (k === 'v') press('btnCamera');
      setTimeout(syncButtons, 150);
    });

    const grid = document.getElementById('videoGrid');
    mo = new MutationObserver(schedule);
    if (grid) mo.observe(grid, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
    ['btnMic', 'btnCamera', 'btnHand'].forEach(id => {
      const el = document.getElementById(id);
      if (el) mo.observe(el, { attributes: true, attributeFilter: ['class'] });
    });
    pipWin.addEventListener('resize', schedule);
    pipWin.addEventListener('pagehide', () => {
      mo?.disconnect(); mo = null;
      pipTiles.forEach(e => { try { e.video.srcObject = null; } catch (_) { } });
      pipTiles.clear();
      pipWin = null;
    });
    render();
  }

  function close() { try { pipWin?.close(); } catch (_) { } }

  // ── Voce di menu + apertura automatica al cambio scheda (Chrome/Edge) ────
  function addMenuItem() {
    const menu = document.getElementById('moreMenu');
    if (!menu || !SUPPORTED || document.getElementById('btnPip')) return;
    const b = document.createElement('button');
    b.className = 'more-menu-item';
    b.id = 'btnPip';
    b.innerHTML = `<span class="more-menu-ico">${ICON.back.replace('M11 14l-3-3 3-3M8 11h8', 'M13 8h5v5M18 8l-6 6')}</span><span>Finestra mobile</span>`;
    b.addEventListener('click', () => { menu.classList.add('hidden'); open(); });
    menu.appendChild(b);
  }

  function registerAutoPip() {
    if (!SUPPORTED || !('mediaSession' in navigator)) return;
    try {
      // Chrome/Edge chiamano questo handler da soli quando cambi scheda durante
      // una chiamata: è l'unico modo per aprire la Document PiP senza un click.
      navigator.mediaSession.setActionHandler('enterpictureinpicture', open);
    } catch (_) { /* browser senza auto-PiP per le web app: resta la voce di menu */ }
  }

  function boot() {
    watchVideos();
    addMenuItem();
    registerAutoPip();
    window.addEventListener('pagehide', close);
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();

  window.TdtPip = { open, close, supported: SUPPORTED };
})();
