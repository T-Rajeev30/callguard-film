import timing from './timing.json';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/800.css';
import '@fontsource/noto-sans-devanagari/600.css';
import '@fontsource/anton/400.css';
import '@fontsource/montserrat/800.css';
import '@fontsource/montserrat/900.css';
import '@fontsource/noto-sans-kannada/600.css';
import '@fontsource/noto-sans-tamil/600.css';

export const T = timing;
export const FPS = T.fps;
export const s = (sec: number) => Math.round(sec * FPS);
export const sceneFrom = (k: keyof typeof T.scenes) => s(T.scenes[k][0]);
export const sceneLen = (k: keyof typeof T.scenes) => s(T.scenes[k][1] - T.scenes[k][0]);

export const C = {
  ink: '#0B0B0F',
  ink2: '#16161D',
  line: '#2A2A35',
  cream: '#F2EDE3',
  cream2: '#E4DCCB',
  lime: '#C6FF1F',
  violet: '#5B2BFF',
  violetSoft: '#A996FF',
  mute: '#8A8796',
  red: '#FF5C5C',
};

export const F = {
  display: '"Inter Display", Inter, sans-serif',
  viral: 'Anton, "Inter Display", sans-serif',   // condensed, all-caps kinetic headlines
  caption: 'Montserrat, Inter, sans-serif',        // heavy word-by-word captions
  body: 'Inter, sans-serif',
  mono: '"DejaVu Sans Mono", monospace',
  indic: '"Noto Sans Devanagari", "Noto Sans Kannada", "Noto Sans Tamil", Inter, sans-serif',
};

// deterministic pseudo-random
export const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};
