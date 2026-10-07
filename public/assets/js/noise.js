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
      if (ctx.state === 'suspended') { try { await ctx.resume(); } catch { } }
      this.enabled = true;
      return this.setSource(track);
    },

    /** Cambia il microfono in ingresso; il track in uscita resta lo stesso. */
    setSource(track) {
      if (!ctx || !node) return track;
      try { src?.disconnect(); } catch { }
      src = null;
      if (track && track.readyState === 'live') {
        src = ctx.createMediaStreamSource(new MediaStream([track]));
        src.connect(node);
      }
      return this.outputTrack || track;
    },

    disable() {
      this.enabled = false;
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
