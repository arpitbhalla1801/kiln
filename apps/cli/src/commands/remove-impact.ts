import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FileHashStore, hashContent } from '@kiln/project-model';

const SKIP_DIRECTORIES = new Set(['node_modules', '.git', '.next', '.kiln', '.turbo', 'dist', 'build', 'coverage']);
const SOURCE_EXTENSION = /\.(?:[cm]?[jt]sx?)$/;
const IMPORT_SPECIFIER = /(?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g;

export interface RemovalBreakage {
  file: string;
  detail: string;
}

/** Split owned files into ones safe to delete and ones the user edited since kiln wrote them. */
export async function partitionEditedFiles(
  rootPath: string,
  ownedFiles: string[]
): Promise<{ deletable: string[]; edited: string[] }> {
  const hashes = await FileHashStore.load(rootPath);
  const deletable: string[] = [];
  const edited: string[] = [];

  for (const filePath of ownedFiles) {
    const recorded = hashes[filePath];
    const current = await readFile(join(rootPath, filePath), 'utf8').catch(() => undefined);
    // No recorded hash means the file predates hash tracking: keep the old delete behavior.
    if (recorded !== undefined && current !== undefined && hashContent(current) !== recorded) {
      edited.push(filePath);
    } else {
      deletable.push(filePath);
    }
  }

  return { deletable, edited };
}

/**
 * Find code that still depends on what removal deletes: imports of an owned dependency, imports
 * of an owned file, and package.json scripts that still call `prisma`.
 * ponytail: regex scan, so path aliases beyond a leading `@/` or `~/` and dynamic specifiers are
 * missed; upgrade to a TypeScript-resolver scan if that shows up.
 */
export async function findRemovalBreakage(
  rootPath: string,
  ownedFiles: string[],
  ownedDependencies: string[],
  keptScripts: Record<string, string>
): Promise<RemovalBreakage[]> {
  const breakage: RemovalBreakage[] = [];
  const beingDeleted = new Set(ownedFiles);
  const targets = ownedFiles.map((filePath) => filePath.replace(SOURCE_EXTENSION, ''));

  for (const file of await listSourceFiles(rootPath)) {
    if (beingDeleted.has(file)) {
      continue;
    }

    const content = await readFile(join(rootPath, file), 'utf8').catch(() => '');
    for (const [, specifier] of content.matchAll(IMPORT_SPECIFIER)) {
      const dependency = ownedDependencies.find(
        (name) => specifier === name || specifier.startsWith(`${name}/`)
      );
      if (dependency) {
        breakage.push({ file, detail: `imports '${specifier}' (dependency '${dependency}' will be removed)` });
        continue;
      }

      const normalized = specifier.replace(/^(?:@|~)\//, '').replace(/^(?:\.{1,2}\/)+/, '');
      const target = targets.find((path) => path === normalized || path.endsWith(`/${normalized}`));
      if (target && /^(?:@|~|\.)/.test(specifier)) {
        breakage.push({ file, detail: `imports '${specifier}' (${target} will be deleted)` });
      }
    }
  }

  if (ownedDependencies.includes('prisma')) {
    for (const [name, command] of Object.entries(keptScripts)) {
      if (/\bprisma\b/.test(command)) {
        breakage.push({ file: 'package.json', detail: `script '${name}' still runs prisma` });
      }
    }
  }

  return breakage;
}

async function listSourceFiles(rootPath: string, directory = ''): Promise<string[]> {
  const entries = await readdir(join(rootPath, directory), { withFileTypes: true }).catch(() => []);
  const files: string[] = [];

  for (const entry of entries) {
    const relative = directory ? `${directory}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!SKIP_DIRECTORIES.has(entry.name)) {
        files.push(...(await listSourceFiles(rootPath, relative)));
      }
    } else if (SOURCE_EXTENSION.test(entry.name)) {
      files.push(relative);
    }
  }

  return files;
}
