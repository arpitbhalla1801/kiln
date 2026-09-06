import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TransformPipeline } from '@kiln/transform-engine';

const DEFAULT_PACKAGE_JSON_PATH = 'package.json';

/** Collect every file path a transform pipeline reads or writes. */
export function collectTransformFilePaths(transforms: TransformPipeline): string[] {
  const paths = new Set<string>();

  for (const transform of transforms) {
    if (transform.type === 'package-json-mutation') {
      paths.add(transform.filePath ?? DEFAULT_PACKAGE_JSON_PATH);
      continue;
    }

    paths.add(transform.filePath);
  }

  return Array.from(paths);
}

/**
 * Read the current on-disk contents for a set of project-relative paths.
 * Missing files are omitted so the transform engine treats them as new creates.
 */
export async function loadInitialFiles(
  rootPath: string,
  filePaths: string[]
): Promise<Record<string, string>> {
  const initialFiles: Record<string, string> = {};

  await Promise.all(
    filePaths.map(async (filePath) => {
      try {
        initialFiles[filePath] = await readFile(join(rootPath, filePath), 'utf8');
      } catch {
        // File does not exist yet; leave it out of the baseline.
      }
    })
  );

  return initialFiles;
}
