/**
 * Proves the SDK's structural types are actually satisfied by kiln's real
 * classes/objects -- not just plausible-looking duplicates. @kiln/core and
 * @kiln/transform-engine are devDependencies here ONLY, for this
 * compile-time/runtime check; they are never part of the published
 * package (see package.json's `files` list).
 */
import { describe, expect, test } from 'bun:test';
import { OwnershipTracker as RealOwnershipTracker } from '@kiln/core';
import { createTransformPipeline as createRealTransformPipeline } from '@kiln/transform-engine';
import type { OwnershipTracker } from '../src/ownership.js';
import type { TransformPipeline } from '../src/transforms.js';

describe('structural compatibility with kiln internals', () => {
  test('the real OwnershipTracker satisfies the SDK OwnershipTracker interface', () => {
    const real = new RealOwnershipTracker();
    const asSdkType: OwnershipTracker = real;

    asSdkType.registerFile('a.ts', 'test-capability');
    expect(asSdkType.getOwner('file', 'a.ts')).toBe('test-capability');

    const conflicts = asSdkType.detectConflicts([
      { resourceType: 'file', resourceKey: 'a.ts', ownerCapabilityId: 'other-capability' },
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].existingOwner).toBe('test-capability');
  });

  test('a real transform pipeline satisfies the SDK TransformPipeline type', () => {
    const realPipeline = createRealTransformPipeline()
      .fileCreate('create', 'src/a.ts', 'export {}')
      .build();

    const asSdkType: TransformPipeline = realPipeline;
    expect(asSdkType).toHaveLength(1);
    expect(asSdkType[0].type).toBe('file-create');
  });
});
