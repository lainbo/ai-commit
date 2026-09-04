import { GoogleGenAI } from '@google/genai';
import { ConfigKeys, ConfigurationManager } from './config';

interface GeminiMessage {
  role: string;
  content: string;
}

export function getGeminiGenerateContentRequestUrl(
  modelName: string | undefined,
  baseUrl: string | undefined
): string {
  const effectiveBaseURL =
    (baseUrl && baseUrl.trim()) || 'https://generativelanguage.googleapis.com';
  const safeModel = (modelName || '').trim() || '{model}';
  const path = `/v1beta/models/${safeModel}:generateContent`;

  try {
    const url = new URL(effectiveBaseURL);
    url.pathname = joinUrlPath(url.pathname, path);
    return url.toString();
  } catch {
    return `${effectiveBaseURL.replace(/\/+$/, '')}${path}`;
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

export async function createGeminiAPIClient(): Promise<GoogleGenAI> {
  const configManager = ConfigurationManager.getInstance();
  const apiKey = await configManager.getGeminiApiKey();
  const baseUrl = configManager.getConfig<string>(ConfigKeys.GEMINI_BASE_URL);

  if (!apiKey) {
    throw new Error(
      'Gemini API Key not configured. Run "Nota AI Commit: Set Gemini API Key".'
    );
  }

  return new GoogleGenAI({
    apiKey,
    ...(baseUrl?.trim() ? { httpOptions: { baseUrl: baseUrl.trim() } } : {})
  });
}

export async function GeminiAPI(messages: GeminiMessage[]): Promise<string> {
  const gemini = await createGeminiAPIClient();
  const configManager = ConfigurationManager.getInstance();
  const model = configManager.getConfig<string>(
    ConfigKeys.GEMINI_MODEL,
    'gemini-3.8-flash'
  );
  const temperature = configManager.getConfig<number>(
    ConfigKeys.GEMINI_TEMPERATURE,
    0.7
  );
  const systemInstruction = messages
    .filter(({ role }) => role === 'system')
    .map(({ content }) => content)
    .join('\n\n');
  const contents = messages
    .filter(({ role }) => role !== 'system')
    .map(({ content }) => content)
    .join('\n\n');

  const response = await gemini.models.generateContent({
    model,
    contents,
    config: {
      temperature,
      ...(systemInstruction ? { systemInstruction } : {})
    }
  });

  if (!response.text) {
    throw new Error('Gemini response was empty or incompatible.');
  }

  return response.text;
}
