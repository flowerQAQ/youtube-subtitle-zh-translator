import { browser } from "wxt/browser";
import type { ExtensionSettings } from "./types";

export const DEFAULT_SETTINGS: ExtensionSettings = {
  apiKey: "",
  displayMode: "bilingual",
  fontScale: 1,
  verticalOffset: 84
};

const SETTINGS_KEY = "youtubeZhTranslatorSettings";

export async function loadSettings(): Promise<ExtensionSettings> {
  const result = await browser.storage.local.get(SETTINGS_KEY);
  return normalizeSettings(result[SETTINGS_KEY]);
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await browser.storage.local.set({
    [SETTINGS_KEY]: normalizeSettings(settings)
  });
}

function normalizeSettings(value: unknown): ExtensionSettings {
  const settings = typeof value === "object" && value !== null ? value as Partial<ExtensionSettings> : {};
  return {
    apiKey: typeof settings.apiKey === "string" ? settings.apiKey : DEFAULT_SETTINGS.apiKey,
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

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}
