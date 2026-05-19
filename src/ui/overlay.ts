import type { DisplayMode, TranslatedCue } from "../shared/types";

interface OverlayOptions {
  displayMode: DisplayMode;
  fontScale: number;
  verticalOffset: number;
}

export class SubtitleOverlay {
  private root: HTMLDivElement;
  private text: HTMLDivElement;
  private status: HTMLDivElement;
  private cues: TranslatedCue[] = [];
  private displayMode: DisplayMode;
  private fontScale: number;
  private verticalOffset: number;

  constructor(private video: HTMLVideoElement, options: OverlayOptions) {
    this.displayMode = options.displayMode;
    this.fontScale = options.fontScale;
    this.verticalOffset = options.verticalOffset;
    this.root = document.createElement("div");
    this.text = document.createElement("div");
    this.status = document.createElement("div");
    this.mount();
  }

  destroy(): void {
    this.root.remove();
  }

  setCues(cues: TranslatedCue[]): void {
    this.cues = cues;
  }

  setStatus(message: string): void {
    this.status.textContent = message;
    this.status.hidden = message.length === 0;
  }

  updateOptions(options: OverlayOptions): void {
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
    this.text.className = "yt-zh-translator__text";
    this.status.className = "yt-zh-translator__status";
    this.status.hidden = true;
    this.root.append(this.text, this.status);

    const player = this.video.closest(".html5-video-player") ?? this.video.parentElement ?? document.body;
    if (getComputedStyle(player).position === "static") {
      (player as HTMLElement).style.position = "relative";
    }
    player.append(this.root);
    this.applySizing();
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
  `;
  document.documentElement.append(style);
}

function findActiveCue(cues: TranslatedCue[], timeMs: number): TranslatedCue | null {
  return cues.find((cue) => timeMs >= cue.startMs && timeMs <= cue.startMs + cue.durationMs + 120) ?? null;
}
