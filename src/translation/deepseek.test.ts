import { describe, expect, it } from "vitest";
import { createTranslationRequest, parseTranslationResponse } from "./deepseek";

describe("parseTranslationResponse", () => {
  it("accepts fenced JSON and filters unknown ids", () => {
    const result = parseTranslationResponse(
      "```json\n{\"translations\":[{\"id\":\"a\",\"text\":\"你好\"},{\"id\":\"x\",\"text\":\"忽略\"}]}\n```",
      [{ id: "a", startMs: 0, durationMs: 1000, text: "Hello" }]
    );

    expect(result).toEqual([{ id: "a", text: "你好" }]);
  });
});

describe("createTranslationRequest", () => {
  const baseParams = {
    apiKey: "secret-key",
    sourceLanguage: "en",
    videoContext: { videoId: "abc", title: "Demo" },
    batch: {
      batchId: 0,
      cues: [{ id: "a", startMs: 0, durationMs: 1000, text: "Hello" }]
    }
  };

  it("uses DeepSeek bearer auth and JSON response format", () => {
    const request = createTranslationRequest({
      ...baseParams,
      provider: "deepseek"
    });
    const body = JSON.parse(String(request.init.body)) as Record<string, unknown>;

    expect(request.endpoint).toBe("https://api.deepseek.com/chat/completions");
    expect(request.init.headers).toMatchObject({
      "Authorization": "Bearer secret-key",
      "Content-Type": "application/json"
    });
    expect(body.model).toBe("deepseek-v4-flash");
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("uses Xiaomi MiMo Token Plan bearer auth and disables thinking", () => {
    const request = createTranslationRequest({
      ...baseParams,
      provider: "xiaomi-mimo"
    });
    const body = JSON.parse(String(request.init.body)) as Record<string, unknown>;

    expect(request.endpoint).toBe("https://token-plan-cn.xiaomimimo.com/v1/chat/completions");
    expect(request.init.headers).toMatchObject({
      "Authorization": "Bearer secret-key",
      "Content-Type": "application/json"
    });
    expect(body.model).toBe("mimo-v2.5");
    expect(body.temperature).toBe(0.2);
    expect(body.thinking).toEqual({ type: "disabled" });
    expect(body.stream).toBe(false);
  });

  it("strongly instructs providers to convert Traditional Chinese to Simplified Chinese", () => {
    const request = createTranslationRequest({
      ...baseParams,
      sourceLanguage: "zh-TW",
      batch: {
        batchId: 0,
        cues: [{ id: "a", startMs: 0, durationMs: 1000, text: "這是一段繁體字幕" }]
      },
      provider: "xiaomi-mimo"
    });
    const body = JSON.parse(String(request.init.body)) as {
      messages: Array<{ role: string; content: string }>;
    };
    const systemPrompt = body.messages[0]?.content ?? "";
    const userPayload = JSON.parse(body.messages[1]?.content ?? "{}") as Record<string, unknown>;

    expect(systemPrompt).toContain("Use Simplified Chinese characters only");
    expect(systemPrompt).toContain("Traditional Chinese");
    expect(userPayload.targetLanguage).toBe("zh-Hans-CN");
    expect(userPayload.task).toContain("Simplified Chinese characters only");
  });
});
