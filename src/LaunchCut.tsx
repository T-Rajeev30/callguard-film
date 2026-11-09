import React from 'react';
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, CalculateMetadataFunction } from 'remotion';
import { C, F } from './theme';
import { Call } from './scenes/Call';
import { Freeze } from './scenes/Freeze';
import { Shatter } from './scenes/Shatter';
import { Signals } from './scenes/Signals';
import { Timbre } from './scenes/Timbre';
import { Lockup } from './scenes/Lockup';
import { Grain } from './components';
import { Label } from './scenes/shared';

const FPS = 30;
const s = (x: number) => Math.round(x * FPS);

// Film highlights: [scene component, scene start in the film (s), clip start (s), clip end (s)]
const CLIPS: [React.FC, number, number, number][] = [
  [Call, 0, 0, 3],
  [Freeze, 3, 3, 7],
  [Shatter, 8, 9.4, 11.4],
  [Signals, 21, 21, 27],
  [Timbre, 29, 29.4, 33.2],
];
const FILM = CLIPS.reduce((a, c) => a + (c[3] - c[2]), 0);   // 18.6 s
const BRIDGE = 1.5, APP = 29.4, USES = 7, END = 3.5;            // total 60 s

export type LaunchProps = { appStart: number; vo?: { file: string; at: number }[] };

export const launchMetadata: CalculateMetadataFunction<LaunchProps> = async ({ props }) => {
  let appStart = props.appStart;
  const vo: { file: string; at: number }[] = [];
  try {
    const ev = (await fetch(staticFile('demo/events.json')).then((r) => (r.ok ? r.json() : []))) as { id: string; at: number }[];
    const man = await fetch(staticFile('demo/vo.json')).then((r) => (r.ok ? r.json() : { lines: {} }));
    const s1 = ev.find((e) => e.id === 's1');
    if (s1 && appStart < 0) appStart = Math.max(0, s1.at - 0.2);
    const L = man.lines || {};
    if (L.bridge) vo.push({ file: L.bridge.file, at: FILM + 0.1 });
    const s1x = ev.find((e) => e.id === 's1x');
    if (L.s1x && s1x && s1x.at - appStart > 0 && s1x.at - appStart < APP - 4) vo.push({ file: L.s1x.file, at: FILM + BRIDGE + (s1x.at - appStart) });
    if (L.usecases) vo.push({ file: L.usecases.file, at: FILM + BRIDGE + APP + 0.3 });
  } catch { /* render without narration */ }
  return { durationInFrames: s(FILM + BRIDGE + APP + USES + END), props: { ...props, appStart: Math.max(0, appStart), vo } };
};

const Bridge: React.FC = () => {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: C.ink, justifyContent: 'center', alignItems: 'center', gap: 18 }}>
      <div style={{ fontFamily: F.viral, fontSize: 160, color: C.cream, textTransform: 'uppercase', opacity: p, transform: `scale(${0.92 + 0.08 * p})` }}>
        Now, <span style={{ color: C.lime }}>for real.</span>
      </div>
      <div style={{ fontFamily: F.mono, fontSize: 28, letterSpacing: 4, color: C.mute, opacity: p }}>LIVE APP - REAL GNANI SPEECH-TO-TEXT + TEXT-TO-SPEECH CALLS</div>
      <Grain />
    </AbsoluteFill>
  );
};

const Screen: React.FC<{ start: number }> = ({ start }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, #1A1630, ${C.ink} 75%)` }}>
      <div style={{ position: 'absolute', top: 24, left: 60, right: 60, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 14, height: 14, borderRadius: 7, background: '#FF4D4D', opacity: 0.5 + 0.5 * Math.sin(f / 6) }} />
        <span style={{ fontFamily: F.mono, fontSize: 22, letterSpacing: 3, color: C.cream }}>LIVE - NO EDITS</span>
        <span style={{ marginLeft: 'auto', fontFamily: F.mono, fontSize: 22, letterSpacing: 2, color: C.lime }}>Gnani Prisma (speech-to-text) {'>'} VaaniLens {'>'} Gnani Timbre (text-to-speech)</span>
      </div>
      <div style={{ position: 'absolute', left: 60, right: 60, top: 72, bottom: 36, borderRadius: 22, overflow: 'hidden', border: `3px solid ${C.lime}`, background: '#000' }}>
        <OffthreadVideo src={staticFile('demo/app-recording.mp4')} startFrom={s(start)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
    </AbsoluteFill>
  );
};

const USE_CASES = [
  { who: 'Kirana & retail', line: '"Is hafte atta par 10% off hai, sir!"', what: 'Offer calls to opted-in customers', color: C.lime, text: C.ink },
  { who: 'Clinics', line: '"Kal subah 10 baje aapka appointment hai."', what: 'Appointment reminders', color: C.cream, text: C.ink },
  { who: 'Lenders', line: '"Kal tak pakka?"', what: 'Payment follow-ups', color: C.violet, text: C.cream },
  { who: 'Every service', line: '"Service kaisi lagi?"', what: 'Feedback calls - Prisma hears the answer', color: '#1D1B2A', text: C.cream },
];

const UseCases: React.FC = () => {
  const f = useCurrentFrame();
  const title = interpolate(f, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: C.ink, padding: '70px 110px', boxSizing: 'border-box' }}>
      <Label color={C.lime} style={{ opacity: title }}>What's next - roadmap, not built yet</Label>
      <div style={{ fontFamily: F.viral, fontSize: 120, color: C.cream, textTransform: 'uppercase', lineHeight: 1, opacity: title, marginTop: 10 }}>
        One voice stack. <span style={{ color: C.lime }}>Every call.</span>
      </div>
      <div style={{ fontFamily: F.body, fontSize: 32, color: C.mute, marginTop: 12, opacity: title }}>Gnani speech-to-text listens. Gnani text-to-speech talks back. In the customer's language.</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24, marginTop: 44 }}>
        {USE_CASES.map((u, i) => {
          const p = interpolate(f, [12 + i * 9, 24 + i * 9], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          return (
            <div key={u.who} style={{ background: u.color, color: u.text, borderRadius: 24, padding: '26px 32px', opacity: p, transform: `translateY(${(1 - p) * 40}px)`,
              border: u.color === '#1D1B2A' ? '2px solid #353247' : 'none' }}>
              <div style={{ fontFamily: F.mono, fontSize: 20, letterSpacing: 3, textTransform: 'uppercase', opacity: 0.7 }}>{u.who}</div>
              <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 38, marginTop: 8 }}>{u.line}</div>
              <div style={{ fontFamily: F.body, fontSize: 26, marginTop: 6, opacity: 0.8 }}>{u.what}</div>
            </div>
          );
        })}
      </div>
      <Grain />
    </AbsoluteFill>
  );
};

/** 60 s launch cut: motion-graphic hook -> real app proof -> what the Gnani voice stack can power -> lockup. */
export const LaunchCut: React.FC<LaunchProps> = ({ appStart, vo = [] }) => {
  let t = 0;
  const film = CLIPS.map(([Comp, sceneStart, a, b], i) => {
    const from = s(t); t += b - a;
    return (
      <Sequence key={i} from={from} durationInFrames={s(b - a)}>
        <Sequence from={-s(a - sceneStart)}><Comp /></Sequence>
        <Audio src={staticFile('audio/mix.wav')} startFrom={s(a)} endAt={s(b)} />
      </Sequence>
    );
  });
  const appAt = FILM + BRIDGE, useAt = appAt + APP, endAt = useAt + USES;
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      {film}
      <Sequence from={s(FILM)} durationInFrames={s(BRIDGE)}><Bridge /></Sequence>
      <Sequence from={s(appAt)} durationInFrames={s(APP)}><Screen start={appStart} /></Sequence>
      <Sequence from={s(useAt)} durationInFrames={s(USES)}><UseCases /></Sequence>
      <Sequence from={s(endAt)} durationInFrames={s(END)}>
        <Lockup />
        <Audio src={staticFile('audio/mix.wav')} startFrom={s(41)} />
      </Sequence>
      {vo.map((v, i) => <Sequence key={i} from={s(v.at)}><Audio src={staticFile(v.file)} volume={1.15} /></Sequence>)}
    </AbsoluteFill>
  );
};
