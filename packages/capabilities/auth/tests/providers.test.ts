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
  test('generates a real random AUTH_SECRET value by default', () => {
    const envVars = buildAuthEnvVars([]);
    expect(Object.keys(envVars)).toEqual(['AUTH_SECRET']);
    const secret = envVars.AUTH_SECRET;
    expect(typeof secret).toBe('object');
    expect((secret as { value?: string }).value).toMatch(/^[A-Za-z0-9+/=]{20,}$/);
    expect((secret as { example?: string }).example).toBeUndefined();
  });

  test('two calls generate different secrets', () => {
    const first = buildAuthEnvVars([]).AUTH_SECRET as { value?: string };
    const second = buildAuthEnvVars([]).AUTH_SECRET as { value?: string };
    expect(first.value).not.toBe(second.value);
  });

  test('omits AUTH_SECRET entirely when generateSecret is false, to avoid overwriting an existing one', () => {
    expect(buildAuthEnvVars([], false)).toEqual({});
  });

  test('adds id/secret env vars for oauth providers alongside AUTH_SECRET', () => {
    const envVars = buildAuthEnvVars(['github']);
    expect(Object.keys(envVars)).toEqual(['AUTH_SECRET', 'AUTH_GITHUB_ID', 'AUTH_GITHUB_SECRET']);
  });

  test('credentials provider contributes no extra env vars', () => {
    expect(Object.keys(buildAuthEnvVars(['credentials']))).toEqual(['AUTH_SECRET']);
  });

  test('multiple providers union their env vars, unaffected by generateSecret', () => {
    const envVars = buildAuthEnvVars(['github', 'google'], false);
    expect(Object.keys(envVars)).toEqual([
      'AUTH_GITHUB_ID',
      'AUTH_GITHUB_SECRET',
      'AUTH_GOOGLE_ID',
      'AUTH_GOOGLE_SECRET',
    ]);
  });
});
