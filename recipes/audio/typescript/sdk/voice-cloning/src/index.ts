import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import readline from "node:readline/promises";
import { SpeechifyClient, SpeechifyError } from "@speechify/api";

if (!process.env.SPEECHIFY_API_KEY) {
  throw new Error("Set SPEECHIFY_API_KEY (copy .env.example to .env).");
}

const client = new SpeechifyClient({ token: process.env.SPEECHIFY_API_KEY });

// Voice cloning now requires VERIFIED CONSENT: the speaker records themselves
// reading a phrase the API issues, and that recording must be the same speaker
// as the voice sample. So this recipe cannot ship a canned consent clip — you
// provide two files of your own voice:
//   SAMPLE          — 10–30s of clean speech to clone (the voice).
//   CONSENT_RECORDING — you reading the phrase printed below, same speaker.
const SAMPLE = process.env.SAMPLE_PATH
  ? path.resolve(process.env.SAMPLE_PATH)
  : path.resolve(import.meta.dirname, "../fixtures/spacewalk.wav");
const CONSENT_RECORDING = path.resolve(process.env.CONSENT_RECORDING ?? "consent.wav");
const SPEAKER_NAME = process.env.SPEAKER_NAME ?? "Jane Doe";

async function main() {
  // 1. Mint a consent challenge. It returns a phrase to read and a short-lived,
  //    single-use id. Create it only when the speaker is ready to record.
  const challenge = await client.voices.consentChallenges.create({
    "Idempotency-Key": randomUUID(),
    full_name: SPEAKER_NAME,
  });
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

  // 3. Create the clone. Send the sample, the consent recording, and the
  //    challenge id together. Speechify transcribes the recording, checks it
  //    against the phrase it issued and against the sample's speaker, and keeps
  //    it as the consent record. An Idempotency-Key makes a retry safe.
  let voice;
  try {
    voice = await client.voices.create({
      "Idempotency-Key": randomUUID(),
      name: "cookbook-cloned-voice",
      gender: "male",
      sample: fs.createReadStream(SAMPLE),
      consent_recording: fs.createReadStream(CONSENT_RECORDING),
      consent_challenge_id: challenge.id,
    });
  } catch (err) {
    if (err instanceof SpeechifyError) throw explainConsentError(err);
    throw err;
  }
  console.log(`\nCloned voice created: ${voice.id} (${voice.display_name}, type=${voice.type})`);

  try {
    // 4. Synthesize with the clone. Cloned voices are self-serve on simba-3.0.
    const speech = await client.audio.speech({
      input: "Hello from a voice cloned with the Speechify API.",
      voice_id: voice.id,
      audio_format: "mp3",
      model: "simba-3.0",
    });
    fs.writeFileSync("output.mp3", Buffer.from(speech.audio_data, "base64"));
    console.log("Wrote output.mp3");
  } finally {
    // 5. Clean up so cloned voices don't accumulate. Remove to keep the voice.
    await client.voices.delete({ voice_id: voice.id });
    console.log(`Deleted cloned voice ${voice.id}`);
  }
}

/** Turn a consent failure into an actionable message. Branch on the error CODE,
 *  not the HTTP status — several distinct outcomes share status 422. */
function explainConsentError(err: SpeechifyError): Error {
  const code = (err.body as { error?: { code?: string } } | undefined)?.error?.code;
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
  if (err.statusCode === 402) {
    return new Error(
      "Voice cloning isn't included in your current Speechify plan: https://speechify.ai/pricing",
    );
  }
  return new Error(
    code && hint[code] ? `${code}: ${hint[code]}` : `Voice create failed: ${err.message}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
