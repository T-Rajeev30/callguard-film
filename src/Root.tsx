import React from 'react';
import { Composition } from 'remotion';
import { CallGuardFilm, CallGuardFeed } from './CallGuardFilm';
import { DemoCut, demoMetadata } from './DemoCut';
import { LaunchCut, launchMetadata } from './LaunchCut';
import { T } from './theme';

export const Root: React.FC = () => (
  <>
    <Composition id="CallGuardFilm" component={CallGuardFilm} durationInFrames={T.duration * T.fps} fps={T.fps} width={1920} height={1080} />
    <Composition id="CallGuardFeed" component={CallGuardFeed} durationInFrames={T.duration * T.fps} fps={T.fps} width={1080} height={1350} />
    {/* 60 s post cut and 2â€“3 min submission cut, both built from public/demo/app-recording.mp4 */}
    <Composition id="DemoShort" component={DemoCut} calculateMetadata={demoMetadata} durationInFrames={1800} fps={30} width={1920} height={1080}
      defaultProps={{ recSeconds: 45, startAt: 0, maxSeconds: 45 }} />
    <Composition id="DemoLong" component={DemoCut} calculateMetadata={demoMetadata} durationInFrames={4500} fps={30} width={1920} height={1080}
      defaultProps={{ recSeconds: 150, startAt: 0, maxSeconds: 160 }} />
      <Composition id="LaunchCut" component={LaunchCut} calculateMetadata={launchMetadata} durationInFrames={1800} fps={30} width={1920} height={1080} defaultProps={{ appStart: -1 }} />
  </>
);
