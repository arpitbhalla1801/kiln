import { afterAll, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectChecks } from '../src/health.js';

const tempRoots: string[] = [];

afterAll(async () => {
  for (const root of tempRoots) {
    await rm(root, { recursive: true, force: true });
  }
});

async function project(clientAgeSeconds: number | null): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'kiln-prisma-drift-'));
  tempRoots.push(root);
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'x' }));
  await mkdir(join(root, 'prisma'));
  await writeFile(join(root, 'prisma/schema.prisma'), 'model User { id String @id }\n');
  await mkdir(join(root, 'node_modules/.prisma/client'), { recursive: true });
  if (clientAgeSeconds !== null) {
    const client = join(root, 'node_modules/.prisma/client/index.d.ts');
    await writeFile(client, '');
    const when = new Date(Date.now() - clientAgeSeconds * 1000);
    await utimes(client, when, when);
  }
  return root;
}

async function prismaCheck(root: string) {
  return (await collectChecks({ cwd: root, dryRun: false })).find((check) => check.name === 'prisma-client');
}

describe('doctor prisma-client drift', () => {
  test('warns when schema is newer than the generated client', async () => {
    const check = await prismaCheck(await project(3600));
    expect(check?.status).toBe('warn');
    expect(check?.detail).toContain('db:generate');
  });

  test('passes when the client is newer than the schema', async () => {
    const root = await project(null);
    const client = join(root, 'node_modules/.prisma/client/index.d.ts');
    await writeFile(client, '');
    const future = new Date(Date.now() + 60_000);
    await utimes(client, future, future);
    expect((await prismaCheck(root))?.status).toBe('pass');
  });

  test('warns when the client was never generated', async () => {
    expect((await prismaCheck(await project(null)))?.detail).toContain('not generated');
  });
});
