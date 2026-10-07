'use strict';

/**
 * TdtTicker — timer che continua a girare anche con la scheda in background.
 *
 * requestAnimationFrame viene sospeso dal browser quando la scheda non è
 * visibile: le pipeline che disegnano su un canvas (effetti viso, sfondo
 * virtuale, registrazione) smettevano di produrre frame e gli altri vedevano
 * l'utente congelato finché non tornava sulla scheda. I timer dentro un Web
 * Worker non vengono rallentati: da lì arriva un "tick" a intervallo fisso.
 *
 *   const t = TdtTicker.start(() => draw(), 33);   // ~30 fps
 *   t.stop();
 *
 * Con la scheda visibile si usa comunque requestAnimationFrame (sincronizzato
 * al refresh, più fluido); il worker subentra solo quando document.hidden.
 */
(function () {
  let worker = null;
  const subs = new Map(); // id → { fn, ms, last }
  let nextId = 1;
  const PERIOD = 16; // il worker batte a ~60 Hz, ogni iscritto fa il suo rateo

  function ensureWorker() {
    if (worker) return worker;
    try {
      const src = 'let t=null;onmessage=e=>{if(t){clearInterval(t);t=null}if(e.data>0)t=setInterval(()=>postMessage(1),e.data)};';
      worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      worker.onmessage = () => {
        if (!document.hidden) return;               // in primo piano guida il rAF
        const now = performance.now();
        subs.forEach(s => {
          if (now - s.last >= s.ms - 2) { s.last = now; try { s.fn(); } catch (e) { console.warn('[ticker]', e); } }
        });
      };
      worker.postMessage(PERIOD);
    } catch (e) {
      console.warn('[ticker] worker non disponibile, fallback setInterval', e);
      worker = { fallback: setInterval(() => {
        if (!document.hidden) return;
        const now = performance.now();
        subs.forEach(s => { if (now - s.last >= s.ms - 2) { s.last = now; try { s.fn(); } catch (_) { } } });
      }, PERIOD), terminate() { clearInterval(this.fallback); } };
    }
    return worker;
  }

  function start(fn, ms = 33) {
    const id = nextId++;
    subs.set(id, { fn, ms, last: 0 });
    ensureWorker();
    let raf = 0, stopped = false;
    const loop = () => {
      if (stopped) return;
      if (!document.hidden) { try { fn(); } catch (e) { console.warn('[ticker]', e); } }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return {
      stop() {
        stopped = true;
        if (raf) cancelAnimationFrame(raf);
        subs.delete(id);
        if (!subs.size && worker) { try { worker.terminate(); } catch (_) { } worker = null; }
      },
    };
  }

  window.TdtTicker = { start };
})();
