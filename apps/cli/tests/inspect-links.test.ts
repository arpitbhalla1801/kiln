import './helpers/no-install.js';
import { afterAll, describe, expect, spyOn, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LockfileStore } from '@kiln-cli/project-model';
import { registerCapability } from '@kiln-cli/runtime';
import { runAdd } from '../src/commands/add.js';
import { runInit } from '../src/commands/init.js';
import { runInspect } from '../src/commands/inspect.js';

const tempRoots: string[] = [];

afterAll(async () => {
  for (const root of tempRoots) {
    await rm(root, { recursive: true, force: true });
  }
}, 120000);

async function createProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'kiln-inspect-links-'));
  tempRoots.push(root);
  await runInit(root, 'demo-app');
  return root;
}

async function inspectOutput(root: string): Promise<string> {
  const lines: string[] = [];
  const spy = spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    lines.push(args.join(' '));
  });
  try {
    await runInspect({ cwd: root, dryRun: false });
  } finally {
    spy.mockRestore();
  }
  return lines.join('\n');
}

describe('kiln inspect capability links', () => {
  test('shows enhances under an installed capability, marking an absent partner', async () => {
    const root = await createProject();
    await runAdd('env', { cwd: root, dryRun: false });
    await runAdd('auth', { cwd: root, dryRun: false });

    const output = await inspectOutput(root);

    expect(output).toContain('Capability links:');
    expect(output).toMatch(/ {2}auth\n {4}enhances - db/);
  });

  test('shows the partner as present once both are installed', async () => {
    const root = await createProject();
    await runAdd('auth', { cwd: root, dryRun: false });
    await runAdd('db', { cwd: root, dryRun: false });

    const output = await inspectOutput(root);

    expect(output).toMatch(/ {2}auth\n {4}enhances ✓ db/);
    expect(output).toMatch(/ {2}db\n {4}enhances ✓ auth/);
  });

  test('marks a requirement that is not installed', async () => {
    registerCapability('il-widget', ['il-missing']);
    const root = await createProject();
    await LockfileStore.save(
      {
        lockfileVersion: 1,
        project: { name: 'demo-app', version: '1.0.0' },
        snapshot: {
          capabilities: [
            { id: 'il-widget', version: '1.0.0', resolved: 'capability:il-widget@1.0.0', dependencies: {} },
          ],
          timestamp: new Date().toISOString(),
          engineVersion: '0.0.0',
          lastCapability: 'il-widget',
        },
      },
      root
    );

    expect(await inspectOutput(root)).toMatch(/ {2}il-widget\n {4}requires ✗ missing: il-missing/);
  });

  test('prints no links section on a fresh project', async () => {
    const root = await createProject();

    expect(await inspectOutput(root)).not.toContain('Capability links:');
  });
});
