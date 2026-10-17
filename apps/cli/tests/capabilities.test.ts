import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runAdd } from '../src/commands/add.js';
import { runCapabilitiesList, runCapabilitiesShow } from '../src/commands/capabilities.js';
import { runInit } from '../src/commands/init.js';

const tempRoots: string[] = [];

async function capture(run: () => Promise<void>): Promise<string> {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  };
  try {
    await run();
  } finally {
    console.log = original;
  }
  return lines.join('\n');
}

async function emptyDir(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'kiln-capabilities-'));
  tempRoots.push(root);
  return root;
}

afterAll(async () => {
  for (const root of tempRoots) {
    await rm(root, { recursive: true, force: true });
  }
});

describe('kiln capabilities', () => {
  test('list --json describes every built-in as verified, outside any project', async () => {
    const cwd = await emptyDir();
    const output = await capture(() => runCapabilitiesList({ cwd, json: true }));
    const entries = JSON.parse(output) as Array<Record<string, unknown>>;

    expect(entries.map((entry) => entry.id)).toEqual(['auth', 'db', 'env', 'logging']);
    for (const entry of entries) {
      expect(entry.source).toBe('builtin');
      expect(entry.verified).toBe(true);
      expect(typeof entry.description).toBe('string');
      expect(entry.frameworks).toEqual(['nextjs']);
    }
  });

  test('list --json reports installed state and version from the project', async () => {
    const root = await emptyDir();
    await runInit(root, 'demo-app');
    await runAdd('env', { cwd: root, dryRun: false });

    const output = await capture(() => runCapabilitiesList({ cwd: root, json: true }));
    const byId = Object.fromEntries(
      (JSON.parse(output) as Array<{ id: string; installed: boolean; installedVersion?: string }>).map(
        (entry) => [entry.id, entry]
      )
    );
    expect(byId.env.installed).toBe(true);
    expect(byId.env.installedVersion).toMatch(/^[0-9]+.[0-9]+.[0-9]+/);
    expect(byId.db.installed).toBe(false);
    expect(byId.auth.installed).toBe(false);
  }, 60000);

  test('show --json returns the full manifest and its hash', async () => {
    const cwd = await emptyDir();
    const output = await capture(() => runCapabilitiesShow('auth', { cwd, json: true }));
    const entry = JSON.parse(output);

    expect(entry.manifestSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(entry.manifest.providers.map((p: { id: string }) => p.id)).toEqual([
      'github',
      'google',
      'credentials',
    ]);
    expect(entry.manifest.operations).toEqual(['add', 'remove']);
    expect(entry.manifest.verify.length).toBeGreaterThan(0);
  });

  test('show rejects an unknown capability and lists the valid ones', async () => {
    const cwd = await emptyDir();
    await expect(runCapabilitiesShow('nope', { cwd, json: false })).rejects.toThrow(
      /Unknown capability 'nope'.*auth, db, env/
    );
  });
});
