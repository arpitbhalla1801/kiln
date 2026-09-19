import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import { atomicWriteFile, isNodeError, resolveTargetPath } from './fs-helpers.js';
import type { VfsDiff, VfsSnapshot } from './vfs.js';
import type { VirtualFilesystem } from './vfs.js';

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

/** Snapshot and rollback primitives for transform execution recovery. */
export class RollbackManager {
  private snapshots = new Map<string, RollbackSnapshot>();

  createSnapshot(vfs: VirtualFilesystem, disk: DiskFileSnapshot[] = []): RollbackSnapshot {
    const snapshot: RollbackSnapshot = {
      id: crypto.randomBytes(8).toString('hex'),
      createdAt: new Date().toISOString(),
      vfs: vfs.snapshot(),
      disk,
    };

    this.snapshots.set(snapshot.id, snapshot);
    return snapshot;
  }

  getSnapshot(id: string): RollbackSnapshot | undefined {
    return this.snapshots.get(id);
  }

  deleteSnapshot(id: string): void {
    this.snapshots.delete(id);
  }

  restoreVirtualFilesystem(vfs: VirtualFilesystem, snapshot: RollbackSnapshot): void {
    vfs.restoreFromSnapshot(snapshot.vfs);
  }

  async captureDiskSnapshots(rootDir: string, diff: VfsDiff): Promise<DiskFileSnapshot[]> {
    const snapshots: DiskFileSnapshot[] = [];

    for (const entry of diff.entries) {
      const absolutePath = resolveTargetPath(rootDir, entry.path);
      let content: string | undefined;
      let existed = false;

      try {
        content = await fs.readFile(absolutePath, 'utf8');
        existed = true;
      } catch (error: unknown) {
        if (!isNodeError(error) || error.code !== 'ENOENT') {
          throw error;
        }
      }

      snapshots.push({
        path: entry.path,
        existed,
        content,
      });
    }

    return snapshots;
  }

  async rollbackDisk(rootDir: string, snapshots: DiskFileSnapshot[]): Promise<RollbackResult> {
    const restoredFiles: string[] = [];
    const removedFiles: string[] = [];

    for (const snapshot of [...snapshots].reverse()) {
      const targetPath = resolveTargetPath(rootDir, snapshot.path);

      if (snapshot.existed) {
        if (snapshot.content !== undefined) {
          await atomicWriteFile(targetPath, snapshot.content);
          restoredFiles.push(targetPath);
        }
        continue;
      }

      try {
        await fs.unlink(targetPath);
        removedFiles.push(targetPath);
      } catch (error: unknown) {
        if (!isNodeError(error) || error.code !== 'ENOENT') {
          throw error;
        }
      }
    }

    return {
      restoredFiles: restoredFiles.sort((left, right) => left.localeCompare(right)),
      removedFiles: removedFiles.sort((left, right) => left.localeCompare(right)),
    };
  }

  async recover(
    vfs: VirtualFilesystem,
    snapshot: RollbackSnapshot,
    rootDir?: string
  ): Promise<RollbackResult> {
    this.restoreVirtualFilesystem(vfs, snapshot);

    if (rootDir === undefined || snapshot.disk.length === 0) {
      return { restoredFiles: [], removedFiles: [] };
    }

    return this.rollbackDisk(rootDir, snapshot.disk);
  }
}

