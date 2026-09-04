import {
  ConfigKeys,
  getConfig,
  getExtensionContext,
  getOpenAIApiKey,
  getOptionalConfig,
  MODELS_STATE_KEY
} from './config';
import { ChatMessage, fetchJson } from './http';
import { logError } from './output';
import { joinUrl, withQuery } from './url';

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';

export function getOpenAIChatCompletionsRequestUrl(
  baseURL: string | undefined,
  azureApiVersion: string | undefined
): string {
  const url = joinUrl(effectiveOpenAIBaseURL(baseURL), 'chat/completions');
  const version = azureApiVersion?.trim();
  return version ? withQuery(url, { 'api-version': version }) : url;
}

function getOpenAIModelsRequestUrl(
  baseURL: string | undefined,
  azureApiVersion: string | undefined
): string {
  const url = joinUrl(effectiveOpenAIBaseURL(baseURL), 'models');
  const version = azureApiVersion?.trim();
  return version ? withQuery(url, { 'api-version': version }) : url;
}

function effectiveOpenAIBaseURL(baseURL: string | undefined): string {
  return (baseURL && baseURL.trim()) || DEFAULT_OPENAI_BASE_URL;
}

function getOpenAIBaseURLHint(
  baseURL: string | undefined,
  azureApiVersion: string | undefined
): string {
  const trimmed = (baseURL || '').trim();
  if (azureApiVersion?.trim()) {
    return `（Azure）请填写到 deployments 层级，例如：https://{resource}.openai.azure.com/openai/deployments/{deployment}，并配置 ai-commit.AZURE_API_VERSION。`;
  }
  if (!trimmed) {
    return `如需自定义，请填写到 /v1，例如：https://api.openai.com/v1（不要填写 /chat/completions）。`;
  }
  return `请确保 ai-commit.OPENAI_BASE_URL 填写到 /v1（不要填写 /chat/completions）。当前为：${trimmed}`;
}

function openAIHeaders(
  apiKey: string,
  azureApiVersion: string | undefined
): Record<string, string> {
  if (azureApiVersion?.trim()) {
    return { 'api-key': apiKey };
  }
  return { Authorization: `Bearer ${apiKey}` };
}

export function isReasoningModel(model: string): boolean {
  const modelName = model.toLowerCase().split('/').pop() ?? '';
  return modelName.startsWith('gpt-5') || /^o\d(?:-|$)/.test(modelName);
}

export function looksLikeGeminiOrGoogleEndpoint(url: string): boolean {
  const lower = (url || '').toLowerCase();
  return (
    lower.includes('generativelanguage.googleapis.com') ||
    lower.includes('aiplatform.googleapis.com') ||
    (lower.includes('googleapis.com') && lower.includes('v1beta')) ||
    lower.includes('/models/')
  );
}

async function requireOpenAIApiKey(): Promise<string> {
  const apiKey = await getOpenAIApiKey();
  if (!apiKey) {
    throw new Error(
      'OpenAI API Key not configured. Run "Nota AI Commit: Set OpenAI API Key".'
    );
  }
  return apiKey;
}

export async function completeOpenAI(messages: ChatMessage[]): Promise<string> {
  const apiKey = await requireOpenAIApiKey();
  const baseURL = getOptionalConfig<string>(ConfigKeys.OPENAI_BASE_URL);
  const apiVersion = getOptionalConfig<string>(ConfigKeys.AZURE_API_VERSION);
  const model = getConfig(ConfigKeys.OPENAI_MODEL, 'gpt-5-mini');
  const temperature = getOptionalConfig<number>(ConfigKeys.OPENAI_TEMPERATURE);

  if (baseURL && looksLikeGeminiOrGoogleEndpoint(baseURL)) {
    throw new Error(
      `当前 ai-commit.OPENAI_BASE_URL 看起来是 Google/Gemini 接口：${baseURL}\n` +
        `如果你在用 Gemini，请把 ai-commit.AI_PROVIDER 切换为 gemini，并填写 ai-commit.GEMINI_BASE_URL。\n` +
        `如果你在用 OpenAI/OpenAI 兼容接口，请把 OPENAI_BASE_URL 填写为 OpenAI 风格的 /v1（不要包含 /chat/completions，也不要是 googleapis.com）。`
    );
  }

  const body: Record<string, unknown> = { model, messages };
  if (temperature !== undefined && !isReasoningModel(model)) {
    body.temperature = temperature;
  }

  const completion = await fetchJson<{
    choices?: Array<{ message?: { content?: string | null } }>;
  }>({
    url: getOpenAIChatCompletionsRequestUrl(baseURL, apiVersion),
    method: 'POST',
    headers: openAIHeaders(apiKey, apiVersion),
    body
  });

  const content = completion?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(
      `OpenAI 响应为空或格式不兼容。${getOpenAIBaseURLHint(baseURL, apiVersion)}`
    );
  }
  return content;
}

export async function refreshOpenAIModelList(): Promise<string[]> {
  try {
    const models = await fetchOpenAIModelIds();
    await getExtensionContext().globalState.update(MODELS_STATE_KEY, models);
    return models;
  } catch (error) {
    logError(error, 'Failed to fetch OpenAI models');
    return [];
  }
}

export async function getAvailableOpenAIModels(): Promise<string[]> {
  const cached = getExtensionContext().globalState.get<string[]>(MODELS_STATE_KEY);
  if (cached) {
    return cached;
  }
  return refreshOpenAIModelList();
}

async function fetchOpenAIModelIds(): Promise<string[]> {
  const apiKey = await requireOpenAIApiKey();
  const baseURL = getOptionalConfig<string>(ConfigKeys.OPENAI_BASE_URL);
  const apiVersion = getOptionalConfig<string>(ConfigKeys.AZURE_API_VERSION);
  const result = await fetchJson<{ data?: Array<{ id?: string }> }>({
    url: getOpenAIModelsRequestUrl(baseURL, apiVersion),
    method: 'GET',
    headers: openAIHeaders(apiKey, apiVersion)
  });
  return (result.data ?? [])
    .map((model) => model.id)
    .filter((id): id is string => !!id);
}
