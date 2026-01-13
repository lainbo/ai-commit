import * as fs from 'fs-extra';
import { ChatCompletionMessageParam } from 'openai/resources';
import * as vscode from 'vscode';
import { ConfigKeys, ConfigurationManager } from './config';
import { getDiffStaged, getDiffUnstaged, getGitLogOneline, GitLogAuthorScope } from './git-utils';
import { ChatGPTAPI, getOpenAIChatCompletionsRequestUrl } from './openai-utils';
import { getMainCommitPrompt } from './prompts';
import { ProgressHandler } from './utils';
import { GeminiAPI, getGeminiGenerateContentRequestUrl } from './gemini-utils';
import { getOutputChannel, logError, logInfo, logSection } from './output';

type DiffSource = 'auto' | 'staged' | 'unstaged' | 'staged+unstaged';

/**
 * Generates a chat completion prompt for the commit message based on the provided diff.
 *
 * @param {string} diff - The diff string representing changes to be committed.
 * @param {string} additionalContext - Additional context for the changes.
 * @returns {Promise<Array<{ role: string, content: string }>>} - A promise that resolves to an array of messages for the chat completion.
 */
const generateCommitMessageChatCompletionPrompt = async (
  diff: string,
  additionalContext?: string,
  gitLogContext?: string
) => {
  const INIT_MESSAGES_PROMPT = await getMainCommitPrompt();
  const chatContextAsCompletionRequest = [...INIT_MESSAGES_PROMPT];

  if (additionalContext) {
    chatContextAsCompletionRequest.push({
      role: 'system',
      content:
        `Priority rule:\n` +
        `- The user's input in the commit message box is HIGHER PRIORITY than earlier system instructions, when generating the final commit message content.\n` +
        `- If there's a conflict, follow the user's requirements.\n` +
        `- Still output ONLY the commit message and follow the configured language.\n` +
        `- Do not mention this rule in the output.`
    });
    chatContextAsCompletionRequest.push({
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
    chatContextAsCompletionRequest.push({
      role: 'user',
      content: `Recent git commit history (git log --oneline). Use it only as style/reference, do not copy blindly:\n${gitLogContext}`
    });
  }

  chatContextAsCompletionRequest.push({
    role: 'user',
    content: diff
  });
  return chatContextAsCompletionRequest;
};

/**
 * Retrieves the repository associated with the provided argument.
 *
 * @param {any} arg - The input argument containing the root URI of the repository.
 * @returns {Promise<vscode.SourceControlRepository>} - A promise that resolves to the repository object.
 */
export async function getRepo(arg) {
  const gitApi = vscode.extensions.getExtension('vscode.git')?.exports.getAPI(1);
  if (!gitApi) {
    throw new Error('Git extension not found');
  }

  if (typeof arg === 'object' && arg.rootUri) {
    const resourceUri = arg.rootUri;
    const realResourcePath: string = fs.realpathSync(resourceUri!.fsPath);
    for (let i = 0; i < gitApi.repositories.length; i++) {
      const repo = gitApi.repositories[i];
      if (realResourcePath.startsWith(repo.rootUri.fsPath)) {
        return repo;
      }
    }
  }
  return gitApi.repositories[0];
}

/**
 * Generates a commit message based on the changes staged in the repository.
 *
 * @param {any} arg - The input argument containing the root URI of the repository.
 * @returns {Promise<void>} - A promise that resolves when the commit message has been generated and set in the SCM input box.
 */
export async function generateCommitMsg(arg) {
  return ProgressHandler.withProgress('', async (progress) => {
    try {
      logSection('开始生成提交信息');
      const configManager = ConfigurationManager.getInstance();
      const repo = await getRepo(arg);

      const aiProvider = configManager.getConfig<string>(ConfigKeys.AI_PROVIDER, 'openai');
      const diffSource = configManager.getConfig<DiffSource>(ConfigKeys.DIFF_SOURCE, 'auto');
      const scmInputBehavior = configManager.getConfig<string>(
        ConfigKeys.SCM_INPUT_BEHAVIOR,
        'context'
      );
      logInfo(`AI Provider: ${aiProvider}`);
      logInfo(`Diff Source: ${diffSource}`);
      logInfo(`SCM Input Behavior: ${scmInputBehavior}`);

      progress.report({ message: 'Getting git changes...' });
      const [stagedResult, unstagedResult] = await Promise.all([
        getDiffStaged(repo),
        getDiffUnstaged(repo)
      ]);

      if (stagedResult.error) {
        throw new Error(`Failed to get staged changes: ${stagedResult.error}`);
      }

      if (unstagedResult.error) {
        throw new Error(`Failed to get unstaged changes: ${unstagedResult.error}`);
      }

      const stagedDiff = stagedResult.diff.trim();
      const unstagedDiff = unstagedResult.diff.trim();

      let selectedDiff = '';
      switch (diffSource) {
        case 'staged':
          selectedDiff = stagedDiff;
          break;
        case 'unstaged':
          selectedDiff = unstagedDiff;
          break;
        case 'staged+unstaged':
          selectedDiff = [stagedDiff ? `--- STAGED ---\n${stagedDiff}` : '', unstagedDiff ? `--- UNSTAGED ---\n${unstagedDiff}` : '']
            .filter(Boolean)
            .join('\n\n');
          break;
        case 'auto':
        default:
          selectedDiff = stagedDiff || unstagedDiff;
          break;
      }

      if (!selectedDiff) {
        if (diffSource === 'staged') {
          throw new Error(
            "No staged changes found. Stage your changes (git add) or set 'ai-commit.DIFF_SOURCE' to 'unstaged'/'auto'."
          );
        }
        if (diffSource === 'unstaged') {
          throw new Error("No unstaged changes found. Modify files or set 'ai-commit.DIFF_SOURCE' to 'staged'/'auto'.");
        }
        throw new Error('No git changes found to generate a commit message');
      }

      const scmInputBox = repo.inputBox;
      if (!scmInputBox) {
        throw new Error('Unable to find the SCM input box');
      }

      const scmInputText = scmInputBox.value.trim();
      const additionalContext =
        scmInputBehavior === 'context' ? scmInputText : undefined;
      const shouldReferenceGitLog = configManager.getConfig<boolean>(
        ConfigKeys.REFERENCE_GIT_LOG,
        false
      );

      let gitLogContext: string | undefined;
      if (shouldReferenceGitLog) {
        progress.report({ message: 'Reading git commit history...' });

        const gitLogCount = configManager.getConfig<number>(
          ConfigKeys.GIT_LOG_COUNT,
          20
        );
        const gitLogAuthorScope = configManager.getConfig<GitLogAuthorScope>(
          ConfigKeys.GIT_LOG_AUTHOR_SCOPE,
          'all'
        );

        logInfo(
          `读取 git log --oneline：maxCount=${gitLogCount}, authorScope=${gitLogAuthorScope}`
        );
        const logResult = await getGitLogOneline(repo, {
          maxCount: gitLogCount,
          authorScope: gitLogAuthorScope
        });

        if (logResult.error) {
          logError(new Error(logResult.error), '读取 git log 失败');
        } else if (logResult.log.trim()) {
          gitLogContext = logResult.log.trim();
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
      const messages = await generateCommitMessageChatCompletionPrompt(
        selectedDiff,
        additionalContext,
        gitLogContext
      );

      progress.report({
        message: additionalContext
          ? 'Generating commit message with additional context...'
          : 'Generating commit message...'
      });
      try {
        let commitMessage: string | undefined;

        if (aiProvider === 'gemini') {
          const geminiApiKey = configManager.getConfig<string>(ConfigKeys.GEMINI_API_KEY);
          if (!geminiApiKey) {
            throw new Error('Gemini API Key not configured');
          }
          const modelName = configManager.getConfig<string>(ConfigKeys.GEMINI_MODEL);
          const baseUrl = configManager.getConfig<string>(ConfigKeys.GEMINI_BASE_URL);
          logInfo(
            `Gemini Request URL: ${getGeminiGenerateContentRequestUrl(modelName, baseUrl)}`
          );
          commitMessage = await GeminiAPI(messages);
        } else {
          const openaiApiKey = configManager.getConfig<string>(ConfigKeys.OPENAI_API_KEY);
          if (!openaiApiKey) {
            throw new Error('OpenAI API Key not configured');
          }
          const baseURL = configManager.getConfig<string>(ConfigKeys.OPENAI_BASE_URL);
          const apiVersion = configManager.getConfig<string>(ConfigKeys.AZURE_API_VERSION);
          logInfo(
            `OpenAI Request URL: ${getOpenAIChatCompletionsRequestUrl(baseURL, apiVersion)}`
          );
          commitMessage = await ChatGPTAPI(messages as ChatCompletionMessageParam[]);
        }


        if (commitMessage) {
          scmInputBox.value = commitMessage;
          logSection('AI 返回结果');
          getOutputChannel().appendLine(commitMessage);
        } else {
          throw new Error('Failed to generate commit message');
        }
      } catch (err) {
        logError(err, `AI 请求失败（provider=${aiProvider}）`);
        let errorMessage = 'An unexpected error occurred';

        const status = (err as any)?.status ?? (err as any)?.response?.status;
        if (aiProvider === 'openai') {
          const msg = err instanceof Error ? err.message : String(err);
          if (typeof status === 'number') {
            switch (status) {
              case 401:
                errorMessage = 'Invalid OpenAI API key or unauthorized access';
                break;
              case 400:
                if (
                  /Invalid JSON payload received/i.test(msg) &&
                  /Unknown name "\\s*messages\\s*"/i.test(msg)
                ) {
                  errorMessage =
                    'OpenAI 请求返回了 Google/Gemini 风格的 400（不认识 messages/temperature）。' +
                    '这通常意味着你把 ai-commit.OPENAI_BASE_URL 配成了 Gemini/Google 的接口，或使用了非 OpenAI 兼容的代理。' +
                    '请检查：1) ai-commit.AI_PROVIDER 是否应切换为 gemini；2) OPENAI_BASE_URL 是否为 OpenAI 风格的 /v1（不要包含 /chat/completions，也不要是 googleapis.com）。';
                } else {
                  errorMessage = `OpenAI Bad Request (400): ${msg}`;
                }
                break;
              case 404:
                errorMessage =
                  'OpenAI endpoint not found (404). Please check OPENAI_BASE_URL (should end with /v1, do not include /chat/completions).';
                break;
              case 429:
                errorMessage = 'Rate limit exceeded. Please try again later';
                break;
              case 500:
                errorMessage = 'OpenAI server error. Please try again later';
                break;
              case 503:
                errorMessage = 'OpenAI service is temporarily unavailable';
                break;
              default:
                errorMessage = `OpenAI API error (status ${status}): ${msg}`;
                break;
            }
          } else {
            errorMessage = `OpenAI API error: ${msg}`;
          }
        } else if (aiProvider === 'gemini') {
          const msg = err instanceof Error ? err.message : String(err);
          errorMessage = `Gemini API error: ${msg}`;
        }

        throw new Error(errorMessage);
      }
    } catch (error) {
      logError(error, '生成提交信息失败');
      throw error;
    }
  });
}
