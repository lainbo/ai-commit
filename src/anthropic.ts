import { ConfigKeys, getAnthropicApiKey, getConfig, getOptionalConfig } from './config';
import { ChatMessage, fetchJson } from './http';
import { joinUrl } from './url';

const DEFAULT_ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';

export function getAnthropicMessagesRequestUrl(baseUrl: string | undefined): string {
  return joinUrl(baseUrl?.trim() || DEFAULT_ANTHROPIC_BASE_URL, 'messages');
}

export async function completeAnthropic(messages: ChatMessage[]): Promise<string> {
  const apiKey = await getAnthropicApiKey();
  if (!apiKey) {
    throw new Error(
      'Anthropic API Key not configured. Run "Nota AI Commit: Set Anthropic API Key".'
    );
  }

  const model = getConfig(ConfigKeys.ANTHROPIC_MODEL, 'claude-sonnet-5');
  const maxTokens = getConfig(ConfigKeys.ANTHROPIC_MAX_TOKENS, 4096);
  const baseUrl = getOptionalConfig<string>(ConfigKeys.ANTHROPIC_BASE_URL);
  const system = messages
    .filter(({ role }) => role === 'system')
    .map(({ content }) => content)
    .join('\n\n');

  const response = await fetchJson<{
    content?: Array<{ type: string; text?: string }>;
    stop_reason?: string;
  }>({
    url: getAnthropicMessagesRequestUrl(baseUrl),
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: {
      model,
      max_tokens: maxTokens,
      messages: messages.filter(({ role }) => role !== 'system'),
      ...(system ? { system } : {})
    }
  });

  if (response.stop_reason === 'max_tokens') {
    throw new Error(
      'Anthropic response was truncated. Increase ai-commit.ANTHROPIC_MAX_TOKENS and try again.'
    );
  }

  const text = (response.content ?? [])
    .filter(({ type }) => type === 'text')
    .map(({ text }) => text ?? '')
    .join('');

  if (!text.trim()) {
    throw new Error('Anthropic response was empty or incompatible.');
  }
  return text;
}
