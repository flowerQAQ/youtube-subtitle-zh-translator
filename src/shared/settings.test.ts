import { describe, expect, it } from "vitest";
import { normalizeSettings } from "./settings";

describe("normalizeSettings", () => {
  it("migrates legacy apiKey to the DeepSeek key", () => {
    const settings = normalizeSettings({
      apiKey: "legacy-key",
      displayMode: "zh",
      fontScale: 1.2,
      verticalOffset: 96
    });

    expect(settings.translationProvider).toBe("deepseek");
    expect(settings.deepseekApiKey).toBe("legacy-key");
    expect(settings.mimoApiKey).toBe("");
    expect(settings.displayMode).toBe("zh");
  });

  it("keeps provider-specific keys and MiMo provider", () => {
    const settings = normalizeSettings({
      translationProvider: "xiaomi-mimo",
      deepseekApiKey: "deepseek-key",
      mimoApiKey: "mimo-key"
    });

    expect(settings.translationProvider).toBe("xiaomi-mimo");
    expect(settings.deepseekApiKey).toBe("deepseek-key");
    expect(settings.mimoApiKey).toBe("mimo-key");
  });

  it("falls back to DeepSeek for an invalid provider", () => {
    const settings = normalizeSettings({
      translationProvider: "other"
    });

    expect(settings.translationProvider).toBe("deepseek");
  });
});
