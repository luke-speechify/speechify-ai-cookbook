# Speechify Text-to-Speech API

Reference for the TTS surface used across recipes. Authoritative docs:
<https://docs.speechify.ai>. When the installed SDK disagrees with this note, trust the
SDK and update recipes + this note.

## SDKs

| Language      | Package                                  | Version | Install                   |
| ------------- | ---------------------------------------- | ------- | ------------------------- |
| TypeScript/JS | `@speechify/api`                         | 4.x     | `pnpm add @speechify/api` |
| Python        | `speechify-api` (imports as `speechify`) | 4.x     | `uv add speechify-api`    |

Both SDKs read `SPEECHIFY_API_KEY` from the environment. The deprecated
`@speechify/api-sdk` package should not be used. TS pins the version via the pnpm
`catalog:`; Python pins `speechify-api>=4.0.0`.

## Client surface (v4)

| Call                               | TypeScript                                                      | Python                                         |
| ---------------------------------- | --------------------------------------------------------------- | ---------------------------------------------- |
| Synthesize (JSON + base64 + marks) | `client.audio.speech({ ... })`                                  | `client.audio.speech(...)`                     |
| Stream raw audio                   | `client.audio.stream({ Accept?, body: { ... } })`               | `client.audio.stream(...)`                     |
| Stream audio + speech marks (SSE)  | `client.audio.streamWithTimestamps({ Accept?, body: { ... } })` | `client.audio.stream_with_timestamps(...)`     |
| List models                        | `client.models.list()`                                          | `client.models.list()`                         |
| List voices (paginated)            | `client.voices.list({ ... })`                                   | `client.voices.list(...)`                      |
| Get a voice                        | `client.voices.get({ voice_id })`                               | `client.voices.get(voice_id=...)`              |
| Create a clone                     | `client.voices.create({ ... })`                                 | `client.voices.create(...)`                    |
| Delete a voice                     | `client.voices.delete({ voice_id })`                            | `client.voices.delete(voice_id)`               |
| Consent challenge                  | `client.voices.consentChallenges.create({ ... })`               | `client.voices.consent_challenges.create(...)` |

> **v4 breaking change:** `audio.stream` / `audio.streamWithTimestamps` nest the synthesis
> params under `body:` in TypeScript (v3 was flat). `audio.speech` stays flat. Python is flat
> for all three.

## Synthesize speech

**TypeScript**

```ts
import { SpeechifyClient } from "@speechify/api";
const client = new SpeechifyClient({ token: process.env.SPEECHIFY_API_KEY! });
const response = await client.audio.speech({
  input: "Hello! This is the Speechify text-to-speech API.",
  voice_id: "geffen_32",
  audio_format: "mp3",
  model: "simba-3.2",
});
import fs from "node:fs";
fs.writeFileSync("output.mp3", Buffer.from(response.audio_data, "base64")); // base64 → bytes
```

**Python**

```python
from speechify import Speechify
client = Speechify(token=token)
response = client.audio.speech(
    input="Hello! This is the Speechify text-to-speech API.",
    voice_id="geffen_32", audio_format="mp3", model="simba-3.2",
)
import base64
with open("output.mp3", "wb") as f:
    f.write(base64.b64decode(response.audio_data))
```

Fields are snake_case on the wire and in the SDKs (`voice_id`, `audio_format`, `audio_data`,
`speech_marks`, `output_format`).

## Parameters

| Param           | Notes                                                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `input`         | Text or SSML. Up to ~20,000 characters. Screened before synthesis (`400 content_policy_violation`, not billed).                           |
| `voice_id`      | A voice identifier, e.g. `geffen_32`. List with `client.voices.list()` / `GET /v1/voices`.                                                |
| `model`         | `simba-3.0` (default; multilingual — en + de-DE/es-ES/es-MX/fr-FR/it-IT/pt-BR) · `simba-3.2` (recommended, English-only, lowest latency). |
| `language`      | BCP-47 (e.g. `fr-FR`). Selects the training on `simba-3.0`; omit to use the voice's locale.                                               |
| `audio_format`  | `mp3`, `wav`, `ogg`, `aac`, `pcm`.                                                                                                        |
| `output_format` | `codec_sampleRate_bitrate` (e.g. `pcm_16000`, `ulaw_8000`, `mp3_24000_128`). Takes precedence over `audio_format`.                        |

> **Legacy models retired.** `simba-english` / `simba-multilingual` (Simba 1.6) are retired
> at API version `2026-09-21` (`400 model_retired`) and switched off 2026-11-21. Don't use them.

## Capabilities recipes cover

- **Synthesis** — quickstart, streaming, SSML controls, speech marks, multilingual, output formats.
- **Voice cloning (verified consent)** — mint a consent challenge (`consentChallenges.create`),
  have the speaker read the returned `phrase`, submit the recording as `consent_recording` with
  `consent_challenge_id` on `voices.create`. The old `consent` JSON field is deprecated; the
  verified flow is the `Speechify-Version: 2026-09-13` shape. Same speaker in sample + consent.
- **Voices & models** — `models.list`, `voices.list` (paginated), voice language/model support.
- **API essentials** — version pinning (`Speechify-Version` / `version:`), idempotency
  (`Idempotency-Key`), typed error handling, and audio watermark detect/verify (REST-only).

## REST surface

`https://api.speechify.ai` with `Authorization: Bearer <token>`:

- `POST /v1/audio/speech` — JSON + base64 `audio_data` + `speech_marks`.
- `POST /v1/audio/stream` — raw audio bytes (chunked); `Accept` selects codec.
- `POST /v1/audio/stream/with-timestamps` — SSE (`speech.chunk` / `speech.done` / `speech.error`).
- `GET /v1/audio/models` · `GET /v1/voices` (envelope: `{ voices, next_cursor, has_more }`).
- `POST /v1/voices` (multipart) · `DELETE /v1/voices/{id}` · `POST /v1/voices/consent-challenges`.
- `POST /v1/audio/watermark/detect` (API key, `{watermarked,confidence}`) · `/verify` (no key).

Pin `Speechify-Version: 2026-09-13` on raw HTTP; SDKs send their build-date version by default.
