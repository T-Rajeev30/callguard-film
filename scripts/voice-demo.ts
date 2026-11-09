/**
 * npm run voice:demo - the narrator for the demo videos (explains each step of the live recording).
 * Provider from .env: NARRATOR_PROVIDER=sarvam (needs SARVAM_API_KEY) or gnani (Timbre en-IN, default).
 * Writes public/demo/vo/<id>.wav and public/demo/vo.json. Timing comes from public/demo/events.json (made by the recorder).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) for (const raw of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = raw.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const env = (k: string, d?: string) => process.env[k] || d;

// short lines play at a step's caption (before any call audio); "x" lines play after the call audio, over the signals
export const LINES: Record<string, string> = {
  bridge: 'Now, for real.',
  intro: 'This is VaaniLens, running live on Gnani AI. Every result here is a real A P I call.',
  s1: 'First, a promise in Hinglish.',
  s1x: 'Gnani Prisma transcribes the code-mixed speech. VaaniLens pulls out the commitment, the deadline, and the follow-up. Then Gnani Timbre speaks the reminder, in Hindi.',
  s2: 'Now, phone-line mode. Eight kilohertz, with line noise.',
  s2x: 'Prisma still hears it, and VaaniLens marks this promise as low confidence.',
  s3: 'A confused customer.',
  s3x: 'VaaniLens flags the confusion, and suggests explaining the E M I in their own language.',
  s4: 'And a dispute.',
  s4x: 'So VaaniLens pauses the reminders, and asks for a ledger check instead.',
  s5: 'Finally, a live microphone call, end to end.',
  usecases: "The same Gnani voice stack can call a shop's customers about new offers, in their own language.",
  outro: 'VaaniLens. Hear beyond the words. Built on Gnani Prisma and Timbre.',
};

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
const wavSeconds = (b: Buffer) => {
  let pos = 12, rate = 24000, ch = 1, bits = 16, data = 0;
  while (pos + 8 <= b.length) {
    const id = b.subarray(pos, pos + 4).toString(); const size = b.readUInt32LE(pos + 4);
    if (id === 'fmt ') { ch = b.readUInt16LE(pos + 10); rate = b.readUInt32LE(pos + 12); bits = b.readUInt16LE(pos + 22); }
    if (id === 'data') { data = Math.min(size, b.length - pos - 8); break; }
    pos += 8 + size + (size % 2);
  }
  return data / (rate * ch * (bits / 8));
};

async function speak(text: string): Promise<Buffer> {
  if (env('NARRATOR_PROVIDER', 'gnani') === 'sarvam') {
    const r = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST', headers: { 'api-subscription-key': env('SARVAM_API_KEY')!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, target_language_code: 'en-IN', speaker: env('SARVAM_NARRATOR', 'shubh'), model: 'bulbul:v3', speech_sample_rate: 48000 }),
    });
    if (!r.ok) throw new Error(`Sarvam ${r.status}: ${await r.text()}`);
    const j = (await r.json()) as { audios?: string[] };
    return fixWav(Buffer.from(j.audios![0], 'base64'));
  }
  const r = await fetch('https://api.vachana.ai/api/v1/tts/inference', {
    method: 'POST', headers: { 'X-API-Key-ID': env('GNANI_API_KEY')!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice: env('NARRATOR_VOICE', 'Avinash'), language: 'en-IN', model: 'timbre-v3.0', speed: 1.0,
      audio_config: { sample_rate: 48000, num_channels: 1, sample_width: 2, encoding: 'linear_pcm', container: 'wav' } }),
  });
  if (!r.ok) throw new Error(`Timbre ${r.status}: ${await r.text()}`);
  return fixWav(Buffer.from(await r.arrayBuffer()));
}

(async () => {
  const prov = env('NARRATOR_PROVIDER', 'gnani');
  if (prov === 'sarvam' && !env('SARVAM_API_KEY')) { console.error('NARRATOR_PROVIDER=sarvam needs SARVAM_API_KEY in .env'); process.exit(1); }
  if (prov !== 'sarvam' && !env('GNANI_API_KEY')) { console.error('Add GNANI_API_KEY to .env'); process.exit(1); }
  const out = path.join(ROOT, 'public', 'demo', 'vo'); fs.mkdirSync(out, { recursive: true });
  const manifest: Record<string, { file: string; seconds: number }> = {};
  for (const [id, text] of Object.entries(LINES)) {
    try {
      const wav = await speak(text);
      fs.writeFileSync(path.join(out, `${id}.wav`), wav);
      manifest[id] = { file: `demo/vo/${id}.wav`, seconds: +wavSeconds(wav).toFixed(2) };
      console.log(`ok ${id} (${manifest[id].seconds}s)`);
    } catch (e) { console.error(`fail ${id}: ${(e as Error).message}`); }
  }
  fs.writeFileSync(path.join(ROOT, 'public', 'demo', 'vo.json'), JSON.stringify({ provider: prov, lines: manifest }, null, 2));
  console.log(`narrator: ${prov} - ${Object.keys(manifest).length} lines`);
})();
