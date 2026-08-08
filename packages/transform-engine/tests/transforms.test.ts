import { describe, expect, test } from 'bun:test';
import { TransformApplier } from '../src/transform-applier.js';
import { VirtualFilesystem } from '../src/vfs.js';
import {
  composeTransforms,
  createTransformPipeline,
  fileCreate,
  filePatch,
  envMutation,
  jsonMutation,
  packageJsonMutation,
} from '../src/transform-builders.js';
import { TransformEngine } from '../src/engine.js';
import type { TypedTransform } from '../src/transform-types.js';

describe('typed transform API', () => {
  test('builders create typed transforms for each supported type', () => {
    const transforms: TypedTransform[] = [
      fileCreate('create-auth', 'src/auth.ts', 'export {}'),
      filePatch('patch-app', 'src/app.ts', 'old', 'new'),
      jsonMutation('json-tsconfig', 'tsconfig.json', 'compilerOptions.strict', true),
      packageJsonMutation('pkg-deps', {
        dependencies: { 'next-auth': '^5.0.0' },
        scripts: { dev: 'next dev' },
      }),
      envMutation('env-example', '.env.example', {
        AUTH_SECRET: { example: 'replace-me', required: true },
      }),
    ];

    expect(transforms.map((transform) => transform.type)).toEqual([
      'file-create',
      'file-patch',
      'json-mutation',
      'package-json-mutation',
      'env-mutation',
    ]);
  });

  test('composeTransforms and pipeline builder are composable', () => {
    const pipeline = createTransformPipeline()
      .fileCreate('create-file', 'README.md', '# Kiln')
      .packageJsonMutation('pkg', { scripts: { build: 'next build' } })
      .envMutation('env', '.env.example', { DATABASE_URL: 'postgres://localhost' })
      .build();

    expect(pipeline).toHaveLength(3);
    expect(composeTransforms(pipeline)).toEqual(pipeline);
  });
});

describe('TransformApplier', () => {
  const applier = new TransformApplier();

  test('applies file create transform', () => {
    const vfs = new VirtualFilesystem();
    applier.apply(vfs, fileCreate('create', 'src/new.ts', 'export const x = 1;'));

    expect(vfs.read('src/new.ts')).toBe('export const x = 1;');
  });

  test('applies file patch transform', () => {
    const vfs = new VirtualFilesystem({ initialFiles: { 'src/app.ts': 'const mode = "dev";' } });
    applier.apply(vfs, filePatch('patch', 'src/app.ts', '"dev"', '"production"'));

    expect(vfs.read('src/app.ts')).toBe('const mode = "production";');
  });

  test('applies json mutation transform', () => {
    const vfs = new VirtualFilesystem({
      initialFiles: { 'tsconfig.json': '{"compilerOptions":{}}' },
    });

    applier.apply(
      vfs,
      jsonMutation('json', 'tsconfig.json', 'compilerOptions.strict', true)
    );

    expect(vfs.read('tsconfig.json')).toBe(
      `${JSON.stringify({ compilerOptions: { strict: true } }, null, 2)}\n`
    );
  });

  test('applies package.json mutation transform', () => {
    const vfs = new VirtualFilesystem({
      initialFiles: {
        'package.json': JSON.stringify({ name: 'app', version: '1.0.0' }),
      },
    });

    applier.apply(
      vfs,
      packageJsonMutation('pkg', {
        dependencies: { zod: '^3.0.0', 'next-auth': '^5.0.0' },
        scripts: { dev: 'next dev' },
      })
    );

    const packageJson = JSON.parse(vfs.read('package.json') ?? '{}');
    expect(packageJson.dependencies).toEqual({ 'next-auth': '^5.0.0', zod: '^3.0.0' });
    expect(packageJson.scripts).toEqual({ dev: 'next dev' });
  });

  test('applies env mutation transform deterministically', () => {
    const vfs = new VirtualFilesystem({
      initialFiles: { '.env.example': 'EXISTING=value\n' },
    });

    applier.apply(
      vfs,
      envMutation('env', '.env.example', {
        AUTH_SECRET: { example: 'replace-me', required: true },
        DATABASE_URL: 'postgres://localhost',
      })
    );

    expect(vfs.read('.env.example')).toBe(
      'AUTH_SECRET=replace-me\nDATABASE_URL=postgres://localhost\nEXISTING=value\n'
    );
  });
});

describe('TransformEngine typed transforms', () => {
  test('queueTransforms stages composable transforms in vfs', () => {
    const engine = new TransformEngine();

    engine.queueTransforms(
      createTransformPipeline()
        .fileCreate('readme', 'README.md', '# App')
        .packageJsonMutation('pkg', { dependencies: { zod: '^3.0.0' } })
        .build()
    );

    const plan = engine.getPlanPreview();

    expect(plan.summary.created).toBe(2);
    expect(engine.getVirtualFilesystem().read('README.md')).toBe('# App');
  });
});
