'use strict';
/* Tema chiaro/scuro — il default arriva dalle Impostazioni (brand.theme),
   la scelta del singolo utente resta nel suo browser (localStorage). */
(function () {
  const KEY = 'tdt_theme';
  const sysLight = () => window.matchMedia('(prefers-color-scheme: light)').matches;
  const brandDefault = () => (window.__BRAND?.branding?.theme || 'dark');
  const resolve = (v) => (v === 'auto' ? (sysLight() ? 'light' : 'dark') : (v === 'light' ? 'light' : 'dark'));

  function current() {
    let v = null;
    try { v = localStorage.getItem(KEY); } catch { }
    return resolve(v || brandDefault());
  }
  function apply(mode, remember) {
    const m = resolve(mode);
    document.documentElement.dataset.theme = m;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', m === 'light' ? '#f5f6f8' : '#121318');
    if (remember) { try { localStorage.setItem(KEY, m); } catch { } }
    document.querySelectorAll('[data-theme-toggle]').forEach(b => {
      b.dataset.tip = m === 'light' ? 'Passa al tema scuro' : 'Passa al tema chiaro';
      b.querySelector('.ico-dark')?.classList.toggle('hidden', m === 'light');
      b.querySelector('.ico-light')?.classList.toggle('hidden', m !== 'light');
    });
    document.dispatchEvent(new CustomEvent('tdt:theme', { detail: { theme: m } }));
    return m;
  }
  const toggle = () => apply(current() === 'light' ? 'dark' : 'light', true);

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-theme-toggle]')) { e.preventDefault(); toggle(); }
  });
  window.matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => {
    let saved = null; try { saved = localStorage.getItem(KEY); } catch { }
    if (!saved && brandDefault() === 'auto') apply('auto', false);
  });
  const boot = () => apply(current(), false);
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
  window.TdtTheme = { current, apply, toggle };
})();
