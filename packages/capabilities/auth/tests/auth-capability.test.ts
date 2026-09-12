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
    const plan = await auth.planAdd(root);

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
    expect(vfs.read('.env.example')).toContain('AUTH_SECRET=replace-me');
    expect(plan.capability.ownedDependencies).toContain('next-auth');
    expect(plan.capability.ownedEnvVars).toBeUndefined();
  });

  test('does not scaffold a route handler when no providers are selected', async () => {
    const root = await createTempProject({
      'package.json': JSON.stringify({ name: 'demo-app', version: '1.0.0' }),
    });
    const auth = new AuthCapability();
    const plan = await auth.planAdd(root);

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
  });

  test('uses src directory when app router project is detected', async () => {
    const root = await createTempProject({
      'package.json': JSON.stringify({ name: 'demo-app', version: '1.0.0' }),
      'src/app/page.tsx': 'export default function Page() { return null; }',
    });
    const auth = new AuthCapability();
    const plan = await auth.planAdd(root);

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

    const firstPlan = await auth.planAdd(root);
    auth.registerOwnership(tracker, paths);

    const vfs = new VirtualFilesystem({
      initialFiles: {
        'package.json': JSON.stringify({
          name: 'demo-app',
          version: '1.0.0',
          dependencies: { 'next-auth': '^5.0.0-beta.32' },
        }),
        'auth.ts': 'existing auth',
        'middleware.ts': 'existing middleware',
        '.env.example': 'AUTH_SECRET=replace-me\n',
      },
    });

    const applier = new TransformApplier();
    applier.applyAll(vfs, firstPlan.transforms);

    const secondPlan = await auth.planAdd(root, {
      tracker,
      authFileExists: true,
      middlewareFileExists: true,
      nextAuthInstalled: true,
      envExampleExists: true,
    });

    expect(secondPlan.transforms).toHaveLength(1);
    expect(secondPlan.transforms[0].type).toBe('env-mutation');

    applier.applyAll(vfs, secondPlan.transforms);
    expect(vfs.read('.env.example')).toBe('# Environment variables\nAUTH_SECRET=replace-me\n');
  });

  test('rejects ownership conflicts', () => {
    const tracker = new OwnershipTracker();
    tracker.registerDependency('next-auth', 'other-capability');

    const paths = buildAuthFilePaths();

    expect(() => validateAuthOwnership(paths, tracker)).toThrow(/Ownership conflict detected/);
  });
});
