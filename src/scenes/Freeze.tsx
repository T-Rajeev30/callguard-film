import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { C, F, s } from '../theme';
import { clamp, ease, Grain } from '../components';
import { WORDS_P, Label } from './shared';

/** 3–8s. The call freezes. KAL TAK lights up, KAL grows until it becomes a deadline on a timeline. */
export const Freeze: React.FC = () => {
  const f = useCurrentFrame();
  const freezeIn = interpolate(f, [0, 6], [0, 1], clamp);
  const grow = interpolate(f, [s(0.8), s(1.6)], [0, 1], { ...clamp, easing: Easing });
  const tl = interpolate(f, [s(1.6), s(3.6)], [0, 1], { ...clamp, easing: ease });
  const lock = interpolate(f, [s(3.8), s(4.1)], [0, 1], { ...clamp, easing: ease });
  const pan = interpolate(f, [s(1.6), s(5)], [0, -260], { ...clamp, easing: ease });
  const scan = (f * 9) % 1080;

  return (
    <AbsoluteFill style={{ background: C.ink, overflow: 'hidden' }}>
      {/* frozen sentence: everything but KAL TAK dims */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 120, display: 'flex', justifyContent: 'center', gap: 30,
        fontFamily: F.viral, fontSize: 110, textTransform: 'uppercase', opacity: 1 - grow * 0.85, filter: `saturate(${1 - freezeIn})` }}>
        {WORDS_P.map((w, i) => (
          <span key={i} style={{ color: i === 1 || i === 2 ? C.lime : C.cream, opacity: i === 1 || i === 2 ? 1 : 0.35 }}>{w}</span>
        ))}
      </div>

      {/* KAL grows into the frame */}
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%,-50%) translate(${pan}px, ${interpolate(grow, [0, 1], [-260, -60])}px) scale(${interpolate(grow, [0, 1], [0.4, 1])})`,
        fontFamily: F.viral, fontSize: 560, lineHeight: 0.85, color: C.lime, opacity: grow > 0 ? 1 : 0, letterSpacing: 6, textShadow: '0 0 120px rgba(198,255,31,0.35)' }}>
        KAL
      </div>

      {/* the deadline timeline draws across */}
      <div style={{ position: 'absolute', left: 140 + pan, top: 760, width: 1900, height: 200, opacity: tl > 0 ? 1 : 0 }}>
        <div style={{ position: 'absolute', top: 40, left: 0, height: 4, width: `${tl * 100}%`, background: C.cream }} />
        {Array.from({ length: 25 }).map((_, i) => {
          const x = (i / 24) * 1900;
          const on = tl * 1900 > x;
          return <div key={i} style={{ position: 'absolute', left: x, top: i % 6 === 0 ? 24 : 32, width: 2, height: i % 6 === 0 ? 36 : 20, background: C.cream, opacity: on ? 0.6 : 0 }} />;
        })}
        <div style={{ position: 'absolute', left: 0, top: 70, opacity: tl > 0.05 ? 1 : 0 }}>
          <Label color={C.cream}>Today · 10 Nov</Label>
        </div>
        <div style={{ position: 'absolute', left: 1140, top: 4, transform: `scale(${0.6 + 0.4 * lock})`, opacity: tl > 0.6 ? 1 : 0 }}>
          <div style={{ width: 76, height: 76, borderRadius: 38, background: C.lime, boxShadow: `0 0 ${60 * lock}px rgba(198,255,31,0.8)`, marginLeft: -38 }} />
        </div>
        <div style={{ position: 'absolute', left: 1100, top: 96, opacity: lock }}>
          <Label color={C.lime} style={{ fontSize: 26 }}>Kal = tomorrow · 11 Nov</Label>
          <div style={{ fontFamily: F.viral, fontSize: 96, color: C.cream, textTransform: 'uppercase', lineHeight: 1 }}>Deadline</div>
        </div>
      </div>

      {/* freeze-frame chrome */}
      <div style={{ position: 'absolute', top: 60, left: 80, display: 'flex', gap: 18, alignItems: 'center', opacity: freezeIn }}>
        <div style={{ width: 14, height: 40, background: C.cream }} /><div style={{ width: 14, height: 40, background: C.cream }} />
        <Label color={C.cream} style={{ marginLeft: 10 }}>Paused · 00:16:22</Label>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: scan, height: 2, background: 'rgba(242,237,227,0.06)' }} />
      <Grain />
    </AbsoluteFill>
  );
};

function Easing(t: number) { return 1 - Math.pow(1 - t, 4); }
