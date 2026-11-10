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
// Vercel Blob stores are private by default now, which is right for visitor data (LinkedIn URLs
// must not be publicly fetchable by URL). Reads use get() with the RW token. Set BLOB_ACCESS=public
// only if your store is a legacy public store.
const BLOB_ACCESS = () => (process.env.BLOB_ACCESS === 'public' ? 'public' : 'private');

// Write a JSON file at `key` (e.g. "events/2026-11-10/....json"). Returns true on success.
async function putJson(key, obj) {
  const data = JSON.stringify(obj);
  if (useBlob()) {
    const { put } = await blobLib();
    // We only ever write unique keys (append-only), so no overwrite is needed.
    await put(key, data, { access: BLOB_ACCESS(), contentType: 'application/json', addRandomSuffix: false, cacheControlMaxAge: 0 });
    return true;
  }
  const file = path.join(LOCAL_DIR, key);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
  return true;
}
const storageMode = () => (useBlob() ? 'blob' : 'local');

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

// Read a blob's JSON content. In prod, private blobs need get() with the RW token (a plain fetch
// of the URL would 403). In dev, entry.url is a local file path.
async function readJson(entry) {
  try {
    if (useBlob()) {
      const { get } = await blobLib();
      const r = await get(entry.pathname, { access: BLOB_ACCESS() });
      if (!r || !r.blob) return null;
      return JSON.parse(await r.blob.text());
    }
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

// Geo/device fields for a visitor record, derived from edge headers. No IP, no full UA.
function visitorMeta(req) {
  const ua = String(hdr(req, 'user-agent') || '');
  return {
    country: String(hdr(req, 'x-vercel-ip-country') || ''),
    region: dec(hdr(req, 'x-vercel-ip-country-region')),
    city: dec(hdr(req, 'x-vercel-ip-city')),
    device: deviceOf(ua),
    browser: browserOf(ua),
    referrer: refHost(String(hdr(req, 'referer') || '')),
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

// ---- LinkedIn gate helpers ----------------------------------------------------------------
const LINKEDIN_RE = /^https?:\/\/(www\.|[a-z]{2}\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%]{3,100}\/?$/;
// Accept a bare "linkedin.com/in/x" too, and normalise to a canonical https URL.
function normalizeLinkedin(input) {
  let s = String(input || '').trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  if (!LINKEDIN_RE.test(s)) return null;
  try {
    const u = new URL(s);
    // Canonicalise the host (drop www. and 2-letter country subdomains) so the same profile
    // entered with or without a prefix dedupes to one record.
    const path = u.pathname.replace(/\/+$/, ''); // drop trailing slash
    return `https://www.linkedin.com${path}`;
  } catch { return null; }
}
const linkedinHash = (url) => crypto.createHash('sha256').update(String(url).trim().toLowerCase()).digest('hex');

// ---- Signed, short-lived demo session token (HMAC with STATS_KEY) --------------------------
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const tokenSecret = () => process.env.STATS_KEY || process.env.GNANI_API_KEY || 'vaanilens-dev-secret';
function hmac(data) { return crypto.createHmac('sha256', tokenSecret()).update(data).digest(); }
function timingEqual(a, b) {
  const ba = Buffer.from(String(a)), bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  try { return crypto.timingSafeEqual(ba, bb); } catch { return false; }
}
// Token = base64url(payload).base64url(hmac). Payload: { lh, exp }.
function signToken(lh, ttlMs = 2 * 60 * 60 * 1000) {
  const payload = b64url(JSON.stringify({ lh, exp: Date.now() + ttlMs }));
  return `${payload}.${b64url(hmac(payload))}`;
}
function verifyToken(token) {
  try {
    const [payload, sig] = String(token || '').split('.');
    if (!payload || !sig) return null;
    const expected = b64url(hmac(payload));
    if (!timingEqual(sig, expected)) return null;
    const obj = JSON.parse(unb64url(payload).toString());
    if (!obj || typeof obj.exp !== 'number' || obj.exp < Date.now()) return null;
    return obj; // { lh, exp }
  } catch { return null; }
}

module.exports = {
  track, putJson, listKeys, readJson, buildEvent, emailHash,
  ALLOWED_EVENTS, deviceOf, browserOf, refHost, useBlob,
  LINKEDIN_RE, normalizeLinkedin, linkedinHash, visitorMeta, storageMode,
  signToken, verifyToken, timingEqual,
};
