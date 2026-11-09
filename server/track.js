// VaaniLens analytics — privacy-first, JSON-on-Blob event tracking.
//
// We store ONE small JSON file per event in Vercel Blob (or a local .data/ folder in dev).
// We NEVER store IP addresses or full user agents. Tracking must never break the API:
// every public function here swallows its own errors.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const LOCAL_DIR = path.join(ROOT, '.data', 'blob'); // dev fallback when no Blob token

// Events the client is allowed to send. Server-side events (transcribe/speak) are added here too.
const ALLOWED_EVENTS = new Set([
  'page_view', 'cta_click', 'demo_sample_played', 'mic_used', 'upload_used',
  'transcribe', 'speak', 'waitlist_signup',
]);

const useBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

// ---- storage abstraction: Vercel Blob in prod, local filesystem in dev --------------------
let _blob = null;
async function blobLib() { if (!_blob) _blob = await import('@vercel/blob'); return _blob; }

// Write a JSON file at `key` (e.g. "events/2026-11-10/....json"). Returns true on success.
async function putJson(key, obj) {
  const data = JSON.stringify(obj);
  if (useBlob()) {
    const { put } = await blobLib();
    await put(key, data, { access: 'public', contentType: 'application/json', addRandomSuffix: false, cacheControlMaxAge: 0 });
    return true;
  }
  const file = path.join(LOCAL_DIR, key);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
  return true;
}

// List metadata for every blob under `prefix`. Returns [{ pathname, url }].
async function listKeys(prefix) {
  if (useBlob()) {
    const { list } = await blobLib();
    const out = []; let cursor;
    do {
      const r = await list({ prefix, cursor, limit: 1000 });
      for (const b of r.blobs) out.push({ pathname: b.pathname, url: b.url });
      cursor = r.cursor;
    } while (cursor);
    return out;
  }
  const base = path.join(LOCAL_DIR, prefix);
  const out = [];
  const walk = (dir, rel) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const abs = path.join(dir, e.name); const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(abs, r);
      else if (e.name.endsWith('.json')) out.push({ pathname: `${prefix}${r}`, url: abs });
    }
  };
  walk(base, '');
  return out;
}

// Read a blob's JSON content given the { url } from listKeys (http url in prod, file path in dev).
async function readJson(entry) {
  try {
    if (useBlob()) { const r = await fetch(entry.url, { cache: 'no-store' }); return await r.json(); }
    return JSON.parse(fs.readFileSync(entry.url, 'utf8'));
  } catch { return null; }
}

// ---- helpers ------------------------------------------------------------------------------
const dec = (v) => { try { return v ? decodeURIComponent(String(v)) : ''; } catch { return String(v || ''); } };
const hdr = (req, k) => req.headers[k] || req.headers[k.toLowerCase()] || '';

function deviceOf(ua) { return /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(ua) ? 'mobile' : 'desktop'; }
function browserOf(ua) {
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/OPR\/|Opera/i.test(ua)) return 'Opera';
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) return 'Chrome';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) return 'Safari';
  return 'Other';
}
function refHost(referrer) { try { return referrer ? new URL(referrer).host : ''; } catch { return ''; } }

// Build the stored event record from the request + explicit fields. No IP, no full UA.
function buildEvent(req, event, data = {}) {
  const ua = String(hdr(req, 'user-agent') || '');
  const referrer = data.referrer || String(hdr(req, 'referer') || '');
  const utmFromPath = () => { try { return new URL(data.path || '', 'http://x').searchParams.get('utm_source') || ''; } catch { return ''; } };
  return {
    t: new Date().toISOString(),
    event,
    path: String(data.path || req.url || '').slice(0, 200),
    country: String(hdr(req, 'x-vercel-ip-country') || ''),
    region: dec(hdr(req, 'x-vercel-ip-country-region')),
    city: dec(hdr(req, 'x-vercel-ip-city')),
    referrer: refHost(referrer),
    utm_source: String(data.utm_source || utmFromPath() || '').slice(0, 60),
    device: deviceOf(ua),
    browser: browserOf(ua),
    ...(data.extra && typeof data.extra === 'object' ? data.extra : {}),
  };
}

// Public: record an event. Never throws, never blocks the caller meaningfully.
async function track(req, event, data = {}) {
  try {
    if (!ALLOWED_EVENTS.has(event)) return;
    const rec = buildEvent(req, event, data);
    const day = rec.t.slice(0, 10); // YYYY-MM-DD
    const rand = crypto.randomBytes(5).toString('hex');
    const key = `events/${day}/${Date.now()}-${rand}.json`;
    await putJson(key, rec);
  } catch { /* analytics must never break the API */ }
}

const emailHash = (email) => crypto.createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex');

module.exports = {
  track, putJson, listKeys, readJson, buildEvent, emailHash,
  ALLOWED_EVENTS, deviceOf, browserOf, refHost, useBlob,
};
