/**
 * Headless Chromium drives the REAL VaaniLens app (live Gnani API calls) and records it:
 *   video  - CDP screencast frames -> constant 30 fps
 *   audio  - every clip the app actually played (Timbre replies, the audio sent to Prisma) + the live "mic" file
 * Output: public/demo/app-recording.mp4  (then render-demo turns it into the 60 s and full demo videos)
 *
 * Env: CHROMIUM_PATH (browser), APP_URL (default http://127.0.0.1:5173), REC_GPU=1 (GPU flags + NVENC)
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'out', 'rec');
const FRAMES = path.join(OUT, 'frames');
const APP = process.env.APP_URL || 'http://127.0.0.1:5173';
const W = 1920, H = 1080, FPS = 30;
const GPU = process.env.REC_GPU === '1';

function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  const dir = path.join(ROOT, 'node_modules', '@remotion');
  for (const d of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    if (!d.startsWith('compositor-')) continue;
    for (const n of ['ffmpeg.exe', 'ffmpeg']) { const p = path.join(dir, d, n); if (fs.existsSync(p)) return p; }
  }
  return 'ffmpeg';
}
const FF = ffmpegPath();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(FRAMES, { recursive: true });
  const live = path.join(ROOT, 'public', 'samples', 'live.wav');
  if (!fs.existsSync(path.join(ROOT, 'public', 'samples', 'commit.wav'))) throw new Error('Run "npm run samples" first.');

  const args = ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', `--window-size=${W},${H}`,
    '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--hide-scrollbars'];
  if (fs.existsSync(live)) args.push(`--use-file-for-fake-audio-capture=${live}%noloop`);
  if (GPU) args.push('--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-zero-copy', ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : []));
  const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args, defaultViewport: { width: W, height: H } });
  const page = await browser.newPage();

  // --- audio capture: log every clip the page plays (blob -> bytes), with wall-clock time ---
  const clips = []; let n = 0;
  await page.exposeFunction('__vlClip', (b64, t, kind) => {
    const f = path.join(OUT, `clip${n++}.${kind}`); fs.writeFileSync(f, Buffer.from(b64, 'base64')); clips.push({ file: f, t });
  });
  await page.evaluateOnNewDocument(() => {
    const orig = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...a) {
      const src = this.currentSrc || this.src; const t = Date.now();
      if (src && src.startsWith('blob:') && !this.__vlSent) {
        this.__vlSent = true;
        fetch(src).then((r) => r.arrayBuffer()).then((buf) => {
          let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
          window.__vlClip(btoa(s), t, 'wav');
        });
      }
      return orig.apply(this, a);
    };
  });
  page.on('pageerror', (e) => console.log('page error:', e.message));

  await page.goto(APP, { waitUntil: 'networkidle0' });
  const health = await page.evaluate(() => fetch('/api/health').then((r) => r.json()));
  if (health.mock && process.env.ALLOW_MOCK !== '1') throw new Error('App is in MOCK mode (no GNANI_API_KEY). Refusing to record a fake demo.');

  const events = []; // {id, t} wall-clock; narration is placed from these
  const mark = (id, at = Date.now()) => events.push({ id, t: at });
  // on-screen step caption (annotation only)
  const caption = (txt, id) => { if (id) mark(id); return page.evaluate((t) => {
    let el = document.getElementById('__vlcap');
    if (!el) { el = document.createElement('div'); el.id = '__vlcap'; Object.assign(el.style, { position: 'fixed', left: '28px', bottom: '22px', zIndex: 99999, padding: '14px 22px', borderRadius: '14px',
      background: '#C6FF1F', color: '#0B0B0F', font: '700 22px Inter, sans-serif', boxShadow: '0 20px 50px rgba(0,0,0,.5)' }); document.body.appendChild(el); }
    el.textContent = t;
  }, txt); };
  const click = async (text) => {
    const ok = await page.evaluate((t) => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(t)); if (b) b.click(); return Boolean(b); }, text);
    if (!ok) throw new Error(`button not found: ${text}`);
  };
  const analyzeAndShow = async (id) => {
    await click('Analyze call');
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Analyze call')) && document.querySelector('section video, section canvas, section [class*="player"], section div[style*="aspect-ratio"] div'), { timeout: 60000 });
    await sleep(700);
    // let viewers hear exactly what Prisma heard
    await page.evaluate(() => { const a = [...document.querySelectorAll('audio')][0]; if (a) { a.currentTime = 0; a.play(); } });
    
  };
  const scrollTo = (sel) => page.evaluate((s) => {
    const el = s === 'top' ? document.body : [...document.querySelectorAll('h2')].find((h) => h.textContent.includes(s));
    if (s === 'top') window.scrollTo({ top: 0, behavior: 'smooth' }); else el && el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, sel);
  const speak = async () => {
    await scrollTo('Timbre'); await sleep(900);
    await click('Speak reminder');
    await page.waitForFunction(() => document.querySelectorAll('audio').length >= 2, { timeout: 60000 });
    await sleep(400);
    const d = await page.evaluate(() => { const a = [...document.querySelectorAll('audio')].pop(); return a && isFinite(a.duration) ? a.duration : 4; });
    await sleep(Math.min(12, d) * 1000 + 2000);
    await scrollTo('top'); await sleep(700);
  };

  // --- start the screencast ---
  const cdp = await page.createCDPSession();
  const frames = [];
  cdp.on('Page.screencastFrame', async (f) => {
    const i = frames.length; const file = path.join(FRAMES, `${String(i).padStart(6, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(f.data, 'base64')); frames.push({ file, t: f.metadata.timestamp * 1000 });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
  const t0 = Date.now();
  const tick = setInterval(() => page.evaluate(() => { const d = document.body; d.style.outline = d.style.outline ? '' : '0px solid transparent'; }).catch(() => {}), 1000 / FPS);

  await caption('VaaniLens - live app - real Gnani API calls', 'intro'); await sleep(6500);

  await caption('1 - A promise in Hinglish -> Gnani Prisma v3.0 (codemix)', 's1'); await sleep(3600);
  await click('Promise'); await sleep(1800); await analyzeAndShow('s1x');
  await caption('Gnani Timbre v3.0 speaks the follow-up in Hindi'); await speak();

  await caption('2 - Phone-line mode: 8 kHz + line noise (Noise Canceller test)', 's2'); await sleep(3600);
  await page.evaluate(() => { const c = document.querySelector('input[type=checkbox]'); if (c && !c.checked) c.click(); });
  await click('Weak promise'); await sleep(1800); await analyzeAndShow('s2x');
  await speak();

  await caption('3 - A confused customer -> explain, in their language', 's3'); await sleep(3600);
  await click('Confused'); await sleep(1800); await analyzeAndShow('s3x');
  await speak();

  await caption('4 - A dispute -> stop the reminders, check the ledger', 's4'); await sleep(3600);
  await page.evaluate(() => { const c = document.querySelector('input[type=checkbox]'); if (c && c.checked) c.click(); });
  await click('Dispute'); await sleep(1800); await analyzeAndShow('s4x'); await sleep(3000);

  if (fs.existsSync(live)) {
    await caption('5 - Live mic: a new call, end to end', 's5'); await sleep(3600);
    const tMic = Date.now();
    await click('Record mic');
    clips.push({ file: live, t: tMic + 300 });
    await sleep(4500); await click('Stop'); await sleep(1200);
    await analyzeAndShow(); await speak();
  }
  await caption('VaaniLens - Hear beyond the words - built on Gnani Prisma + Timbre', 'outro'); await sleep(5500);

  clearInterval(tick);
  await cdp.send('Page.stopScreencast');
  const t1 = Date.now();
  await sleep(500);
  await browser.close();

  // --- frames -> constant 30 fps (each frame held until the next one) ---
  const list = [];
  for (let i = 0; i < frames.length; i++) {
    const dur = ((frames[i + 1]?.t ?? t1) - frames[i].t) / 1000;
    list.push(`file '${frames[i].file.replace(/\\/g, '/')}'`, `duration ${Math.max(dur, 1 / FPS).toFixed(4)}`);
  }
  list.push(`file '${frames[frames.length - 1].file.replace(/\\/g, '/')}'`);
  fs.writeFileSync(path.join(OUT, 'frames.txt'), list.join('\n'));
  const start = frames[0].t;
  fs.writeFileSync(path.join(ROOT, 'public', 'demo', 'events.json'), JSON.stringify(events.map((e) => ({ id: e.id, at: +((e.t - start) / 1000).toFixed(2) })), null, 2));

  // --- audio: place every captured clip at its real time ---
  const inputs = ['-f', 'concat', '-safe', '0', '-i', path.join(OUT, 'frames.txt')];
  const filters = [];
  clips.forEach((c, i) => {
    inputs.push('-i', c.file);
    const d = Math.max(0, Math.round(c.t - start));
    filters.push(`[${i + 1}:a]aresample=48000,adelay=${d}|${d}[a${i}]`);
  });
  const vcodec = GPU ? ['-c:v', 'h264_nvenc', '-preset', 'p5', '-cq', '19'] : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18'];
  const vf = `[0:v]scale=${W}:${H},format=yuv420p[v]`;   // (bundled ffmpeg has no fps/pad filters: use -r)
  const mapAudio = clips.length
    ? ['-filter_complex', `${vf};${filters.join(';')};${clips.map((_, i) => `[a${i}]`).join('')}amix=inputs=${clips.length}:normalize=0[aout]`, '-map', '[v]', '-map', '[aout]', '-c:a', 'aac', '-b:a', '192k']
    : ['-filter_complex', vf, '-map', '[v]'];
  const dest = path.join(ROOT, 'public', 'demo', 'app-recording.mp4');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const run = (codec) => spawnSync(FF, ['-y', ...inputs, ...mapAudio, '-r', String(FPS), ...codec, dest], { stdio: 'inherit' });
  let r = run(vcodec);
  if (r.status !== 0 && GPU) { console.log('NVENC failed, falling back to libx264'); r = run(['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18']); }
  if (r.status !== 0) throw new Error('ffmpeg failed');
  console.log(`\nRecorded ${((t1 - t0) / 1000).toFixed(1)} s, ${frames.length} frames, ${clips.length} audio clips -> ${dest}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
