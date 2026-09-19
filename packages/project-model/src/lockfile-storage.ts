import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { LockfileManager } from './lockfile.js';
import { KILN_DIRECTORY } from './ownership-storage.js';
import type { KilnLockfile } from './types.js';

export const LOCKFILE_FILE = 'lock.json';
const TEMP_SUFFIX = '.kiln.tmp';

/** Resolve the `.kiln/lock.json` path for a kiln project root. */
export function getLockfilePath(projectRoot: string): string {
  return path.join(projectRoot, KILN_DIRECTORY, LOCKFILE_FILE);
}

/** Persist and reload the kiln lockfile from `.kiln/lock.json`. */
export class LockfileStore {
  static getFilePath(projectRoot: string): string {
    return getLockfilePath(projectRoot);
  }

  static async load(projectRoot: string): Promise<KilnLockfile | undefined> {
    try {
      const content = await fs.readFile(LockfileStore.getFilePath(projectRoot), 'utf8');
      return LockfileManager.parse(content);
    } catch {
      return undefined;
    }
  }

  static async save(lockfile: KilnLockfile, projectRoot: string): Promise<void> {
    const filePath = LockfileStore.getFilePath(projectRoot);
    const kilnDirectory = path.join(projectRoot, KILN_DIRECTORY);
    await fs.mkdir(kilnDirectory, { recursive: true });

    const content = LockfileManager.generate(lockfile);
    await atomicWriteFile(filePath, content);
  }
}

async function atomicWriteFile(targetPath: string, content: string): Promise<void> {
  const directory = path.dirname(targetPath);
  await fs.mkdir(directory, { recursive: true });

  const tempPath = `${targetPath}${TEMP_SUFFIX}.${crypto.randomBytes(8).toString('hex')}`;

  try {
    await fs.writeFile(tempPath, content, 'utf8');
    await fs.rename(tempPath, targetPath);
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
}
