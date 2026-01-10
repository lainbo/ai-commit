import simpleGit from 'simple-git';
import * as vscode from 'vscode';

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
