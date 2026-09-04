import * as vscode from 'vscode';
import { ConfigKeys, getConfig, getOptionalConfig } from './config';
import {
  DiffSource,
  getGitLogOneline,
  getRepo,
  getSelectedDiff,
  GitLogAuthorScope
} from './git';
import { completeGemini, getGeminiGenerateContentRequestUrl } from './gemini';
import { ChatMessage, getHttpStatus, mapProviderHttpError } from './http';
import { completeOpenAI, getOpenAIChatCompletionsRequestUrl } from './openai';
import { getOutputChannel, logError, logInfo, logSection } from './output';
import { getMainCommitPrompt } from './prompts';

function buildCommitMessages(
  diff: string,
  additionalContext?: string,
  gitLogContext?: string
): ChatMessage[] {
  const messages: ChatMessage[] = [...getMainCommitPrompt()];

  if (additionalContext) {
    messages.push({
      role: 'system',
      content:
        `Priority rule:\n` +
        `- The user's input in the commit message box is HIGHER PRIORITY than earlier system instructions, when generating the final commit message content.\n` +
        `- If there's a conflict, follow the user's requirements.\n` +
        `- Still output ONLY the commit message and follow the configured language.\n` +
        `- Do not mention this rule in the output.`
    });
    messages.push({
      role: 'user',
      content:
        `The user entered the following content in the Source Control commit message input box.\n` +
        `Treat it as additional context and/or constraints (it may be a draft commit message, requirements, preferred wording, or references like an issue/ticket number).\n` +
        `You should COMPLETE/EXPAND the final commit message based on the diff while respecting the user input.\n` +
        `Keep any IDs/tokens EXACTLY as written (do not paraphrase or modify them).\n` +
        `If the user input includes references/identifiers (e.g. an issue/ticket number like "123"), make sure the final commit message includes them in an appropriate place.\n` +
        `\n` +
        `--- USER INPUT START ---\n` +
        `${additionalContext}\n` +
        `--- USER INPUT END ---`
    });
  }

  if (gitLogContext) {
    messages.push({
      role: 'user',
      content: `Recent git commit history (git log --oneline). Use it only as style/reference, do not copy blindly:\n${gitLogContext}`
    });
  }

  messages.push({
    role: 'user',
    content: diff
  });
  return messages;
}

export async function generateCommitMsg(arg: unknown): Promise<void> {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: '[Nota AI Commit]',
      cancellable: false
    },
    async (progress) => {
      logSection('开始生成提交信息');
      const repo = await getRepo(arg);

      const aiProvider = getConfig(ConfigKeys.AI_PROVIDER, 'openai');
      const diffSource = getConfig(ConfigKeys.DIFF_SOURCE, 'auto') as DiffSource;
      const scmInputBehavior = getConfig(ConfigKeys.SCM_INPUT_BEHAVIOR, 'ignore');
      logInfo(`AI Provider: ${aiProvider}`);
      logInfo(`Diff Source: ${diffSource}`);
      logInfo(`SCM Input Behavior: ${scmInputBehavior}`);

      progress.report({ message: 'Getting git changes...' });
      const selectedDiff = await getSelectedDiff(repo, diffSource);

      if (!selectedDiff) {
        if (diffSource === 'staged') {
          throw new Error(
            "No staged changes found. Stage your changes (git add) or set 'ai-commit.DIFF_SOURCE' to 'unstaged'/'auto'."
          );
        }
        if (diffSource === 'unstaged') {
          throw new Error(
            "No unstaged changes found. Modify files or set 'ai-commit.DIFF_SOURCE' to 'staged'/'auto'."
          );
        }
        throw new Error('No git changes found to generate a commit message');
      }

      const scmInputBox = repo.inputBox;
      const scmInputText = scmInputBox.value.trim();
      const additionalContext =
        scmInputBehavior === 'context' ? scmInputText : undefined;
      const shouldReferenceGitLog = getConfig(ConfigKeys.REFERENCE_GIT_LOG, true);

      let gitLogContext: string | undefined;
      if (shouldReferenceGitLog) {
        progress.report({ message: 'Reading git commit history...' });

        const gitLogCount = getConfig(ConfigKeys.GIT_LOG_COUNT, 20);
        const gitLogAuthorScope = getConfig(
          ConfigKeys.GIT_LOG_AUTHOR_SCOPE,
          'all'
        ) as GitLogAuthorScope;

        logInfo(
          `读取 git log --oneline：maxCount=${gitLogCount}, authorScope=${gitLogAuthorScope}`
        );
        gitLogContext = await getGitLogOneline(repo, {
          maxCount: gitLogCount,
          authorScope: gitLogAuthorScope
        });

        if (gitLogContext) {
          const actualCount = gitLogContext.split(/\r?\n/).filter(Boolean).length;
          logInfo(`最近提交记录（实际返回 ${actualCount} 条）：`);
          getOutputChannel().appendLine(gitLogContext);
          getOutputChannel().appendLine('-----');
        } else {
          logInfo('git log 为空（仓库可能尚无提交）。');
        }
      }

      progress.report({
        message: additionalContext
          ? 'Analyzing changes with additional context...'
          : 'Analyzing changes...'
      });
      const messages = buildCommitMessages(
        selectedDiff,
        additionalContext,
        gitLogContext
      );

      progress.report({
        message: additionalContext
          ? 'Generating commit message with additional context...'
          : 'Generating commit message...'
      });

      const provider = aiProvider === 'gemini' ? 'gemini' : 'openai';
      try {
        let commitMessage: string;
        if (provider === 'gemini') {
          const modelName = getConfig(ConfigKeys.GEMINI_MODEL, 'gemini-3.8-flash');
          const baseUrl = getOptionalConfig<string>(ConfigKeys.GEMINI_BASE_URL);
          logInfo(
            `Gemini Request URL: ${getGeminiGenerateContentRequestUrl(modelName, baseUrl)}`
          );
          commitMessage = await completeGemini(messages);
        } else {
          const baseURL = getOptionalConfig<string>(ConfigKeys.OPENAI_BASE_URL);
          const apiVersion = getOptionalConfig<string>(ConfigKeys.AZURE_API_VERSION);
          logInfo(
            `OpenAI Request URL: ${getOpenAIChatCompletionsRequestUrl(baseURL, apiVersion)}`
          );
          commitMessage = await completeOpenAI(messages);
        }

        scmInputBox.value = commitMessage;
        logSection('AI 返回结果');
        getOutputChannel().appendLine(commitMessage);
      } catch (err) {
        logError(err, `AI 请求失败（provider=${provider}）`);
        if (getHttpStatus(err) !== undefined) {
          throw mapProviderHttpError(provider, err);
        }
        throw err instanceof Error ? err : new Error(String(err));
      }
    }
  );
}
