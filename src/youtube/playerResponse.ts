import type { CaptionTrack, PlayerResponsePayload } from "../shared/types";

interface RawCaptionTrack {
  baseUrl?: string;
  languageCode?: string;
  kind?: string;
  name?: {
    simpleText?: string;
    runs?: Array<{ text?: string }>;
  };
  isTranslatable?: boolean;
}

interface RawPlayerResponse {
  videoDetails?: {
    videoId?: string;
    title?: string;
    author?: string;
    shortDescription?: string;
  };
  microformat?: {
    playerMicroformatRenderer?: {
      ownerChannelName?: string;
      title?: { simpleText?: string };
      description?: { simpleText?: string };
    };
  };
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: RawCaptionTrack[];
    };
  };
}

export function normalizePlayerResponse(raw: unknown, fallback: { videoId: string; title: string }): PlayerResponsePayload | null {
  if (!isRecord(raw)) {
    return null;
  }

  const response = raw as RawPlayerResponse;
  const videoDetails = response.videoDetails;
  const microformat = response.microformat?.playerMicroformatRenderer;
  const rawTracks = response.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  const captionTracks = rawTracks.map(normalizeCaptionTrack).filter((track): track is CaptionTrack => track !== null);

  return {
    videoId: videoDetails?.videoId ?? fallback.videoId,
    title: videoDetails?.title ?? microformat?.title?.simpleText ?? fallback.title,
    channelName: videoDetails?.author ?? microformat?.ownerChannelName,
    shortDescription: videoDetails?.shortDescription ?? microformat?.description?.simpleText,
    captionTracks
  };
}

function normalizeCaptionTrack(track: RawCaptionTrack): CaptionTrack | null {
  if (!track.baseUrl || !track.languageCode) {
    return null;
  }

  return {
    baseUrl: track.baseUrl,
    languageCode: track.languageCode,
    kind: track.kind,
    name: extractName(track.name),
    isTranslatable: track.isTranslatable
  };
}

function extractName(name: RawCaptionTrack["name"]): string | undefined {
  if (!name) {
    return undefined;
  }

  return name.simpleText ?? name.runs?.map((run) => run.text ?? "").join("").trim() ?? undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
