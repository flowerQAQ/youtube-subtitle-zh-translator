import type { CaptionTrack } from "../shared/types";

const PROMPT_VERSION = "v1";
const MODEL_VERSION = "deepseek-v4-flash";

export function createTranslationCacheKey(videoId: string, track: CaptionTrack): string {
  const url = new URL(track.baseUrl);
  const identityParams = ["lang", "name", "kind", "v", "tlang"];
  const signature = identityParams
    .map((key) => `${key}=${url.searchParams.get(key) ?? ""}`)
    .join("&");

  return [
    "yt-zh-caption",
    PROMPT_VERSION,
    MODEL_VERSION,
    videoId,
    track.languageCode,
    stableHash(signature || track.baseUrl)
  ].join(":");
}

function stableHash(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}
