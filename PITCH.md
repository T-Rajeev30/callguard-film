# VaaniLens: hear beyond the words

**Code-mixed call intelligence built on Gnani Prisma and Gnani Timbre.** *Great Indian AI Internship Challenge · hackathon prototype*

### The problem
In Indian collections and support calls, customers speak Hinglish over noisy phone lines: *"Sir, kal tak pakka payment kar dunga."* A transcript records the words. The business needs the meaning: **is that a real commitment, by when, and what happens next?** Today that judgement sits in an agent's memory. Promises slip, follow-ups are late, and confused customers get the same English explanation again.

### The solution
VaaniLens turns one call into actions in a few seconds:

1. **Hear: Gnani Prisma v3.0** (`/stt/v3`, `format=codemix`) transcribes Hinglish call audio. An optional **phone-line mode** (8 kHz, 300–3400 Hz band, line noise) tests it on telephone-quality audio.
2. **Understand: VaaniLens** extracts **COMMITMENT** (with strength: "pakka" means high, "try karunga" means low), **DEADLINE** (kal, parso and agle hafte resolved to real dates), **FOLLOW-UP**, and flags **CONFUSION** ("samajh nahi aaya") and **DISPUTE** ("pehle hi kar diya"). Every signal shows the exact words that triggered it. It works on both Latin and Devanagari output.
3. **Respond: Gnani Timbre v3.0** (`/api/v1/tts/inference`) speaks the follow-up reminder in Hindi (voice: Shivani).

### Who it's for
Agents, team leads and QA reviewers at Indian banks, NBFCs, fintechs and microfinance companies. The end beneficiaries are customers who think and speak in Hindi, Hinglish or their regional language.

### Why it matters
India has 121 languages (Census 2011), and code-switching mid-sentence is normal on calls. Open research (MUCS 2021, Gram Vaani 2022, Vistaar 2023) shows code-mixed, 8 kHz telephone speech is still hard for speech recognition. VaaniLens uses Gnani's models, which Gnani built for Indian phone audio, and adds the missing layer: meaning and next action.

### Built with
React + Remotion (the same animation code powers the launch film and the in-app "signals" view), a Vite server with API routes (the Gnani key stays server-side), and a rule-based signal extractor v0. **Synthetic data only:** the sample calls are generated with Gnani Timbre, and no real recordings or personal data are used.

### Honest status and next steps
A working prototype, not a production system. Next steps: an LLM extractor (e.g. Gnani Evon) in place of the v0 rules, Tamil, Kannada and Bengali code-mix rules, CRM write-back, and evaluation on a labelled synthetic call set.

**Repo:** `npm install` → put your key in `.env` → `npm run samples` → `npm run app` · Team: Rajeev Tiwari
