import * as vscode from 'vscode';
import { CommandManager } from './commands';
import { ConfigKeys, ConfigurationManager } from './config';
import { initOutputChannel, logError } from './output';

const LEGACY_GEMINI_MODEL = 'gemini-2.0-flash-001';

export async function activate(context: vscode.ExtensionContext) {
  try {
    initOutputChannel(context);
    const configManager = ConfigurationManager.getInstance(context);
    const commandManager = new CommandManager(context);
    commandManager.registerCommands();

    context.subscriptions.push({
      dispose: () => {
        configManager.dispose();
        commandManager.dispose();
      }
    });

    const migrationConflicts = await configManager.migrateLegacyApiKeys();
    for (const provider of migrationConflicts) {
      const result = await vscode.window.showWarningMessage(
        `Multiple different ${provider} API Keys were found in VS Code settings and could not be migrated automatically.`,
        'Set API Key',
        'Later'
      );
      if (result === 'Set API Key') {
        await vscode.commands.executeCommand(
          provider === 'Gemini'
            ? 'ai-commit.setGeminiApiKey'
            : 'ai-commit.setOpenAIApiKey'
        );
      }
    }

    const aiProvider = configManager.getConfig<string>(
      ConfigKeys.AI_PROVIDER,
      'openai'
    );
    const providerLabel = aiProvider === 'gemini' ? 'Gemini' : 'OpenAI';
    const apiKey =
      aiProvider === 'gemini'
        ? await configManager.getGeminiApiKey()
        : await configManager.getOpenAIApiKey();

    if (!apiKey && !migrationConflicts.includes(providerLabel)) {
      const result = await vscode.window.showWarningMessage(
        `${providerLabel} API Key not configured. Would you like to configure it now?`,
        'Set API Key',
        'Later'
      );
      if (result === 'Set API Key') {
        await vscode.commands.executeCommand(
          aiProvider === 'gemini'
            ? 'ai-commit.setGeminiApiKey'
            : 'ai-commit.setOpenAIApiKey'
        );
      }
    }

    const geminiModel = configManager.getConfig<string>(
      ConfigKeys.GEMINI_MODEL,
      'gemini-3.8-flash'
    );
    if (aiProvider === 'gemini' && geminiModel === LEGACY_GEMINI_MODEL) {
      const result = await vscode.window.showWarningMessage(
        `${LEGACY_GEMINI_MODEL} has been shut down. Please select an available Gemini model.`,
        'Open Settings',
        'Later'
      );
      if (result === 'Open Settings') {
        await vscode.commands.executeCommand(
          'workbench.action.openSettings',
          'ai-commit.GEMINI_MODEL'
        );
      }
    }
  } catch (error) {
    console.error('Failed to activate extension:', error);
    logError(error, '扩展激活失败');
    throw error;
  }
}

export function deactivate() {}
