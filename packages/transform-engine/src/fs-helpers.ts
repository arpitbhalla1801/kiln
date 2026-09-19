import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const TEMP_SUFFIX = '.kiln.tmp';

/**
 * Writes content to a temp file next to the target, then renames it into place.
 * When `pendingTempFiles` is provided, the temp path is tracked in it while the
 * write is in flight so a caller can clean up outstanding temp files if a
 * later operation in a batch fails.
 */
export async function atomicWriteFile(
  targetPath: string,
  content: string,
  encoding: BufferEncoding = 'utf8',
  pendingTempFiles?: string[]
): Promise<void> {
  const directory = path.dirname(targetPath);
  await fs.mkdir(directory, { recursive: true });

  const tempPath = `${targetPath}${TEMP_SUFFIX}.${crypto.randomBytes(8).toString('hex')}`;
  pendingTempFiles?.push(tempPath);

  try {
    await fs.writeFile(tempPath, content, encoding);
    await fs.rename(tempPath, targetPath);
    pendingTempFiles?.pop();
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
    if (pendingTempFiles) {
      const index = pendingTempFiles.indexOf(tempPath);
      if (index >= 0) {
        pendingTempFiles.splice(index, 1);
      }
    }
    throw error;
  }
}

/** Resolves a (possibly relative, possibly backslash-separated) file path against a root directory. */
export function resolveTargetPath(rootDir: string, filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');

  if (path.isAbsolute(normalized)) {
    return path.normalize(normalized);
  }

  return path.normalize(path.join(rootDir, normalized));
}

export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error;
}
