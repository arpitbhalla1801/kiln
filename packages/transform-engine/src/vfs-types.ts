export type VfsMutationType = 'create' | 'modify' | 'delete';

export interface VfsDiffEntry {
  path: string;
  type: VfsMutationType;
  before?: string;
  after?: string;
}

export interface VfsDiffSummary {
  created: number;
  modified: number;
  deleted: number;
  total: number;
}

export interface VfsDiff {
  entries: VfsDiffEntry[];
  summary: VfsDiffSummary;
}

export interface VfsSnapshot {
  files: Record<string, string>;
}

export interface VirtualFilesystemOptions {
  initialFiles?: Record<string, string>;
}
