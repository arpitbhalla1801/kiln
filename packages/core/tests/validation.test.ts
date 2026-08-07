import { describe, expect, test } from 'bun:test';
import { ValidationRunner } from '../src/validation.js';
import { ProjectState, ExecutionPlan, Capability } from '../src/models.js';

describe('ValidationRunner', () => {
  test('validates valid plans without throwing', () => {
    const state: ProjectState = {
      capabilities: [{ id: 'core', version: '1.0', dependencies: [] }],
      fileOwnership: new Map([['core.ts', 'core']]),
      activeAdapters: ['node-adapter']
    };

    const runner = new ValidationRunner(state);
    
    const validPlan: ExecutionPlan = {
      capabilities: [
        { 
          id: 'auth', 
          version: '1.0', 
          dependencies: ['core'], 
          adapters: ['node-adapter'],
          files: ['auth.ts']
        }
      ],
      transforms: []
    };

    expect(() => runner.validatePlan(validPlan)).not.toThrow();
  });

  test('throws on missing dependency validation', () => {
    const state: ProjectState = {
      capabilities: [],
      fileOwnership: new Map(),
      activeAdapters: []
    };

    const runner = new ValidationRunner(state);
    
    const invalidPlan: ExecutionPlan = {
      capabilities: [
        { id: 'auth', version: '1.0', dependencies: ['core'] }
      ],
      transforms: []
    };

    expect(() => runner.validatePlan(invalidPlan))
      .toThrow("Dependency validation failed: Capability 'auth' requires missing dependency 'core'");
  });

  test('throws on missing adapter compatibility', () => {
    const state: ProjectState = {
      capabilities: [],
      fileOwnership: new Map(),
      activeAdapters: ['some-other-adapter']
    };

    const runner = new ValidationRunner(state);
    
    const invalidPlan: ExecutionPlan = {
      capabilities: [
        { id: 'auth', version: '1.0', dependencies: [], adapters: ['required-adapter'] }
      ],
      transforms: []
    };

    expect(() => runner.validatePlan(invalidPlan))
      .toThrow("Adapter compatibility failed: Capability 'auth' requires missing adapter 'required-adapter'");
  });

  test('throws on duplicate ownership detection', () => {
    const state: ProjectState = {
      capabilities: [{ id: 'core', version: '1.0', dependencies: [] }],
      fileOwnership: new Map([['shared.ts', 'core']]),
      activeAdapters: []
    };

    const runner = new ValidationRunner(state);
    
    const invalidPlan: ExecutionPlan = {
      capabilities: [
        { id: 'auth', version: '1.0', dependencies: [], files: ['shared.ts'] }
      ],
      transforms: []
    };

    expect(() => runner.validatePlan(invalidPlan)).toThrow(
      "Ownership conflict detected: file 'shared.ts' is already owned by 'core'"
    );
  });

  test('throws on dependency ownership conflicts', () => {
    const state: ProjectState = {
      capabilities: [
        {
          id: 'auth',
          version: '1.0',
          dependencies: [],
          ownedDependencies: ['next-auth'],
        },
      ],
      fileOwnership: new Map(),
      activeAdapters: [],
    };

    const runner = new ValidationRunner(state);

    const invalidPlan: ExecutionPlan = {
      capabilities: [
        {
          id: 'env',
          version: '1.0',
          dependencies: [],
          ownedDependencies: ['next-auth'],
        },
      ],
      transforms: [],
    };

    expect(() => runner.validatePlan(invalidPlan)).toThrow(
      "Ownership conflict detected: dependency 'next-auth' is already owned by 'auth'"
    );
  });

  test('throws on metadata ownership conflicts', () => {
    const state: ProjectState = {
      capabilities: [
        {
          id: 'core',
          version: '1.0',
          dependencies: [],
          ownedMetadata: ['next.config.ts'],
        },
      ],
      fileOwnership: new Map(),
      activeAdapters: [],
    };

    const runner = new ValidationRunner(state);

    const invalidPlan: ExecutionPlan = {
      capabilities: [
        {
          id: 'auth',
          version: '1.0',
          dependencies: [],
          ownedMetadata: ['next.config.ts'],
        },
      ],
      transforms: [],
    };

    expect(() => runner.validatePlan(invalidPlan)).toThrow(
      "Ownership conflict detected: metadata 'next.config.ts' is already owned by 'core'"
    );
  });
});