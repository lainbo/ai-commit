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

    const apiKey = configManager.getConfig<string>('OPENAI_API_KEY');
    if (!apiKey) {
      const result = await vscode.window.showWarningMessage(
        'OpenAI API Key not configured. Would you like to configure it now?',
        'Yes',
        'No'
      );

      if (result === 'Yes') {
        await vscode.commands.executeCommand(
          'workbench.action.openSettings',
          'ai-commit.OPENAI_API_KEY'
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
