import base64
import os
import uuid

import requests
from dotenv import load_dotenv

# The "native" counterpart to the voice-cloning recipe: the verified-consent
# lifecycle (challenge → record → create → use → delete) over raw REST with
# `requests` + multipart form-data, instead of the speechify-api SDK.

BASE = "https://api.speechify.ai"

# You provide two files of your own voice — the consent recording must be the
# same speaker as the sample (see README).
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

    auth = {"Authorization": f"Bearer {token}"}

    # 1. Mint a consent challenge (JSON). Idempotency-Key makes a retry safe.
    ch_resp = requests.post(
        f"{BASE}/v1/voices/consent-challenges",
        headers={**auth, "Idempotency-Key": str(uuid.uuid4())},
        json={"full_name": SPEAKER_NAME},
        timeout=30,
    )
    ch_resp.raise_for_status()
    challenge = ch_resp.json()
    print(f"\nConsent challenge {challenge['id']} (expires {challenge['expires_at']}).")
    print("Have the speaker read this phrase aloud, EXACTLY as written:\n")
    print(f"    {challenge['phrase']}\n")
    print(f"Save that recording to: {CONSENT_RECORDING}")
    print("It must be the SAME speaker as the sample being cloned.\n")

    # 2. Wait for the recording. (Skip the prompt in CI by pre-recording the file.)
    if not os.path.exists(CONSENT_RECORDING):
        input("Press Enter once the consent recording is saved… ")
    if not os.path.exists(CONSENT_RECORDING):
        raise SystemExit(f"Consent recording not found at {CONSENT_RECORDING}.")

    # 3. Create the clone. POST /v1/voices is multipart/form-data — pass `files=`
    #    and requests sets the boundary automatically.
    with open(SAMPLE_PATH, "rb") as sample, open(CONSENT_RECORDING, "rb") as consent:
        create_resp = requests.post(
            f"{BASE}/v1/voices",
            headers={**auth, "Idempotency-Key": str(uuid.uuid4())},
            data={
                "name": "cookbook-cloned-voice",
                "gender": "male",
                "consent_challenge_id": challenge["id"],
            },
            files={
                "sample": (os.path.basename(SAMPLE_PATH), sample, "audio/wav"),
                "consent_recording": (os.path.basename(CONSENT_RECORDING), consent, "audio/wav"),
            },
            timeout=120,
        )
    if not create_resp.ok:
        raise consent_error(create_resp)
    voice = create_resp.json()
    print(f"\nCloned voice created: {voice['id']} ({voice['display_name']}, type={voice['type']})")

    try:
        # 4. Synthesize with the clone. Cloned voices are self-serve on simba-3.0.
        speech_resp = requests.post(
            f"{BASE}/v1/audio/speech",
            headers={**auth, "Content-Type": "application/json"},
            json={
                "input": "Hello from a voice cloned with the Speechify API.",
                "voice_id": voice["id"],
                "audio_format": "mp3",
                "model": "simba-3.0",
            },
            timeout=60,
        )
        speech_resp.raise_for_status()
        with open("output.mp3", "wb") as f:
            f.write(base64.b64decode(speech_resp.json()["audio_data"]))
        print("Wrote output.mp3")
    finally:
        # 5. Clean up so cloned voices don't accumulate.
        del_resp = requests.delete(f"{BASE}/v1/voices/{voice['id']}", headers=auth, timeout=30)
        print(f"Deleted cloned voice {voice['id']}" if del_resp.ok else f"DELETE failed → {del_resp.status_code}")


def consent_error(resp: requests.Response) -> SystemExit:
    if resp.status_code == 402:
        return SystemExit(
            "Voice cloning isn't included in your current Speechify plan: https://speechify.ai/pricing"
        )
    code = None
    try:
        code = (resp.json().get("error") or {}).get("code")
    except ValueError:
        pass
    return SystemExit(
        f"{code}: {CONSENT_HINTS[code]}" if code in CONSENT_HINTS else f"POST /v1/voices → {resp.status_code}: {resp.text}"
    )


if __name__ == "__main__":
    main()
