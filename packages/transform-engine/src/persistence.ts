import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { VfsDiff } from './vfs-types.js';
import type { VirtualFilesystem } from './vfs.js';
import type {
  PersistableFileOperation,
  PersistenceOptions,
  PersistenceResult,
} from './persistence-types.js';

const TEMP_SUFFIX = '.kiln.tmp';

/** Commits virtual filesystem mutations to disk with atomic per-file writes. */
export class FilesystemPersistence {
  async persistVirtualFilesystem(
    vfs: VirtualFilesystem,
    options: PersistenceOptions = {}
  ): Promise<PersistenceResult> {
    return this.persistDiff(vfs.getDiff(), options);
  }

  async persistDiff(diff: VfsDiff, options: PersistenceOptions = {}): Promise<PersistenceResult> {
    const operations: PersistableFileOperation[] = diff.entries.map((entry) => ({
      type: entry.type,
      filePath: entry.path,
      content: entry.after,
    }));

    return this.persistOperations(operations, options);
  }

  async persistOperations(
    operations: PersistableFileOperation[],
    options: PersistenceOptions = {}
  ): Promise<PersistenceResult> {
    const rootDir = options.rootDir ?? process.cwd();
    const encoding = options.encoding ?? 'utf8';
    const sorted = [...operations].sort((left, right) =>
      left.filePath.localeCompare(right.filePath)
    );

    const writeOperations = sorted.filter(
      (operation) => operation.type === 'create' || operation.type === 'modify'
    );
    const deleteOperations = sorted.filter((operation) => operation.type === 'delete');

    const written: string[] = [];
    const deleted: string[] = [];
    const pendingTempFiles: string[] = [];

    try {
      for (const operation of writeOperations) {
        const targetPath = resolveTargetPath(rootDir, operation.filePath);
        const content = operation.content ?? '';

        await atomicWriteFile(targetPath, content, encoding, pendingTempFiles);
        written.push(targetPath);
      }

      for (const operation of deleteOperations) {
        const targetPath = resolveTargetPath(rootDir, operation.filePath);
        await safeDelete(targetPath);
        deleted.push(targetPath);
      }
    } catch (error) {
      await cleanupTempFiles(pendingTempFiles);
      throw error;
    }

    return {
      written: written.sort((left, right) => left.localeCompare(right)),
      deleted: deleted.sort((left, right) => left.localeCompare(right)),
    };
  }
}

async function atomicWriteFile(
  targetPath: string,
  content: string,
  encoding: BufferEncoding,
  pendingTempFiles: string[]
): Promise<void> {
  const directory = path.dirname(targetPath);
  await fs.mkdir(directory, { recursive: true });

  const tempPath = `${targetPath}${TEMP_SUFFIX}.${crypto.randomBytes(8).toString('hex')}`;
  pendingTempFiles.push(tempPath);

  try {
    await fs.writeFile(tempPath, content, encoding);
    await fs.rename(tempPath, targetPath);
    pendingTempFiles.pop();
  } catch (error) {
    await cleanupTempFiles([tempPath]);
    const index = pendingTempFiles.indexOf(tempPath);
    if (index >= 0) {
      pendingTempFiles.splice(index, 1);
    }
    throw error;
  }
}

async function safeDelete(targetPath: string): Promise<void> {
  try {
    await fs.unlink(targetPath);
  } catch (error: unknown) {
    if (!isNodeError(error) || error.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function cleanupTempFiles(tempPaths: string[]): Promise<void> {
  for (const tempPath of tempPaths) {
    try {
      await fs.rm(tempPath, { force: true });
    } catch {
      // Ignore cleanup failures for temp artifacts.
    }
  }
}

function resolveTargetPath(rootDir: string, filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');

  if (path.isAbsolute(normalized)) {
    return path.normalize(normalized);
  }

  return path.normalize(path.join(rootDir, normalized));
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error;
}
