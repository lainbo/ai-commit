import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { Change, GitExtension, Repository } from './typings/git';
import { logError } from './output';

/** vscode.git `Status.UNTRACKED` (enum order in the Git extension API). */
const GIT_STATUS_UNTRACKED = 7;

export type DiffSource = 'auto' | 'staged' | 'unstaged' | 'staged+unstaged';
export type GitLogAuthorScope = 'all' | 'self';

const MAX_UNTRACKED_FILES = 20;
const MAX_LOG_CHARS = 8000;

export async function getRepo(arg: unknown): Promise<Repository> {
  const extension = vscode.extensions.getExtension<GitExtension>('vscode.git');
  if (!extension) {
    throw new Error('Git extension not found');
  }

  const gitExt = extension.isActive ? extension.exports : await extension.activate();
  if (!gitExt.enabled) {
    throw new Error('Git extension is disabled');
  }

  const gitApi = gitExt.getAPI(1);
  const repositories = gitApi.repositories;
  if (repositories.length === 0) {
    throw new Error('No Git repository found');
  }

  const rootUri = getArgRootUri(arg);
  if (!rootUri) {
    return repositories[0];
  }

  const resourcePath = getCanonicalPath(rootUri.fsPath);
  const repositoryPaths = repositories.map((repo) => ({
    repo,
    rootPath: getCanonicalPath(repo.rootUri.fsPath)
  }));
  const exactMatch = repositoryPaths.find(({ rootPath }) => rootPath === resourcePath);
  if (exactMatch) {
    return exactMatch.repo;
  }

  const containingMatch = repositoryPaths
    .filter(({ rootPath }) => isPathInside(rootPath, resourcePath))
    .sort((a, b) => b.rootPath.length - a.rootPath.length)[0];
  return containingMatch?.repo ?? repositories[0];
}

function getArgRootUri(arg: unknown): vscode.Uri | undefined {
  if (typeof arg !== 'object' || arg === null || !('rootUri' in arg)) {
    return undefined;
  }
  const rootUri = (arg as { rootUri?: unknown }).rootUri;
  return rootUri instanceof vscode.Uri ? rootUri : undefined;
}

function getCanonicalPath(filePath: string): string {
  try {
    return path.normalize(fs.realpathSync(filePath));
  } catch {
    return path.resolve(filePath);
  }
}

function isPathInside(rootPath: string, filePath: string): boolean {
  const relativePath = path.relative(rootPath, filePath);
  return (
    relativePath === '' ||
    (relativePath !== '..' &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath))
  );
}

export async function getSelectedDiff(
  repo: Repository,
  diffSource: DiffSource
): Promise<string> {
  if (diffSource === 'staged') {
    return (await repo.diff(true)).trim();
  }

  if (diffSource === 'unstaged') {
    return getWorkingTreeDiff(repo);
  }

  if (diffSource === 'staged+unstaged') {
    await repo.status();
    const [stagedDiff, unstagedDiff] = await Promise.all([
      repo.diff(true),
      repo.diff(false)
    ]);
    const staged = stagedDiff.trim();
    const working = [unstagedDiff.trim(), await readUntrackedDiff(repo)]
      .filter(Boolean)
      .join('\n');
    return [
      staged ? `--- STAGED ---\n${staged}` : '',
      working ? `--- UNSTAGED ---\n${working}` : ''
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  const stagedDiff = (await repo.diff(true)).trim();
  return stagedDiff || getWorkingTreeDiff(repo);
}

async function getWorkingTreeDiff(repo: Repository): Promise<string> {
  await repo.status();
  const [unstagedDiff, untrackedDiff] = await Promise.all([
    repo.diff(false),
    readUntrackedDiff(repo)
  ]);
  return [unstagedDiff.trim(), untrackedDiff].filter(Boolean).join('\n');
}

function collectUntrackedChanges(repo: Repository): Change[] {
  const fromWorking = repo.state.workingTreeChanges.filter(
    (change) => change.status === GIT_STATUS_UNTRACKED
  );
  const fromSeparate = repo.state.untrackedChanges ?? [];
  if (fromSeparate.length === 0) {
    return fromWorking;
  }

  const seen = new Set(fromWorking.map((change) => change.uri.toString()));
  return fromWorking.concat(
    fromSeparate.filter((change) => !seen.has(change.uri.toString()))
  );
}

async function readUntrackedDiff(repo: Repository): Promise<string> {
  const untracked = collectUntrackedChanges(repo);
  if (untracked.length === 0) {
    return '';
  }

  const filesToProcess = untracked.slice(0, MAX_UNTRACKED_FILES);
  const skippedCount = untracked.length - filesToProcess.length;
  const root = repo.rootUri.fsPath;
  const diffs: string[] = [];

  for (const change of filesToProcess) {
    const abs = change.uri.fsPath;
    if (!isPathInside(root, abs)) {
      continue;
    }
    const rel = path.relative(root, abs).replaceAll('\\', '/');
    try {
      const stat = await fs.promises.lstat(abs);
      if (stat.isSymbolicLink()) {
        const target = await fs.promises.readlink(abs);
        diffs.push(toNewSymlinkDiff(rel, target));
        continue;
      }
      if (!stat.isFile()) {
        continue;
      }
      const content = await fs.promises.readFile(abs);
      if (content.includes(0)) {
        diffs.push(
          `diff --git a/${rel} b/${rel}\nnew file mode 100644\nBinary file ${rel}`
        );
        continue;
      }
      diffs.push(toNewFileDiff(rel, content.toString('utf8')));
    } catch {
      diffs.push(`diff --git a/${rel} b/${rel}\nnew file\n(unable to read content)`);
    }
  }

  if (skippedCount > 0) {
    diffs.push(`\n(${skippedCount} more untracked files not shown)`);
  }

  return diffs.join('\n');
}

function toNewFileDiff(file: string, content: string): string {
  const lines = content.split('\n');
  const body = lines.map((line) => `+${line}`).join('\n');
  return [
    `diff --git a/${file} b/${file}`,
    'new file mode 100644',
    '--- /dev/null',
    `+++ b/${file}`,
    `@@ -0,0 +1,${lines.length} @@`,
    body
  ].join('\n');
}

function toNewSymlinkDiff(file: string, target: string): string {
  return [
    `diff --git a/${file} b/${file}`,
    'new file mode 120000',
    '--- /dev/null',
    `+++ b/${file}`,
    '@@ -0,0 +1 @@',
    `+${target}`
  ].join('\n');
}

export async function getGitLogOneline(
  repo: Repository,
  options: { maxCount: number; authorScope: GitLogAuthorScope }
): Promise<string> {
  const maxCount = Math.min(50, Math.max(1, Math.floor(options.maxCount ?? 20)));
  const logOptions: { maxEntries: number; author?: string } = {
    maxEntries: maxCount
  };

  if (options.authorScope === 'self') {
    try {
      const userName = (await repo.getConfig('user.name')).trim();
      if (userName) {
        logOptions.author = userName;
      }
    } catch {
      // git config user.name may be unset
    }
  }

  try {
    const commits = await repo.log(logOptions);
    const text = commits
      .map((commit) => `${commit.hash.slice(0, 7)} ${commit.message.split('\n')[0]}`)
      .join('\n');
    if (text.length > MAX_LOG_CHARS) {
      return `${text.slice(0, MAX_LOG_CHARS)}\n…(truncated)`;
    }
    return text;
  } catch (error) {
    logError(error, '读取 git log 失败');
    return '';
  }
}
