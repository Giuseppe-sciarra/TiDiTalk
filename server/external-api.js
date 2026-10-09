'use strict';

/**
 * TdMeet — External API per integrazioni esterne (es. CRM)
 * =========================================================
 * Esporta un installer per registrare le route esterne in server/index.js.
 *
 * Uso in index.js:
 *   const externalApi = require('./external-api');
 *   externalApi.install(app, { generateGuestToken, config, db });
 *
 * Endpoint esposti:
 *
 *   GET  /api/external/health
 *   POST /api/external/generate-guest-token    (compat v1)
 *   POST /api/external/schedule-meeting        (v2 — crea meeting pianificato)
 *   DELETE /api/external/meeting/:id           (v2 — elimina meeting)
 *
 * Tutti gli endpoint POST/DELETE richiedono header X-API-Key.
 */

function install(app, { generateGuestToken, config, db }) {

    const API_KEY = process.env.EXTERNAL_API_KEY || process.env.TD_EXTERNAL_API_KEY || '';
    const PUBLIC_URL = process.env.BASE_URL || process.env.PUBLIC_URL || '';
    if (!PUBLIC_URL) console.warn('[external-api] BASE_URL non impostato: i link generati saranno relativi');

    if (!API_KEY) {
        console.warn('[external-api] EXTERNAL_API_KEY non impostato: endpoint esterni DISATTIVATI');
        return;
    }

    function requireApiKey(req, res, next) {
        const provided = req.headers['x-api-key'] || '';
        const a = Buffer.from(String(provided)), b = Buffer.from(API_KEY);
        if (!provided || a.length !== b.length || !require('crypto').timingSafeEqual(a, b)) {
            return res.status(401).json({ error: 'API key non valida' });
        }
        next();
    }

    app.get('/api/external/health', (req, res) => {
        res.json({ ok: true, service: 'tdmeet', timestamp: Date.now() });
    });

    app.post('/api/external/generate-guest-token', requireApiKey, (req, res) => {
        try {
            const roomId = (req.body && req.body.roomId || '').toString().trim();
            const expDaysRaw = (req.body && req.body.expDays);
            const expDays = Math.min(
                Math.max(parseInt(expDaysRaw) || 365, 1),
                3650
            );

            if (!/^[a-zA-Z0-9_-]{3,64}$/.test(roomId)) {
                return res.status(400).json({
                    error: 'roomId non valido (3-64 caratteri alfanumerici, trattini e underscore)'
                });
            }

            const token = generateGuestToken(roomId, expDays * 24);
            const url = `${PUBLIC_URL.replace(/\/+$/, '')}/join/${token}`;

            console.log(`[external-api] Token generato per room=${roomId} exp=${expDays}d`);

            return res.json({
                token, url, roomId, expDays,
                expiresAt: new Date(Date.now() + expDays * 86400 * 1000).toISOString(),
            });
        } catch (e) {
            console.error('[external-api] errore generate-guest-token:', e);
            return res.status(500).json({ error: 'Errore interno' });
        }
    });

    app.post('/api/external/schedule-meeting', requireApiKey, (req, res) => {
        if (!db || typeof db.createMeeting !== 'function') {
            return res.status(500).json({ error: 'db.createMeeting non disponibile' });
        }
        try {
            const b = req.body || {};
            const title = (b.title || '').toString().trim();
            const scheduledRaw = (b.scheduled_at || '').toString().trim();
            if (!title) return res.status(400).json({ error: 'title obbligatorio' });
            if (!scheduledRaw) return res.status(400).json({ error: 'scheduled_at obbligatorio' });

            const scheduledDate = new Date(scheduledRaw);
            if (isNaN(scheduledDate.getTime())) {
                return res.status(400).json({ error: 'scheduled_at non è una data valida (usa ISO 8601)' });
            }

            const durationMin = Math.min(Math.max(parseInt(b.duration_min) || 60, 5), 1440);
            const invitees = Array.isArray(b.invitees) ? b.invitees.filter(e => typeof e === 'string' && e.includes('@')) : [];
            const notes = (b.notes || '').toString().slice(0, 2000);
            const createdBy = (b.created_by || 'external').toString().slice(0, 64);

            let roomId = (b.roomId || '').toString().trim();
            if (roomId) {
                if (!/^[a-zA-Z0-9_-]{3,64}$/.test(roomId)) {
                    return res.status(400).json({ error: 'roomId non valido' });
                }
                roomId = roomId.toUpperCase();
            } else {
                const crypto = require('crypto');
                roomId = 'EXT-' + crypto.randomBytes(4).toString('hex').toUpperCase();
            }

            const expDays = Math.min(Math.max(parseInt(b.expDays) || 3650, 1), 3650);

            const crypto = require('crypto');
            const meetId = crypto.randomUUID ? crypto.randomUUID() :
                crypto.randomBytes(16).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');

            const meeting = db.createMeeting({
                id: meetId,
                title,
                room_id: roomId,
                created_by: createdBy,
                scheduled_at: Math.floor(scheduledDate.getTime() / 1000),
                duration_min: durationMin,
                invitees,
                notes,
            });

            const guestToken = generateGuestToken(roomId, expDays * 24);
            const publicBase = PUBLIC_URL.replace(/\/+$/, '');
            const guestUrl = `${publicBase}/join/${guestToken}`;
            const hostUrl = `${publicBase}/room/${roomId}`;

            console.log(`[external-api] Meeting pianificato id=${meetId} room=${roomId} scheduled=${scheduledDate.toISOString()}`);

            return res.json({
                meeting, roomId, guestToken, guestUrl, hostUrl,
                expDays,
                expiresAt: new Date(Date.now() + expDays * 86400 * 1000).toISOString(),
            });
        } catch (e) {
            console.error('[external-api] errore schedule-meeting:', e);
            return res.status(500).json({ error: e.message || 'Errore interno' });
        }
    });

    app.delete('/api/external/meeting/:id', requireApiKey, (req, res) => {
        if (!db || typeof db.deleteMeeting !== 'function') {
            return res.status(500).json({ error: 'db.deleteMeeting non disponibile' });
        }
        try {
            const id = req.params.id;
            // Prima leggo il record per ottenere il created_by reale
            // (così funziona qualsiasi sia il creatore, non solo 'external')
            let createdBy = 'external';
            try {
                if (typeof db.getMeeting === 'function') {
                    const m = db.getMeeting(id);
                    if (m && m.created_by) createdBy = m.created_by;
                }
            } catch (e) { }
            const ok = db.deleteMeeting(id, createdBy);
            console.log(`[external-api] Meeting eliminato id=${id} created_by=${createdBy} ok=${ok}`);
            if (!ok) return res.status(404).json({ error: 'Meeting non trovato o già eliminato' });
            return res.json({ ok: true });
        } catch (e) {
            console.error('[external-api] errore delete meeting:', e);
            return res.status(500).json({ error: e.message || 'Errore interno' });
        }
    });

    console.log('[external-api] Endpoint esterni attivati: health, generate-guest-token, schedule-meeting, delete meeting');
}

module.exports = { install };