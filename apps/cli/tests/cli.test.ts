import { afterAll, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseEnvVariables, runAdd } from '../src/commands/add.js';
import { runCreate } from '../src/commands/create.js';
import { formatTransformPlan } from '../src/output.js';

const tempRoots: string[] = [];

async function createTempDir(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'kiln-cli-'));
  tempRoots.push(root);
  return root;
}

afterAll(async () => {
  for (const root of tempRoots) {
    await rm(root, { recursive: true, force: true });
  }
});

describe('kiln cli', () => {
  test('create scaffolds a project', async () => {
    const parent = await createTempDir();
    const projectDir = join(parent, 'demo-app');

    await runCreate(projectDir, 'demo-app');

    const packageJson = JSON.parse(await readFile(join(projectDir, 'package.json'), 'utf8'));
    expect(packageJson.name).toBe('demo-app');
    expect(await readFile(join(projectDir, 'src/app/page.tsx'), 'utf8')).toContain('Kiln project');
  });

  test('parseEnvVariables reads --var flags from full command argv', () => {
    const vars = parseEnvVariables([
      'add',
      'env',
      '--var',
      'DATABASE_URL=postgres://localhost',
      '--var=NODE_ENV=dev',
    ]);
    expect(vars).toEqual({
      DATABASE_URL: 'postgres://localhost',
      NODE_ENV: 'dev',
    });
  });

  test('parseEnvVariables reads space-separated --var flags', () => {
    const vars = parseEnvVariables(['add', 'env', '--var', 'CUSTOM_KEY=hello']);
    expect(vars).toEqual({ CUSTOM_KEY: 'hello' });
  });

  test('dry-run add env produces deterministic transform output', async () => {
    const root = await createTempDir();
    await runCreate(root, 'demo-app');

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (message: string) => logs.push(message);

    try {
      await runAdd('env', { cwd: root, dryRun: true });
    } finally {
      console.log = originalLog;
    }

    const output = logs.join('\n');
    expect(output).toContain('Capability: env');
    expect(output).toContain('Mode: dry-run');
    expect(output).toContain('.env.example');
  });

  test('add auth preserves existing package.json fields', async () => {
    const root = await createTempDir();
    await runCreate(root, 'demo-app');
    await runAdd('env', { cwd: root, dryRun: false });
    await runAdd('auth', { cwd: root, dryRun: false });

    const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
    expect(packageJson.name).toBe('demo-app');
    expect(packageJson.scripts?.build).toBe('next build');
    expect(packageJson.dependencies?.next).toBe('^15.0.0');
    expect(packageJson.dependencies?.['next-auth']).toBe('^5.0.0-beta.32');

    const envExample = await readFile(join(root, '.env.example'), 'utf8');
    expect(envExample).toContain('DATABASE_URL=');
    expect(envExample).toContain('AUTH_SECRET=');
  });

  test('re-running add env reports no changes when already applied', async () => {
    const root = await createTempDir();
    await runCreate(root, 'demo-app');
    await runAdd('env', { cwd: root, dryRun: false });

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (message: string) => logs.push(message);

    try {
      await runAdd('env', { cwd: root, dryRun: false });
    } finally {
      console.log = originalLog;
    }

    expect(logs.join('\n')).toContain('no changes');
  });

  test('add env --var merges custom variables into existing .env.example', async () => {
    const root = await createTempDir();
    await runCreate(root, 'demo-app');
    await runAdd('env', { cwd: root, dryRun: false });

    await runAdd(
      'env',
      { cwd: root, dryRun: false },
      parseEnvVariables(['add', 'env', '--var', 'API_URL=https://api.example.com'])
    );

    const envExample = await readFile(join(root, '.env.example'), 'utf8');
    expect(envExample).toContain('DATABASE_URL=');
    expect(envExample).toContain('API_URL=https://api.example.com');
  });

  test('formatTransformPlan sorts operations deterministically', () => {
    const formatted = formatTransformPlan(
      {
        operations: [
          { type: 'modify', filePath: 'z.ts' },
          { type: 'create', filePath: 'a.ts' },
        ],
        summary: { created: 1, modified: 1, deleted: 0, total: 2 },
      },
      true
    );

    expect(formatted.indexOf('a.ts')).toBeLessThan(formatted.indexOf('z.ts'));
  });

  test('formatTransformPlan reports no changes for empty plans', () => {
    const formatted = formatTransformPlan(
      {
        operations: [],
        summary: { created: 0, modified: 0, deleted: 0, total: 0 },
      },
      false
    );

    expect(formatted).toContain('no changes');
  });
});
