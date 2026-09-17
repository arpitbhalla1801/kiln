import { afterAll, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LockfileStore, PLUGIN_CONFIG_FILE } from '@kiln/project-model';
import { CapabilityRuntime } from '../src/capability-runtime.js';

const tempRoots: string[] = [];

async function createTempProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'kiln-plugin-provenance-'));
  tempRoots.push(root);
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'demo-app',
      version: '1.0.0',
      dependencies: { 'kiln-capability-fake': '1.4.2' },
    })
  );
  await writeFile(
    join(root, PLUGIN_CONFIG_FILE),
    JSON.stringify({ plugins: [{ package: 'kiln-capability-fake', version: '1.4.2' }] })
  );

  const packageDir = join(root, 'node_modules', 'kiln-capability-fake');
  await mkdir(packageDir, { recursive: true });
  await writeFile(
    join(packageDir, 'package.json'),
    JSON.stringify({
      name: 'kiln-capability-fake',
      version: '1.4.2',
      type: 'module',
      main: 'index.mjs',
      dependencies: { '@kiln/capability-sdk': '^0.1.0' },
    })
  );
  await writeFile(
    join(packageDir, 'index.mjs'),
    `
    export default {
      id: 'fake-plugin',
      async getManifest() {
        return { id: 'fake-plugin', version: '1.4.2', dependencies: [] };
      },
      async getCapability() {
        return { id: 'fake-plugin', version: '1.4.2', dependencies: [] };
      },
      async planAdd() {
        return {
          transforms: [],
          capability: { id: 'fake-plugin', version: '1.4.2', dependencies: [] },
          ownershipRegistrations: [],
        };
      },
    };
    `
  );

  return root;
}

afterAll(async () => {
  for (const root of tempRoots) {
    await rm(root, { recursive: true, force: true });
  }
});

describe('lockfile provenance for plugin-loaded capabilities', () => {
  test('a capability loaded via loadPlugins() records npm:<package>@<version>', async () => {
    const root = await createTempProject();
    const runtime = new CapabilityRuntime();

    const loadResults = await runtime.loadPlugins(root);
    expect(loadResults[0].skipped).toBe(false);

    await runtime.addCapability('fake-plugin', { cwd: root, dryRun: false });

    const lockfile = await LockfileStore.load(root);
    const entry = lockfile?.snapshot.capabilities.find((item) => item.id === 'fake-plugin');

    expect(entry?.resolved).toBe('npm:kiln-capability-fake@1.4.2');
  });

  test('a built-in capability keeps the synthetic resolved form', async () => {
    const root = await createTempProject();
    const runtime = new CapabilityRuntime();

    await runtime.addCapability('env', {
      cwd: root,
      dryRun: false,
      variables: { DATABASE_URL: { example: 'postgres://localhost:5432/app', required: true } },
    });

    const lockfile = await LockfileStore.load(root);
    const entry = lockfile?.snapshot.capabilities.find((item) => item.id === 'env');

    expect(entry?.resolved).toMatch(/^capability:env@/);
  });
});
