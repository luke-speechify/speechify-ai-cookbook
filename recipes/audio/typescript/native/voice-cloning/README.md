# Text-to-Speech: voice cloning with verified consent (TypeScript, native REST)

The native counterpart to the [SDK recipe](../../sdk/voice-cloning) — the same
challenge → record → create → use → delete lifecycle over raw REST with `fetch` and
multipart form-data.

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

1. `POST /v1/voices/consent-challenges` with `{ full_name }` → a **phrase** and single-use **id**.
2. Record the speaker reading the phrase aloud; save it (default `consent.wav`).
3. `POST /v1/voices` (multipart) with `sample`, `consent_recording`, `consent_challenge_id`.

**The consent recording must be the same speaker as the sample.** The bundled
`fixtures/spacewalk.wav` is a different speaker — set `SAMPLE_PATH` to your own voice for a
verifiable clone. A mismatch returns `422 consent_speaker_mismatch`, which the recipe explains.

## Run

```bash
pnpm start
```

## What it does

- `POST /v1/voices/consent-challenges` → phrase + id; `Idempotency-Key` header makes retries safe.
- `POST /v1/voices` multipart: `name`, `gender`, `sample`, `consent_recording`, `consent_challenge_id`.
- `POST /v1/audio/speech` with the clone's `voice_id` on `simba-3.0`.
- `DELETE /v1/voices/{voice_id}` to clean up.
- Branches on the error **code** in the JSON body, not the HTTP status.

> The old `consent` JSON field is deprecated; the verified flow is the
> `Speechify-Version: 2026-09-13` shape. Reference: https://docs.speechify.ai/build/voice-cloning-api
