# VaaniLens — Hear beyond the words

**Code-mixed call intelligence on Gnani Prisma + Gnani Timbre.** Great Indian AI Internship Challenge entry · one-page pitch: [PITCH.md](PITCH.md) / [PITCH.pdf](PITCH.pdf)

## Run the app (Windows PowerShell)

```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1     # once
Copy-Item .env.example .env ; notepad .env              # paste GNANI_API_KEY
npm run samples                                         # 4 synthetic calls, voiced by Gnani Timbre
npm run app                                             # opens http://localhost:5173
```

Pipeline: browser audio (sample / mic / upload, optional **phone-line mode** 8 kHz + noise) → **Gnani Prisma v3.0** `codemix` → **VaaniLens signals** (commitment, deadline, follow-up, confusion, dispute, each with its evidence words) → Remotion Player replays the transcript turning into those signals → **Gnani Timbre v3.0** speaks the Hindi follow-up.
If no key is present the app runs in a clearly bannered MOCK mode. Never record a demo in mock mode.

## Demo videos from your screen recording

```powershell
.\render-demo.ps1 -Recording "$HOME\Videos\Captures\<your recording>.mp4"
# → out\vaanilens-demo-60s.mp4 (post) and out\vaanilens-demo-full.mp4 (form, 2–3 min)
```

---

# VAANILENS — "The Call That Changed Meaning"

*Hear beyond the words.* A 46-second cinematic launch film for the Gnani AI hackathon, rendered on **your** laptop.

| Output | Size | Use |
|---|---|---|
| `out/callguard-film-16x9.mp4` | 1920×1080 · 30 fps · H.264 | LinkedIn (cinematic brand-film format), YouTube, demo day |
| `out/callguard-film-4x5.mp4` | 1080×1350 · 30 fps · H.264 | Phone-first feed cut: headline band and big captions |

## Windows (PowerShell)

```powershell
Expand-Archive -Path "$HOME\Downloads\vaanilens-film.zip" -DestinationPath "$HOME\vaanilens" -Force
Set-Location "$HOME\vaanilens\callguard-film"
powershell -ExecutionPolicy Bypass -File .\setup.ps1          # one time

Copy-Item .env.example .env ; notepad .env                     # paste GNANI_API_KEY, save
powershell -ExecutionPolicy Bypass -File .\render.ps1 -Voice   # Gnani voices + Prisma transcript + render
# preview instead of render:   .\render.ps1 -Studio
```

## How Gnani is used (real, not mocked)

1. **Timbre v3.0** voices the customer line (`Shubham`, hi-IN), the Hindi follow-up reminder (`Shivani`), and the narrator (`Avinash`, en-IN).
2. **Prisma v3.0** (`format=codemix`) transcribes the customer audio. Its raw output and detected language are written to `src/audio/prisma.json` and shown on screen in the Prisma scene.
3. Without a key, the film still renders: those spots are labelled *illustrative*.

Keys stay in `.env` (git-ignored) and are read only by `scripts/voice.ts` on your machine.

## Story (46s)

| Time | Scene | What the viewer sees |
|---|---|---|
| 0–3s | Call | Incoming call; "SIR, KAL TAK PAKKA PAYMENT KAR DUNGA." lands word by word |
| 3–8s | Freeze | Tape-stop and silence; KAL fills the frame and becomes a deadline on a timeline |
| 8–14s | Shatter | Seven words become seven 3D objects; the meaningful ones light up |
| 14–21s | Gnani Prisma | Live transcript assembles over the waveform, each word tagged EN or HI |
| 21–29s | **Wow** | The transcript detonates into particles that re-form as COMMITMENT · DEADLINE · FOLLOW-UP |
| 29–35s | Gnani Timbre | The Hindi reminder is generated as a waveform, with Devanagari typing in |
| 35–41s | Reveal | Floating VaaniLens panels: transcript, commitment, deadline, follow-up, intelligence |
| 41–46s | Lockup | Electric lime · VAANILENS · HEAR BEYOND THE WORDS. (held about 4s) |

Brief note: the original line "Sir, kal tak payment kar dunga" is **6** words. The film uses "Sir, kal tak **pakka** payment kar dunga" (7 words, and "pakka" adds a real commitment signal) so "7 WORDS" is true.

## Sound

Recorded CC0 foley (Sonic Pi / freesound), FluidR3 instrument samples (CC BY 3.0), and a mix and master in Spotify Pedalboard. Real silences at 3.2s, 21.2s and 40.6s. Credits are in `assets/CREDITS.md`. Add this line to the post comments or description: *"Instrument samples: FluidR3_GM by Frank Wen (CC BY 3.0)"*.

## Before posting

- The film says "Hackathon prototype · Simulated call". Keep that, and don't present VaaniLens as production-ready.
- Remotion licence: free for individuals and teams of up to 3 (remotion.dev/license)
