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

  CREATE TABLE IF NOT EXISTS feedback (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id      TEXT DEFAULT '',
    name         TEXT DEFAULT '',
    host         TEXT DEFAULT '',
    stars        INTEGER NOT NULL,
    comment      TEXT DEFAULT '',
    duration_sec INTEGER DEFAULT 0,
    created_at   INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS room_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id      TEXT NOT NULL,
    host_user    TEXT DEFAULT '',
    host_name    TEXT DEFAULT '',
    started_at   INTEGER NOT NULL,
    ended_at     INTEGER DEFAULT NULL,
    last_seen    INTEGER NOT NULL,
    peak_peers   INTEGER DEFAULT 0,
    participants TEXT DEFAULT '[]'
  );
  CREATE INDEX IF NOT EXISTS room_log_started ON room_log (started_at DESC);

  CREATE TABLE IF NOT EXISTS room_log_users (
    log_id   INTEGER NOT NULL REFERENCES room_log(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    hidden   INTEGER DEFAULT 0,
    PRIMARY KEY (log_id, username)
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

// ─── Feedback fine chiamata ──────────────────────────────────────────────────
const fbStmt = {
  add: db.prepare(`INSERT INTO feedback (room_id, name, host, stars, comment, duration_sec) VALUES (?, ?, ?, ?, ?, ?)`),
  list: db.prepare(`SELECT id, room_id AS roomId, name, host, stars, comment, duration_sec AS durationSec, created_at AS createdAt FROM feedback ORDER BY id DESC LIMIT ?`),
  del: db.prepare(`DELETE FROM feedback WHERE id = ?`),
};
function addFeedback(f) { fbStmt.add.run(f.roomId || '', f.name || '', f.host || '', f.stars, f.comment || '', f.durationSec || 0); }
function listFeedback(limit = 200) { return fbStmt.list.all(limit); }
function deleteFeedback(id) { if (Number.isFinite(id)) fbStmt.del.run(id); }

// ─── Registro riunioni (per la lista "Recenti" della home) ───────────────────
// Una riga per ogni stanza aperta; si chiude quando la stanza viene eliminata.
// room_log_users lega la riunione agli utenti registrati che ci sono entrati:
// ognuno vede nelle "recenti" solo le riunioni a cui ha partecipato.
const now = () => Math.floor(Date.now() / 1000);
const rlStmt = {
  start: db.prepare(`INSERT INTO room_log (room_id, started_at, last_seen) VALUES (?, ?, ?)`),
  setHost: db.prepare(`UPDATE room_log SET host_user = ?, host_name = ? WHERE id = ? AND host_user = ''`),
  touch: db.prepare(`UPDATE room_log SET last_seen = ?, peak_peers = ?, participants = ? WHERE id = ?`),
  end: db.prepare(`UPDATE room_log SET ended_at = ?, last_seen = ?, peak_peers = ?, participants = ? WHERE id = ?`),
  addUser: db.prepare(`INSERT OR IGNORE INTO room_log_users (log_id, username) VALUES (?, ?)`),
  closeOrphans: db.prepare(`UPDATE room_log SET ended_at = last_seen WHERE ended_at IS NULL`),
  recent: db.prepare(`
    SELECT l.id, l.room_id AS roomId, l.host_user AS hostUser, l.host_name AS hostName,
           l.started_at AS startedAt, l.ended_at AS endedAt, l.peak_peers AS peakPeers, l.participants
      FROM room_log l JOIN room_log_users u ON u.log_id = l.id
     WHERE u.username = ? AND u.hidden = 0
     ORDER BY l.started_at DESC LIMIT ?`),
  hide: db.prepare(`UPDATE room_log_users SET hidden = 1 WHERE log_id = ? AND username = ?`),
  prune: db.prepare(`DELETE FROM room_log WHERE started_at < ?`),
};
// al riavvio del server le righe rimaste aperte (crash, deploy) si chiudono
// all'ultimo istante visto, così la durata resta sensata
try { rlStmt.closeOrphans.run(); rlStmt.prune.run(now() - 180 * 86400); } catch (_) { }

function startRoomLog(roomId) {
  try { return rlStmt.start.run(String(roomId).slice(0, 64), now(), now()).lastInsertRowid; } catch (_) { return null; }
}
function setRoomLogHost(logId, username, displayName) {
  if (!logId) return;
  try { rlStmt.setHost.run(String(username || '').slice(0, 64), String(displayName || '').slice(0, 50), logId); } catch (_) { }
}
function addRoomLogUser(logId, username) {
  if (!logId || !username) return;
  try { rlStmt.addUser.run(logId, String(username).toLowerCase().slice(0, 64)); } catch (_) { }
}
function touchRoomLog(logId, peak, names) {
  if (!logId) return;
  try { rlStmt.touch.run(now(), peak | 0, JSON.stringify([...names].slice(0, 40)), logId); } catch (_) { }
}
function endRoomLog(logId, peak, names) {
  if (!logId) return;
  try { rlStmt.end.run(now(), now(), peak | 0, JSON.stringify([...names].slice(0, 40)), logId); } catch (_) { }
}
function recentRooms(username, limit = 12) {
  try {
    return rlStmt.recent.all(String(username).toLowerCase(), Math.min(Math.max(limit | 0, 1), 50)).map(r => {
      let participants = [];
      try { participants = JSON.parse(r.participants || '[]'); } catch (_) { }
      return { ...r, participants, durationSec: Math.max(0, (r.endedAt || now()) - r.startedAt) };
    });
  } catch (_) { return []; }
}
function hideRecentRoom(logId, username) {
  try { return rlStmt.hide.run(logId, String(username).toLowerCase()).changes > 0; } catch (_) { return false; }
}

module.exports = {
  startRoomLog, setRoomLogHost, addRoomLogUser, touchRoomLog, endRoomLog, recentRooms, hideRecentRoom,
  addFeedback, listFeedback, deleteFeedback,
  createMeeting, getMeeting, getMeetingByRoomId, getMeetings, getAllMeetings, deleteMeeting, updateMeeting,
  getSetting, setSetting, getAllSettings,
  getUser, createUser, updateUser, upsertUser, updateUserPassword, deleteUser, listUsers, countAdmins,
  recordLoginAttempt, countRecentFailedLogins,
};
