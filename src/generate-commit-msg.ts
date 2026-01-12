import * as fs from 'fs-extra';
import { ChatCompletionMessageParam } from 'openai/resources';
import * as vscode from 'vscode';
import { ConfigKeys, ConfigurationManager } from './config';
import { getDiffStaged, getDiffUnstaged, getGitLogOneline, GitLogAuthorScope } from './git-utils';
import { ChatGPTAPI } from './openai-utils';
import { getMainCommitPrompt } from './prompts';
import { ProgressHandler } from './utils';
import { GeminiAPI } from './gemini-utils';

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
      role: 'user',
      content: `Additional context for the changes:\n${additionalContext}`
    });
  }

  if (gitLogContext) {
    console.log('gitLogContext: ', gitLogContext);
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
      const configManager = ConfigurationManager.getInstance();
      const repo = await getRepo(arg);

      const aiProvider = configManager.getConfig<string>(ConfigKeys.AI_PROVIDER, 'openai');
      const diffSource = configManager.getConfig<DiffSource>(ConfigKeys.DIFF_SOURCE, 'auto');

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

      const additionalContext = scmInputBox.value.trim();
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

        const logResult = await getGitLogOneline(repo, {
          maxCount: gitLogCount,
          authorScope: gitLogAuthorScope
        });

        if (!logResult.error && logResult.log.trim()) {
          gitLogContext = logResult.log.trim();
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
          commitMessage = await GeminiAPI(messages);
        } else {
          const openaiApiKey = configManager.getConfig<string>(ConfigKeys.OPENAI_API_KEY);
          if (!openaiApiKey) {
            throw new Error('OpenAI API Key not configured');
          }
          commitMessage = await ChatGPTAPI(messages as ChatCompletionMessageParam[]);
        }


        if (commitMessage) {
          scmInputBox.value = commitMessage;
        } else {
          throw new Error('Failed to generate commit message');
        }
      } catch (err) {
        let errorMessage = 'An unexpected error occurred';

        if (aiProvider === 'openai' && err.response?.status) {
          switch (err.response.status) {
            case 401:
              errorMessage = 'Invalid OpenAI API key or unauthorized access';
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
          }
        } else if (aiProvider === 'gemini') {
          errorMessage = `Gemini API error: ${err.message}`;
        }

        throw new Error(errorMessage);
      }
    } catch (error) {
      throw error;
    }
  });
}
