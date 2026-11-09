import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { C, F, T, s, sceneFrom, rand } from '../theme';
import { clamp, ease, Grain } from '../components';
import { Label } from './shared';
import manifest from '../audio/manifest.json';
import voiceTiming from '../audio/voice-timing.json';

/** 29–35s. Gnani Timbre speaks the follow-up, in Hindi. The waveform is generated in front of you. */
export const Timbre: React.FC = () => {
  const f = useCurrentFrame();
  const v = T.voice.find((x) => x.id === 'd2_timbre')!;
  const start = s(v.at) - sceneFrom('timbre');
  const dur = (voiceTiming as Record<string, number>)['d2_timbre'] ?? 4.2;
  const gen = interpolate(f, [start, start + s(dur)], [0, 1], clamp);
  const real = Boolean((manifest as Record<string, string>)['d2_timbre']);
  const enter = interpolate(f, [0, 14], [0, 1], { ...clamp, easing: ease });
  const N = 120;
  const deva = T.replyDeva;
  const dw = deva.split(' ');
  const shownDeva = dw.slice(0, Math.ceil(dw.length * gen)).join(' ');

  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 50%, #241452, ${C.ink} 75%)`, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 80, left: 120, opacity: enter }}>
        <Label color={C.violetSoft}>Step 3 · Respond</Label>
        <div style={{ fontFamily: F.viral, fontSize: 110, lineHeight: 1, color: C.cream, textTransform: 'uppercase' }}>Gnani Timbre</div>
        <div style={{ fontFamily: F.body, fontSize: 30, color: C.violetSoft, marginTop: 6 }}>Text → a natural voice, in his language</div>
      </div>
      <div style={{ position: 'absolute', top: 96, right: 120, opacity: enter, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
        <div style={{ background: C.lime, color: C.ink, borderRadius: 18, padding: '14px 22px', fontFamily: F.body, fontWeight: 600, fontSize: 28 }}>Follow-up · Reminder · 11 Nov, 10 AM</div>
        <Label color={C.cream} style={{ fontSize: 18 }}>hi-IN · {real ? 'generated with Gnani Timbre' : 'illustrative voice'}</Label>
      </div>

      {/* waveform generated bar by bar, mirrored */}
      <div style={{ position: 'absolute', left: 120, right: 120, top: 400, height: 260, display: 'flex', alignItems: 'center', gap: 5 }}>
        {Array.from({ length: N }).map((_, i) => {
          const on = i / N < gen;
          const h = (0.15 + 0.85 * rand(i * 3.7) * (0.6 + 0.4 * Math.sin(i / 5))) * 240;
          const live = on ? 0.75 + 0.25 * Math.sin(f * 0.5 + i) : 0.05;
          return <div key={i} style={{ flex: 1, height: Math.max(4, h * live), borderRadius: 6, background: on ? C.violet : '#2A2440', boxShadow: on ? '0 0 16px rgba(91,43,255,0.6)' : 'none' }} />;
        })}
      </div>

      <div style={{ position: 'absolute', left: 120, right: 120, top: 720, textAlign: 'center' }}>
        <div style={{ fontFamily: F.indic, fontWeight: 600, fontSize: 64, color: C.cream, minHeight: 90 }}>{shownDeva}</div>
        <div style={{ fontFamily: F.body, fontSize: 30, color: C.mute, marginTop: 14, opacity: gen > 0.05 ? 1 : 0 }}>“{T.reply}”</div>
      </div>
      <Grain />
    </AbsoluteFill>
  );
};
