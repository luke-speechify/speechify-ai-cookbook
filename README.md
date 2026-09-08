# Speechify Cookbook

Focused, runnable recipes for the Speechify
[Text-to-Speech](https://docs.speechify.ai/tts) API.

Each recipe is small, self-contained, and does one thing — copy a folder, add your API
key, and run it.

## Quick start

```bash
# 1. Get an API key: https://platform.speechify.ai/api-keys
# 2. Pick a recipe below and follow its README.
```

The fastest path:

```bash
cd recipes/audio/typescript/sdk/quickstart
cp .env.example .env        # paste your SPEECHIFY_API_KEY
pnpm install && pnpm start  # writes output.mp3
```

## Recipes

Recipes are organized by **product → language → flavor → recipe**:

```
recipes/<product>/<language>/{sdk,native}/<recipe>/
```

- **SDK** — uses an official Speechify SDK for that language.
- **Native** — calls the REST API directly (no SDK), e.g. `fetch` in TS, `requests` in Python, `curl` in Bash.

Every recipe below exists in each **flavor** shown. All recipes target the **v4 SDKs**
(`@speechify/api` 4.x, `speechify-api` 4.x) and the current REST surface.

### Audio — TypeScript

| Recipe                                                                                            | Flavor       | Description                                                       |
| ------------------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------- |
| [quickstart](./recipes/audio/typescript/sdk/quickstart)                                           | SDK / Native | Synthesize speech to an MP3 file.                                 |
| [streaming](./recipes/audio/typescript/sdk/streaming)                                             | SDK / Native | Stream audio to disk as it is generated.                          |
| [ssml-emotion](./recipes/audio/typescript/sdk/ssml-emotion)                                       | SDK / Native | Control emotion, pitch, rate, pauses & emphasis via SSML.         |
| [speech-marks](./recipes/audio/typescript/sdk/speech-marks)                                       | SDK / Native | Word-level timestamps → WebVTT captions.                          |
| [multilingual](./recipes/audio/typescript/sdk/multilingual)                                       | SDK / Native | Non-English synthesis with `simba-3.0` + the `language` param.    |
| [output-formats](./recipes/audio/typescript/sdk/output-formats)                                   | SDK / Native | Pick codec/sample-rate/bitrate — telephony `ulaw_8000`, mp3, pcm. |
| [voice-cloning](./recipes/audio/typescript/sdk/voice-cloning)                                     | SDK / Native | Verified-consent clone → synthesize → delete lifecycle.           |
| [list-models](./recipes/audio/typescript/sdk/list-models)                                         | SDK / Native | List TTS models to drive a picker.                                |
| [list-voices](./recipes/audio/typescript/sdk/list-voices)                                         | SDK / Native | List available voices, with pagination.                           |
| [voice-language-model-support](./recipes/audio/typescript/sdk/voice-language-model-support)       | SDK / Native | Which model + language combos a voice supports.                   |
| [version-pinning-and-idempotency](./recipes/audio/typescript/sdk/version-pinning-and-idempotency) | SDK / Native | Pin `Speechify-Version`; safe retries with `Idempotency-Key`.     |
| [error-handling](./recipes/audio/typescript/sdk/error-handling)                                   | SDK / Native | Typed errors, error codes, `Retry-After`, request ids.            |
| [watermark](./recipes/audio/typescript/native/watermark)                                          | Native       | Detect/verify the Speechify audio watermark (REST-only).          |

### Audio — Python

| Recipe                                                                                        | Flavor       | Description                                                       |
| --------------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------- |
| [quickstart](./recipes/audio/python/sdk/quickstart)                                           | SDK / Native | Synthesize speech to an MP3 file.                                 |
| [streaming](./recipes/audio/python/sdk/streaming)                                             | SDK / Native | Stream audio to disk as it is generated.                          |
| [ssml-emotion](./recipes/audio/python/sdk/ssml-emotion)                                       | SDK / Native | Control emotion, pitch, rate, pauses & emphasis via SSML.         |
| [speech-marks](./recipes/audio/python/sdk/speech-marks)                                       | SDK / Native | Word-level timestamps → WebVTT captions.                          |
| [multilingual](./recipes/audio/python/sdk/multilingual)                                       | SDK / Native | Non-English synthesis with `simba-3.0` + the `language` param.    |
| [output-formats](./recipes/audio/python/sdk/output-formats)                                   | SDK / Native | Pick codec/sample-rate/bitrate — telephony `ulaw_8000`, mp3, pcm. |
| [voice-cloning](./recipes/audio/python/sdk/voice-cloning)                                     | SDK / Native | Verified-consent clone → synthesize → delete lifecycle.           |
| [list-models](./recipes/audio/python/sdk/list-models)                                         | SDK / Native | List TTS models to drive a picker.                                |
| [list-voices](./recipes/audio/python/sdk/list-voices)                                         | SDK / Native | List available voices, with pagination.                           |
| [voice-language-model-support](./recipes/audio/python/sdk/voice-language-model-support)       | SDK / Native | Which model + language combos a voice supports.                   |
| [version-pinning-and-idempotency](./recipes/audio/python/sdk/version-pinning-and-idempotency) | SDK / Native | Pin `Speechify-Version`; safe retries with `Idempotency-Key`.     |
| [error-handling](./recipes/audio/python/sdk/error-handling)                                   | SDK / Native | Typed errors, error codes, `Retry-After`, request ids.            |
| [watermark](./recipes/audio/python/native/watermark)                                          | Native       | Detect/verify the Speechify audio watermark (REST-only).          |

### Audio — Bash (curl)

| Recipe                                                                                         | Flavor | Description                                                        |
| ---------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------ |
| [quickstart](./recipes/audio/bash/native/quickstart)                                           | Native | Synthesize speech to an MP3 file with `curl` + `jq`.               |
| [streaming](./recipes/audio/bash/native/streaming)                                             | Native | Stream raw audio bytes straight to disk with `curl --no-buffer`.   |
| [ssml-emotion](./recipes/audio/bash/native/ssml-emotion)                                       | Native | SSML emotion/prosody via a single `curl` call.                     |
| [speech-marks](./recipes/audio/bash/native/speech-marks)                                       | Native | Speech marks → WebVTT captions, formatted in `jq`.                 |
| [multilingual](./recipes/audio/bash/native/multilingual)                                       | Native | Non-English synthesis with `simba-3.0` + the `language` param.     |
| [output-formats](./recipes/audio/bash/native/output-formats)                                   | Native | Pick codec/sample-rate/bitrate — telephony `ulaw_8000`, mp3, pcm.  |
| [voice-cloning](./recipes/audio/bash/native/voice-cloning)                                     | Native | Verified-consent clone → synthesize → delete, `EXIT`-trap cleanup. |
| [list-models](./recipes/audio/bash/native/list-models)                                         | Native | List TTS models to drive a picker.                                 |
| [list-voices](./recipes/audio/bash/native/list-voices)                                         | Native | List available voices, with pagination.                            |
| [voice-language-model-support](./recipes/audio/bash/native/voice-language-model-support)       | Native | Which model + language combos a voice supports.                    |
| [version-pinning-and-idempotency](./recipes/audio/bash/native/version-pinning-and-idempotency) | Native | Pin `Speechify-Version`; safe retries with `Idempotency-Key`.      |
| [error-handling](./recipes/audio/bash/native/error-handling)                                   | Native | Error envelope, error codes, `Retry-After`, request ids.           |
| [watermark](./recipes/audio/bash/native/watermark)                                             | Native | Detect/verify the Speechify audio watermark.                       |

## Repository layout

```
recipes/audio/<language>/{sdk,native}/<recipe>/
```

- `audio/` — Text-to-Speech today; the audio platform will expand.
- `<language>` — `typescript`, `python`, and `bash` (curl-only, native flavor).
- `sdk` — uses the official Speechify SDK for that language.
- `native` — calls the REST API directly (no SDK).

This is a **pnpm workspace** monorepo. TypeScript/JavaScript recipes are workspace members
(shared dependency versions via the pnpm `catalog:`); Python recipes use **uv** and are
managed per-recipe.

| Path         | What                                                                      |
| ------------ | ------------------------------------------------------------------------- |
| `recipes/`   | The recipes themselves.                                                   |
| `templates/` | Copy-to-start scaffolds for new recipes.                                  |
| `agents/`    | Modular maintenance/usage instructions, loaded on demand via `AGENTS.md`. |
| `AGENTS.md`  | Entry point for AI agents and contributors.                               |

## Tooling

- **Node 20+** and **pnpm** for JavaScript/TypeScript recipes.
- **Python 3.10+** and **[uv](https://docs.astral.sh/uv/)** for Python recipes.
- `pnpm install` at the root sets up all JS recipes.
- `pnpm format` formats the repo with Prettier.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) and
[`agents/creating-a-recipe.md`](./agents/creating-a-recipe.md). New recipes start from
`templates/`.

## License

[MIT](./LICENSE)
