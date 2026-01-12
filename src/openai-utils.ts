import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources';
import { ConfigKeys, ConfigurationManager } from './config';

export function getOpenAIChatCompletionsRequestUrl(
  baseURL: string | undefined,
  azureApiVersion: string | undefined
): string {
  const isAzure = Boolean(azureApiVersion && azureApiVersion.trim());
  const effectiveBaseURL =
    (baseURL && baseURL.trim()) || 'https://api.openai.com/v1';

  try {
    const url = new URL(effectiveBaseURL);
    url.pathname = joinUrlPath(url.pathname, 'chat/completions');
    if (isAzure) {
      url.searchParams.set('api-version', azureApiVersion!.trim());
    }
    return url.toString();
  } catch {
    const joined = `${effectiveBaseURL.replace(/\/+$/, '')}/chat/completions`;
    return isAzure
      ? `${joined}?api-version=${encodeURIComponent(azureApiVersion!.trim())}`
      : joined;
  }
}

function joinUrlPath(basePath: string, suffix: string): string {
  const a = (basePath || '').replace(/\/+$/, '');
  const b = (suffix || '').replace(/^\/+/, '');
  if (!a) {
    return `/${b}`;
  }
  return `${a}/${b}`;
}

function getOpenAIBaseURLHint(
  baseURL: string | undefined,
  azureApiVersion: string | undefined
): string {
  const trimmed = (baseURL || '').trim();
  const isAzure = Boolean(azureApiVersion && azureApiVersion.trim());
  if (isAzure) {
    return `（Azure）请填写到 deployments 层级，例如：https://{resource}.openai.azure.com/openai/deployments/{deployment}，并配置 ai-commit.AZURE_API_VERSION。`;
  }
  if (!trimmed) {
    return `如需自定义，请填写到 /v1，例如：https://api.openai.com/v1（不要填写 /chat/completions）。`;
  }
  return `请确保 ai-commit.OPENAI_BASE_URL 填写到 /v1（不要填写 /chat/completions）。当前为：${trimmed}`;
}

/**
 * Creates and returns an OpenAI configuration object.
 * @returns {Object} - The OpenAI configuration object.
 * @throws {Error} - Throws an error if the API key is missing or empty.
 */
function getOpenAIConfig() {
  const configManager = ConfigurationManager.getInstance();
  const apiKey = configManager.getConfig<string>(ConfigKeys.OPENAI_API_KEY);
  const baseURL = configManager.getConfig<string>(ConfigKeys.OPENAI_BASE_URL);
  const apiVersion = configManager.getConfig<string>(ConfigKeys.AZURE_API_VERSION);

  if (!apiKey) {
    throw new Error('The OPENAI_API_KEY environment variable is missing or empty.');
  }

  const config: {
    apiKey: string;
    baseURL?: string;
    defaultQuery?: { 'api-version': string };
    defaultHeaders?: { 'api-key': string };
  } = {
    apiKey
  };

  if (baseURL) {
    if (looksLikeGeminiOrGoogleEndpoint(baseURL)) {
      throw new Error(
        `当前 ai-commit.OPENAI_BASE_URL 看起来是 Google/Gemini 接口：${baseURL}\n` +
          `如果你在用 Gemini，请把 ai-commit.AI_PROVIDER 切换为 gemini，并填写 ai-commit.GEMINI_BASE_URL。\n` +
          `如果你在用 OpenAI/OpenAI 兼容接口，请把 OPENAI_BASE_URL 填写为 OpenAI 风格的 /v1（不要包含 /chat/completions，也不要是 googleapis.com）。`
      );
    }
    config.baseURL = baseURL;
    if (apiVersion) {
      config.defaultQuery = { 'api-version': apiVersion };
      config.defaultHeaders = { 'api-key': apiKey };
    }
  }

  return config;
}

/**
 * Creates and returns an OpenAI API instance.
 * @returns {OpenAI} - The OpenAI API instance.
 */
export function createOpenAIApi() {
  const config = getOpenAIConfig();
  return new OpenAI(config);
}

/**
 * Sends a chat completion request to the OpenAI API.
 * @param {Array<Object>} messages - The messages to send to the API.
 * @returns {Promise<string>} - A promise that resolves to the API response.
 */
export async function ChatGPTAPI(messages: ChatCompletionMessageParam[]) {
  const openai = createOpenAIApi();
  const configManager = ConfigurationManager.getInstance();
  const model = configManager.getConfig<string>(ConfigKeys.OPENAI_MODEL);
  const temperature = configManager.getConfig<number>(ConfigKeys.OPENAI_TEMPERATURE, 0.7);
  const baseURL = configManager.getConfig<string>(ConfigKeys.OPENAI_BASE_URL);
  const apiVersion = configManager.getConfig<string>(ConfigKeys.AZURE_API_VERSION);

  const completion = await openai.chat.completions.create({
    model,
    messages: messages as ChatCompletionMessageParam[],
    temperature
  });

  const content = completion?.choices?.[0]?.message?.content;
  if (!content) {
    const hint = getOpenAIBaseURLHint(baseURL, apiVersion);
    throw new Error(`OpenAI 响应为空或格式不兼容。${hint}`);
  }

  return content;
}

function looksLikeGeminiOrGoogleEndpoint(url: string): boolean {
  const lower = (url || '').toLowerCase();
  return (
    lower.includes('generativelanguage.googleapis.com') ||
    lower.includes('aiplatform.googleapis.com') ||
    (lower.includes('googleapis.com') && lower.includes('v1beta')) ||
    lower.includes('/models/')
  );
}
