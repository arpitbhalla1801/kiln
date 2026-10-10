import { afterAll, describe, expect, spyOn, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PLUGIN_CONFIG_FILE } from '@kiln-cli/project-model';
import { runAdd } from '../src/commands/add.js';
import { runInit } from '../src/commands/init.js';
import { runInspect } from '../src/commands/inspect.js';

const tempRoots: string[] = [];

afterAll(async () => {
  for (const root of tempRoots) {
    await rm(root, { recursive: true, force: true });
  }
}, 120000);

async function inspectOutput(root: string, verbose = false): Promise<string> {
  const lines: string[] = [];
  const spy = spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    lines.push(args.join(' '));
  });
  try {
    await runInspect({ cwd: root, dryRun: false, verbose });
  } finally {
    spy.mockRestore();
  }
  return lines.join('\n');
}

describe('kiln inspect', () => {
  test('summarises capabilities, managed files, dependencies and last operation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'kiln-inspect-'));
    tempRoots.push(root);
    await runInit(root, 'demo-app');
    await runAdd('env', { cwd: root, dryRun: false });
    await runAdd('auth', { cwd: root, dryRun: false });

    const output = await inspectOutput(root);

    expect(output).toContain('Project: Next.js +');
    expect(output).toContain('✓ env');
    expect(output).toContain('✓ auth');
    expect(output).toContain('✗ db');
    expect(output).toMatch(/Managed files: [1-9]\d*/);
    expect(output).toContain('Dependencies added: next-auth');
    expect(output).toContain('Last operation: auth@');
    expect(output).toContain('Status:');
    expect(output).not.toContain('Ownership:');
  }, 60000);

  test('--verbose also lists every owned item', async () => {
    const root = await mkdtemp(join(tmpdir(), 'kiln-inspect-'));
    tempRoots.push(root);
    await runInit(root, 'demo-app');
    await runAdd('env', { cwd: root, dryRun: false });

    const output = await inspectOutput(root, true);

    expect(output).toContain('Ownership:');
    expect(output).toContain('file .env.example -> env');
  }, 60000);

  test('fresh project shows no capabilities and no last operation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'kiln-inspect-'));
    tempRoots.push(root);
    await runInit(root, 'demo-app');

    const output = await inspectOutput(root);

    expect(output).toContain('✗ env');
    expect(output).toContain('Last operation: none');
  }, 60000);

  test('lists a trusted plugin capability that has not been added yet', async () => {
    const root = await mkdtemp(join(tmpdir(), 'kiln-inspect-'));
    tempRoots.push(root);
    await runInit(root, 'demo-app');
    const packageDir = join(root, 'node_modules', 'kiln-capability-gizmo');
    await mkdir(packageDir, { recursive: true });
    await writeFile(
      join(packageDir, 'package.json'),
      JSON.stringify({
        name: 'kiln-capability-gizmo',
        version: '1.0.0',
        type: 'module',
        main: 'index.mjs',
        dependencies: { '@kiln-cli/capability-sdk': '^0.1.0' },
      })
    );
    await writeFile(
      join(packageDir, 'index.mjs'),
      `export default {
        id: 'gizmo',
        async getManifest() { return { id: 'gizmo', version: '1.0.0', description: 'test plugin', frameworks: ['nextjs'], providers: [], config: [], operations: ['add', 'remove'], verify: [], dependencies: [] }; },
        async getCapability() { return { id: 'gizmo', version: '1.0.0', dependencies: [] }; },
        async planAdd() { return { transforms: [], capability: { id: 'gizmo', version: '1.0.0', dependencies: [] }, ownershipRegistrations: [] }; },
      };`
    );
    const pkgPath = join(root, 'package.json');
    const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
    pkg.dependencies = { ...pkg.dependencies, 'kiln-capability-gizmo': '1.0.0' };
    await writeFile(pkgPath, JSON.stringify(pkg));
    await writeFile(
      join(root, PLUGIN_CONFIG_FILE),
      JSON.stringify({ plugins: [{ package: 'kiln-capability-gizmo', version: '1.0.0' }] })
    );

    expect(await inspectOutput(root)).toContain('✗ gizmo');
  }, 60000);
});
