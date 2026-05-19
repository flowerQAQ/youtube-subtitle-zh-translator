import { describe, expect, it } from "vitest";
import { parseJson3Captions } from "./parser";

describe("parseJson3Captions", () => {
  it("extracts timed caption cues and joins segments", () => {
    const cues = parseJson3Captions(JSON.stringify({
      events: [
        { tStartMs: 1200, dDurationMs: 800, segs: [{ utf8: "Hello" }, { utf8: " world" }] },
        { tStartMs: 2400, dDurationMs: 1000, segs: [{ utf8: "\n" }] },
        { tStartMs: 3200, segs: [{ utf8: "Next line" }] }
      ]
    }));

    expect(cues).toEqual([
      { id: "0", startMs: 1200, durationMs: 800, text: "Hello world" },
      { id: "1", startMs: 3200, durationMs: 1800, text: "Next line" }
    ]);
  });
});
