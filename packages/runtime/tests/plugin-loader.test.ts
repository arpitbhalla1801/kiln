import { afterAll, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadPlugin } from '../src/plugin-loader.js';

const tempRoots: string[] = [];

async function createTempProject(dependencies: Record<string, string> = {}): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'kiln-plugin-loader-'));
  tempRoots.push(root);
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ name: 'demo-app', version: '1.0.0', dependencies })
  );
  return root;
}

async function installFakePackage(
  root: string,
  packageName: string,
  version: string,
  indexContent: string,
  sdkRange: string | null = '^0.1.0'
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
      ...(sdkRange ? { dependencies: { '@kiln/capability-sdk': sdkRange } } : {}),
    })
  );
  await writeFile(join(packageDir, 'index.mjs'), indexContent);
}

const VALID_CAPABILITY_MODULE = `
export default {
  id: 'fake-plugin',
  async getManifest() {
    return { id: 'fake-plugin', version: '1.0.0', dependencies: [] };
  },
  async getCapability() {
    return { id: 'fake-plugin', version: '1.0.0', dependencies: [] };
  },
  async planAdd() {
    return { transforms: [], capability: { id: 'fake-plugin', version: '1.0.0', dependencies: [] }, ownershipRegistrations: [] };
  },
};
`;

afterAll(async () => {
  for (const root of tempRoots) {
    await rm(root, { recursive: true, force: true });
  }
});

describe('loadPlugin', () => {
  test('loads a well-formed plugin from the project node_modules', async () => {
    const root = await createTempProject({ 'kiln-capability-fake': '1.0.0' });
    await installFakePackage(root, 'kiln-capability-fake', '1.0.0', VALID_CAPABILITY_MODULE);

    const result = await loadPlugin(root, { package: 'kiln-capability-fake', version: '1.0.0' });

    expect(result.skipped).toBe(false);
    expect(result.capability?.id).toBe('fake-plugin');
  });

  test('skips a plugin that is not a direct dependency of the project', async () => {
    const root = await createTempProject();
    await installFakePackage(root, 'kiln-capability-fake', '1.0.0', VALID_CAPABILITY_MODULE);

    const result = await loadPlugin(root, { package: 'kiln-capability-fake', version: '1.0.0' });

    expect(result.skipped).toBe(true);
    expect(result.reason).toContain('must be a direct dependency');
  });

  test('skips a plugin whose installed version does not exactly match the pin', async () => {
    const root = await createTempProject({ 'kiln-capability-fake': '1.0.0' });
    await installFakePackage(root, 'kiln-capability-fake', '2.0.0', VALID_CAPABILITY_MODULE);

    const result = await loadPlugin(root, { package: 'kiln-capability-fake', version: '1.0.0' });

    expect(result.skipped).toBe(true);
    expect(result.reason).toContain('does not match the version');
  });

  test('skips a plugin that is not installed at all', async () => {
    const root = await createTempProject({ 'kiln-capability-fake': '1.0.0' });

    const result = await loadPlugin(root, { package: 'kiln-capability-fake', version: '1.0.0' });

    expect(result.skipped).toBe(true);
    expect(result.reason).toContain('not installed');
  });

  test('skips a plugin whose module does not export a usable Capability', async () => {
    const root = await createTempProject({ 'kiln-capability-fake': '1.0.0' });
    await installFakePackage(
      root,
      'kiln-capability-fake',
      '1.0.0',
      'export default { hello: "world" };'
    );

    const result = await loadPlugin(root, { package: 'kiln-capability-fake', version: '1.0.0' });

    expect(result.skipped).toBe(true);
    expect(result.reason).toContain('does not export a usable Capability');
  });

  test('skips a plugin whose module throws while loading', async () => {
    const root = await createTempProject({ 'kiln-capability-fake': '1.0.0' });
    await installFakePackage(
      root,
      'kiln-capability-fake',
      '1.0.0',
      'throw new Error("boom during module load");'
    );

    const result = await loadPlugin(root, { package: 'kiln-capability-fake', version: '1.0.0' });

    expect(result.skipped).toBe(true);
    expect(result.reason).toContain('threw while loading');
  });

  test('skips a plugin that does not declare a @kiln/capability-sdk dependency', async () => {
    const root = await createTempProject({ 'kiln-capability-fake': '1.0.0' });
    await installFakePackage(
      root,
      'kiln-capability-fake',
      '1.0.0',
      VALID_CAPABILITY_MODULE,
      null
    );

    const result = await loadPlugin(root, { package: 'kiln-capability-fake', version: '1.0.0' });

    expect(result.skipped).toBe(true);
    expect(result.reason).toContain("does not declare a '@kiln/capability-sdk' dependency");
  });

  test('skips a plugin that targets an incompatible @kiln/capability-sdk major version', async () => {
    const root = await createTempProject({ 'kiln-capability-fake': '1.0.0' });
    await installFakePackage(root, 'kiln-capability-fake', '1.0.0', VALID_CAPABILITY_MODULE, '^99.0.0');

    const result = await loadPlugin(root, { package: 'kiln-capability-fake', version: '1.0.0' });

    expect(result.skipped).toBe(true);
    expect(result.reason).toContain('targets @kiln/capability-sdk v99');
  });
});
