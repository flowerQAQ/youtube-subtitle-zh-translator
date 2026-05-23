import type { CaptionTrack, TranslationProvider } from "../shared/types";

const PROMPT_VERSION = "v1";

export function createTranslationCacheKey(videoId: string, track: CaptionTrack, modelIdentity = "deepseek:deepseek-v4-flash"): string {
  const url = new URL(track.baseUrl);
  const identityParams = ["lang", "name", "kind", "v", "tlang"];
  const signature = identityParams
    .map((key) => `${key}=${url.searchParams.get(key) ?? ""}`)
    .join("&");

  return [
    "yt-zh-caption",
    PROMPT_VERSION,
    modelIdentity,
    videoId,
    track.languageCode,
    stableHash(signature || track.baseUrl)
  ].join(":");
}

export function createModelIdentity(provider: TranslationProvider, model: string): string {
  return `${provider}:${model}`;
}

function stableHash(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}
