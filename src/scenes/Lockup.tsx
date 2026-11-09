import React from 'react';
import { AbsoluteFill, getInputProps, interpolate, useCurrentFrame } from 'remotion';
import { C, F } from '../theme';
import { clamp, ease } from '../components';
import { LensMark } from './shared';

const NAME = 'VAANILENS';

/** 41-46s. Hard cut to electric lime. The name slams in letter by letter, the line follows, then a long hold. */
export const Lockup: React.FC = () => {
  const f = useCurrentFrame();
  const tag = interpolate(f, [16, 30], [0, 1], { ...clamp, easing: ease });
  const meta = interpolate(f, [40, 54], [0, 1], clamp);
  const mark = interpolate(f, [4, 22], [0, 1], { ...clamp, easing: ease });
  const url = String((getInputProps() as { url?: string }).url || '');
  const cta = interpolate(f, [26, 38], [0, 1], { ...clamp, easing: ease });
  const breathe = 1 + Math.sin(f / 18) * 0.006;
  return (
    <AbsoluteFill style={{ background: C.lime, color: C.ink, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `scale(${breathe})` }}>
        <div style={{ opacity: mark, transform: `scale(${0.6 + 0.4 * mark}) rotate(${(1 - mark) * -90}deg)`, marginBottom: 24 }}>
          <LensMark size={150} ring={C.ink} bars={C.violet} />
        </div>
        <div style={{ display: 'flex', fontFamily: F.viral, fontSize: 330, lineHeight: 0.9, letterSpacing: 4 }}>
          {NAME.split('').map((ch, i) => {
            const p = interpolate(f, [i * 1.6, i * 1.6 + 7], [0, 1], { ...clamp, easing: ease });
            return (
              <span key={i} style={{ display: 'inline-block', overflow: 'hidden' }}>
                <span style={{ display: 'inline-block', transform: `translateY(${(1 - p) * 105}%)`, color: i >= 5 ? C.violet : C.ink }}>{ch}</span>
              </span>
            );
          })}
        </div>
        <div style={{ marginTop: 26, opacity: tag, transform: `translateY(${(1 - tag) * 20}px)`, fontFamily: F.caption, fontWeight: 900, fontSize: 64, letterSpacing: 6 }}>
          HEAR BEYOND THE WORDS.
        </div>
        {url ? (
          <div style={{ marginTop: 34, opacity: cta, transform: `scale(${0.9 + 0.1 * cta})`, background: C.ink, color: C.lime, borderRadius: 999,
            padding: '18px 44px', fontFamily: F.caption, fontWeight: 900, fontSize: 44, letterSpacing: 2 }}>
            TRY IT LIVE {'>'} {url}
          </div>
        ) : null}
      </div>
      <div style={{ position: 'absolute', bottom: 60, opacity: meta * 0.85, fontFamily: F.mono, fontSize: 22, letterSpacing: 2.5 }}>
        HACKATHON PROTOTYPE {'\u00B7'} BUILT ON GNANI PRISMA &amp; GNANI TIMBRE {'\u00B7'} SIMULATED CALL
      </div>
    </AbsoluteFill>
  );
};
