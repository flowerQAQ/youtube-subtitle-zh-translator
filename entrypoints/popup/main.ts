import { loadDebugInfo } from "../../src/shared/debug";
import { loadSettings, saveSettings } from "../../src/shared/settings";
import type { DebugInfo, DisplayMode } from "../../src/shared/types";
import "./style.css";

const form = document.querySelector<HTMLFormElement>("#settings-form");
const apiKeyInput = document.querySelector<HTMLInputElement>("#api-key");
const displayModeSelect = document.querySelector<HTMLSelectElement>("#display-mode");
const sourceLanguageInput = document.querySelector<HTMLInputElement>("#source-language");
const fontScaleInput = document.querySelector<HTMLInputElement>("#font-scale");
const verticalOffsetInput = document.querySelector<HTMLInputElement>("#vertical-offset");
const saveStatus = document.querySelector<HTMLSpanElement>("#save-status");
const refreshDebugButton = document.querySelector<HTMLButtonElement>("#refresh-debug");
const debugSummary = document.querySelector<HTMLElement>("#debug-summary");
const debugJson = document.querySelector<HTMLPreElement>("#debug-json");

void hydrate();
void renderDebug();

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  void persist();
});

refreshDebugButton?.addEventListener("click", () => {
  void renderDebug();
});

async function hydrate(): Promise<void> {
  const settings = await loadSettings();
  if (apiKeyInput) apiKeyInput.value = settings.apiKey;
  if (displayModeSelect) displayModeSelect.value = settings.displayMode;
  if (sourceLanguageInput) sourceLanguageInput.value = settings.sourceLanguage ?? "";
  if (fontScaleInput) fontScaleInput.value = String(settings.fontScale);
  if (verticalOffsetInput) verticalOffsetInput.value = String(settings.verticalOffset);
}

async function persist(): Promise<void> {
  await saveSettings({
    apiKey: apiKeyInput?.value.trim() ?? "",
    displayMode: (displayModeSelect?.value ?? "bilingual") as DisplayMode,
    fontScale: Number(fontScaleInput?.value ?? "1"),
    verticalOffset: Number(verticalOffsetInput?.value ?? "84"),
    sourceLanguage: sourceLanguageInput?.value.trim() || undefined
  });

  if (saveStatus) {
    saveStatus.textContent = "已保存";
    window.setTimeout(() => {
      saveStatus.textContent = "";
    }, 1400);
  }
}

async function renderDebug(): Promise<void> {
  const info = await loadDebugInfo();
  if (!debugSummary || !debugJson) {
    return;
  }

  if (!info) {
    debugSummary.innerHTML = "<dt>状态</dt><dd>暂无调试信息</dd>";
    debugJson.textContent = "";
    return;
  }

  debugSummary.replaceChildren(...createSummaryNodes(info));
  debugJson.textContent = JSON.stringify(info, null, 2);
}

function createSummaryNodes(info: DebugInfo): Node[] {
  const rows: Array<[string, string]> = [
    ["阶段", info.stage],
    ["消息", info.message],
    ["视频", info.title ?? info.videoId ?? "-"],
    ["轨道数", String(info.tracks?.length ?? 0)],
    ["选中轨道", info.selectedTrack ? `${info.selectedTrack.languageCode} ${info.selectedTrack.kind ?? ""}`.trim() : "-"],
    ["字幕请求", info.fetch ? `${info.fetch.status ?? "-"} / ${info.fetch.contentType ?? "-"}` : "-"],
    ["解析条数", String(info.cueCount ?? info.fetch?.parsedCueCount ?? 0)],
    ["更新时间", new Date(info.updatedAt).toLocaleString()]
  ];

  if (info.fetch?.rawPreview) {
    rows.push(["返回预览", info.fetch.rawPreview]);
  } else if (info.fetch?.fallbackRawPreview) {
    rows.push(["返回预览", info.fetch.fallbackRawPreview]);
  }

  return rows.flatMap(([label, value]) => {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    return [dt, dd];
  });
}
