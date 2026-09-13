import { afterAll, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { OwnershipTracker } from '@kiln/core';
import { TransformApplier, VirtualFilesystem } from '@kiln/transform-engine';
import { EnvCapability } from '../src/capability.js';
import { validateEnvVariableNames } from '../src/validation.js';

const tempRoots: string[] = [];

async function createTempProject(files: Record<string, string> = {}): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'kiln-env-capability-'));
  tempRoots.push(root);

  for (const [relativePath, content] of Object.entries(files)) {
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

describe('EnvCapability', () => {
  test('loads manifest and exposes capability metadata', async () => {
    const env = new EnvCapability();
    const manifest = await env.getManifest();
    const capability = await env.getCapability();

    expect(manifest.id).toBe('env');
    expect(manifest.ownership?.files).toContain('.env.example');
    expect(capability.id).toBe('env');
  });

  test('creates .env.example and injects env vars', async () => {
    const root = await createTempProject();
    const env = new EnvCapability();
    const plan = await env.planAdd(root, {
      DATABASE_URL: { example: 'postgres://localhost:5432/app', required: true },
      NODE_ENV: 'development',
    });

    const vfs = new VirtualFilesystem();
    const applier = new TransformApplier();
    applier.applyAll(vfs, plan.transforms);

    expect(vfs.read('.env.example')).toBe(
      '# Environment variables\n# --- env ---\n# required\nDATABASE_URL=postgres://localhost:5432/app\nNODE_ENV=development\n'
    );
    expect(plan.capability.ownedEnvVars).toEqual(['DATABASE_URL', 'NODE_ENV']);
    expect(plan.capability.files).toContain('.env.example');
  });

  test('repeated adds are idempotent', async () => {
    const root = await createTempProject();
    const env = new EnvCapability();
    const tracker = new OwnershipTracker();

    const firstPlan = await env.planAdd(root, {
      DATABASE_URL: { example: 'postgres://localhost:5432/app', required: true },
    });
    env.registerOwnership(tracker, { DATABASE_URL: { example: 'postgres://localhost:5432/app' } });

    const vfs = new VirtualFilesystem();
    const applier = new TransformApplier();
    applier.applyAll(vfs, firstPlan.transforms);

    const secondPlan = await env.planAdd(root, {
      DATABASE_URL: { example: 'postgres://localhost:5432/app', required: true },
    }, { tracker, envExampleExists: true });

    applier.applyAll(vfs, secondPlan.transforms);

    expect(vfs.read('.env.example')).toBe(
      '# Environment variables\n# --- env ---\n# required\nDATABASE_URL=postgres://localhost:5432/app\n'
    );
    expect(secondPlan.transforms).toHaveLength(1);
  });

  test('merges into existing .env.example without recreating file', async () => {
    const root = await createTempProject({
      '.env.example': 'EXISTING=value\n',
    });
    const env = new EnvCapability();
    const plan = await env.planAdd(root, {
      DATABASE_URL: 'postgres://localhost:5432/app',
    });

    expect(plan.transforms).toHaveLength(1);
    expect(plan.transforms[0].type).toBe('env-mutation');

    const vfs = new VirtualFilesystem({ initialFiles: { '.env.example': 'EXISTING=value\n' } });
    const applier = new TransformApplier();
    applier.applyAll(vfs, plan.transforms);

    expect(vfs.read('.env.example')).toBe(
      'EXISTING=value\n# --- env ---\nDATABASE_URL=postgres://localhost:5432/app\n'
    );
  });

  test('registers ownership and rejects conflicts', async () => {
    const tracker = new OwnershipTracker();
    tracker.registerEnvVar('DATABASE_URL', 'auth');

    const env = new EnvCapability();
    const root = await createTempProject();

    expect(() =>
      env.planAdd(root, {
        DATABASE_URL: 'postgres://localhost:5432/app',
      }, { tracker })
    ).toThrow(/Ownership conflict detected/);
  });

  test('detects a file-ownership conflict against a custom envExamplePath, not the default', async () => {
    const tracker = new OwnershipTracker();
    tracker.registerFile('.env.staging', 'other-capability');

    const env = new EnvCapability();
    const root = await createTempProject();

    await expect(
      env.planAdd(
        root,
        { DATABASE_URL: 'postgres://localhost:5432/app' },
        { tracker, envExamplePath: '.env.staging' }
      )
    ).rejects.toThrow(/Ownership conflict detected/);
  });

  test('does not falsely conflict against the default .env.example when using a custom path', async () => {
    const tracker = new OwnershipTracker();
    tracker.registerFile('.env.example', 'other-capability');

    const env = new EnvCapability();
    const root = await createTempProject();

    const plan = await env.planAdd(
      root,
      { DATABASE_URL: 'postgres://localhost:5432/app' },
      { tracker, envExamplePath: '.env.staging' }
    );

    expect(plan.transforms.some((transform) => transform.filePath === '.env.staging')).toBe(true);
  });

  test('validates env variable names', () => {
    expect(() =>
      validateEnvVariableNames([{ name: 'invalid-name' }])
    ).toThrow(/Invalid environment variable name/);
  });
});
