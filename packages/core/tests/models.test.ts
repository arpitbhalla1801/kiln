import { describe, expect, test } from 'bun:test';
import * as core from '../src/index.js';
import {
  TRANSFORM_TYPES,
  type AdapterContract,
  type Capability,
  type CapabilityManifest,
  type ExecutionPlan,
  type FileOwnership,
  type ProjectState,
  type Transform,
} from '../src/models.js';
import {
  createEmptyProjectState,
  capabilityFromManifest,
  fileOwnershipFromEntries,
  fileOwnershipToEntries,
  withActiveAdapters,
} from '../src/state.js';

describe('core shared types', () => {
  test('exports all required shared types from package entry', () => {
    expect(core.name).toBe('@kiln/core');
    expect(core.TRANSFORM_TYPES).toEqual(TRANSFORM_TYPES);
    expect(core.createEmptyProjectState).toBe(createEmptyProjectState);
  });

  test('constructs Capability with required fields', () => {
    const capability: Capability = {
      id: 'auth',
      version: '1.0.0',
      dependencies: ['core'],
      adapters: ['node-adapter'],
      transforms: [{ id: 'auth-middleware', type: 'file-create', target: 'middleware.ts' }],
      files: ['middleware.ts'],
    };

    expect(capability.id).toBe('auth');
    expect(capability.transforms?.[0].type).toBe('file-create');
  });

  test('constructs Transform with typed operation kind', () => {
    const transform: Transform = {
      id: 'env-example',
      type: 'env-mutation',
      target: '.env.example',
      payload: { KEY: 'VALUE' },
    };

    expect(transform.type).toBe('env-mutation');
  });

  test('constructs FileOwnership, ProjectState, ExecutionPlan, and AdapterContract', () => {
    const ownership: FileOwnership = {
      filePath: 'src/auth.ts',
      ownerCapabilityId: 'auth',
    };

    const state: ProjectState = {
      capabilities: [{ id: 'core', version: '1.0.0', dependencies: [] }],
      fileOwnership: new Map([['src/auth.ts', 'auth']]),
      activeAdapters: ['node-adapter'],
    };

    const plan: ExecutionPlan = {
      capabilities: state.capabilities,
      transforms: ['auth-middleware'],
    };

    const adapter: AdapterContract = {
      id: 'node-adapter',
      version: '1.0.0',
      provides: ['package-manager', 'filesystem'],
    };

    expect(ownership.ownerCapabilityId).toBe('auth');
    expect(state.activeAdapters).toContain('node-adapter');
    expect(plan.transforms).toEqual(['auth-middleware']);
    expect(adapter.provides).toContain('filesystem');
  });

  test('constructs CapabilityManifest for planning input', () => {
    const manifest: CapabilityManifest = {
      id: 'env',
      version: '1.0.0',
      dependencies: ['core'],
      transforms: ['env-example'],
      files: ['.env.example'],
    };

    expect(manifest.transforms).toEqual(['env-example']);
  });

  test('lists all transform types for validation', () => {
    expect(TRANSFORM_TYPES).toEqual([
      'file-create',
      'file-modify',
      'file-delete',
      'file-patch',
      'json-mutation',
      'package-json-mutation',
      'env-mutation',
    ]);
  });
});

describe('project state helpers', () => {
  test('createEmptyProjectState returns empty collections', () => {
    const state = createEmptyProjectState();

    expect(state.capabilities).toEqual([]);
    expect(state.fileOwnership.size).toBe(0);
    expect(state.activeAdapters).toEqual([]);
  });

  test('file ownership helpers round-trip deterministically', () => {
    const entries: FileOwnership[] = [
      { filePath: 'b.ts', ownerCapabilityId: 'beta' },
      { filePath: 'a.ts', ownerCapabilityId: 'alpha' },
    ];

    const ownership = fileOwnershipFromEntries(entries);
    const serialized = fileOwnershipToEntries(ownership);

    expect(serialized).toEqual([
      { filePath: 'a.ts', ownerCapabilityId: 'alpha' },
      { filePath: 'b.ts', ownerCapabilityId: 'beta' },
    ]);
  });

  test('withActiveAdapters clones state with adapters', () => {
    const state = createEmptyProjectState();
    const withAdapters = withActiveAdapters(state, ['node-adapter']);

    expect(withAdapters.activeAdapters).toEqual(['node-adapter']);
    expect(state.activeAdapters).toEqual([]);
  });

  test('capabilityFromManifest maps manifest fields without transform definitions', () => {
    const capability = capabilityFromManifest({
      id: 'env',
      version: '1.0.0',
      dependencies: ['core'],
      transforms: ['env-example'],
      files: ['.env.example'],
    });

    expect(capability).toEqual({
      id: 'env',
      version: '1.0.0',
      dependencies: ['core'],
      files: ['.env.example'],
    });
  });
});
