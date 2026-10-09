'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   Mailer — SMTP SOLO da .env (SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER,
   SMTP_PASS, SMTP_FROM). Nome, colori e testi dell'email dal brand in DB.
   ═══════════════════════════════════════════════════════════════════════════ */
const nodemailer = require('nodemailer');
const db = require('./db');
const config = require('./config');
const brand = require('./brand');

const E = brand.esc;
const { t, locale, normalizeLanguage } = require('./i18n');

function getSmtpConfig() {
  const user = process.env.SMTP_USER || '';
  return {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    user,
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || user,
  };
}

/** Stato leggibile dal pannello (mai la password) */
function getSmtpStatus() {
  const c = getSmtpConfig();
  return { configured: !!(c.host && c.user && c.pass), host: c.host, port: c.port, secure: c.secure, from: c.from };
}

let _transporter = null, _transporterKey = '';
function createTransporter() {
  const c = getSmtpConfig();
  if (!c.host || !c.user || !c.pass) return null;
  const key = `${c.host}|${c.port}|${c.secure}|${c.user}`;
  if (_transporter && _transporterKey === key) return _transporter;
  _transporter = nodemailer.createTransport({ host: c.host, port: c.port, secure: c.secure, auth: { user: c.user, pass: c.pass } });
  _transporterKey = key;
  return _transporter;
}

// ─── ICS (RFC 5545: escape + line folding) ───────────────────────────────────
function icsText(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}
function icsFold(line) {
  const out = [];
  let rest = line;
  while (Buffer.byteLength(rest, 'utf8') > 74) {
    let cut = 74;
    while (Buffer.byteLength(rest.slice(0, cut), 'utf8') > 74) cut--;
    out.push(rest.slice(0, cut));
    rest = ' ' + rest.slice(cut);
  }
  out.push(rest);
  return out.join('\r\n');
}
function generateICS(meeting, url, language = locale) {
  language = normalizeLanguage(language);
  const tr = value => t(value, language);
  const b = brand.getBrand(db, config);
  const info = db.getSetting('info') || {};
  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const dtStart = new Date(meeting.scheduled_at * 1000);
  const dtEnd = new Date((meeting.scheduled_at + meeting.duration_min * 60) * 1000);
  const from = getSmtpConfig().from;
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0',
    `PRODID:-//${icsText(b.platformName)}//IT`,
    'CALSCALE:GREGORIAN', 'METHOD:REQUEST', 'BEGIN:VEVENT',
    `UID:${meeting.id}@${icsText(b.platformName).replace(/\s+/g, '').toLowerCase() || 'meet'}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(dtStart)}`, `DTEND:${fmt(dtEnd)}`,
    `SUMMARY:${icsText(meeting.title)}`,
    `DESCRIPTION:${icsText(tr('Partecipa alla riunione:') + '\n' + url)}`,
    `LOCATION:${icsText(url)}`, `URL:${url}`,
    from ? `ORGANIZER;CN=${icsText(info.companyName || b.platformName)}:mailto:${from}` : null,
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean);
  return lines.map(icsFold).join('\r\n');
}

// ─── Template email ──────────────────────────────────────────────────────────
function layout({ b, title, subtitle, bodyHtml, footerHtml, language = locale }) {
  language = normalizeLanguage(language);
  // accento "a prova di client scuro": vedi brand.accentForEmail
  const accent = brand.accentForEmail(b.accentColor), ink = brand.inkFor(accent);
  return `<!DOCTYPE html><html lang="${language}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0;padding:24px;background:#f5f6f8;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#16181d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e3e5ea;border-radius:16px;overflow:hidden">
<tr><td style="padding:28px 32px 8px"><div style="font-family:inherit;font-size:14px;font-weight:600;color:#565c67">${E(b.platformName)}</div>
<h1 style="margin:10px 0 4px;font-family:inherit;font-weight:600;font-size:26px;line-height:1.2;letter-spacing:-.01em;color:#16181d">${title}</h1>
<p style="margin:0;color:#565c67;font-size:14px">${subtitle}</p></td></tr>
<tr><td style="padding:16px 32px 28px">${bodyHtml.replace(/%%ACCENT%%/g, accent).replace(/%%INK%%/g, ink)}</td></tr>
<tr><td style="padding:14px 32px;border-top:1px solid #e3e5ea;font-size:12px;color:#565c67">${footerHtml}</td></tr>
</table></td></tr></table></body></html>`;
}

async function sendInvite({ to, meeting, guestUrl, hostName, isHost = false, language = locale }) {
  language = normalizeLanguage(language);
  const tr = value => t(value, language);
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[mailer] SMTP non configurato (.env), salto invio a', to);
    return { skipped: true };
  }
  const b = brand.getBrand(db, config);
  const pub = brand.getPublicSettings(db, config);
  const TZ = process.env.TZ || 'Europe/Rome';
  const dt = new Date(meeting.scheduled_at * 1000);
  const dateStr = dt.toLocaleDateString(language, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: TZ });
  const timeStr = dt.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit', timeZone: TZ });

  const bodyHtml = `
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:15px;margin:4px 0 8px">
<tr><td style="padding:6px 0;color:#565c67;width:70px">${E(tr("Quando"))}</td><td style="padding:6px 0">${E(dateStr.charAt(0).toUpperCase() + dateStr.slice(1))}, ${E(timeStr)}</td></tr>
<tr><td style="padding:6px 0;color:#565c67">${E(tr("Durata"))}</td><td style="padding:6px 0">${E(meeting.duration_min)} ${E(tr("minuti"))}</td></tr>
</table>
${meeting.notes ? `<div style="background:#f1f3f5;border-radius:10px;padding:12px 16px;margin:12px 0;font-size:14px;white-space:pre-wrap">${E(meeting.notes)}</div>` : ''}
<a href="${E(guestUrl)}" style="display:block;background:%%ACCENT%%;color:%%INK%%;border:2px solid %%ACCENT%%;text-decoration:none;text-align:center;padding:14px 24px;border-radius:999px;font-size:16px;font-weight:700;margin:22px 0 10px">${isHost ? tr('Apri la riunione') : tr('Partecipa alla riunione')}</a>
<p style="font-size:12px;color:#565c67;text-align:center;margin:0;word-break:break-all">${E(tr("Oppure copia questo link: {6}").replace("{6}", guestUrl))}</p>
<p style="font-size:13px;color:#565c67;margin:18px 0 0">${E(tr("Non serve installare nulla: si apre nel browser. Da telefono funziona con Chrome o Safari."))}</p>`;

  const footerParts = [E(b.platformName)];
  if (pub.info.companyName) footerParts.push(E(pub.info.companyName));
  const footerHtml = footerParts.join(' · ') + ' ' + tr('· In allegato trovi l\'evento da aggiungere al calendario.') +
    (pub.footer.enabled && pub.footer.text ? `<br><span style="opacity:.75">${E(pub.footer.text)}</span>` : '');

  const html = layout({
    b, title: E(meeting.title),
    subtitle: isHost ? tr('Hai pianificato questa riunione') : E(tr('Ti ha invitato {0}').replace('{0}',hostName || '')),
    bodyHtml, footerHtml, language,
  });
  const text = `${meeting.title}\n${dateStr}, ${timeStr} (${meeting.duration_min} min)\n\n${isHost ? tr('Apri') : tr('Partecipa')}: ${guestUrl}\n${meeting.notes ? '\n' + meeting.notes + '\n' : ''}`;

  await transporter.sendMail({
    from: { name: b.platformName, address: getSmtpConfig().from },
    to,
    subject: tr(isHost ? 'Confermata: {0}' : 'Invito: {0}').replace('{0}', meeting.title),
    html, text,
    attachments: [{ filename: 'meeting.ics', content: generateICS(meeting, guestUrl, language), contentType: 'text/calendar; method=REQUEST; charset=UTF-8' }],
  });
  return { sent: true };
}

/** Invio generico (test SMTP, check aggiornamenti) */
async function sendRaw({ to, subject, html, text }) {
  const transporter = createTransporter();
  if (!transporter) throw new Error('SMTP non configurato: imposta SMTP_HOST, SMTP_USER e SMTP_PASS in .env');
  const b = brand.getBrand(db, config);
  return transporter.sendMail({ from: { name: b.platformName, address: getSmtpConfig().from }, to, subject, html, text });
}

module.exports = { sendInvite, sendRaw, getSmtpStatus, generateICS };
