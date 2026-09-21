'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   Utenti da .env
   ───────────────────────────────────────────────────────────────────────────
   USERS=username:password:Nome visualizzato:ruolo,altro:password2:Altro Nome:host
     - separatore tra utenti: virgola (o a capo)
     - campi: username (obbl.), password (obbl.), nome (opz.), ruolo admin|host (opz., default admin)
     - la password può essere in chiaro o un hash bcrypt ($2a$/$2b$...).
       ATTENZIONE: in docker-compose un '$' va scritto '$$'.
     - password senza ':' e ',' (per password "strane" usa il pannello o un hash bcrypt)
   USERS_MODE=create (default) → crea solo gli utenti che mancano, non tocca quelli esistenti
   USERS_MODE=sync             → a ogni avvio .env è la fonte di verità: password, nome e ruolo
                                 vengono riallineati e nel pannello quegli utenti sono in sola lettura
   ═══════════════════════════════════════════════════════════════════════════ */
const bcrypt = require('bcryptjs');

const USERNAME_RE = /^[a-z0-9_.\-]{2,40}$/;

function parseUsersEnv(raw) {
  const out = [];
  const errors = [];
  if (!raw || !String(raw).trim()) return { users: out, errors };
  for (const chunk of String(raw).split(/[,\n]/)) {
    const line = chunk.trim();
    if (!line || line.startsWith('#')) continue;
    // la password bcrypt contiene '$' ma non ':' → split sicuro
    let [u, p, name, role] = line.split(':').map(x => (x || '').trim());
    // In docker-compose un '$' si scrive '$$': accettiamo entrambe le forme,
    // così un hash bcrypt funziona sia che compose lo interpoli sia che no.
    if (/^\$\$2[aby]\$\$/.test(p)) p = p.replace(/\$\$/g, '$');
    const username = (u || '').toLowerCase();
    if (!USERNAME_RE.test(username)) { errors.push(`username non valido: "${u}"`); continue; }
    if (!p) { errors.push(`password mancante per "${username}"`); continue; }
    if (!/^\$2[aby]\$/.test(p) && p.length < 8) { errors.push(`password troppo corta per "${username}" (min 8)`); continue; }
    const r = (role || 'admin').toLowerCase();
    out.push({ username, password: p, displayName: name || username, role: r === 'host' ? 'host' : 'admin' });
  }
  return { users: out, errors };
}

async function syncUsersFromEnv(db, env = process.env) {
  const mode = (env.USERS_MODE || 'create').toLowerCase() === 'sync' ? 'sync' : 'create';
  const { users, errors } = parseUsersEnv(env.USERS);
  errors.forEach(e => console.warn('[users-env]', e));
  let created = 0, updated = 0;
  for (const u of users) {
    const isHash = /^\$2[aby]\$/.test(u.password);
    const existing = db.getUser(u.username);
    if (!existing) {
      const hash = isHash ? u.password : await bcrypt.hash(u.password, 12);
      db.createUser({ username: u.username, passwordHash: hash, displayName: u.displayName, role: u.role, source: 'env' });
      created++;
      continue;
    }
    if (mode !== 'sync') continue;
    let passwordHash;
    if (isHash) { if (existing.password_hash !== u.password) passwordHash = u.password; }
    else if (!(await bcrypt.compare(u.password, existing.password_hash).catch(() => false))) {
      passwordHash = await bcrypt.hash(u.password, 12);
    }
    db.updateUser(u.username, { passwordHash, displayName: u.displayName, role: u.role, source: 'env' });
    updated++;
  }
  if (users.length) console.log(`[users-env] modalità ${mode}: ${created} creati, ${updated} riallineati, ${users.length} in .env`);
  return { mode, created, updated, envUsernames: new Set(users.map(u => u.username)) };
}

module.exports = { parseUsersEnv, syncUsersFromEnv };
