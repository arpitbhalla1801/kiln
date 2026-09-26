import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runAdd } from '../src/commands/add.js';
import { runInit } from '../src/commands/init.js';

const tempRoots: string[] = [];
const OWNED_FILES = ['package.json', '.env.example', '.env.local', 'src/auth.ts', 'src/middleware.ts'];

async function createProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'kiln-robust-'));
  tempRoots.push(root);
  await runInit(root, 'demo-app');
  return root;
}

afterAll(async () => {
  for (const root of tempRoots) {
    await rm(root, { recursive: true, force: true });
  }
}, 120000);

async function capture(run: () => Promise<unknown>): Promise<string> {
  const logs: string[] = [];
  const original = console.log;
  console.log = (message?: unknown) => logs.push(String(message));
  try {
    await run();
  } finally {
    console.log = original;
  }
  return logs.join('\n');
}

async function captureWarnings(run: () => Promise<unknown>): Promise<string> {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (message?: unknown) => warnings.push(String(message));
  try {
    await capture(run);
  } finally {
    console.warn = original;
  }
  return warnings.join('\n');
}

/** The "create|modify|delete <path>" lines of a plan, ignoring diff bodies and mode headers. */
function operations(output: string): string[] {
  return output
    .split('\n')
    .filter((line) => /^\s+(create|modify|delete)\s+\S/.test(line))
    .map((line) => line.trim());
}

function read(root: string, file: string): Promise<string> {
  return readFile(join(root, file), 'utf8');
}

describe('add robustness', () => {
  test('re-running add auth reports no changes and leaves files byte-identical', async () => {
    const root = await createProject();
    await runAdd('env', { cwd: root, dryRun: false });
    await runAdd('auth', { cwd: root, dryRun: false });
    const before = await Promise.all(OWNED_FILES.map((f) => read(root, f)));

    const output = await capture(() => runAdd('auth', { cwd: root, dryRun: false }));

    expect(output).toContain('no changes');
    expect(await Promise.all(OWNED_FILES.map((f) => read(root, f)))).toEqual(before);
  }, 60000);

  test('re-running add auth --dry-run reports no changes', async () => {
    const root = await createProject();
    await runAdd('auth', { cwd: root, dryRun: false });

    const output = await capture(() => runAdd('auth', { cwd: root, dryRun: true }));

    expect(output).toContain('no changes');
  }, 60000);

  test('add auth --dry-run lists the same operations a real run performs', async () => {
    const root = await createProject();
    await runAdd('env', { cwd: root, dryRun: false });

    const dry = await capture(() => runAdd('auth', { cwd: root, dryRun: true }));
    const real = await capture(() => runAdd('auth', { cwd: root, dryRun: false }));

    expect(operations(dry).length).toBeGreaterThan(0);
    expect(operations(real)).toEqual(operations(dry));
  }, 60000);

  test('add --dry-run writes nothing to disk', async () => {
    const root = await createProject();
    const before = await read(root, 'package.json');

    await capture(() => runAdd('auth', { cwd: root, dryRun: true }));

    expect(await read(root, 'package.json')).toBe(before);
    await expect(read(root, 'src/auth.ts')).rejects.toThrow();
    await expect(read(root, '.kiln/lock.json')).rejects.toThrow();
  }, 30000);

  test('re-running add auth keeps a hand-edited kiln-owned file', async () => {
    const root = await createProject();
    await runAdd('auth', { cwd: root, dryRun: false });
    const edited = `${await read(root, 'src/auth.ts')}\n// my edit\n`;
    await writeFile(join(root, 'src/auth.ts'), edited);

    const warnings = await captureWarnings(() => runAdd('auth', { cwd: root, dryRun: false }));

    expect(await read(root, 'src/auth.ts')).toBe(edited);
    expect(warnings).toContain('Skipped src/auth.ts');
  }, 60000);

  test('re-running add auth does not warn when nothing was edited', async () => {
    const root = await createProject();
    await runAdd('auth', { cwd: root, dryRun: false });

    const warnings = await captureWarnings(() => runAdd('auth', { cwd: root, dryRun: false }));

    expect(warnings).toBe('');
  }, 60000);

  test('re-running add auth keeps user-added env values and never rotates AUTH_SECRET', async () => {
    const root = await createProject();
    await runAdd('auth', { cwd: root, dryRun: false });
    const secret = /^AUTH_SECRET=.*$/m.exec(await read(root, '.env.local'))?.[0];
    expect(secret).toBeDefined();
    await writeFile(join(root, '.env.local'), `${await read(root, '.env.local')}MY_VAR=1\n`);

    await capture(() => runAdd('auth', { cwd: root, dryRun: false }));

    const env = await read(root, '.env.local');
    expect(env).toContain('MY_VAR=1');
    expect(env).toContain(secret as string);
  }, 60000);

  test('re-running add auth restores a kiln-owned file the user deleted', async () => {
    const root = await createProject();
    await runAdd('auth', { cwd: root, dryRun: false });
    const original = await read(root, 'src/middleware.ts');
    await rm(join(root, 'src/middleware.ts'));

    await capture(() => runAdd('auth', { cwd: root, dryRun: false }));

    expect(await read(root, 'src/middleware.ts')).toBe(original);
  }, 60000);
});
