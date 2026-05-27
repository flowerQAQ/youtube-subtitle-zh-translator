import { loadDebugInfo } from "../../src/shared/debug";
import { loadSettings, saveSettings } from "../../src/shared/settings";
import type { CaptionTrackDebug, DebugInfo, DisplayMode, TranslationProvider } from "../../src/shared/types";
import "./style.css";

const form = document.querySelector<HTMLFormElement>("#settings-form");
const translationProviderSelect = document.querySelector<HTMLSelectElement>("#translation-provider");
const deepseekApiKeyInput = document.querySelector<HTMLInputElement>("#deepseek-api-key");
const mimoApiKeyInput = document.querySelector<HTMLInputElement>("#mimo-api-key");
const displayModeSelect = document.querySelector<HTMLSelectElement>("#display-mode");
const sourceLanguageSelect = document.querySelector<HTMLSelectElement>("#source-language");
const fontScaleInput = document.querySelector<HTMLInputElement>("#font-scale");
const verticalOffsetInput = document.querySelector<HTMLInputElement>("#vertical-offset");
const saveStatus = document.querySelector<HTMLSpanElement>("#save-status");
const refreshDebugButton = document.querySelector<HTMLButtonElement>("#refresh-debug");
const debugSummary = document.querySelector<HTMLElement>("#debug-summary");
const debugJson = document.querySelector<HTMLPreElement>("#debug-json");

void hydrate();

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  void persist();
});

refreshDebugButton?.addEventListener("click", () => {
  void renderDebug();
});

async function hydrate(): Promise<void> {
  const [settings, debugInfo] = await Promise.all([loadSettings(), loadDebugInfo()]);
  populateTrackSelect(debugInfo?.tracks ?? [], settings.sourceLanguage);

  if (translationProviderSelect) translationProviderSelect.value = settings.translationProvider;
  if (deepseekApiKeyInput) deepseekApiKeyInput.value = settings.deepseekApiKey;
  if (mimoApiKeyInput) mimoApiKeyInput.value = settings.mimoApiKey;
  if (displayModeSelect) displayModeSelect.value = settings.displayMode;
  if (fontScaleInput) fontScaleInput.value = String(settings.fontScale);
  if (verticalOffsetInput) verticalOffsetInput.value = String(settings.verticalOffset);
  renderDebugInfo(debugInfo);
}

async function persist(): Promise<void> {
  await saveSettings({
    translationProvider: (translationProviderSelect?.value ?? "deepseek") as TranslationProvider,
    deepseekApiKey: deepseekApiKeyInput?.value.trim() ?? "",
    mimoApiKey: mimoApiKeyInput?.value.trim() ?? "",
    displayMode: (displayModeSelect?.value ?? "bilingual") as DisplayMode,
    fontScale: Number(fontScaleInput?.value ?? "1"),
    verticalOffset: Number(verticalOffsetInput?.value ?? "84"),
    sourceLanguage: sourceLanguageSelect?.value || undefined
  });

  if (saveStatus) {
    saveStatus.textContent = "已保存";
    window.setTimeout(() => {
      saveStatus.textContent = "";
    }, 1400);
  }
}

async function renderDebug(): Promise<void> {
  const [settings, info] = await Promise.all([loadSettings(), loadDebugInfo()]);
  populateTrackSelect(info?.tracks ?? [], settings.sourceLanguage);
  renderDebugInfo(info);
}

function renderDebugInfo(info: DebugInfo | null): void {
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

function populateTrackSelect(tracks: CaptionTrackDebug[], selectedId?: string): void {
  if (!sourceLanguageSelect) {
    return;
  }

  const previousValue = selectedId ?? sourceLanguageSelect.value;
  sourceLanguageSelect.replaceChildren(createOption("", "自动（优先英文手工字幕）"));

  for (const track of tracks) {
    if (!track.id || track.languageCode.toLowerCase().startsWith("zh")) {
      continue;
    }

    sourceLanguageSelect.append(createOption(track.id, formatTrackLabel(track)));
  }

  sourceLanguageSelect.value = Array.from(sourceLanguageSelect.options).some((option) => option.value === previousValue)
    ? previousValue
    : "";
}

function createOption(value: string, label: string): HTMLOptionElement {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function formatTrackLabel(track: CaptionTrackDebug): string {
  const kind = track.kind === "asr" ? "自动" : "手工";
  const name = track.name?.trim();
  return name ? `${name} (${track.languageCode}, ${kind})` : `${track.languageCode} (${kind})`;
}

function createSummaryNodes(info: DebugInfo): Node[] {
  const rows: Array<[string, string]> = [
    ["Platform", info.platform ?? "-"],
    ["Host", info.hostname ?? "-"],
    ["Android Edge", formatBoolean(info.isAndroidEdge)],
    ["Tablet-like", formatBoolean(info.isTabletLike)],
    ["Mobile YouTube", formatBoolean(info.isMobileYouTube)],
    ["Viewport", info.viewport ?? "-"],
    ["Video found", formatBoolean(info.videoFound)],
    ["Timedtext URLs", info.timedtextUrlCount === undefined ? "-" : String(info.timedtextUrlCount)],
    ["阶段", info.stage],
    ["消息", info.message],
    ["视频", info.title ?? info.videoId ?? "-"],
    ["轨道数", String(info.tracks?.length ?? 0)],
    ["选中轨道", info.selectedTrack ? formatTrackLabel(info.selectedTrack) : "-"],
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

function formatBoolean(value: boolean | undefined): string {
  return value === undefined ? "-" : value ? "yes" : "no";
}
