// VaaniLens landing — interaction engine.
// gsap (+ScrollTrigger) for scroll storytelling + magnetics; anime.js v4 for the mascot + hero
// letters; Web Audio for the (user-initiated) hero playback. Everything respects
// prefers-reduced-motion and degrades gracefully without JS.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { animate, stagger } from 'animejs';
import { track } from './track';

gsap.registerPlugin(ScrollTrigger);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const touch = window.matchMedia('(hover:none), (pointer:coarse)').matches;
const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector(s) as T | null;
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => Array.from(r.querySelectorAll(s)) as T[];

// ===========================================================================================
//  VAANI — the mascot
// ===========================================================================================
type VState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'happy';
function createVaani(host: HTMLElement, size = 120) {
  const bars = [10, 18, 24, 16, 10];
  host.innerHTML = `
  <svg viewBox="0 0 120 120" width="${size}" height="${size}" role="img" aria-label="Vaani, the VaaniLens mascot">
    <circle cx="60" cy="60" r="52" fill="none" stroke="#C6FF1F" stroke-width="6" class="v-ring"/>
    <circle cx="60" cy="60" r="46" fill="#141320"/>
    <g class="v-eyes-pos"><g class="v-eyes-blink">
      <circle class="v-eye" cx="46" cy="52" r="6.5" fill="#F2EDE3"/>
      <circle class="v-eye" cx="74" cy="52" r="6.5" fill="#F2EDE3"/>
    </g></g>
    <g class="v-happy" style="display:none">
      <path d="M39 51 q7 -8 14 0" stroke="#F2EDE3" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M67 51 q7 -8 14 0" stroke="#F2EDE3" stroke-width="3" fill="none" stroke-linecap="round"/>
    </g>
    <g class="v-mouth">
      ${bars.map((h, i) => `<rect class="v-bar" x="${40 + i * 9}" y="${84 - h}" width="6" rx="3" height="${h}" fill="#A996FF"/>`).join('')}
    </g>
  </svg>`;
  const svg = $('svg', host)!;
  const eyesPos = $('.v-eyes-pos', host)!;
  const eyesG = $('.v-eyes-blink', host)!;
  const happy = $('.v-happy', host) as SVGElement;
  const barEls = $$('.v-bar', host) as unknown as SVGRectElement[];
  const baseH = bars.slice();
  let state: VState = 'idle';

  const qx = !reduced && !touch ? gsap.quickTo(eyesPos, 'x', { duration: 0.35, ease: 'power2' }) : null;
  const qy = !reduced && !touch ? gsap.quickTo(eyesPos, 'y', { duration: 0.35, ease: 'power2' }) : null;

  function setState(s: VState) {
    if (s === state) return; state = s;
    host.classList.toggle('is-speaking', s === 'speaking');
    host.classList.toggle('is-listening', s === 'listening');
    happy.style.display = s === 'happy' ? '' : 'none';
    eyesG.parentElement!.setAttribute('visibility', s === 'happy' ? 'hidden' : 'visible');
    if (s === 'thinking' && qy) qy(-4);
    else if (s !== 'speaking' && qy && qx) { qy(0); qx(0); }
    if (s === 'happy' && !reduced) gsap.fromTo(svg, { y: 0 }, { y: -8, duration: 0.18, yoyo: true, repeat: 3, ease: 'power1.inOut' });
  }
  function eyesTo(nx: number, ny: number) { if (qx && qy && state !== 'happy') { qx(Math.max(-5, Math.min(5, nx * 5))); qy(Math.max(-4, Math.min(4, ny * 4))); } }
  function amp(level: number) { // 0..1 → drive mouth bars while speaking
    if (reduced) return;
    barEls.forEach((b, i) => {
      const h = baseH[i] * (0.5 + level * (1.2 + (i === 2 ? 0.6 : 0)));
      b.style.transform = `scaleY(${Math.max(0.35, Math.min(2, h / baseH[i]))})`;
    });
  }
  return { setState, eyesTo, amp, el: host };
}
const vaaniHero = $('#vaaniHero') ? createVaani($('#vaaniHero')!, 200) : null;
const vaaniHow = $('#vaaniHow') ? createVaani($('#vaaniHow')!, 120) : null;
const vaaniHelper = $('#vaaniHelper') ? createVaani($('#vaaniHelper')!, 40) : null;

// eyes follow cursor (desktop only)
if (!touch && !reduced) {
  window.addEventListener('pointermove', (e) => {
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    vaaniHero?.eyesTo(nx, ny); vaaniHow?.eyesTo(nx, ny);
  }, { passive: true });
}

// ===========================================================================================
//  SOUND — muted by default, remembered in localStorage (try/catch)
// ===========================================================================================
let soundOn = false;
try { soundOn = localStorage.getItem('vl_sound') === '1'; } catch { /* ignore */ }
let actx: AudioContext | null = null;
const ensureCtx = () => { if (!actx) { try { actx = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { actx = null; } } return actx; };
function blip(freq = 660, dur = 0.05, vol = 0.12) {
  if (!soundOn || reduced) return; const ctx = ensureCtx(); if (!ctx) return;
  try {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = freq; o.type = 'sine';
    g.gain.value = Math.min(0.2, vol); o.connect(g); g.connect(ctx.destination);
    o.start(); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur); o.stop(ctx.currentTime + dur);
  } catch { /* ignore */ }
}
const soundBtn = $('#soundToggle');
const soundLabel = $('#soundLabel');
function renderSound() { soundBtn?.classList.toggle('on', soundOn); soundBtn?.setAttribute('aria-pressed', String(soundOn)); if (soundLabel) soundLabel.textContent = soundOn ? 'Sound on' : 'Sound off'; }
renderSound();
soundBtn?.addEventListener('click', () => {
  soundOn = !soundOn; try { localStorage.setItem('vl_sound', soundOn ? '1' : '0'); } catch { /* ignore */ }
  renderSound(); if (soundOn) { ensureCtx(); blip(760, 0.07); }
});

// ===========================================================================================
//  HERO AUDIO — user-initiated; waveform canvas + karaoke + chips + Vaani speaking
// ===========================================================================================
const CALLER = { src: '/samples/commit.wav', words: [
  { t: 'Sir,', at: 0.0 }, { t: 'कल', at: 0.5, hi: true }, { t: 'तक', at: 0.8, hi: true },
  { t: 'पक्का', at: 1.05, hi: true }, { t: 'payment', at: 1.5 }, { t: 'कर', at: 1.95, hi: true }, { t: 'दूंगा।', at: 2.15, hi: true },
] };
const REPLY = '/audio/voice/d2_timbre.wav';

const karaokeEl = $('#karaoke');
if (karaokeEl) karaokeEl.innerHTML = CALLER.words.map((w, i) => `<span class="kw${w.hi ? ' hi' : ''}" data-k="${i}">${w.t}</span>`).join(' ');
const kws = $$('.kw', karaokeEl || document);
const chips = $$('#heroChips .chip');
const canvas = $('#waveCanvas') as HTMLCanvasElement | null;
const cctx = canvas?.getContext('2d') || null;
const playBtn = $('#playBtn');
const playLabel = $('#playLabel');
const playerState = $('#playerState');

let playing = false;
let analyser: AnalyserNode | null = null;
let rafId = 0;
let audioEl: HTMLAudioElement | null = null;

function drawWave() {
  if (!cctx || !canvas) return;
  const w = canvas.width, h = canvas.height;
  cctx.clearRect(0, 0, w, h);
  const mid = h / 2;
  if (analyser) {
    const buf = new Uint8Array(analyser.frequencyBinCount); analyser.getByteTimeDomainData(buf);
    cctx.lineWidth = 2; cctx.strokeStyle = '#C6FF1F'; cctx.beginPath();
    let lvl = 0;
    for (let i = 0; i < buf.length; i++) {
      const x = (i / buf.length) * w; const v = (buf[i] - 128) / 128; lvl += Math.abs(v);
      const y = mid + v * (h * 0.42);
      i === 0 ? cctx.moveTo(x, y) : cctx.lineTo(x, y);
    }
    cctx.stroke();
    vaaniHero?.amp(Math.min(1, (lvl / buf.length) * 3.2));
  } else {
    // idle baseline bars
    cctx.fillStyle = 'rgba(169,150,255,.35)';
    const n = 56, bw = w / n;
    for (let i = 0; i < n; i++) { const bh = 6 + Math.abs(Math.sin(i * 0.6 + Date.now() / 600)) * 10; cctx.fillRect(i * bw + 2, mid - bh / 2, bw - 4, bh); }
  }
  rafId = requestAnimationFrame(drawWave);
}
drawWave();

let playingReply = false;
function setChips(on: boolean) { chips.forEach((c, i) => setTimeout(() => { c.classList.toggle('show', on); if (on) blip(620 + i * 90, 0.05); }, on ? i * 180 : 0)); }
function resetHero() {
  playing = false; playingReply = false; analyser = null;
  kws.forEach((k) => k.classList.remove('on')); setChips(false);
  vaaniHero?.setState('idle'); vaaniHow?.setState('idle');
  if (playLabel) playLabel.textContent = 'Hear the call'; if (playerState) playerState.textContent = 'Synthetic call · voiced by Gnani Timbre';
  if (audioEl) { try { audioEl.pause(); } catch { /* ignore */ } audioEl = null; }
}

async function playSequence() {
  if (playing) { resetHero(); return; }
  const ctx = ensureCtx(); if (!ctx) return;
  try { await ctx.resume(); } catch { /* ignore */ }
  playing = true; track('cta_click', { cta: 'hear_the_call' });
  if (playLabel) playLabel.textContent = 'Stop';

  const play = (src: string, onWord?: (sec: number) => void) => new Promise<void>((resolve) => {
    const a = new Audio(src); a.crossOrigin = 'anonymous'; audioEl = a;
    // node -> analyser -> gain -> destination. Gain=0 when muted, so the waveform still animates.
    try {
      const node = ctx.createMediaElementSource(a); analyser = ctx.createAnalyser(); analyser.fftSize = 512;
      const g = ctx.createGain(); g.gain.value = soundOn ? 1 : 0;
      node.connect(analyser); analyser.connect(g); g.connect(ctx.destination);
    } catch { analyser = null; if (!soundOn) a.muted = true; }
    const tick = () => { if (onWord) onWord(a.currentTime); if (!a.paused && !a.ended) requestAnimationFrame(tick); };
    a.addEventListener('play', () => requestAnimationFrame(tick));
    a.addEventListener('ended', () => { analyser = null; resolve(); });
    a.addEventListener('error', () => { analyser = null; resolve(); });
    a.play().catch(() => resolve());
  });

  // 1) caller line with karaoke
  vaaniHero?.setState('listening'); if (playerState) playerState.textContent = 'Gnani Prisma is listening…';
  await play(CALLER.src, (sec) => {
    CALLER.words.forEach((w, i) => { if (sec >= w.at) kws[i]?.classList.add('on'); });
  });
  if (!playing) return;
  // 2) signals pop
  vaaniHero?.setState('thinking'); if (playerState) playerState.textContent = 'VaaniLens found 3 signals';
  setChips(true);
  await new Promise((r) => setTimeout(r, 650));
  if (!playing) return;
  // 3) Timbre reply
  playingReply = true; vaaniHero?.setState('speaking'); if (playerState) playerState.textContent = 'Gnani Timbre is replying in Hindi…';
  await play(REPLY);
  vaaniHero?.setState('happy'); if (playerState) playerState.textContent = 'That is the whole loop — in one call.';
  if (playLabel) playLabel.textContent = 'Play again';
  playing = false; playingReply = false;
}
playBtn?.addEventListener('click', playSequence);

// helper bubble → scroll to player + play
const helper = $('#helper');
helper?.addEventListener('click', () => { $('#player')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' }); setTimeout(() => { if (!playing) playSequence(); }, reduced ? 0 : 600); });

// ===========================================================================================
//  MICRO-INTERACTIONS
// ===========================================================================================
track('page_view');
$$('[data-cta]').forEach((el) => el.addEventListener('click', () => track('cta_click', { cta: el.getAttribute('data-cta') })));

// nav scroll + mobile menu
const nav = $('#nav');
const onScroll = () => nav?.classList.toggle('scrolled', window.scrollY > 8);
onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
const menuBtn = $('#menuBtn'); const navLinks = $('#navLinks');
menuBtn?.addEventListener('click', () => { const open = navLinks?.classList.toggle('open'); menuBtn.setAttribute('aria-expanded', String(Boolean(open))); });
$$('#navLinks a').forEach((a) => a.addEventListener('click', () => { navLinks?.classList.remove('open'); menuBtn?.setAttribute('aria-expanded', 'false'); }));

// custom cursor (desktop only)
if (!touch && !reduced) {
  document.body.classList.add('has-cursor');
  const dot = $('#cursorDot')!, ring = $('#cursorRing')!;
  const qdx = gsap.quickTo(dot, 'x', { duration: 0.08 }), qdy = gsap.quickTo(dot, 'y', { duration: 0.08 });
  const qrx = gsap.quickTo(ring, 'x', { duration: 0.22, ease: 'power2' }), qry = gsap.quickTo(ring, 'y', { duration: 0.22, ease: 'power2' });
  window.addEventListener('pointermove', (e) => { qdx(e.clientX); qdy(e.clientY); qrx(e.clientX); qry(e.clientY); }, { passive: true });
  $$('a, button, input, select, textarea, [data-magnetic], .flip, .tilt').forEach((el) => {
    el.addEventListener('pointerenter', () => ring.classList.add('grow'));
    el.addEventListener('pointerleave', () => ring.classList.remove('grow'));
  });
}

// magnetic buttons
if (!touch && !reduced) {
  $$('[data-magnetic]').forEach((el) => {
    const qxm = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3' }), qym = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3' });
    el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); qxm(((e as PointerEvent).clientX - (r.left + r.width / 2)) * 0.3); qym(((e as PointerEvent).clientY - (r.top + r.height / 2)) * 0.4); });
    el.addEventListener('pointerleave', () => { qxm(0); qym(0); });
    el.addEventListener('pointerenter', () => blip(720, 0.04, 0.08));
  });
}

// headline split-letter rise + KAL glow
const title = $('#heroTitle');
if (title && !reduced) {
  const wrap = (node: ChildNode) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const frag = document.createDocumentFragment();
      for (const ch of node.textContent || '') { if (ch === ' ') { frag.appendChild(document.createTextNode(' ')); continue; } const s = document.createElement('span'); s.className = 'ch'; s.textContent = ch; frag.appendChild(s); }
      node.parentNode?.replaceChild(frag, node);
    } else Array.from(node.childNodes).forEach(wrap);
  };
  Array.from(title.childNodes).forEach(wrap);
  const chars = $$('.ch', title);
  animate(chars, { opacity: [0, 1], translateY: [44, 0], rotateZ: [5, 0], delay: stagger(24), duration: 640, ease: 'out(3)' });
}

// mask reveals for section titles
if (!reduced) {
  $$('.mask > span').forEach((span) => {
    ScrollTrigger.create({ trigger: span, start: 'top 88%', once: true, onEnter: () => gsap.to(span, { y: 0, duration: 0.8, ease: 'power3.out' }) });
  });
}

// generic reveals
if (reduced) $$('.reveal').forEach((el) => el.classList.add('on'));
else $$('.reveal').forEach((el) => ScrollTrigger.create({ trigger: el, start: 'top 86%', once: true, onEnter: () => el.classList.add('on') }));

// hero bg waveform bars
const heroWaveBg = $('#heroWaveBg');
if (heroWaveBg) {
  for (let i = 0; i < 40; i++) { const s = document.createElement('span'); heroWaveBg.appendChild(s); }
  const bars = $$('#heroWaveBg span');
  if (reduced) bars.forEach((b) => (b.style.height = '30px'));
  else bars.forEach((b, i) => animate(b, { height: [`${10 + (i % 4) * 6}px`, `${30 + Math.abs(Math.sin(i)) * 60}px`], duration: 760 + (i % 6) * 90, delay: i * 26, loop: true, alternate: true, ease: 'inOut(2)' }));
}

// problem scrub
const promise = $('#promiseLine');
if (promise) {
  const words = $$('.w', promise); const chipKal = $('#chipKal'), chipPakka = $('#chipPakka');
  const lightTo = (frac: number) => {
    const n = Math.round(frac * words.length);
    words.forEach((w, i) => w.classList.toggle('lit', i < n));
    chipKal?.classList.toggle('show', words.findIndex((w) => w.dataset.key === 'kal') < n);
    chipPakka?.classList.toggle('show', words.findIndex((w) => w.dataset.key === 'pakka') < n);
  };
  if (reduced) { words.forEach((w) => w.classList.add('lit')); chipKal?.classList.add('show'); chipPakka?.classList.add('show'); }
  else ScrollTrigger.create({ trigger: promise, start: 'top 82%', end: 'bottom 58%', scrub: 0.5, onUpdate: (self) => lightTo(self.progress) });
}

// how-it-works: step → mascot state
const howState = $('#howState');
const STATE_LABELS: Record<number, [VState, string]> = { 0: ['listening', 'LISTENING…'], 1: ['thinking', 'THINKING…'], 2: ['speaking', 'SPEAKING'] };
if (!reduced) $$('#steps .step').forEach((step) => {
  ScrollTrigger.create({ trigger: step, start: 'top 60%', end: 'bottom 60%',
    onToggle: (self) => { if (!self.isActive) return; const k = Number((step as HTMLElement).dataset.step); const [st, label] = STATE_LABELS[k];
      $$('#steps .step').forEach((s) => s.classList.toggle('active', s === step)); vaaniHow?.setState(st); if (howState) howState.textContent = label; } });
});

// scroll bg shift ink -> deep violet -> ink
if (!reduced) {
  const scrub = $('#bgScrub');
  if (scrub) ScrollTrigger.create({ trigger: '#how', start: 'top bottom', endTrigger: '#india', end: 'bottom top', scrub: true,
    onUpdate: (self) => { const p = Math.sin(self.progress * Math.PI); scrub.style.background = `radial-gradient(1200px 800px at 80% 10%, rgba(91,43,255,${0.14 * p}) 0%, rgba(11,11,15,0) 60%)`; } });
}

// card tilt + glare
if (!touch && !reduced) $$('.tilt').forEach((card) => {
  const el = card as HTMLElement; const glare = $('.glare', el);
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    el.style.transform = `perspective(800px) rotateX(${((0.5 - py) * 6).toFixed(2)}deg) rotateY(${((px - 0.5) * 6).toFixed(2)}deg)`;
    if (glare) { glare.style.setProperty('--gx', `${px * 100}%`); glare.style.setProperty('--gy', `${py * 100}%`); glare.style.opacity = '1'; }
  });
  el.addEventListener('pointerleave', () => { el.style.transform = ''; if (glare) glare.style.opacity = '0'; });
});

// copy demo link + toast
const copyBtn = $('#copyBtn'); const toast = $('#toast');
copyBtn?.addEventListener('click', async () => {
  const text = copyBtn.getAttribute('data-copy') || '';
  try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
  blip(820, 0.06); track('cta_click', { cta: 'copy_demo_link' });
  toast?.classList.add('show'); setTimeout(() => toast?.classList.remove('show'), 1600);
});

// helper bubble appears after scrolling past hero
if (helper) ScrollTrigger.create({ start: 'top -300', onToggle: (self) => helper.classList.toggle('show', self.isActive) });

// ===========================================================================================
//  WAITLIST
// ===========================================================================================
function confetti(card: HTMLElement) {
  if (reduced) return;
  const colors = ['#C6FF1F', '#A996FF', '#5B2BFF', '#F2EDE3'];
  for (let i = 0; i < 24; i++) {
    const bit = document.createElement('span'); bit.className = 'confetti';
    bit.style.background = colors[i % colors.length]; bit.style.left = `${20 + Math.random() * 60}%`; bit.style.top = '40%';
    card.appendChild(bit);
    animate(bit, { translateX: (Math.random() - 0.5) * 320, translateY: [-10, -160 - Math.random() * 120], rotate: Math.random() * 360,
      opacity: [1, 1, 0], duration: 1100 + Math.random() * 500, ease: 'out(3)', onComplete: () => bit.remove() });
  }
}
const form = $<HTMLFormElement>('#waitlistForm'); const msg = $('#formMsg'); const wbtn = $<HTMLButtonElement>('#waitlistBtn'); const card = $('#waitlistCard');
form?.addEventListener('submit', async (e) => {
  e.preventDefault(); if (!msg || !wbtn) return;
  msg.className = 'form-msg'; msg.textContent = '';
  const data = new FormData(form);
  const payload = { name: String(data.get('name') || ''), email: String(data.get('email') || ''), business: String(data.get('business') || ''),
    city: String(data.get('city') || ''), consent: ($('#wconsent') as HTMLInputElement | null)?.checked === true, path: location.pathname };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.email)) { msg.className = 'form-msg err'; msg.textContent = 'Please enter a valid email.'; return; }
  if (!payload.consent) { msg.className = 'form-msg err'; msg.textContent = 'Please tick the consent box so we can contact you.'; return; }
  wbtn.disabled = true; const label = wbtn.textContent; wbtn.textContent = 'Submitting…';
  try {
    const r = await fetch('/api/waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.ok) {
      msg.className = 'form-msg ok'; msg.textContent = j.message || "You're on the list. We'll be in touch.";
      track('waitlist_signup', { business: payload.business }); form.reset();
      vaaniHero?.setState('happy'); if (card) confetti(card); blip(880, 0.08);
    } else { msg.className = 'form-msg err'; msg.textContent = j.error || 'Something went wrong. Please try again.'; }
  } catch { msg.className = 'form-msg err'; msg.textContent = 'Network error. Please try again.'; }
  finally { wbtn.disabled = false; wbtn.textContent = label || 'Request early access'; }
});
