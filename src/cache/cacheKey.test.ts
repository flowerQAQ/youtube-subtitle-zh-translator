import { describe, expect, it } from "vitest";
import { createTranslationCacheKey } from "./cacheKey";

describe("createTranslationCacheKey", () => {
  it("uses stable caption identity parameters", () => {
    const first = createTranslationCacheKey("abc", {
      languageCode: "en",
      baseUrl: "https://www.youtube.com/api/timedtext?v=abc&lang=en&name=English&expire=1"
    });
    const second = createTranslationCacheKey("abc", {
      languageCode: "en",
      baseUrl: "https://www.youtube.com/api/timedtext?expire=2&name=English&lang=en&v=abc"
    });

    expect(first).toBe(second);
  });
});
