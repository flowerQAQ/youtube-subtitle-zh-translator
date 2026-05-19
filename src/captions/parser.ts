import type { CaptionCue } from "../shared/types";

interface Json3Event {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: Array<{ utf8?: string }>;
  utf8?: string;
}

export function parseCaptionDocument(raw: string, contentType = ""): CaptionCue[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }

  if (contentType.includes("json") || trimmed.startsWith("{")) {
    return parseJson3Captions(trimmed);
  }

  if (trimmed.startsWith("WEBVTT")) {
    return parseVttCaptions(trimmed);
  }

  return parseXmlCaptions(trimmed);
}

export function parseJson3Captions(raw: string): CaptionCue[] {
  const parsed = JSON.parse(raw) as { events?: Json3Event[] };
  const events = parsed.events ?? [];
  const cues: CaptionCue[] = [];

  for (const event of events) {
    const text = normalizeCaptionText((event.segs ?? []).map((seg) => seg.utf8 ?? "").join("") || event.utf8 || "");
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

  const textCues = Array.from(doc.querySelectorAll("text")).map((node, index) => {
    const startSeconds = Number(node.getAttribute("start") ?? "0");
    const durationSeconds = Number(node.getAttribute("dur") ?? "1.8");
    return {
      id: String(index),
      startMs: Math.max(0, Math.round(startSeconds * 1000)),
      durationMs: Math.max(200, Math.round(durationSeconds * 1000)),
      text: normalizeCaptionText(node.textContent ?? "")
    };
  }).filter((cue) => cue.text.length > 0);

  if (textCues.length > 0) {
    return textCues;
  }

  return Array.from(doc.querySelectorAll("p")).map((node, index) => {
    const startMs = Number(node.getAttribute("t") ?? "0");
    const durationMs = Number(node.getAttribute("d") ?? "1800");
    return {
      id: String(index),
      startMs: Math.max(0, startMs),
      durationMs: Math.max(200, durationMs),
      text: normalizeCaptionText(node.textContent ?? "")
    };
  }).filter((cue) => cue.text.length > 0);
}

export function parseVttCaptions(raw: string): CaptionCue[] {
  const blocks = raw.replace(/\r/g, "").split(/\n\n+/);
  const cues: CaptionCue[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const timingLineIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingLineIndex < 0) {
      continue;
    }

    const timing = lines[timingLineIndex];
    if (!timing) {
      continue;
    }

    const [start, end] = timing.split("-->").map((part) => part.trim());
    if (!start || !end) {
      continue;
    }

    const startMs = parseVttTime(start);
    const endMs = parseVttTime(end.split(/\s+/)[0] ?? "");
    const text = normalizeCaptionText(lines.slice(timingLineIndex + 1).join(" "));
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || !text) {
      continue;
    }

    cues.push({
      id: String(cues.length),
      startMs,
      durationMs: Math.max(200, endMs - startMs),
      text
    });
  }

  return cues;
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

function parseVttTime(value: string): number {
  const match = value.match(/(?:(\d+):)?(\d{2}):(\d{2})[.,](\d{3})/);
  if (!match) {
    return Number.NaN;
  }

  const hours = Number(match[1] ?? "0");
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const milliseconds = Number(match[4]);
  return (((hours * 60) + minutes) * 60 + seconds) * 1000 + milliseconds;
}
