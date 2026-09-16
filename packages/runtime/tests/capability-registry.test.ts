import { describe, expect, test } from 'bun:test';
import {
  CAPABILITY_REGISTRY,
  isSupportedCapabilityId,
  registerCapability,
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

  test('registerCapability adds a new entry the same way built-ins are seeded', () => {
    expect(isSupportedCapabilityId('fake-plugin')).toBe(false);

    registerCapability('fake-plugin', ['env']);

    expect(isSupportedCapabilityId('fake-plugin')).toBe(true);
    expect(CAPABILITY_REGISTRY['fake-plugin'].dependencies).toEqual(['env']);
    expect(SUPPORTED_CAPABILITY_IDS).toContain('fake-plugin');
  });

  test('registerCapability defaults to no dependencies', () => {
    registerCapability('fake-plugin-no-deps');

    expect(CAPABILITY_REGISTRY['fake-plugin-no-deps'].dependencies).toEqual([]);
  });

  test('registerCapability is idempotent for the supported-ids list', () => {
    const before = SUPPORTED_CAPABILITY_IDS.length;
    registerCapability('fake-plugin', ['env']);
    registerCapability('fake-plugin', ['env']);

    expect(SUPPORTED_CAPABILITY_IDS.length).toBe(before);
  });
});
