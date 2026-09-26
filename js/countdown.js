'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   TD Meet — Countdown pre-riunione (usato da guest.html)
   window.tdmeetCountdown(data, roomId):
     data = risposta di /api/guest/verify/:token → { meeting, serverNow, ... }
   Se la meeting è pianificata a più di GRACE_SEC nel futuro mostra l'overlay
   #cdOverlay e si sblocca da solo (fade → form nome) senza reload.
   Usa l'orario del SERVER (data.serverNow) per l'offset: l'orologio del
   dispositivo del guest può essere sballato.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  const GRACE_SEC = 10 * 60; // il guest può entrare da 10 min prima

  const POLL_SEC = 30; // ogni quanto ricontrollare se l'host è entrato

  window.tdmeetCountdown = function (data, roomId, token) {
    if (!data || !data.meeting || !data.meeting.scheduled_at) return;
    if (data.hostInRoom) return; // ⭐ host già in riunione → niente countdown, form subito

    const clockOffset = (data.serverNow || Math.floor(Date.now() / 1000)) - Math.floor(Date.now() / 1000);
    const serverNowFn = () => Math.floor(Date.now() / 1000) + clockOffset;
    const startAt = data.meeting.scheduled_at;

    if (startAt - serverNowFn() <= GRACE_SEC) return; // già iniziata o quasi: form subito

    const ov = document.getElementById('cdOverlay');
    if (!ov) return;
    document.getElementById('cdTitle').textContent = data.meeting.title || 'Riunione pianificata';
    document.getElementById('cdRoom').textContent = roomId;

    const dt = new Date(startAt * 1000);
    const dateStr = dt.toLocaleDateString(I18n.locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr = dt.toLocaleTimeString(I18n.locale, { hour: '2-digit', minute: '2-digit' });
    document.getElementById('cdWhen').innerHTML =
      '📅 <strong>' + dateStr.charAt(0).toUpperCase() + dateStr.slice(1) + '</strong> · ore <strong>' + timeStr + '</strong>';

    ov.style.display = 'flex';

    const elD = document.getElementById('cdD'), elH = document.getElementById('cdH'),
          elM = document.getElementById('cdM'), elS = document.getElementById('cdS');
    const pad = (n) => String(n).padStart(2, '0');
    const setNum = (el, v) => {
      if (el.textContent === v) return;
      el.textContent = v;
      el.classList.remove('cd-pop');
      void el.offsetWidth; // reflow: ri-triggera l'animazione
      el.classList.add('cd-pop');
    };

    let unlocked = false;
    let timer = null;
    let pollTimer = null;

    const unlock = (message) => {
      if (unlocked) return;
      unlocked = true;
      if (timer) clearInterval(timer);
      if (pollTimer) clearInterval(pollTimer);
      document.getElementById('cdKicker').textContent = message;
      const ov2 = document.getElementById('cdOverlay');
      ov2.classList.add('cd-soon');
      setTimeout(() => {
        ov2.classList.add('cd-hide');
        setTimeout(() => { ov2.style.display = 'none'; }, 700);
        document.getElementById('guestName').focus();
      }, 2200);
    };

    // ⭐ Polling: se un host entra in stanza prima dell'orario, sblocca subito
    if (token) {
      pollTimer = setInterval(async () => {
        if (unlocked) return;
        try {
          const r = await fetch('/api/guest/verify/' + encodeURIComponent(token));
          if (!r.ok) return;
          const j = await r.json();
          if (j.hostInRoom) unlock("🟢 L'host è già in riunione — puoi entrare!");
        } catch (e) { /* rete assente: riprova al prossimo giro */ }
      }, POLL_SEC * 1000);
    }

    const tick = () => {
      const remaining = startAt - serverNowFn();

      if (remaining <= GRACE_SEC) {
        // ── Sblocco: transizione al form guest ─────────────────────────────
        unlock('🎉 La riunione sta per iniziare!');
        return;
      }

      const cdSec = remaining - GRACE_SEC; // countdown fino allo SBLOCCO
      const d = Math.floor(cdSec / 86400);
      const h = Math.floor((cdSec % 86400) / 3600);
      const m = Math.floor((cdSec % 3600) / 60);
      const s = cdSec % 60;
      document.getElementById('cdBoxD').style.display = d > 0 ? '' : 'none';
      setNum(elD, String(d));
      setNum(elH, pad(h));
      setNum(elM, pad(m));
      setNum(elS, pad(s));
    };
    tick();
    timer = setInterval(tick, 1000);
  };
})();
