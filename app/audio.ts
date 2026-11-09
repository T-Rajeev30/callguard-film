// Browser-side audio prep: any recording/upload → mono PCM WAV that Prisma accepts.
// "Phone-line mode" degrades it to 8 kHz with a 300–3400 Hz band and line noise, like a real call.

export async function prepareWav(input: Blob, phone: boolean): Promise<{ wav: Blob; seconds: number }> {
  const ctx = new AudioContext();
  const decoded = await ctx.decodeAudioData(await input.arrayBuffer());
  await ctx.close();
  const seconds = Math.min(decoded.duration, 29.5);              // Prisma REST: up to 30 s
  const rate = phone ? 8000 : 16000;
  const off = new OfflineAudioContext(1, Math.ceil(seconds * rate), rate);
  const src = off.createBufferSource();
  src.buffer = decoded;
  let node: AudioNode = src;
  if (phone) {
    const hp = off.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 300;
    const lp = off.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3400;
    const drive = off.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = (i / 512) - 1; curve[i] = Math.tanh(2.2 * x) / Math.tanh(2.2); }
    drive.curve = curve;
    node.connect(hp); hp.connect(lp); lp.connect(drive); node = drive;
    // line noise
    const nb = off.createBuffer(1, Math.ceil(seconds * rate), rate);
    const d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.035 + Math.sin(i / rate * 2 * Math.PI * 50) * 0.01;
    const ns = off.createBufferSource(); ns.buffer = nb; ns.connect(off.destination); ns.start();
  }
  node.connect(off.destination);
  src.start();
  const out = await off.startRendering();
  return { wav: encodeWav(out.getChannelData(0), rate), seconds };
}

function encodeWav(samples: Float32Array, rate: number): Blob {
  const b = new ArrayBuffer(44 + samples.length * 2), v = new DataView(b);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 0x7fff, true);
  return new Blob([b], { type: 'audio/wav' });
}

export async function recordMic(maxSeconds = 20, onTick?: (s: number) => void): Promise<{ stop: () => void; done: Promise<Blob> }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  let t = 0;
  const iv = setInterval(() => { t++; onTick?.(t); if (t >= maxSeconds) rec.state === 'recording' && rec.stop(); }, 1000);
  const done = new Promise<Blob>((res) => { rec.onstop = () => { clearInterval(iv); stream.getTracks().forEach((x) => x.stop()); res(new Blob(chunks, { type: rec.mimeType })); }; });
  rec.start();
  return { stop: () => rec.state === 'recording' && rec.stop(), done };
}
