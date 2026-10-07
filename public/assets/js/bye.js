'use strict';
/* Pagina di fine chiamata: riempie il layout con le impostazioni del pannello
   (window.__BRAND.bye) e con i dati della chiamata appena finita lasciati da
   room.js in sessionStorage (tdt_bye: nome, host, durata, partecipanti).
   Animazione "costellazione": puntini che si collegano + chip dei partecipanti. */
(function () {
  const B = window.__BRAND || {};
  const cfg = B.bye || {};
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const T = (s) => (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t(s) : s;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let data = {};
  try { data = JSON.parse(sessionStorage.getItem('tdt_bye') || '{}') || {}; } catch { }
  const name = String(data.name || '').trim();
  const host = String(data.host || '').trim();
  const durationSec = Math.max(0, Number(data.durationSec) || 0);
  const participants = Array.isArray(data.participants) ? data.participants.filter(Boolean).slice(0, 12) : [];
  const minutes = Math.max(1, Math.round(durationSec / 60));

  const fmtDur = (s) => {
    const m = Math.round(s / 60);
    if (m < 60) return `${m} min`;
    return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
  };
  const fill = (tpl) => String(tpl || '')
    .replace(/\{nome\}/g, name || T('ospite'))
    .replace(/\{host\}/g, host || (B.info?.companyName || B.branding?.platformName || ''))
    .replace(/\{durata\}/g, fmtDur(durationSec))
    .replace(/\{partecipanti\}/g, String(participants.length || 1))
    .replace(/\{azienda\}/g, B.info?.companyName || B.branding?.platformName || '');
  // "Grazie, {nome}." senza nome → "Grazie." (niente virgola pendente)
  const tidy = (s) => name ? s : s.replace(/,\s*\.\s*/g, '. ').replace(/,\s*(\n|$)/g, '$1');

  // ── testi ──
  const $ = (id) => document.getElementById(id);
  // ogni riga in un nodo di testo separato: così il traduttore automatico le trova
  $('byeTitle').innerHTML = tidy(fill(cfg.title || 'Grazie, {nome}.\nÈ stato un piacere.')).split('\n').map(esc).join('<br>');
  $('byeSubtitle').textContent = fill(cfg.subtitle || '');
  $('byeHeading').textContent = fill(cfg.heading || 'Chiamata conclusa');
  $('byeText').textContent = fill(cfg.text || '');
  if (cfg.brandText) { $('byeQuote').textContent = fill(cfg.brandText); $('byeQuote').classList.remove('hidden'); }
  if (cfg.bgImageUrl) { const b = $('byeBrand'); b.style.backgroundImage = `url("${String(cfg.bgImageUrl).replace(/["\\)]/g, '')}")`; b.classList.add('has-image'); }
  document.title = `${T('Grazie')} · ${B.branding?.platformName || ''}`;

  // ── statistiche ──
  if (cfg.showStats !== false && (durationSec > 0 || participants.length)) {
    const parts = [];
    if (durationSec > 0) parts.push(`<span>${T('Durata')} <b>${esc(fmtDur(durationSec))}</b></span>`);
    if (participants.length) parts.push(`<span>${T('Partecipanti')} <b>${participants.length}</b></span>`);
    parts.push(`<span><b>${esc(new Date().toLocaleDateString(window.I18n?.locale, { day: 'numeric', month: 'short', year: 'numeric' }))}</b></span>`);
    $('byeStats').innerHTML = parts.join(''); $('byeStats').classList.remove('hidden');
  }

  // ── contatto ──
  if (cfg.contactName || cfg.contactEmail || cfg.contactPhone) {
    const initials = (cfg.contactName || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const lines = [esc(cfg.contactRole), [cfg.contactEmail ? `<a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a>` : '', cfg.contactPhone ? `<a href="tel:${esc(String(cfg.contactPhone).replace(/[^\d+]/g, ''))}">${esc(cfg.contactPhone)}</a>` : ''].filter(Boolean).join(' · ')].filter(Boolean);
    $('byeContact').innerHTML = `<div class="bye-avatar">${cfg.contactPhotoUrl ? `<img src="${esc(cfg.contactPhotoUrl)}" alt="">` : esc(initials)}</div><div><b>${esc(cfg.contactName || '')}</b>${lines.map(l => `<span>${l}</span>`).join('<br>')}</div>`;
    $('byeContact').classList.remove('hidden');
  }

  // ── bottoni ──
  const btns = Array.isArray(cfg.buttons) ? cfg.buttons.filter(b => b && b.label && b.url) : [];
  $('byeActions').innerHTML = btns.map((b, i) => `<a class="btn ${i ? 'ghost' : ''}" href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.label)}</a>`).join('');

  // ── footer ──
  const info = B.info || {};
  const foot = [esc(info.companyName), info.companySite ? `<a href="${esc(info.companySite)}" target="_blank" rel="noopener">${esc(info.companySite.replace(/^https?:\/\//, ''))}</a>` : ''].filter(Boolean).join(' · ');
  $('byeFoot').innerHTML = (foot ? foot + '<br>' : '') + `<span>${T('Puoi chiudere questa finestra.')}</span>`;

  // ── valutazione ──
  if (cfg.askRating) {
    const box = $('byeRating'); box.classList.remove('hidden'); $('byeSplit').classList.add('has-rating');
    let v = 0;
    const paint = (n) => box.querySelectorAll('.bye-stars button').forEach(b => b.classList.toggle('on', +b.dataset.v <= n));
    box.querySelectorAll('.bye-stars button').forEach(b => {
      b.addEventListener('mouseenter', () => paint(+b.dataset.v));
      b.addEventListener('mouseleave', () => paint(v));
      b.addEventListener('click', () => { v = +b.dataset.v; paint(v); $('byeComment').classList.remove('hidden'); $('byeRatingActions').classList.remove('hidden'); });
    });
    $('byeSend').addEventListener('click', async () => {
      if (!v) return;
      $('byeSend').disabled = true;
      try {
        const r = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: data.roomId || '', name, host, stars: v, comment: $('byeComment').value.trim(), durationSec }) });
        if (!r.ok) throw new Error((await r.json()).error || 'Errore');
        box.querySelectorAll('.bye-stars button').forEach(b => { b.disabled = true; });
        $('byeComment').classList.add('hidden'); $('byeRatingActions').classList.add('hidden'); $('byeRatingDone').classList.remove('hidden');
      } catch (e) { $('byeSend').disabled = false; alert(e.message); }
    });
  }

  // ── animazione ──
  const stage = $('byeStage');
  const anim = cfg.animation || 'constellation';
  if (anim === 'none') stage.classList.add('hidden');
  else if (anim === 'check') {
    stage.innerHTML = `<div class="bye-check"><span class="bye-ring"></span><span class="bye-ring"></span><span class="bye-ring"></span><div class="bye-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.2 4.2L19 7"/></svg></div></div>`;
  } else if (anim === 'ring') {
    stage.innerHTML = `<div class="bye-dial"><div class="bye-dial-in"><svg viewBox="0 0 200 200"><circle class="bg" cx="100" cy="100" r="90"/><circle class="fg" cx="100" cy="100" r="90"/></svg><div class="lbl"><b id="byeCount">0</b><span>${T('minuti insieme')}</span></div></div></div>`;
    const fg = stage.querySelector('.fg'); const cnt = $('byeCount');
    const pct = Math.min(1, minutes / 60);
    requestAnimationFrame(() => { fg.style.strokeDashoffset = String(565 - 565 * Math.max(.06, pct)); });
    const t0 = performance.now(); const dur = reduced ? 0 : 2000;
    const step = (t) => { const k = dur ? Math.min(1, (t - t0) / dur) : 1; const e = 1 - Math.pow(1 - k, 3); cnt.textContent = Math.round(minutes * e); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  } else constellation();

  function constellation() {
    const cv = $('byeNet'); if (!cv) return;
    const ctx = cv.getContext('2d');
    const accent = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '').trim() || '#7b5ea7';
    // chip dei partecipanti (io evidenziato), disposte su una griglia sfalsata
    const people = (participants.length ? participants : [name || T('Tu')]).slice(0, 6);
    const slots = [[10, 18], [56, 10], [34, 58], [66, 50], [8, 70], [58, 80]];
    people.forEach((p, i) => {
      const chip = document.createElement('span');
      chip.className = 'bye-chip' + (p === name ? ' me' : '');
      chip.style.left = slots[i][0] + '%'; chip.style.top = slots[i][1] + '%'; chip.style.setProperty('--d', (-i * 1.3) + 's');
      const ini = String(p).trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
      chip.innerHTML = `<i>${esc(ini)}</i><span>${esc(p)}</span>`;
      stage.appendChild(chip);
    });
    const N = 24;
    const pts = Array.from({ length: N }, () => ({ x: Math.random(), y: Math.random(), vx: (Math.random() - .5) * .0011, vy: (Math.random() - .5) * .0011 }));
    let raf = 0;
    const draw = () => {
      const W = cv.clientWidth, H = cv.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
      if (!W || !H) { raf = requestAnimationFrame(draw); return; }
      if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      if (!reduced) for (const p of pts) { p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > 1) p.vx *= -1; if (p.y < 0 || p.y > 1) p.vy *= -1; }
      ctx.strokeStyle = accent; ctx.lineWidth = 1;
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const a = pts[i], b = pts[j]; const d = Math.hypot((a.x - b.x) * W, (a.y - b.y) * H);
        if (d < 110) { ctx.globalAlpha = (1 - d / 110) * .45; ctx.beginPath(); ctx.moveTo(a.x * W, a.y * H); ctx.lineTo(b.x * W, b.y * H); ctx.stroke(); }
      }
      ctx.fillStyle = accent; ctx.globalAlpha = .9;
      for (const p of pts) { ctx.beginPath(); ctx.arc(p.x * W, p.y * H, 2.2, 0, Math.PI * 2); ctx.fill(); }
      if (!reduced && !document.hidden) raf = requestAnimationFrame(draw);
    };
    draw();
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !raf) draw(); else if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } });
  }

})();
