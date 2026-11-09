import React from 'react';
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, CalculateMetadataFunction } from 'remotion';
import { C, F, T } from './theme';
import { Call } from './scenes/Call';
import { Freeze } from './scenes/Freeze';
import { Lockup } from './scenes/Lockup';
import { Grain } from './components';

export type DemoProps = { recSeconds: number; startAt: number; maxSeconds: number; vo?: { file: string; at: number; seconds: number }[] };
const FPS = 30;
const HOOK = 8 * FPS;     // film: call + freeze
const BRIDGE = 2 * FPS;   // "this is real" card
const END = 5 * FPS;      // lockup
const recLen = (p: DemoProps) => Math.max(5, Math.min(p.recSeconds - p.startAt, p.maxSeconds));

// Narration: lines from public/demo/vo.json placed at the times the recorder logged in public/demo/events.json.
export const demoMetadata: CalculateMetadataFunction<DemoProps> = async ({ props }) => {
  const vo: { file: string; at: number; seconds: number }[] = [];
  try {
    const [ev, man] = await Promise.all([
      fetch(staticFile('demo/events.json')).then((r) => (r.ok ? r.json() : [])),
      fetch(staticFile('demo/vo.json')).then((r) => (r.ok ? r.json() : { lines: {} })),
    ]);
    const lines = (man.lines || {}) as Record<string, { file: string; seconds: number }>;
    const len = recLen(props);
    if (lines.bridge) vo.push({ ...lines.bridge, at: HOOK / FPS + 0.15 });
    for (const e of ev as { id: string; at: number }[]) {
      const l = lines[e.id];
      const rel = e.at - props.startAt;
      if (!l || rel < 0 || rel + Math.min(l.seconds, 2) > len) continue; // skip lines that would start past the cut
      vo.push({ ...l, at: (HOOK + BRIDGE) / FPS + rel });
    }
  } catch { /* no narration yet */ }
  return { durationInFrames: HOOK + BRIDGE + Math.round(recLen(props) * FPS) + END, props: { ...props, vo } };
};

const Bridge: React.FC = () => {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: C.ink, justifyContent: 'center', alignItems: 'center', gap: 18 }}>
      <div style={{ fontFamily: F.viral, fontSize: 150, color: C.cream, textTransform: 'uppercase', opacity: p, transform: `scale(${0.92 + 0.08 * p})` }}>
        Now, <span style={{ color: C.lime }}>for real.</span>
      </div>
      <div style={{ fontFamily: F.mono, fontSize: 28, letterSpacing: 4, color: C.mute, opacity: p }}>LIVE APP - REAL GNANI PRISMA + TIMBRE API CALLS - NO EDITS</div>
      <Grain />
    </AbsoluteFill>
  );
};

const Screen: React.FC<{ startAt: number; len: number }> = ({ startAt, len }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, #1A1630, ${C.ink} 75%)` }}>
      <div style={{ position: 'absolute', top: 26, left: 60, right: 60, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 14, height: 14, borderRadius: 7, background: '#FF4D4D', opacity: 0.5 + 0.5 * Math.sin(f / 6) }} />
        <span style={{ fontFamily: F.mono, fontSize: 22, letterSpacing: 3, color: C.cream }}>LIVE SCREEN RECORDING</span>
        <span style={{ marginLeft: 'auto', fontFamily: F.mono, fontSize: 22, letterSpacing: 2, color: C.lime }}>VaaniLens - Gnani Prisma v3.0 {">"} signals {">"} Gnani Timbre v3.0</span>
      </div>
      <div style={{ position: 'absolute', left: 60, right: 60, top: 76, bottom: 40, borderRadius: 22, overflow: 'hidden', border: `3px solid ${C.lime}`, boxShadow: '0 40px 120px rgba(0,0,0,0.6)', background: '#000' }}>
        <OffthreadVideo src={staticFile('demo/app-recording.mp4')} startFrom={Math.round(startAt * FPS)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
      <div style={{ position: 'absolute', right: 80, bottom: 56, fontFamily: F.mono, fontSize: 20, color: C.mute }}>{Math.floor(t / 60)}:{String(Math.floor(t % 60)).padStart(2, '0')} / {Math.floor(len / 60)}:{String(Math.floor(len % 60)).padStart(2, '0')}</div>
    </AbsoluteFill>
  );
};

/** Hook from the film -> "now, for real" -> the real screen recording -> VaaniLens lockup. */
export const DemoCut: React.FC<DemoProps> = (props) => {
  const len = recLen(props);
  const recFrames = Math.round(len * FPS);
  const endAt = HOOK + BRIDGE + recFrames;
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <Sequence durationInFrames={3 * FPS}><Call /></Sequence>
      <Sequence from={3 * FPS} durationInFrames={5 * FPS}><Freeze /></Sequence>
      <Sequence from={HOOK} durationInFrames={BRIDGE}><Bridge /></Sequence>
      <Sequence from={HOOK + BRIDGE} durationInFrames={recFrames}><Screen startAt={props.startAt} len={len} /></Sequence>
      <Sequence from={endAt} durationInFrames={END}><Lockup /></Sequence>
      {/* sound: film mix for the hook, the recording's own audio (Prisma/Timbre), film mix for the lockup */}
      <Sequence durationInFrames={HOOK + BRIDGE}><Audio src={staticFile('audio/mix.wav')} endAt={HOOK + BRIDGE} /></Sequence>
      <Sequence from={endAt}><Audio src={staticFile('audio/mix.wav')} startFrom={Math.round(T.scenes.lockup[0] * FPS)} /></Sequence>
      {/* narrator, explaining each step of the live recording */}
      {(props.vo || []).map((v, i) => (
        <Sequence key={i} from={Math.round(v.at * FPS)} name={`vo:${v.file}`}><Audio src={staticFile(v.file)} volume={1.15} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};
