import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { C, F, T, s, sceneFrom, rand } from '../theme';
import { clamp, ease, Grain } from '../components';
import { WORDS, Label } from './shared';

// where each word-object floats (x, y in px from centre, z depth, base rotation)
const SPOTS = [
  [-560, -170, -200, -14], [-170, -250, 120, 8], [200, -200, -60, -6], [600, -150, 180, 12],
  [-430, 200, 120, 10], [40, 240, -200, -10], [520, 230, 40, 6],
];
const KEY = [false, true, true, true, false, true, true]; // kal tak pakka … kar dunga carry the meaning

/** 8–14s. The sentence breaks into seven physical objects floating in 3D space. */
export const Shatter: React.FC = () => {
  const f = useCurrentFrame();
  const lands = T.cues.slab.map((t) => s(t) - sceneFrom('shatter'));
  const count = lands.filter((l) => f >= l).length;
  const orbit = interpolate(f, [0, s(6)], [-22, 18], { ...clamp });
  const glow = interpolate(f, [s(3.5), s(4)], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 55%, #1A1630, ${C.ink} 70%)`, overflow: 'hidden' }}>
      <AbsoluteFill style={{ perspective: 1400, perspectiveOrigin: '50% 45%' }}>
        <div style={{ position: 'absolute', left: '50%', top: '56%', transformStyle: 'preserve-3d',
          transform: `rotateY(${orbit}deg) rotateX(${8 + Math.sin(f / 40) * 4}deg)` }}>
          {WORDS.map((w, i) => {
            const p = interpolate(f, [lands[i] - 10, lands[i] + 8], [0, 1], { ...clamp, easing: ease });
            const [x, y, z, r] = SPOTS[i];
            const fx = (rand(i + 1) - 0.5) * 900, fy = (rand(i + 7) - 0.5) * 600;
            const bob = Math.sin((f + i * 17) / 22) * 14;
            const key = KEY[i];
            const lit = key ? glow : 0;
            return (
              <div key={i} style={{
                position: 'absolute', transformStyle: 'preserve-3d',
                transform: `translate3d(${x + (1 - p) * fx}px, ${y + bob + (1 - p) * fy}px, ${z - (1 - p) * 900}px) rotateY(${r + (1 - p) * 90}deg) rotateZ(${r * 0.3}deg) translate(-50%,-50%)`,
                opacity: p * (key ? 1 : 1 - glow * 0.55),
              }}>
                <div style={{
                  padding: '26px 44px 18px', borderRadius: 22, background: lit > 0.5 ? (i === 3 ? C.violet : C.lime) : '#1D1B2A',
                  border: `2px solid ${lit > 0.5 ? 'transparent' : '#353247'}`, boxShadow: `0 40px 80px rgba(0,0,0,0.55)${lit ? `, 0 0 ${80 * lit}px rgba(198,255,31,0.35)` : ''}`,
                  fontFamily: F.viral, fontSize: 120, lineHeight: 1, textTransform: 'uppercase',
                  color: lit > 0.5 ? (i === 3 ? C.cream : C.ink) : C.cream, whiteSpace: 'nowrap',
                }}>
                  <div style={{ fontFamily: F.mono, fontSize: 20, letterSpacing: 3, opacity: 0.6, marginBottom: 6 }}>0{i + 1}</div>
                  {w}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 110, top: 60, fontFamily: F.viral, fontSize: 130, lineHeight: 1, color: C.cream, textTransform: 'uppercase' }}>
        {count} {count === 1 ? 'word' : 'words'}.
      </div>
      <Grain />
    </AbsoluteFill>
  );
};
