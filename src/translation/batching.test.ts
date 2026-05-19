import { describe, expect, it } from "vitest";
import { createTranslationBatches } from "./batching";
import type { CaptionCue } from "../shared/types";

describe("createTranslationBatches", () => {
  it("splits cues by max cue count", () => {
    const cues: CaptionCue[] = Array.from({ length: 41 }, (_, index) => ({
      id: String(index),
      startMs: index * 1000,
      durationMs: 900,
      text: `cue ${index}`
    }));

    const batches = createTranslationBatches(cues);

    expect(batches).toHaveLength(2);
    expect(batches[0]?.cues).toHaveLength(40);
    expect(batches[1]?.cues).toHaveLength(1);
  });
});
