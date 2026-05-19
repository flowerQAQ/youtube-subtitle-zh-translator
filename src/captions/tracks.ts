import type { CaptionTrack } from "../shared/types";

const SIMPLIFIED_CHINESE_CODES = new Set(["zh", "zh-cn", "zh-hans", "cmn-hans"]);
const PREFERRED_SOURCE_PREFIXES = ["en", "ja", "ko", "fr", "de", "es", "pt", "ru"];

export function hasSimplifiedChineseTrack(tracks: CaptionTrack[]): boolean {
  return tracks.some((track) => {
    const code = normalizeLanguageCode(track.languageCode);
    return SIMPLIFIED_CHINESE_CODES.has(code) || code.startsWith("zh-hans");
  });
}

export function chooseSourceTrack(tracks: CaptionTrack[], preferredLanguage?: string): CaptionTrack | null {
  const candidates = tracks.filter((track) => !isChineseTrack(track));
  if (candidates.length === 0) {
    return null;
  }

  if (preferredLanguage) {
    const preferred = candidates.find((track) => normalizeLanguageCode(track.languageCode) === normalizeLanguageCode(preferredLanguage));
    if (preferred) {
      return preferred;
    }
  }

  const manualPreferred = candidates.find((track) => !isAsrTrack(track) && PREFERRED_SOURCE_PREFIXES.some((prefix) => normalizeLanguageCode(track.languageCode).startsWith(prefix)));
  if (manualPreferred) {
    return manualPreferred;
  }

  const manual = candidates.find((track) => !isAsrTrack(track));
  if (manual) {
    return manual;
  }

  const asrPreferred = candidates.find((track) => PREFERRED_SOURCE_PREFIXES.some((prefix) => normalizeLanguageCode(track.languageCode).startsWith(prefix)));
  return asrPreferred ?? candidates[0] ?? null;
}

export function normalizeTrackName(track: CaptionTrack): string {
  const name = track.name?.trim();
  const kind = isAsrTrack(track) ? "自动" : "人工";
  return name ? `${name} (${track.languageCode}, ${kind})` : `${track.languageCode} (${kind})`;
}

export function isAsrTrack(track: CaptionTrack): boolean {
  return track.kind === "asr" || track.baseUrl.includes("kind=asr");
}

function isChineseTrack(track: CaptionTrack): boolean {
  return normalizeLanguageCode(track.languageCode).startsWith("zh") || normalizeLanguageCode(track.languageCode).startsWith("cmn");
}

function normalizeLanguageCode(code: string): string {
  return code.trim().toLowerCase().replace("_", "-");
}
