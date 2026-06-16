// Runs in the dedicated AudioWorklet thread (off the main thread).
// Accumulates 4096-sample batches and posts them to the main thread.
const BATCH_SIZE = 4096;

class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buf = new Float32Array(BATCH_SIZE);
    this._pos = 0;
  }

  process(inputs) {
    const ch = inputs[0]?.[0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this._buf[this._pos++] = ch[i];
      if (this._pos >= BATCH_SIZE) {
        this.port.postMessage(this._buf.slice(0));
        this._pos = 0;
      }
    }
    return true; // keep processor alive
  }
}

registerProcessor('pcm-processor', PCMProcessor);
