import { describe, expect, test } from 'bun:test';
import { AUTH_PROVIDERS, resolveProvider } from '../src/providers.js';

describe('auth provider registry', () => {
  test('resolves known providers', () => {
    expect(resolveProvider('github')).toBe(AUTH_PROVIDERS.github);
    expect(resolveProvider('google')).toBe(AUTH_PROVIDERS.google);
    expect(resolveProvider('credentials')).toBe(AUTH_PROVIDERS.credentials);
  });

  test('rejects unknown providers listing valid ids', () => {
    expect(() => resolveProvider('discord')).toThrow(/Unknown auth provider 'discord'/);
    expect(() => resolveProvider('discord')).toThrow(/github, google, credentials/);
  });

  test('credentials provider declares no env vars', () => {
    expect(AUTH_PROVIDERS.credentials.envVars).toEqual([]);
  });

  test('oauth providers declare id/secret env vars', () => {
    expect(AUTH_PROVIDERS.github.envVars).toEqual(['AUTH_GITHUB_ID', 'AUTH_GITHUB_SECRET']);
    expect(AUTH_PROVIDERS.google.envVars).toEqual(['AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET']);
  });
});
