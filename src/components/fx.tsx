import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { C, F, T, s, rand } from '../theme';
import { clamp, ease } from './index';
import voiceTiming from '../audio/voice-timing.json';


/** Global VFX driven by the cue sheet: impact shake, RGB split, flash frames, zoom-punch on cuts. */
export const ImpactFX: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const f = useCurrentFrame();
  let dx = 0, dy = 0, split = 0, flash = 0, punch = 1;
  for (const c of [...T.cues.impact, ...T.cues.bigImpact]) {
    const d = f - s(c);
    if (d < 0 || d > 14) continue;
    const big = T.cues.bigImpact.includes(c);
    const k = Math.exp(-d / (big ? 4 : 2.5)) * (big ? 1 : 0.45);
    dx += (rand(f * 3.1 + c) - 0.5) * 34 * k;
    dy += (rand(f * 7.7 + c) - 0.5) * 22 * k;
    split = Math.max(split, 10 * k);
    if (big) flash = Math.max(flash, interpolate(d, [0, 1, 4], [0.26, 0.16, 0], clamp));
  }
  for (const [, [a]] of Object.entries(T.scenes)) {
    const d = f - s(a);
    if (a > 0 && d >= 0 && d < 8) punch = Math.max(punch, interpolate(d, [0, 7], [1.06, 1], { ...clamp, easing: ease }));
  }
  const filter = split > 0.5
    ? `drop-shadow(${split}px 0 0 rgba(255,0,120,0.55)) drop-shadow(${-split}px 0 0 rgba(0,220,255,0.55))`
    : undefined;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `translate(${dx}px, ${dy}px) scale(${punch})`, filter }}>{children}</AbsoluteFill>
      {flash > 0 && <AbsoluteFill style={{ background: '#FFFFFF', opacity: flash, mixBlendMode: 'screen' }} />}
    </AbsoluteFill>
  );
};

/** Thin progress line: a retention device common in short-form video (craft practice, not a measured effect). */
export const Progress: React.FC<{ total: number; color?: string; height?: number }> = ({ total, color = C.lime, height = 6 }) => {
  const f = useCurrentFrame();
  return <div style={{ position: 'absolute', left: 0, bottom: 0, height, width: `${(f / total) * 100}%`, background: color, opacity: 0.9 }} />;
};

type Word = { w: string; start: number; end: number };
const est = (text: string) => 0.25 + text.split(/\s+/).length * 0.34;

/** Word-by-word captions (heavy Montserrat, active word in lime) for sound-off viewing. */
export const Captions: React.FC<{ size?: number; bottom?: number; maxWidth?: number }> = ({ size = 54, bottom = 90, maxWidth = 1500 }) => {
  const f = useCurrentFrame();
  const t = f / T.fps;
  const vt = voiceTiming as Record<string, number>;
  const line = T.voice.find((v) => v.caption && t >= v.at - 0.1 && t <= v.at + (vt[v.id] ?? est(v.text)) + 0.35);
  if (!line) return null;
  const dur = vt[line.id] ?? est(line.text);
  const words = line.text.split(/\s+/);
  const per = dur / words.length;
  const ws: Word[] = words.map((w, i) => ({ w, start: line.at + i * per, end: line.at + (i + 1) * per }));
  const appear = interpolate(t, [line.at - 0.1, line.at + 0.05], [0, 1], clamp);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom, display: 'flex', justifyContent: 'center', opacity: appear }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: `0 ${size * 0.28}px`, maxWidth,
        fontFamily: F.caption, fontWeight: 900, fontSize: size, textTransform: 'uppercase', lineHeight: 1.15 }}>
        {ws.map((w, i) => {
          const active = t >= w.start && t < w.end;
          const said = t >= w.start;
          const pop = active ? interpolate(t, [w.start, w.start + 0.08], [1.18, 1], clamp) : 1;
          return (
            <span key={i} style={{
              color: active ? C.lime : C.cream, opacity: said ? 1 : 0.35, transform: `scale(${pop})`, display: 'inline-block',
              WebkitTextStroke: `${size * 0.05}px ${C.ink}`, paintOrder: 'stroke fill',
              textShadow: `0 ${size * 0.08}px ${size * 0.2}px rgba(0,0,0,0.6)`,
            }}>{w.w}</span>
          );
        })}
      </div>
    </div>
  );
};

/** Moving bloom / light leak in brand colors (cheap CSS, no WebGL). */
export const LightLeak: React.FC<{ from: number; dur: number; color?: string }> = ({ from, dur, color = 'rgba(198,255,31,0.22)' }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [from, from + dur], [0, 1], clamp);
  if (p <= 0 || p >= 1) return null;
  const o = Math.sin(p * Math.PI);
  return <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen', opacity: o,
    background: `radial-gradient(ellipse 60% 80% at ${-20 + p * 140}% 40%, ${color}, transparent 70%)` }} />;
};
