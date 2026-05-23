import type { CaptionTrack } from "../shared/types";
import { createTrackPreferenceId } from "../shared/debug";

const SIMPLIFIED_CHINESE_CODES = new Set(["zh", "zh-cn", "zh-hans", "cmn-hans"]);
const PREFERRED_SOURCE_PREFIXES = ["en", "ja", "ko", "fr", "de", "es", "pt", "ru"];

export function hasSimplifiedChineseTrack(tracks: CaptionTrack[]): boolean {
  return tracks.some(isSimplifiedChineseTrack);
}

export function chooseChineseTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  const simplifiedTracks = tracks.filter(isSimplifiedChineseTrack);
  if (simplifiedTracks.length === 0) {
    return null;
  }

  return simplifiedTracks.find((track) => !isAsrTrack(track)) ?? simplifiedTracks[0] ?? null;
}

export function chooseSourceTrack(tracks: CaptionTrack[], preferredLanguage?: string): CaptionTrack | null {
  const candidates = tracks.filter((track) => !isSimplifiedChineseTrack(track));
  if (candidates.length === 0) {
    return null;
  }

  if (preferredLanguage) {
    const preferred = candidates.find((track) => {
      const normalizedPreference = normalizeLanguageCode(preferredLanguage);
      return createTrackPreferenceId(track) === preferredLanguage ||
        normalizeLanguageCode(track.languageCode) === normalizedPreference;
    });
    if (preferred) {
      return preferred;
    }
  }

  const traditionalManual = candidates.find((track) => !isAsrTrack(track) && isChineseTrack(track));
  if (traditionalManual) {
    return traditionalManual;
  }

  const traditionalAsr = candidates.find((track) => isAsrTrack(track) && isChineseTrack(track));
  if (traditionalAsr) {
    return traditionalAsr;
  }

  const englishManual = candidates.find((track) => !isAsrTrack(track) && normalizeLanguageCode(track.languageCode).startsWith("en"));
  if (englishManual) {
    return englishManual;
  }

  const englishAsr = candidates.find((track) => isAsrTrack(track) && normalizeLanguageCode(track.languageCode).startsWith("en"));
  if (englishAsr) {
    return englishAsr;
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
  const kind = isAsrTrack(track) ? "自动" : "手工";
  return name ? `${name} (${track.languageCode}, ${kind})` : `${track.languageCode} (${kind})`;
}

export function isAsrTrack(track: CaptionTrack): boolean {
  return track.kind === "asr" || track.baseUrl.includes("kind=asr");
}

function isChineseTrack(track: CaptionTrack): boolean {
  const code = normalizeLanguageCode(track.languageCode);
  return code.startsWith("zh") || code.startsWith("cmn");
}

function isSimplifiedChineseTrack(track: CaptionTrack): boolean {
  const code = normalizeLanguageCode(track.languageCode);
  return SIMPLIFIED_CHINESE_CODES.has(code) || code.startsWith("zh-hans");
}

function normalizeLanguageCode(code: string): string {
  return code.trim().toLowerCase().replace("_", "-");
}
