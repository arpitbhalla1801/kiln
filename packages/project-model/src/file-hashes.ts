import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { KILN_DIRECTORY } from './ownership-storage.js';

export const FILE_HASHES_FILE = 'file-hashes.json';

/** Hash file content, ignoring CRLF vs LF so a git autocrlf checkout does not read as an edit. */
export function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content.replace(/\r\n/g, '\n')).digest('hex');
}

/**
 * Records the hash of each file kiln wrote, in `.kiln/file-hashes.json`, so `kiln remove`
 * can tell an untouched kiln-generated file from one the user has since edited.
 */
export class FileHashStore {
  static getFilePath(projectRoot: string): string {
    return path.join(projectRoot, KILN_DIRECTORY, FILE_HASHES_FILE);
  }

  static async load(projectRoot: string): Promise<Record<string, string>> {
    try {
      const parsed = JSON.parse(await fs.readFile(FileHashStore.getFilePath(projectRoot), 'utf8'));
      return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, string>) : {};
    } catch {
      return {};
    }
  }

  /** Record `files` (path -> content written) and drop `forget` paths. */
  static async update(
    projectRoot: string,
    files: Record<string, string>,
    forget: string[] = []
  ): Promise<void> {
    const hashes = await FileHashStore.load(projectRoot);
    for (const [filePath, content] of Object.entries(files)) {
      hashes[filePath] = hashContent(content);
    }
    for (const filePath of forget) {
      delete hashes[filePath];
    }

    const sorted = Object.fromEntries(Object.entries(hashes).sort(([a], [b]) => a.localeCompare(b)));
    const target = FileHashStore.getFilePath(projectRoot);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
  }
}
