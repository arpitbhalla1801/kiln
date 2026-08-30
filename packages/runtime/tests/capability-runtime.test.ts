import { afterAll, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import type { NodeAdapterRuntime } from '@kiln/node-adapter';
import { CapabilityRuntime } from '../src/capability-runtime.js';

const tempRoots: string[] = [];

async function createTempProject(files: Record<string, string> = {}): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'kiln-runtime-'));
  tempRoots.push(root);

  const defaults = {
    'package.json': JSON.stringify({ name: 'demo-app', version: '1.0.0' }),
  };

  for (const [relativePath, content] of Object.entries({ ...defaults, ...files })) {
    const filePath = join(root, relativePath);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
  }

  return root;
}

afterAll(async () => {
  for (const root of tempRoots) {
    await rm(root, { recursive: true, force: true });
  }
});

describe('CapabilityRuntime', () => {
  test('dry-run add env previews transforms without writing ownership', async () => {
    const root = await createTempProject();
    const runtime = new CapabilityRuntime();

    const result = await runtime.addEnv(
      { DATABASE_URL: { example: 'postgres://localhost:5432/app', required: true } },
      { cwd: root, dryRun: true }
    );

    expect(result.capabilityId).toBe('env');
    expect(result.dryRun).toBe(true);
    expect(result.preview.operations.some((op) => op.filePath === '.env.example')).toBe(true);
    expect(result.inspection.packageName).toBe('demo-app');
  });

  test('dry-run add auth composes env and previews auth files', async () => {
    const root = await createTempProject();
    const runtime = new CapabilityRuntime();

    const result = await runtime.addAuth({ cwd: root, dryRun: true });
    const paths = result.preview.operations.map((op) => op.filePath);

    expect(result.capabilityId).toBe('auth');
    expect(paths).toContain('auth.ts');
    expect(paths).toContain('middleware.ts');
    expect(paths).toContain('.env.example');
    expect(result.resolvedDependencies.get('next-auth')).toBe('^5.0.0-beta.32');
  });

  test('runs install phase through adapter when not dry-run', async () => {
    const root = await createTempProject();
    const installCalls: Array<Record<string, string>> = [];

    const adapter: NodeAdapterRuntime = {
      id: 'node-adapter',
      version: '1.0.0',
      provides: ['package-manager'],
      inspect: async (rootPath) => ({
        rootPath,
        packageManager: { kind: 'bun', installed: true },
        nextjs: { detected: false, typescript: false },
        filesystem: { packageJson: true, nodeModules: false },
        hasPackageJson: true,
        hasTypeScript: false,
        packageName: 'demo-app',
        packageVersion: '1.0.0',
      }),
      getFilesystemExpectations: async () => ({
        packageJson: true,
        nodeModules: false,
      }),
      installDependencies: async (_rootPath, dependencies) => {
        installCalls.push(dependencies);
        return { exitCode: 0, stdout: 'installed', stderr: '' };
      },
      removeDependencies: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
      runScript: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
    };

    const runtime = new CapabilityRuntime({ adapter: adapter as import('@kiln/node-adapter').NodeAdapter });
    await runtime.addAuth({ cwd: root, dryRun: false });

    expect(installCalls).toEqual([{ 'next-auth': '^5.0.0-beta.32' }]);
  });
});
