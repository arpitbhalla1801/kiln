import { afterAll, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { OwnershipTracker } from '@kiln/core';
import { TransformApplier, VirtualFilesystem } from '@kiln/transform-engine';
import { AuthCapability, buildAuthFilePaths } from '../src/capability.js';
import { validateAuthOwnership } from '../src/validation.js';

const tempRoots: string[] = [];

async function createTempProject(files: Record<string, string> = {}): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'kiln-auth-capability-'));
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

describe('AuthCapability', () => {
  test('loads manifest with env dependency', async () => {
    const auth = new AuthCapability();
    const manifest = await auth.getManifest();

    expect(manifest.id).toBe('auth');
    expect(manifest.dependencies).toContain('env');
    expect(manifest.ownership?.dependencies).toContain('next-auth');
  });

  test('installs next-auth, creates auth files, and composes with env', async () => {
    const root = await createTempProject({
      'package.json': JSON.stringify({ name: 'demo-app', version: '1.0.0' }),
    });
    const auth = new AuthCapability();
    const plan = await auth.planAdd(root, {});

    expect(plan.paths.authFile).toBe('auth.ts');
    expect(plan.paths.middlewareFile).toBe('middleware.ts');
    expect(plan.envPlan.transforms.length).toBeGreaterThan(0);

    const vfs = new VirtualFilesystem({
      initialFiles: { 'package.json': JSON.stringify({ name: 'demo-app', version: '1.0.0' }) },
    });
    const applier = new TransformApplier();
    applier.applyAll(vfs, plan.transforms);

    const packageJson = JSON.parse(vfs.read('package.json') ?? '{}');
    expect(packageJson.dependencies).toEqual({ 'next-auth': '^5.0.0-beta.32' });
    expect(vfs.read('auth.ts')).toContain('NextAuth');
    expect(vfs.read('middleware.ts')).toContain('export default auth');
    expect(vfs.read('.env.example')).toMatch(/AUTH_SECRET=\S+/);
    expect(vfs.read('.env.example')).toContain('# --- auth ---');
    expect(plan.capability.ownedDependencies).toContain('next-auth');
    expect(plan.capability.ownedEnvVars).toBeUndefined();
  });

  test('does not claim next-auth when it was already installed', async () => {
    const root = await createTempProject({
      'package.json': JSON.stringify({
        name: 'demo-app',
        version: '1.0.0',
        dependencies: { 'next-auth': '^4.24.0' },
      }),
    });
    const plan = await new AuthCapability().planAdd(root, {});

    expect(plan.capability.ownedDependencies ?? []).not.toContain('next-auth');
    expect(
      plan.ownershipRegistrations.some(
        (registration) =>
          registration.resourceType === 'dependency' && registration.resourceKey === 'next-auth'
      )
    ).toBe(false);
  });

  test('groups env and auth variables under separate section headers in .env.example', async () => {
    const root = await createTempProject({
      'package.json': JSON.stringify({ name: 'demo-app', version: '1.0.0' }),
    });
    const vfs = new VirtualFilesystem({
      initialFiles: { 'package.json': JSON.stringify({ name: 'demo-app', version: '1.0.0' }) },
    });
    const applier = new TransformApplier();

    const { EnvCapability } = await import('@kiln/env-capability');
    const envCapability = new EnvCapability();
    const envPlan = await envCapability.planAdd(root, {
      variables: { DATABASE_URL: 'postgres://localhost:5432/app' },
    });
    applier.applyAll(vfs, envPlan.transforms);

    const auth = new AuthCapability(envCapability);
    const authPlan = await auth.planAdd(root, { envExampleExists: true });
    applier.applyAll(vfs, authPlan.transforms);

    const content = vfs.read('.env.example') ?? '';
    expect(content.indexOf('# --- env ---')).toBeGreaterThanOrEqual(0);
    expect(content.indexOf('# --- auth ---')).toBeGreaterThan(content.indexOf('# --- env ---'));
    expect(content.indexOf('DATABASE_URL')).toBeGreaterThan(content.indexOf('# --- env ---'));
    expect(content.indexOf('AUTH_SECRET')).toBeGreaterThan(content.indexOf('# --- auth ---'));
  });

  test('merges extraEnvVars into the env composition alongside auth vars', async () => {
    const root = await createTempProject({
      'package.json': JSON.stringify({ name: 'demo-app', version: '1.0.0' }),
    });
    const auth = new AuthCapability();
    const plan = await auth.planAdd(root, {
      extraEnvVars: { CUSTOM_KEY: 'custom-value' },
    });

    const vfs = new VirtualFilesystem({
      initialFiles: { 'package.json': JSON.stringify({ name: 'demo-app', version: '1.0.0' }) },
    });
    const applier = new TransformApplier();
    applier.applyAll(vfs, plan.transforms);

    expect(vfs.read('.env.example')).toContain('CUSTOM_KEY=replace-me');
    expect(vfs.read('.env.example')).toContain('AUTH_SECRET=replace-me');
  });

  test('does not scaffold a route handler when no providers are selected', async () => {
    const root = await createTempProject({
      'package.json': JSON.stringify({ name: 'demo-app', version: '1.0.0' }),
    });
    const auth = new AuthCapability();
    const plan = await auth.planAdd(root, {});

    const routeHandlerTransform = plan.transforms.find(
      (transform) => transform.filePath === plan.paths.routeHandlerFile
    );
    expect(routeHandlerTransform).toBeUndefined();
  });

  test('scaffolds a route handler under the detected source root when a provider is selected', async () => {
    const root = await createTempProject({
      'package.json': JSON.stringify({ name: 'demo-app', version: '1.0.0' }),
      'src/app/page.tsx': 'export default function Page() { return null; }',
    });
    const auth = new AuthCapability();
    const plan = await auth.planAdd(root, { providers: ['github'] });

    expect(plan.paths.routeHandlerFile).toBe('src/app/api/auth/[...nextauth]/route.ts');

    const vfs = new VirtualFilesystem({
      initialFiles: { 'package.json': JSON.stringify({ name: 'demo-app', version: '1.0.0' }) },
    });
    const applier = new TransformApplier();
    applier.applyAll(vfs, plan.transforms);

    expect(vfs.read(plan.paths.routeHandlerFile)).toContain('export const { GET, POST } = handlers;');
    expect(plan.capability.files).toContain(plan.paths.routeHandlerFile);
    expect(vfs.read('.env.example')).toContain('AUTH_GITHUB_ID=');
    expect(vfs.read('.env.example')).toContain('AUTH_GITHUB_SECRET=');
  });

  test('uses src directory when app router project is detected', async () => {
    const root = await createTempProject({
      'package.json': JSON.stringify({ name: 'demo-app', version: '1.0.0' }),
      'src/app/page.tsx': 'export default function Page() { return null; }',
    });
    const auth = new AuthCapability();
    const plan = await auth.planAdd(root, {});

    expect(plan.paths).toEqual({
      authFile: 'src/auth.ts',
      middlewareFile: 'src/middleware.ts',
      routeHandlerFile: 'src/app/api/auth/[...nextauth]/route.ts',
    });
  });

  test('repeated adds are idempotent', async () => {
    const root = await createTempProject({
      'package.json': JSON.stringify({
        name: 'demo-app',
        version: '1.0.0',
        dependencies: { 'next-auth': '^5.0.0-beta.32' },
      }),
    });
    const auth = new AuthCapability();
    const tracker = new OwnershipTracker();
    const paths = buildAuthFilePaths();

    const firstPlan = await auth.planAdd(root, {});
    auth.registerOwnership(tracker, paths);

    const vfs = new VirtualFilesystem({
      initialFiles: {
        'package.json': JSON.stringify({
          name: 'demo-app',
          version: '1.0.0',
          dependencies: { 'next-auth': '^5.0.0-beta.32' },
        }),
      },
    });

    const applier = new TransformApplier();
    applier.applyAll(vfs, firstPlan.transforms);

    const generatedSecret = vfs.read('.env.example');
    expect(generatedSecret).toContain('AUTH_SECRET=replace-me');

    const generatedLocalSecret = vfs.read('.env.local');
    expect(generatedLocalSecret).toMatch(/AUTH_SECRET=\S+/);
    expect(generatedLocalSecret).not.toContain('AUTH_SECRET=replace-me');

    const secondPlan = await auth.planAdd(root, {
      tracker,
      authFileExists: true,
      middlewareFileExists: true,
      nextAuthInstalled: true,
      envExampleExists: true,
      envLocalExists: true,
      authSecretExists: true,
      gitignoreContent: null,
    });

    expect(secondPlan.transforms).toHaveLength(0);

    const repairPlan = await auth.planAdd(root, {
      tracker,
      authFileExists: true,
      middlewareFileExists: true,
      nextAuthInstalled: true,
      envExampleExists: true,
      envLocalExists: true,
      authSecretExists: false,
      gitignoreContent: null,
    });

    expect(repairPlan.transforms.length).toBeGreaterThan(0);
    applier.applyAll(vfs, repairPlan.transforms);
    expect(vfs.read('.env.local')).toMatch(/AUTH_SECRET=\S+/);

    applier.applyAll(vfs, secondPlan.transforms);
    expect(vfs.read('.env.example')).toBe(generatedSecret);
  });

  test('rejects ownership conflicts', () => {
    const tracker = new OwnershipTracker();
    tracker.registerDependency('next-auth', 'other-capability');

    const paths = buildAuthFilePaths();

    expect(() => validateAuthOwnership(paths, tracker)).toThrow(/Ownership conflict detected/);
  });
});
