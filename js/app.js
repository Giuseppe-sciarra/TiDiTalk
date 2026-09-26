'use strict';
/* Helper comuni alle pagine fuori dalla riunione: sessione, chiamate API,
   messaggini, footer del brand. */
(function () {
  const TOKEN_KEY = 'tdmeet_token';

  const Tdt = {
    token: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
    user: null,

    esc: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),

    toLogin() {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = '/?next=' + next;
    },

    async api(path, options = {}) {
      const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
      if (window.I18n?.locale) headers['X-UI-Language'] = window.I18n.locale;
      const t = Tdt.token();
      if (t) headers['x-auth-token'] = t;
      const r = await fetch(path, { ...options, headers });
      if (r.status === 401) { try { localStorage.removeItem(TOKEN_KEY); } catch { } Tdt.toLogin(); throw new Error('Sessione scaduta'); }
      let body = null;
      try { body = await r.json(); } catch { }
      if (!r.ok) throw new Error((body && body.error) || 'Qualcosa è andato storto');
      return body;
    },

    /** Verifica la sessione; opts.admin=true → serve un amministratore */
    async requireAuth({ admin = false } = {}) {
      if (!Tdt.token()) { Tdt.toLogin(); return null; }
      try {
        const u = await Tdt.api('/api/auth/verify');
        Tdt.user = u;
        document.querySelectorAll('[data-admin-only]').forEach(el => el.classList.toggle('hidden', u.role !== 'admin'));
        document.querySelectorAll('[data-user-name]').forEach(el => { el.textContent = u.displayName; });
        if (admin && u.role !== 'admin') { window.location.href = '/home'; return null; }
        return u;
      } catch { return null; }
    },

    logout() {
      try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem('tdmeet_user'); } catch { }
      window.location.href = '/';
    },

    toast(msg, ms = 2800) {
      let t = document.getElementById('appToast');
      if (!t) { t = document.createElement('div'); t.id = 'appToast'; t.className = 'app-toast'; document.body.appendChild(t); }
      t.textContent = msg;
      t.classList.add('on');
      clearTimeout(t._t);
      t._t = setTimeout(() => t.classList.remove('on'), ms);
    },

    /** Nome stanza → codice usabile nell'URL */
    roomCode(raw) {
      return String(raw || '').trim().toUpperCase().replace(/\s+/g, '-')
        .replace(/[^A-Z0-9\-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 32);
    },

    footer() {
      const f = window.__BRAND?.footer;
      if (!f || !f.enabled || !f.text) return;
      const el = document.createElement('div');
      el.className = 'app-footer';
      el.innerHTML = f.link
        ? `<a href="${Tdt.esc(f.link)}" target="_blank" rel="noopener">${Tdt.esc(f.text)}</a>`
        : Tdt.esc(f.text);
      document.body.appendChild(el);
    },

    init() {
      document.querySelectorAll('[data-logout]').forEach(b => b.addEventListener('click', (e) => { e.preventDefault(); Tdt.logout(); }));
      Tdt.footer();
    },
  };

  window.Tdt = Tdt;
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', Tdt.init) : Tdt.init();
})();
