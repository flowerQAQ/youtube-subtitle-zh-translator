import { loadSettings, saveSettings } from "../../src/shared/settings";
import type { DisplayMode } from "../../src/shared/types";
import "./style.css";

const form = document.querySelector<HTMLFormElement>("#settings-form");
const apiKeyInput = document.querySelector<HTMLInputElement>("#api-key");
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
  if (apiKeyInput) apiKeyInput.value = settings.apiKey;
  if (displayModeSelect) displayModeSelect.value = settings.displayMode;
  if (fontScaleInput) fontScaleInput.value = String(settings.fontScale);
  if (verticalOffsetInput) verticalOffsetInput.value = String(settings.verticalOffset);
}

async function persist(): Promise<void> {
  await saveSettings({
    apiKey: apiKeyInput?.value.trim() ?? "",
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
