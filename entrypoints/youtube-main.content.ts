import { defineContentScript } from "wxt/utils/define-content-script";
import { normalizePlayerResponse } from "../src/youtube/playerResponse";

const REQUEST_EVENT = "yt-zh-translator:request-player-response";
const RESPONSE_EVENT = "yt-zh-translator:player-response";

export default defineContentScript({
  matches: ["https://www.youtube.com/watch*", "https://m.youtube.com/watch*"],
  runAt: "document_start",
  world: "MAIN",
  main() {
    window.addEventListener(REQUEST_EVENT, () => {
      const fallback = {
        videoId: new URL(location.href).searchParams.get("v") ?? "",
        title: document.title.replace(/ - YouTube$/, "")
      };

      const raw = readPlayerResponseFromWindow() ?? readPlayerResponseFromScripts();
      const payload = normalizePlayerResponse(raw, fallback);
      window.dispatchEvent(new CustomEvent(RESPONSE_EVENT, { detail: payload }));
    });
  }
});

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
