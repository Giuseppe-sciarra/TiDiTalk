'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   Brand + impostazioni pubbliche + rendering pagine
   ───────────────────────────────────────────────────────────────────────────
   Tutto ciò che è "brand" (nome, colori, logo, testi) vive nel DB ed è
   modificabile da Impostazioni. Il default del nome arriva da APP_NAME in .env.
   Le pagine HTML contengono segnaposto (%%APP_NAME%% ecc.) sostituiti qui al
   momento dell'invio: niente "flash" del vecchio nome e titoli corretti subito.
   ═══════════════════════════════════════════════════════════════════════════ */
const fs = require('fs');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Repository ufficiale del progetto: se pubblichi una versione MODIFICATA
// devi far puntare SOURCE_URL (in .env) al TUO sorgente (AGPL-3.0 §13).
const UPSTREAM_REPO = 'https://github.com/Giuseppe-TD/tiditalk';

const DEFAULT_LOGO = '/assets/images/brand-mark.svg';
const HEX6 = /^#[0-9a-f]{6}$/i;
const ASSET_URL = /^\/assets\/(uploads|images)\/[\w.\-]+$/;
const HTTP_URL = /^https?:\/\/[^\s"'<>]{3,300}$/i;

function getBrand(db, config) {
  const b = db.getSetting('branding') || {};
  return {
    platformName: (b.platformName || config.brand.appName || 'Tiditalk').slice(0, 40),
    tagline: b.tagline != null ? String(b.tagline).slice(0, 80) : 'Videoriunioni semplici, sul tuo server',
    accentColor: HEX6.test(b.accentColor || '') ? b.accentColor : '#7b5ea7',
    theme: ['dark', 'light', 'auto'].includes(b.theme) ? b.theme : 'dark',
    logoUrl: b.logoUrl && (ASSET_URL.test(b.logoUrl) || HTTP_URL.test(b.logoUrl)) ? b.logoUrl : DEFAULT_LOGO,
    faviconUrl: b.faviconUrl && (ASSET_URL.test(b.faviconUrl) || HTTP_URL.test(b.faviconUrl)) ? b.faviconUrl : '',
  };
}

function getRoomPolicy(db) {
  const r = db.getSetting('rooms') || {};
  return {
    guestScreenShare: r.guestScreenShare !== false,  // default: gli ospiti possono presentare
    annotateAll: r.annotateAll === true,             // default: disegna solo chi presenta + organizzatori
    tour: r.tour === true,                           // mini-guida al primo ingresso: spenta di default
  };
}

function getPublicSettings(db, config) {
  const f = db.getSetting('footer') || {};
  const i = db.getSetting('info') || {};
  return {
    branding: getBrand(db, config),
    footer: {
      enabled: f.enabled === true || (f.enabled !== false && !!f.text),
      text: f.text ? String(f.text).slice(0, 120) : '',
      link: HTTP_URL.test(f.link || '') ? f.link : '',
    },
    info: {
      companyName: i.companyName || '',
      companyEmail: i.companyEmail || '',
      companySite: HTTP_URL.test(i.companySite || '') ? i.companySite : '',
      developerTitle: i.developerTitle || '',
    },
    rooms: getRoomPolicy(db),
    // link al sorgente mostrato nella finestra Info (AGPL-3.0 §13)
    sourceUrl: HTTP_URL.test(process.env.SOURCE_URL || '') ? process.env.SOURCE_URL : UPSTREAM_REPO,
  };
}

function _str(v, max) { return String(v == null ? '' : v).replace(/\u0000/g, '').trim().slice(0, max); }
function _url(v, allowAsset) {
  const s = _str(v, 300);
  if (!s) return '';
  if (HTTP_URL.test(s) || (allowAsset && ASSET_URL.test(s))) return s;
  throw new Error('URL non valido: usa un indirizzo che inizia con https://');
}

function saveCategory(db, category, data) {
  let out;
  switch (category) {
    case 'branding': {
      const name = _str(data.platformName, 40);
      if (!name) throw new Error('Il nome della piattaforma è obbligatorio');
      const accent = _str(data.accentColor, 7);
      if (!HEX6.test(accent)) throw new Error('Colore non valido (formato #rrggbb)');
      out = { platformName: name, tagline: _str(data.tagline, 80), accentColor: accent,
        theme: ['dark', 'light', 'auto'].includes(data.theme) ? data.theme : 'dark',
        logoUrl: _url(data.logoUrl, true), faviconUrl: _url(data.faviconUrl, true) };
      break;
    }
    case 'footer':
      out = { enabled: data.enabled === true, text: _str(data.text, 120), link: _url(data.link, false) };
      break;
    case 'info': {
      const email = _str(data.companyEmail, 120);
      if (email && !/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(email)) throw new Error('Email non valida');
      out = { companyName: _str(data.companyName, 80), companyEmail: email,
        companySite: _url(data.companySite, false), developerTitle: _str(data.developerTitle, 160) };
      break;
    }
    case 'rooms':
      out = { guestScreenShare: data.guestScreenShare !== false, annotateAll: data.annotateAll === true, tour: data.tour !== false };
      break;
    default:
      throw new Error('Categoria non valida');
  }
  db.setSetting(category, out);
  return out;
}

// ─── Accento leggibile in entrambi i temi ────────────────────────────────────
// Un accento molto scuro (es. quasi nero) sparirebbe sul tema scuro, e uno molto
// chiaro sparirebbe sul tema chiaro: qui viene schiarito o scurito quanto basta
// per restare sempre distinguibile, mantenendo tinta e saturazione.
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
function relLum(rgb) {
  const [r, g, b] = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [l1, l2] = [relLum(a), relLum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  const d = max - min;
  if (d) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hslToRgb([h, s, l]) {
  if (!s) { const v = l * 255; return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

const SURFACE_DARK = hexToRgb('#181a21');
const SURFACE_LIGHT = hexToRgb('#ffffff');
const MIN_CONTRAST = 3.4;

/** Accento per le EMAIL: deve reggere sia il client chiaro sia quello scuro.
 *  Molti client (Gmail, Outlook) invertono i colori in modalità scura: un
 *  accento quasi nero diventa un pulsante invisibile sopra la card scura.
 *  Qui si cerca una luminosità intermedia che contrasti con il bianco E con un
 *  fondo scuro tipico (#1f2024). */
function accentForEmail(hex) {
  const white = hexToRgb('#ffffff'), dark = hexToRgb('#1f2024');
  const [h, sat] = rgbToHsl(hexToRgb(hex)); // un accento neutro resta neutro
  let best = null;
  for (let l = 0.20; l <= 0.75; l += 0.01) {
    const rgb = hslToRgb([h, sat, l]);
    const cw = contrast(rgb, white), cd = contrast(rgb, dark);
    const score = Math.min(cw, cd);
    if (!best || score > best.score) best = { score, rgb, l };
    if (cw >= 3 && cd >= 3) break;
  }
  return rgbToHex(best.rgb);
}

/** Accento adattato a una superficie: schiarisce (tema scuro) o scurisce (tema chiaro) */
function accentFor(hex, theme) {
  const surface = theme === 'light' ? SURFACE_LIGHT : SURFACE_DARK;
  let [h, s, l] = rgbToHsl(hexToRgb(hex));
  if (s < 0.08 && l < 0.5) s = 0.12; // un "nero" resta comunque un filo di tinta
  const step = theme === 'light' ? -0.02 : 0.02;
  let rgb = hslToRgb([h, s, l]);
  for (let i = 0; i < 45 && contrast(rgb, surface) < MIN_CONTRAST; i++) {
    l = Math.max(0.08, Math.min(0.92, l + step));
    rgb = hslToRgb([h, s, l]);
  }
  return rgbToHex(rgb);
}

// colore del testo sopra l'accento (nero o bianco in base alla luminanza)
function inkFor(hex) {
  const L = relLum(hexToRgb(hex));
  return L > 0.36 ? '#17150f' : '#ffffff';
}

const _cache = new Map(); // file → { mtimeMs, html }
function _read(file) {
  const st = fs.statSync(file);
  const c = _cache.get(file);
  if (c && c.mtimeMs === st.mtimeMs) return c.html;
  const html = fs.readFileSync(file, 'utf8');
  _cache.set(file, { mtimeMs: st.mtimeMs, html });
  return html;
}

function sendPage(res, file, db, config, extraHead = '') {
  let html;
  try { html = _read(file); } catch (e) { return res.status(404).send('Pagina non trovata'); }
  const pub = getPublicSettings(db, config);
  const b = pub.branding;
  const ink = inkFor(b.accentColor);
  const aDark = accentFor(b.accentColor, 'dark');
  const aLight = accentFor(b.accentColor, 'light');
  const head = `<style>:root{--accent-raw:${b.accentColor};--accent-dark:${aDark};--accent-light:${aLight};--accent-ink-dark:${inkFor(aDark)};--accent-ink-light:${inkFor(aLight)};}</style>
<script>window.__BRAND=${JSON.stringify(pub).replace(/</g, '\\u003c')};
(function(){try{var t=localStorage.getItem('tdt_theme')||${JSON.stringify(b.theme)};
if(t==='auto')t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';
document.documentElement.dataset.theme=(t==='light'?'light':'dark');}catch(e){document.documentElement.dataset.theme='dark';}})();</script>${extraHead}`;
  const out = html
    .replace(/%%BRAND_HEAD%%/g, head)
    .replace(/%%APP_NAME%%/g, esc(b.platformName))
    .replace(/%%TAGLINE%%/g, esc(b.tagline))
    .replace(/%%LOGO%%/g, esc(b.logoUrl))
    .replace(/%%FAVICON%%/g, esc(b.faviconUrl || b.logoUrl));
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.send(out);
}

module.exports = { esc, getBrand, getRoomPolicy, getPublicSettings, saveCategory, sendPage, inkFor, accentFor, accentForEmail, DEFAULT_LOGO };
