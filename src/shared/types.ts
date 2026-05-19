export type DisplayMode = "zh" | "bilingual" | "off";

export interface ExtensionSettings {
  apiKey: string;
  displayMode: DisplayMode;
  fontScale: number;
  verticalOffset: number;
  sourceLanguage?: string;
}

export interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
  name?: string;
  isTranslatable?: boolean;
}

export interface CaptionCue {
  id: string;
  startMs: number;
  durationMs: number;
  text: string;
}

export interface TranslatedCue extends CaptionCue {
  translatedText: string;
  translationError?: string;
}

export interface VideoContext {
  videoId: string;
  title: string;
  channelName?: string;
  shortDescription?: string;
}

export interface PlayerResponsePayload {
  videoId: string;
  title: string;
  channelName?: string;
  shortDescription?: string;
  captionTracks: CaptionTrack[];
}

export interface TranslationBatch {
  batchId: number;
  cues: CaptionCue[];
}
