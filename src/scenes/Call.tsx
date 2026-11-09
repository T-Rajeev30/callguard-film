import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { C, F, s } from '../theme';
import { clamp, ease, Grain, Waveform } from '../components';
import { WORDS_P, wordTimes, Label } from './shared';

/** 0–3s. An incoming collections call. No intro, no logo: the line starts immediately. */
export const Call: React.FC = () => {
  const f = useCurrentFrame();
  const times = wordTimes().map(s);
  times[0] = -9; // first word readable in frame 0 (sound-off)
  const cur = times.filter((t) => f >= t).length - 1;
  const ring = (f % 24) / 24;
  const tilt = interpolate(f, [0, s(3)], [-16, -10], clamp);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 60% at 70% 50%, #17142B 0%, ${C.ink} 70%)` }}>
      {/* the phone */}
      <div style={{ position: 'absolute', right: 170, top: 110, perspective: 1600 }}>
        <div style={{ width: 400, height: 830, borderRadius: 64, background: '#111117', border: '2px solid #2B2B36',
          transform: `rotateY(${tilt}deg) rotateX(4deg) translateY(${Math.sin(f / 20) * 6}px)`, boxShadow: '0 80px 160px rgba(0,0,0,0.7), 0 0 120px rgba(91,43,255,0.25)',
          padding: '70px 34px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
          <Label color={C.lime} style={{ fontSize: 18 }}>● Incoming call</Label>
          <div style={{ position: 'relative', width: 150, height: 150, marginTop: 40 }}>
            {[0, 0.33, 0.66].map((o) => {
              const p = (ring + o) % 1;
              return <div key={o} style={{ position: 'absolute', inset: -p * 60, borderRadius: '50%', border: `2px solid ${C.lime}`, opacity: 0.5 * (1 - p) }} />;
            })}
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#2A2540', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: F.display, fontWeight: 800, fontSize: 64, color: C.cream }}>R</div>
          </div>
          <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 44, color: C.cream, marginTop: 20 }}>Rahul S.</div>
          <div style={{ fontFamily: F.body, fontSize: 22, color: C.mute }}>Loan ••4417 · EMI due</div>
          <div style={{ marginTop: 60 }}>
            <Waveform width={300} height={90} bars={34} seed={2} env={() => (cur >= 0 && f < s(2.7) ? 1 : 0.15)} />
          </div>
          <div style={{ marginTop: 'auto', fontFamily: F.mono, fontSize: 22, color: C.cream, opacity: 0.8 }}>00:{String(14 + Math.floor(f / 30)).padStart(2, '0')}</div>
        </div>
      </div>

      {/* the line, landing word by word */}
      <div style={{ position: 'absolute', left: 120, top: 250, width: 1080, display: 'flex', flexWrap: 'wrap', columnGap: 34, rowGap: 0,
        fontFamily: F.viral, fontSize: 176, lineHeight: 1.0, textTransform: 'uppercase', color: C.cream }}>
        {WORDS_P.map((w, i) => {
          const p = interpolate(f, [times[i], times[i] + 7], [0, 1], { ...clamp, easing: ease });
          return (
            <span key={i} style={{ opacity: p, transform: `translateY(${(1 - p) * 50}px) scale(${0.9 + 0.1 * p})`, filter: `blur(${(1 - p) * 12}px)`,
              color: i === cur ? C.lime : C.cream, display: 'inline-block' }}>{w}</span>
          );
        })}
      </div>
      <Label style={{ position: 'absolute', left: 124, top: 190 }} color={C.cream}>Customer · live</Label>
      <Label style={{ position: 'absolute', left: 124, bottom: 80, fontSize: 18 }}>Simulated call · demo data</Label>
      <Grain />
    </AbsoluteFill>
  );
};
