'use strict';

/**
 * TdtNoise — riduzione rumore avanzata (RNNoise in WebAssembly, vedi
 * rnnoise-worklet.js). Si inserisce fra il microfono e il producer:
 *
 *   microfono (track raw) → AudioWorklet RNNoise → track "pulito" → mediasoup
 *
 * Il track in uscita è STABILE: cambiando microfono basta setSource(nuovoTrack),
 * il producer continua a trasmettere lo stesso track. La preferenza è salvata
 * in localStorage (tdt_mic_rnn, default spento). Niente banda in più: il .wasm
 * (~110 KB) si scarica una volta dal server e resta in cache.
 */
(function () {
  const KEY = 'tdt_mic_rnn';
  let ctx = null, node = null, src = null, dest = null, ready = null;
  const api = {
    enabled: false,
    pending: false,   // 1.5.4: filtro pronto ma motore audio ancora fermo (si trasmette il mic normale)
    get outputTrack() { return dest?.stream.getAudioTracks()[0] || null; },
    wanted() { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } },
    setWanted(v) { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { } },
    supported() { return !!(window.AudioContext && window.AudioWorkletNode && window.WebAssembly); },

    /** Avvia (o riusa) la pipeline e collega il microfono. Ritorna il track pulito. */
    async enable(track) {
      if (!this.supported()) throw new Error('AudioWorklet non supportato da questo browser');
      if (!ctx) {
        ctx = new AudioContext({ sampleRate: 48000 });       // RNNoise lavora a 48 kHz
        ready = (async () => {
          await ctx.audioWorklet.addModule('/assets/js/rnnoise-worklet.js');
          const wasm = await (await fetch('/assets/vendor/rnnoise/rnnoise.wasm', { cache: 'force-cache' })).arrayBuffer();
          node = new AudioWorkletNode(ctx, 'tdt-rnnoise', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
          dest = ctx.createMediaStreamDestination();
          node.connect(dest);
          await new Promise((res, rej) => {
            const t = setTimeout(() => rej(new Error('RNNoise non si è avviato')), 8000);
            node.port.onmessage = (e) => {
              if (e.data?.ready) { clearTimeout(t); res(); }
              if (e.data?.error) { clearTimeout(t); rej(new Error(e.data.error)); }
            };
            node.port.postMessage({ wasm }, [wasm]);
          });
        })();
        ready.catch(() => { try { ctx?.close(); } catch { } ctx = null; node = null; dest = null; ready = null; });
      }
      await ready;
      // ⭐ 1.5.4: senza un tocco sulla pagina il browser tiene SOSPESO il motore
      // audio (ingresso diretto dalla home, rientro automatico). Prima qui si
      // aspettava resume(): su Firefox restava appeso per sempre ("Configurazione
      // media…") e altrove il filtro mandava SILENZIO agli altri. Ora si aspetta
      // al massimo mezzo secondo; se il motore è ancora fermo si trasmette il
      // microfono normale e il filtro entra da solo appena il motore parte.
      if (ctx.state !== 'running') {
        try { await Promise.race([ctx.resume(), new Promise(r => setTimeout(r, 500))]); } catch { }
      }
      this.enabled = true;
      const out = this.setSource(track);
      if (ctx.state !== 'running') {
        this.pending = true;
        if (!this._watching) {
          this._watching = true;
          ctx.addEventListener('statechange', () => {
            if (ctx && ctx.state === 'running' && this.pending) {
              this.pending = false;
              document.dispatchEvent(new CustomEvent('tdt:rnnoise-running'));
            }
          });
        }
        return track;
      }
      this.pending = false;
      return out;
    },

    /** Cambia il microfono in ingresso; il track in uscita resta lo stesso.
     *  Se il filtro è ancora in attesa del motore audio, o non accetta questo
     *  microfono (es. frequenze diverse su Firefox), torna il microfono normale. */
    setSource(track) {
      if (!ctx || !node) return track;
      try { src?.disconnect(); } catch { }
      src = null;
      if (track && track.readyState === 'live') {
        try {
          src = ctx.createMediaStreamSource(new MediaStream([track]));
          src.connect(node);
        } catch (e) {
          console.warn('[rnnoise] microfono non collegabile al filtro, uso quello normale', e?.message || e);
          this.disable(); this.setWanted(false);
          return track;
        }
      }
      if (this.pending) return track;
      return this.outputTrack || track;
    },

    disable() {
      this.enabled = false; this.pending = false;
      try { src?.disconnect(); } catch { }
      try { node?.disconnect(); } catch { }
      try { ctx?.close(); } catch { }
      src = node = dest = ctx = ready = null;
    },
  };
  // policy autoplay: se il contesto resta sospeso, lo si riprende al primo tocco
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => { }); }, { passive: true }));
  window.TdtNoise = api;
})();
