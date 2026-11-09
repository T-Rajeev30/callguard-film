import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

// ---- demo session token (issued by /api/visitor, HMAC-signed server-side) ----------------
const KEYNAME = 'vl_demo_token';
const decodeExp = (tok: string): number => {
  try {
    const p = JSON.parse(atob(tok.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof p.exp === 'number' ? p.exp : 0;
  } catch { return 0; }
};
export const readDemoToken = (): string | null => {
  try { const t = localStorage.getItem(KEYNAME); return t && decodeExp(t) > Date.now() ? t : null; } catch { return null; }
};
const saveDemoToken = (t: string) => { try { localStorage.setItem(KEYNAME, t); } catch { /* ignore */ } };
export const clearDemoToken = () => { try { localStorage.removeItem(KEYNAME); } catch { /* ignore */ } };
export const demoHeaders = (token: string | null): Record<string, string> => (token ? { 'x-demo-token': token } : {});

const C = { ink: '#0B0B0F', ink2: '#15141D', line: '#2A2836', cream: '#F2EDE3', lime: '#C6FF1F', violet: '#5B2BFF', violetSoft: '#A996FF', mute: '#9A97A6' };
const LINKEDIN_RE = /^https?:\/\/(www\.|[a-z]{2}\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%]{3,100}\/?$/;
const looksLikeLinkedin = (v: string) => { const s = /^https?:\/\//i.test(v) ? v : 'https://' + v; return LINKEDIN_RE.test(s.trim()); };

// ---- Vaani: the mascot (original geometric lens/speaker creature) -------------------------
export const Vaani: React.FC<{ size?: number; state?: 'idle' | 'happy' | 'listening'; className?: string }> = ({ size = 120, state = 'idle', className }) => (
  <svg width={size} height={size} viewBox="0 0 120 120" className={className} role="img" aria-label="Vaani, the VaaniLens mascot"
    style={{ transformOrigin: 'center', animation: 'vaani-breathe 4.2s ease-in-out infinite' }}>
    <defs><clipPath id="vaani-body"><circle cx="60" cy="60" r="46" /></clipPath></defs>
    <circle cx="60" cy="60" r="52" fill="none" stroke={C.lime} strokeWidth="6" />
    <circle cx="60" cy="60" r="46" fill={C.ink2} />
    <g clipPath="url(#vaani-body)">
      {/* eyes */}
      <g style={{ animation: 'vaani-blink 5s ease-in-out infinite' }}>
        <circle cx="46" cy="50" r="6" fill={C.cream} />
        <circle cx="74" cy="50" r="6" fill={C.cream} />
      </g>
      {state === 'happy' && <>
        <path d="M40 48 q6 -6 12 0" stroke={C.cream} strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M68 48 q6 -6 12 0" stroke={C.cream} strokeWidth="3" fill="none" strokeLinecap="round" />
      </>}
      {/* mouth = 5 sound bars */}
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={40 + i * 9} y={72} width="6" rx="3" height={[10, 18, 24, 16, 10][i]}
          fill={C.violetSoft} style={{ transformOrigin: `${43 + i * 9}px 82px`, animation: `vaani-bar 1.1s ${i * 0.12}s ease-in-out infinite` }} />
      ))}
    </g>
  </svg>
);

// ---- the gate ----------------------------------------------------------------------------
export const DemoGate: React.FC<{ onPass: (token: string) => void }> = ({ onPass }) => {
  const [url, setUrl] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce && cardRef.current) gsap.fromTo(cardRef.current, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out' });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!looksLikeLinkedin(url)) { setErr('Please enter a valid LinkedIn profile URL, e.g. linkedin.com/in/your-name'); return; }
    setBusy(true);
    try {
      const params = new URLSearchParams(location.search);
      const r = await fetch('/api/visitor', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedin: url.trim(), utm_source: params.get('utm_source') || '' }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok && j.token) { saveDemoToken(j.token); onPass(j.token); }
      else { setErr(j.error || 'Something went wrong. Please try again.'); }
    } catch { setErr('Network error. Please try again.'); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, fontFamily: 'Inter, sans-serif' }}>
      <div ref={cardRef} style={{ width: 'min(460px, 100%)', background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 28, padding: 32, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Vaani size={92} state="happy" /></div>
        <h1 style={{ fontFamily: 'Anton, sans-serif', fontWeight: 400, fontSize: 34, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 6px' }}>Try VaaniLens live</h1>
        <p style={{ color: C.mute, margin: '0 0 22px', fontSize: 15.5 }}>One quick step so we know who's trying it. Then the real Gnani demo opens.</p>
        <form onSubmit={submit}>
          <input value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" autoComplete="url"
            placeholder="Your LinkedIn profile URL" aria-label="Your LinkedIn profile URL"
            style={{ width: '100%', background: C.ink, color: C.cream, border: `1px solid ${err ? '#FF6B6B' : C.line}`, borderRadius: 12, padding: '14px 16px', fontSize: 16, marginBottom: 10 }} />
          {err && <div role="alert" style={{ color: '#FFB4B4', fontSize: 14, textAlign: 'left', marginBottom: 10 }}>{err}</div>}
          <button type="submit" disabled={busy} style={{ width: '100%', minHeight: 52, border: 'none', borderRadius: 12, background: C.lime, color: C.ink,
            fontWeight: 800, fontSize: 17, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}>{busy ? 'Starting…' : 'Start demo'}</button>
        </form>
        <p style={{ color: C.mute, fontSize: 12.5, lineHeight: 1.5, marginTop: 16, textAlign: 'left' }}>
          We save your LinkedIn URL, city and device to see who tried the demo. Not shared. Email us to delete it. <a href="/privacy.html" style={{ color: C.violetSoft }}>Privacy</a>.
        </p>
      </div>
    </div>
  );
};
