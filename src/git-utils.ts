import simpleGit from 'simple-git';
import * as vscode from 'vscode';

export type GitLogAuthorScope = 'all' | 'self';

/**
 * Resolves the repository root path.
 */
function resolveRepoRootPath(repo: any): string {
  return (
    repo?.rootUri?.fsPath || vscode.workspace.workspaceFolders?.[0].uri.fsPath
  );
}

/**
 * Retrieves the staged changes from the Git repository.
 */
export async function getDiffStaged(
  repo: any
): Promise<{ diff: string; error?: string }> {
  try {
    const rootPath = resolveRepoRootPath(repo);

    if (!rootPath) {
      throw new Error('No workspace folder found');
    }

    const git = simpleGit(rootPath);
    const diff = await git.diff(['--staged']);

    return {
      diff: diff || '',
      error: null
    };
  } catch (error) {
    console.error('Error reading Git diff:', error);
    return { diff: '', error: error.message };
  }
}

/**
 * Retrieves the unstaged (working tree) changes from the Git repository.
 */
export async function getDiffUnstaged(
  repo: any
): Promise<{ diff: string; error?: string }> {
  try {
    const rootPath = resolveRepoRootPath(repo);

    if (!rootPath) {
      throw new Error('No workspace folder found');
    }

    const git = simpleGit(rootPath);
    const diff = await git.diff();

    return {
      diff: diff || '',
      error: null
    };
  } catch (error) {
    console.error('Error reading Git diff:', error);
    return { diff: '', error: error.message };
  }
}

/**
 * Retrieves recent git commit history in a privacy-friendly format (git log --oneline).
 */
export async function getGitLogOneline(
  repo: any,
  options: { maxCount: number; authorScope: GitLogAuthorScope }
): Promise<{ log: string; error?: string }> {
  try {
    const rootPath = resolveRepoRootPath(repo);

    if (!rootPath) {
      throw new Error('No workspace folder found');
    }

    const git = simpleGit(rootPath);
    try {
      await git.raw(['rev-parse', '--verify', 'HEAD']);
    } catch {
      return { log: '', error: null };
    }

    const maxCount = Math.min(
      50,
      Math.max(1, Math.floor(options.maxCount ?? 20))
    );

    const args = ['log', '-n', String(maxCount), '--oneline'];

    if (options.authorScope === 'self') {
      const userName = (await git.raw(['config', 'user.name'])).trim();
      if (userName) {
        args.push(`--author=${userName}`);
      }
    }

    const output = await git.raw(args);
    const trimmed = (output || '').trim();

    const MAX_CHARS = 8000;
    const safeLog =
      trimmed.length > MAX_CHARS
        ? `${trimmed.slice(0, MAX_CHARS)}\n…(truncated)`
        : trimmed;

    return { log: safeLog, error: null };
  } catch (error) {
    console.error('Error reading Git log:', error);
    return { log: '', error: error.message };
  }
}
