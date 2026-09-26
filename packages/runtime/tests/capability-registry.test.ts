import { describe, expect, test } from 'bun:test';
import {
  CAPABILITY_REGISTRY,
  isSupportedCapabilityId,
  registerCapability,
  SUPPORTED_CAPABILITY_IDS,
} from '../src/capability-registry.js';

describe('capability registry', () => {
  test('lists env, auth, and db as supported', () => {
    expect(SUPPORTED_CAPABILITY_IDS).toEqual(expect.arrayContaining(['auth', 'db', 'env']));
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
    expect(isSupportedCapabilityId('registry-test-plugin')).toBe(false);

    registerCapability('registry-test-plugin', ['env']);

    expect(isSupportedCapabilityId('registry-test-plugin')).toBe(true);
    expect(CAPABILITY_REGISTRY['registry-test-plugin'].dependencies).toEqual(['env']);
    expect(SUPPORTED_CAPABILITY_IDS).toContain('registry-test-plugin');
  });

  test('registerCapability defaults to no dependencies', () => {
    registerCapability('fake-plugin-no-deps');

    expect(CAPABILITY_REGISTRY['fake-plugin-no-deps'].dependencies).toEqual([]);
  });

  test('registerCapability is idempotent for the supported-ids list', () => {
    const before = SUPPORTED_CAPABILITY_IDS.length;
    registerCapability('registry-test-plugin', ['env']);
    registerCapability('registry-test-plugin', ['env']);

    expect(SUPPORTED_CAPABILITY_IDS.length).toBe(before);
  });
});
