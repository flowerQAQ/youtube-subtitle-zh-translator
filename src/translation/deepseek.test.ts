import { describe, expect, it } from "vitest";
import { parseTranslationResponse } from "./deepseek";

describe("parseTranslationResponse", () => {
  it("accepts fenced JSON and filters unknown ids", () => {
    const result = parseTranslationResponse(
      "```json\n{\"translations\":[{\"id\":\"a\",\"text\":\"你好\"},{\"id\":\"x\",\"text\":\"忽略\"}]}\n```",
      [{ id: "a", startMs: 0, durationMs: 1000, text: "Hello" }]
    );

    expect(result).toEqual([{ id: "a", text: "你好" }]);
  });
});
