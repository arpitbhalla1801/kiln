import { describe, expect, test } from 'bun:test';
import { extractInstallDependencies } from '../src/install.js';
import type { TransformPipeline } from '@kiln/transform-engine';

describe('extractInstallDependencies', () => {
  test('collects dependencies and devDependencies separately', () => {
    const transforms: TransformPipeline = [
      {
        id: 'install-prisma',
        type: 'package-json-mutation',
        dependencies: { '@prisma/client': '^5.0.0' },
        devDependencies: { prisma: '^5.0.0' },
      },
    ];

    expect(extractInstallDependencies(transforms)).toEqual({
      dependencies: { '@prisma/client': '^5.0.0' },
      devDependencies: { prisma: '^5.0.0' },
    });
  });

  test('merges across multiple package-json-mutation transforms', () => {
    const transforms: TransformPipeline = [
      {
        id: 'a',
        type: 'package-json-mutation',
        dependencies: { 'next-auth': '^5.0.0' },
      },
      {
        id: 'b',
        type: 'package-json-mutation',
        devDependencies: { prisma: '^5.0.0' },
      },
    ];

    expect(extractInstallDependencies(transforms)).toEqual({
      dependencies: { 'next-auth': '^5.0.0' },
      devDependencies: { prisma: '^5.0.0' },
    });
  });

  test('ignores non-package-json-mutation transforms', () => {
    const transforms: TransformPipeline = [
      { id: 'a', type: 'file-create', filePath: 'src/a.ts', content: '' },
    ];

    expect(extractInstallDependencies(transforms)).toEqual({
      dependencies: {},
      devDependencies: {},
    });
  });
});
