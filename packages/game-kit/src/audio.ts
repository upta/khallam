import { audioUrl, type LexiconEntry } from "@klallam/lexicon";

/** Where the recordings are served from. See the audio plugin this package ships. */
const AUDIO_BASE = `${import.meta.env.BASE_URL}audio`;

const player = new Audio();

export function recordingUrl(entry: LexiconEntry): string | null {
  return audioUrl(entry, AUDIO_BASE);
}

export function playRecording(entry: LexiconEntry): void {
  const url = recordingUrl(entry);
  if (url === null) return;
  playRecordingUrl(url);
}

export function playRecordingUrl(url: string): void {
  player.pause();
  player.src = url;
  void player.play().catch((error: unknown) => {
    // Starting a new word interrupts the previous play() promise. That is not a fault.
    if (error instanceof DOMException && error.name === "AbortError") return;
    console.error("Recording did not play:", url, error);
  });
}
