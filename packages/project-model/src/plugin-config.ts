import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export const PLUGIN_CONFIG_FILE = 'kiln.plugins.json';

/** One third-party capability a project trusts, pinned to an exact version. */
export interface PluginConfigEntry {
  package: string;
  version: string;
}

/** Project-root trust config listing exactly which plugin packages a project loads. */
export interface PluginConfig {
  plugins: PluginConfigEntry[];
}

/** Resolve the `kiln.plugins.json` path for a kiln project root. */
export function getPluginConfigPath(projectRoot: string): string {
  return path.join(projectRoot, PLUGIN_CONFIG_FILE);
}

/**
 * Parse and validate kiln.plugins.json content. Throws with a specific,
 * actionable message on any structural problem -- this config gates what
 * third-party code kiln will load, so a malformed file must fail loudly
 * rather than silently trusting nothing or trusting something unintended.
 */
export function parsePluginConfig(content: string): PluginConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(
      `Invalid ${PLUGIN_CONFIG_FILE}: not valid JSON (${(error as Error).message})`
    );
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Invalid ${PLUGIN_CONFIG_FILE}: top-level value must be an object`);
  }

  const { plugins } = parsed as Record<string, unknown>;
  if (!Array.isArray(plugins)) {
    throw new Error(`Invalid ${PLUGIN_CONFIG_FILE}: "plugins" must be an array`);
  }

  const validated = plugins.map((entry, index) => validatePluginEntry(entry, index));

  return { plugins: validated };
}

function validatePluginEntry(entry: unknown, index: number): PluginConfigEntry {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    throw new Error(`Invalid ${PLUGIN_CONFIG_FILE}: plugins[${index}] must be an object`);
  }

  const { package: pkg, version } = entry as Record<string, unknown>;

  if (typeof pkg !== 'string' || pkg.trim().length === 0) {
    throw new Error(
      `Invalid ${PLUGIN_CONFIG_FILE}: plugins[${index}].package must be a non-empty string`
    );
  }

  if (typeof version !== 'string' || version.trim().length === 0) {
    throw new Error(
      `Invalid ${PLUGIN_CONFIG_FILE}: plugins[${index}].version must be a non-empty string`
    );
  }

  return { package: pkg, version };
}

/** Loads and validates a project's `kiln.plugins.json` trust config. */
export class PluginConfigStore {
  static getFilePath(projectRoot: string): string {
    return getPluginConfigPath(projectRoot);
  }

  static async exists(projectRoot: string): Promise<boolean> {
    try {
      await fs.access(PluginConfigStore.getFilePath(projectRoot));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * A missing file means the project trusts no plugins -- the normal case.
   * A file that exists but fails to parse/validate throws, since that means
   * the project owner opted into a trust config kiln can't safely honor.
   */
  static async load(projectRoot: string): Promise<PluginConfig> {
    let content: string;

    try {
      content = await fs.readFile(PluginConfigStore.getFilePath(projectRoot), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { plugins: [] };
      }
      throw error;
    }

    return parsePluginConfig(content);
  }
}
