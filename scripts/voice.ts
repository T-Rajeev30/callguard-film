/**
 * npm run voice — generates every voice line in the film, server-side, from your own machine.
 *
 * Keys live ONLY in a local .env file (git-ignored, never bundled into the video or a web page):
 *   GNANI_API_KEY=...        Gnani (api.vachana.ai) — Timbre TTS + Prisma STT. Recommended for the hackathon.
 *   SARVAM_API_KEY=...       optional — only if NARRATOR_PROVIDER=sarvam
 *   NARRATOR_PROVIDER=gnani  gnani (default) | sarvam
 *
 * What it does
 *  1. Timbre v3.0 speaks the caller line (Hindi, male voice) and the follow-up reminder (Hindi, female voice).
 *  2. Prisma v3.0 transcribes the caller audio (format=codemix) → src/audio/prisma.json.
 *     The Prisma scene then shows the REAL model output, not a mock.
 *  3. The narrator lines use Timbre (en-IN) or Sarvam Bulbul.
 * Writes public/audio/voice/<id>.wav and src/audio/manifest.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import timing from '../src/timing.json';

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'audio', 'voice');

// --- minimal .env loader (no dependency) ---
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const raw of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = raw.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const env = (k: string, d?: string) => process.env[k] || d;
const GNANI = 'https://api.vachana.ai';

async function timbre(text: string, language: string, voice: string): Promise<Buffer> {
  const res = await fetch(`${GNANI}/api/v1/tts/inference`, {
    method: 'POST',
    headers: { 'X-API-Key-ID': env('GNANI_API_KEY')!, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text, voice, language, model: env('TIMBRE_MODEL', 'timbre-v3.0'), speed: 1.0,
      audio_config: { sample_rate: 48000, num_channels: 1, sample_width: 2, encoding: 'linear_pcm', container: 'wav' },
    }),
  });
  if (!res.ok) throw new Error(`Timbre ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer()); // raw WAV bytes
}

async function prisma(wav: Buffer): Promise<Record<string, unknown>> {
  const form = new FormData();
  form.append('audio_file', new Blob([new Uint8Array(wav)], { type: 'audio/wav' }), 'caller.wav');
  form.append('model', 'prisma-v3.0');
  form.append('language_code', env('PRISMA_LANG', 'hi-IN')!);
  form.append('format', 'codemix');
  const res = await fetch(`${GNANI}/stt/v3`, { method: 'POST', headers: { 'X-API-Key-ID': env('GNANI_API_KEY')! }, body: form });
  if (!res.ok) throw new Error(`Prisma ${res.status}: ${await res.text()}`);
  return (await res.json()) as Record<string, unknown>;
}

async function sarvam(text: string, lang: string, speaker: string): Promise<Buffer> {
  const res = await fetch('https://api.sarvam.ai/text-to-speech', {
    method: 'POST',
    headers: { 'api-subscription-key': env('SARVAM_API_KEY')!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, target_language_code: lang, speaker, model: 'bulbul:v3', speech_sample_rate: 48000 }),
  });
  if (!res.ok) throw new Error(`Sarvam ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { audios?: string[] };
  if (!j.audios?.length) throw new Error('Sarvam: no audio');
  return Buffer.from(j.audios[0], 'base64');
}

async function main() {
  if (!env('GNANI_API_KEY')) { console.error('Add GNANI_API_KEY=... to a .env file in this folder (see .env.example).'); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });
  const manifest: Record<string, string> = {};
  const narrator = env('NARRATOR_PROVIDER', 'gnani');

  for (const v of timing.voice as Array<{ id: string; role: string; lang: string; text: string; deva?: string }>) {
    const file = `audio/voice/${v.id}.wav`;
    try {
      let buf: Buffer;
      if (v.role === 'caller') buf = await timbre(v.deva ?? v.text, 'hi-IN', env('CALLER_VOICE', 'Shubham')!);
      else if (v.role === 'timbre') buf = await timbre(v.deva ?? v.text, 'hi-IN', env('REPLY_VOICE', 'Shivani')!);
      else if (narrator === 'sarvam') buf = await sarvam(v.text, 'en-IN', env('SARVAM_NARRATOR', 'shubh')!);
      else buf = await timbre(v.text, 'en-IN', env('NARRATOR_VOICE', 'Avinash')!);
      fs.writeFileSync(path.join(ROOT, 'public', file), buf);
      manifest[v.id] = file;
      console.log(`ok   ${v.id}`);

      if (v.role === 'caller') {
        const out = await prisma(buf);
        fs.writeFileSync(path.join(ROOT, 'src', 'audio', 'prisma.json'),
          JSON.stringify({ transcript: out.transcript, detected_language_code: out.detected_language_code, model: out.model, format: 'codemix' }, null, 2) + '\n');
        console.log(`ok   Prisma → "${out.transcript}" (${out.detected_language_code ?? 'lang n/a'})`);
      }
    } catch (e) {
      console.error(`fail ${v.id}: ${(e as Error).message}`);
    }
  }
  fs.writeFileSync(path.join(ROOT, 'src', 'audio', 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\n${Object.keys(manifest).length} voice files. Now run the render.`);
}

main();
