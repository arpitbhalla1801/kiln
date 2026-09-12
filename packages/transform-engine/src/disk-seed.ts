import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { normalizePath } from './path-utils.js';
import type { TransformPipeline } from './transform-types.js';
import type { VirtualFilesystem } from './vfs.js';

/** Collect file paths referenced by a transform pipeline. */
export function collectTransformFilePaths(transforms: TransformPipeline): string[] {
  const paths = new Set<string>();

  for (const transform of transforms) {
    switch (transform.type) {
      case 'package-json-mutation':
        paths.add(transform.filePath ?? 'package.json');
        break;
      case 'file-create':
      case 'file-patch':
      case 'file-delete':
      case 'json-mutation':
      case 'env-mutation':
        paths.add(transform.filePath);
        break;
      default:
        break;
    }
  }

  return Array.from(paths).sort((left, right) => left.localeCompare(right));
}

/** Load existing on-disk files into the VFS baseline before applying mutations. */
export async function seedVfsFromDisk(
  vfs: VirtualFilesystem,
  rootDir: string,
  filePaths: string[]
): Promise<void> {
  for (const filePath of filePaths) {
    const normalizedPath = normalizePath(filePath);
    const absolutePath = path.isAbsolute(normalizedPath)
      ? path.normalize(normalizedPath)
      : path.join(rootDir, normalizedPath);

    try {
      const content = await fs.readFile(absolutePath, 'utf8');
      vfs.loadBaseline(normalizedPath, content);
    } catch (error: unknown) {
      if (!isEnoent(error)) {
        throw error;
      }
    }
  }
}

function isEnoent(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}
