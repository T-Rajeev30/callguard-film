import React, { useEffect, useRef, useState } from 'react';
import { Player } from '@remotion/player';
import { SignalsLive, LIVE_FRAMES, LiveSignal } from '../src/live/SignalsLive';
import { prepareWav, recordMic } from './audio';
import { track } from './track';
import '@fontsource/anton/400.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/800.css';
import '@fontsource/noto-sans-devanagari/600.css';

const C = { ink: '#0B0B0F', ink2: '#16161D', line: '#2A2A35', cream: '#F2EDE3', lime: '#C6FF1F', violet: '#5B2BFF', violetSoft: '#A996FF', mute: '#8A8796' };
const mono = '"JetBrains Mono", "DejaVu Sans Mono", Consolas, monospace';

const SAMPLES = [
  { id: 'commit', label: 'Promise · Hinglish', file: '/samples/commit.wav' },
  { id: 'weak', label: 'Weak promise', file: '/samples/weak.wav' },
  { id: 'confused', label: 'Confused', file: '/samples/confused.wav' },
  { id: 'dispute', label: 'Dispute', file: '/samples/dispute.wav' },
];

type Stage = 'idle' | 'prisma' | 'analyze' | 'done' | 'error';
type Result = { transcript: string; lang?: string; prismaMs?: number; model?: string; signals: LiveSignal[]; reply: string; mock?: boolean };

const Card: React.FC<{ title: string; step: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ title, step, children, style }) => (
  <section style={{ background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 22, padding: 24, display: 'flex', flexDirection: 'column', gap: 16, ...style }}>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
      <span style={{ fontFamily: mono, fontSize: 12, letterSpacing: 2, color: C.lime }}>{step}</span>
      <h2 style={{ margin: 0, fontFamily: 'Anton, sans-serif', fontWeight: 400, fontSize: 30, letterSpacing: 0.5, textTransform: 'uppercase' }}>{title}</h2>
    </div>
    {children}
  </section>
);

const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'lime' | 'ghost' | 'violet' }> = ({ tone = 'ghost', style, ...p }) => (
  <button {...p} style={{ minHeight: 46, padding: '0 18px', borderRadius: 12, cursor: p.disabled ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: p.disabled ? 0.5 : 1,
    border: tone === 'ghost' ? `1px solid ${C.line}` : 'none', background: tone === 'lime' ? C.lime : tone === 'violet' ? C.violet : 'transparent',
    color: tone === 'lime' ? C.ink : C.cream, ...style }} />
);

export const App: React.FC = () => {
  const [health, setHealth] = useState<{ gnaniKey: boolean; mock: boolean } | null>(null);
  const [source, setSource] = useState<{ blob: Blob; name: string } | null>(null);
  const [phone, setPhone] = useState(false);
  const [lang, setLang] = useState('hi-IN');
  const [prepared, setPrepared] = useState<{ url: string; seconds: number } | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [err, setErr] = useState('');
  const [res, setRes] = useState<Result | null>(null);
  const [rec, setRec] = useState<{ stop: () => void } | null>(null);
  const [recT, setRecT] = useState(0);
  const [speak, setSpeak] = useState<{ url: string; ms: number; mock: boolean } | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetch('/api/health').then((r) => r.json()).then(setHealth).catch(() => setHealth(null)); }, []);
  useEffect(() => { track('page_view'); }, []);

  const pick = async (blob: Blob, name: string) => { setSource({ blob, name }); setRes(null); setSpeak(null); setStage('idle'); setErr(''); };
  const loadSample = async (s: typeof SAMPLES[number]) => {
    track('demo_sample_played', { sample: s.id });
    const r = await fetch(s.file);
    if (!r.ok) { setErr(`Sample not found: run "npm run samples" once (uses Gnani Timbre).`); return; }
    pick(await r.blob(), s.label);
  };
  const startRec = async () => {
    track('mic_used');
    setRecT(0);
    const r = await recordMic(20, setRecT);
    setRec(r);
    const blob = await r.done; setRec(null); pick(blob, 'Mic recording');
  };

  const run = async () => {
    if (!source) return;
    try {
      setErr(''); setRes(null); setSpeak(null); setStage('prisma');
      const { wav, seconds } = await prepareWav(source.blob, phone);
      setPrepared({ url: URL.createObjectURL(wav), seconds });
      const t = await fetch(`/api/transcribe?lang=${encodeURIComponent(lang)}&model=prisma-v3.0&format=codemix`, { method: 'POST', body: wav, headers: { 'Content-Type': 'audio/wav' } });
      const tj = await t.json();
      if (!t.ok) throw new Error(`Prisma: ${JSON.stringify(tj.detail || tj.error)}`);
      setStage('analyze');
      const a = await (await fetch('/api/analyze', { method: 'POST', body: JSON.stringify({ transcript: tj.transcript }) })).json();
      setRes({ transcript: tj.transcript, lang: tj.detected_language_code, prismaMs: tj.latency_ms, model: tj.model, signals: a.signals, reply: a.reply, mock: tj.mock });
      setStage('done');
    } catch (e) { setErr((e as Error).message); setStage('error'); }
  };

  const say = async () => {
    if (!res) return;
    setSpeaking(true);
    try {
      const r = await fetch('/api/speak', { method: 'POST', body: JSON.stringify({ text: res.reply, voice: 'Shivani', language: 'hi-IN', model: 'timbre-v3.0' }) });
      if (!r.ok) throw new Error(`Timbre: ${await r.text()}`);
      const url = URL.createObjectURL(await r.blob());
      setSpeak({ url, ms: Number(r.headers.get('X-Latency-Ms')), mock: r.headers.get('X-Mock') === '1' });
      new Audio(url).play();
    } catch (e) { setErr((e as Error).message); } finally { setSpeaking(false); }
  };

  const mock = health?.mock;
  const steps: [string, boolean][] = [['Gnani Prisma', stage === 'prisma'], ['VaaniLens', stage === 'analyze'], ['Gnani Timbre', speaking]];

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', minHeight: '100vh', padding: '22px 28px 40px', maxWidth: 1500, margin: '0 auto' }}>
      {mock && <div role="alert" style={{ background: '#FF5C5C', color: C.ink, fontWeight: 800, padding: '10px 16px', borderRadius: 12, marginBottom: 16 }}>
        MOCK MODE: no GNANI_API_KEY found in .env. Results are fake. Do not record your demo in this mode.</div>}

      <header style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div aria-hidden style={{ width: 44, height: 44, borderRadius: '50%', border: `4px solid ${C.lime}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          {[0.3, 0.6, 1, 0.65, 0.4].map((h, i) => <span key={i} style={{ width: 3, height: 20 * h, borderRadius: 3, background: C.lime }} />)}
        </div>
        <div>
          <div style={{ fontFamily: 'Anton, sans-serif', fontSize: 34, letterSpacing: 1, lineHeight: 1 }}>VAANI<span style={{ color: C.violetSoft }}>LENS</span></div>
          <div style={{ fontSize: 13, color: C.mute, letterSpacing: 2 }}>HEAR BEYOND THE WORDS</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {steps.map(([name, on], i) => (
            <span key={name} style={{ fontFamily: mono, fontSize: 13, padding: '8px 12px', borderRadius: 999, border: `1px solid ${on ? C.lime : C.line}`, color: on ? C.lime : C.mute }}>
              {i + 1}. {name}{on ? ' …' : ''}</span>
          ))}
          <span style={{ fontFamily: mono, fontSize: 13, padding: '8px 12px', borderRadius: 999, background: mock ? '#3a1b1b' : '#1f2a07', color: mock ? '#FF9B9B' : C.lime }}>
            {health ? (mock ? '● mock' : '● live · Gnani API') : '● server?'}</span>
        </div>
      </header>

      <div className="demo-grid">
        <Card step="01" title="Call audio">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SAMPLES.map((s) => <Btn key={s.id} onClick={() => loadSample(s)}>{s.label}</Btn>)}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {rec ? <Btn tone="violet" onClick={rec.stop}>■ Stop ({recT}s)</Btn> : <Btn onClick={startRec}>● Record mic</Btn>}
            <Btn onClick={() => fileRef.current?.click()}>Upload audio</Btn>
            <input ref={fileRef} type="file" accept="audio/*" hidden onChange={(e) => { if (e.target.files?.[0]) { track('upload_used'); pick(e.target.files[0], e.target.files[0].name); } }} />
          </div>
          <div style={{ fontSize: 14, color: C.mute }}>Selected: <b style={{ color: C.cream }}>{source?.name ?? 'nothing yet'}</b> · synthetic calls only, no real customer data</div>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={phone} onChange={(e) => setPhone(e.target.checked)} style={{ width: 20, height: 20, accentColor: C.lime }} />
            <span><b>Phone-line mode</b> <span style={{ color: C.mute }}>8 kHz · 300–3400 Hz · line noise</span></span>
          </label>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ color: C.mute }}>Prisma language</span>
            <select value={lang} onChange={(e) => setLang(e.target.value)} style={{ background: C.ink, color: C.cream, border: `1px solid ${C.line}`, borderRadius: 10, padding: '8px 10px' }}>
              <option value="hi-IN">hi-IN (Hindi / Hinglish)</option>
              <option value="indic-auto">indic-auto</option>
              <option value="en-IN">en-IN</option>
            </select>
          </label>
          <Btn tone="lime" onClick={run} disabled={!source || stage === 'prisma' || stage === 'analyze'} style={{ fontSize: 17, minHeight: 54 }}>
            {stage === 'prisma' ? 'Transcribing with Gnani Prisma…' : stage === 'analyze' ? 'Reading between the words…' : 'Analyze call →'}</Btn>
          {prepared && <div>
            <div style={{ fontFamily: mono, fontSize: 12, color: C.mute, marginBottom: 6 }}>SENT TO PRISMA · {prepared.seconds.toFixed(1)}s · {phone ? '8 kHz phone-line' : '16 kHz'}</div>
            <audio controls src={prepared.url} style={{ width: '100%' }} />
          </div>}
          {err && <div role="alert" style={{ color: '#FFB4B4', background: 'rgba(255,92,92,.12)', borderRadius: 10, padding: 12, fontSize: 14 }}>{err}</div>}
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          <Card step="02" title="Gnani Prisma · transcript">
            <div style={{ fontSize: 30, fontWeight: 600, minHeight: 44, fontFamily: 'Inter, "Noto Sans Devanagari", sans-serif' }}>{res?.transcript ?? <span style={{ color: C.mute }}>—</span>}</div>
            {res && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontFamily: mono, fontSize: 13 }}>
              <span style={{ color: C.lime }}>● {res.lang ?? lang}</span>
              <span style={{ color: C.mute }}>{res.model ?? 'prisma-v3.0'} · codemix</span>
              {res.prismaMs != null && <span style={{ color: C.mute }}>round trip {res.prismaMs} ms</span>}
              {res.mock && <span style={{ color: '#FF9B9B' }}>MOCK</span>}
            </div>}
          </Card>

          <Card step="03" title="VaaniLens · signals" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ aspectRatio: '16 / 9', width: '100%', background: C.ink }}>
              {res ? (
                <Player key={res.transcript + res.signals.length} component={SignalsLive} inputProps={{ line: res.transcript, signals: res.signals, boomSrc: '/sfx/boom.flac' }}
                  durationInFrames={LIVE_FRAMES} fps={30} compositionWidth={1920} compositionHeight={1080} autoPlay controls style={{ width: '100%', height: '100%' }} />
              ) : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.mute }}>Analyze a call to see its signals</div>}
            </div>
          </Card>

          <Card step="04" title="Gnani Timbre · follow-up">
            <div style={{ fontFamily: '"Noto Sans Devanagari", Inter, sans-serif', fontSize: 26, minHeight: 36 }}>{res?.reply ?? <span style={{ color: C.mute }}>—</span>}</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <Btn tone="violet" onClick={say} disabled={!res || speaking}>{speaking ? 'Generating with Timbre…' : '▶ Speak reminder (hi-IN · Shivani)'}</Btn>
              {speak && <><audio controls src={speak.url} /><span style={{ fontFamily: mono, fontSize: 13, color: C.mute }}>{speak.mock ? 'MOCK' : `timbre-v3.0 · ${speak.ms} ms`}</span></>}
            </div>
          </Card>
        </div>
      </div>
      <footer style={{ marginTop: 24, fontSize: 13, color: C.mute }}>Hackathon prototype · built on Gnani Prisma v3.0 &amp; Gnani Timbre v3.0 · rule-based signal extractor v0 · synthetic data only</footer>
    </div>
  );
};
