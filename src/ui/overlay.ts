import type { CaptionTrack, DisplayMode, TranslatedCue } from "../shared/types";
import { normalizeTrackName } from "../captions/tracks";

interface OverlayOptions {
  displayMode: DisplayMode;
  fontScale: number;
  verticalOffset: number;
  tracks: CaptionTrack[];
  selectedLanguage?: string;
  onDisplayModeChange: (mode: DisplayMode) => void;
  onTrackChange: (languageCode: string) => void;
  onRefresh: () => void;
}

export class SubtitleOverlay {
  private root: HTMLDivElement;
  private text: HTMLDivElement;
  private status: HTMLDivElement;
  private toolbar: HTMLDivElement;
  private cues: TranslatedCue[] = [];
  private displayMode: DisplayMode;
  private fontScale: number;
  private verticalOffset: number;

  constructor(private video: HTMLVideoElement, private options: OverlayOptions) {
    this.displayMode = options.displayMode;
    this.fontScale = options.fontScale;
    this.verticalOffset = options.verticalOffset;
    this.root = document.createElement("div");
    this.text = document.createElement("div");
    this.status = document.createElement("div");
    this.toolbar = document.createElement("div");
    this.mount();
  }

  destroy(): void {
    this.root.remove();
  }

  setCues(cues: TranslatedCue[]): void {
    this.cues = cues;
    this.setStatus("");
  }

  setStatus(message: string): void {
    this.status.textContent = message;
    this.status.hidden = message.length === 0;
  }

  updateOptions(options: Pick<OverlayOptions, "displayMode" | "fontScale" | "verticalOffset">): void {
    this.displayMode = options.displayMode;
    this.fontScale = options.fontScale;
    this.verticalOffset = options.verticalOffset;
    this.applySizing();
    this.renderForTime(this.video.currentTime * 1000);
  }

  renderForTime(timeMs: number): void {
    if (this.displayMode === "off") {
      this.text.textContent = "";
      return;
    }

    const cue = findActiveCue(this.cues, timeMs);
    if (!cue) {
      this.text.textContent = "";
      return;
    }

    this.text.textContent = this.displayMode === "bilingual"
      ? `${cue.translatedText}\n${cue.text}`
      : cue.translatedText;
  }

  private mount(): void {
    this.root.className = "yt-zh-translator";
    this.toolbar.className = "yt-zh-translator__toolbar";
    this.text.className = "yt-zh-translator__text";
    this.status.className = "yt-zh-translator__status";

    this.toolbar.append(
      this.createTrackSelect(),
      this.createModeButton("中", "zh"),
      this.createModeButton("双", "bilingual"),
      this.createModeButton("关", "off"),
      this.createRefreshButton()
    );
    this.root.append(this.toolbar, this.text, this.status);

    const player = this.video.closest(".html5-video-player") ?? this.video.parentElement ?? document.body;
    if (getComputedStyle(player).position === "static") {
      (player as HTMLElement).style.position = "relative";
    }
    player.append(this.root);
    this.applySizing();
  }

  private createTrackSelect(): HTMLSelectElement {
    const select = document.createElement("select");
    select.title = "源字幕轨";
    select.className = "yt-zh-translator__select";

    for (const track of this.options.tracks) {
      const option = document.createElement("option");
      option.value = track.languageCode;
      option.textContent = normalizeTrackName(track);
      option.selected = track.languageCode === this.options.selectedLanguage;
      select.append(option);
    }

    select.addEventListener("change", () => this.options.onTrackChange(select.value));
    return select;
  }

  private createModeButton(label: string, mode: DisplayMode): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.title = mode === "zh" ? "只显示中文" : mode === "bilingual" ? "显示双语" : "关闭字幕";
    button.addEventListener("click", () => this.options.onDisplayModeChange(mode));
    return button;
  }

  private createRefreshButton(): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "↻";
    button.title = "重新翻译";
    button.addEventListener("click", () => this.options.onRefresh());
    return button;
  }

  private applySizing(): void {
    this.root.style.setProperty("--yt-zh-font-scale", String(this.fontScale));
    this.root.style.setProperty("--yt-zh-bottom", `${this.verticalOffset}px`);
  }
}

export function injectOverlayStyles(): void {
  if (document.getElementById("yt-zh-translator-style")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "yt-zh-translator-style";
  style.textContent = `
    .yt-zh-translator {
      --yt-zh-font-scale: 1;
      --yt-zh-bottom: 84px;
      position: absolute;
      left: 12%;
      right: 12%;
      bottom: var(--yt-zh-bottom);
      z-index: 2147483647;
      pointer-events: none;
      text-align: center;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .yt-zh-translator__text {
      display: inline-block;
      max-width: 100%;
      white-space: pre-line;
      padding: 6px 10px;
      border-radius: 6px;
      background: rgba(8, 10, 12, 0.72);
      color: #fff;
      font-size: calc(22px * var(--yt-zh-font-scale));
      line-height: 1.35;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
    }
    .yt-zh-translator__status {
      display: inline-block;
      margin-top: 8px;
      padding: 4px 8px;
      border-radius: 6px;
      background: rgba(20, 24, 28, 0.78);
      color: #f3f4f6;
      font-size: 13px;
    }
    .yt-zh-translator__toolbar {
      position: absolute;
      right: 0;
      bottom: calc(100% + 8px);
      display: flex;
      gap: 4px;
      justify-content: flex-end;
      pointer-events: auto;
      opacity: 0.2;
      transition: opacity 160ms ease;
    }
    .yt-zh-translator:hover .yt-zh-translator__toolbar,
    .yt-zh-translator__toolbar:focus-within {
      opacity: 1;
    }
    .yt-zh-translator__toolbar button,
    .yt-zh-translator__select {
      height: 28px;
      border: 1px solid rgba(255, 255, 255, 0.24);
      border-radius: 6px;
      background: rgba(12, 14, 18, 0.88);
      color: #fff;
      font-size: 12px;
    }
    .yt-zh-translator__toolbar button {
      min-width: 28px;
      padding: 0 8px;
      cursor: pointer;
    }
    .yt-zh-translator__select {
      max-width: 180px;
      padding: 0 6px;
    }
  `;
  document.documentElement.append(style);
}

function findActiveCue(cues: TranslatedCue[], timeMs: number): TranslatedCue | null {
  return cues.find((cue) => timeMs >= cue.startMs && timeMs <= cue.startMs + cue.durationMs + 120) ?? null;
}
