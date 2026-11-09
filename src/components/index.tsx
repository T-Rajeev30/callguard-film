import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { C, F, rand } from '../theme';

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
export const ease = Easing.bezier(0.16, 1, 0.3, 1);

export const useSpring = (delay = 0, damping = 18, mass = 0.8) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass } });
};

/** Slow drift + optional punch-in: gives every scene a camera. */
export const Camera: React.FC<{ children: React.ReactNode; from?: number; to?: number; dur: number; x?: number }> = ({
  children, from = 1, to = 1.06, dur, x = 0,
}) => {
  const f = useCurrentFrame();
  const sc = interpolate(f, [0, dur], [from, to], clamp);
  const tx = interpolate(f, [0, dur], [0, x], clamp);
  return <AbsoluteFill style={{ transform: `translateX(${tx}px) scale(${sc})` }}>{children}</AbsoluteFill>;
};

/** Film grain + vignette, deterministic per frame. */
export const Grain: React.FC<{ dark?: boolean }> = ({ dark = true }) => {
  const f = useCurrentFrame();
  const seed = f % 8;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <svg width="100%" height="100%" style={{ opacity: dark ? 0.07 : 0.05, mixBlendMode: dark ? 'screen' : 'multiply' }}>
        <filter id={`g${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed} />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#g${seed})`} />
      </svg>
      <AbsoluteFill
        style={{ background: dark
          ? 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)'
          : 'radial-gradient(ellipse at center, transparent 60%, rgba(60,40,10,0.12) 100%)' }}
      />
    </AbsoluteFill>
  );
};

/** Deterministic waveform bars. `env(i, n)` returns 0..1 amplitude per bar. */
export const Waveform: React.FC<{
  bars?: number; width: number; height: number; color?: string; env?: (i: number, n: number) => number;
  live?: boolean; gap?: number; seed?: number;
}> = ({ bars = 96, width, height, color = C.lime, env = () => 1, live = true, gap = 4, seed = 1 }) => {
  const f = useCurrentFrame();
  const bw = (width - gap * (bars - 1)) / bars;
  return (
    <svg width={width} height={height}>
      {Array.from({ length: bars }).map((_, i) => {
        const base = 0.25 + 0.75 * rand(i * 7.1 + seed);
        const wob = live ? 0.6 + 0.4 * Math.sin(f * 0.35 + i * 0.9 + seed) : 1;
        const h = Math.max(3, height * base * wob * env(i, bars));
        return <rect key={i} x={i * (bw + gap)} y={(height - h) / 2} width={bw} height={h} rx={bw / 2} fill={color} />;
      })}
    </svg>
  );
};

export const Chip: React.FC<{ label: string; value: string; color: string; textColor?: string; scale?: number; style?: React.CSSProperties }> = ({
  label, value, color, textColor = C.ink, scale = 1, style,
}) => (
  <div style={{
    display: 'inline-flex', flexDirection: 'column', gap: 6 * scale, padding: `${18 * scale}px ${26 * scale}px`,
    background: color, color: textColor, borderRadius: 22 * scale, fontFamily: F.body,
    boxShadow: '0 30px 60px rgba(0,0,0,0.35)', ...style,
  }}>
    <span style={{ fontSize: 18 * scale, letterSpacing: 3 * scale, fontWeight: 600, opacity: 0.7 }}>{label}</span>
    <span style={{ fontSize: 40 * scale, fontWeight: 800, letterSpacing: -1 * scale }}>{value}</span>
  </div>
);

export const Tag: React.FC<{ children: React.ReactNode; color?: string; style?: React.CSSProperties }> = ({ children, color = C.mute, style }) => (
  <div style={{ fontFamily: F.mono, fontSize: 20, letterSpacing: 2, color, textTransform: 'uppercase', ...style }}>{children}</div>
);

/** Letter-level mask reveal (slides up from below a clip line). */
export const Reveal: React.FC<{ text: string; delay?: number; size: number; color: string; weight?: number; stagger?: number; family?: string; upper?: boolean }> = ({
  text, delay = 0, size, color, weight = 800, stagger = 1.2, family = F.display, upper = false,
}) => {
  if (upper) text = text.toUpperCase();
  const f = useCurrentFrame();
  let k = 0;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: size * 0.26, fontFamily: family, fontSize: size, fontWeight: weight, color, letterSpacing: family === F.viral ? 1 : -size * 0.035, lineHeight: family === F.viral ? 1.0 : 1.05 }}>
      {text.split(' ').map((word, wi) => (
        <span key={wi} style={{ display: 'inline-flex', whiteSpace: 'nowrap' }}>
          {word.split('').map((ch) => {
            const i = k++;
            const p = interpolate(f, [delay + i * stagger, delay + i * stagger + 14], [0, 1], { ...clamp, easing: ease });
            return (
              <span key={i} style={{ display: 'inline-block', overflow: 'hidden', paddingBottom: size * 0.12 }}>
                <span style={{ display: 'inline-block', transform: `translateY(${(1 - p) * 110}%)` }}>{ch}</span>
              </span>
            );
          })}
        </span>
      ))}
    </div>
  );
};
