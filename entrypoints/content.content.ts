import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";
import { chooseChineseTrack, chooseSourceTrack } from "../src/captions/tracks";
import { fetchCaptionTrackDetailed } from "../src/captions/fetcher";
import { createTranslationBatches } from "../src/translation/batching";
import { getTranslationProviderConfig, translateCaptions } from "../src/translation/deepseek";
import { createModelIdentity, createTranslationCacheKey } from "../src/cache/cacheKey";
import { getCachedTranslation, setCachedTranslation } from "../src/cache/translationCache";
import { loadSettings, SETTINGS_KEY } from "../src/shared/settings";
import { toTrackDebug, writeDebugInfo as persistDebugInfo } from "../src/shared/debug";
import type { CaptionCue, CaptionTrack, DebugInfo, ExtensionSettings, PlayerResponsePayload, TranslatedCue } from "../src/shared/types";
import { SubtitleOverlay, injectOverlayStyles } from "../src/ui/overlay";
import { createYouTubePlatformAdapter, type YouTubePlatformAdapter } from "../src/platform/edge-android/adapter";

const REQUEST_EVENT = "yt-zh-translator:request-player-response";
const RESPONSE_EVENT = "yt-zh-translator:player-response";
const REQUEST_TIMEDTEXT_EVENT = "yt-zh-translator:request-timedtext-urls";
const RESPONSE_TIMEDTEXT_EVENT = "yt-zh-translator:timedtext-urls";
const TRANSLATION_LOOKAHEAD_MS = 4 * 60 * 1000;
const SCHEDULE_CHECK_INTERVAL_MS = 5000;

export default defineContentScript({
  matches: ["https://www.youtube.com/watch*", "https://m.youtube.com/watch*"],
  runAt: "document_idle",
  main() {
    const controller = new YouTubeSubtitleTranslator(createYouTubePlatformAdapter());
    controller.start();
  }
});

class YouTubeSubtitleTranslator {
  private overlay: SubtitleOverlay | null = null;
  private settings: ExtensionSettings | null = null;
  private lastVideoId = "";
  private animationFrame = 0;
  private loadToken = 0;
  private lastScheduleCheck = 0;
  private isTranslatingWindow = false;
  private originalCues: CaptionCue[] = [];
  private translatedById = new Map<string, TranslatedCue>();
  private pendingCueIds = new Set<string>();
  private activePayload: PlayerResponsePayload | null = null;
  private activeTrack: CaptionTrack | null = null;
  private activeCacheKey = "";

  constructor(private adapter: YouTubePlatformAdapter) {}

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
    window.addEventListener("resize", () => this.updateActiveOverlayOptions());
    document.addEventListener("fullscreenchange", () => this.updateActiveOverlayOptions());
    setInterval(() => {
      const videoId = getCurrentVideoId();
      if (videoId && videoId !== this.lastVideoId) {
        void this.reload();
      }
    }, 1000);
  }

  private async reload(force = false): Promise<void> {
    const video = this.adapter.findVideo();
    const videoId = getCurrentVideoId();
    if (!video || !videoId) {
      await this.writeDebugInfo({
        stage: "waiting_for_video",
        message: "No YouTube video element or video id found yet.",
        videoFound: Boolean(video)
      });
      return;
    }

    if (!force && videoId === this.lastVideoId && this.overlay) {
      return;
    }

    this.resetActiveState();
    this.lastVideoId = videoId;
    const token = ++this.loadToken;
    this.overlay?.destroy();
    this.overlay = null;
    cancelAnimationFrame(this.animationFrame);

    this.settings = await loadSettings();
    await this.writeDebugInfo({
      stage: "reading_player_response",
      message: "Requesting ytInitialPlayerResponse/raw_player_response from the page.",
      videoId,
      videoFound: true
    });

    const payload = await requestPlayerResponse();
    if (token !== this.loadToken) {
      return;
    }

    if (!payload) {
      await this.writeDebugInfo({
        stage: "missing_player_response",
        message: "The page did not return a usable player response.",
        videoId,
        videoFound: true
      });
      return;
    }

    const tracksDebug = payload.captionTracks.map(toTrackDebug);
    const chineseTrack = chooseChineseTrack(payload.captionTracks);
    const selectedTrack = chineseTrack ?? chooseSourceTrack(payload.captionTracks, this.settings.sourceLanguage);
    await this.writeDebugInfo({
      stage: "tracks_loaded",
      message: `Found ${payload.captionTracks.length} caption track(s).`,
      videoId: payload.videoId,
      title: payload.title,
      tracks: tracksDebug,
      selectedTrack: selectedTrack ? toTrackDebug(selectedTrack) : undefined,
      videoFound: true
    });

    this.overlay = new SubtitleOverlay(video, this.adapter.createOverlayOptions(this.settings, video));

    if (!selectedTrack) {
      this.overlay.setStatus("No usable source caption track.");
      await this.writeDebugInfo({
        stage: "no_source_track",
        message: "No non-Chinese caption track is available.",
        videoId: payload.videoId,
        title: payload.title,
        tracks: tracksDebug
      });
      return;
    }

    const providerConfig = getTranslationProviderConfig(this.settings.translationProvider);
    const apiKey = getTranslationApiKey(this.settings);

    if (!chineseTrack && !apiKey) {
      this.overlay.setStatus(`Set ${providerConfig.label} API Key in the extension popup.`);
      await this.writeDebugInfo({
        stage: "missing_api_key",
        message: `${providerConfig.label} API Key is empty.`,
        videoId: payload.videoId,
        title: payload.title,
        tracks: tracksDebug,
        selectedTrack: toTrackDebug(selectedTrack)
      });
      return;
    }

    try {
      this.overlay.setStatus("");
      const initialTimedtextUrls = await requestTimedtextUrls(payload.videoId, selectedTrack, false);
      let { cues: originalCues, debug: fetchDebug } = await fetchCaptionTrackDetailed(selectedTrack, initialTimedtextUrls);
      if (originalCues.length === 0) {
        this.overlay.setStatus("");
        const tokenizedUrls = await requestTimedtextUrls(payload.videoId, selectedTrack, true);
        const retryResult = await fetchCaptionTrackDetailed(selectedTrack, tokenizedUrls);
        originalCues = retryResult.cues;
        fetchDebug = {
          ...retryResult.debug,
          tokenizedSourceCount: tokenizedUrls.length
        };
      }

      await this.writeDebugInfo({
        stage: "captions_fetched",
        message: `Parsed ${originalCues.length} caption cue(s).`,
        videoId: payload.videoId,
        title: payload.title,
        tracks: tracksDebug,
        selectedTrack: toTrackDebug(selectedTrack),
        fetch: fetchDebug,
        cueCount: originalCues.length,
        timedtextUrlCount: fetchDebug.tokenizedSourceCount ?? initialTimedtextUrls.length
      });

      if (token !== this.loadToken) {
        return;
      }

      if (originalCues.length === 0) {
        this.overlay.setStatus("No caption text parsed. Open popup for debug info.");
        return;
      }

      if (chineseTrack) {
        const directChineseCues = originalCues.map((cue): TranslatedCue => ({
          ...cue,
          translatedText: cue.text
        }));
        this.originalCues = originalCues;
        this.translatedById = new Map(directChineseCues.map((cue) => [cue.id, cue]));
        this.overlay.setCues(directChineseCues);
        this.startRendering();
        await this.writeDebugInfo({
          stage: "chinese_captions_ready",
          message: `Showing ${directChineseCues.length} existing Chinese caption cue(s).`,
          videoId: payload.videoId,
          title: payload.title,
          tracks: tracksDebug,
          selectedTrack: toTrackDebug(chineseTrack),
          fetch: fetchDebug,
          cueCount: directChineseCues.length
        });
        return;
      }

      this.activePayload = payload;
      this.activeTrack = selectedTrack;
      this.originalCues = originalCues;
      this.activeCacheKey = createTranslationCacheKey(
        payload.videoId,
        selectedTrack,
        createModelIdentity(this.settings.translationProvider, providerConfig.model)
      );

      const cached = await getCachedTranslation(this.activeCacheKey);
      this.translatedById = new Map((cached ?? []).map((cue) => [cue.id, cue]));
      this.overlay.setCues(this.getSortedTranslatedCues());
      this.startRendering();
      await this.scheduleTranslationWindow(token, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Subtitle translation failed.";
      this.overlay.setStatus(message);
      await this.writeDebugInfo({
        stage: "error",
        message,
        videoId: payload.videoId,
        title: payload.title,
        tracks: tracksDebug,
        selectedTrack: selectedTrack ? toTrackDebug(selectedTrack) : undefined,
        error: message
      });
    }
  }

  private async scheduleTranslationWindow(token: number, force = false): Promise<void> {
    if (token !== this.loadToken || this.isTranslatingWindow || !this.settings || !getTranslationApiKey(this.settings) || !this.activePayload || !this.activeTrack || !this.overlay) {
      return;
    }

    if (this.settings.displayMode === "off") {
      return;
    }

    const video = this.adapter.findVideo();
    if (!video) {
      return;
    }

    const startMs = Math.max(0, (video.currentTime * 1000) - 5000);
    const endMs = startMs + TRANSLATION_LOOKAHEAD_MS;
    const cuesToTranslate = this.originalCues.filter((cue) => {
      const overlapsWindow = cue.startMs + cue.durationMs >= startMs && cue.startMs <= endMs;
      return overlapsWindow && !this.translatedById.has(cue.id) && !this.pendingCueIds.has(cue.id);
    });

    if (cuesToTranslate.length === 0) {
      if (force && this.translatedById.size > 0) {
        this.overlay.setStatus("");
      }
      return;
    }

    for (const cue of cuesToTranslate) {
      this.pendingCueIds.add(cue.id);
    }

    const batches = createTranslationBatches(cuesToTranslate);
    this.isTranslatingWindow = true;
    await this.writeDebugInfo({
      stage: "translating_window",
      message: `Translating ${cuesToTranslate.length} cue(s) from the next ${Math.round(TRANSLATION_LOOKAHEAD_MS / 60000)} minutes.`,
      videoId: this.activePayload.videoId,
      title: this.activePayload.title,
      selectedTrack: toTrackDebug(this.activeTrack),
      cueCount: this.translatedById.size,
      batchCount: batches.length
    });

    try {
      await translateCaptions({
        provider: this.settings.translationProvider,
        apiKey: getTranslationApiKey(this.settings),
        sourceLanguage: this.activeTrack.languageCode,
        videoContext: {
          videoId: this.activePayload.videoId,
          title: this.activePayload.title,
          channelName: this.activePayload.channelName,
          shortDescription: this.activePayload.shortDescription?.slice(0, 1200)
        },
        batches,
        onBatchDone: (done, total) => {
          void this.writeDebugInfo({
            stage: "translating_window",
            message: `Translated batch ${done}/${total} for the upcoming caption window.`,
            videoId: this.activePayload?.videoId,
            title: this.activePayload?.title,
            selectedTrack: this.activeTrack ? toTrackDebug(this.activeTrack) : undefined,
            cueCount: this.translatedById.size,
            batchCount: total
          });
        },
        onBatchTranslated: (translatedBatch, done, total) => {
          if (token !== this.loadToken) {
            return;
          }

          for (const cue of translatedBatch) {
            this.pendingCueIds.delete(cue.id);
            this.translatedById.set(cue.id, cue);
          }

          const translated = this.getSortedTranslatedCues();
          this.overlay?.setCues(translated);
          void setCachedTranslation(this.activeCacheKey, translated);
        }
      });
    } finally {
      for (const cue of cuesToTranslate) {
        this.pendingCueIds.delete(cue.id);
      }
      this.isTranslatingWindow = false;
      if (token === this.loadToken) {
        const translated = this.getSortedTranslatedCues();
        this.overlay?.setCues(translated);
        this.overlay?.setStatus("");
        await setCachedTranslation(this.activeCacheKey, translated);
        await this.writeDebugInfo({
          stage: "translation_window_ready",
          message: `Translated ${translated.length} cue(s) in cache. Future windows will translate lazily.`,
          videoId: this.activePayload.videoId,
          title: this.activePayload.title,
          selectedTrack: toTrackDebug(this.activeTrack),
          cueCount: translated.length
        });
      }
    }
  }

  private startRendering(): void {
    const render = () => {
      const video = this.adapter.findVideo();
      if (video && this.overlay) {
        const now = performance.now();
        this.overlay.renderForTime(video.currentTime * 1000);
        if (now - this.lastScheduleCheck >= SCHEDULE_CHECK_INTERVAL_MS) {
          this.lastScheduleCheck = now;
          void this.scheduleTranslationWindow(this.loadToken);
        }
      }
      this.animationFrame = requestAnimationFrame(render);
    };
    render();
  }

  private getSortedTranslatedCues(): TranslatedCue[] {
    return Array.from(this.translatedById.values()).sort((a, b) => a.startMs - b.startMs);
  }

  private updateActiveOverlayOptions(): void {
    if (!this.overlay || !this.settings) {
      return;
    }

    const video = this.adapter.findVideo();
    if (video) {
      this.overlay.updateOptions(this.adapter.createOverlayOptions(this.settings, video));
    }
  }

  private resetActiveState(): void {
    this.isTranslatingWindow = false;
    this.lastScheduleCheck = 0;
    this.originalCues = [];
    this.translatedById = new Map();
    this.pendingCueIds = new Set();
    this.activePayload = null;
    this.activeTrack = null;
    this.activeCacheKey = "";
  }

  private async writeDebugInfo(info: Omit<DebugInfo, "updatedAt">): Promise<void> {
    await persistDebugInfo({
      ...this.adapter.createDebugContext({
        videoFound: info.videoFound ?? Boolean(this.adapter.findVideo()),
        timedtextUrlCount: info.timedtextUrlCount
      }),
      ...info
    });
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

function requestTimedtextUrls(videoId: string, track: CaptionTrack, triggerNative: boolean): Promise<string[]> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener(RESPONSE_TIMEDTEXT_EVENT, onResponse);
      resolve([]);
    }, triggerNative ? 1800 : 500);

    const onResponse = (event: Event) => {
      window.clearTimeout(timeout);
      window.removeEventListener(RESPONSE_TIMEDTEXT_EVENT, onResponse);
      const urls = (event as CustomEvent<string[]>).detail;
      resolve(Array.isArray(urls) ? urls : []);
    };

    window.addEventListener(RESPONSE_TIMEDTEXT_EVENT, onResponse);
    window.dispatchEvent(new CustomEvent(REQUEST_TIMEDTEXT_EVENT, {
      detail: {
        videoId,
        languageCode: track.languageCode,
        kind: track.kind,
        triggerNative
      }
    }));
  });
}

function getCurrentVideoId(): string {
  return new URL(location.href).searchParams.get("v") ?? "";
}

function getTranslationApiKey(settings: ExtensionSettings): string {
  return settings.translationProvider === "xiaomi-mimo"
    ? settings.mimoApiKey
    : settings.deepseekApiKey;
}
