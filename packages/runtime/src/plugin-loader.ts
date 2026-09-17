import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SDK_VERSION, type Capability } from '@kiln/capability-sdk';
import type { PluginConfigEntry } from '@kiln/project-model';

const KILN_SDK_MAJOR = extractMajorVersion(SDK_VERSION);

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

  const declaredSdkRange = await getDeclaredSdkRange(packageDir);
  const declaredSdkMajor = declaredSdkRange ? extractMajorVersion(declaredSdkRange) : undefined;

  if (declaredSdkMajor === undefined) {
    return skip(
      entry,
      `'${entry.package}' does not declare a '@kiln/capability-sdk' dependency, so kiln can't verify it targets a compatible SDK major version`
    );
  }

  if (declaredSdkMajor !== KILN_SDK_MAJOR) {
    return skip(
      entry,
      `'${entry.package}' targets @kiln/capability-sdk v${declaredSdkMajor}, but this kiln build uses v${KILN_SDK_MAJOR}. Upgrade the plugin to target v${KILN_SDK_MAJOR}, or upgrade kiln if you need v${declaredSdkMajor} support.`
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

/** Outcome of checking one trust-config entry's version pin, without loading it. */
export interface PluginPinCheck {
  entry: PluginConfigEntry;
  ok: boolean;
  installedVersion?: string;
  reason?: string;
}

/**
 * Checks whether a trust-config entry is a direct dependency with an
 * installed version matching its pin -- the same two checks `loadPlugin`
 * makes before ever importing anything, exposed standalone so `kiln plugins
 * verify` can report pin mismatches without loading (and therefore
 * executing) any plugin code.
 */
export async function checkPluginPin(
  projectRoot: string,
  entry: PluginConfigEntry
): Promise<PluginPinCheck> {
  const isDirectDependency = await isDirectDependencyOf(projectRoot, entry.package);
  if (!isDirectDependency) {
    return {
      entry,
      ok: false,
      reason: `'${entry.package}' must be a direct dependency in this project's package.json`,
    };
  }

  const packageDir = join(projectRoot, 'node_modules', entry.package);
  let installedVersion: string | undefined;
  try {
    const installedPackageJson = JSON.parse(
      await readFile(join(packageDir, 'package.json'), 'utf8')
    ) as { version?: string };
    installedVersion = installedPackageJson.version;
  } catch {
    return {
      entry,
      ok: false,
      reason: `'${entry.package}' is not installed in this project's node_modules`,
    };
  }

  if (installedVersion !== entry.version) {
    return {
      entry,
      ok: false,
      installedVersion,
      reason: `installed version '${installedVersion}' does not match the pinned version '${entry.version}'`,
    };
  }

  return { entry, ok: true, installedVersion };
}

/** Check every entry in a trust config's version pin, without loading any of them. */
export async function checkPluginPins(
  projectRoot: string,
  entries: PluginConfigEntry[]
): Promise<PluginPinCheck[]> {
  return Promise.all(entries.map((entry) => checkPluginPin(projectRoot, entry)));
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

async function getDeclaredSdkRange(packageDir: string): Promise<string | undefined> {
  try {
    const packageJson = JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    return (
      packageJson.peerDependencies?.['@kiln/capability-sdk'] ??
      packageJson.dependencies?.['@kiln/capability-sdk'] ??
      packageJson.devDependencies?.['@kiln/capability-sdk']
    );
  } catch {
    return undefined;
  }
}

/** Extracts the leading major version number from a semver version or range (e.g. "^1.2.0" -> 1). */
function extractMajorVersion(versionOrRange: string): number | undefined {
  const match = versionOrRange.match(/\d+/);
  return match ? Number(match[0]) : undefined;
}
