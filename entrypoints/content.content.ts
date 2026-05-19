import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";
import { chooseSourceTrack, hasSimplifiedChineseTrack } from "../src/captions/tracks";
import { fetchCaptionTrackDetailed } from "../src/captions/fetcher";
import { createTranslationBatches } from "../src/translation/batching";
import { translateCaptions } from "../src/translation/deepseek";
import { createTranslationCacheKey } from "../src/cache/cacheKey";
import { getCachedTranslation, setCachedTranslation } from "../src/cache/translationCache";
import { loadSettings, saveSettings, SETTINGS_KEY } from "../src/shared/settings";
import { toTrackDebug, writeDebugInfo } from "../src/shared/debug";
import type { CaptionCue, CaptionTrack, DisplayMode, ExtensionSettings, PlayerResponsePayload, TranslatedCue } from "../src/shared/types";
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
    browser.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && changes[SETTINGS_KEY]) {
        void this.reload(true);
      }
    });
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
      await writeDebugInfo({
        stage: "waiting_for_video",
        message: "No YouTube video element or video id found yet."
      });
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
    await writeDebugInfo({
      stage: "reading_player_response",
      message: "Requesting ytInitialPlayerResponse/raw_player_response from the page.",
      videoId
    });

    const payload = await requestPlayerResponse();
    if (token !== this.loadToken) {
      return;
    }

    if (!payload) {
      await writeDebugInfo({
        stage: "missing_player_response",
        message: "The page did not return a usable player response.",
        videoId
      });
      return;
    }

    const tracksDebug = payload.captionTracks.map(toTrackDebug);
    const sourceTracks = payload.captionTracks.filter((track) => !track.languageCode.toLowerCase().startsWith("zh"));
    const selectedTrack = chooseSourceTrack(payload.captionTracks, this.settings.sourceLanguage);
    await writeDebugInfo({
      stage: "tracks_loaded",
      message: `Found ${payload.captionTracks.length} caption track(s).`,
      videoId: payload.videoId,
      title: payload.title,
      tracks: tracksDebug,
      selectedTrack: selectedTrack ? toTrackDebug(selectedTrack) : undefined
    });

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
      this.overlay.setStatus("This video already has Chinese captions.");
      await writeDebugInfo({
        stage: "skip_existing_chinese",
        message: "Chinese captions already exist, so translation is skipped.",
        videoId: payload.videoId,
        title: payload.title,
        tracks: tracksDebug
      });
      return;
    }

    if (!selectedTrack) {
      this.overlay.setStatus("No usable source caption track.");
      await writeDebugInfo({
        stage: "no_source_track",
        message: "No non-Chinese caption track is available.",
        videoId: payload.videoId,
        title: payload.title,
        tracks: tracksDebug
      });
      return;
    }

    if (!this.settings.apiKey) {
      this.overlay.setStatus("Set DeepSeek API Key in the extension popup.");
      await writeDebugInfo({
        stage: "missing_api_key",
        message: "DeepSeek API Key is empty.",
        videoId: payload.videoId,
        title: payload.title,
        tracks: tracksDebug,
        selectedTrack: toTrackDebug(selectedTrack)
      });
      return;
    }

    try {
      this.overlay.setStatus("Fetching original captions...");
      const { cues: originalCues, debug: fetchDebug } = await fetchCaptionTrackDetailed(selectedTrack);
      await writeDebugInfo({
        stage: "captions_fetched",
        message: `Parsed ${originalCues.length} caption cue(s).`,
        videoId: payload.videoId,
        title: payload.title,
        tracks: tracksDebug,
        selectedTrack: toTrackDebug(selectedTrack),
        fetch: fetchDebug,
        cueCount: originalCues.length
      });

      if (token !== this.loadToken) {
        return;
      }

      if (originalCues.length === 0) {
        this.overlay.setStatus("No caption text parsed. Open popup for debug info.");
        return;
      }

      const cacheKey = createTranslationCacheKey(payload.videoId, selectedTrack);
      const cached = await getCachedTranslation(cacheKey);
      const translated = cached ?? await this.translateAndCache(payload, selectedTrack, originalCues, cacheKey);

      if (token !== this.loadToken) {
        return;
      }

      this.overlay.setCues(translated);
      await writeDebugInfo({
        stage: cached ? "loaded_from_cache" : "translation_ready",
        message: cached ? "Loaded translated captions from local cache." : "Translation finished.",
        videoId: payload.videoId,
        title: payload.title,
        tracks: tracksDebug,
        selectedTrack: toTrackDebug(selectedTrack),
        cueCount: translated.length
      });
      this.startRendering();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Subtitle translation failed.";
      this.overlay.setStatus(message);
      await writeDebugInfo({
        stage: "error",
        message,
        videoId: payload.videoId,
        title: payload.title,
        tracks: tracksDebug,
        selectedTrack: toTrackDebug(selectedTrack),
        error: message
      });
    }
  }

  private async translateAndCache(
    payload: PlayerResponsePayload,
    selectedTrack: CaptionTrack,
    originalCues: CaptionCue[],
    cacheKey: string
  ): Promise<TranslatedCue[]> {
    const batches = createTranslationBatches(originalCues);
    await writeDebugInfo({
      stage: "translating",
      message: `Translating ${originalCues.length} cue(s) in ${batches.length} batch(es).`,
      videoId: payload.videoId,
      title: payload.title,
      selectedTrack: toTrackDebug(selectedTrack),
      cueCount: originalCues.length,
      batchCount: batches.length
    });

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
      onBatchDone: (done, total) => this.overlay?.setStatus(`Translating captions ${done}/${total}...`)
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
