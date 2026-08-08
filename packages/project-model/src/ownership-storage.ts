import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parseOwnershipMetadata, serializeOwnershipMetadata } from './ownership.js';
import type { OwnershipMetadata } from './types.js';

export const KILN_DIRECTORY = '.kiln';
export const OWNERSHIP_METADATA_FILE = 'ownership.json';
const TEMP_SUFFIX = '.kiln.tmp';

/** Resolve the `.kiln/ownership.json` path for a kiln project root. */
export function getOwnershipMetadataPath(projectRoot: string): string {
  return path.join(projectRoot, KILN_DIRECTORY, OWNERSHIP_METADATA_FILE);
}

/** Persist and reload ownership metadata from `.kiln/ownership.json`. */
export class OwnershipMetadataStore {
  static getFilePath(projectRoot: string): string {
    return getOwnershipMetadataPath(projectRoot);
  }

  static async exists(projectRoot: string): Promise<boolean> {
    try {
      await fs.access(OwnershipMetadataStore.getFilePath(projectRoot));
      return true;
    } catch {
      return false;
    }
  }

  static async save(metadata: OwnershipMetadata, projectRoot: string): Promise<void> {
    const filePath = OwnershipMetadataStore.getFilePath(projectRoot);
    const kilnDirectory = path.join(projectRoot, KILN_DIRECTORY);
    await fs.mkdir(kilnDirectory, { recursive: true });

    const content = serializeOwnershipMetadata(metadata);
    await atomicWriteFile(filePath, content);
  }

  static async load(projectRoot: string): Promise<OwnershipMetadata> {
    const filePath = OwnershipMetadataStore.getFilePath(projectRoot);
    const content = await fs.readFile(filePath, 'utf8');
    return parseOwnershipMetadata(content);
  }

  /** Reload ownership metadata from disk (alias for load). */
  static async reload(projectRoot: string): Promise<OwnershipMetadata> {
    return OwnershipMetadataStore.load(projectRoot);
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
