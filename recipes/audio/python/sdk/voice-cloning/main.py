import base64
import os
import uuid

from dotenv import load_dotenv
from speechify import Speechify
from speechify.core.api_error import ApiError

# Voice cloning now requires VERIFIED CONSENT: the speaker records themselves
# reading a phrase the API issues, and that recording must be the same speaker
# as the voice sample. So this recipe cannot ship a canned consent clip — you
# provide two files of your own voice:
#   SAMPLE_PATH        — 10-30s of clean speech to clone (the voice).
#   CONSENT_RECORDING  — you reading the phrase printed below, same speaker.
SAMPLE_PATH = os.environ.get(
    "SAMPLE_PATH", os.path.join(os.path.dirname(__file__), "fixtures", "spacewalk.wav")
)
CONSENT_RECORDING = os.environ.get("CONSENT_RECORDING", "consent.wav")
SPEAKER_NAME = os.environ.get("SPEAKER_NAME", "Jane Doe")

# Branch on the error CODE, not the HTTP status — several outcomes share 422.
CONSENT_HINTS = {
    "consent_phrase_mismatch": "The phrase was misread. Record it again, word for word.",
    "consent_speaker_mismatch": "The consent recording is a different speaker from the sample. The person consenting must be the person being cloned.",
    "consent_recording_unusable": "The recording was silent, too short, or unreadable. Record it again.",
    "consent_challenge_not_found": "The challenge id did not resolve. Mint a new challenge.",
    "consent_challenge_expired": "The challenge expired. Mint a new one and record again.",
    "consent_challenge_already_used": "A challenge is single-use. Mint a fresh one.",
    "consent_verification_unavailable": "Verification backend is down. Retry the same recording shortly.",
}


def main() -> None:
    load_dotenv()

    token = os.environ.get("SPEECHIFY_API_KEY")
    if not token:
        raise SystemExit("Set SPEECHIFY_API_KEY (copy .env.example to .env).")

    client = Speechify(token=token)

    # 1. Mint a consent challenge — a phrase to read and a short-lived, single-use
    #    id. Create it only when the speaker is ready to record.
    challenge = client.voices.consent_challenges.create(
        idempotency_key=str(uuid.uuid4()),
        full_name=SPEAKER_NAME,
    )
    print(f"\nConsent challenge {challenge.id} (expires {challenge.expires_at}).")
    print("Have the speaker read this phrase aloud, EXACTLY as written:\n")
    print(f"    {challenge.phrase}\n")
    print(f"Save that recording to: {CONSENT_RECORDING}")
    print("It must be the SAME speaker as the sample being cloned.\n")

    # 2. Wait for the recording. (Skip the prompt in CI by pre-recording the file.)
    if not os.path.exists(CONSENT_RECORDING):
        input("Press Enter once the consent recording is saved… ")
    if not os.path.exists(CONSENT_RECORDING):
        raise SystemExit(f"Consent recording not found at {CONSENT_RECORDING}.")

    # 3. Create the clone. Send the sample, the consent recording, and the
    #    challenge id together. An idempotency_key makes a retry safe.
    try:
        with open(SAMPLE_PATH, "rb") as sample, open(CONSENT_RECORDING, "rb") as consent:
            voice = client.voices.create(
                idempotency_key=str(uuid.uuid4()),
                name="cookbook-cloned-voice",
                gender="male",
                sample=sample,
                consent_recording=consent,
                consent_challenge_id=challenge.id,
            )
    except ApiError as err:
        raise consent_error(err)
    print(f"\nCloned voice created: {voice.id} ({voice.display_name}, type={voice.type})")

    try:
        # 4. Synthesize with the clone. Cloned voices are self-serve on simba-3.0.
        speech = client.audio.speech(
            input="Hello from a voice cloned with the Speechify API.",
            voice_id=voice.id,
            audio_format="mp3",
            model="simba-3.0",
        )
        with open("output.mp3", "wb") as f:
            f.write(base64.b64decode(speech.audio_data))
        print("Wrote output.mp3")
    finally:
        # 5. Clean up so cloned voices don't accumulate. Remove to keep the voice.
        client.voices.delete(voice.id)
        print(f"Deleted cloned voice {voice.id}")


def consent_error(err: ApiError) -> SystemExit:
    if err.status_code == 402:
        return SystemExit(
            "Voice cloning isn't included in your current Speechify plan: https://speechify.ai/pricing"
        )
    code = None
    if isinstance(err.body, dict):
        code = (err.body.get("error") or {}).get("code")
    return SystemExit(f"{code}: {CONSENT_HINTS[code]}" if code in CONSENT_HINTS else f"Voice create failed: {err}")


if __name__ == "__main__":
    main()
