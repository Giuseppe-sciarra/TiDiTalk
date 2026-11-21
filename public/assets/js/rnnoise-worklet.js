'use strict';
/**
 * AudioWorklet RNNoise — riduzione del rumore di fondo (tastiera, ventole,
 * traffico) con la rete neurale RNNoise (Xiph/Mozilla) compilata in WebAssembly
 * (build @jitsi/rnnoise-wasm, Apache-2.0). Lavora a 48 kHz su frame da 480
 * campioni (10 ms): il ritardo introdotto è di 10 ms.
 *
 * Il thread principale manda il binario .wasm via port (il worklet non può
 * usare fetch). Finché il modulo non è pronto l'audio passa inalterato.
 *
 * 1.9.1: il .wasm lo scarica setup-rnnoise.sh (sempre l'ultima versione) insieme a
 * rnnoise.names.json, che dice come si chiamano le funzioni dentro questa build (nomi
 * corti a, b, c… che cambiano da una build all'altra). Senza quel file valgono i nomi
 * della build 0.2.1. Le importazioni si costruiscono da quello che il modulo chiede.
 */
const FRAME = 480;

class TdtRnnoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ready = false;
    this.enabled = true;
    this.inBuf = new Float32Array(FRAME);
    this.inLen = 0;
    this.fifo = new Float32Array(FRAME * 8);   // uscita in attesa
    this.fifoLen = 0;
    this.vad = 0;
    this.port.onmessage = (e) => {
      const d = e.data || {};
      if (d.wasm) this._init(d.wasm, d.names).catch(err => this.port.postMessage({ error: String(err && err.message || err) }));
      if (typeof d.enabled === 'boolean') this.enabled = d.enabled;
    };
  }

  async _init(bytes, names) {
    const N = names && names.exports;
    const nome = (k, def) => (N ? N[k] : def);            // con rnnoise.names.json: solo i suoi nomi
    const reali = (names && names.imports) || { a: 'emscripten_resize_heap', b: 'emscripten_memcpy_big' };
    const mod = await WebAssembly.compile(bytes);
    let mem = null, heap8 = null;
    const heap = () => (heap8 && heap8.buffer === mem.buffer) ? heap8 : (heap8 = new Uint8Array(mem.buffer));
    const copia = (dest, src, num) => { heap().copyWithin(dest, src, src + num); };
    const ferma = () => { throw new Error('rnnoise: abort'); };
    const fatte = {
      emscripten_resize_heap: () => 0,                    // la memoria iniziale basta (crescere staccherebbe le viste)
      emscripten_memcpy_big: copia, emscripten_memcpy_js: copia,
      abort: ferma, abort_js: ferma,
    };
    const imports = {};
    for (const im of WebAssembly.Module.imports(mod)) {
      const m = imports[im.module] || (imports[im.module] = {});
      if (im.kind === 'function') m[im.name] = fatte[String(reali[im.name] || im.name).replace(/^_+/, '')] || (() => 0);
      else if (im.kind === 'memory') m[im.name] = mem = new WebAssembly.Memory({ initial: 256 });
    }
    const instance = await WebAssembly.instantiate(mod, imports);
    const ex = instance.exports;
    if (!mem) { const e = WebAssembly.Module.exports(mod).find(x => x.kind === 'memory'); mem = e ? ex[e.name] : null; }
    if (!mem) throw new Error('rnnoise: memoria non trovata');
    const fn = (k, def) => { const f = ex[nome(k, def)]; if (typeof f !== 'function') throw new Error('rnnoise: manca ' + k); return f; };
    const ctors = ex[nome('__wasm_call_ctors', 'd')];
    if (typeof ctors === 'function') ctors();             // costruttori statici
    this.process_ = fn('rnnoise_process_frame', 'j');
    this.state = fn('rnnoise_create', 'f')(0);            // rnnoise_create(NULL) → modello di default
    const malloc = fn('malloc', 'g');
    this.pIn = malloc(FRAME * 4);
    this.pOut = malloc(FRAME * 4);
    if (!this.state || !this.pIn || !this.pOut) throw new Error('rnnoise: memoria insufficiente');
    this.mem = mem;
    this.f32 = new Float32Array(mem.buffer);
    this.ready = true;
    this.port.postMessage({ ready: true });
  }

  _processFrame() {
    if (this.f32.buffer !== this.mem.buffer) this.f32 = new Float32Array(this.mem.buffer);
    const f32 = this.f32;
    const inOff = this.pIn >> 2, outOff = this.pOut >> 2;
    for (let i = 0; i < FRAME; i++) f32[inOff + i] = this.inBuf[i] * 32768;   // rnnoise lavora in scala PCM16
    this.vad = this.process_(this.state, this.pOut, this.pIn);                 // rnnoise_process_frame → prob. voce
    if (this.fifoLen + FRAME > this.fifo.length) this.fifoLen = 0;             // non dovrebbe succedere
    for (let i = 0; i < FRAME; i++) this.fifo[this.fifoLen + i] = f32[outOff + i] / 32768;
    this.fifoLen += FRAME;
  }

  process(inputs, outputs) {
    const input = inputs[0] && inputs[0][0];
    const output = outputs[0] && outputs[0][0];
    if (!output) return true;
    if (!input) { output.fill(0); return true; }
    if (!this.ready || !this.enabled) { output.set(input); return true; }

    // accumula 480 campioni, elabora, metti in coda
    let i = 0;
    while (i < input.length) {
      const n = Math.min(FRAME - this.inLen, input.length - i);
      this.inBuf.set(input.subarray(i, i + n), this.inLen);
      this.inLen += n; i += n;
      if (this.inLen === FRAME) { this._processFrame(); this.inLen = 0; }
    }
    // consegna dalla coda (all'inizio manca un frame: 10 ms di silenzio)
    if (this.fifoLen >= output.length) {
      output.set(this.fifo.subarray(0, output.length));
      this.fifo.copyWithin(0, output.length, this.fifoLen);
      this.fifoLen -= output.length;
    } else output.fill(0);
    return true;
  }
}

registerProcessor('tdt-rnnoise', TdtRnnoiseProcessor);
