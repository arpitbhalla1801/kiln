import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CACHE_PATH = join(homedir(), '.kiln-update-check.json');
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 1500;
const REGISTRY_URL = 'https://registry.npmjs.org/@kiln-cli%2fkiln/latest';

interface UpdateCache {
  lastCheck: number;
  latestVersion: string;
}

/**
 * Prints a one-line notice if a newer version is available, using a cached
 * result so most invocations don't touch the network. Never throws --
 * failures here should never block or break a real command.
 */
export async function checkForUpdate(currentVersion: string): Promise<void> {
  try {
    const cache = await readCache();

    if (cache && isNewer(cache.latestVersion, currentVersion)) {
      printNotice(currentVersion, cache.latestVersion);
    }

    if (!cache || Date.now() - cache.lastCheck > CHECK_INTERVAL_MS) {
      // Fire and forget -- refresh the cache for next time without
      // delaying this invocation's own output.
      void refreshCache();
    }
  } catch {
    // Never let update-checking break the actual command.
  }
}

async function readCache(): Promise<UpdateCache | undefined> {
  try {
    const content = await readFile(CACHE_PATH, 'utf8');
    return JSON.parse(content) as UpdateCache;
  } catch {
    return undefined;
  }
}

async function refreshCache(): Promise<void> {
  try {
    const latestVersion = await fetchLatestVersion();
    const cache: UpdateCache = { lastCheck: Date.now(), latestVersion };
    await writeFile(CACHE_PATH, JSON.stringify(cache), 'utf8');
  } catch {
    // Ignore network/filesystem failures -- try again next time.
  }
}

async function fetchLatestVersion(): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(REGISTRY_URL, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Registry responded with ${response.status}`);
    }

    const data = (await response.json()) as { version?: string };
    if (!data.version) {
      throw new Error('Registry response missing version');
    }

    return data.version;
  } finally {
    clearTimeout(timeout);
  }
}

function isNewer(latest: string, current: string): boolean {
  const latestParts = parseVersion(latest);
  const currentParts = parseVersion(current);
  if (!latestParts || !currentParts) {
    return false;
  }

  for (let i = 0; i < 3; i += 1) {
    if (latestParts[i] > currentParts[i]) return true;
    if (latestParts[i] < currentParts[i]) return false;
  }

  return false;
}

function parseVersion(version: string): [number, number, number] | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match) {
    return undefined;
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function printNotice(current: string, latest: string): void {
  console.error(
    `\nA new version of kiln is available: ${current} -> ${latest}\nRun: npm install -g @kiln-cli/kiln\n`
  );
}
