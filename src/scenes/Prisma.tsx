import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { C, F, T, s, sceneFrom } from '../theme';
import { clamp, ease, Grain, Waveform } from '../components';
import { WORDS_P, LANG, prisma, Label } from './shared';

/** 14–21s. Gnani Prisma turns the audio into text, live, and tags the code-switching word by word. */
export const Prisma: React.FC = () => {
  const f = useCurrentFrame();
  const t0 = s(T.cues.typeStart) - sceneFrom('prisma');
  const t1 = s(T.cues.typeEnd) - sceneFrom('prisma');
  const full = T.line;
  const shown = Math.floor(interpolate(f, [t0, t1], [0, full.length], clamp));
  const play = interpolate(f, [t0, t1], [0, 1], clamp);
  const detected = interpolate(f, [s(4.5), s(4.9)], [0, 1], { ...clamp, easing: ease });
  const enter = interpolate(f, [0, 14], [0, 1], { ...clamp, easing: ease });
  // char offsets of each word
  let acc = 0;
  const spans = WORDS_P.map((w) => { const a = acc; acc += w.length + 1; return [a, a + w.length] as const; });

  return (
    <AbsoluteFill style={{ background: C.cream, color: C.ink }}>
      <div style={{ position: 'absolute', top: 80, left: 120, right: 120, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: enter }}>
        <div>
          <Label color={C.violet}>Step 1 · Hear</Label>
          <div style={{ fontFamily: F.viral, fontSize: 110, lineHeight: 1, textTransform: 'uppercase' }}>Gnani Prisma</div>
          <div style={{ fontFamily: F.body, fontSize: 30, color: '#4A4652', marginTop: 6 }}>Speech → text, trained for Indian phone calls</div>
        </div>
        <div style={{ textAlign: 'right', opacity: detected }}>
          <div style={{ display: 'inline-flex', gap: 10, alignItems: 'center', background: C.ink, color: C.lime, borderRadius: 999, padding: '14px 24px', fontFamily: F.mono, fontSize: 24 }}>
            ● {prisma.detected_language_code ?? 'hi-IN'} · code-mixed
          </div>
        </div>
      </div>

      {/* audio strip with playhead */}
      <div style={{ position: 'absolute', left: 120, right: 120, top: 380, height: 150, borderRadius: 24, background: C.ink, overflow: 'hidden', opacity: enter }}>
        <div style={{ position: 'absolute', left: 30, top: 30 }}>
          <Waveform width={1620} height={90} bars={150} seed={6} live={false} color="#3B3850"
            env={(i, n) => (i / n < 0.06 || i / n > 0.94 ? 0.08 : 1)} />
        </div>
        <div style={{ position: 'absolute', left: 30, top: 30, width: 1620 * play, height: 90, overflow: 'hidden' }}>
          <Waveform width={1620} height={90} bars={150} seed={6} live={false} color={C.lime}
            env={(i, n) => (i / n < 0.06 || i / n > 0.94 ? 0.08 : 1)} />
        </div>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 30 + 1620 * play, width: 3, background: C.cream }} />
      </div>

      {/* transcript assembling, with per-word language tags */}
      <div style={{ position: 'absolute', left: 120, right: 120, top: 600, display: 'flex', flexWrap: 'wrap', columnGap: 26, rowGap: 10 }}>
        {WORDS_P.map((w, i) => {
          const [a, b] = spans[i];
          const vis = Math.max(0, Math.min(w.length, shown - a));
          const done = shown >= b;
          const tag = interpolate(f, [t0 + (b / full.length) * (t1 - t0), t0 + (b / full.length) * (t1 - t0) + 6], [0, 1], clamp);
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ alignSelf: 'flex-start', opacity: tag, transform: `translateY(${(1 - tag) * 10}px)`, fontFamily: F.mono, fontSize: 18, letterSpacing: 2,
                padding: '4px 10px', borderRadius: 8, background: LANG[i] === 'HI' ? C.violet : C.ink, color: LANG[i] === 'HI' ? C.cream : C.lime }}>{LANG[i]}</div>
              <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 92, letterSpacing: -2, lineHeight: 1, whiteSpace: 'pre' }}>
                {w.slice(0, vis)}{!done && vis > 0 && <span style={{ color: C.violet }}>|</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', left: 120, bottom: 70, opacity: detected }}>
        <Label color="#4A4652">
          {prisma.transcript ? `Raw Prisma output: ${prisma.transcript}` : 'model prisma-v3.0 · format codemix · illustrative transcript'}
        </Label>
      </div>
      <Grain dark={false} />
    </AbsoluteFill>
  );
};
