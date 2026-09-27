import { afterAll, describe, expect, spyOn, test } from 'bun:test';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runAdd } from '../src/commands/add.js';
import { runInit, runInitExisting } from '../src/commands/init.js';
import { runPlanAdd } from '../src/commands/plan.js';

const tempRoots: string[] = [];

afterAll(async () => {
  for (const root of tempRoots) {
    await rm(root, { recursive: true, force: true });
  }
}, 120000);

async function createTempDir(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'kiln-plan-'));
  tempRoots.push(root);
  return root;
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false
  );
}

async function planOutput(capabilityId: string, root: string): Promise<string> {
  const lines: string[] = [];
  const spy = spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    lines.push(args.join(' '));
  });
  try {
    await runPlanAdd(capabilityId, { cwd: root, dryRun: false });
  } finally {
    spy.mockRestore();
  }
  return lines.join('\n');
}

async function writeCreateNextAppFixture(root: string): Promise<void> {
  await mkdir(join(root, 'src', 'app'), { recursive: true });
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify(
      {
        name: 'existing-app',
        version: '0.1.0',
        dependencies: { next: '^15.0.0', react: '^19.0.0', 'react-dom': '^19.0.0' },
        devDependencies: { typescript: '^5.0.0' },
      },
      null,
      2
    )
  );
  await writeFile(join(root, 'tsconfig.json'), '{}\n');
  await writeFile(
    join(root, 'src', 'app', 'layout.tsx'),
    'export default function RootLayout() { return null; }\n'
  );
  await writeFile(join(root, 'src', 'app', 'page.tsx'), 'export default function Home() { return null; }\n');
  await mkdir(join(root, 'node_modules', 'next'), { recursive: true });
  await writeFile(join(root, 'node_modules', 'next', 'package.json'), '{}\n');
}

describe('kiln plan add', () => {
  test('previews files, dependencies, and ownership updates, and writes nothing', async () => {
    const root = await createTempDir();
    await runInit(root, 'demo-app');

    const output = await planOutput('env', root);

    expect(output).toContain('Capability: env');
    expect(output).toContain('Mode: plan');
    expect(output).toContain('create  .env.example');
    expect(output).toContain('Ownership updates:');
    expect(output).toContain('file .env.example -> env');
    expect(await exists(join(root, '.env.example'))).toBe(false);
  }, 60000);

  test('reports an ownership conflict instead of throwing', async () => {
    const root = await createTempDir();
    await writeCreateNextAppFixture(root);
    await writeFile(join(root, 'src', 'middleware.ts'), 'export function middleware() {}\n');
    await runInitExisting(root);

    const output = await planOutput('auth', root);

    expect(output).toContain('Conflicts detected:');
    expect(output).toContain('src/middleware.ts');
    expect(output).toContain('external');
    expect(output).not.toContain('Ownership updates:');
    expect(await exists(join(root, 'src', 'auth.ts'))).toBe(false);
  }, 60000);

  test('does not persist ownership or write files even when there is no conflict', async () => {
    const root = await createTempDir();
    await runInit(root, 'demo-app');
    await runAdd('env', { cwd: root, dryRun: false });

    await planOutput('auth', root);

    expect(await exists(join(root, 'src', 'auth.ts'))).toBe(false);
  }, 60000);
});
