'use strict';

const path    = require('path');
const fs      = require('fs');
const Database = require('better-sqlite3');

const DB_DIR  = process.env.DB_DIR || path.join(__dirname, '../data');
// Nome file configurabile; default storico 'tdmeet.db' per non perdere i dati esistenti
const DB_PATH = path.join(DB_DIR, process.env.DB_FILE || 'tdmeet.db');

// Assicura che la cartella data esista
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);

// Pragma per performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
// Ottimizzazioni per HDD + workload mostly-read:
db.pragma('synchronous = NORMAL');   // meno fsync (FULL sarebbe paranoico per questo caso)
db.pragma('cache_size = -32000');    // 32 MB di cache in RAM (default 2 MB)
db.pragma('temp_store = MEMORY');    // tabelle temp in RAM invece che su disco
db.pragma('mmap_size = 134217728');  // 128 MB di memory-mapped I/O (più veloce di seek tradizionali)

// ─── Schema ───────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS meetings (
    id           TEXT PRIMARY KEY,
    title        TEXT NOT NULL,
    room_id      TEXT NOT NULL,
    created_by   TEXT NOT NULL,
    scheduled_at INTEGER NOT NULL,
    duration_min INTEGER NOT NULL DEFAULT 60,
    invitees     TEXT NOT NULL DEFAULT '[]',
    notes        TEXT DEFAULT '',
    created_at   INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

// ⭐ FIX schedule-link: aggiunge colonna guest_token alle meetings esistenti.
// Prima ogni meeting generava N token "al volo" (uno per email + uno per ogni
// click su "Copia link") che NON erano persistiti. Risultato: link diversi a
// ogni rigenerazione e durate incoerenti.
// Ora: un UNICO guest_token persistito, condiviso tra email e UI.
// Migration safe: se la colonna esiste già, ALTER TABLE fallisce con
// "duplicate column name" — lo catturiamo e proseguiamo.
try {
  db.exec(`ALTER TABLE meetings ADD COLUMN guest_token TEXT DEFAULT NULL`);
  console.log('[db] migration: aggiunta colonna meetings.guest_token');
} catch (e) {
  if (!/duplicate column/i.test(e.message)) {
    console.warn('[db] ALTER TABLE meetings.guest_token:', e.message);
  }
}

// ─── Query helpers ────────────────────────────────────────────────────────────

const stmt = {
  insert: db.prepare(`
    INSERT INTO meetings (id, title, room_id, created_by, scheduled_at, duration_min, invitees, notes, guest_token)
    VALUES (@id, @title, @room_id, @created_by, @scheduled_at, @duration_min, @invitees, @notes, @guest_token)
  `),

  getById: db.prepare(`SELECT * FROM meetings WHERE id = ?`),

  getAll: db.prepare(`SELECT * FROM meetings ORDER BY scheduled_at ASC`),

  getUpcoming: db.prepare(`
    SELECT * FROM meetings
    WHERE scheduled_at >= @from
    ORDER BY scheduled_at ASC
  `),

  getPast: db.prepare(`
    SELECT * FROM meetings
    WHERE scheduled_at < @from
    ORDER BY scheduled_at DESC
    LIMIT 20
  `),

  // ⭐ FIX schedule-link: lookup veloce della meeting per roomId per recuperare
  // il guest_token persistito (chiamato da /api/room/:roomId/invite).
  getByRoomId: db.prepare(`
    SELECT * FROM meetings
    WHERE room_id = ?
    ORDER BY scheduled_at DESC
    LIMIT 1
  `),

  delete: db.prepare(`DELETE FROM meetings WHERE id = ? AND created_by = ?`),

  update: db.prepare(`
    UPDATE meetings
    SET title = @title, scheduled_at = @scheduled_at, duration_min = @duration_min,
        invitees = @invitees, notes = @notes
    WHERE id = @id AND created_by = @created_by
  `),
};

// ─── API ──────────────────────────────────────────────────────────────────────

function createMeeting(data) {
  stmt.insert.run({
    ...data,
    invitees: JSON.stringify(data.invitees || []),
    guest_token: data.guest_token || null,    // ⭐ FIX schedule-link: persistito dal caller
  });
  return getMeeting(data.id);
}

function getMeeting(id) {
  const row = stmt.getById.get(id);
  if (!row) return null;
  return { ...row, invitees: JSON.parse(row.invitees) };
}

// ⭐ FIX schedule-link: pesca la meeting più recente con quel roomId.
// Serve a /api/room/:roomId/invite per restituire il guest_token persistito
// invece di generarne uno nuovo a ogni click.
function getMeetingByRoomId(roomId) {
  const row = stmt.getByRoomId.get(roomId);
  if (!row) return null;
  return { ...row, invitees: JSON.parse(row.invitees) };
}

function getMeetings() {
  const now = Math.floor(Date.now() / 1000);
  const upcoming = stmt.getUpcoming.all({ from: now - 3600 }); // include ultim'ora
  return upcoming.map(r => ({ ...r, invitees: JSON.parse(r.invitees) }));
}

function getAllMeetings() {
  return stmt.getAll.all().map(r => ({ ...r, invitees: JSON.parse(r.invitees) }));
}

function deleteMeeting(id, createdBy) {
  const result = stmt.delete.run(id, createdBy);
  return result.changes > 0;
}

function updateMeeting(data) {
  const result = stmt.update.run({
    ...data,
    invitees: JSON.stringify(data.invitees || []),
  });
  return result.changes > 0 ? getMeeting(data.id) : null;
}

// ─── Settings (key/value JSON) ────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS users (
    username      TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    display_name  TEXT DEFAULT '',
    created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS login_attempts (
    ip       TEXT NOT NULL,
    username TEXT DEFAULT '',
    ts       INTEGER NOT NULL,
    success  INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_ts ON login_attempts(ip, ts);
`);

const settingsStmt = {
  get: db.prepare(`SELECT value FROM settings WHERE key = ?`),
  set: db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, unixepoch())
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()
  `),
  all: db.prepare(`SELECT key, value FROM settings`),
};

function getSetting(key, defaultValue = null) {
  const row = settingsStmt.get.get(key);
  if (!row) return defaultValue;
  try { return JSON.parse(row.value); } catch { return defaultValue; }
}

function setSetting(key, value) {
  settingsStmt.set.run(key, JSON.stringify(value));
}

function getAllSettings() {
  const rows = settingsStmt.all.all();
  const out = {};
  for (const r of rows) {
    try { out[r.key] = JSON.parse(r.value); } catch { out[r.key] = r.value; }
  }
  return out;
}

// ─── Users (bcrypt in DB) ─────────────────────────────────────────────────────
// role:   'admin' (impostazioni + utenti) | 'host' (crea/gestisce riunioni)
// source: 'ui' (creato dal pannello) | 'env' (creato/gestito da USERS in .env)
// Migration: gli utenti già esistenti diventano admin (nessuno perde accessi).
for (const [col, def] of [['role', "TEXT NOT NULL DEFAULT 'admin'"], ['source', "TEXT NOT NULL DEFAULT 'ui'"]]) {
  try { db.exec(`ALTER TABLE users ADD COLUMN ${col} ${def}`); console.log(`[db] migration: aggiunta colonna users.${col}`); }
  catch (e) { if (!/duplicate column/i.test(e.message)) console.warn(`[db] ALTER users.${col}:`, e.message); }
}

const USER_ROLES = new Set(['admin', 'host']);
const userStmt = {
  get: db.prepare(`SELECT * FROM users WHERE username = ?`),
  insert: db.prepare(`
    INSERT INTO users (username, password_hash, display_name, role, source, created_at, updated_at)
    VALUES (@username, @password_hash, @display_name, @role, @source, unixepoch(), unixepoch())
  `),
  update: db.prepare(`
    UPDATE users SET
      password_hash = COALESCE(@password_hash, password_hash),
      display_name  = COALESCE(@display_name, display_name),
      role          = COALESCE(@role, role),
      source        = COALESCE(@source, source),
      updated_at    = unixepoch()
    WHERE username = @username
  `),
  delete: db.prepare(`DELETE FROM users WHERE username = ?`),
  list: db.prepare(`SELECT username, display_name, role, source, created_at, updated_at FROM users ORDER BY username`),
  countAdmins: db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin'`),
};

function getUser(username) {
  if (!username) return null;
  return userStmt.get.get(String(username).toLowerCase()) || null;
}

function createUser({ username, passwordHash, displayName = '', role = 'host', source = 'ui' }) {
  userStmt.insert.run({
    username: String(username).toLowerCase(),
    password_hash: passwordHash,
    display_name: displayName || '',
    role: USER_ROLES.has(role) ? role : 'host',
    source: source === 'env' ? 'env' : 'ui',
  });
}

function updateUser(username, { passwordHash, displayName, role, source } = {}) {
  const r = userStmt.update.run({
    username: String(username).toLowerCase(),
    password_hash: passwordHash || null,
    display_name: displayName === undefined ? null : String(displayName),
    role: USER_ROLES.has(role) ? role : null,
    source: source === 'env' || source === 'ui' ? source : null,
  });
  return r.changes > 0;
}

// Compat con il codice precedente (migrazione/cambio password)
function upsertUser(username, passwordHash, displayName = '') {
  if (getUser(username)) return updateUser(username, { passwordHash, displayName: displayName || undefined });
  createUser({ username, passwordHash, displayName, role: 'admin' });
}

function updateUserPassword(username, passwordHash) {
  return updateUser(username, { passwordHash });
}

function deleteUser(username) {
  return userStmt.delete.run(String(username).toLowerCase()).changes > 0;
}

function listUsers() {
  return userStmt.list.all();
}

function countAdmins() {
  return userStmt.countAdmins.get().n;
}

// ─── Login attempts (rate limit per IP) ───────────────────────────────────────

const loginStmt = {
  insert: db.prepare(`INSERT INTO login_attempts (ip, username, ts, success) VALUES (?, ?, ?, ?)`),
  countFailed: db.prepare(`SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ? AND success = 0 AND ts > ?`),
  cleanup: db.prepare(`DELETE FROM login_attempts WHERE ts < ?`),
};

function recordLoginAttempt(ip, username, success) {
  try {
    const ts = Math.floor(Date.now() / 1000);
    loginStmt.insert.run(ip || 'unknown', (username || '').substring(0, 64), ts, success ? 1 : 0);
    // Cleanup: tieni solo ultimi 7gg
    loginStmt.cleanup.run(ts - 7 * 24 * 3600);
  } catch (_) {}
}

function countRecentFailedLogins(ip, windowMin) {
  try {
    const cutoff = Math.floor(Date.now() / 1000) - (windowMin * 60);
    const row = loginStmt.countFailed.get(ip, cutoff);
    return row ? row.n : 0;
  } catch (_) { return 0; }
}

module.exports = {
  createMeeting, getMeeting, getMeetingByRoomId, getMeetings, getAllMeetings, deleteMeeting, updateMeeting,
  getSetting, setSetting, getAllSettings,
  getUser, createUser, updateUser, upsertUser, updateUserPassword, deleteUser, listUsers, countAdmins,
  recordLoginAttempt, countRecentFailedLogins,
};
