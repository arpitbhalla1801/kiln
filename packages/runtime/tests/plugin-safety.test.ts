import { afterAll, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CapabilityRuntime } from '../src/capability-runtime.js';
import { PLUGIN_CONFIG_FILE } from '@kiln/project-model';

const tempRoots: string[] = [];

async function installFakePackage(
  root: string,
  packageName: string,
  version: string,
  indexContent: string
): Promise<void> {
  const packageDir = join(root, 'node_modules', packageName);
  await mkdir(packageDir, { recursive: true });
  await writeFile(
    join(packageDir, 'package.json'),
    JSON.stringify({
      name: packageName,
      version,
      type: 'module',
      main: 'index.mjs',
      dependencies: { '@kiln/capability-sdk': '^0.1.0' },
    })
  );
  await writeFile(join(packageDir, 'index.mjs'), indexContent);
}

async function createTempProject(
  plugins: Array<{ package: string; version: string }>
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'kiln-plugin-safety-'));
  tempRoots.push(root);

  const dependencies = Object.fromEntries(plugins.map((entry) => [entry.package, entry.version]));
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ name: 'demo-app', version: '1.0.0', dependencies })
  );
  await writeFile(join(root, PLUGIN_CONFIG_FILE), JSON.stringify({ plugins }));

  return root;
}

afterAll(async () => {
  for (const root of tempRoots) {
    await rm(root, { recursive: true, force: true });
  }
});

describe('plugin safe-failure isolation', () => {
  test('a plugin that throws in its constructor is skipped, not crashed on', async () => {
    const root = await createTempProject([
      { package: 'kiln-capability-throws-in-ctor', version: '1.0.0' },
    ]);
    await installFakePackage(
      root,
      'kiln-capability-throws-in-ctor',
      '1.0.0',
      `
      export default class {
        constructor() {
          throw new Error('boom in constructor');
        }
      }
      `
    );

    const runtime = new CapabilityRuntime();
    const results = await runtime.loadPlugins(root);

    expect(results).toHaveLength(1);
    expect(results[0].skipped).toBe(true);
    expect(results[0].capability).toBeUndefined();
  });

  test('a plugin that throws in getManifest() is skipped, not crashed on', async () => {
    const root = await createTempProject([
      { package: 'kiln-capability-throws-in-manifest', version: '1.0.0' },
    ]);
    await installFakePackage(
      root,
      'kiln-capability-throws-in-manifest',
      '1.0.0',
      `
      export default {
        id: 'throws-in-manifest',
        async getManifest() {
          throw new Error('boom in getManifest');
        },
        async getCapability() { return {}; },
        async planAdd() { return {}; },
      };
      `
    );

    const runtime = new CapabilityRuntime();
    const results = await runtime.loadPlugins(root);

    expect(results).toHaveLength(1);
    expect(results[0].skipped).toBe(true);
    expect(results[0].reason).toContain('threw from getManifest()');
  });

  test('a plugin with a missing/malformed manifest is skipped, not crashed on', async () => {
    const root = await createTempProject([
      { package: 'kiln-capability-bad-manifest', version: '1.0.0' },
    ]);
    await installFakePackage(
      root,
      'kiln-capability-bad-manifest',
      '1.0.0',
      `
      export default {
        id: 'bad-manifest',
        async getManifest() { return { nothingHere: true }; },
        async getCapability() { return {}; },
        async planAdd() { return {}; },
      };
      `
    );

    const runtime = new CapabilityRuntime();
    const results = await runtime.loadPlugins(root);

    expect(results).toHaveLength(1);
    expect(results[0].skipped).toBe(true);
    expect(results[0].reason).toContain('malformed manifest');
  });

  test('kiln add env/auth/db all still work when broken plugins are listed in kiln.plugins.json', async () => {
    const plugins = [
      { package: 'kiln-capability-throws-in-ctor', version: '1.0.0' },
      { package: 'kiln-capability-throws-in-manifest', version: '1.0.0' },
      { package: 'kiln-capability-bad-manifest', version: '1.0.0' },
    ];
    const root = await createTempProject(plugins);

    await installFakePackage(
      root,
      'kiln-capability-throws-in-ctor',
      '1.0.0',
      `export default class { constructor() { throw new Error('boom'); } }`
    );
    await installFakePackage(
      root,
      'kiln-capability-throws-in-manifest',
      '1.0.0',
      `
      export default {
        id: 'throws-in-manifest',
        async getManifest() { throw new Error('boom'); },
        async getCapability() { return {}; },
        async planAdd() { return {}; },
      };
      `
    );
    await installFakePackage(
      root,
      'kiln-capability-bad-manifest',
      '1.0.0',
      `
      export default {
        id: 'bad-manifest',
        async getManifest() { return {}; },
        async getCapability() { return {}; },
        async planAdd() { return {}; },
      };
      `
    );

    const runtime = new CapabilityRuntime();
    const loadResults = await runtime.loadPlugins(root);
    expect(loadResults.every((result) => result.skipped)).toBe(true);

    const envResult = await runtime.addCapability('env', {
      cwd: root,
      dryRun: true,
      variables: { DATABASE_URL: { example: 'postgres://localhost:5432/app', required: true } },
    });
    expect(envResult.capabilityId).toBe('env');

    const authResult = await runtime.addCapability('auth', { cwd: root, dryRun: true });
    expect(authResult.capabilityId).toBe('auth');

    const dbResult = await runtime.addCapability('db', { cwd: root, dryRun: true });
    expect(dbResult.capabilityId).toBe('db');
  });
});
