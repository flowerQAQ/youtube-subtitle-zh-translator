import { browser } from "wxt/browser";
import type { CaptionTrack, CaptionTrackDebug, DebugInfo } from "./types";

export const DEBUG_INFO_KEY = "youtubeZhTranslatorDebugInfo";

export async function loadDebugInfo(): Promise<DebugInfo | null> {
  const result = await browser.storage.local.get(DEBUG_INFO_KEY);
  return isDebugInfo(result[DEBUG_INFO_KEY]) ? result[DEBUG_INFO_KEY] : null;
}

export async function writeDebugInfo(info: Omit<DebugInfo, "updatedAt">): Promise<void> {
  await browser.storage.local.set({
    [DEBUG_INFO_KEY]: {
      ...info,
      updatedAt: Date.now()
    }
  });
}

export function toTrackDebug(track: CaptionTrack): CaptionTrackDebug {
  let baseUrlHost = "";
  try {
    baseUrlHost = new URL(track.baseUrl).host;
  } catch {
    baseUrlHost = "invalid-url";
  }

  return {
    languageCode: track.languageCode,
    kind: track.kind,
    name: track.name,
    baseUrlHost,
    id: createTrackPreferenceId(track)
  };
}

export function createTrackPreferenceId(track: Pick<CaptionTrack, "languageCode" | "kind" | "name">): string {
  return [
    track.languageCode,
    track.kind ?? "manual",
    track.name ?? ""
  ].join("|");
}

function isDebugInfo(value: unknown): value is DebugInfo {
  return typeof value === "object" && value !== null && typeof (value as DebugInfo).stage === "string";
}
