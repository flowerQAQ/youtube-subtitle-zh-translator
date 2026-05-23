import { loadSettings, saveSettings } from "../../src/shared/settings";
import type { DisplayMode, TranslationProvider } from "../../src/shared/types";
import "./style.css";

const form = document.querySelector<HTMLFormElement>("#settings-form");
const translationProviderSelect = document.querySelector<HTMLSelectElement>("#translation-provider");
const deepseekApiKeyInput = document.querySelector<HTMLInputElement>("#deepseek-api-key");
const mimoApiKeyInput = document.querySelector<HTMLInputElement>("#mimo-api-key");
const displayModeSelect = document.querySelector<HTMLSelectElement>("#display-mode");
const fontScaleInput = document.querySelector<HTMLInputElement>("#font-scale");
const verticalOffsetInput = document.querySelector<HTMLInputElement>("#vertical-offset");
const status = document.querySelector<HTMLParagraphElement>("#status");

void hydrate();

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  void persist();
});

async function hydrate(): Promise<void> {
  const settings = await loadSettings();
  if (translationProviderSelect) translationProviderSelect.value = settings.translationProvider;
  if (deepseekApiKeyInput) deepseekApiKeyInput.value = settings.deepseekApiKey;
  if (mimoApiKeyInput) mimoApiKeyInput.value = settings.mimoApiKey;
  if (displayModeSelect) displayModeSelect.value = settings.displayMode;
  if (fontScaleInput) fontScaleInput.value = String(settings.fontScale);
  if (verticalOffsetInput) verticalOffsetInput.value = String(settings.verticalOffset);
}

async function persist(): Promise<void> {
  await saveSettings({
    translationProvider: (translationProviderSelect?.value ?? "deepseek") as TranslationProvider,
    deepseekApiKey: deepseekApiKeyInput?.value.trim() ?? "",
    mimoApiKey: mimoApiKeyInput?.value.trim() ?? "",
    displayMode: (displayModeSelect?.value ?? "bilingual") as DisplayMode,
    fontScale: Number(fontScaleInput?.value ?? "1"),
    verticalOffset: Number(verticalOffsetInput?.value ?? "84")
  });

  if (status) {
    status.textContent = "已保存。";
    window.setTimeout(() => {
      status.textContent = "";
    }, 1800);
  }
}
