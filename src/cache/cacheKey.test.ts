import { describe, expect, it } from "vitest";
import { createModelIdentity, createTranslationCacheKey } from "./cacheKey";

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

  it("separates cache entries by provider and model", () => {
    const track = {
      languageCode: "en",
      baseUrl: "https://www.youtube.com/api/timedtext?v=abc&lang=en&name=English"
    };

    const deepseek = createTranslationCacheKey("abc", track, createModelIdentity("deepseek", "deepseek-v4-flash"));
    const mimo = createTranslationCacheKey("abc", track, createModelIdentity("xiaomi-mimo", "mimo-v2.5"));

    expect(deepseek).not.toBe(mimo);
    expect(deepseek).toContain("deepseek:deepseek-v4-flash");
    expect(mimo).toContain("xiaomi-mimo:mimo-v2.5");
  });
});
