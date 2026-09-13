import { afterAll, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { OwnershipTracker } from '@kiln/core';
import { TransformApplier, VirtualFilesystem } from '@kiln/transform-engine';
import { DbCapability } from '../src/capability.js';

const tempRoots: string[] = [];

async function createTempProject(files: Record<string, string> = {}): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'kiln-db-capability-'));
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

describe('DbCapability', () => {
  test('loads manifest depending on env, owning prisma dependencies', async () => {
    const db = new DbCapability();
    const manifest = await db.getManifest();

    expect(manifest.id).toBe('db');
    expect(manifest.dependencies).toContain('env');
    expect(manifest.ownership?.dependencies).toEqual(['@prisma/client', 'prisma']);
  });

  test('installs @prisma/client as a dependency and prisma as a devDependency', async () => {
    const root = await createTempProject({
      'package.json': JSON.stringify({ name: 'demo-app', version: '1.0.0' }),
    });
    const db = new DbCapability();
    const plan = await db.planAdd(root);

    const vfs = new VirtualFilesystem({
      initialFiles: { 'package.json': JSON.stringify({ name: 'demo-app', version: '1.0.0' }) },
    });
    const applier = new TransformApplier();
    applier.applyAll(vfs, plan.transforms);

    const packageJson = JSON.parse(vfs.read('package.json') ?? '{}');
    expect(packageJson.dependencies).toEqual({ '@prisma/client': '^5.0.0' });
    expect(packageJson.devDependencies).toEqual({ prisma: '^5.0.0' });
  });

  test('composes with env to scaffold DATABASE_URL', async () => {
    const root = await createTempProject({
      'package.json': JSON.stringify({ name: 'demo-app', version: '1.0.0' }),
    });
    const db = new DbCapability();
    const plan = await db.planAdd(root);

    const vfs = new VirtualFilesystem({
      initialFiles: { 'package.json': JSON.stringify({ name: 'demo-app', version: '1.0.0' }) },
    });
    const applier = new TransformApplier();
    applier.applyAll(vfs, plan.transforms);

    expect(vfs.read('.env.example')).toContain('DATABASE_URL=');
    expect(vfs.read('.env.example')).toContain('# --- db ---');
    expect(plan.capability.ownedEnvVars).toBeUndefined();
  });

  test('re-running with prisma already installed is a no-op for package.json', async () => {
    const root = await createTempProject({
      'package.json': JSON.stringify({
        name: 'demo-app',
        version: '1.0.0',
        dependencies: { '@prisma/client': '^5.0.0' },
        devDependencies: { prisma: '^5.0.0' },
      }),
    });
    const db = new DbCapability();
    const tracker = new OwnershipTracker();
    db.registerOwnership(tracker);

    const plan = await db.planAdd(root, {
      tracker,
      prismaInstalled: true,
      envExampleExists: true,
      envLocalExists: true,
      gitignoreContent: null,
    });

    const packageJsonTransform = plan.transforms.find(
      (transform) => transform.type === 'package-json-mutation'
    );
    expect(packageJsonTransform).toBeUndefined();
  });

  test('rejects ownership conflicts', () => {
    const tracker = new OwnershipTracker();
    tracker.registerDependency('prisma', 'other-capability');

    const db = new DbCapability();

    expect(db.planAdd('/tmp/does-not-matter', { tracker })).rejects.toThrow(
      /Ownership conflict detected/
    );
  });
});
