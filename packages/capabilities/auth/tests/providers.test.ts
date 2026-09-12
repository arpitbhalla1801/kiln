import { describe, expect, test } from 'bun:test';
import { AUTH_PROVIDERS, resolveProvider } from '../src/providers.js';
import { createAuthConfigContent } from '../src/templates.js';
import { buildAuthEnvVars } from '../src/capability.js';

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

describe('createAuthConfigContent', () => {
  test('defaults to an empty providers array', () => {
    const content = createAuthConfigContent();
    expect(content).toContain('providers: [],');
    expect(content).not.toContain('next-auth/providers');
  });

  test('emits real imports and a populated providers array for one provider', () => {
    const content = createAuthConfigContent(['github']);
    expect(content).toContain('import GitHub from "next-auth/providers/github";');
    expect(content).toContain('providers: [\n    GitHub,\n  ],');
  });

  test('emits imports and array entries for multiple providers in order', () => {
    const content = createAuthConfigContent(['github', 'google']);
    expect(content).toContain('import GitHub from "next-auth/providers/github";');
    expect(content).toContain('import Google from "next-auth/providers/google";');
    expect(content).toContain('providers: [\n    GitHub,\n    Google,\n  ],');
  });
});

describe('buildAuthEnvVars', () => {
  test('always includes AUTH_SECRET with no providers', () => {
    expect(buildAuthEnvVars([])).toEqual({
      AUTH_SECRET: { example: 'replace-me', required: true },
    });
  });

  test('adds id/secret env vars for oauth providers', () => {
    const envVars = buildAuthEnvVars(['github']);
    expect(Object.keys(envVars)).toEqual(['AUTH_SECRET', 'AUTH_GITHUB_ID', 'AUTH_GITHUB_SECRET']);
  });

  test('credentials provider contributes no extra env vars', () => {
    expect(buildAuthEnvVars(['credentials'])).toEqual({
      AUTH_SECRET: { example: 'replace-me', required: true },
    });
  });

  test('multiple providers union their env vars', () => {
    const envVars = buildAuthEnvVars(['github', 'google']);
    expect(Object.keys(envVars)).toEqual([
      'AUTH_SECRET',
      'AUTH_GITHUB_ID',
      'AUTH_GITHUB_SECRET',
      'AUTH_GOOGLE_ID',
      'AUTH_GOOGLE_SECRET',
    ]);
  });
});
