import './helpers/no-install.js';
import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LockfileStore } from '@kiln-cli/project-model';
import { registerCapability } from '@kiln-cli/runtime';
import { runInit } from '../src/commands/init.js';
import { runRemove } from '../src/commands/remove.js';

const tempRoots: string[] = [];

afterAll(async () => {
  for (const root of tempRoots) {
    await rm(root, { recursive: true, force: true });
  }
}, 120000);

async function createProjectWithInstalled(ids: string[]): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'kiln-dependents-'));
  tempRoots.push(root);
  await runInit(root, 'demo-app');
  await LockfileStore.save(
    {
      lockfileVersion: 1,
      project: { name: 'demo-app', version: '1.0.0' },
      snapshot: {
        capabilities: ids.map((id) => ({
          id,
          version: '1.0.0',
          resolved: `capability:${id}@1.0.0`,
          dependencies: {},
        })),
        timestamp: new Date().toISOString(),
        engineVersion: '0.0.0',
        lastCapability: ids[ids.length - 1],
      },
    },
    root
  );
  return root;
}

describe('remove with installed dependents', () => {
  test('refuses to remove a capability another installed capability requires', async () => {
    registerCapability('rd-teams', ['db']);
    const root = await createProjectWithInstalled(['db', 'rd-teams']);

    await expect(runRemove('db', { cwd: root })).rejects.toThrow(
      "Refusing to remove 'db': rd-teams requires db. Remove rd-teams first. Re-run with --force to remove anyway."
    );
  });

  test('--force skips the dependents refusal', async () => {
    registerCapability('rd-teams-force', ['db']);
    const root = await createProjectWithInstalled(['db', 'rd-teams-force']);

    // db owns nothing in this bare project, so a forced remove is a no-op rather than a refusal.
    await expect(runRemove('db', { cwd: root, force: true })).resolves.toBeUndefined();
  });

  test('--dry-run reports the dependents without throwing', async () => {
    registerCapability('rd-teams-dry', ['db']);
    const root = await createProjectWithInstalled(['db', 'rd-teams-dry']);

    await expect(runRemove('db', { cwd: root, dryRun: true })).resolves.toBeUndefined();
  });
});
