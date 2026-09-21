'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   Update Check notturno
   Ogni notte alle 02:00 (ora italiana) confronta le dipendenze installate con
   l'ultima versione su npm e, SOLO se c'è qualcosa di nuovo, manda una email
   a UPDATE_NOTIFY_EMAIL (o HOST_NOTIFY_EMAIL; se vuote nessuna email) con il riepilogo.

   NON aggiorna niente da solo: l'update in produzione è una decisione, non un
   cron. Quando arriva la mail: aggiornare package.json (o lasciare i range ^)
   e ricostruire il servizio con docker compose up -d --build app.

   Config .env:
     UPDATE_CHECK=0          → disattiva del tutto (default: attivo)
     UPDATE_CHECK_HOUR=2     → ora locale del check (default 2)
   ═══════════════════════════════════════════════════════════════════════════ */

const { t, locale } = require('./i18n');

const PACKAGES = [
  'mediasoup', 'mediasoup-client', 'socket.io', 'express',
  'better-sqlite3', 'nodemailer', 'dotenv', 'cors', 'bcryptjs',
];

let _mailer = null;
function _getMailer() {
  if (_mailer) return _mailer;
  try { _mailer = require('./mailer'); } catch (e) { _mailer = null; }
  return _mailer;
}

function installedVersion(pkg) {
  try { return require(`${pkg}/package.json`).version; } catch (e) { return null; }
}

async function latestVersion(pkg) {
  try {
    const r = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null;
    const j = await r.json();
    return j.version || null;
  } catch (e) { return null; }
}

function cmpSemver(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0); }
  return 0;
}

async function checkUpdates() {
  const rows = [];
  for (const pkg of PACKAGES) {
    const cur = installedVersion(pkg);
    if (!cur) continue;
    const latest = await latestVersion(pkg);
    if (!latest) continue;
    if (cmpSemver(latest, cur) > 0) {
      const major = Number(String(latest).split('.')[0]) > Number(String(cur).split('.')[0]);
      rows.push({ pkg, cur, latest, major });
    }
  }
  return rows;
}

async function runCheckAndNotify() {
  console.log('[update-check] controllo versioni npm…');
  const rows = await checkUpdates();
  if (!rows.length) { console.log('[update-check] tutto aggiornato'); return; }

  console.log('[update-check] aggiornamenti disponibili:', rows.map(r => `${r.pkg} ${r.cur}→${r.latest}${r.major ? ' (MAJOR)' : ''}`).join(', '));

  const mailer = _getMailer();
  if (!mailer?.sendRaw) { console.warn('[update-check] mailer non disponibile: niente email'); return; }

  const to = (process.env.UPDATE_NOTIFY_EMAIL || process.env.HOST_NOTIFY_EMAIL || '').trim();
  if (!to) { console.log('[update-check] nessun destinatario (UPDATE_NOTIFY_EMAIL/HOST_NOTIFY_EMAIL): niente email'); return; }
  let appName = 'Videoriunioni';
  try { appName = require('./config').brand.appName; } catch { }
  const tr = rows.map(r =>
    `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;">${r.pkg}</td>` +
    `<td style="padding:6px 12px;border-bottom:1px solid #eee;">${r.cur}</td>` +
    `<td style="padding:6px 12px;border-bottom:1px solid #eee;"><b>${r.latest}</b>${r.major ? ' <span style="color:#dc2626;font-weight:700;">MAJOR</span>' : ''}</td></tr>`
  ).join('');
  const html = `
    <div style="font-family:sans-serif;max-width:560px;">
      <h2 style="color:#16181d;font-weight:500;">${t('{0} — Aggiornamenti disponibili', locale).replace('{0}', appName)}</h2>
      <table style="border-collapse:collapse;font-size:14px;">
        <tr><th style="text-align:left;padding:6px 12px;">${t('Pacchetto', locale)}</th><th style="text-align:left;padding:6px 12px;">${t('Installata', locale)}</th><th style="text-align:left;padding:6px 12px;">${t('Ultima', locale)}</th></tr>
        ${tr}
      </table>
      <p style="font-size:13px;color:#555;">${t("Per aggiornare sull'host: esegui il rebuild Docker Compose. Se vuoi cambiare le versioni, aggiorna prima package.json e controlla il changelog, soprattutto per le versioni MAJOR.", locale)}</p>
    </div>`;
  const text = t('Aggiornamenti {0}:', locale).replace('{0}', appName) + '\n' + rows.map(r => `- ${r.pkg}: ${r.cur} → ${r.latest}${r.major ? ' (MAJOR)' : ''}`).join('\n');

  try {
    const subjectKey = rows.length === 1 ? '{0}: 1 aggiornamento disponibile' : '{0}: {1} aggiornamenti disponibili';
    const subject = t(subjectKey, locale).replace('{0}', appName).replace('{1}', String(rows.length));
    await mailer.sendRaw({ to, subject, html, text });
    console.log(`[update-check] email inviata a ${to}`);
  } catch (e) { console.error('[update-check] invio email fallito:', e.message); }
}

/** Programma il check ogni notte all'ora configurata (default 02:00 locale). */
function schedule() {
  if (process.env.UPDATE_CHECK === '0') { console.log('[update-check] disattivato (UPDATE_CHECK=0)'); return; }
  const hour = Number(process.env.UPDATE_CHECK_HOUR ?? 2);

  const msToNext = () => {
    const now = new Date();
    const next = new Date(now);
    next.setHours(hour, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next - now;
  };

  const arm = () => {
    const ms = msToNext();
    console.log(`[update-check] prossimo check tra ${Math.round(ms / 3600000 * 10) / 10}h (ore ${hour}:00 locali)`);
    setTimeout(async () => {
      try { await runCheckAndNotify(); } catch (e) { console.error('[update-check]', e.message); }
      arm(); // riprogramma per la notte dopo
    }, ms).unref?.();
  };
  arm();
}

module.exports = { schedule, runCheckAndNotify, checkUpdates };
