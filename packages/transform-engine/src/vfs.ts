import type { VfsDiff, VfsDiffEntry, VfsDiffSummary, VfsSnapshot, VirtualFilesystemOptions } from './vfs-types.js';
import { normalizePath } from './path-utils.js';

type StagedValue = string | null;

/** In-memory virtual filesystem with staged mutations and diff tracking. */
export class VirtualFilesystem {
  private baseline: Map<string, string>;
  private staging: Map<string, StagedValue>;

  constructor(options: VirtualFilesystemOptions = {}) {
    this.baseline = new Map();
    this.staging = new Map();

    if (options.initialFiles) {
      for (const [path, content] of Object.entries(options.initialFiles)) {
        this.baseline.set(normalizePath(path), content);
      }
    }
  }

  /** Read merged file content from staged state and baseline. */
  read(path: string): string | undefined {
    const normalizedPath = normalizePath(path);
    const staged = this.staging.get(normalizedPath);

    if (staged !== undefined) {
      return staged === null ? undefined : staged;
    }

    return this.baseline.get(normalizedPath);
  }

  /** Check whether a file exists in the merged view. */
  exists(path: string): boolean {
    return this.read(path) !== undefined;
  }

  /** Stage a create or update mutation in memory. */
  write(path: string, content: string): void {
    const normalizedPath = normalizePath(path);
    this.staging.set(normalizedPath, content);
  }

  /** Stage an update mutation; throws if the file does not exist in merged view. */
  update(path: string, content: string): void {
    if (!this.exists(path)) {
      throw new Error(`Cannot update missing file: ${normalizePath(path)}`);
    }

    this.write(path, content);
  }

  /** Stage a delete mutation in memory. */
  delete(path: string): void {
    const normalizedPath = normalizePath(path);
    this.staging.set(normalizedPath, null);
  }

  /** List file paths in the merged view, sorted deterministically. */
  list(prefix?: string): string[] {
    const normalizedPrefix = prefix ? normalizePath(prefix) : undefined;
    const paths = new Set<string>();

    for (const path of this.baseline.keys()) {
      if (normalizedPrefix === undefined || path.startsWith(normalizedPrefix)) {
        paths.add(path);
      }
    }

    for (const [path, staged] of this.staging.entries()) {
      if (staged === null) {
        paths.delete(path);
      } else if (normalizedPrefix === undefined || path.startsWith(normalizedPrefix)) {
        paths.add(path);
      }
    }

    return Array.from(paths).sort((left, right) => left.localeCompare(right));
  }

  /** Return staged mutations without applying them to baseline. */
  getDiff(): VfsDiff {
    const entries: VfsDiffEntry[] = [];

    for (const [path, staged] of this.staging.entries()) {
      const before = this.baseline.get(path);

      if (staged === null) {
        if (before !== undefined) {
          entries.push({ path, type: 'delete', before });
        }
        continue;
      }

      if (before === undefined) {
        entries.push({ path, type: 'create', after: staged });
        continue;
      }

      if (before !== staged) {
        entries.push({ path, type: 'modify', before, after: staged });
      }
    }

    entries.sort((left, right) => left.path.localeCompare(right.path));

    return {
      entries,
      summary: summarizeDiff(entries),
    };
  }

  /** Whether any staged mutations are pending. */
  hasStagedChanges(): boolean {
    return this.staging.size > 0;
  }

  /** Apply staged mutations to baseline and clear the staging area. */
  commit(): void {
    for (const [path, staged] of this.staging.entries()) {
      if (staged === null) {
        this.baseline.delete(path);
      } else {
        this.baseline.set(path, staged);
      }
    }

    this.staging.clear();
  }

  /** Discard staged mutations without touching baseline. */
  reset(): void {
    this.staging.clear();
  }

  /** Snapshot the merged file tree for inspection or persistence. */
  snapshot(): VfsSnapshot {
    const files: Record<string, string> = {};

    for (const path of this.list()) {
      const content = this.read(path);
      if (content !== undefined) {
        files[path] = content;
      }
    }

    return { files };
  }

  /** Restore baseline and clear staging from a snapshot. */
  restoreFromSnapshot(snapshot: VfsSnapshot): void {
    this.baseline.clear();
    this.staging.clear();

    for (const [filePath, content] of Object.entries(snapshot.files)) {
      this.baseline.set(normalizePath(filePath), content);
    }
  }

  /** Load disk content into baseline without staging (for merge transforms). */
  loadBaseline(path: string, content: string): void {
    this.baseline.set(normalizePath(path), content);
  }

}

function summarizeDiff(entries: VfsDiffEntry[]): VfsDiffSummary {
  const summary: VfsDiffSummary = {
    created: 0,
    modified: 0,
    deleted: 0,
    total: entries.length,
  };

  for (const entry of entries) {
    if (entry.type === 'create') summary.created++;
    if (entry.type === 'modify') summary.modified++;
    if (entry.type === 'delete') summary.deleted++;
  }

  return summary;
}
