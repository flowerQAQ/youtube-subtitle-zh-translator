import type { CaptionCue, CaptionFetchDebug, CaptionTrack } from "../shared/types";
import { parseCaptionDocument } from "./parser";

export async function fetchCaptionTrack(track: CaptionTrack): Promise<CaptionCue[]> {
  return (await fetchCaptionTrackDetailed(track)).cues;
}

export async function fetchCaptionTrackDetailed(track: CaptionTrack): Promise<{ cues: CaptionCue[]; debug: CaptionFetchDebug }> {
  const jsonUrl = withCaptionFormat(track.baseUrl, "json3");
  const jsonResponse = await fetch(jsonUrl, { credentials: "include" });
  const debug: CaptionFetchDebug = {
    attemptedUrl: redactUrl(jsonUrl),
    status: jsonResponse.status,
    contentType: jsonResponse.headers.get("content-type") ?? undefined,
    parsedCueCount: 0
  };

  if (jsonResponse.ok) {
    const raw = await jsonResponse.text();
    debug.rawPreview = preview(raw);
    try {
      const cues = parseCaptionDocument(raw, jsonResponse.headers.get("content-type") ?? "application/json");
      debug.parsedCueCount = cues.length;
      if (cues.length > 0) {
        return { cues, debug };
      }
    } catch {
      // Some tracks ignore fmt=json3 while still returning XML or another timedtext format.
    }
  }

  const fallbackResponse = await fetch(track.baseUrl, { credentials: "include" });
  debug.fallbackUrl = redactUrl(track.baseUrl);
  debug.fallbackStatus = fallbackResponse.status;
  debug.fallbackContentType = fallbackResponse.headers.get("content-type") ?? undefined;

  if (!fallbackResponse.ok) {
    throw new Error(`Subtitle request failed: HTTP ${fallbackResponse.status}`);
  }

  const raw = await fallbackResponse.text();
  debug.fallbackRawPreview = preview(raw);
  const cues = parseCaptionDocument(raw, fallbackResponse.headers.get("content-type") ?? "text/xml");
  debug.parsedCueCount = cues.length;
  return { cues, debug };
}

export function withCaptionFormat(baseUrl: string, format: "json3" | "vtt" | "srv3"): string {
  const url = new URL(baseUrl);
  url.searchParams.set("fmt", format);
  return url.toString();
}

function preview(raw: string): string {
  return raw.replace(/\s+/g, " ").slice(0, 300);
}

function redactUrl(value: string): string {
  const url = new URL(value);
  for (const key of ["signature", "sig", "lsig"]) {
    if (url.searchParams.has(key)) {
      url.searchParams.set(key, "[redacted]");
    }
  }
  return url.toString();
}
