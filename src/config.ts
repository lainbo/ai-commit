import * as vscode from 'vscode';
import { createOpenAIApi } from './openai-utils';

export enum ConfigKeys {
  OPENAI_BASE_URL = 'OPENAI_BASE_URL',
  OPENAI_MODEL = 'OPENAI_MODEL',
  AZURE_API_VERSION = 'AZURE_API_VERSION',
  AI_COMMIT_LANGUAGE = 'AI_COMMIT_LANGUAGE',
  SYSTEM_PROMPT = 'AI_COMMIT_SYSTEM_PROMPT',
  OPENAI_TEMPERATURE = 'OPENAI_TEMPERATURE',
  DIFF_SOURCE = 'DIFF_SOURCE',
  SCM_INPUT_BEHAVIOR = 'SCM_INPUT_BEHAVIOR',
  REFERENCE_GIT_LOG = 'REFERENCE_GIT_LOG',
  GIT_LOG_COUNT = 'GIT_LOG_COUNT',
  GIT_LOG_AUTHOR_SCOPE = 'GIT_LOG_AUTHOR_SCOPE',
  GEMINI_BASE_URL = 'GEMINI_BASE_URL',
  GEMINI_MODEL = 'GEMINI_MODEL',
  GEMINI_TEMPERATURE = 'GEMINI_TEMPERATURE',
  AI_PROVIDER = 'AI_PROVIDER'
}

export enum SecretKeys {
  OPENAI_API_KEY = 'ai-commit.openai-api-key',
  GEMINI_API_KEY = 'ai-commit.gemini-api-key'
}

interface LegacySettingLocation {
  config: vscode.WorkspaceConfiguration;
  target: vscode.ConfigurationTarget;
  value: string;
}

export class ConfigurationManager {
  private static instance: ConfigurationManager | undefined;
  private configCache = new Map<string, unknown>();
  private disposable: vscode.Disposable;

  private constructor(private context: vscode.ExtensionContext) {
    this.disposable = vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration('ai-commit')) {
        return;
      }

      this.configCache.clear();
      const aiProvider = this.getConfig<string>(ConfigKeys.AI_PROVIDER, 'openai');
      if (
        aiProvider === 'openai' &&
        event.affectsConfiguration('ai-commit.OPENAI_BASE_URL')
      ) {
        void this.updateOpenAIModelList();
      }
    });
  }

  static getInstance(context?: vscode.ExtensionContext): ConfigurationManager {
    if (!this.instance) {
      if (!context) {
        throw new Error('ConfigurationManager has not been initialized');
      }
      this.instance = new ConfigurationManager(context);
    }
    return this.instance;
  }

  getConfig<T>(key: string, defaultValue?: T): T {
    if (!this.configCache.has(key)) {
      const config = vscode.workspace.getConfiguration('ai-commit');
      this.configCache.set(key, config.get<T>(key, defaultValue));
    }
    return this.configCache.get(key) as T;
  }

  getOpenAIApiKey(): Thenable<string | undefined> {
    return this.context.secrets.get(SecretKeys.OPENAI_API_KEY);
  }

  getGeminiApiKey(): Thenable<string | undefined> {
    return this.context.secrets.get(SecretKeys.GEMINI_API_KEY);
  }

  async setOpenAIApiKey(value: string): Promise<void> {
    await this.context.secrets.store(SecretKeys.OPENAI_API_KEY, value);
    await this.clearLegacySetting('OPENAI_API_KEY');
    await this.context.globalState.update('availableOpenAIModels', undefined);
  }

  async setGeminiApiKey(value: string): Promise<void> {
    await this.context.secrets.store(SecretKeys.GEMINI_API_KEY, value);
    await this.clearLegacySetting('GEMINI_API_KEY');
  }

  async deleteOpenAIApiKey(): Promise<void> {
    await this.context.secrets.delete(SecretKeys.OPENAI_API_KEY);
    await this.clearLegacySetting('OPENAI_API_KEY');
  }

  async deleteGeminiApiKey(): Promise<void> {
    await this.context.secrets.delete(SecretKeys.GEMINI_API_KEY);
    await this.clearLegacySetting('GEMINI_API_KEY');
  }

  async migrateLegacyApiKeys(): Promise<string[]> {
    const conflicts: string[] = [];

    if (await this.migrateLegacyApiKey('OPENAI_API_KEY', SecretKeys.OPENAI_API_KEY)) {
      conflicts.push('OpenAI');
    }

    if (await this.migrateLegacyApiKey('GEMINI_API_KEY', SecretKeys.GEMINI_API_KEY)) {
      conflicts.push('Gemini');
    }

    return conflicts;
  }

  dispose() {
    this.disposable.dispose();
  }

  private async migrateLegacyApiKey(
    settingKey: string,
    secretKey: SecretKeys
  ): Promise<boolean> {
    const locations = this.getLegacySettingLocations(settingKey);
    if (locations.length === 0) {
      return false;
    }

    let storedValue = await this.context.secrets.get(secretKey);
    const configuredValues = new Set(locations.map(({ value }) => value));

    if (!storedValue && configuredValues.size === 1) {
      storedValue = locations[0].value;
      await this.context.secrets.store(secretKey, storedValue);
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

  private async clearLegacySetting(settingKey: string): Promise<void> {
    for (const { config, target } of this.getLegacySettingLocations(settingKey)) {
      await config.update(settingKey, undefined, target);
    }
  }

  private getLegacySettingLocations(settingKey: string): LegacySettingLocation[] {
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
      const folderValue =
        folderConfig.inspect<string>(settingKey)?.workspaceFolderValue;
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

  private async updateOpenAIModelList(): Promise<void> {
    try {
      const openai = await createOpenAIApi();
      const models = await openai.models.list();
      await this.context.globalState.update(
        'availableOpenAIModels',
        models.data.map((model) => model.id)
      );
    } catch (error) {
      console.error('Failed to fetch OpenAI models:', error);
    }
  }

  async getAvailableOpenAIModels(): Promise<string[]> {
    if (!this.context.globalState.get<string[]>('availableOpenAIModels')) {
      await this.updateOpenAIModelList();
    }
    return this.context.globalState.get<string[]>('availableOpenAIModels', []);
  }
}
