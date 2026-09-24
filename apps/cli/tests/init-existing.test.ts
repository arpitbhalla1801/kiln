import { afterAll, describe, expect, test } from 'bun:test';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runAdd } from '../src/commands/add.js';
import { runInitExisting } from '../src/commands/init.js';

const tempRoots: string[] = [];

async function createTempDir(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'kiln-init-existing-'));
  tempRoots.push(root);
  return root;
}

afterAll(async () => {
  for (const root of tempRoots) {
    await rm(root, { recursive: true, force: true });
  }
}, 30000);

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

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe('kiln init --existing', () => {
  test('seeds ownership.json marking existing files as external without touching source', async () => {
    const root = await createTempDir();
    await writeCreateNextAppFixture(root);
    const layoutBefore = await readFile(join(root, 'src', 'app', 'layout.tsx'), 'utf8');

    await runInitExisting(root);

    const document = JSON.parse(await readFile(join(root, '.kiln', 'ownership.json'), 'utf8'));
    const files = document.ownership.files as Array<{ filePath: string; ownerCapabilityId: string }>;
    const filePaths = files.map((entry) => entry.filePath);

    expect(filePaths).toContain('src/app/layout.tsx');
    expect(filePaths).toContain('src/app/page.tsx');
    expect(filePaths).toContain('package.json');
    expect(filePaths.some((path) => path.startsWith('node_modules/'))).toBe(false);

    for (const entry of files) {
      expect(entry.ownerCapabilityId).toBe('external');
    }

    expect(await readFile(join(root, 'src', 'app', 'layout.tsx'), 'utf8')).toBe(layoutBefore);
  });

  test('rejects a directory with no Next.js dependency', async () => {
    const root = await createTempDir();
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'plain-app' }));

    await expect(runInitExisting(root)).rejects.toThrow('No Next.js project found');
  });

  test('dry-run reports without writing ownership.json', async () => {
    const root = await createTempDir();
    await writeCreateNextAppFixture(root);

    await runInitExisting(root, true);

    expect(await fileExists(join(root, '.kiln', 'ownership.json'))).toBe(false);
  });

  test('does not seed .env.example, so add env can merge into it', async () => {
    const root = await createTempDir();
    await writeCreateNextAppFixture(root);
    await writeFile(join(root, '.env.example'), 'MY_VAR=1\n');

    await runInitExisting(root);

    const document = JSON.parse(await readFile(join(root, '.kiln', 'ownership.json'), 'utf8'));
    const filePaths = document.ownership.files.map((entry: { filePath: string }) => entry.filePath);
    expect(filePaths).not.toContain('.env.example');

    await runAdd('env', { dryRun: true, cwd: root });
  });

  test('add env keeps values already in an existing .env.example and .env.local', async () => {
    const root = await createTempDir();
    await writeCreateNextAppFixture(root);
    await writeFile(join(root, '.env.example'), 'DATABASE_URL=mysql://team-default/app\nOTHER=1\n');
    await writeFile(join(root, '.env.local'), 'DATABASE_URL=postgres://real/db\n');
    await runInitExisting(root);

    await runAdd('env', { dryRun: false, cwd: root });

    expect(await readFile(join(root, '.env.example'), 'utf8')).toBe(
      'DATABASE_URL=mysql://team-default/app\nOTHER=1\n'
    );
    expect(await readFile(join(root, '.env.local'), 'utf8')).toBe('DATABASE_URL=postgres://real/db\n');
  });

  test('add auth refuses to overwrite an existing middleware.ts and says why', async () => {
    const root = await createTempDir();
    await writeCreateNextAppFixture(root);
    await writeFile(join(root, 'src', 'middleware.ts'), 'export function middleware() {}\n');
    await runInitExisting(root);

    await expect(runAdd('auth', { dryRun: true, cwd: root })).rejects.toThrow('existed before kiln');
    expect(await readFile(join(root, 'src', 'middleware.ts'), 'utf8')).toBe(
      'export function middleware() {}\n'
    );
  });
});
