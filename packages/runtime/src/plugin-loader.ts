import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Capability } from '@kiln/capability-sdk';
import type { PluginConfigEntry } from '@kiln/project-model';

/** Outcome of attempting to load one plugin entry from kiln.plugins.json. */
export interface PluginLoadResult {
  entry: PluginConfigEntry;
  capability?: Capability;
  skipped: boolean;
  reason?: string;
}

/**
 * Loads one third-party capability from the target project's own
 * node_modules, per the strict trust model: the package must be a direct
 * dependency of the project, its installed version must exactly match the
 * pinned version, and nothing is ever loaded from kiln's own bundle or via
 * naming-convention auto-discovery. Any failure at any step is a skip, not
 * a thrown error -- callers rely on this to keep loading unrelated plugins
 * (and built-ins) even when one entry is broken or hostile.
 */
export async function loadPlugin(
  projectRoot: string,
  entry: PluginConfigEntry
): Promise<PluginLoadResult> {
  const isDirectDependency = await isDirectDependencyOf(projectRoot, entry.package);
  if (!isDirectDependency) {
    return skip(
      entry,
      `'${entry.package}' must be a direct dependency in this project's package.json`
    );
  }

  const packageDir = join(projectRoot, 'node_modules', entry.package);
  let installedVersion: string | undefined;
  try {
    const installedPackageJson = JSON.parse(
      await readFile(join(packageDir, 'package.json'), 'utf8')
    ) as { version?: string };
    installedVersion = installedPackageJson.version;
  } catch {
    return skip(entry, `'${entry.package}' is not installed in this project's node_modules`);
  }

  if (installedVersion !== entry.version) {
    return skip(
      entry,
      `'${entry.package}' installed version '${installedVersion}' does not match the version '${entry.version}' pinned in kiln.plugins.json`
    );
  }

  let capability: Capability | undefined;
  try {
    const moduleUrl = pathToFileURL(packageDir).href;
    const loadedModule: unknown = await import(moduleUrl);
    capability = resolvePluginCapability(loadedModule);
  } catch (error) {
    return skip(entry, `'${entry.package}' threw while loading: ${(error as Error).message}`);
  }

  if (!capability) {
    return skip(
      entry,
      `'${entry.package}' does not export a usable Capability (expected a default export -- an object or a class -- implementing id/getManifest/getCapability/planAdd, optionally under a 'capability' named export)`
    );
  }

  try {
    const manifest = await capability.getManifest();
    if (typeof manifest?.id !== 'string' || typeof manifest?.version !== 'string') {
      return skip(
        entry,
        `'${entry.package}' returned a malformed manifest from getManifest() (missing id or version)`
      );
    }
  } catch (error) {
    return skip(
      entry,
      `'${entry.package}' threw from getManifest(): ${(error as Error).message}`
    );
  }

  return { entry, capability, skipped: false };
}

/** Load every entry in a trust config, skipping (never throwing on) broken ones. */
export async function loadPlugins(
  projectRoot: string,
  entries: PluginConfigEntry[]
): Promise<PluginLoadResult[]> {
  return Promise.all(entries.map((entry) => loadPlugin(projectRoot, entry)));
}

async function isDirectDependencyOf(projectRoot: string, packageName: string): Promise<boolean> {
  let packageJson: { dependencies?: Record<string, unknown>; devDependencies?: Record<string, unknown> };
  try {
    packageJson = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'));
  } catch {
    return false;
  }

  return Boolean(
    packageJson.dependencies?.[packageName] || packageJson.devDependencies?.[packageName]
  );
}

function resolvePluginCapability(loadedModule: unknown): Capability | undefined {
  if (typeof loadedModule !== 'object' || loadedModule === null) {
    return undefined;
  }

  const candidates = [
    (loadedModule as { default?: unknown }).default,
    (loadedModule as { capability?: unknown }).capability,
  ];

  for (const candidate of candidates) {
    const instance = instantiateIfClass(candidate);
    if (isCapability(instance)) {
      return instance;
    }
  }

  return undefined;
}

/**
 * A plugin's default export may be a ready-made Capability object or a
 * class to instantiate. A throwing constructor is a plugin bug, not a
 * loader bug -- treat it the same as any other broken export (fall
 * through to "not a usable Capability") rather than letting it propagate.
 */
function instantiateIfClass(candidate: unknown): unknown {
  if (typeof candidate !== 'function') {
    return candidate;
  }

  try {
    return new (candidate as new () => unknown)();
  } catch {
    return undefined;
  }
}

function isCapability(value: unknown): value is Capability {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<Capability>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.getManifest === 'function' &&
    typeof candidate.getCapability === 'function' &&
    typeof candidate.planAdd === 'function'
  );
}

function skip(entry: PluginConfigEntry, reason: string): PluginLoadResult {
  return { entry, skipped: true, reason };
}
