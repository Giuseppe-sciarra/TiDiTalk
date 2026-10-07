'use strict';
/**
 * AudioWorklet RNNoise — riduzione del rumore di fondo (tastiera, ventole,
 * traffico) con la rete neurale RNNoise (Xiph/Mozilla) compilata in WebAssembly
 * (build @jitsi/rnnoise-wasm, Apache-2.0). Lavora a 48 kHz su frame da 480
 * campioni (10 ms): il ritardo introdotto è di 10 ms.
 *
 * Il thread principale manda il binario .wasm via port (il worklet non può
 * usare fetch). Finché il modulo non è pronto l'audio passa inalterato.
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
      if (d.wasm) this._init(d.wasm).catch(err => this.port.postMessage({ error: String(err && err.message || err) }));
      if (typeof d.enabled === 'boolean') this.enabled = d.enabled;
    };
  }

  async _init(bytes) {
    let heap8 = null;
    const imports = { a: {
      a: () => 0,                                             // emscripten_resize_heap: la memoria iniziale basta
      b: (dest, src, num) => { heap8.copyWithin(dest, src, src + num); }, // emscripten_memcpy_big
    } };
    const { instance } = await WebAssembly.instantiate(bytes, imports);
    const ex = instance.exports;
    heap8 = new Uint8Array(ex.c.buffer);
    ex.d();                                   // costruttori statici
    this.state = ex.f(0);                     // rnnoise_create(NULL) → modello di default
    this.pIn = ex.g(FRAME * 4);               // malloc
    this.pOut = ex.g(FRAME * 4);
    if (!this.state || !this.pIn || !this.pOut) throw new Error('rnnoise: memoria insufficiente');
    this.ex = ex;
    this.f32 = new Float32Array(ex.c.buffer);
    this.ready = true;
    this.port.postMessage({ ready: true });
  }

  _processFrame() {
    const ex = this.ex, f32 = this.f32;
    const inOff = this.pIn >> 2, outOff = this.pOut >> 2;
    for (let i = 0; i < FRAME; i++) f32[inOff + i] = this.inBuf[i] * 32768;   // rnnoise lavora in scala PCM16
    this.vad = ex.j(this.state, this.pOut, this.pIn);                          // rnnoise_process_frame → prob. voce
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
