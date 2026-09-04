import { Uri } from 'vscode';

export interface InputBox {
  value: string;
}

export enum Status {
  INDEX_MODIFIED,
  INDEX_ADDED,
  INDEX_DELETED,
  INDEX_RENAMED,
  INDEX_COPIED,
  MODIFIED,
  DELETED,
  UNTRACKED,
  IGNORED,
  INTENT_TO_ADD,
  INTENT_TO_RENAME,
  TYPE_CHANGED,
  ADDED_BY_US,
  ADDED_BY_THEM,
  DELETED_BY_US,
  DELETED_BY_THEM,
  BOTH_ADDED,
  BOTH_DELETED,
  BOTH_MODIFIED
}

export interface Change {
  readonly uri: Uri;
  readonly originalUri: Uri;
  readonly renameUri: Uri | undefined;
  readonly status: Status;
}

export interface Commit {
  readonly hash: string;
  readonly message: string;
}

export interface LogOptions {
  readonly maxEntries?: number;
  readonly author?: string;
}

export interface RepositoryState {
  readonly workingTreeChanges: Change[];
  readonly untrackedChanges?: Change[];
}

export interface Repository {
  readonly rootUri: Uri;
  readonly inputBox: InputBox;
  readonly state: RepositoryState;
  getConfig(key: string): Promise<string>;
  diff(cached?: boolean): Promise<string>;
  status(): Promise<void>;
  log(options?: LogOptions): Promise<Commit[]>;
}

export interface API {
  readonly repositories: Repository[];
}

export interface GitExtension {
  readonly enabled: boolean;
  getAPI(version: 1): API;
}
