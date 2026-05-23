import type { CaptionCue, TranslatedCue, TranslationBatch, TranslationProvider, VideoContext } from "../shared/types";

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export interface TranslationItem {
  id: string;
  text: string;
  error?: string;
}

interface ProviderConfig {
  id: TranslationProvider;
  label: string;
  endpoint: string;
  model: string;
  temperature: number;
  topP?: number;
  responseFormat?: boolean;
  thinkingDisabled?: boolean;
  createAuthHeaders: (apiKey: string) => Record<string, string>;
}

export const TRANSLATION_PROVIDER_CONFIGS: Record<TranslationProvider, ProviderConfig> = {
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    endpoint: "https://api.deepseek.com/chat/completions",
    model: "deepseek-v4-flash",
    temperature: 0.2,
    responseFormat: true,
    createAuthHeaders: (apiKey) => ({
      "Authorization": `Bearer ${apiKey}`
    })
  },
  "xiaomi-mimo": {
    id: "xiaomi-mimo",
    label: "Xiaomi MiMo",
    endpoint: "https://token-plan-cn.xiaomimimo.com/v1/chat/completions",
    model: "mimo-v2.5",
    temperature: 0.2,
    topP: 0.95,
    thinkingDisabled: true,
    createAuthHeaders: (apiKey) => ({
      "Authorization": `Bearer ${apiKey}`
    })
  }
};

export function getTranslationProviderConfig(provider: TranslationProvider): ProviderConfig {
  return TRANSLATION_PROVIDER_CONFIGS[provider] ?? TRANSLATION_PROVIDER_CONFIGS.deepseek;
}

export function createTranslationRequest(params: {
  provider: TranslationProvider;
  apiKey: string;
  sourceLanguage: string;
  videoContext: VideoContext;
  batch: TranslationBatch;
}): { endpoint: string; init: RequestInit } {
  const config = getTranslationProviderConfig(params.provider);
  const body: Record<string, unknown> = {
    model: config.model,
    temperature: config.temperature,
    stream: false,
    messages: [
      {
        role: "system",
        content: [
          "You translate video subtitles into natural Simplified Chinese.",
          "Use Simplified Chinese characters only (zh-Hans-CN).",
          "If the source text is Traditional Chinese, convert it to Simplified Chinese and do not preserve Traditional Chinese characters.",
          "Preserve meaning, names, technical terms, tone, and line order.",
          "Return JSON only, shaped as {\"translations\":[{\"id\":\"...\",\"text\":\"...\"}]}."
        ].join(" ")
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "Translate every subtitle text to Simplified Chinese (zh-Hans-CN). Use Simplified Chinese characters only. Keep the same ids.",
          targetLanguage: "zh-Hans-CN",
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
  };

  if (config.topP !== undefined) {
    body.top_p = config.topP;
  }

  if (config.responseFormat) {
    body.response_format = { type: "json_object" };
  }

  if (config.thinkingDisabled) {
    body.thinking = { type: "disabled" };
  }

  return {
    endpoint: config.endpoint,
    init: {
      method: "POST",
      headers: {
        ...config.createAuthHeaders(params.apiKey),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }
  };
}

export async function translateCaptions(params: {
  provider: TranslationProvider;
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
      provider: params.provider,
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
  provider: TranslationProvider;
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
  provider: TranslationProvider;
  apiKey: string;
  sourceLanguage: string;
  videoContext: VideoContext;
  batch: TranslationBatch;
}): Promise<TranslationItem[]> {
  const request = createTranslationRequest(params);
  const config = getTranslationProviderConfig(params.provider);
  const response = await fetch(request.endpoint, request.init);

  if (!response.ok) {
    throw new Error(`${config.label} 请求失败：HTTP ${response.status}`);
  }

  const data = await response.json() as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`${config.label} 没有返回文本。`);
  }

  return parseTranslationResponse(content, params.batch.cues);
}

export function parseTranslationResponse(content: string, expectedCues: CaptionCue[]): TranslationItem[] {
  const jsonText = extractJsonText(content);
  const parsed = JSON.parse(jsonText) as { translations?: TranslationItem[] } | TranslationItem[];
  const items = Array.isArray(parsed) ? parsed : parsed.translations;

  if (!Array.isArray(items)) {
    throw new Error("翻译响应缺少 translations 数组。");
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
