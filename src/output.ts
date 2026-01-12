import * as vscode from 'vscode';

const OUTPUT_CHANNEL_NAME = 'Nota AI Commit';

let outputChannel: vscode.OutputChannel | undefined;

export function initOutputChannel(context: vscode.ExtensionContext) {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  }
  context.subscriptions.push(outputChannel);
}

export function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  }
  return outputChannel;
}

export function showOutput(preserveFocus = true) {
  getOutputChannel().show(preserveFocus);
}

export function logSection(title: string) {
  const now = new Date().toISOString();
  getOutputChannel().appendLine('');
  getOutputChannel().appendLine(`[${now}] ===== ${title} =====`);
}

export function logInfo(message: string) {
  const now = new Date().toISOString();
  getOutputChannel().appendLine(`[${now}] ${message}`);
}

export function logError(error: unknown, contextMessage?: string) {
  const now = new Date().toISOString();
  const details = formatError(error);
  const header = contextMessage
    ? `[${now}] ERROR: ${contextMessage}`
    : `[${now}] ERROR`;

  const channel = getOutputChannel();
  channel.appendLine(header);
  channel.appendLine(details);
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    const status = extractHttpStatus(error as any);
    const pieces = [
      `${error.name}: ${error.message}${status ? ` (status=${status})` : ''}`
    ];
    if (error.stack) {
      pieces.push(error.stack);
    }
    return pieces.join('\n');
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

function extractHttpStatus(error: any): number | undefined {
  const status = error?.status ?? error?.response?.status;
  if (typeof status === 'number') {
    return status;
  }
  return undefined;
}
