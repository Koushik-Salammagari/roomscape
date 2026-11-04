/**
 * Push-to-talk recording straight to 16 kHz mono WAV, the format Muse Voice
 * Transcribe takes. Raw samples are captured with Web Audio so it works the
 * same in Safari and Chrome, then resampled and wrapped in a WAV header.
 */
export type Recording = { stop: () => Promise<Blob>; cancel: () => void; level: () => number };

const RATE = 16_000;

export async function startRecording(): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const source = ctx.createMediaStreamSource(stream);
  const node = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  let last = 0;
  node.onaudioprocess = (e) => {
    const data = new Float32Array(e.inputBuffer.getChannelData(0));
    chunks.push(data);
    let sum = 0;
    for (let i = 0; i < data.length; i += 16) sum += data[i] * data[i];
    last = Math.sqrt(sum / (data.length / 16));
  };
  source.connect(node);
  node.connect(ctx.destination);

  const close = () => {
    node.disconnect();
    source.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
  };

  return {
    level: () => last,
    cancel: close,
    stop: async () => {
      // Let the last buffer arrive.
      await new Promise((r) => setTimeout(r, 120));
      close();
      const length = chunks.reduce((n, c) => n + c.length, 0);
      const all = new Float32Array(length);
      let at = 0;
      for (const c of chunks) {
        all.set(c, at);
        at += c.length;
      }
      return toWav(resample(all, ctx.sampleRate, RATE), RATE);
    },
  };
}

function resample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    // Average the samples that fall into each output slot: a cheap low-pass.
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

function toWav(samples: Float32Array, rate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const str = (o: number, s: string) => [...s].forEach((ch, i) => view.setUint8(o + i, ch.charCodeAt(0)));
  str(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}
