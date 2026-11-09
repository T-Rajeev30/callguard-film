import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { C, F, T, s, sceneFrom } from '../theme';
import { clamp, ease, Grain } from '../components';
import { LensMark, Label } from './shared';

const panel = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  position: 'absolute', background: 'rgba(24,22,36,0.92)', border: '1px solid #34314A', borderRadius: 26,
  boxShadow: '0 50px 120px rgba(0,0,0,0.6)', fontFamily: F.body, color: C.cream, padding: 30, boxSizing: 'border-box', ...extra,
});

/** 35–41s. The product reveal: floating panels drift into a single VaaniLens view. Not a dashboard tour. */
export const Reveal: React.FC = () => {
  const f = useCurrentFrame();
  const ticks = T.cues.uiTick.slice(3).map((t) => s(t) - sceneFrom('reveal'));
  const inP = (i: number) => interpolate(f, [ticks[i] - 10, ticks[i] + 10], [0, 1], { ...clamp, easing: ease });
  const orbit = interpolate(f, [0, s(6)], [10, -4], clamp);
  const push = interpolate(f, [0, s(6)], [0.96, 1.04], clamp);
  const fly = (i: number, dx: number, dy: number, dz: number, ry: number): React.CSSProperties => {
    const p = inP(i);
    return { opacity: p, transform: `translate3d(${(1 - p) * dx}px, ${(1 - p) * dy + Math.sin((f + i * 20) / 30) * 6}px, ${dz - (1 - p) * 500}px) rotateY(${ry * (1 - p)}deg)` };
  };
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, #1C1836, ${C.ink} 75%)`, overflow: 'hidden' }}>
      <AbsoluteFill style={{ perspective: 1800 }}>
        <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `rotateY(${orbit}deg) rotateX(6deg) scale(${push})` }}>
          {/* transcript (centre, back) */}
          <div style={{ ...panel({ left: 470, top: 170, width: 980, height: 520 }), ...fly(0, 0, 200, -120, 0) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 26 }}>
              <LensMark size={46} ring={C.lime} bars={C.lime} />
              <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 32 }}>VaaniLens</span>
              <span style={{ marginLeft: 'auto', fontFamily: F.mono, fontSize: 16, color: C.ink, background: C.cream2, padding: '6px 10px', borderRadius: 8 }}>PROTOTYPE · DEMO DATA</span>
            </div>
            <Label style={{ fontSize: 16, marginBottom: 14 }}>Conversation · Hinglish · via Gnani Prisma</Label>
            {[['AGENT', 'Rahul ji, payment kab tak ho jayega?', C.mute], ['CUSTOMER', 'Sir, kal tak pakka payment kar dunga.', C.cream], ['AGENT', 'Theek hai, dhanyavaad.', C.mute]].map(([who, line, col], i) => (
              <div key={i} style={{ display: 'flex', gap: 22, padding: '18px 0', borderBottom: '1px solid #34314A', fontSize: 30 }}>
                <span style={{ fontFamily: F.mono, fontSize: 16, color: C.mute, width: 110, paddingTop: 8 }}>{who}</span>
                <span style={{ color: col as string, fontWeight: i === 1 ? 600 : 400 }}>
                  {i === 1 ? <>Sir, <span style={{ color: C.lime }}>kal tak</span> <span style={{ color: C.lime }}>pakka</span> payment <span style={{ color: C.lime }}>kar dunga</span>.</> : line}
                </span>
              </div>
            ))}
          </div>
          {/* commitment (left, front) */}
          <div style={{ ...panel({ left: 150, top: 300, width: 420, background: C.lime, color: C.ink, border: 'none' }), ...fly(1, -500, 0, 160, -30) }}>
            <Label color="#3E5200" style={{ fontSize: 16 }}>Commitment</Label>
            <div style={{ fontFamily: F.viral, fontSize: 64, lineHeight: 1, textTransform: 'uppercase', marginTop: 8 }}>Will pay</div>
            <div style={{ fontSize: 24, marginTop: 8 }}>Strength: high · “pakka”</div>
          </div>
          {/* deadline (right, front) */}
          <div style={{ ...panel({ left: 1280, top: 240, width: 400, background: C.cream, color: C.ink, border: 'none' }), ...fly(2, 500, 0, 200, 30) }}>
            <Label color="#5A5560" style={{ fontSize: 16 }}>Deadline</Label>
            <div style={{ fontFamily: F.viral, fontSize: 64, lineHeight: 1, textTransform: 'uppercase', marginTop: 8 }}>11 Nov</div>
            <div style={{ fontSize: 24, marginTop: 8 }}>“kal tak” → tomorrow</div>
          </div>
          {/* follow-up recommendation (bottom right, front) */}
          <div style={{ ...panel({ left: 1110, top: 640, width: 540, background: C.violet, border: 'none' }), ...fly(3, 300, 400, 260, 20) }}>
            <Label color="#D9D0FF" style={{ fontSize: 16 }}>Recommended follow-up</Label>
            <div style={{ fontSize: 34, fontWeight: 600, marginTop: 10 }}>Hindi voice reminder · 11 Nov, 10 AM</div>
            <div style={{ fontSize: 22, marginTop: 6, color: '#D9D0FF' }}>Voiced with Gnani Timbre</div>
          </div>
          {/* conversation intelligence (bottom left, front) */}
          <div style={{ ...panel({ left: 230, top: 690, width: 640 }), ...fly(4, -300, 400, 220, -20) }}>
            <Label style={{ fontSize: 16 }}>Conversation intelligence</Label>
            <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
              {['Code-mixed: EN + HI', 'Tone: cooperative', 'Needs: time of day'].map((c) => (
                <span key={c} style={{ border: '1px solid #4A4660', borderRadius: 999, padding: '10px 18px', fontSize: 24 }}>{c}</span>
              ))}
            </div>
          </div>
        </div>
      </AbsoluteFill>
      <Grain />
    </AbsoluteFill>
  );
};
