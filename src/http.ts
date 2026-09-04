export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export async function fetchJson<T>(options: {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: unknown;
}): Promise<T> {
  const { url, method = 'GET', headers = {}, body } = options;
  const response = await fetch(url, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  if (!response.ok) {
    throw new HttpError(
      response.status,
      parseApiErrorMessage(text) || response.statusText
    );
  }
  if (!text) {
    throw new HttpError(response.status, 'Empty response');
  }
  return JSON.parse(text) as T;
}

export function parseApiErrorMessage(text: string): string | undefined {
  try {
    const json = JSON.parse(text) as {
      error?: { message?: string } | string;
      message?: string;
    };
    if (typeof json.error === 'string' && json.error) {
      return json.error;
    }
    if (typeof json.error === 'object' && json.error?.message) {
      return json.error.message;
    }
    if (json.message) {
      return json.message;
    }
  } catch {
    // body is not JSON
  }
  const trimmed = text.trim();
  return trimmed || undefined;
}

export function getHttpStatus(error: unknown): number | undefined {
  if (error instanceof HttpError) {
    return error.status;
  }
  if (typeof error === 'object' && error && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number') {
      return status;
    }
  }
  return undefined;
}

const OPENAI_STATUS_MESSAGES: Record<number, string> = {
  401: 'Invalid OpenAI API key or unauthorized access',
  404: 'OpenAI endpoint not found (404). Please check OPENAI_BASE_URL (should end with /v1, do not include /chat/completions).',
  429: 'Rate limit exceeded. Please try again later',
  500: 'OpenAI server error. Please try again later',
  503: 'OpenAI service is temporarily unavailable'
};

const GEMINI_STATUS_MESSAGES: Record<number, string> = {
  401: 'Invalid Gemini API key or unauthorized access. Run "Nota AI Commit: Set Gemini API Key" to update it.',
  403: 'Invalid Gemini API key or unauthorized access. Run "Nota AI Commit: Set Gemini API Key" to update it.',
  404: 'Gemini endpoint not found (404). Please check ai-commit.GEMINI_BASE_URL and ai-commit.GEMINI_MODEL.',
  429: 'Gemini rate limit exceeded. Please try again later.',
  500: 'Gemini server error. Please try again later.',
  503: 'Gemini service is temporarily unavailable.'
};

export function mapProviderHttpError(
  provider: 'openai' | 'gemini',
  error: unknown
): Error {
  const msg = error instanceof Error ? error.message : String(error);
  const status = getHttpStatus(error);
  const name = provider === 'gemini' ? 'Gemini' : 'OpenAI';

  if (typeof status !== 'number') {
    return new Error(`${name} API error: ${msg}`);
  }

  if (provider === 'openai' && status === 400 && isGeminiStyleMessagesError(msg)) {
    return new Error(
      'OpenAI 请求返回了 Google/Gemini 风格的 400（不认识 messages/temperature）。' +
        '这通常意味着你把 ai-commit.OPENAI_BASE_URL 配成了 Gemini/Google 的接口，或使用了非 OpenAI 兼容的代理。' +
        '请检查：1) ai-commit.AI_PROVIDER 是否应切换为 gemini；2) OPENAI_BASE_URL 是否为 OpenAI 风格的 /v1（不要包含 /chat/completions，也不要是 googleapis.com）。'
    );
  }

  const mapped =
    provider === 'gemini'
      ? GEMINI_STATUS_MESSAGES[status]
      : OPENAI_STATUS_MESSAGES[status];
  if (mapped) {
    return new Error(mapped);
  }
  if (status === 400) {
    return new Error(`${name} Bad Request (400): ${msg}`);
  }
  return new Error(`${name} API error (status ${status}): ${msg}`);
}

function isGeminiStyleMessagesError(message: string): boolean {
  return (
    /Invalid JSON payload received/i.test(message) &&
    /Unknown name "\s*messages\s*"/i.test(message)
  );
}
