import * as vscode from 'vscode';
import { CommandManager } from './commands';
import { ConfigurationManager } from './config';
import { initOutputChannel, logError } from './output';

/**
 * Activates the extension and registers commands.
 *
 * @param {vscode.ExtensionContext} context - The context for the extension.
 */
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

    const aiProvider = configManager.getConfig<string>('AI_PROVIDER', 'openai');
    const apiKeyConfig = aiProvider === 'gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY';
    const apiKey = configManager.getConfig<string>(apiKeyConfig);
    if (!apiKey) {
      const providerLabel = aiProvider === 'gemini' ? 'Gemini' : 'OpenAI';
      const result = await vscode.window.showWarningMessage(
        `${providerLabel} API Key not configured. Would you like to configure it now?`,
        'Yes',
        'No'
      );

      if (result === 'Yes') {
        await vscode.commands.executeCommand(
          'workbench.action.openSettings',
          `ai-commit.${apiKeyConfig}`
        );
      }
    }
  } catch (error) {
    console.error('Failed to activate extension:', error);
    logError(error, '扩展激活失败');
    throw error;
  }
}

/**
 * Deactivates the extension.
 * This function is called when the extension is deactivated.
 */
export function deactivate() {}
