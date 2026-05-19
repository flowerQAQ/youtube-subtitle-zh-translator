import type { CaptionCue, TranslationBatch } from "../shared/types";

const MAX_BATCH_CHARS = 9000;
const MAX_BATCH_CUES = 40;

export function createTranslationBatches(cues: CaptionCue[]): TranslationBatch[] {
  const batches: TranslationBatch[] = [];
  let current: CaptionCue[] = [];
  let currentChars = 0;

  for (const cue of cues) {
    const nextChars = cue.text.length;
    const shouldFlush = current.length > 0 && (
      current.length >= MAX_BATCH_CUES ||
      currentChars + nextChars > MAX_BATCH_CHARS
    );

    if (shouldFlush) {
      batches.push({ batchId: batches.length, cues: current });
      current = [];
      currentChars = 0;
    }

    current.push(cue);
    currentChars += nextChars;
  }

  if (current.length > 0) {
    batches.push({ batchId: batches.length, cues: current });
  }

  return batches;
}
