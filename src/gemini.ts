import { ConfigKeys, getConfig, getGeminiApiKey, getOptionalConfig } from './config';
import { ChatMessage, fetchJson } from './http';
import { joinUrl } from './url';

const DEFAULT_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com';

export function getGeminiGenerateContentRequestUrl(
  modelName: string | undefined,
  baseUrl: string | undefined
): string {
  const effectiveBaseURL = (baseUrl && baseUrl.trim()) || DEFAULT_GEMINI_BASE_URL;
  const safeModel = geminiModelId(modelName);
  return joinUrl(effectiveBaseURL, `v1beta/models/${safeModel}:generateContent`);
}

function geminiModelId(modelName: string | undefined): string {
  const trimmed = (modelName || '').trim();
  if (!trimmed) {
    return '{model}';
  }
  return trimmed.startsWith('models/') ? trimmed.slice('models/'.length) : trimmed;
}

export async function completeGemini(messages: ChatMessage[]): Promise<string> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      'Gemini API Key not configured. Run "Nota AI Commit: Set Gemini API Key".'
    );
  }

  const model = getConfig(ConfigKeys.GEMINI_MODEL, 'gemini-3.8-flash');
  const temperature = getConfig(ConfigKeys.GEMINI_TEMPERATURE, 0.7);
  const baseUrl = getOptionalConfig<string>(ConfigKeys.GEMINI_BASE_URL);
  const systemInstruction = messages
    .filter(({ role }) => role === 'system')
    .map(({ content }) => content)
    .join('\n\n');
  const contents = messages
    .filter(({ role }) => role !== 'system')
    .map(({ content }) => content)
    .join('\n\n');

  const response = await fetchJson<{
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  }>({
    url: getGeminiGenerateContentRequestUrl(model, baseUrl),
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey },
    body: {
      contents: [{ role: 'user', parts: [{ text: contents }] }],
      generationConfig: { temperature },
      ...(systemInstruction
        ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
        : {})
    }
  });

  const text = (response.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? '')
    .join('');

  if (!text) {
    throw new Error('Gemini response was empty or incompatible.');
  }
  return text;
}
