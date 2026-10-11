import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../src/commands/init.js';
import { runPlanAdd } from '../src/commands/plan.js';

const tempRoots: string[] = [];

afterAll(async () => {
  for (const root of tempRoots) {
    await rm(root, { recursive: true, force: true });
  }
}, 120000);

async function project(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'kiln-providers-'));
  tempRoots.push(root);
  await runInit(root, 'demo-app');
  return root;
}

describe('--provider is validated against the manifest', () => {
  test('an undeclared provider lists the manifest providers', async () => {
    const cwd = await project();

    await expect(runPlanAdd('auth', { cwd, dryRun: true }, {}, ['discord'])).rejects.toThrow(
      /Unknown auth provider 'discord'. Valid providers: github, google, credentials/
    );
  });

  test('a capability that declares no providers rejects --provider', async () => {
    const cwd = await project();

    await expect(runPlanAdd('env', { cwd, dryRun: true }, {}, ['github'])).rejects.toThrow(
      /Capability 'env' takes no --provider option/
    );
  });
});
