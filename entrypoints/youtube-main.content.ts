import { defineContentScript } from "wxt/utils/define-content-script";
import { normalizePlayerResponse } from "../src/youtube/playerResponse";

const REQUEST_EVENT = "yt-zh-translator:request-player-response";
const RESPONSE_EVENT = "yt-zh-translator:player-response";
const REQUEST_TIMEDTEXT_EVENT = "yt-zh-translator:request-timedtext-urls";
const RESPONSE_TIMEDTEXT_EVENT = "yt-zh-translator:timedtext-urls";
const capturedTimedtextUrls: string[] = [];

export default defineContentScript({
  matches: ["https://www.youtube.com/watch*", "https://m.youtube.com/watch*"],
  runAt: "document_start",
  world: "MAIN",
  main() {
    installTimedtextCapture();

    window.addEventListener(REQUEST_EVENT, () => {
      const fallback = {
        videoId: new URL(location.href).searchParams.get("v") ?? "",
        title: document.title.replace(/ - YouTube$/, "")
      };

      const raw = readPlayerResponseFromWindow() ?? readPlayerResponseFromScripts();
      const payload = normalizePlayerResponse(raw, fallback);
      window.dispatchEvent(new CustomEvent(RESPONSE_EVENT, { detail: payload }));
    });

    window.addEventListener(REQUEST_TIMEDTEXT_EVENT, (event) => {
      collectPerformanceTimedtextUrls();
      const detail = (event as CustomEvent<{ videoId?: string; languageCode?: string; kind?: string; triggerNative?: boolean }>).detail ?? {};
      if (detail.triggerNative) {
        triggerNativeCaptions();
        window.setTimeout(() => {
          collectPerformanceTimedtextUrls();
          window.dispatchEvent(new CustomEvent(RESPONSE_TIMEDTEXT_EVENT, {
            detail: filterTimedtextUrls(detail)
          }));
        }, 1200);
        return;
      }

      window.dispatchEvent(new CustomEvent(RESPONSE_TIMEDTEXT_EVENT, {
        detail: filterTimedtextUrls(detail)
      }));
    });
  }
});

function installTimedtextCapture(): void {
  const pageWindow = window as typeof window & {
    __ytZhTranslatorCaptureInstalled?: boolean;
  };
  if (pageWindow.__ytZhTranslatorCaptureInstalled) {
    return;
  }
  pageWindow.__ytZhTranslatorCaptureInstalled = true;

  const originalFetch = window.fetch;
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    captureMaybeTimedtextUrl(typeof input === "string" || input instanceof URL ? String(input) : input.url);
    return originalFetch.call(window, input, init);
  }) as typeof window.fetch;

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function patchedOpen(method: string, url: string | URL, ...rest: unknown[]) {
    captureMaybeTimedtextUrl(String(url));
    const async = typeof rest[0] === "boolean" ? rest[0] : true;
    const user = typeof rest[1] === "string" ? rest[1] : undefined;
    const password = typeof rest[2] === "string" ? rest[2] : undefined;
    return originalOpen.call(this, method, url, async, user, password);
  };

  collectPerformanceTimedtextUrls();
}

function collectPerformanceTimedtextUrls(): void {
  for (const entry of performance.getEntriesByType("resource")) {
    captureMaybeTimedtextUrl(entry.name);
  }
}

function captureMaybeTimedtextUrl(value: string): void {
  if (!value.includes("/api/timedtext")) {
    return;
  }

  try {
    const url = new URL(value, location.href);
    if (!url.searchParams.get("v")) {
      return;
    }
    const normalized = url.toString();
    if (!capturedTimedtextUrls.includes(normalized)) {
      capturedTimedtextUrls.unshift(normalized);
      capturedTimedtextUrls.splice(30);
    }
  } catch {
    // Ignore malformed resource names.
  }
}

function filterTimedtextUrls(detail: { videoId?: string; languageCode?: string; kind?: string }): string[] {
  return capturedTimedtextUrls.filter((value) => {
    const url = new URL(value);
    const videoMatches = !detail.videoId || url.searchParams.get("v") === detail.videoId;
    const languageMatches = !detail.languageCode || url.searchParams.get("lang") === detail.languageCode;
    const kindMatches = !detail.kind || url.searchParams.get("kind") === detail.kind || (!url.searchParams.get("kind") && detail.kind !== "asr");
    return videoMatches && languageMatches && kindMatches;
  });
}

function triggerNativeCaptions(): void {
  const button = document.querySelector<HTMLButtonElement>(".ytp-subtitles-button");
  if (!button) {
    return;
  }

  const pressed = button.getAttribute("aria-pressed") === "true";
  if (!pressed) {
    button.click();
  }
}

function readPlayerResponseFromWindow(): unknown {
  const pageWindow = window as unknown as {
    ytInitialPlayerResponse?: unknown;
    raw_player_response?: unknown;
  };

  return pageWindow.ytInitialPlayerResponse ?? pageWindow.raw_player_response;
}

function readPlayerResponseFromScripts(): unknown {
  for (const script of Array.from(document.scripts)) {
    const text = script.textContent ?? "";
    const marker = "ytInitialPlayerResponse";
    const index = text.indexOf(marker);
    if (index < 0) {
      continue;
    }

    const jsonStart = text.indexOf("{", index);
    if (jsonStart < 0) {
      continue;
    }

    const jsonText = extractBalancedJson(text, jsonStart);
    if (!jsonText) {
      continue;
    }

    try {
      return JSON.parse(jsonText);
    } catch {
      continue;
    }
  }

  return null;
}

function extractBalancedJson(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}
