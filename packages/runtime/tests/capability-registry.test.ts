import { describe, expect, test } from 'bun:test';
import {
  CAPABILITY_REGISTRY,
  isSupportedCapabilityId,
  SUPPORTED_CAPABILITY_IDS,
} from '../src/capability-registry.js';

describe('capability registry', () => {
  test('lists env, auth, and db as supported', () => {
    expect(SUPPORTED_CAPABILITY_IDS.sort()).toEqual(['auth', 'db', 'env']);
  });

  test('auth declares env as a dependency', () => {
    expect(CAPABILITY_REGISTRY.auth.dependencies).toEqual(['env']);
  });

  test('db declares env as a dependency', () => {
    expect(CAPABILITY_REGISTRY.db.dependencies).toEqual(['env']);
  });

  test('env has no dependencies', () => {
    expect(CAPABILITY_REGISTRY.env.dependencies).toEqual([]);
  });

  test('isSupportedCapabilityId recognizes known ids and rejects unknown ones', () => {
    expect(isSupportedCapabilityId('env')).toBe(true);
    expect(isSupportedCapabilityId('auth')).toBe(true);
    expect(isSupportedCapabilityId('db')).toBe(true);
    expect(isSupportedCapabilityId('payments')).toBe(false);
  });
});
