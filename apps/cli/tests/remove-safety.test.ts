import { afterAll, describe, expect, test } from 'bun:test';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runAdd } from '../src/commands/add.js';
import { runInit } from '../src/commands/init.js';
import { runRemove } from '../src/commands/remove.js';

const tempRoots: string[] = [];

afterAll(async () => {
  for (const root of tempRoots) {
    await rm(root, { recursive: true, force: true });
  }
}, 30000);

async function projectWith(...capabilities: string[]): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'kiln-remove-'));
  tempRoots.push(root);
  await runInit(root, 'demo-app');
  for (const capability of capabilities) {
    await runAdd(capability, { cwd: root, dryRun: false });
  }
  return root;
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false
  );
}

describe('kiln remove safety', () => {
  test('remove auth refuses while code imports it, and --force removes anyway', async () => {
    const root = await projectWith('env', 'auth');
    const authFile = 'src/auth.ts';
    await writeFile(join(root, 'src/app/uses-auth.ts'), "import { auth } from '@/auth';\nexport { auth };\n");

    await expect(runRemove('auth', { cwd: root, dryRun: false })).rejects.toThrow('would break');
    expect(await exists(join(root, authFile))).toBe(true);

    await runRemove('auth', { cwd: root, dryRun: false, force: true });
    expect(await exists(join(root, authFile))).toBe(false);
  }, 60000);

  test('remove auth also cleans the env values auth owns and keeps a user-edited file', async () => {
    const root = await projectWith('env', 'auth');
    const middleware = 'src/middleware.ts';
    await writeFile(join(root, middleware), '// my own middleware rules\nexport {};\n');

    await runRemove('auth', { cwd: root, dryRun: false });

    expect(await readFile(join(root, middleware), 'utf8')).toContain('my own middleware rules');
    const envExample = await readFile(join(root, '.env.example'), 'utf8');
    expect(envExample).not.toContain('AUTH_SECRET');
    expect(envExample).toContain('DATABASE_URL');
    expect(JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).dependencies?.['next-auth']).toBeUndefined();
  }, 60000);

  test('remove db leaves migrations alone and says so', async () => {
    const root = await projectWith('env', 'db');
    await writeFile(join(root, 'prisma', 'migrations.keep'), 'x');
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (message: string) => logs.push(message);

    try {
      await runRemove('db', { cwd: root, dryRun: false });
    } finally {
      console.log = originalLog;
    }

    expect(logs.join('\n')).toContain('prisma/migrations');
    expect(await exists(join(root, 'prisma', 'migrations.keep'))).toBe(true);
  }, 60000);
});
