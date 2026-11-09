import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { C, F, T, s, sceneFrom, rand } from '../theme';
import { clamp, ease, Grain } from '../components';
import { Label } from './shared';

const LINE = T.line;
const CH = 46;                                   // mono char width at 76px
const X0 = (1920 - LINE.length * CH) / 2;
const Y0 = 250;

// which signal each word feeds: 0 commitment, 1 deadline, 2 follow-up
const WORD_SIG = [2, 1, 1, 0, 2, 0, 0];
const SIG = [
  { name: 'Commitment', value: '“Pakka” — will pay', src: 'pakka · kar dunga', color: C.lime, text: C.ink, x: 420 },
  { name: 'Deadline', value: 'Tomorrow · 11 Nov', src: 'kal tak', color: C.cream, text: C.ink, x: 960 },
  { name: 'Follow-up', value: 'Reminder · 11 Nov, 10 AM', src: 'payment', color: C.violet, text: C.cream, x: 1500 },
];

type P = { x0: number; y0: number; ex: number; ey: number; ez: number; tx: number; ty: number; sig: number; r: number; size: number };
const PARTICLES: P[] = (() => {
  const out: P[] = []; let w = 0;
  for (let i = 0; i < LINE.length; i++) {
    const ch = LINE[i];
    if (ch === ' ') { w++; continue; }
    for (let k = 0; k < 7; k++) {
      const seed = i * 13 + k * 7.3;
      const sig = WORD_SIG[w];
      const ang = rand(seed) * Math.PI * 2, sp = 140 + rand(seed + 1) * 420;
      out.push({
        x0: X0 + i * CH + CH / 2, y0: Y0 + 40,
        ex: Math.cos(ang) * sp, ey: Math.sin(ang) * sp * 0.8, ez: (rand(seed + 2) - 0.3) * 900,
        tx: SIG[sig].x + (rand(seed + 3) - 0.5) * 400, ty: 640 + (rand(seed + 4) - 0.5) * 150,
        sig, r: rand(seed + 5) * 360, size: 6 + rand(seed + 6) * 12,
      });
    }
  }
  return out;
})();

/** 21–29s. THE WOW: the transcript detonates into particles that re-form as three signals. */
export const Signals: React.FC = () => {
  const f = useCurrentFrame();
  const BOOM = s(T.cues.bigImpact[1]) - sceneFrom('signals');
  const REV = T.cues.impact.slice(2, 5).map((t) => s(t) - sceneFrom('signals'));
  const lineOut = interpolate(f, [BOOM - 1, BOOM + 2], [1, 0], clamp);
  const pre = interpolate(f, [0, BOOM], [0, 1], clamp);
  const push = interpolate(f, [s(4.6), s(8)], [1, 1.07], clamp);
  const title = interpolate(f, [s(4.4), s(4.9)], [0, 1], { ...clamp, easing: ease });

  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 60%, #191530, ${C.ink} 72%)`, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${push}) rotate(${(push - 1) * 8}deg)` }}>
        {/* the transcript line, charging up before it detonates */}
        <div style={{ position: 'absolute', left: X0, top: Y0, fontFamily: F.mono, fontSize: 76, color: C.cream, whiteSpace: 'pre', opacity: lineOut,
          textShadow: `0 0 ${30 * pre}px rgba(198,255,31,${0.6 * pre})`, transform: `scale(${1 + 0.03 * pre}) translateX(${Math.sin(f * 2.3) * 3 * pre}px)` }}>
          {LINE}
        </div>

        {/* particles */}
        <AbsoluteFill style={{ perspective: 1200 }}>
          {f >= BOOM && PARTICLES.map((p, i) => {
            const rv = REV[p.sig];
            const e = interpolate(f, [BOOM, BOOM + 16], [0, 1], { ...clamp, easing: ease });
            const g = interpolate(f, [BOOM + 16, rv], [0, 1], { ...clamp, easing: (t) => t * t * (3 - 2 * t) });
            const fade = interpolate(f, [rv, rv + 8], [1, 0], clamp);
            if (fade <= 0) return null;
            const ex = p.x0 + p.ex, ey = p.y0 + p.ey;
            const x = g > 0 ? ex + (p.tx - ex) * g : p.x0 + p.ex * e;
            const y = g > 0 ? ey + (p.ty - ey) * g : p.y0 + p.ey * e;
            const z = p.ez * e * (1 - g);
            return (
              <div key={i} style={{ position: 'absolute', left: x, top: y, width: p.size, height: p.size, borderRadius: p.size * 0.2,
                background: SIG[p.sig].color, opacity: fade, transform: `translateZ(${z}px) rotate(${p.r + f * 6}deg)`,
                boxShadow: `0 0 ${p.size}px ${SIG[p.sig].color}` }} />
            );
          })}
        </AbsoluteFill>

        {/* the three signals */}
        {SIG.map((g, k) => {
          const p = interpolate(f, [REV[k] - 2, REV[k] + 10], [0, 1], { ...clamp, easing: ease });
          const pop = interpolate(f, [REV[k], REV[k] + 4, REV[k] + 12], [0.85, 1.06, 1], clamp);
          return (
            <div key={g.name} style={{ position: 'absolute', left: g.x, top: 640, transform: `translate(-50%,-50%) scale(${pop})`, opacity: p,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{ background: g.color, color: g.text, borderRadius: 28, padding: '22px 40px 14px', fontFamily: F.viral, fontSize: 96, lineHeight: 1,
                textTransform: 'uppercase', boxShadow: `0 0 80px ${g.color}55`, whiteSpace: 'nowrap' }}>{g.name}</div>
              <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 36, color: C.cream, whiteSpace: 'nowrap' }}>{g.value}</div>
              <Label style={{ fontSize: 18 }}>from: “{g.src}”</Label>
            </div>
          );
        })}
      </AbsoluteFill>
      <Label color={C.lime} style={{ position: 'absolute', top: 60, left: 120, opacity: title }}>Step 2 · Understand</Label>
      <div style={{ position: 'absolute', top: 110, width: '100%', textAlign: 'center', opacity: title, fontFamily: F.viral, fontSize: 80, color: C.cream, textTransform: 'uppercase' }}>
        1 sentence. <span style={{ color: C.lime }}>3 signals.</span>
      </div>
      <Grain />
    </AbsoluteFill>
  );
};
