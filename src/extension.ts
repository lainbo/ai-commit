import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { ConfigKeys, getConfig, initConfig, migrateLegacyApiKeys } from './config';
import { refreshOpenAIModelList } from './openai';
import { initOutputChannel, logError } from './output';

const LEGACY_GEMINI_MODEL = 'gemini-2.0-flash-001';

export async function activate(context: vscode.ExtensionContext) {
  try {
    initOutputChannel(context);
    initConfig(context);
    registerCommands(context);

    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (
          getConfig(ConfigKeys.AI_PROVIDER, 'openai') === 'openai' &&
          event.affectsConfiguration('ai-commit.OPENAI_BASE_URL')
        ) {
          void refreshOpenAIModelList();
        }
      })
    );

    const migrationConflicts = await migrateLegacyApiKeys();
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

    const aiProvider = getConfig(ConfigKeys.AI_PROVIDER, 'openai');
    const geminiModel = getConfig(ConfigKeys.GEMINI_MODEL, 'gemini-3.8-flash');
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
