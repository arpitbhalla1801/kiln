import { describe, expect, test } from 'bun:test';
import {
  OwnershipTracker,
  formatOwnershipConflict,
} from '../src/ownership.js';

describe('OwnershipTracker', () => {
  test('tracks file, dependency, script, env var, and metadata ownership', () => {
    const tracker = new OwnershipTracker();

    tracker.registerFile('src/auth.ts', 'auth');
    tracker.registerDependency('next-auth', 'auth');
    tracker.registerScript('dev', 'core');
    tracker.registerEnvVar('AUTH_SECRET', 'env');
    tracker.registerMetadata('next.config.ts', 'core');

    expect(tracker.getOwner('file', 'src/auth.ts')).toBe('auth');
    expect(tracker.getOwner('dependency', 'next-auth')).toBe('auth');
    expect(tracker.getOwner('script', 'dev')).toBe('core');
    expect(tracker.getOwner('envVar', 'AUTH_SECRET')).toBe('env');
    expect(tracker.getOwner('metadata', 'next.config.ts')).toBe('core');
  });

  test('detects ownership conflicts across resource types', () => {
    const tracker = new OwnershipTracker();
    tracker.registerFile('shared.ts', 'auth');
    tracker.registerDependency('next-auth', 'auth');
    tracker.registerMetadata('tsconfig.json', 'core');

    const conflicts = tracker.detectConflicts([
      { resourceType: 'file', resourceKey: 'shared.ts', ownerCapabilityId: 'env' },
      { resourceType: 'dependency', resourceKey: 'next-auth', ownerCapabilityId: 'env' },
      { resourceType: 'metadata', resourceKey: 'tsconfig.json', ownerCapabilityId: 'auth' },
    ]);

    expect(conflicts).toEqual([
      {
        resourceType: 'dependency',
        resourceKey: 'next-auth',
        existingOwner: 'auth',
        attemptedOwner: 'env',
      },
      {
        resourceType: 'file',
        resourceKey: 'shared.ts',
        existingOwner: 'auth',
        attemptedOwner: 'env',
      },
      {
        resourceType: 'metadata',
        resourceKey: 'tsconfig.json',
        existingOwner: 'core',
        attemptedOwner: 'auth',
      },
    ]);
  });

  test('register throws formatted ownership conflict errors', () => {
    const tracker = new OwnershipTracker();
    tracker.registerScript('build', 'core');

    expect(() => tracker.registerScript('build', 'auth')).toThrow(
      formatOwnershipConflict({
        resourceType: 'script',
        resourceKey: 'build',
        existingOwner: 'core',
        attemptedOwner: 'auth',
      })
    );
  });

  test('registerCapabilityOwnership applies all declared ownership fields', () => {
    const tracker = new OwnershipTracker();

    tracker.registerCapabilityOwnership({
      id: 'auth',
      version: '1.0.0',
      dependencies: [],
      files: ['middleware.ts'],
      ownedDependencies: ['next-auth'],
      ownedScripts: ['auth:setup'],
      ownedEnvVars: ['AUTH_SECRET'],
      ownedMetadata: ['auth.config'],
    });

    const snapshot = tracker.toSnapshot();

    expect(snapshot).toEqual({
      files: [{ filePath: 'middleware.ts', ownerCapabilityId: 'auth' }],
      dependencies: [{ name: 'next-auth', ownerCapabilityId: 'auth' }],
      scripts: [{ name: 'auth:setup', ownerCapabilityId: 'auth' }],
      envVars: [{ name: 'AUTH_SECRET', ownerCapabilityId: 'auth' }],
      metadata: [{ key: 'auth.config', ownerCapabilityId: 'auth' }],
    });
  });

  test('loads and exports ownership snapshots deterministically', () => {
    const tracker = new OwnershipTracker({
      snapshot: {
        files: [{ filePath: 'b.ts', ownerCapabilityId: 'beta' }],
        dependencies: [{ name: 'zod', ownerCapabilityId: 'auth' }],
        scripts: [{ name: 'build', ownerCapabilityId: 'core' }],
        envVars: [{ name: 'DATABASE_URL', ownerCapabilityId: 'env' }],
        metadata: [{ key: 'next.config', ownerCapabilityId: 'core' }],
      },
    });

    expect(tracker.toSnapshot()).toEqual({
      files: [{ filePath: 'b.ts', ownerCapabilityId: 'beta' }],
      dependencies: [{ name: 'zod', ownerCapabilityId: 'auth' }],
      scripts: [{ name: 'build', ownerCapabilityId: 'core' }],
      envVars: [{ name: 'DATABASE_URL', ownerCapabilityId: 'env' }],
      metadata: [{ key: 'next.config', ownerCapabilityId: 'core' }],
    });
  });
});
