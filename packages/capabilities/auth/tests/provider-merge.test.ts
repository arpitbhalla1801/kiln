import { afterAll, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { OwnershipTracker } from '@kiln/core';
import { TransformApplier, VirtualFilesystem } from '@kiln/transform-engine';
import { AuthCapability, buildAuthFilePaths } from '../src/capability.js';
import { createAuthConfigContent } from '../src/templates.js';

const tempRoots: string[] = [];

async function createTempProject(files: Record<string, string> = {}): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'kiln-auth-merge-'));
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

describe('provider merge on re-run', () => {
  test('adding an already-present provider is a no-op for auth.ts', async () => {
    const root = await createTempProject({
      'package.json': JSON.stringify({ name: 'demo-app', version: '1.0.0' }),
    });
    const auth = new AuthCapability();
    const tracker = new OwnershipTracker();
    auth.registerOwnership(tracker, buildAuthFilePaths(), ['github']);

    const plan = await auth.planAdd(root, {
      tracker,
      authFileExists: true,
      middlewareFileExists: true,
      nextAuthInstalled: true,
      envExampleExists: true,
      providers: ['github'],
      existingProviders: ['github'],
      authFileContent: createAuthConfigContent(['github']),
    });

    const authFileTransform = plan.transforms.find((transform) => transform.filePath === 'auth.ts');
    expect(authFileTransform).toBeUndefined();
    expect(plan.providers).toEqual(['github']);
  });

  test('regenerates auth.ts wholesale when current content matches what kiln generated', async () => {
    const root = await createTempProject({
      'package.json': JSON.stringify({ name: 'demo-app', version: '1.0.0' }),
    });
    const auth = new AuthCapability();
    const tracker = new OwnershipTracker();
    auth.registerOwnership(tracker, buildAuthFilePaths(), ['github']);
    const priorContent = createAuthConfigContent(['github']);

    const plan = await auth.planAdd(root, {
      tracker,
      authFileExists: true,
      middlewareFileExists: true,
      nextAuthInstalled: true,
      envExampleExists: true,
      providers: ['github', 'google'],
      existingProviders: ['github'],
      authFileContent: priorContent,
    });

    expect(plan.providers).toEqual(['github', 'google']);

    const vfs = new VirtualFilesystem({
      initialFiles: {
        'package.json': JSON.stringify({ name: 'demo-app', version: '1.0.0' }),
        'auth.ts': priorContent,
      },
    });
    const applier = new TransformApplier();
    applier.applyAll(vfs, plan.transforms);

    expect(vfs.read('auth.ts')).toBe(createAuthConfigContent(['github', 'google']));
  });

  test('reconciles providers, removing ones no longer requested', async () => {
    const root = await createTempProject({
      'package.json': JSON.stringify({ name: 'demo-app', version: '1.0.0' }),
    });
    const auth = new AuthCapability();
    const tracker = new OwnershipTracker();
    auth.registerOwnership(tracker, buildAuthFilePaths(), ['github', 'google']);
    const priorContent = createAuthConfigContent(['github', 'google']);

    const plan = await auth.planAdd(root, {
      tracker,
      authFileExists: true,
      middlewareFileExists: true,
      nextAuthInstalled: true,
      envExampleExists: true,
      providers: ['github'],
      existingProviders: ['github', 'google'],
      authFileContent: priorContent,
    });

    expect(plan.providers).toEqual(['github']);

    const vfs = new VirtualFilesystem({
      initialFiles: {
        'package.json': JSON.stringify({ name: 'demo-app', version: '1.0.0' }),
        'auth.ts': priorContent,
      },
    });
    const applier = new TransformApplier();
    applier.applyAll(vfs, plan.transforms);

    expect(vfs.read('auth.ts')).toBe(createAuthConfigContent(['github']));
  });

  test('falls back to a file-patch merge when auth.ts was hand-edited', async () => {
    const root = await createTempProject({
      'package.json': JSON.stringify({ name: 'demo-app', version: '1.0.0' }),
    });
    const auth = new AuthCapability();
    const tracker = new OwnershipTracker();
    auth.registerOwnership(tracker, buildAuthFilePaths(), ['github']);
    const handEditedContent = `import NextAuth from "next-auth";

// custom comment a human added
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub,
  ],
  trustHost: true,
});
`;

    const plan = await auth.planAdd(root, {
      tracker,
      authFileExists: true,
      middlewareFileExists: true,
      nextAuthInstalled: true,
      envExampleExists: true,
      providers: ['github', 'google'],
      existingProviders: ['github'],
      authFileContent: handEditedContent,
    });

    const vfs = new VirtualFilesystem({
      initialFiles: {
        'package.json': JSON.stringify({ name: 'demo-app', version: '1.0.0' }),
        'auth.ts': handEditedContent,
      },
    });
    const applier = new TransformApplier();
    applier.applyAll(vfs, plan.transforms);

    const result = vfs.read('auth.ts') ?? '';
    expect(result).toContain('import Google from "next-auth/providers/google";');
    expect(result).toContain('providers: [\n    Google,\n    GitHub,');
    expect(result).toContain('trustHost: true');
    expect(result).toContain('custom comment a human added');
  });
});
