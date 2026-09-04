import * as vscode from 'vscode';
import {
  ConfigKeys,
  deleteGeminiApiKey,
  deleteOpenAIApiKey,
  getConfig,
  setGeminiApiKey,
  setOpenAIApiKey
} from './config';
import { generateCommitMsg } from './generate-commit-msg';
import { getAvailableOpenAIModels } from './openai';
import { logError } from './output';

export function registerCommands(context: vscode.ExtensionContext): void {
  register(context, 'extension.ai-commit', generateCommitMsg);

  register(context, 'ai-commit.showAvailableModels', async () => {
    const aiProvider = getConfig(ConfigKeys.AI_PROVIDER, 'openai');
    if (aiProvider === 'gemini') {
      await vscode.window.showInformationMessage(
        'This command only lists OpenAI-compatible models. Set Gemini models in ai-commit.GEMINI_MODEL.'
      );
      return;
    }

    const models = await getAvailableOpenAIModels();
    const selected = await vscode.window.showQuickPick(models, {
      placeHolder: 'Please select a model'
    });

    if (selected) {
      await vscode.workspace
        .getConfiguration('ai-commit')
        .update('OPENAI_MODEL', selected, vscode.ConfigurationTarget.Global);
    }
  });

  register(context, 'ai-commit.setOpenAIApiKey', async () => {
    const apiKey = await promptForApiKey('OpenAI');
    if (!apiKey) {
      return;
    }
    await setOpenAIApiKey(apiKey);
    await vscode.window.showInformationMessage('OpenAI API Key saved securely.');
  });

  register(context, 'ai-commit.setGeminiApiKey', async () => {
    const apiKey = await promptForApiKey('Gemini');
    if (!apiKey) {
      return;
    }
    await setGeminiApiKey(apiKey);
    await vscode.window.showInformationMessage('Gemini API Key saved securely.');
  });

  register(context, 'ai-commit.clearOpenAIApiKey', async () => {
    if (!(await confirmClearApiKey('OpenAI'))) {
      return;
    }
    await deleteOpenAIApiKey();
    await vscode.window.showInformationMessage('OpenAI API Key cleared.');
  });

  register(context, 'ai-commit.clearGeminiApiKey', async () => {
    if (!(await confirmClearApiKey('Gemini'))) {
      return;
    }
    await deleteGeminiApiKey();
    await vscode.window.showInformationMessage('Gemini API Key cleared.');
  });
}

async function promptForApiKey(provider: string): Promise<string | undefined> {
  const apiKey = await vscode.window.showInputBox({
    prompt: `Enter your ${provider} API Key`,
    ignoreFocusOut: true,
    password: true,
    validateInput: (value) => (value.trim() ? undefined : 'API Key cannot be empty')
  });
  return apiKey?.trim();
}

async function confirmClearApiKey(provider: string): Promise<boolean> {
  const result = await vscode.window.showWarningMessage(
    `Are you sure you want to clear your ${provider} API Key?`,
    'Clear',
    'Cancel'
  );
  return result === 'Clear';
}

function register(
  context: vscode.ExtensionContext,
  command: string,
  handler: (...args: unknown[]) => unknown
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(command, async (...args: unknown[]) => {
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
            const provider = getConfig(ConfigKeys.AI_PROVIDER, 'openai');
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
    })
  );
}
