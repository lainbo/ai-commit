import * as vscode from 'vscode';

export const ConfigKeys = {
  OPENAI_BASE_URL: 'OPENAI_BASE_URL',
  OPENAI_MODEL: 'OPENAI_MODEL',
  AZURE_API_VERSION: 'AZURE_API_VERSION',
  AI_COMMIT_LANGUAGE: 'AI_COMMIT_LANGUAGE',
  SYSTEM_PROMPT: 'AI_COMMIT_SYSTEM_PROMPT',
  OPENAI_TEMPERATURE: 'OPENAI_TEMPERATURE',
  DIFF_SOURCE: 'DIFF_SOURCE',
  SCM_INPUT_BEHAVIOR: 'SCM_INPUT_BEHAVIOR',
  REFERENCE_GIT_LOG: 'REFERENCE_GIT_LOG',
  GIT_LOG_COUNT: 'GIT_LOG_COUNT',
  GIT_LOG_AUTHOR_SCOPE: 'GIT_LOG_AUTHOR_SCOPE',
  GEMINI_BASE_URL: 'GEMINI_BASE_URL',
  GEMINI_MODEL: 'GEMINI_MODEL',
  GEMINI_TEMPERATURE: 'GEMINI_TEMPERATURE',
  AI_PROVIDER: 'AI_PROVIDER'
} as const;

const SecretKeys = {
  OPENAI_API_KEY: 'ai-commit.openai-api-key',
  GEMINI_API_KEY: 'ai-commit.gemini-api-key'
} as const;

export const MODELS_STATE_KEY = 'availableOpenAIModels';

interface LegacySettingLocation {
  config: vscode.WorkspaceConfiguration;
  target: vscode.ConfigurationTarget;
  value: string;
}

let extensionContext: vscode.ExtensionContext | undefined;

export function initConfig(context: vscode.ExtensionContext): void {
  extensionContext = context;
}

export function getExtensionContext(): vscode.ExtensionContext {
  if (!extensionContext) {
    throw new Error('Config has not been initialized');
  }
  return extensionContext;
}

export function getConfig(key: string, defaultValue: string): string;
export function getConfig(key: string, defaultValue: number): number;
export function getConfig(key: string, defaultValue: boolean): boolean;
export function getConfig<T>(key: string, defaultValue: T): T {
  return vscode.workspace.getConfiguration('ai-commit').get(key, defaultValue) as T;
}

export function getOptionalConfig<T>(key: string): T | undefined {
  return vscode.workspace.getConfiguration('ai-commit').get<T>(key);
}

export function getOpenAIApiKey(): Thenable<string | undefined> {
  return getExtensionContext().secrets.get(SecretKeys.OPENAI_API_KEY);
}

export function getGeminiApiKey(): Thenable<string | undefined> {
  return getExtensionContext().secrets.get(SecretKeys.GEMINI_API_KEY);
}

export async function setOpenAIApiKey(value: string): Promise<void> {
  await getExtensionContext().secrets.store(SecretKeys.OPENAI_API_KEY, value);
  await clearLegacySetting('OPENAI_API_KEY');
  await getExtensionContext().globalState.update(MODELS_STATE_KEY, undefined);
}

export async function setGeminiApiKey(value: string): Promise<void> {
  await getExtensionContext().secrets.store(SecretKeys.GEMINI_API_KEY, value);
  await clearLegacySetting('GEMINI_API_KEY');
}

export async function deleteOpenAIApiKey(): Promise<void> {
  await getExtensionContext().secrets.delete(SecretKeys.OPENAI_API_KEY);
  await clearLegacySetting('OPENAI_API_KEY');
}

export async function deleteGeminiApiKey(): Promise<void> {
  await getExtensionContext().secrets.delete(SecretKeys.GEMINI_API_KEY);
  await clearLegacySetting('GEMINI_API_KEY');
}

export async function migrateLegacyApiKeys(): Promise<string[]> {
  const conflicts: string[] = [];

  if (await migrateLegacyApiKey('OPENAI_API_KEY', SecretKeys.OPENAI_API_KEY)) {
    conflicts.push('OpenAI');
  }

  if (await migrateLegacyApiKey('GEMINI_API_KEY', SecretKeys.GEMINI_API_KEY)) {
    conflicts.push('Gemini');
  }

  return conflicts;
}

async function migrateLegacyApiKey(
  settingKey: string,
  secretKey: string
): Promise<boolean> {
  const context = getExtensionContext();
  const locations = getLegacySettingLocations(settingKey);
  if (locations.length === 0) {
    return false;
  }

  let storedValue = await context.secrets.get(secretKey);
  const configuredValues = new Set(locations.map(({ value }) => value));

  if (!storedValue && configuredValues.size === 1) {
    storedValue = locations[0].value;
    await context.secrets.store(secretKey, storedValue);
  }

  if (!storedValue) {
    return true;
  }

  const matchingLocations = locations.filter(({ value }) => value === storedValue);
  for (const { config, target } of matchingLocations) {
    await config.update(settingKey, undefined, target);
  }

  return matchingLocations.length !== locations.length;
}

async function clearLegacySetting(settingKey: string): Promise<void> {
  for (const { config, target } of getLegacySettingLocations(settingKey)) {
    await config.update(settingKey, undefined, target);
  }
}

function getLegacySettingLocations(settingKey: string): LegacySettingLocation[] {
  const locations: LegacySettingLocation[] = [];
  const config = vscode.workspace.getConfiguration('ai-commit');
  const inspected = config.inspect<string>(settingKey);

  if (inspected?.globalValue) {
    locations.push({
      config,
      target: vscode.ConfigurationTarget.Global,
      value: inspected.globalValue
    });
  }

  if (inspected?.workspaceValue) {
    locations.push({
      config,
      target: vscode.ConfigurationTarget.Workspace,
      value: inspected.workspaceValue
    });
  }

  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    const folderConfig = vscode.workspace.getConfiguration('ai-commit', folder.uri);
    const folderValue = folderConfig.inspect<string>(settingKey)?.workspaceFolderValue;
    if (folderValue) {
      locations.push({
        config: folderConfig,
        target: vscode.ConfigurationTarget.WorkspaceFolder,
        value: folderValue
      });
    }
  }

  return locations;
}
