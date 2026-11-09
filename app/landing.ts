// VaaniLens landing — motion + interactions.
// gsap (+ScrollTrigger) for scroll-driven storytelling, anime.js v4 for the hero + waveforms.
// Everything degrades gracefully: content is visible without JS, and all motion respects
// prefers-reduced-motion.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { animate, stagger } from 'animejs';
import { track } from './track';

gsap.registerPlugin(ScrollTrigger);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector(s) as T | null;
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => Array.from(r.querySelectorAll(s)) as T[];

// ---- analytics ---------------------------------------------------------------------------
track('page_view');
$$('[data-cta]').forEach((el) => el.addEventListener('click', () => track('cta_click', { cta: el.getAttribute('data-cta') })));

// ---- nav ---------------------------------------------------------------------------------
const nav = $('#nav');
const onScrollNav = () => nav?.classList.toggle('scrolled', window.scrollY > 8);
onScrollNav();
window.addEventListener('scroll', onScrollNav, { passive: true });

const menuBtn = $('#menuBtn');
const navLinks = $('#navLinks');
menuBtn?.addEventListener('click', () => {
  const open = navLinks?.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', String(Boolean(open)));
});
$$('#navLinks a').forEach((a) => a.addEventListener('click', () => {
  navLinks?.classList.remove('open'); menuBtn?.setAttribute('aria-expanded', 'false');
}));

// ---- hero: letter reveal (anime.js) ------------------------------------------------------
const title = $('#heroTitle');
if (title) {
  // Wrap each visible character in a span so we can stagger it. Keep the colored <span class="em">.
  const wrapChars = (node: ChildNode) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const frag = document.createDocumentFragment();
      for (const ch of node.textContent || '') {
        if (ch === ' ') { frag.appendChild(document.createTextNode(' ')); continue; }
        const s = document.createElement('span'); s.className = 'ch'; s.textContent = ch; frag.appendChild(s);
      }
      node.parentNode?.replaceChild(frag, node);
    } else { Array.from(node.childNodes).forEach(wrapChars); }
  };
  Array.from(title.childNodes).forEach(wrapChars);
  const chars = $$('.ch', title);
  if (!reduced && chars.length) {
    animate(chars, {
      opacity: [0, 1], translateY: [40, 0], rotateZ: [6, 0],
      delay: stagger(26), duration: 620, ease: 'out(3)',
    });
  }
}

// ---- hero: animated waveform bars (anime.js loop) ----------------------------------------
const wave = $('#wave');
if (wave) {
  const N = 48;
  const bars: HTMLSpanElement[] = [];
  for (let i = 0; i < N; i++) { const s = document.createElement('span'); wave.appendChild(s); bars.push(s); }
  if (reduced) {
    bars.forEach((b) => (b.style.height = '28px'));
  } else {
    bars.forEach((b, i) => {
      animate(b, {
        height: [`${8 + (i % 5) * 4}px`, `${22 + Math.abs(Math.sin(i)) * 40}px`],
        duration: 700 + (i % 7) * 90, delay: i * 30,
        loop: true, alternate: true, ease: 'inOut(2)',
      });
    });
  }
}

// ---- how it works: mini TTS bar animation ------------------------------------------------
const mbar = $('#mbar');
if (mbar) {
  const bars: HTMLElement[] = [];
  for (let i = 0; i < 22; i++) { const b = document.createElement('i'); mbar.appendChild(b); bars.push(b); }
  if (reduced) { bars.forEach((b) => (b.style.height = '12px')); }
  else {
    bars.forEach((b, i) => animate(b, {
      height: [`${4}px`, `${6 + Math.abs(Math.sin(i * 0.9)) * 22}px`],
      duration: 520 + (i % 5) * 80, delay: i * 24, loop: true, alternate: true, ease: 'inOut(2)',
    }));
  }
}

// ---- generic scroll reveal ---------------------------------------------------------------
if (reduced) {
  $$('.reveal').forEach((el) => el.classList.add('on'));
} else {
  $$('.reveal').forEach((el) => {
    ScrollTrigger.create({ trigger: el, start: 'top 85%', once: true, onEnter: () => el.classList.add('on') });
  });
}

// ---- problem: words light up on scroll (ScrollTrigger scrub) ------------------------------
const promise = $('#promiseLine');
if (promise) {
  const words = $$('.w', promise);
  const chipKal = $('#chipKal');
  const chipPakka = $('#chipPakka');
  const lightUpTo = (frac: number) => {
    const n = Math.round(frac * words.length);
    words.forEach((w, i) => w.classList.toggle('lit', i < n));
    chipKal?.classList.toggle('show', words.findIndex((w) => w.dataset.key === 'kal') < n);
    chipPakka?.classList.toggle('show', words.findIndex((w) => w.dataset.key === 'pakka') < n);
  };
  if (reduced) {
    words.forEach((w) => w.classList.add('lit')); chipKal?.classList.add('show'); chipPakka?.classList.add('show');
  } else {
    ScrollTrigger.create({
      trigger: promise, start: 'top 80%', end: 'bottom 55%', scrub: 0.5,
      onUpdate: (self) => lightUpTo(self.progress),
    });
  }
}

// ---- use-case cards: subtle pointer tilt -------------------------------------------------
if (!reduced) {
  $$('.tilt').forEach((card) => {
    const el = card as HTMLElement;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(700px) rotateX(${(-py * 6).toFixed(2)}deg) rotateY(${(px * 7).toFixed(2)}deg) translateY(-3px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}

// ---- waitlist form -----------------------------------------------------------------------
const form = $<HTMLFormElement>('#waitlistForm');
const msg = $('#formMsg');
const btn = $<HTMLButtonElement>('#waitlistBtn');
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!msg || !btn) return;
  msg.className = 'form-msg'; msg.textContent = '';
  const data = new FormData(form);
  const payload = {
    name: String(data.get('name') || ''),
    email: String(data.get('email') || ''),
    business: String(data.get('business') || ''),
    city: String(data.get('city') || ''),
    consent: ($('#wconsent') as HTMLInputElement | null)?.checked === true,
    path: location.pathname,
  };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.email)) { msg.className = 'form-msg err'; msg.textContent = 'Please enter a valid email.'; return; }
  if (!payload.consent) { msg.className = 'form-msg err'; msg.textContent = 'Please tick the consent box so we can contact you.'; return; }
  btn.disabled = true; const label = btn.textContent; btn.textContent = 'Submitting…';
  try {
    const r = await fetch('/api/waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.ok) {
      msg.className = 'form-msg ok'; msg.textContent = j.message || "You're on the list. We'll be in touch.";
      track('waitlist_signup', { business: payload.business });
      form.reset();
    } else {
      msg.className = 'form-msg err'; msg.textContent = j.error || 'Something went wrong. Please try again.';
    }
  } catch {
    msg.className = 'form-msg err'; msg.textContent = 'Network error. Please try again.';
  } finally { btn.disabled = false; btn.textContent = label || 'Request early access'; }
});
