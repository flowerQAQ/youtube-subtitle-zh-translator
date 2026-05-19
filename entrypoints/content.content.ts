import { defineContentScript } from "wxt/utils/define-content-script";
import { chooseSourceTrack, hasSimplifiedChineseTrack } from "../src/captions/tracks";
import { fetchCaptionTrack } from "../src/captions/fetcher";
import { createTranslationBatches } from "../src/translation/batching";
import { translateCaptions } from "../src/translation/deepseek";
import { createTranslationCacheKey } from "../src/cache/cacheKey";
import { getCachedTranslation, setCachedTranslation } from "../src/cache/translationCache";
import { loadSettings, saveSettings } from "../src/shared/settings";
import type { CaptionTrack, DisplayMode, ExtensionSettings, PlayerResponsePayload, TranslatedCue } from "../src/shared/types";
import { SubtitleOverlay, injectOverlayStyles } from "../src/ui/overlay";

const REQUEST_EVENT = "yt-zh-translator:request-player-response";
const RESPONSE_EVENT = "yt-zh-translator:player-response";

export default defineContentScript({
  matches: ["https://www.youtube.com/watch*", "https://m.youtube.com/watch*"],
  runAt: "document_idle",
  main() {
    const controller = new YouTubeSubtitleTranslator();
    controller.start();
  }
});

class YouTubeSubtitleTranslator {
  private overlay: SubtitleOverlay | null = null;
  private settings: ExtensionSettings | null = null;
  private lastVideoId = "";
  private animationFrame = 0;
  private loadToken = 0;

  start(): void {
    injectOverlayStyles();
    this.watchNavigation();
    void this.reload();
  }

  private watchNavigation(): void {
    window.addEventListener("yt-navigate-finish", () => void this.reload());
    window.addEventListener("popstate", () => void this.reload());
    setInterval(() => {
      const videoId = getCurrentVideoId();
      if (videoId && videoId !== this.lastVideoId) {
        void this.reload();
      }
    }, 1000);
  }

  private async reload(force = false): Promise<void> {
    const video = document.querySelector("video");
    const videoId = getCurrentVideoId();
    if (!video || !videoId) {
      return;
    }

    if (!force && videoId === this.lastVideoId && this.overlay) {
      return;
    }

    this.lastVideoId = videoId;
    const token = ++this.loadToken;
    this.overlay?.destroy();
    this.overlay = null;
    cancelAnimationFrame(this.animationFrame);

    this.settings = await loadSettings();
    const payload = await requestPlayerResponse();
    if (token !== this.loadToken || !payload) {
      return;
    }

    const sourceTracks = payload.captionTracks.filter((track) => !track.languageCode.toLowerCase().startsWith("zh"));
    const selectedTrack = chooseSourceTrack(payload.captionTracks, this.settings.sourceLanguage);
    this.overlay = new SubtitleOverlay(video, {
      displayMode: this.settings.displayMode,
      fontScale: this.settings.fontScale,
      verticalOffset: this.settings.verticalOffset,
      tracks: sourceTracks,
      selectedLanguage: selectedTrack?.languageCode,
      onDisplayModeChange: (mode) => void this.setDisplayMode(mode),
      onTrackChange: (languageCode) => void this.setSourceLanguage(languageCode),
      onRefresh: () => void this.reload(true)
    });

    if (hasSimplifiedChineseTrack(payload.captionTracks)) {
      this.overlay.setStatus("当前视频已有中文字幕，已暂停翻译。");
      return;
    }

    if (!selectedTrack) {
      this.overlay.setStatus("当前视频没有可用字幕轨。");
      return;
    }

    if (!this.settings.apiKey) {
      this.overlay.setStatus("请在扩展选项页填写 DeepSeek API Key。");
      return;
    }

    try {
      this.overlay.setStatus("正在获取原字幕...");
      const originalCues = await fetchCaptionTrack(selectedTrack);
      if (token !== this.loadToken) {
        return;
      }

      if (originalCues.length === 0) {
        this.overlay.setStatus("没有解析到字幕文本。");
        return;
      }

      const cacheKey = createTranslationCacheKey(payload.videoId, selectedTrack);
      const cached = await getCachedTranslation(cacheKey);
      const translated = cached ?? await this.translateAndCache(payload, selectedTrack, originalCues, cacheKey);

      if (token !== this.loadToken) {
        return;
      }

      this.overlay.setCues(translated);
      this.startRendering();
    } catch (error) {
      this.overlay.setStatus(error instanceof Error ? error.message : "字幕翻译失败。");
    }
  }

  private async translateAndCache(
    payload: PlayerResponsePayload,
    selectedTrack: CaptionTrack,
    originalCues: Array<{ id: string; startMs: number; durationMs: number; text: string }>,
    cacheKey: string
  ): Promise<TranslatedCue[]> {
    const batches = createTranslationBatches(originalCues);
    const translated = await translateCaptions({
      apiKey: this.settings?.apiKey ?? "",
      sourceLanguage: selectedTrack.languageCode,
      videoContext: {
        videoId: payload.videoId,
        title: payload.title,
        channelName: payload.channelName,
        shortDescription: payload.shortDescription?.slice(0, 1200)
      },
      batches,
      onBatchDone: (done, total) => this.overlay?.setStatus(`正在翻译字幕 ${done}/${total}...`)
    });
    await setCachedTranslation(cacheKey, translated);
    return translated;
  }

  private startRendering(): void {
    const render = () => {
      const video = document.querySelector("video");
      if (video && this.overlay) {
        this.overlay.renderForTime(video.currentTime * 1000);
      }
      this.animationFrame = requestAnimationFrame(render);
    };
    render();
  }

  private async setDisplayMode(displayMode: DisplayMode): Promise<void> {
    if (!this.settings) {
      return;
    }

    this.settings = { ...this.settings, displayMode };
    await saveSettings(this.settings);
    this.overlay?.updateOptions(this.settings);
  }

  private async setSourceLanguage(sourceLanguage: string): Promise<void> {
    if (!this.settings) {
      return;
    }

    this.settings = { ...this.settings, sourceLanguage };
    await saveSettings(this.settings);
    await this.reload(true);
  }
}

function requestPlayerResponse(): Promise<PlayerResponsePayload | null> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener(RESPONSE_EVENT, onResponse);
      resolve(null);
    }, 2500);

    const onResponse = (event: Event) => {
      window.clearTimeout(timeout);
      window.removeEventListener(RESPONSE_EVENT, onResponse);
      resolve((event as CustomEvent<PlayerResponsePayload | null>).detail ?? null);
    };

    window.addEventListener(RESPONSE_EVENT, onResponse);
    window.dispatchEvent(new CustomEvent(REQUEST_EVENT));
  });
}

function getCurrentVideoId(): string {
  return new URL(location.href).searchParams.get("v") ?? "";
}
