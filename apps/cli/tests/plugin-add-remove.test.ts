import { afterAll, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PLUGIN_CONFIG_FILE } from '@kiln-cli/project-model';
import { runAdd } from '../src/commands/add.js';
import { runPlanAdd } from '../src/commands/plan.js';
import { runRemove } from '../src/commands/remove.js';

const tempRoots: string[] = [];

afterAll(async () => {
  for (const root of tempRoots) {
    await rm(root, { recursive: true, force: true });
  }
}, 30000);

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false
  );
}

const PACKAGE_NAME = 'kiln-capability-widget';
const CAPABILITY_ID = 'widget';
const VERSION = '1.0.0';

// A real third-party capability module, loaded the same way the dynamic
// plugin loader would load it from node_modules -- no test-only shortcuts.
const CAPABILITY_MODULE = `
export default {
  id: '${CAPABILITY_ID}',
  async getManifest() {
    return { id: '${CAPABILITY_ID}', version: '${VERSION}', description: 'test plugin', frameworks: ['nextjs'], providers: [], config: [], operations: ['add', 'remove'], verify: [], dependencies: [] };
  },
  async getCapability() {
    return { id: '${CAPABILITY_ID}', version: '${VERSION}', dependencies: [], files: ['widget.txt'] };
  },
  async planAdd() {
    return {
      transforms: [
        { id: '${CAPABILITY_ID}-create', type: 'file-create', filePath: 'widget.txt', content: 'hello from a third-party capability\\n' },
      ],
      capability: { id: '${CAPABILITY_ID}', version: '${VERSION}', dependencies: [], files: ['widget.txt'] },
      ownershipRegistrations: [
        { resourceType: 'file', resourceKey: 'widget.txt', ownerCapabilityId: '${CAPABILITY_ID}' },
      ],
    };
  },
};
`;

async function createProjectWithPlugin(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'kiln-plugin-add-'));
  tempRoots.push(root);

  const packageDir = join(root, 'node_modules', PACKAGE_NAME);
  await mkdir(packageDir, { recursive: true });
  await writeFile(
    join(packageDir, 'package.json'),
    JSON.stringify({
      name: PACKAGE_NAME,
      version: VERSION,
      type: 'module',
      main: 'index.mjs',
      dependencies: { '@kiln-cli/capability-sdk': '^0.1.0' },
    })
  );
  await writeFile(join(packageDir, 'index.mjs'), CAPABILITY_MODULE);

  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ name: 'demo-app', version: '1.0.0', dependencies: { [PACKAGE_NAME]: VERSION } })
  );
  await writeFile(
    join(root, PLUGIN_CONFIG_FILE),
    JSON.stringify({ plugins: [{ package: PACKAGE_NAME, version: VERSION }] })
  );

  return root;
}

describe('third-party capability via kiln.plugins.json', () => {
  test('kiln plan add reports the plugin instead of "Unsupported capability"', async () => {
    const root = await createProjectWithPlugin();
    const lines: string[] = [];
    const spy = console.log;
    console.log = (...args: unknown[]) => lines.push(args.join(' '));
    try {
      await runPlanAdd(CAPABILITY_ID, { cwd: root, dryRun: false });
    } finally {
      console.log = spy;
    }

    expect(lines.join('\n')).toContain(`Capability: ${CAPABILITY_ID}`);
    expect(await exists(join(root, 'widget.txt'))).toBe(false);
  });

  test('kiln add installs the plugin and kiln remove takes it back out', async () => {
    const root = await createProjectWithPlugin();

    await runAdd(CAPABILITY_ID, { cwd: root, dryRun: false });
    expect(await readFile(join(root, 'widget.txt'), 'utf8')).toContain(
      'hello from a third-party capability'
    );

    const ownership = JSON.parse(await readFile(join(root, '.kiln/ownership.json'), 'utf8'));
    expect(
      ownership.ownership.files.some(
        (entry: { filePath: string; ownerCapabilityId: string }) =>
          entry.filePath === 'widget.txt' && entry.ownerCapabilityId === CAPABILITY_ID
      )
    ).toBe(true);

    await runRemove(CAPABILITY_ID, { cwd: root, dryRun: false });
    expect(await exists(join(root, 'widget.txt'))).toBe(false);
  });

  // Bun allows directory imports, node's ESM loader doesn't -- and the published CLI runs on node.
  test('the built CLI loads the plugin under node', async () => {
    const root = await createProjectWithPlugin();
    const cli = join(import.meta.dir, '../dist/index.js');

    const result = spawnSync('node', [cli, 'plan', 'add', CAPABILITY_ID], { cwd: root, encoding: 'utf8' });

    expect(result.stderr).not.toContain('skipping plugin');
    expect(result.stdout).toContain(`Capability: ${CAPABILITY_ID}`);
  });
});
