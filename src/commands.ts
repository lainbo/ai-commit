import * as vscode from 'vscode';
import { ConfigurationManager } from './config';
import { generateCommitMsg } from './generate-commit-msg';
import { logError } from './output';

export class CommandManager {
  private disposables: vscode.Disposable[] = [];

  constructor(private context: vscode.ExtensionContext) {}

  registerCommands() {
    this.registerCommand('extension.ai-commit', generateCommitMsg);
    this.registerCommand('extension.configure-ai-commit', () =>
      vscode.commands.executeCommand('workbench.action.openSettings', 'ai-commit')
    );

    this.registerCommand('ai-commit.showAvailableModels', async () => {
      const configManager = ConfigurationManager.getInstance();
      const aiProvider = configManager.getConfig<string>('AI_PROVIDER', 'openai');

      if (aiProvider === 'gemini') {
        await vscode.window.showInformationMessage(
          'This command only lists OpenAI-compatible models. Set Gemini models in ai-commit.GEMINI_MODEL.'
        );
        return;
      }

      const models = await configManager.getAvailableOpenAIModels();
      const selected = await vscode.window.showQuickPick(models, {
        placeHolder: 'Please select a model'
      });

      if (selected) {
        const config = vscode.workspace.getConfiguration('ai-commit');
        await config.update(
          'OPENAI_MODEL',
          selected,
          vscode.ConfigurationTarget.Global
        );
      }
    });

    this.registerCommand('ai-commit.setOpenAIApiKey', async () => {
      const apiKey = await this.promptForApiKey('OpenAI');
      if (!apiKey) {
        return;
      }

      await ConfigurationManager.getInstance().setOpenAIApiKey(apiKey);
      await vscode.window.showInformationMessage('OpenAI API Key saved securely.');
    });

    this.registerCommand('ai-commit.setGeminiApiKey', async () => {
      const apiKey = await this.promptForApiKey('Gemini');
      if (!apiKey) {
        return;
      }

      await ConfigurationManager.getInstance().setGeminiApiKey(apiKey);
      await vscode.window.showInformationMessage('Gemini API Key saved securely.');
    });

    this.registerCommand('ai-commit.clearOpenAIApiKey', async () => {
      if (!(await this.confirmClearApiKey('OpenAI'))) {
        return;
      }

      await ConfigurationManager.getInstance().deleteOpenAIApiKey();
      await vscode.window.showInformationMessage('OpenAI API Key cleared.');
    });

    this.registerCommand('ai-commit.clearGeminiApiKey', async () => {
      if (!(await this.confirmClearApiKey('Gemini'))) {
        return;
      }

      await ConfigurationManager.getInstance().deleteGeminiApiKey();
      await vscode.window.showInformationMessage('Gemini API Key cleared.');
    });
  }

  private async promptForApiKey(provider: string): Promise<string | undefined> {
    const apiKey = await vscode.window.showInputBox({
      prompt: `Enter your ${provider} API Key`,
      ignoreFocusOut: true,
      password: true,
      validateInput: (value) => (value.trim() ? undefined : 'API Key cannot be empty')
    });

    return apiKey?.trim();
  }

  private async confirmClearApiKey(provider: string): Promise<boolean> {
    const result = await vscode.window.showWarningMessage(
      `Are you sure you want to clear your ${provider} API Key?`,
      'Clear',
      'Cancel'
    );
    return result === 'Clear';
  }

  private registerCommand(command: string, handler: (...args: any[]) => any) {
    const disposable = vscode.commands.registerCommand(command, async (...args) => {
      while (true) {
        try {
          await handler(...args);
          return;
        } catch (error) {
          logError(error, `命令执行失败：${command}`);
          const errorMessage = error instanceof Error ? error.message : String(error);
          const result = await vscode.window.showErrorMessage(
            `Failed: ${errorMessage}`,
            'Retry',
            'Set API Key',
            'Configure'
          );

          if (result === 'Retry') {
            continue;
          }
          if (result === 'Set API Key') {
            const provider = ConfigurationManager.getInstance().getConfig<string>(
              'AI_PROVIDER',
              'openai'
            );
            await vscode.commands.executeCommand(
              provider === 'gemini'
                ? 'ai-commit.setGeminiApiKey'
                : 'ai-commit.setOpenAIApiKey'
            );
          }
          if (result === 'Configure') {
            await vscode.commands.executeCommand(
              'workbench.action.openSettings',
              'ai-commit'
            );
          }
          return;
        }
      }
    });

    this.disposables.push(disposable);
    this.context.subscriptions.push(disposable);
  }

  dispose() {
    this.disposables.forEach((disposable) => disposable.dispose());
  }
}
