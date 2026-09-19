import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Returns true if a filesystem entry exists at the given path. */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Type guard for plain (non-array, non-null) objects. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reads and parses package.json at the project root, or null if it doesn't exist. */
export async function readPackageJson(rootPath: string): Promise<Record<string, unknown> | null> {
  const packageJsonPath = join(rootPath, 'package.json');
  if (!(await fileExists(packageJsonPath))) {
    return null;
  }

  const content = await readFile(packageJsonPath, 'utf8');
  return JSON.parse(content) as Record<string, unknown>;
}

/** Returns true if the given dependency is listed in dependencies or devDependencies. */
export async function hasDependency(rootPath: string, dependencyName: string): Promise<boolean> {
  const packageJson = await readPackageJson(rootPath);
  if (!packageJson) {
    return false;
  }

  const dependencies = isRecord(packageJson.dependencies) ? packageJson.dependencies : {};
  const devDependencies = isRecord(packageJson.devDependencies)
    ? packageJson.devDependencies
    : {};

  return dependencyName in dependencies || dependencyName in devDependencies;
}

/** Merges two string arrays into a deduplicated, sorted array. */
export function mergeUnique(existing: string[], additions: string[]): string[] {
  const merged = new Set(existing);
  for (const entry of additions) {
    merged.add(entry);
  }

  return Array.from(merged).sort((left, right) => left.localeCompare(right));
}

/**
 * Detects the source root ('src' or '') by checking for marker files/directories
 * under a candidate 'src' directory. Returns 'src' if any marker exists, otherwise ''.
 */
export async function detectSourceRoot(rootPath: string, markers: string[]): Promise<string> {
  for (const marker of markers) {
    if (await fileExists(join(rootPath, 'src', marker))) {
      return 'src';
    }
  }

  return '';
}
