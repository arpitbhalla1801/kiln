import { describe, expect, test } from 'bun:test';
import { validatePackageJson } from '../src/validation/package-json.js';

describe('validatePackageJson', () => {
  test('passes for a healthy Next.js kiln project', () => {
    const result = validatePackageJson(
      {
        name: 'demo-app',
        scripts: { dev: 'next dev', build: 'next build' },
        dependencies: { next: '^15.0.0', react: '^19.0.0' },
      },
      { expectsNextJs: true }
    );

    expect(result).toEqual({ status: 'pass', detail: 'valid' });
  });

  test('fails when Next.js project is missing required scripts and dependencies', () => {
    const result = validatePackageJson(
      {
        dependencies: { 'next-auth': '^5.0.0-beta.32' },
      },
      { expectsNextJs: true }
    );

    expect(result.status).toBe('fail');
    expect(result.detail).toContain('missing project name');
    expect(result.detail).toContain('missing scripts.dev');
    expect(result.detail).toContain('missing scripts.build');
    expect(result.detail).toContain('missing dependencies.next');
    expect(result.detail).toContain('missing dependencies.react');
  });

  test('only requires project name for non-Next.js projects', () => {
    const result = validatePackageJson(
      {
        name: 'library',
        version: '1.0.0',
      },
      { expectsNextJs: false }
    );

    expect(result).toEqual({ status: 'pass', detail: 'valid' });
  });
});
