import { browser } from "wxt/browser";
import type { ExtensionSettings, TranslationProvider } from "./types";

export const DEFAULT_SETTINGS: ExtensionSettings = {
  translationProvider: "deepseek",
  deepseekApiKey: "",
  mimoApiKey: "",
  displayMode: "bilingual",
  fontScale: 1,
  verticalOffset: 84
};

export const SETTINGS_KEY = "youtubeZhTranslatorSettings";

export async function loadSettings(): Promise<ExtensionSettings> {
  const result = await browser.storage.local.get(SETTINGS_KEY);
  return normalizeSettings(result[SETTINGS_KEY]);
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await browser.storage.local.set({
    [SETTINGS_KEY]: normalizeSettings(settings)
  });
}

export function normalizeSettings(value: unknown): ExtensionSettings {
  const settings = typeof value === "object" && value !== null
    ? value as Partial<ExtensionSettings> & { apiKey?: unknown }
    : {};
  const legacyApiKey = typeof settings.apiKey === "string" ? settings.apiKey : "";

  return {
    translationProvider: normalizeTranslationProvider(settings.translationProvider),
    deepseekApiKey: typeof settings.deepseekApiKey === "string" ? settings.deepseekApiKey : legacyApiKey,
    mimoApiKey: typeof settings.mimoApiKey === "string" ? settings.mimoApiKey : DEFAULT_SETTINGS.mimoApiKey,
    displayMode: settings.displayMode === "zh" || settings.displayMode === "off" || settings.displayMode === "bilingual"
      ? settings.displayMode
      : DEFAULT_SETTINGS.displayMode,
    fontScale: clampNumber(settings.fontScale, 0.75, 1.8, DEFAULT_SETTINGS.fontScale),
    verticalOffset: clampNumber(settings.verticalOffset, 48, 180, DEFAULT_SETTINGS.verticalOffset),
    sourceLanguage: typeof settings.sourceLanguage === "string" && settings.sourceLanguage.length > 0
      ? settings.sourceLanguage
      : undefined
  };
}

function normalizeTranslationProvider(value: unknown): TranslationProvider {
  return value === "xiaomi-mimo" || value === "deepseek"
    ? value
    : DEFAULT_SETTINGS.translationProvider;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}
