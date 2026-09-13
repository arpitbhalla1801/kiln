import { afterAll, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { TransformApplier, VirtualFilesystem } from '@kiln/transform-engine';
import { EnvCapability } from '../src/capability.js';

const tempRoots: string[] = [];

async function createTempProject(files: Record<string, string> = {}): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'kiln-env-local-'));
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

describe('.env.local scaffolding', () => {
  test('creates and seeds .env.local alongside .env.example', async () => {
    const root = await createTempProject();
    const env = new EnvCapability();
    const plan = await env.planAdd(root, {
      DATABASE_URL: { example: 'postgres://localhost:5432/app', required: true },
    });

    const vfs = new VirtualFilesystem();
    const applier = new TransformApplier();
    applier.applyAll(vfs, plan.transforms);

    expect(vfs.read('.env.local')).toBe('DATABASE_URL=postgres://localhost:5432/app\n');
  });

  test('never overwrites an existing value in .env.local on re-run', async () => {
    const root = await createTempProject();
    const env = new EnvCapability();

    const vfs = new VirtualFilesystem({
      initialFiles: { '.env.local': 'DATABASE_URL=postgres://real-secret-host/prod\n' },
    });
    const applier = new TransformApplier();

    const plan = await env.planAdd(root, {
      DATABASE_URL: { example: 'postgres://localhost:5432/app', required: true },
    }, { envExampleExists: true, envLocalExists: true, gitignoreContent: null });

    applier.applyAll(vfs, plan.transforms);

    expect(vfs.read('.env.local')).toBe('DATABASE_URL=postgres://real-secret-host/prod\n');
  });

  test('adds a missing key to .env.local without touching existing ones', async () => {
    const root = await createTempProject();
    const env = new EnvCapability();

    const vfs = new VirtualFilesystem({
      initialFiles: { '.env.local': 'DATABASE_URL=postgres://real-secret-host/prod\n' },
    });
    const applier = new TransformApplier();

    const plan = await env.planAdd(root, {
      DATABASE_URL: 'postgres://localhost:5432/app',
      NEW_KEY: 'default-value',
    }, { envExampleExists: true, envLocalExists: true, gitignoreContent: null });

    applier.applyAll(vfs, plan.transforms);

    expect(vfs.read('.env.local')).toBe(
      'DATABASE_URL=postgres://real-secret-host/prod\nNEW_KEY=default-value\n'
    );
  });

  test('does not register .env.local in ownership, so kiln remove never deletes it', async () => {
    const root = await createTempProject();
    const env = new EnvCapability();
    const plan = await env.planAdd(root, {
      DATABASE_URL: 'postgres://localhost:5432/app',
    });

    const registeredFiles = plan.ownershipRegistrations
      .filter((registration) => registration.resourceType === 'file')
      .map((registration) => registration.resourceKey);

    expect(registeredFiles).toEqual(['.env.example']);
    expect(plan.capability.files).not.toContain('.env.local');
  });

  test('adds .env.local to an existing .gitignore that is missing it', async () => {
    const root = await createTempProject();
    const env = new EnvCapability();
    const plan = await env.planAdd(
      root,
      { DATABASE_URL: 'postgres://localhost:5432/app' },
      { envExampleExists: true, envLocalExists: true, gitignoreContent: 'node_modules\ndist\n' }
    );

    const vfs = new VirtualFilesystem({
      initialFiles: { '.gitignore': 'node_modules\ndist\n' },
    });
    const applier = new TransformApplier();
    applier.applyAll(vfs, plan.transforms);

    expect(vfs.read('.gitignore')).toBe('node_modules\ndist\n.env.local\n');
  });

  test('does not touch .gitignore when it already covers .env.local', async () => {
    const root = await createTempProject();
    const env = new EnvCapability();
    const plan = await env.planAdd(
      root,
      { DATABASE_URL: 'postgres://localhost:5432/app' },
      { envExampleExists: true, envLocalExists: true, gitignoreContent: 'node_modules\n.env.local\n' }
    );

    const gitignoreTransform = plan.transforms.find((transform) => transform.filePath === '.gitignore');
    expect(gitignoreTransform).toBeUndefined();
  });

  test('does not create a .gitignore when the project has none', async () => {
    const root = await createTempProject();
    const env = new EnvCapability();
    const plan = await env.planAdd(
      root,
      { DATABASE_URL: 'postgres://localhost:5432/app' },
      { envExampleExists: true, envLocalExists: true, gitignoreContent: null }
    );

    const gitignoreTransform = plan.transforms.find((transform) => transform.filePath === '.gitignore');
    expect(gitignoreTransform).toBeUndefined();
  });
});
