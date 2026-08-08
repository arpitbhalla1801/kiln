import type { VfsSnapshot } from './vfs-types.js';

export interface DiskFileSnapshot {
  path: string;
  existed: boolean;
  content?: string;
}

export interface RollbackSnapshot {
  id: string;
  createdAt: string;
  vfs: VfsSnapshot;
  disk: DiskFileSnapshot[];
}

export interface RollbackResult {
  restoredFiles: string[];
  removedFiles: string[];
}
