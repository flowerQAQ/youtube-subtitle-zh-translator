import type { CaptionCue, CaptionTrack } from "../shared/types";
import { parseCaptionDocument } from "./parser";

export async function fetchCaptionTrack(track: CaptionTrack): Promise<CaptionCue[]> {
  const jsonUrl = withCaptionFormat(track.baseUrl, "json3");
  const jsonResponse = await fetch(jsonUrl, { credentials: "include" });

  if (jsonResponse.ok) {
    const raw = await jsonResponse.text();
    try {
      return parseCaptionDocument(raw, jsonResponse.headers.get("content-type") ?? "application/json");
    } catch {
      // Fall through to XML below. Some tracks ignore fmt=json3 while still returning XML.
    }
  }

  const xmlResponse = await fetch(track.baseUrl, { credentials: "include" });
  if (!xmlResponse.ok) {
    throw new Error(`字幕请求失败：HTTP ${xmlResponse.status}`);
  }

  return parseCaptionDocument(await xmlResponse.text(), xmlResponse.headers.get("content-type") ?? "text/xml");
}

export function withCaptionFormat(baseUrl: string, format: "json3" | "vtt" | "srv3"): string {
  const url = new URL(baseUrl);
  url.searchParams.set("fmt", format);
  return url.toString();
}
