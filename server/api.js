// VaaniLens backend: a tiny API that runs inside the Vite dev server (server-side only).
// Your GNANI_API_KEY is read from .env here and never sent to the browser.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { analyze } = require('./analyzer');
const T = require('./track');

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
const crypto = require('node:crypto');

// ---- Credit saver: identical audio/text never hits Gnani twice (per warm instance) + per-IP limit.
const CACHE = new Map(); const CACHE_MAX = 200;
const hash = (b) => crypto.createHash('sha1').update(b).digest('hex');
const cacheGet = (k) => { const v = CACHE.get(k); if (v) { CACHE.delete(k); CACHE.set(k, v); } return v; };
const cacheSet = (k, v) => { CACHE.set(k, v); if (CACHE.size > CACHE_MAX) CACHE.delete(CACHE.keys().next().value); };
const HITS = new Map(); const LIMIT = Number(process.env.RATE_LIMIT || 30), WINDOW = 10 * 60 * 1000;
const ipOf = (req) => String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '?').split(',')[0].trim();
function limited(req) {
  const ip = ipOf(req), now = Date.now(); const h = (HITS.get(ip) || []).filter((t) => now - t < WINDOW);
  h.push(now); HITS.set(ip, h); return h.length > LIMIT;
}
// One JSON line per call -> Vercel > Logs (search "vaanilens").
const log = (req, evt, extra) => console.log(JSON.stringify({ app: 'vaanilens', evt, country: req.headers['x-vercel-ip-country'] || '-',
  ref: (req.headers.referer || '').slice(0, 80), ...extra }));

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

// Aggregate every stored event + waitlist entry into the dashboard payload.
async function buildStats() {
  const inc = (o, k) => { if (!k && k !== 0) return; o[k] = (o[k] || 0) + 1; };
  const topN = (o, n = 15) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ key: k, count: v }));

  const entries = await T.listKeys('events/').catch(() => []);
  const events = [];
  for (const e of entries) { const j = await T.readJson(e); if (j && j.event) events.push(j); }
  events.sort((a, b) => String(a.t).localeCompare(String(b.t)));

  const totals = {}, perDay = {}, cities = {}, countries = {}, referrers = {}, utm = {}, devices = {}, browsers = {};
  const uniqByEvent = { page_view: new Set(), landing: new Set(), demo: new Set() };
  for (const ev of events) {
    inc(totals, ev.event);
    inc(perDay, String(ev.t).slice(0, 10));
    if (ev.city) inc(cities, ev.city + (ev.country ? `, ${ev.country}` : ''));
    if (ev.country) inc(countries, ev.country);
    if (ev.referrer) inc(referrers, ev.referrer);
    if (ev.utm_source) inc(utm, ev.utm_source);
    if (ev.device) inc(devices, ev.device);
    if (ev.browser) inc(browsers, ev.browser);
  }

  // Funnel: landing views -> demo views -> transcribe -> speak.
  const page = (p) => String(p || '');
  const landingViews = events.filter((e) => e.event === 'page_view' && !page(e.path).includes('/demo')).length;
  const demoViews = events.filter((e) => e.event === 'page_view' && page(e.path).includes('/demo')).length;
  const funnel = [
    { step: 'Landing views', count: landingViews },
    { step: 'Demo views', count: demoViews },
    { step: 'Transcribe', count: totals.transcribe || 0 },
    { step: 'Speak', count: totals.speak || 0 },
  ];

  const wEntries = await T.listKeys('waitlist/').catch(() => []);
  const waitlist = [];
  for (const e of wEntries) { const j = await T.readJson(e); if (j && j.email) waitlist.push(j); }
  waitlist.sort((a, b) => String(b.t).localeCompare(String(a.t)));
  // Don't leak full emails into the dashboard payload beyond what's needed to contact.
  const waitlistOut = waitlist.map((w) => ({ t: w.t, name: w.name, email: w.email, business: w.business, city: w.city, country: w.country }));

  return {
    generated_at: new Date().toISOString(),
    total_events: events.length,
    totals,
    per_day: Object.entries(perDay).sort((a, b) => a[0].localeCompare(b[0])).map(([day, count]) => ({ day, count })),
    top_cities: topN(cities),
    countries: topN(countries),
    referrers: topN(referrers),
    utm_source: topN(utm),
    devices: topN(devices),
    browsers: topN(browsers),
    funnel,
    waitlist_count: waitlistOut.length,
    waitlist: waitlistOut,
    latest_events: events.slice(-100).reverse(),
  };
}

async function handler(req, res, next) {
  if (!req.url.startsWith('/api/')) return next();
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/api/health') return json(res, 200, { gnaniKey: Boolean(KEY()), mock: MOCK() });

    if (url.pathname === '/api/transcribe' && req.method === 'POST') {
      const audio = await readBody(req);
      if (audio.length > 3_000_000) return json(res, 413, { error: 'Audio too long - keep it under ~60 s' });
      const ck = 'stt:' + hash(audio) + url.search;
      const hit = cacheGet(ck);
      if (hit) { log(req, 'transcribe', { cached: true }); await T.track(req, 'transcribe', { extra: { cached: true } }); return json(res, 200, { ...hit, cached: true, latency_ms: 0 }); }
      if (!MOCK() && limited(req)) return json(res, 429, { error: 'Demo limit reached - try again in a few minutes' });
      const lang = url.searchParams.get('lang') || 'hi-IN';
      const model = url.searchParams.get('model') || 'prisma-v3.0';
      const format = url.searchParams.get('format') || 'codemix';
      const t0 = Date.now();
      if (MOCK()) { await T.track(req, 'transcribe', { extra: { cached: false, mock: true } }); return json(res, 200, { mock: true, transcript: 'Sir, kal tak pakka payment kar dunga.', detected_language_code: 'hi-IN', model, latency_ms: 0 }); }
      const form = new FormData();
      form.append('audio_file', new Blob([new Uint8Array(audio)], { type: 'audio/wav' }), 'call.wav');
      if (model === 'prisma-v3.0') { form.append('model', model); form.append('format', format); }
      form.append('language_code', lang);
      const r = await fetch(`${GNANI}/stt/v3`, { method: 'POST', headers: { 'X-API-Key-ID': KEY() }, body: form });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) return json(res, r.status, { error: 'Prisma error', detail: body });
      cacheSet(ck, body); log(req, 'transcribe', { cached: false, ms: Date.now() - t0 });
      await T.track(req, 'transcribe', { extra: { cached: false } });
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
      const ck = 'tts:' + hash(Buffer.from([text, voice, language, model].join('|')));
      let wav = MOCK() ? toneWav() : cacheGet(ck);
      const speakCached = !MOCK() && Boolean(wav);
      if (speakCached) log(req, 'speak', { cached: true });
      if (!wav) {
        if (limited(req)) return json(res, 429, { error: 'Demo limit reached - try again in a few minutes' });
        const r = await fetch(`${GNANI}/api/v1/tts/inference`, {
          method: 'POST', headers: { 'X-API-Key-ID': KEY(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice, language, model, speed: 1.0,
            audio_config: { sample_rate: 24000, num_channels: 1, sample_width: 2, encoding: 'linear_pcm', container: 'wav' } }),
        });
        if (!r.ok) return json(res, r.status, { error: 'Timbre error', detail: await r.text() });
        wav = fixWav(Buffer.from(await r.arrayBuffer()));
        cacheSet(ck, wav); log(req, 'speak', { cached: false, ms: Date.now() - t0 });
      }
      await T.track(req, 'speak', { extra: { cached: speakCached, mock: MOCK() } });
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('X-Latency-Ms', String(Date.now() - t0));
      res.setHeader('X-Mock', MOCK() ? '1' : '0');
      return res.end(wav);
    }

    // ---- Analytics ingest: client beacons land here (max 1 KB, event name allowlisted). -----
    if (url.pathname === '/api/track' && req.method === 'POST') {
      const raw = await readBody(req);
      if (raw.length > 1024) return json(res, 413, { ok: false });
      let p = {}; try { p = JSON.parse(raw.toString() || '{}'); } catch { return json(res, 400, { ok: false }); }
      if (!p || !T.ALLOWED_EVENTS.has(p.event)) return json(res, 400, { ok: false });
      await T.track(req, p.event, { path: p.path, referrer: p.referrer, utm_source: p.utm_source, extra: p.extra });
      res.statusCode = 204; return res.end();
    }

    // ---- Waitlist signup: requires consent=true, validates email, dedupes by email hash. ----
    if (url.pathname === '/api/waitlist' && req.method === 'POST') {
      const raw = await readBody(req);
      if (raw.length > 4096) return json(res, 413, { ok: false, error: 'Too large' });
      let p = {}; try { p = JSON.parse(raw.toString() || '{}'); } catch { return json(res, 400, { ok: false, error: 'Bad request' }); }
      const email = String(p.email || '').trim();
      const name = String(p.name || '').trim().slice(0, 100);
      const business = String(p.business || '').trim().slice(0, 60);
      const city = String(p.city || '').trim().slice(0, 60);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) return json(res, 400, { ok: false, error: 'Please enter a valid email.' });
      if (p.consent !== true) return json(res, 400, { ok: false, error: 'Consent is required to join the waitlist.' });
      const h = T.emailHash(email);
      const tag = h.slice(0, 12); // stored in the filename; used to dedupe without reading every record
      const existing = await T.listKeys('waitlist/').catch(() => []);
      for (const e of existing) { if (e.pathname.includes(tag)) return json(res, 200, { ok: true, duplicate: true, message: "You're already on the list." }); }
      const rec = { t: new Date().toISOString(), name, email, business, city,
        country: String(req.headers['x-vercel-ip-country'] || ''), hash: h };
      await T.putJson(`waitlist/${Date.now()}-${tag}.json`, rec);
      await T.track(req, 'waitlist_signup', { path: p.path, extra: { business } });
      return json(res, 200, { ok: true, message: "You're on the list. We'll be in touch." });
    }

    // ---- Stats: protected by ?key=STATS_KEY. Aggregates events + waitlist for the dashboard. -
    if (url.pathname === '/api/stats' && req.method === 'GET') {
      const key = url.searchParams.get('key') || '';
      const STATS_KEY = process.env.STATS_KEY || '';
      if (!STATS_KEY || key !== STATS_KEY) return json(res, 401, { error: 'Unauthorized' });
      const out = await buildStats();
      if (url.searchParams.get('format') === 'json-download') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="vaanilens-stats-${new Date().toISOString().slice(0, 10)}.json"`);
        return res.end(JSON.stringify(out, null, 2));
      }
      return json(res, 200, out);
    }

    return json(res, 404, { error: 'not found' });
  } catch (e) {
    return json(res, 500, { error: e.message });
  }
}

module.exports = { handler };
