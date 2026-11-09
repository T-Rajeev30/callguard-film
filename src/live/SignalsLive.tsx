import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, interpolate, useCurrentFrame, Sequence } from 'remotion';
import { C, F, rand } from '../theme';

export type LiveSignal = { type: string; value: string; color: 'lime' | 'cream' | 'violet'; evidence?: string[]; strength?: string };
export type LiveProps = { line: string; signals: LiveSignal[]; boomSrc?: string };

const PAL = { lime: [C.lime, C.ink], cream: [C.cream, C.ink], violet: [C.violet, C.cream] } as const;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const LIVE_FRAMES = 165;

/** The film's "wow" moment, driven by REAL data: the Prisma transcript detonates into the signals VaaniLens extracted. */
export const SignalsLive: React.FC<LiveProps> = ({ line, signals, boomSrc }) => {
  const f = useCurrentFrame();
  const W = 1920;
  const text = (line || '').trim().slice(0, 90);
  const CH = Math.min(46, 1700 / Math.max(text.length, 1));
  const FS = CH / 0.6;
  const X0 = (W - text.length * CH) / 2, Y0 = 250;
  const sigs = signals.slice(0, 4);
  const xs = sigs.map((_, k) => (W / (sigs.length + 1)) * (k + 1));
  const BOOM = 14, REV = sigs.map((_, k) => 32 + k * 14);

  const particles = useMemo(() => {
    const out: { x0: number; y0: number; ex: number; ey: number; tx: number; ty: number; sig: number; size: number; r: number }[] = [];
    const words = text.split(' ');
    let i = 0;
    words.forEach((w, wi) => {
      const lw = w.toLowerCase().replace(/[.,!?।]/g, '');
      let sig = sigs.findIndex((s) => (s.evidence || []).some((e) => e.toLowerCase().split(' ').includes(lw)));
      if (sig < 0) sig = sigs.length ? wi % sigs.length : 0;
      for (const _ of w) {
        for (let k = 0; k < 5; k++) {
          const seed = i * 13 + k * 7.3, ang = rand(seed) * Math.PI * 2, sp = 140 + rand(seed + 1) * 420;
          out.push({ x0: X0 + i * CH + CH / 2, y0: Y0 + FS * 0.5, ex: Math.cos(ang) * sp, ey: Math.sin(ang) * sp * 0.8,
            tx: (xs[sig] ?? W / 2) + (rand(seed + 3) - 0.5) * 340, ty: 640 + (rand(seed + 4) - 0.5) * 140, sig, size: 6 + rand(seed + 6) * 11, r: rand(seed + 5) * 360 });
        }
        i++;
      }
      i++; // space
    });
    return out;
  }, [text, signals]);

  const pre = interpolate(f, [0, BOOM], [0, 1], clamp);
  const lineOut = interpolate(f, [BOOM - 1, BOOM + 2], [1, 0], clamp);
  const shake = f >= BOOM && f < BOOM + 10 ? (rand(f) - 0.5) * 30 * (1 - (f - BOOM) / 10) : 0;
  const title = interpolate(f, [REV[REV.length - 1] ?? 40, (REV[REV.length - 1] ?? 40) + 12], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 60%, #191530, ${C.ink} 72%)`, overflow: 'hidden', transform: `translateX(${shake}px)` }}>
      {boomSrc && <Sequence from={BOOM}><Audio src={boomSrc} volume={0.7} /></Sequence>}
      <div style={{ position: 'absolute', left: X0, top: Y0, fontFamily: F.mono, fontSize: FS, color: C.cream, whiteSpace: 'pre', opacity: lineOut,
        textShadow: `0 0 ${30 * pre}px rgba(198,255,31,${0.6 * pre})` }}>{text}</div>
      {f >= BOOM && particles.map((p, i) => {
        const rv = REV[p.sig] ?? 40;
        const e = easeOut(interpolate(f, [BOOM, BOOM + 14], [0, 1], clamp));
        const g = interpolate(f, [BOOM + 14, rv], [0, 1], clamp);
        const gg = g * g * (3 - 2 * g);
        const fade = interpolate(f, [rv, rv + 8], [1, 0], clamp);
        if (fade <= 0) return null;
        const ex = p.x0 + p.ex, ey = p.y0 + p.ey;
        const x = g > 0 ? ex + (p.tx - ex) * gg : p.x0 + p.ex * e;
        const y = g > 0 ? ey + (p.ty - ey) * gg : p.y0 + p.ey * e;
        const col = PAL[sigs[p.sig]?.color ?? 'lime'][0];
        return <div key={i} style={{ position: 'absolute', left: x, top: y, width: p.size, height: p.size, borderRadius: p.size * 0.2, background: col, opacity: fade,
          transform: `rotate(${p.r + f * 6}deg)`, boxShadow: `0 0 ${p.size}px ${col}` }} />;
      })}
      {sigs.map((s, k) => {
        const p = interpolate(f, [REV[k] - 2, REV[k] + 10], [0, 1], clamp);
        const pop = interpolate(f, [REV[k], REV[k] + 4, REV[k] + 12], [0.85, 1.06, 1], clamp);
        const [bg, fg] = PAL[s.color] ?? PAL.lime;
        return (
          <div key={s.type + k} style={{ position: 'absolute', left: xs[k], top: 640, transform: `translate(-50%,-50%) scale(${pop})`, opacity: p,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: W / (sigs.length + 0.4) }}>
            <div style={{ background: bg, color: fg, borderRadius: 26, padding: '20px 34px 12px', fontFamily: F.viral, fontSize: sigs.length > 3 ? 74 : 92, lineHeight: 1,
              textTransform: 'uppercase', boxShadow: `0 0 80px ${bg}55`, whiteSpace: 'nowrap' }}>{s.type}</div>
            <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 32, color: C.cream, textAlign: 'center' }}>{s.value}</div>
            {s.evidence && s.evidence.length > 0 && <div style={{ fontFamily: F.mono, fontSize: 20, color: C.mute, letterSpacing: 2 }}>FROM: “{s.evidence.slice(0, 3).join(' · ')}”</div>}
          </div>
        );
      })}
      <div style={{ position: 'absolute', top: 90, width: '100%', textAlign: 'center', opacity: title, fontFamily: F.viral, fontSize: 76, color: C.cream, textTransform: 'uppercase' }}>
        1 call. <span style={{ color: C.lime }}>{sigs.length} signals.</span>
      </div>
    </AbsoluteFill>
  );
};
