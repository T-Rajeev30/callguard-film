/** npm run samples — makes the four SYNTHETIC sample calls with Gnani Timbre (no real recordings anywhere). */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) for (const raw of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = raw.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const KEY = process.env.GNANI_API_KEY;
const SAMPLES = [
  { id: 'commit', text: 'सर, कल तक पक्का पेमेंट कर दूँगा।', voice: 'Shubham', language: 'hi-IN', model: 'timbre-v3.0' },
  { id: 'weak', text: 'Parso try karunga, chaar hazaar rupaye bhej dunga.', voice: 'Poorvi', language: 'hi-en', model: 'timbre-v2.5' },
  { id: 'confused', text: 'Sir, mera EMI kitna hai? Mujhe samajh nahi aaya.', voice: 'Poorvi', language: 'hi-en', model: 'timbre-v2.5' },
  { id: 'live', text: 'Haan ji sir, parso tak pakka payment kar dunga.', voice: 'Poorvi', language: 'hi-en', model: 'timbre-v2.5' },
  { id: 'dispute', text: 'सर, मैंने तो पिछले हफ्ते ही पेमेंट कर दिया था।', voice: 'Devansh', language: 'hi-IN', model: 'timbre-v3.0' },
];

function fixWav(buf: Buffer) {
  if (buf.subarray(0, 4).toString() !== 'RIFF') return buf;
  let pos = 12;
  while (pos + 8 <= buf.length) {
    const id = buf.subarray(pos, pos + 4).toString(); const size = buf.readUInt32LE(pos + 4);
    if (id === 'data') { const real = buf.length - pos - 8; buf.writeUInt32LE(real - (real % 2), pos + 4); break; }
    pos += 8 + size + (size % 2);
  }
  buf.writeUInt32LE(buf.length - 8, 4);
  return buf;
}

(async () => {
  if (!KEY) { console.error('Add GNANI_API_KEY to .env first.'); process.exit(1); }
  const out = path.join(ROOT, 'public', 'samples'); fs.mkdirSync(out, { recursive: true });
  for (const s of SAMPLES) {
    const r = await fetch('https://api.vachana.ai/api/v1/tts/inference', {
      method: 'POST', headers: { 'X-API-Key-ID': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: s.text, voice: s.voice, language: s.language, model: s.model, speed: 1.0,
        audio_config: { sample_rate: 24000, num_channels: 1, sample_width: 2, encoding: 'linear_pcm', container: 'wav' } }),
    });
    if (!r.ok) { console.error(`fail ${s.id}: ${r.status} ${await r.text()}`); continue; }
    fs.writeFileSync(path.join(out, `${s.id}.wav`), fixWav(Buffer.from(await r.arrayBuffer())));
    console.log(`ok ${s.id}  (${s.voice}, ${s.model})`);
  }
})();
