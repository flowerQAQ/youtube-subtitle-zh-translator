import { describe, expect, it } from "vitest";
import { chooseSourceTrack, hasSimplifiedChineseTrack } from "./tracks";
import type { CaptionTrack } from "../shared/types";

describe("caption track selection", () => {
  const tracks: CaptionTrack[] = [
    { baseUrl: "https://www.youtube.com/api/timedtext?v=1&lang=ja&kind=asr", languageCode: "ja", kind: "asr" },
    { baseUrl: "https://www.youtube.com/api/timedtext?v=1&lang=en", languageCode: "en", name: "English" }
  ];

  it("detects Simplified Chinese tracks", () => {
    expect(hasSimplifiedChineseTrack([{ baseUrl: "x", languageCode: "zh-Hans" }])).toBe(true);
    expect(hasSimplifiedChineseTrack(tracks)).toBe(false);
  });

  it("prefers manual captions over ASR", () => {
    expect(chooseSourceTrack(tracks)?.languageCode).toBe("en");
  });

  it("honors an explicit preferred language", () => {
    expect(chooseSourceTrack(tracks, "ja")?.languageCode).toBe("ja");
  });

  it("prefers manual English captions before other manual languages", () => {
    expect(chooseSourceTrack([
      { baseUrl: "https://www.youtube.com/api/timedtext?v=1&lang=ja", languageCode: "ja", name: "Japanese" },
      { baseUrl: "https://www.youtube.com/api/timedtext?v=1&lang=en", languageCode: "en", name: "English" },
      { baseUrl: "https://www.youtube.com/api/timedtext?v=1&lang=en&kind=asr", languageCode: "en", kind: "asr" }
    ])?.name).toBe("English");
  });
});
