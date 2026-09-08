# Text-to-Speech: voice cloning with verified consent (Bash, native REST)

The same challenge → record → create → use → delete lifecycle as the
[TypeScript](../../../typescript/native/voice-cloning) and
[Python](../../../python/native/voice-cloning) native recipes, as a self-contained shell
script using `curl` + `jq`.

## Prerequisites

- A Speechify API key — https://platform.speechify.ai/api-keys
- **Voice cloning enabled on your plan** (the create returns `402` otherwise)
- `bash`, `curl`, `jq`, `base64`, and `uuidgen`

## Setup

```bash
cp .env.example .env   # then paste your SPEECHIFY_API_KEY
chmod +x voice-cloning.sh
```

## Verified consent — you record two clips

1. `POST /v1/voices/consent-challenges` with `{ full_name }` → a **phrase** and single-use **id**.
2. Record the speaker reading the phrase aloud; save it (default `consent.wav`).
3. `POST /v1/voices` (multipart) with `sample`, `consent_recording`, `consent_challenge_id`.

**The consent recording must be the same speaker as the sample.** The bundled
`fixtures/spacewalk.wav` is a different speaker — set `SAMPLE_PATH` to your own voice for a
verifiable clone. A mismatch returns `422 consent_speaker_mismatch`.

## Run

```bash
./voice-cloning.sh
```

## What it does

- `POST /v1/voices/consent-challenges` (`-H "Idempotency-Key: $(uuidgen)"`) → phrase + id.
- `POST /v1/voices` with `curl -F` multipart: `sample`, `consent_recording`, `consent_challenge_id`.
- `POST /v1/audio/speech` with the clone's `voice_id` on `simba-3.0`.
- `DELETE /v1/voices/{voice_id}` from an `EXIT` trap, so cleanup runs even on failure.
- Reads `.error.code` from the body on failure — several consent outcomes share HTTP 422.

> The old `consent` JSON field is deprecated; the verified flow is the
> `Speechify-Version: 2026-09-13` shape. Reference: https://docs.speechify.ai/build/voice-cloning-api
