#!/usr/bin/env bash
set -euo pipefail

# Speechify TTS voice cloning with VERIFIED CONSENT (Bash + curl + jq).
# Lifecycle: consent challenge → record → create → use → delete.

cd "$(dirname "$0")"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

: "${SPEECHIFY_API_KEY:?Set SPEECHIFY_API_KEY (copy .env.example to .env).}"

BASE="https://api.speechify.ai"
# You provide two files of your OWN voice — the consent recording must be the
# same speaker as the sample (see README). Defaults: bundled sample + consent.wav.
SAMPLE="${SAMPLE_PATH:-fixtures/spacewalk.wav}"
CONSENT_RECORDING="${CONSENT_RECORDING:-consent.wav}"
SPEAKER_NAME="${SPEAKER_NAME:-Jane Doe}"

# 1. Mint a consent challenge (JSON). Idempotency-Key makes a retry safe.
challenge=$(curl --fail-with-body --silent --show-error \
  -X POST "${BASE}/v1/voices/consent-challenges" \
  -H "Authorization: Bearer ${SPEECHIFY_API_KEY}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d "$(jq -n --arg name "$SPEAKER_NAME" '{full_name: $name}')")

challenge_id=$(printf '%s' "$challenge" | jq -r '.id')
phrase=$(printf '%s' "$challenge" | jq -r '.phrase')
expires=$(printf '%s' "$challenge" | jq -r '.expires_at')

echo ""
echo "Consent challenge ${challenge_id} (expires ${expires})."
echo "Have the speaker read this phrase aloud, EXACTLY as written:"
echo ""
echo "    ${phrase}"
echo ""
echo "Save that recording to: ${CONSENT_RECORDING}"
echo "It must be the SAME speaker as the sample being cloned."
echo ""

# 2. Wait for the recording. (Skip the prompt in CI by pre-recording the file.)
if [ ! -f "$CONSENT_RECORDING" ]; then
  read -r -p "Press Enter once the consent recording is saved… " _
fi
if [ ! -f "$CONSENT_RECORDING" ]; then
  echo "Consent recording not found at ${CONSENT_RECORDING}." >&2
  exit 1
fi

# 3. Create the clone. POST /v1/voices is multipart/form-data — `curl -F` builds
#    the body and sets the boundary automatically.
create_body=$(mktemp)
trap 'rm -f "$create_body"' EXIT
http_status=$(curl --silent --show-error --output "$create_body" --write-out '%{http_code}' \
  -X POST "${BASE}/v1/voices" \
  -H "Authorization: Bearer ${SPEECHIFY_API_KEY}" \
  -H "Idempotency-Key: $(uuidgen)" \
  -F "name=cookbook-cloned-voice" \
  -F "gender=male" \
  -F "consent_challenge_id=${challenge_id}" \
  -F "sample=@${SAMPLE};type=audio/wav" \
  -F "consent_recording=@${CONSENT_RECORDING};type=audio/wav")

if [ "$http_status" = "402" ]; then
  echo "Voice cloning isn't included in your current Speechify plan: https://speechify.ai/pricing" >&2
  exit 1
fi
if [ "$http_status" -lt 200 ] || [ "$http_status" -ge 300 ]; then
  # Branch on the error CODE, not the status — several consent outcomes share 422.
  code=$(jq -r '.error.code // empty' < "$create_body")
  echo "POST /v1/voices → ${http_status} ${code:-}" >&2
  cat "$create_body" >&2
  echo >&2
  exit 1
fi

voice_id=$(jq -r '.id' < "$create_body")
display_name=$(jq -r '.display_name' < "$create_body")
voice_type=$(jq -r '.type' < "$create_body")
echo ""
echo "Cloned voice created: ${voice_id} (${display_name}, type=${voice_type})"

# Always delete the cloned voice, even if synthesis fails.
cleanup() {
  del_status=$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
    -X DELETE "${BASE}/v1/voices/${voice_id}" \
    -H "Authorization: Bearer ${SPEECHIFY_API_KEY}")
  if [ "$del_status" -ge 200 ] && [ "$del_status" -lt 300 ]; then
    echo "Deleted cloned voice ${voice_id}"
  else
    echo "DELETE /v1/voices/${voice_id} → ${del_status}" >&2
  fi
}
trap 'cleanup; rm -f "$create_body"' EXIT

# 4. Synthesize with the clone. Cloned voices are self-serve on simba-3.0.
speech_response=$(curl --fail-with-body --silent --show-error \
  -X POST "${BASE}/v1/audio/speech" \
  -H "Authorization: Bearer ${SPEECHIFY_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg vid "$voice_id" '{
    input: "Hello from a voice cloned with the Speechify API.",
    voice_id: $vid,
    audio_format: "mp3",
    model: "simba-3.0"
  }')")

printf '%s' "$speech_response" | jq -r '.audio_data' | base64 -d > output.mp3
echo "Wrote output.mp3"

# 5. Cleanup runs from the EXIT trap.
