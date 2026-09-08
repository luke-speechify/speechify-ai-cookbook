# Text-to-Speech: voice cloning with verified consent (TypeScript, SDK)

Clone a voice from an audio sample, synthesize with the clone, then delete it — the full
challenge → record → create → use → delete lifecycle using `@speechify/api`.

## Prerequisites

- A Speechify API key — https://platform.speechify.ai/api-keys
- **Voice cloning enabled on your plan** (the create returns `402` otherwise)
- Node 20+

## Setup

```bash
cp .env.example .env   # then paste your SPEECHIFY_API_KEY
pnpm install
```

## Verified consent — you record two clips

Cloning requires proof the speaker agreed. The recipe:

1. `client.voices.consentChallenges.create({ full_name })` → a **phrase** and a short-lived, single-use **id**.
2. Prints the phrase and waits. Record the speaker reading it aloud, exactly, and save it (default `consent.wav`).
3. `client.voices.create({ sample, consent_recording, consent_challenge_id, "Idempotency-Key" })`.

**The consent recording must be the same speaker as the sample.** The bundled
`fixtures/spacewalk.wav` (NASA, public domain) is a _different_ speaker, so a real,
verifiable clone means pointing `SAMPLE_PATH` at your own voice and recording the consent
clip yourself. With a mismatched pair the API returns `422 consent_speaker_mismatch` — the
recipe catches it and explains.

## Run

```bash
pnpm start
```

## What it does

- Mints a consent challenge, prints the phrase, waits for `consent.wav`.
- `client.voices.create(...)` with the sample, the consent recording, and the challenge id.
- `client.audio.speech(...)` with the clone's id on `simba-3.0` (clones are self-serve there).
- `client.voices.delete({ voice_id })` to clean up.
- Branches on the consent error **code** (not HTTP status — `consent_phrase_mismatch`,
  `consent_speaker_mismatch`, `consent_recording_unusable`, `consent_challenge_expired`, … all
  share status codes).

> The old `consent` JSON field is deprecated and switched off after a short window; the
> verified flow is the `Speechify-Version: 2026-09-13` shape, which the v4 SDK sends by default.
> Voice cloning reference: https://docs.speechify.ai/build/voice-cloning-api
