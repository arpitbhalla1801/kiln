import { describe, expect, test } from 'bun:test';
import {
  DependencyVersionRegistry,
  reconcileVersionClaims,
  selectPreferredVersion,
  type DependencyVersionClaim,
} from '../src/dependency-reconciliation.js';

describe('dependency version reconciliation', () => {
  test('reconciles repeated claims from the same capability', () => {
    const claims: DependencyVersionClaim[] = [
      { name: 'next-auth', version: '^5.0.0', ownerCapabilityId: 'auth' },
      { name: 'next-auth', version: '^5.1.0', ownerCapabilityId: 'auth' },
    ];

    expect(reconcileVersionClaims(claims)).toBe('^5.1.0');
  });

  test('selectPreferredVersion prefers higher semver core', () => {
    expect(selectPreferredVersion('^5.0.0', '^5.1.0')).toBe('^5.1.0');
    expect(selectPreferredVersion('^5.1.0', '^5.0.0')).toBe('^5.1.0');
  });

  test('detects cross-capability dependency version conflicts', () => {
    const registry = new DependencyVersionRegistry();
    registry.addClaim({ name: 'zod', version: '^3.0.0', ownerCapabilityId: 'auth' });
    registry.addClaim({ name: 'zod', version: '^3.1.0', ownerCapabilityId: 'env' });

    const conflicts = registry.detectConflicts();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].name).toBe('zod');
    expect(() => registry.reconcile()).toThrow(/Dependency version conflict/);
  });

  test('reconcile returns deterministic version map', () => {
    const registry = new DependencyVersionRegistry();
    registry.addClaims([
      { name: 'next-auth', version: '^5.0.0', ownerCapabilityId: 'auth' },
      { name: 'zod', version: '^3.22.0', ownerCapabilityId: 'auth' },
    ]);

    const resolved = registry.reconcile();
    expect(resolved.get('next-auth')).toBe('^5.0.0');
    expect(resolved.get('zod')).toBe('^3.22.0');
  });
});
