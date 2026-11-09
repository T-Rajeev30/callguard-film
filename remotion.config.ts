import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setCodec('h264');

// Use a specific Chromium build for rendering (setup-gpu.ps1 installs one into .browsers/ and writes CHROMIUM_PATH).
const chromium = process.env.CHROMIUM_PATH || process.env.REMOTION_BROWSER;
if (chromium) Config.setBrowserExecutable(chromium);

if (process.env.REMOTION_GPU === '1') {
  // NVIDIA GPU: Chromium paints through ANGLE (Direct3D 11 on Windows) and frames are encoded with NVENC (h264_nvenc).
  Config.setChromiumOpenGlRenderer(process.platform === 'win32' ? 'angle' : 'angle-egl');
  Config.setHardwareAcceleration('if-possible'); // falls back to libx264 if NVENC is unavailable
  Config.setVideoBitrate('16M');                 // CRF is not supported by NVENC in Remotion, so use a bitrate
} else {
  Config.setCrf(18);
  Config.setX264Preset('veryfast');
}
