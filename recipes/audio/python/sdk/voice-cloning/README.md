# Text-to-Speech: voice cloning with verified consent (Python, SDK)

Clone a voice, synthesize with it, then delete it — the full challenge → record → create →
use → delete lifecycle using the `speechify-api` SDK.

## Prerequisites

- A Speechify API key — https://platform.speechify.ai/api-keys
- **Voice cloning enabled on your plan** (the create returns `402` otherwise)
- Python 3.10+ and [uv](https://docs.astral.sh/uv/)

## Setup

```bash
cp .env.example .env   # then paste your SPEECHIFY_API_KEY
uv sync
```

## Verified consent — you record two clips

1. `client.voices.consent_challenges.create(full_name=...)` → a **phrase** and single-use **id**.
2. Record the speaker reading the phrase aloud; save it (default `consent.wav`).
3. `client.voices.create(sample=, consent_recording=, consent_challenge_id=, idempotency_key=)`.

**The consent recording must be the same speaker as the sample.** The bundled
`fixtures/spacewalk.wav` is a different speaker — set `SAMPLE_PATH` to your own voice for a
verifiable clone. A mismatch returns `422 consent_speaker_mismatch`, which the recipe explains.

## Run

```bash
uv run main.py
```

## What it does

- Mints a consent challenge, prints the phrase, waits for `consent.wav`.
- `client.voices.create(...)` with the sample, consent recording, and challenge id.
- `client.audio.speech(...)` with the clone's id on `simba-3.0` (clones are self-serve there).
- `client.voices.delete(voice_id)` to clean up.
- Branches on the consent error **code** (`err.body["error"]["code"]`), not the HTTP status.

> The old `consent` JSON field is deprecated; the verified flow is the
> `Speechify-Version: 2026-09-13` shape, which the v4 SDK sends by default.
> Reference: https://docs.speechify.ai/build/voice-cloning-api
