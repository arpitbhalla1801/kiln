import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import './helpers/no-install.js';
import { runAdd } from '../src/commands/add.js';
import { runInit } from '../src/commands/init.js';

const tempRoots: string[] = [];

afterAll(async () => {
  for (const root of tempRoots) {
    await rm(root, { recursive: true, force: true });
  }
}, 120000);

async function projectWith(...capabilities: string[]): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'kiln-auth-db-'));
  tempRoots.push(root);
  await runInit(root, 'demo-app');
  for (const capability of capabilities) {
    await runAdd(capability, { cwd: root, dryRun: false });
  }
  return root;
}

describe('auth + db integration', () => {
  test('db added first: schema gets Auth.js models once auth is added', async () => {
    const root = await projectWith('db');
    const plainSchema = await readFile(join(root, 'prisma/schema.prisma'), 'utf8');
    expect(plainSchema).not.toContain('model Account');

    await runAdd('auth', { cwd: root, dryRun: false });

    const schema = await readFile(join(root, 'prisma/schema.prisma'), 'utf8');
    expect(schema).toContain('model Account');
    expect(schema).toContain('model Session');
    expect(schema).toContain('model VerificationToken');
    expect(schema).toContain('accounts  Account[]');

    const authFile = await readFile(join(root, 'src/auth.ts'), 'utf8');
    expect(authFile).toContain('import { PrismaAdapter } from "@auth/prisma-adapter"');
    expect(authFile).toContain('import { db } from "./lib/db"');
    expect(authFile).toContain('adapter: PrismaAdapter(db)');

    const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
    expect(packageJson.dependencies['@auth/prisma-adapter']).toBeDefined();
  }, 60000);

  test('auth added first: adapter and schema get wired once db is added', async () => {
    const root = await projectWith('auth');
    const plainAuth = await readFile(join(root, 'src/auth.ts'), 'utf8');
    expect(plainAuth).not.toContain('PrismaAdapter');

    await runAdd('db', { cwd: root, dryRun: false });

    const authFile = await readFile(join(root, 'src/auth.ts'), 'utf8');
    expect(authFile).toContain('import { PrismaAdapter } from "@auth/prisma-adapter"');
    expect(authFile).toContain('adapter: PrismaAdapter(db)');

    const schema = await readFile(join(root, 'prisma/schema.prisma'), 'utf8');
    expect(schema).toContain('model Account');
    expect(schema).toContain('model Session');
    expect(schema).toContain('model VerificationToken');
  }, 60000);

  test('auth alone: no adapter wiring', async () => {
    const root = await projectWith('auth');
    const authFile = await readFile(join(root, 'src/auth.ts'), 'utf8');
    expect(authFile).not.toContain('PrismaAdapter');
    expect(authFile).not.toContain('@auth/prisma-adapter');
  }, 60000);

  test('db alone: plain User model, no Auth.js models', async () => {
    const root = await projectWith('db');
    const schema = await readFile(join(root, 'prisma/schema.prisma'), 'utf8');
    expect(schema).not.toContain('model Account');
    expect(schema).toContain('model User');
  }, 60000);

  test('re-running add auth after adapter is wired is a no-op for auth.ts', async () => {
    const root = await projectWith('db', 'auth');
    const before = await readFile(join(root, 'src/auth.ts'), 'utf8');

    await runAdd('auth', { cwd: root, dryRun: false });

    const after = await readFile(join(root, 'src/auth.ts'), 'utf8');
    expect(after).toBe(before);
  }, 60000);
});
