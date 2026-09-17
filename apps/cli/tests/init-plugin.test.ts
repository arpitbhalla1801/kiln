import { afterAll, describe, expect, test } from 'bun:test';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { runInitPlugin } from '../src/commands/init-plugin.js';

const tempRoots: string[] = [];

async function createTempParentDir(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'kiln-init-plugin-'));
  tempRoots.push(root);
  return root;
}

afterAll(async () => {
  for (const root of tempRoots) {
    await rm(root, { recursive: true, force: true });
  }
});

describe('kiln init-plugin', () => {
  test('scaffolds the expected file layout with the right names substituted', async () => {
    const parent = await createTempParentDir();
    await runInitPlugin(parent, 'stripe');

    const pluginDir = join(parent, 'kiln-capability-stripe');
    const packageJson = JSON.parse(await readFile(join(pluginDir, 'package.json'), 'utf8'));
    expect(packageJson.name).toBe('kiln-capability-stripe');
    expect(packageJson.dependencies['@kiln/capability-sdk']).toBeDefined();
    expect(packageJson.dependencies['@kiln/core']).toBeUndefined();

    const manifest = JSON.parse(await readFile(join(pluginDir, 'kiln.manifest.json'), 'utf8'));
    expect(manifest.id).toBe('stripe');
    expect(manifest.ownership.files).toEqual(['stripe.txt']);

    for (const relativePath of [
      'tsconfig.json',
      'src/capability.ts',
      'src/types.ts',
      'src/templates.ts',
      'src/validation.ts',
      'src/manifest-data.ts',
      'src/index.ts',
      'tests/capability.test.ts',
      'README.md',
    ]) {
      await access(join(pluginDir, relativePath));
    }

    const capabilitySource = await readFile(join(pluginDir, 'src/capability.ts'), 'utf8');
    expect(capabilitySource).toContain('export class StripeCapability implements Capability');
    expect(capabilitySource).toContain("readonly id = STRIPE_CAPABILITY_ID");
  });

  test('rejects an invalid plugin name', async () => {
    const parent = await createTempParentDir();
    await expect(runInitPlugin(parent, 'Not Valid!')).rejects.toThrow('Invalid project name');
  });

  test('refuses to overwrite an existing non-empty plugin directory', async () => {
    const parent = await createTempParentDir();
    await runInitPlugin(parent, 'stripe');
    await expect(runInitPlugin(parent, 'stripe')).rejects.toThrow('already exists and is not empty');
  });

  test('the scaffolded capability is a real, runnable Capability with no runtime dependency on the SDK', async () => {
    const parent = await createTempParentDir();
    await runInitPlugin(parent, 'hello-world');

    const capabilityPath = join(parent, 'kiln-capability-hello-world', 'src', 'capability.ts');
    const loadedModule = (await import(pathToFileURL(capabilityPath).href)) as {
      default: {
        id: string;
        planAdd: (
          rootPath: string,
          options: Record<string, unknown>
        ) => Promise<{
          transforms: unknown[];
          ownershipRegistrations: unknown[];
        }>;
      };
    };
    const capability = loadedModule.default;

    expect(capability.id).toBe('hello-world');

    const plan = await capability.planAdd('/tmp/does-not-matter', {});
    expect(plan.transforms).toHaveLength(1);
    expect(plan.ownershipRegistrations).toEqual([
      { resourceType: 'file', resourceKey: 'hello-world.txt', ownerCapabilityId: 'hello-world' },
    ]);
  });
});
