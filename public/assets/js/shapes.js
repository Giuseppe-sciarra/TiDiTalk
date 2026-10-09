'use strict';

/**
 * Sfondo animato a forme geometriche (triangoli, quadrati, cerchi, esagoni,
 * rombi) tinte con il colore accento del brand. Una variante per pagina, così
 * ogni schermata ha il suo movimento:
 *
 *   home      salgono dal basso, ruotano, alone in alto a destra e un
 *             leggero effetto profondità che segue il mouse (solo qui)
 *   login     grandi contorni che orbitano piano attorno al centro
 *   guest     come login ma più fitte (pagina di invito)
 *   schedule  scorrono da destra a sinistra, come il tempo su un calendario
 *   settings  galleggiano quasi ferme e ruotano lentamente: pagina di lavoro
 *   bye       scendono leggere come coriandoli
 *   prejoin   come la home ma rade (schermata prima di entrare)
 *   wait      pulsano piano attorno al centro (sala d'attesa dell'ospite)
 *
 * Uso: <canvas class="bg-shapes" data-variant="login"></canvas> + questo
 * script. Per i canvas creati dopo: TdtShapes.mount(canvas, 'wait').
 * Leggero: un canvas, al massimo ~44 forme; si ferma quando la scheda è
 * nascosta o il canvas non è visibile.
 */
(function () {
  const RND = (a, b) => a + Math.random() * (b - a);
  const PICK = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // ── varianti ──────────────────────────────────────────────────────────────
  // density: forme per 100k px² · size: [min,max] px · kinds: forme ammesse
  // move(s, t, dt, W, H): sposta la forma · spawn(s, W, H, anywhere): posizione iniziale
  // glow: [x, y] in frazioni dello schermo, o null
  const V = {
    home: {
      density: 2.4, max: 44, size: [14, 60], kinds: ['tri', 'sq', 'circle', 'hex', 'tri', 'sq'],
      alpha: [.07, .23], fill: .35, spin: .25, glow: [.82, .1], parallax: 26,
      spawn(s, W, H, any) { s.x = RND(0, W); s.y = any ? RND(0, H) : H + s.size * 2; s.vx = RND(-5, 5); s.vy = -RND(6, 20); },
      move(s, t, dt) { s.y += s.vy * dt; s.x += (s.vx + Math.sin(t / 1800 + s.wob) * 6) * dt; return s.y > -s.size * 2; },
    },
    prejoin: {
      density: 1.2, max: 26, size: [12, 50], kinds: ['tri', 'sq', 'circle', 'hex'],
      alpha: [.06, .18], fill: .3, spin: .2, glow: [.2, .9],
      spawn(s, W, H, any) { s.x = RND(0, W); s.y = any ? RND(0, H) : H + s.size * 2; s.vx = RND(-4, 4); s.vy = -RND(5, 14); },
      move(s, t, dt) { s.y += s.vy * dt; s.x += (s.vx + Math.sin(t / 2000 + s.wob) * 5) * dt; return s.y > -s.size * 2; },
    },
    login: {
      density: 1.1, max: 22, size: [26, 120], kinds: ['tri', 'sq', 'hex', 'circle', 'diamond'],
      alpha: [.07, .2], fill: .18, spin: .12, glow: [.5, .5], line: 1.6,
      spawn(s, W, H) {
        const cx = W / 2, cy = H / 2, R = Math.hypot(W, H) / 2;
        s.r = RND(R * .32, R * 1.05); s.a0 = RND(0, Math.PI * 2); s.w = RND(.012, .035) * (Math.random() < .5 ? -1 : 1);
        s.cx = cx; s.cy = cy; s.ell = RND(.55, .8);
      },
      move(s, t, dt) { s.a0 += s.w * dt; s.x = s.cx + Math.cos(s.a0) * s.r; s.y = s.cy + Math.sin(s.a0) * s.r * s.ell + Math.sin(t / 2400 + s.wob) * 8; return true; },
    },
    guest: null, // = login più fitta (sotto)
    schedule: {
      density: 2, max: 40, size: [10, 44], kinds: ['sq', 'sq', 'circle', 'circle', 'diamond', 'tri'],
      alpha: [.06, .2], fill: .45, spin: .18, glow: [.1, .9],
      spawn(s, W, H, any) { s.x = any ? RND(0, W) : W + s.size * 2; s.y = RND(0, H); s.vx = -RND(8, 26); s.vy = 0; },
      move(s, t, dt) { s.x += s.vx * dt; s.y += Math.sin(t / 1500 + s.wob) * 4 * dt; return s.x > -s.size * 2; },
    },
    settings: {
      density: .9, max: 20, size: [18, 70], kinds: ['hex', 'sq', 'circle', 'hex'],
      alpha: [.05, .14], fill: .25, spin: .08, glow: [.08, .12],
      spawn(s, W, H) { s.x = RND(0, W); s.y = RND(0, H); s.hx = s.x; s.hy = s.y; },
      move(s, t) { s.x = s.hx + Math.sin(t / 5200 + s.wob) * 22; s.y = s.hy + Math.cos(t / 6100 + s.wob * 1.3) * 16; return true; },
    },
    bye: {
      density: 1.6, max: 34, size: [10, 36], kinds: ['tri', 'sq', 'circle', 'diamond'],
      alpha: [.1, .28], fill: .6, spin: .9, glow: [.5, 0],
      spawn(s, W, H, any) { s.x = RND(0, W); s.y = any ? RND(0, H) : -s.size * 2; s.vy = RND(10, 26); s.sway = RND(10, 30); },
      move(s, t, dt) { s.y += s.vy * dt; s.x += Math.sin(t / 900 + s.wob) * s.sway * dt; return s.y < s.H + s.size * 2; },
    },
    wait: {
      density: 1, max: 24, size: [16, 64], kinds: ['circle', 'hex', 'tri', 'sq'],
      alpha: [.06, .2], fill: .3, spin: .15, glow: [.5, .45],
      spawn(s, W, H) { const a = RND(0, Math.PI * 2), r = RND(Math.min(W, H) * .25, Math.hypot(W, H) * .55); s.hx = W / 2 + Math.cos(a) * r; s.hy = H / 2 + Math.sin(a) * r * .7; s.x = s.hx; s.y = s.hy; },
      move(s, t) { const k = 1 + Math.sin(t / 2600 + s.wob) * .06; s.x = s.hx + (s.hx - s.cx0) * (k - 1); s.y = s.hy + (s.hy - s.cy0) * (k - 1); return true; },
    },
  };
  V.guest = Object.assign({}, V.login, { density: 1.5, max: 28, glow: [.5, .35] });

  function path(ctx, s) {
    const r = s.size / 2;
    ctx.beginPath();
    if (s.kind === 'circle') ctx.arc(0, 0, r, 0, Math.PI * 2);
    else if (s.kind === 'sq') { const q = r * .9; ctx.roundRect ? ctx.roundRect(-q, -q, q * 2, q * 2, q * .18) : ctx.rect(-q, -q, q * 2, q * 2); }
    else if (s.kind === 'diamond') { ctx.moveTo(0, -r); ctx.lineTo(r * .7, 0); ctx.lineTo(0, r); ctx.lineTo(-r * .7, 0); ctx.closePath(); }
    else {
      const n = s.kind === 'tri' ? 3 : 6;
      for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / n; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath();
    }
  }

  const hexToRgb = (h) => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(h).trim()); return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [123, 94, 167]; };
  const accentRgb = () => hexToRgb(getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#7b5ea7');

  function mount(canvas, variant) {
    if (!canvas || canvas._tdShapes) return canvas?._tdShapes;
    const cfg = V[variant || canvas.dataset.variant] || V.home;
    const ctx = canvas.getContext('2d');
    const local = getComputedStyle(canvas).position !== 'fixed';
    let W = 0, H = 0, dpr = 1, shapes = [], raf = 0, last = 0, rgb = accentRgb(), idle = 0;
    // profondità: le forme grandi (più "vicine") si spostano di più col mouse
    let mx = 0, my = 0, px = 0, py = 0;
    const onMouse = (e) => { mx = (e.clientX / window.innerWidth - .5) * 2; my = (e.clientY / window.innerHeight - .5) * 2; };
    if (cfg.parallax && window.matchMedia('(pointer: fine)').matches) window.addEventListener('pointermove', onMouse, { passive: true });

    function make(any) {
      const s = { kind: PICK(cfg.kinds), size: RND(cfg.size[0], cfg.size[1]), rot: RND(0, Math.PI * 2), vr: RND(-cfg.spin, cfg.spin), a: RND(cfg.alpha[0], cfg.alpha[1]), fill: Math.random() < cfg.fill, wob: RND(0, 6.28), H, cx0: W / 2, cy0: H / 2 };
      cfg.spawn(s, W, H, any);
      return s;
    }
    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = local ? canvas.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
      const nw = Math.max(1, Math.round(r.width)), nh = Math.max(1, Math.round(r.height));
      const changed = Math.abs(nw - W) > 40 || Math.abs(nh - H) > 40;
      W = nw; H = nh;
      canvas.width = W * dpr; canvas.height = H * dpr;
      if (!local) { canvas.style.width = W + 'px'; canvas.style.height = H + 'px'; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const want = Math.max(10, Math.min(cfg.max, Math.round(W * H / 100000 * cfg.density)));
      if (changed) shapes = []; // le varianti "orbitali" dipendono dal centro: si ridistribuiscono
      while (shapes.length < want) shapes.push(make(true));
      shapes.length = want;
    }
    function frame(t) {
      if (!canvas.isConnected) { stop(); return; }
      // canvas nascosto (es. prejoin chiuso): niente disegno, ricontrollo ogni tanto
      if (!canvas.getClientRects().length || canvas.closest('.hidden')) { raf = 0; idle = setTimeout(() => { last = performance.now(); raf = requestAnimationFrame(frame); }, 1000); return; }
      raf = requestAnimationFrame(frame);
      const dt = Math.min(.05, (t - last) / 1000 || 0); last = t;
      if (local) { const r = canvas.getBoundingClientRect(); if (Math.abs(r.width - W) > 2 || Math.abs(r.height - H) > 2) size(); }
      ctx.clearRect(0, 0, W, H);
      const light = document.documentElement.dataset.theme === 'light';
      const [r, g, b] = rgb;
      px += (mx - px) * Math.min(1, dt * 3); py += (my - py) * Math.min(1, dt * 3);
      for (let i = 0; i < shapes.length; i++) {
        const s = shapes[i];
        s.H = H;
        if (!cfg.move(s, t, dt, W, H)) { shapes[i] = make(false); continue; }
        s.rot += s.vr * dt;
        ctx.save();
        const depth = cfg.parallax ? cfg.parallax * (s.size / cfg.size[1]) : 0;
        ctx.translate(s.x - px * depth, s.y - py * depth); ctx.rotate(s.rot);
        const al = s.a * (light ? .7 : 1);
        if (s.fill) { ctx.fillStyle = `rgba(${r},${g},${b},${al})`; path(ctx, s); ctx.fill(); }
        else { ctx.strokeStyle = `rgba(${r},${g},${b},${Math.min(1, al * 1.7)})`; ctx.lineWidth = cfg.line || 1.5; path(ctx, s); ctx.stroke(); }
        ctx.restore();
      }
      if (cfg.glow) {
        const gx = W * cfg.glow[0], gy = H * cfg.glow[1];
        const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(W, H) * .6);
        gr.addColorStop(0, `rgba(${r},${g},${b},${light ? .09 : .15})`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      }
    }
    function start() { if (!raf && !document.hidden) { clearTimeout(idle); last = performance.now(); raf = requestAnimationFrame(frame); } }
    function stop() { cancelAnimationFrame(raf); clearTimeout(idle); raf = 0; }
    const onVis = () => document.hidden ? stop() : start();
    const onTheme = () => { rgb = accentRgb(); };

    size();
    start();
    window.addEventListener('resize', size);
    document.addEventListener('visibilitychange', onVis);
    document.addEventListener('tdt:theme', onTheme);
    canvas._tdShapes = { start, stop, refresh: () => { rgb = accentRgb(); size(); } };
    return canvas._tdShapes;
  }

  const boot = () => document.querySelectorAll('canvas.bg-shapes').forEach(c => mount(c));
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
  window.TdtShapes = { mount, variants: Object.keys(V) };
})();
