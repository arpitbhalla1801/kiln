import { describe, expect, test } from 'bun:test';
import { OwnershipTracker } from '../src/ownership.js';

/**
 * Adversarial coverage for SECURITY.md's third-party plugin scope: a
 * malicious or buggy plugin capability must not be able to silently take
 * over a resource a built-in (or another plugin) already owns. This is
 * enforced structurally by OwnershipTracker, the same mechanism that
 * already protects built-ins from each other -- a plugin gets no special
 * treatment and no special exemption.
 */
describe('OwnershipTracker rejects a plugin hijacking another capability\'s resources', () => {
  test('a plugin cannot silently claim a file already owned by a built-in', () => {
    const tracker = new OwnershipTracker();
    tracker.registerFile('auth.ts', 'auth');

    expect(() => tracker.registerFile('auth.ts', 'malicious-plugin')).toThrow(
      /auth\.ts.*already owned by 'auth'/
    );

    expect(tracker.getOwner('file', 'auth.ts')).toBe('auth');
  });

  test('a plugin cannot silently claim a dependency already owned by a built-in', () => {
    const tracker = new OwnershipTracker();
    tracker.registerDependency('next-auth', 'auth');

    expect(() => tracker.registerDependency('next-auth', 'malicious-plugin')).toThrow();
    expect(tracker.getOwner('dependency', 'next-auth')).toBe('auth');
  });

  test('a plugin cannot silently claim a script already owned by a built-in', () => {
    const tracker = new OwnershipTracker();
    tracker.registerScript('db:migrate', 'db');

    expect(() => tracker.registerScript('db:migrate', 'malicious-plugin')).toThrow();
    expect(tracker.getOwner('script', 'db:migrate')).toBe('db');
  });

  test('detectConflicts flags a plugin registration set that overlaps a built-in, without mutating state', () => {
    const tracker = new OwnershipTracker();
    tracker.registerFile('.env.example', 'env');

    const conflicts = tracker.detectConflicts([
      { resourceType: 'file', resourceKey: '.env.example', ownerCapabilityId: 'malicious-plugin' },
    ]);

    expect(conflicts).toEqual([
      {
        resourceType: 'file',
        resourceKey: '.env.example',
        existingOwner: 'env',
        attemptedOwner: 'malicious-plugin',
      },
    ]);
    expect(tracker.getOwner('file', '.env.example')).toBe('env');
  });

  test('a plugin re-registering its own prior claim is not treated as a conflict', () => {
    const tracker = new OwnershipTracker();
    tracker.registerFile('stripe-webhook.ts', 'stripe-plugin');

    expect(() => tracker.registerFile('stripe-webhook.ts', 'stripe-plugin')).not.toThrow();
    expect(tracker.getOwner('file', 'stripe-webhook.ts')).toBe('stripe-plugin');
  });
});
