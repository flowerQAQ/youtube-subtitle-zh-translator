import type { CaptionCue } from "../shared/types";

interface Json3Event {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: Array<{ utf8?: string }>;
}

export function parseCaptionDocument(raw: string, contentType = ""): CaptionCue[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }

  if (contentType.includes("json") || trimmed.startsWith("{")) {
    return parseJson3Captions(trimmed);
  }

  return parseXmlCaptions(trimmed);
}

export function parseJson3Captions(raw: string): CaptionCue[] {
  const parsed = JSON.parse(raw) as { events?: Json3Event[] };
  const events = parsed.events ?? [];
  const cues: CaptionCue[] = [];

  for (const event of events) {
    const text = normalizeCaptionText((event.segs ?? []).map((seg) => seg.utf8 ?? "").join(""));
    if (!text || typeof event.tStartMs !== "number") {
      continue;
    }

    cues.push({
      id: String(cues.length),
      startMs: event.tStartMs,
      durationMs: typeof event.dDurationMs === "number" ? event.dDurationMs : 1800,
      text
    });
  }

  return cues;
}

export function parseXmlCaptions(raw: string): CaptionCue[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, "text/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error("Unable to parse YouTube caption XML.");
  }

  return Array.from(doc.querySelectorAll("text")).map((node, index) => {
    const startSeconds = Number(node.getAttribute("start") ?? "0");
    const durationSeconds = Number(node.getAttribute("dur") ?? "1.8");
    return {
      id: String(index),
      startMs: Math.max(0, Math.round(startSeconds * 1000)),
      durationMs: Math.max(200, Math.round(durationSeconds * 1000)),
      text: normalizeCaptionText(node.textContent ?? "")
    };
  }).filter((cue) => cue.text.length > 0);
}

export function normalizeCaptionText(text: string): string {
  const textarea = globalThis.document?.createElement?.("textarea");
  if (textarea) {
    textarea.innerHTML = text;
    text = textarea.value;
  }

  return text
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}
