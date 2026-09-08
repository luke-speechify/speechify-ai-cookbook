import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import readline from "node:readline/promises";

// The "native" counterpart to the voice-cloning recipe: the verified-consent
// lifecycle (challenge → record → create → use → delete) over raw REST with
// fetch + multipart form-data, instead of the @speechify/api SDK.

const token = process.env.SPEECHIFY_API_KEY;
if (!token) {
  throw new Error("Set SPEECHIFY_API_KEY (copy .env.example to .env).");
}

const BASE = "https://api.speechify.ai";
const auth = { Authorization: `Bearer ${token}` };

// You provide two files of your own voice — the consent recording must be the
// same speaker as the sample (see README).
const SAMPLE = process.env.SAMPLE_PATH
  ? path.resolve(process.env.SAMPLE_PATH)
  : path.resolve(import.meta.dirname, "../fixtures/spacewalk.wav");
const CONSENT_RECORDING = path.resolve(process.env.CONSENT_RECORDING ?? "consent.wav");
const SPEAKER_NAME = process.env.SPEAKER_NAME ?? "Jane Doe";

interface Challenge {
  id: string;
  phrase: string;
  expires_at: string;
}
interface CreatedVoice {
  id: string;
  display_name: string;
  type: string;
}
interface SpeechResponse {
  audio_data: string;
  billable_characters_count: number;
}

async function main() {
  // 1. Mint a consent challenge (JSON). Idempotency-Key makes a retry safe.
  const challengeRes = await fetch(`${BASE}/v1/voices/consent-challenges`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
    body: JSON.stringify({ full_name: SPEAKER_NAME }),
  });
  if (!challengeRes.ok) {
    throw new Error(
      `POST /v1/voices/consent-challenges → ${challengeRes.status}: ${await challengeRes.text()}`,
    );
  }
  const challenge = (await challengeRes.json()) as Challenge;
  console.log(`\nConsent challenge ${challenge.id} (expires ${challenge.expires_at}).`);
  console.log("Have the speaker read this phrase aloud, EXACTLY as written:\n");
  console.log(`    ${challenge.phrase}\n`);
  console.log(`Save that recording to: ${CONSENT_RECORDING}`);
  console.log("It must be the SAME speaker as the sample being cloned.\n");

  // 2. Wait for the recording. (Skip the prompt in CI by pre-recording the file.)
  if (!fs.existsSync(CONSENT_RECORDING)) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    await rl.question("Press Enter once the consent recording is saved… ");
    rl.close();
  }
  if (!fs.existsSync(CONSENT_RECORDING)) {
    throw new Error(`Consent recording not found at ${CONSENT_RECORDING}.`);
  }

  // 3. Create the clone. POST /v1/voices is multipart/form-data — pass a
  //    FormData instance and let fetch set the boundary (do NOT set Content-Type).
  const form = new FormData();
  form.append("name", "cookbook-cloned-voice");
  form.append("gender", "male");
  form.append("consent_challenge_id", challenge.id);
  form.append(
    "sample",
    new Blob([fs.readFileSync(SAMPLE)], { type: "audio/wav" }),
    path.basename(SAMPLE),
  );
  form.append(
    "consent_recording",
    new Blob([fs.readFileSync(CONSENT_RECORDING)], { type: "audio/wav" }),
    path.basename(CONSENT_RECORDING),
  );

  const createRes = await fetch(`${BASE}/v1/voices`, {
    method: "POST",
    headers: { ...auth, "Idempotency-Key": randomUUID() },
    body: form,
  });
  if (!createRes.ok) throw await explainConsentError(createRes);

  const voice = (await createRes.json()) as CreatedVoice;
  console.log(`\nCloned voice created: ${voice.id} (${voice.display_name}, type=${voice.type})`);

  try {
    // 4. Synthesize with the clone. Cloned voices are self-serve on simba-3.0.
    const speechRes = await fetch(`${BASE}/v1/audio/speech`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        input: "Hello from a voice cloned with the Speechify API.",
        voice_id: voice.id,
        audio_format: "mp3",
        model: "simba-3.0",
      }),
    });
    if (!speechRes.ok)
      throw new Error(`POST /v1/audio/speech → ${speechRes.status}: ${await speechRes.text()}`);
    const speech = (await speechRes.json()) as SpeechResponse;
    fs.writeFileSync("output.mp3", Buffer.from(speech.audio_data, "base64"));
    console.log("Wrote output.mp3");
  } finally {
    // 5. Clean up so cloned voices don't accumulate.
    const delRes = await fetch(`${BASE}/v1/voices/${encodeURIComponent(voice.id)}`, {
      method: "DELETE",
      headers: auth,
    });
    console.log(
      delRes.ok ? `Deleted cloned voice ${voice.id}` : `DELETE failed → ${delRes.status}`,
    );
  }
}

/** Branch on the error CODE, not the HTTP status — several outcomes share 422. */
async function explainConsentError(res: Response): Promise<Error> {
  if (res.status === 402) {
    return new Error(
      "Voice cloning isn't included in your current Speechify plan: https://speechify.ai/pricing",
    );
  }
  const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
  const hint: Record<string, string> = {
    consent_phrase_mismatch: "The phrase was misread. Record it again, word for word.",
    consent_speaker_mismatch:
      "The consent recording is a different speaker from the sample. The person consenting must be the person being cloned.",
    consent_recording_unusable:
      "The recording was silent, too short, or unreadable. Record it again.",
    consent_challenge_not_found: "The challenge id did not resolve. Mint a new challenge.",
    consent_challenge_expired: "The challenge expired. Mint a new one and record again.",
    consent_challenge_already_used: "A challenge is single-use. Mint a fresh one.",
    consent_verification_unavailable:
      "Verification backend is down. Retry the same recording shortly.",
  };
  const code = body?.error?.code;
  return new Error(
    code && hint[code] ? `${code}: ${hint[code]}` : `POST /v1/voices → ${res.status}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
