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

const MAX_UNTRACKED_FILES = 20;

/**
 * Retrieves a pseudo-diff for untracked (new) files in the working tree.
 */
export async function getUntrackedDiff(
  repo: any
): Promise<{ diff: string; error?: string }> {
  try {
    const rootPath = resolveRepoRootPath(repo);

    if (!rootPath) {
      throw new Error('No workspace folder found');
    }

    const git = simpleGit(rootPath);
    const status = await git.status();
    const untrackedFiles = status.not_added;

    if (!untrackedFiles || untrackedFiles.length === 0) {
      return { diff: '', error: null };
    }

    const filesToProcess = untrackedFiles.slice(0, MAX_UNTRACKED_FILES);
    const skippedCount = untrackedFiles.length - filesToProcess.length;

    const diffs: string[] = [];

    for (const file of filesToProcess) {
      try {
        const fileDiff = await git
          .raw(['diff', '--no-index', '--', '/dev/null', file])
          .catch((err: any) => {
            // git diff --no-index exits with code 1 when files differ,
            // simple-git treats this as an error but the output is valid diff
            if (typeof err === 'string') return err;
            if (err?.message) return err.message;
            return '';
          });

        if (fileDiff && fileDiff.trim()) {
          diffs.push(fileDiff.trim());
        }
      } catch {
        diffs.push(
          `diff --git a/${file} b/${file}\nnew file\n(unable to read content)`
        );
      }
    }

    if (skippedCount > 0) {
      diffs.push(`\n(${skippedCount} more untracked files not shown)`);
    }

    return {
      diff: diffs.join('\n'),
      error: null
    };
  } catch (error) {
    console.error('Error reading untracked files:', error);
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
