import { afterAll, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseEnvVariables, parseProviders, runAdd } from '../src/commands/add.js';
import { runCreate } from '../src/commands/create.js';
import { runDoctor } from '../src/commands/doctor.js';
import { runRemove } from '../src/commands/remove.js';
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
}, 30000);

describe('kiln cli', () => {
  test('create scaffolds a project', async () => {
    const parent = await createTempDir();
    const projectDir = join(parent, 'demo-app');

    await runCreate(projectDir, 'demo-app');

    const packageJson = JSON.parse(await readFile(join(projectDir, 'package.json'), 'utf8'));
    expect(packageJson.name).toBe('demo-app');
    expect(packageJson.devDependencies['@types/react-dom']).toBe('^19.0.0');
    expect(await readFile(join(projectDir, 'src/app/page.tsx'), 'utf8')).toContain('Kiln project');
    expect(await readFile(join(projectDir, 'src/app/layout.tsx'), 'utf8')).toContain('RootLayout');
  });

  test('create rejects empty and invalid project names', async () => {
    const parent = await createTempDir();
    await expect(runCreate(join(parent, 'bad'), '')).rejects.toThrow('Project name is required');
    await expect(runCreate(join(parent, 'bad'), 'Weird Name')).rejects.toThrow('Invalid project name');
  });

  test('create refuses to overwrite a non-empty directory', async () => {
    const parent = await createTempDir();
    const projectDir = join(parent, 'existing-app');
    await runCreate(projectDir, 'existing-app');
    await expect(runCreate(projectDir, 'existing-app')).rejects.toThrow('already exists and is not empty');
  });

  test('create scaffolds a buildable Next.js project', async () => {
    const root = await createTempDir();
    await runCreate(root, 'demo-app');

    await expect(readFile(join(root, 'next.config.ts'), 'utf8')).resolves.toContain('NextConfig');
    await expect(readFile(join(root, 'next-env.d.ts'), 'utf8')).resolves.toContain('next');
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

  test('parseEnvVariables rejects newlines in --var values to prevent env injection', () => {
    expect(() =>
      parseEnvVariables(['add', 'env', '--var', 'API_KEY=abc\nDATABASE_URL=http://evil.example'])
    ).toThrow(/cannot contain newlines/);
  });

  test('parseEnvVariables rejects newlines in --var=KEY=value form', () => {
    expect(() =>
      parseEnvVariables(['add', 'env', '--var=API_KEY=abc\nINJECTED=evil'])
    ).toThrow(/cannot contain newlines/);
  });

  test('parseProviders reads repeated --provider flags in both forms', () => {
    const providers = parseProviders([
      'add',
      'auth',
      '--provider',
      'github',
      '--provider=google',
    ]);
    expect(providers).toEqual(['github', 'google']);
  });

  test('add auth rejects an unknown provider', async () => {
    const root = await createTempDir();
    await runCreate(root, 'demo-app');

    await expect(
      runAdd('auth', { cwd: root, dryRun: false }, {}, ['discord'])
    ).rejects.toThrow(/Unknown auth provider 'discord'/);
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
  }, 30000);

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

  test('doctor fails when package.json is corrupted in a Next.js project', async () => {
    const root = await createTempDir();
    await runCreate(root, 'demo-app');

    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({ dependencies: { 'next-auth': '^5.0.0-beta.32' } }, null, 2) + '\n',
      'utf8'
    );

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (message: string) => logs.push(message);

    await expect(runDoctor({ cwd: root })).rejects.toThrow('Doctor found 1 failing check(s)');

    console.log = originalLog;

    const output = logs.join('\n');
    expect(output).toContain('[fail] package-json-health:');
    expect(output).toContain('missing scripts.dev');
    expect(output).toContain('missing dependencies.next');
  });

  test('doctor warns when a required env var has no value', async () => {
    const root = await createTempDir();
    await runCreate(root, 'demo-app');
    await writeFile(join(root, '.env.example'), '# required\nAUTH_SECRET=\nDATABASE_URL=set\n', 'utf8');

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (message: string) => logs.push(message);

    await runDoctor({ cwd: root });

    console.log = originalLog;

    const output = logs.join('\n');
    expect(output).toContain('[warn] env-required-vars:');
    expect(output).toContain('AUTH_SECRET');
  });

  test('doctor passes when required env vars all have values', async () => {
    const root = await createTempDir();
    await runCreate(root, 'demo-app');
    await writeFile(join(root, '.env.example'), '# required\nAUTH_SECRET=abc123\n', 'utf8');

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (message: string) => logs.push(message);

    await runDoctor({ cwd: root });

    console.log = originalLog;

    expect(logs.join('\n')).toContain('[pass] env-required-vars:');
  });

  test('remove auth deletes owned files/deps, leaves env-owned vars alone', async () => {
    const root = await createTempDir();
    await runCreate(root, 'demo-app');
    await runAdd('env', { cwd: root, dryRun: false });
    await runAdd('auth', { cwd: root, dryRun: false });

    await runRemove('auth', { cwd: root, dryRun: false });

    await expect(readFile(join(root, 'src/auth.ts'), 'utf8')).rejects.toThrow();
    await expect(readFile(join(root, 'src/middleware.ts'), 'utf8')).rejects.toThrow();

    const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
    expect(packageJson.dependencies?.['next-auth']).toBeUndefined();

    const envExample = await readFile(join(root, '.env.example'), 'utf8');
    expect(envExample).toContain('AUTH_SECRET=');
    expect(envExample).toContain('DATABASE_URL=');

    const ownership = JSON.parse(await readFile(join(root, '.kiln/ownership.json'), 'utf8'));
    expect(ownership.ownership.dependencies).toEqual([]);
    expect(ownership.ownership.files).toEqual([{ filePath: '.env.example', ownerCapabilityId: 'env' }]);

    const lockfile = JSON.parse(await readFile(join(root, '.kiln/lock.json'), 'utf8'));
    const capabilityIds = lockfile.snapshot.capabilities.map((entry: { id: string }) => entry.id);
    expect(capabilityIds).toEqual(['env']);
  }, 30000);

  test('add writes .kiln/lock.json with capability id, version, and resolved dependencies', async () => {
    const root = await createTempDir();
    await runCreate(root, 'demo-app');
    await runAdd('env', { cwd: root, dryRun: false });

    const lockfile = JSON.parse(await readFile(join(root, '.kiln/lock.json'), 'utf8'));
    expect(lockfile.project.name).toBe('demo-app');
    expect(lockfile.snapshot.capabilities).toEqual([
      { id: 'env', version: '1.0.0', resolved: 'capability:env@1.0.0', dependencies: {} },
    ]);
  });

  test('add --dry-run does not write .kiln/lock.json', async () => {
    const root = await createTempDir();
    await runCreate(root, 'demo-app');
    await runAdd('env', { cwd: root, dryRun: true });

    await expect(readFile(join(root, '.kiln/lock.json'), 'utf8')).rejects.toThrow();
  });

  test('remove reports no-op for a capability that was never added', async () => {
    const root = await createTempDir();
    await runCreate(root, 'demo-app');

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (message: string) => logs.push(message);

    try {
      await runRemove('auth', { cwd: root, dryRun: false });
    } finally {
      console.log = originalLog;
    }

    expect(logs.join('\n')).toContain('not applied to this project');
  });

  test('remove rejects unsupported capabilities', async () => {
    const root = await createTempDir();
    await runCreate(root, 'demo-app');

    await expect(runRemove('payments', { cwd: root, dryRun: false })).rejects.toThrow(
      "Unsupported capability 'payments'"
    );
  });

  test('dry-run shows a content diff for modified files', () => {
    const formatted = formatTransformPlan(
      {
        operations: [
          {
            type: 'modify',
            filePath: '.env.example',
            before: 'DATABASE_URL=postgres://localhost\n',
            content: 'DATABASE_URL=postgres://localhost\nAPI_URL=https://api.example.com\n',
          },
        ],
        summary: { created: 0, modified: 1, deleted: 0, total: 1 },
      },
      true
    );

    expect(formatted).toContain('+ API_URL=https://api.example.com');
    expect(formatted).not.toContain('- DATABASE_URL=postgres://localhost');
  });

  test('apply mode does not print a content diff', () => {
    const formatted = formatTransformPlan(
      {
        operations: [
          {
            type: 'modify',
            filePath: '.env.example',
            before: 'DATABASE_URL=postgres://localhost\n',
            content: 'DATABASE_URL=postgres://localhost\nAPI_URL=https://api.example.com\n',
          },
        ],
        summary: { created: 0, modified: 1, deleted: 0, total: 1 },
      },
      false
    );

    expect(formatted).not.toContain('+ API_URL=https://api.example.com');
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
