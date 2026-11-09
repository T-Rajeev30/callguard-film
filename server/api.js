// VaaniLens backend: a tiny API that runs inside the Vite dev server (server-side only).
// Your GNANI_API_KEY is read from .env here and never sent to the browser.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { analyze } = require('./analyzer');

const ROOT = path.resolve(__dirname, '..');
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const raw of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = raw.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const KEY = () => process.env.GNANI_API_KEY || '';
const MOCK = () => process.env.MOCK === '1' || !KEY();
const GNANI = 'https://api.vachana.ai';

const readBody = (req) => new Promise((res, rej) => {
  const chunks = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => res(Buffer.concat(chunks))); req.on('error', rej);
});
const json = (res, code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); };

// Timbre sometimes returns WAV headers with an "unknown" length; fix sizes so every player/decoder is happy.
function fixWav(buf) {
  if (buf.slice(0, 4).toString() !== 'RIFF') return buf;
  let pos = 12;
  while (pos + 8 <= buf.length) {
    const id = buf.slice(pos, pos + 4).toString(); const size = buf.readUInt32LE(pos + 4);
    if (id === 'data') { const real = buf.length - pos - 8; buf.writeUInt32LE(real - (real % 2), pos + 4); break; }
    pos += 8 + size + (size % 2);
  }
  buf.writeUInt32LE(buf.length - 8, 4);
  return buf;
}

function toneWav(seconds = 1.2) { // mock audio only
  const sr = 16000, n = Math.floor(sr * seconds), b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / 8) * 6000 * Math.min(1, (n - i) / 2000)), 44 + i * 2);
  return b;
}

async function handler(req, res, next) {
  if (!req.url.startsWith('/api/')) return next();
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/api/health') return json(res, 200, { gnaniKey: Boolean(KEY()), mock: MOCK() });

    if (url.pathname === '/api/transcribe' && req.method === 'POST') {
      const audio = await readBody(req);
      if (audio.length > 3_000_000) return json(res, 413, { error: 'Audio too long - keep it under ~60 s' });
      const lang = url.searchParams.get('lang') || 'hi-IN';
      const model = url.searchParams.get('model') || 'prisma-v3.0';
      const format = url.searchParams.get('format') || 'codemix';
      const t0 = Date.now();
      if (MOCK()) return json(res, 200, { mock: true, transcript: 'Sir, kal tak pakka payment kar dunga.', detected_language_code: 'hi-IN', model, latency_ms: 0 });
      const form = new FormData();
      form.append('audio_file', new Blob([new Uint8Array(audio)], { type: 'audio/wav' }), 'call.wav');
      if (model === 'prisma-v3.0') { form.append('model', model); form.append('format', format); }
      form.append('language_code', lang);
      const r = await fetch(`${GNANI}/stt/v3`, { method: 'POST', headers: { 'X-API-Key-ID': KEY() }, body: form });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) return json(res, r.status, { error: 'Prisma error', detail: body });
      return json(res, 200, { ...body, latency_ms: Date.now() - t0 });
    }

    if (url.pathname === '/api/analyze' && req.method === 'POST') {
      const { transcript } = JSON.parse((await readBody(req)).toString() || '{}');
      return json(res, 200, analyze(transcript || ''));
    }

    if (url.pathname === '/api/speak' && req.method === 'POST') {
      const { text, voice = 'Shivani', language = 'hi-IN', model = 'timbre-v3.0' } = JSON.parse((await readBody(req)).toString() || '{}');
      if (!text || String(text).length > 300) return json(res, 400, { error: 'Text must be 1-300 characters' });
      const t0 = Date.now();
      let wav;
      if (MOCK()) wav = toneWav();
      else {
        const r = await fetch(`${GNANI}/api/v1/tts/inference`, {
          method: 'POST', headers: { 'X-API-Key-ID': KEY(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice, language, model, speed: 1.0,
            audio_config: { sample_rate: 24000, num_channels: 1, sample_width: 2, encoding: 'linear_pcm', container: 'wav' } }),
        });
        if (!r.ok) return json(res, r.status, { error: 'Timbre error', detail: await r.text() });
        wav = fixWav(Buffer.from(await r.arrayBuffer()));
      }
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('X-Latency-Ms', String(Date.now() - t0));
      res.setHeader('X-Mock', MOCK() ? '1' : '0');
      return res.end(wav);
    }
    return json(res, 404, { error: 'not found' });
  } catch (e) {
    return json(res, 500, { error: e.message });
  }
}

module.exports = { handler };
