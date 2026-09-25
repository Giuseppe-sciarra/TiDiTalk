'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   update-report.js — riga di comando usata da auto-update.sh
   ───────────────────────────────────────────────────────────────────────────
   Due modi d'uso, entrambi da dentro il container:

     node server/update-report.js --versions
        → stampa su stdout il JSON { pacchetto: "versione", ... } delle
          dipendenze installate. auto-update.sh lo usa per fare la foto
          "prima" e "dopo".

     echo '<json>' | node server/update-report.js
        → manda l'email di riepilogo dell'aggiornamento notturno.
          JSON atteso:
          {
            "status": "ok" | "rollback" | "error",
            "before": { "mediasoup": "3.26.0", ... },
            "after":  { "mediasoup": "3.27.1", ... },
            "error":  "testo errore (solo se status != ok)",
            "duration": 123            // secondi, opzionale
          }

   Il destinatario è UPDATE_NOTIFY_EMAIL (o HOST_NOTIFY_EMAIL). SMTP e brand
   sono quelli dell'applicazione: stesso mittente delle email di invito.
   ═══════════════════════════════════════════════════════════════════════════ */

const PACKAGES = [
  'mediasoup', 'mediasoup-client', 'socket.io', 'express',
  'better-sqlite3', 'nodemailer', 'dotenv', 'cors', 'bcryptjs',
];

/** Versione installata di un pacchetto.
 *  `require('pkg/package.json')` fallisce sui pacchetti moderni che dichiarano
 *  "exports" senza esporre ./package.json (mediasoup, mediasoup-client,
 *  bcryptjs): in quel caso il file si legge direttamente da node_modules,
 *  altrimenti quei pacchetti sparivano dal riepilogo. */
function versionOf(pkg) {
  try { return require(`${pkg}/package.json`).version; } catch (_) { }
  const fs = require('fs');
  const path = require('path');
  const roots = [
    path.join(__dirname, 'node_modules'),
    path.join(__dirname, '..', 'node_modules'),
    ...(require.resolve.paths(pkg) || []),
  ];
  for (const root of roots) {
    try {
      const f = path.join(root, pkg, 'package.json');
      if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8')).version || null;
    } catch (_) { }
  }
  return null;
}

function installedVersions() {
  const out = {};
  for (const pkg of PACKAGES) {
    const v = versionOf(pkg);
    if (v) out[pkg] = v;
  }
  return out;
}

/** major | minor | patch | nuovo | rimosso */
function classify(from, to) {
  if (!from) return 'nuovo';
  if (!to) return 'rimosso';
  const a = String(from).split('.').map(n => parseInt(n, 10) || 0);
  const b = String(to).split('.').map(n => parseInt(n, 10) || 0);
  if (b[0] !== a[0]) return 'major';
  if (b[1] !== a[1]) return 'minor';
  return 'patch';
}

const ORDER = { major: 0, minor: 1, patch: 2, nuovo: 3, rimosso: 4 };
const COLORS = { major: '#c0453c', minor: '#2f6fb0', patch: '#3a7a5c', nuovo: '#5b5b5b', rimosso: '#5b5b5b' };

function diffRows(before = {}, after = {}) {
  const names = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return names
    .filter(p => before[p] !== after[p])
    .map(p => ({ pkg: p, from: before[p] || null, to: after[p] || null, kind: classify(before[p], after[p]) }))
    .sort((x, y) => (ORDER[x.kind] - ORDER[y.kind]) || x.pkg.localeCompare(y.pkg));
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function readStdin() {
  return new Promise((resolve) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', d => { buf += d; });
    process.stdin.on('end', () => resolve(buf));
    setTimeout(() => resolve(buf), 15000).unref?.();
  });
}

async function main() {
  if (process.argv.includes('--versions')) {
    process.stdout.write(JSON.stringify(installedVersions()) + '\n');
    return;
  }

  const raw = (await readStdin()).trim();
  let payload = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch (e) {
    console.error('[update-report] JSON non valido in ingresso:', e.message);
    process.exit(2);
  }

  const status = payload.status || 'ok';
  const rows = diffRows(payload.before, payload.after);
  const counts = rows.reduce((acc, r) => { acc[r.kind] = (acc[r.kind] || 0) + 1; return acc; }, {});
  const durata = payload.duration ? `${Math.round(payload.duration / 60)} min` : null;

  // Niente da dire: nessun aggiornamento e nessun problema → nessuna email.
  if (status === 'ok' && !rows.length && !payload.always) {
    console.log('[update-report] nessun aggiornamento: email non inviata');
    return;
  }

  let appName = 'Tiditalk';
  let mailer = null;
  try { appName = require('./config').brand.appName; } catch (_) { }
  try {
    const db = require('./db');
    const brand = require('./brand');
    appName = brand.getBrand(db, require('./config')).platformName || appName;
  } catch (_) { }
  try { mailer = require('./mailer'); } catch (e) {
    console.error('[update-report] mailer non disponibile:', e.message);
    process.exit(3);
  }

  const to = (process.env.UPDATE_NOTIFY_EMAIL || process.env.HOST_NOTIFY_EMAIL || '').trim();
  if (!to) { console.log('[update-report] nessun destinatario: email non inviata'); return; }

  const badge = (kind) => `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#fff;background:${COLORS[kind]}">${kind}</span>`;

  const trs = rows.map(r => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e3e5ea;font-family:ui-monospace,Menlo,monospace">${esc(r.pkg)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e3e5ea;color:#565c67">${esc(r.from || '—')}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e3e5ea"><b>${esc(r.to || '—')}</b></td>
      <td style="padding:8px 12px;border-bottom:1px solid #e3e5ea">${badge(r.kind)}</td>
    </tr>`).join('');

  const riepilogo = [
    counts.major ? `${counts.major} major` : null,
    counts.minor ? `${counts.minor} minor` : null,
    counts.patch ? `${counts.patch} patch` : null,
    counts.nuovo ? `${counts.nuovo} nuovi` : null,
  ].filter(Boolean).join(' · ') || 'nessuna modifica';

  const titolo = status === 'ok'
    ? 'Aggiornamento automatico completato'
    : status === 'rollback'
      ? 'Aggiornamento annullato: ripristinata la versione precedente'
      : 'Aggiornamento automatico fallito';

  const colore = status === 'ok' ? '#3a7a5c' : status === 'rollback' ? '#b8892b' : '#c0453c';

  // ── Istruzioni per tornare indietro (sempre incluse: servono quando serve) ──
  const rb = payload.rollbackInfo || {};
  const dir = rb.dir || '/percorso/del/progetto';
  const service = rb.service || 'app';
  const img = rb.image || 'tdt-meet:rollback';
  const imgName = rb.imageName || 'tdt-meet:latest';
  const pkgBak = rb.pkg || 'backups/package.json.<data>.bak';
  const lockBak = rb.lock || 'backups/package-lock.json.<data>.bak';

  const cmdTornaIndietro = [
    `cd ${dir}`,
    `cp ${pkgBak} server/package.json`,
    `cp ${lockBak} server/package-lock.json   # se esiste`,
    `docker tag ${img} ${imgName}`,
    `docker compose up -d --no-build ${service}`,
  ].join('\n');

  const cmdRiprova = [
    `cd ${dir}`,
    `bash auto-update.sh          # rifà tutto adesso`,
    `bash auto-update.sh --dry-run  # solo per vedere cosa cambierebbe`,
  ].join('\n');

  const cmdLog = `docker compose logs ${service} --tail 80`;

  const pre = (txt) => `<pre style="margin:8px 0 0;padding:12px 14px;background:#f1f3f5;border:1px solid #e3e5ea;border-radius:10px;font:12.5px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;color:#16181d">${esc(txt)}</pre>`;

  const boxTornaIndietro = `
  <tr><td style="padding:4px 28px 20px">
    <div style="border:1px solid #e3e5ea;border-radius:12px;padding:16px 18px;background:#fbfbfc">
      <div style="font-weight:700;font-size:14px;margin-bottom:2px">Se qualcosa non funziona</div>
      <div style="font-size:13px;color:#565c67">Prima guarda i log:</div>
      ${pre(cmdLog)}
      <div style="font-size:13px;color:#565c67;margin-top:14px">Per tornare alla versione di ieri — immagine e dipendenze com'erano prima di stamattina:</div>
      ${pre(cmdTornaIndietro)}
      <div style="font-size:12.5px;color:#858b96;margin-top:10px">
        Il ripristino non tocca il database né le impostazioni: torna indietro solo il codice delle dipendenze.
        L'immagine precedente resta salvata come <b>${esc(img)}</b> e i backup in <b>${esc(dir)}/backups/</b> (ultimi 10).
      </div>
      <div style="font-size:13px;color:#565c67;margin-top:14px">Quando vuoi riprovare l'aggiornamento:</div>
      ${pre(cmdRiprova)}
    </div>
  </td></tr>`;

  const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0;padding:24px;background:#f5f6f8;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#16181d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #e3e5ea;border-radius:16px;overflow:hidden">
  <tr><td style="padding:26px 28px 6px">
    <div style="font-size:13px;font-weight:600;color:#565c67">${esc(appName)} · aggiornamento notturno</div>
    <h1 style="margin:8px 0 4px;font-size:24px;font-weight:600;line-height:1.2;color:${colore}">${esc(titolo)}</h1>
    <p style="margin:0;color:#565c67;font-size:14px">${esc(riepilogo)}${durata ? ` · durata ${esc(durata)}` : ''}</p>
  </td></tr>
  ${payload.error ? `<tr><td style="padding:12px 28px"><div style="background:#fdecea;border:1px solid #f3c2bd;border-radius:10px;padding:12px 14px;font-size:13px;white-space:pre-wrap">${esc(payload.error)}</div></td></tr>` : ''}
  ${rows.length ? `<tr><td style="padding:14px 28px 24px">
    <table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px">
      <tr>
        <th align="left" style="padding:0 12px 8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#858b96">Pacchetto</th>
        <th align="left" style="padding:0 12px 8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#858b96">Prima</th>
        <th align="left" style="padding:0 12px 8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#858b96">Dopo</th>
        <th align="left" style="padding:0 12px 8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#858b96">Tipo</th>
      </tr>
      ${trs}
    </table>
  </td></tr>` : ''}
  ${boxTornaIndietro}
  <tr><td style="padding:14px 28px;border-top:1px solid #e3e5ea;font-size:12px;color:#565c67">
    ${status === 'ok'
      ? 'Il servizio è stato ricostruito, risponde ed è di nuovo in linea. Backup e immagine precedente restano disponibili per 10 aggiornamenti.'
      : status === 'rollback'
        ? 'Il servizio non rispondeva dopo l\'aggiornamento: sono stati ripristinati package.json e immagine precedenti. Nessun intervento urgente, ma vale la pena guardare i log.'
        : 'L\'aggiornamento si è interrotto. Controlla il log su host e lo stato dei container.'}
  </td></tr>
</table></td></tr></table></body></html>`;

  const text = `${appName} — ${titolo}\n${riepilogo}${durata ? ` (durata ${durata})` : ''}\n\n`
    + rows.map(r => `- ${r.pkg}: ${r.from || '—'} → ${r.to || '—'} [${r.kind}]`).join('\n')
    + (payload.error ? `\n\nErrore:\n${payload.error}` : '')
    + `\n\nSE QUALCOSA NON FUNZIONA\nLog:\n${cmdLog}\n\nTornare alla versione precedente:\n${cmdTornaIndietro}\n\nRiprovare l'aggiornamento:\n${cmdRiprova}\n`;

  const subject = status === 'ok'
    ? `${appName}: aggiornato (${riepilogo})`
    : status === 'rollback'
      ? `${appName}: aggiornamento annullato, rollback eseguito`
      : `${appName}: aggiornamento FALLITO`;

  await mailer.sendRaw({ to, subject, html, text });
  console.log(`[update-report] email inviata a ${to} (${rows.length} pacchetti)`);
}

main().catch(e => { console.error('[update-report]', e.message); process.exit(1); });
