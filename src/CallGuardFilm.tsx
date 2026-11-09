import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, interpolate, useCurrentFrame } from 'remotion';
import { CameraMotionBlur } from '@remotion/motion-blur';
import { C, F, T, s, sceneFrom, sceneLen } from './theme';
import { Call } from './scenes/Call';
import { Freeze } from './scenes/Freeze';
import { Shatter } from './scenes/Shatter';
import { Prisma } from './scenes/Prisma';
import { Signals } from './scenes/Signals';
import { Timbre } from './scenes/Timbre';
import { Reveal } from './scenes/Reveal';
import { Lockup } from './scenes/Lockup';
import { ImpactFX, Captions, Progress, LightLeak } from './components/fx';
import { clamp } from './components';
import { LensMark } from './scenes/shared';

const SCENES = [
  ['call', Call], ['freeze', Freeze], ['shatter', Shatter], ['prisma', Prisma],
  ['signals', Signals], ['timbre', Timbre], ['reveal', Reveal], ['lockup', Lockup],
] as const;

const TOTAL = T.duration * T.fps;

/** The film itself (16:9). Optional layers so the 4:5 feed cut can reuse it. */
export const CallGuardFilm: React.FC<{ captions?: boolean; audio?: boolean; progress?: boolean; blur?: boolean }> = ({
  captions = true, audio = true, progress = true, blur = true,
}) => (
  <AbsoluteFill style={{ background: C.ink }}>
    <ImpactFX>
      {SCENES.map(([key, Comp]) => (
        <Sequence key={key} from={sceneFrom(key)} durationInFrames={sceneLen(key)} name={key}>
          {(key === 'signals' || key === 'shatter') && blur ? (
            <CameraMotionBlur shutterAngle={180} samples={5}><Comp /></CameraMotionBlur>
          ) : <Comp />}
        </Sequence>
      ))}
      <LightLeak from={s(21.3)} dur={s(2.4)} />
      <LightLeak from={s(35)} dur={s(3)} color="rgba(91,43,255,0.3)" />
    </ImpactFX>
    {captions && <Captions />}
    {progress && <Progress total={TOTAL} />}
    {audio && <Audio src={staticFile('audio/mix.wav')} />}
  </AbsoluteFill>
);

/** Headline band for the vertical-ish feed cut: one idea per act, readable with sound off. */
const BANDS: [number, string, string?][] = [
  [0, "He says he'll pay.", 'Does he mean it?'],
  [3, 'Freeze.', 'Look at “kal”.'],
  [8, '7 words.', 'More than one meaning.'],
  [14, 'Gnani Prisma', 'hears every word'],
  [21, '1 sentence.', '3 signals.'],
  [29, 'Gnani Timbre', 'replies in Hindi'],
  [35, 'VaaniLens', 'sees the whole call'],
  [41, 'Hear beyond', 'the words.'],
];

const Band: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / T.fps;
  const i = BANDS.filter(([at]) => t >= at).length - 1;
  const [at, a, b] = BANDS[i];
  const p = at === 0 ? 1 : interpolate(f, [s(at), s(at) + 8], [0, 1], clamp);
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 330, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
      fontFamily: F.viral, textTransform: 'uppercase', textAlign: 'center', lineHeight: 0.98, transform: `translateY(${(1 - p) * 30}px)`, opacity: p }}>
      <div style={{ fontSize: 92, color: C.cream, letterSpacing: 1 }}>{a}</div>
      {b && <div style={{ fontSize: 92, color: i === BANDS.length - 1 ? C.violetSoft : C.lime, letterSpacing: 1 }}>{b}</div>}
    </div>
  );
};

/** 1080×1350 (4:5) cut: headline band, the film, big captions. Takes more of a phone feed. */
export const CallGuardFeed: React.FC = () => (
  <AbsoluteFill style={{ background: C.ink }}>
    {/* small brand mark from 3s on: no logo in the opening, per the brief */}
    <div style={{ position: 'absolute', top: 28, left: 32, display: 'flex', alignItems: 'center', gap: 12, opacity: useCurrentFrame() >= 90 ? 0.9 : 0 }}>
      <LensMark size={40} ring={C.lime} bars={C.lime} />
      <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 26, color: C.cream }}>VaaniLens</span>
    </div>
    <Band />
    <div style={{ position: 'absolute', top: 360, left: 0, width: 1920, height: 1080, transform: 'scale(0.5625)', transformOrigin: 'top left',
      borderRadius: 0, overflow: 'hidden' }}>
      <CallGuardFilm captions={false} audio={false} progress={false} />
    </div>
    <Captions size={58} bottom={150} maxWidth={980} />
    <div style={{ position: 'absolute', bottom: 48, left: 0, right: 0, textAlign: 'center', fontFamily: F.mono, fontSize: 20, letterSpacing: 2, color: C.mute }}>
      SIMULATED CALL · DEMO DATA
    </div>
    <Progress total={TOTAL} height={8} />
    <Audio src={staticFile('audio/mix.wav')} />
  </AbsoluteFill>
);
