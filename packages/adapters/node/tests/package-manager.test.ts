import { describe, expect, test } from 'bun:test';
import { buildAddArgs } from '../src/package-manager/bun.js';

describe('buildAddArgs', () => {
  test('bun: add with version pins, no dev flag', () => {
    expect(buildAddArgs('bun', { react: '^18.0.0' })).toEqual(['add', 'react@^18.0.0']);
  });

  test('bun: dev dependency', () => {
    expect(buildAddArgs('bun', { vitest: '' }, { dev: true })).toEqual([
      'add',
      '--dev',
      'vitest',
    ]);
  });

  test('npm: uses install, not add', () => {
    expect(buildAddArgs('npm', { react: '^18.0.0' })).toEqual(['install', 'react@^18.0.0']);
  });

  test('npm: dev dependency uses --save-dev', () => {
    expect(buildAddArgs('npm', { vitest: '' }, { dev: true })).toEqual([
      'install',
      '--save-dev',
      'vitest',
    ]);
  });

  test('pnpm: uses add with --save-dev for dev', () => {
    expect(buildAddArgs('pnpm', { vitest: '' }, { dev: true })).toEqual([
      'add',
      '--save-dev',
      'vitest',
    ]);
  });

  test('yarn: uses add with --dev for dev', () => {
    expect(buildAddArgs('yarn', { vitest: '' }, { dev: true })).toEqual([
      'add',
      '--dev',
      'vitest',
    ]);
  });

  test('multiple dependencies preserve insertion order', () => {
    expect(buildAddArgs('npm', { react: '^18.0.0', 'react-dom': '^18.0.0' })).toEqual([
      'install',
      'react@^18.0.0',
      'react-dom@^18.0.0',
    ]);
  });
});
