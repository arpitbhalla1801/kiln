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
    const plan = await db.planAdd(root, {});

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
    const plan = await db.planAdd(root, {});

    const vfs = new VirtualFilesystem({
      initialFiles: { 'package.json': JSON.stringify({ name: 'demo-app', version: '1.0.0' }) },
    });
    const applier = new TransformApplier();
    applier.applyAll(vfs, plan.transforms);

    expect(vfs.read('.env.example')).toContain('DATABASE_URL=');
    expect(vfs.read('.env.example')).toContain('# --- db ---');
    expect(plan.capability.ownedEnvVars).toBeUndefined();
  });

  test('re-running with prisma already installed skips the dependency install but still ensures scripts', async () => {
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
    db.registerOwnership(tracker, { schemaFile: 'prisma/schema.prisma', clientFile: 'lib/db.ts' });

    const plan = await db.planAdd(root, {
      tracker,
      prismaInstalled: true,
      schemaFileExists: true,
      clientFileExists: true,
      envExampleExists: true,
      envLocalExists: true,
      gitignoreContent: null,
    });

    const packageJsonTransforms = plan.transforms.filter(
      (transform) => transform.type === 'package-json-mutation'
    );
    expect(packageJsonTransforms).toHaveLength(1);
    expect(packageJsonTransforms[0]).not.toHaveProperty('dependencies');
    expect(packageJsonTransforms[0]).not.toHaveProperty('devDependencies');

    const vfs = new VirtualFilesystem({
      initialFiles: {
        'package.json': JSON.stringify({
          name: 'demo-app',
          version: '1.0.0',
          dependencies: { '@prisma/client': '^5.0.0' },
          devDependencies: { prisma: '^5.0.0' },
        }),
      },
    });
    const applier = new TransformApplier();
    applier.applyAll(vfs, plan.transforms);

    const packageJson = JSON.parse(vfs.read('package.json') ?? '{}');
    expect(packageJson.scripts).toEqual({
      'db:generate': 'prisma generate',
      'db:migrate': 'prisma migrate dev',
      'db:studio': 'prisma studio',
    });
  });

  test('re-running when scripts already match is a true no-op for package.json content', async () => {
    const initialPackageJson = {
      name: 'demo-app',
      version: '1.0.0',
      dependencies: { '@prisma/client': '^5.0.0' },
      devDependencies: { prisma: '^5.0.0' },
      scripts: {
        'db:generate': 'prisma generate',
        'db:migrate': 'prisma migrate dev',
        'db:studio': 'prisma studio',
      },
    };
    const root = await createTempProject({
      'package.json': JSON.stringify(initialPackageJson),
    });
    const db = new DbCapability();
    const tracker = new OwnershipTracker();
    db.registerOwnership(tracker, { schemaFile: 'prisma/schema.prisma', clientFile: 'lib/db.ts' });
    const plan = await db.planAdd(root, {
      tracker,
      prismaInstalled: true,
      schemaFileExists: true,
      clientFileExists: true,
      envExampleExists: true,
      envLocalExists: true,
      gitignoreContent: null,
    });

    const sortedEntries = Object.fromEntries(
      Object.entries(initialPackageJson).sort(([a], [b]) => a.localeCompare(b))
    );
    const alphabetizedPackageJson = JSON.stringify(sortedEntries, null, 2) + '\n';
    const vfs = new VirtualFilesystem({
      initialFiles: { 'package.json': alphabetizedPackageJson },
    });
    const applier = new TransformApplier();
    applier.applyAll(vfs, plan.transforms);

    expect(vfs.read('package.json')).toBe(alphabetizedPackageJson);
  });

  test('scaffolds schema.prisma and a client singleton at the project root', async () => {
    const root = await createTempProject({
      'package.json': JSON.stringify({ name: 'demo-app', version: '1.0.0' }),
    });
    const db = new DbCapability();
    const plan = await db.planAdd(root, {});

    expect(plan.paths).toEqual({ schemaFile: 'prisma/schema.prisma', clientFile: 'lib/db.ts' });

    const vfs = new VirtualFilesystem({
      initialFiles: { 'package.json': JSON.stringify({ name: 'demo-app', version: '1.0.0' }) },
    });
    const applier = new TransformApplier();
    applier.applyAll(vfs, plan.transforms);

    expect(vfs.read('prisma/schema.prisma')).toContain('provider = "postgresql"');
    expect(vfs.read('prisma/schema.prisma')).toContain('model User');
    expect(vfs.read('lib/db.ts')).toContain('PrismaClient');
    expect(plan.capability.files).toEqual(['lib/db.ts', 'prisma/schema.prisma']);
  });

  test('scaffolds the client under src/ when an app router project is detected, schema stays at project root', async () => {
    const root = await createTempProject({
      'package.json': JSON.stringify({ name: 'demo-app', version: '1.0.0' }),
      'src/app/page.tsx': 'export default function Page() { return null; }',
    });
    const db = new DbCapability();
    const plan = await db.planAdd(root, {});

    expect(plan.paths).toEqual({ schemaFile: 'prisma/schema.prisma', clientFile: 'src/lib/db.ts' });
  });

  test('does not recreate schema.prisma or the client file when they already exist', async () => {
    const root = await createTempProject({
      'package.json': JSON.stringify({ name: 'demo-app', version: '1.0.0' }),
    });
    const db = new DbCapability();
    const tracker = new OwnershipTracker();
    const paths = { schemaFile: 'prisma/schema.prisma', clientFile: 'lib/db.ts' };
    db.registerOwnership(tracker, paths);

    const plan = await db.planAdd(root, {
      tracker,
      prismaInstalled: true,
      schemaFileExists: true,
      clientFileExists: true,
      envExampleExists: true,
      envLocalExists: true,
      gitignoreContent: null,
    });

    const fileTransform = plan.transforms.find((transform) => transform.type === 'file-create');
    expect(fileTransform).toBeUndefined();
  });

  test('refuses to add db when schema.prisma exists but was not created by kiln', async () => {
    const root = await createTempProject({
      'package.json': JSON.stringify({ name: 'demo-app', version: '1.0.0' }),
      'prisma/schema.prisma': 'datasource db { provider = "sqlite" }',
    });
    const db = new DbCapability();

    await expect(db.planAdd(root, {})).rejects.toThrow(/already exists and was not created by kiln/);
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
