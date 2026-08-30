import { afterAll, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { NodeAdapter } from '../src/adapter.js';
import { detectNextJs } from '../src/detection/nextjs.js';
import { detectLockfile, detectPackageManager } from '../src/detection/package-manager.js';

const tempRoots: string[] = [];

async function createTempProject(
  files: Record<string, string | Record<string, unknown>>
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'kiln-node-adapter-'));
  tempRoots.push(root);

  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = join(root, relativePath);
    const parent = dirname(filePath);
    if (parent !== root) {
      await mkdir(parent, { recursive: true });
    }

    if (typeof content === 'string') {
      await writeFile(filePath, content);
    } else {
      await writeFile(filePath, JSON.stringify(content, null, 2));
    }
  }

  return root;
}

afterAll(async () => {
  for (const root of tempRoots) {
    await rm(root, { recursive: true, force: true });
  }
});

describe('NodeAdapter inspection', () => {
  test('detects bun lockfile and package metadata', async () => {
    const root = await createTempProject({
      'package.json': {
        name: 'demo-app',
        version: '0.1.0',
        packageManager: 'bun@1.3.14',
      },
      'bun.lock': '',
    });

    const packageManager = await detectPackageManager(root);
    const lockfile = await detectLockfile(root);
    const adapter = new NodeAdapter();
    const inspection = await adapter.inspect(root);

    expect(packageManager.kind).toBe('bun');
    expect(packageManager.lockfile).toBe('bun.lock');
    expect(lockfile).toBe('bun.lock');
    expect(inspection.packageName).toBe('demo-app');
    expect(inspection.filesystem.packageJson).toBe(true);
  });

  test('detects Next.js app router and TypeScript usage', async () => {
    const root = await createTempProject({
      'package.json': {
        dependencies: { next: '^15.0.0' },
        devDependencies: { typescript: '^5.0.0' },
      },
      'tsconfig.json': '{ "compilerOptions": { "strict": true } }',
      'src/app/page.tsx': 'export default function Page() { return null; }',
    });

    const nextjs = await detectNextJs(root);

    expect(nextjs.detected).toBe(true);
    expect(nextjs.router).toBe('app');
    expect(nextjs.typescript).toBe(true);
    expect(nextjs.version).toBe('15.0.0');
  });

  test('detects Next.js pages router', async () => {
    const root = await createTempProject({
      'package.json': {
        dependencies: { next: '14.2.0' },
      },
      'pages/index.tsx': 'export default function Home() { return null; }',
    });

    const nextjs = await detectNextJs(root);

    expect(nextjs.detected).toBe(true);
    expect(nextjs.router).toBe('pages');
  });

  test('implements adapter contract', () => {
    const adapter = new NodeAdapter();

    expect(adapter.id).toBe('node-adapter');
    expect(adapter.provides).toContain('package-manager');
    expect(adapter.provides).toContain('project-inspection');
  });
});
