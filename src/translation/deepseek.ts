import type { CaptionCue, TranslatedCue, TranslationBatch, VideoContext } from "../shared/types";

const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = "deepseek-v4-flash";

interface DeepSeekResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

interface TranslationItem {
  id: string;
  text: string;
  error?: string;
}

export async function translateCaptions(params: {
  apiKey: string;
  sourceLanguage: string;
  videoContext: VideoContext;
  batches: TranslationBatch[];
  onBatchDone?: (done: number, total: number) => void;
  onBatchTranslated?: (cues: TranslatedCue[], done: number, total: number) => void;
}): Promise<TranslatedCue[]> {
  const translated: TranslatedCue[] = [];

  for (const batch of params.batches) {
    const items = await translateBatchWithRetry({
      apiKey: params.apiKey,
      sourceLanguage: params.sourceLanguage,
      videoContext: params.videoContext,
      batch
    });

    const byId = new Map(items.map((item) => [item.id, item.text]));
    const translatedBatch = batch.cues.map((cue) => ({
      ...cue,
      translatedText: byId.get(cue.id) ?? cue.text,
      translationError: items.find((item) => item.id === cue.id)?.error ?? (byId.has(cue.id) ? undefined : "missing_translation")
    }));
    translated.push(...translatedBatch);

    params.onBatchDone?.(batch.batchId + 1, params.batches.length);
    params.onBatchTranslated?.(translatedBatch, batch.batchId + 1, params.batches.length);
  }

  return translated;
}

async function translateBatchWithRetry(params: {
  apiKey: string;
  sourceLanguage: string;
  videoContext: VideoContext;
  batch: TranslationBatch;
}): Promise<TranslationItem[]> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await translateBatch(params);
    } catch (error) {
      lastError = error;
      await delay(600 * (attempt + 1));
    }
  }

  const message = lastError instanceof Error ? lastError.message : "translation_failed";
  return params.batch.cues.map((cue) => ({
    id: cue.id,
    text: cue.text,
    error: message
  }));
}

async function translateBatch(params: {
  apiKey: string;
  sourceLanguage: string;
  videoContext: VideoContext;
  batch: TranslationBatch;
}): Promise<TranslationItem[]> {
  const response = await fetch(DEEPSEEK_ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${params.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      temperature: 0.2,
      stream: false,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You translate video subtitles into natural Simplified Chinese.",
            "Preserve meaning, names, technical terms, tone, and line order.",
            "Return JSON only, shaped as {\"translations\":[{\"id\":\"...\",\"text\":\"...\"}]}."
          ].join(" ")
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Translate every subtitle text to Simplified Chinese. Keep the same ids.",
            sourceLanguage: params.sourceLanguage,
            video: params.videoContext,
            subtitles: params.batch.cues.map((cue) => ({
              id: cue.id,
              startMs: cue.startMs,
              text: cue.text
            }))
          })
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`DeepSeek 请求失败：HTTP ${response.status}`);
  }

  const data = await response.json() as DeepSeekResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("DeepSeek 没有返回文本。");
  }

  return parseTranslationResponse(content, params.batch.cues);
}

export function parseTranslationResponse(content: string, expectedCues: CaptionCue[]): TranslationItem[] {
  const jsonText = extractJsonText(content);
  const parsed = JSON.parse(jsonText) as { translations?: TranslationItem[] } | TranslationItem[];
  const items = Array.isArray(parsed) ? parsed : parsed.translations;

  if (!Array.isArray(items)) {
    throw new Error("DeepSeek 响应缺少 translations 数组。");
  }

  const expectedIds = new Set(expectedCues.map((cue) => cue.id));
  return items
    .filter((item): item is TranslationItem => typeof item?.id === "string" && typeof item?.text === "string")
    .filter((item) => expectedIds.has(item.id));
}

function extractJsonText(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() ?? trimmed;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
