import { describe, expect, test } from 'bun:test';
import { StructuredMutationEngine } from '../src/mutation-engine.js';
import { PackageJsonMerger } from '../src/package-json-merger.js';
import { TransformApplier } from '../src/transform-applier.js';
import { VirtualFilesystem } from '../src/vfs.js';
import {
  createTransformPipeline,
  filePatch,
  jsonMutation,
  packageJsonMutation,
} from '../src/transform-builders.js';

describe('StructuredMutationEngine', () => {
  const engine = new StructuredMutationEngine();

  test('applies JSON AST set and delete mutations', () => {
    const document = engine.parse('{"compilerOptions":{}}');

    engine.apply(document, { type: 'set', path: 'compilerOptions.strict', value: true });
    engine.apply(document, { type: 'merge', path: 'compilerOptions', value: { jsx: 'react' } });
    engine.apply(document, { type: 'delete', path: 'compilerOptions.jsx' });

    expect(engine.serialize(document)).toBe(
      `${JSON.stringify({ compilerOptions: { strict: true } }, null, 2)}\n`
    );
  });

  test('set mutations are idempotent', () => {
    const document = engine.parse('{"name":"app"}');

    engine.apply(document, { type: 'set', path: 'version', value: '1.0.0' });
    const first = engine.serialize(document);

    engine.apply(document, { type: 'set', path: 'version', value: '1.0.0' });
    const second = engine.serialize(document);

    expect(first).toBe(second);
  });

  test('delete mutations are idempotent when path is missing', () => {
    const document = engine.parse('{"name":"app"}');
    const before = engine.serialize(document);

    engine.apply(document, { type: 'delete', path: 'missing.path' });
    const after = engine.serialize(document);

    expect(after).toBe(before);
  });
});

describe('PackageJsonMerger', () => {
  const merger = new PackageJsonMerger();

  test('merges dependencies and scripts deterministically', () => {
    const merged = merger.merge(
      { name: 'app', version: '1.0.0' },
      {
        dependencies: { zod: '^3.0.0', 'next-auth': '^5.0.0' },
        scripts: { dev: 'next dev' },
      }
    );

    expect(merged.dependencies).toEqual({ 'next-auth': '^5.0.0', zod: '^3.0.0' });
    expect(merged.scripts).toEqual({ dev: 'next dev' });
  });

  test('repeated merge produces same output', () => {
    const current = { name: 'app', version: '1.0.0' };
    const input = {
      dependencies: { zod: '^3.0.0' },
      scripts: { dev: 'next dev' },
    };

    const once = merger.merge(current, input);
    const twice = merger.merge(once, input);
    const thrice = merger.merge(twice, input);

    expect(merger.mergeToString(once, {})).toBe(merger.mergeToString(twice, {}));
    expect(merger.mergeToString(twice, {})).toBe(merger.mergeToString(thrice, {}));
    expect(merger.isIdempotent(once, input)).toBe(true);
  });

  test('remove operations are idempotent', () => {
    const current = {
      name: 'app',
      dependencies: { zod: '^3.0.0' },
      scripts: { dev: 'next dev' },
    };

    const first = merger.merge(current, { removeDependencies: ['zod'], removeScripts: ['dev'] });
    const second = merger.merge(first, { removeDependencies: ['zod'], removeScripts: ['dev'] });

    expect(first).toEqual(second);
  });
});

describe('idempotent transform application', () => {
  test('repeated pipeline execution produces identical vfs output', () => {
    const vfs = new VirtualFilesystem({
      initialFiles: {
        'package.json': JSON.stringify({ name: 'app', version: '1.0.0' }),
        'src/app.ts': 'const mode = "dev";',
        'tsconfig.json': '{"compilerOptions":{}}',
      },
    });

    const pipeline = createTransformPipeline()
      .packageJsonMutation('pkg', {
        dependencies: { zod: '^3.0.0' },
        scripts: { dev: 'next dev' },
      })
      .filePatch('patch', 'src/app.ts', '"dev"', '"production"')
      .jsonMutation('json', 'tsconfig.json', 'compilerOptions.strict', true)
      .build();

    const applier = new TransformApplier();
    applier.applyAll(vfs, pipeline);
    const firstSnapshot = vfs.snapshot();

    applier.applyAll(vfs, pipeline);
    const secondSnapshot = vfs.snapshot();

    expect(secondSnapshot).toEqual(firstSnapshot);
  });

  test('file patch is idempotent once applied', () => {
    const vfs = new VirtualFilesystem({
      initialFiles: { 'src/app.ts': 'const mode = "dev";' },
    });
    const applier = new TransformApplier();
    const patch = filePatch('patch', 'src/app.ts', '"dev"', '"production"');

    applier.apply(vfs, patch);
    applier.apply(vfs, patch);

    expect(vfs.read('src/app.ts')).toBe('const mode = "production";');
  });
});
