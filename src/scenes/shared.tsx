import React from 'react';
import { C, F, T } from '../theme';
import voiceTiming from '../audio/voice-timing.json';
import prismaJson from '../audio/prisma.json';

export const WORDS = T.line.replace(/[.,]/g, '').split(' ');          // 7 words
export const WORDS_P = T.line.split(' ');                              // with punctuation
const vt = voiceTiming as Record<string, number>;

/** Word onset times (s). If the real caller audio exists, spread words across its real length. */
export const wordTimes = (): number[] => {
  const d = vt['d1_caller'];
  if (!d) return T.words;
  const at = T.voice[0].at;
  return WORDS.map((_, i) => at + (i / WORDS.length) * d * 0.92);
};

/** Language of each word for the code-mix view (EN = English, HI = Hindi). */
export const LANG = ['EN', 'HI', 'HI', 'HI', 'EN', 'HI', 'HI'];

/** Real Prisma output, written by scripts/voice.ts when GNANI_API_KEY is set. */
export const prisma = prismaJson as { transcript?: string; detected_language_code?: string; model?: string; format?: string };

export const LensMark: React.FC<{ size?: number; ring?: string; bars?: string; bg?: string }> = ({ size = 120, ring = C.ink, bars = C.violet, bg = 'transparent' }) => {
  const hs = [0.32, 0.62, 1, 0.7, 0.4];
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', border: `${size * 0.085}px solid ${ring}`, background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: size * 0.05, boxSizing: 'border-box' }}>
      {hs.map((h, i) => <div key={i} style={{ width: size * 0.07, height: size * 0.5 * h, borderRadius: size, background: bars }} />)}
    </div>
  );
};

export const Label: React.FC<{ children: React.ReactNode; color?: string; style?: React.CSSProperties }> = ({ children, color = C.mute, style }) => (
  <div style={{ fontFamily: F.mono, fontSize: 22, letterSpacing: 3, textTransform: 'uppercase', color, ...style }}>{children}</div>
);
