import { describe, expect, test } from 'bun:test';
import { resolveTypedTransform } from '../src/transform-resolver.js';
import type { Transform } from '@kiln/core';

describe('resolveTypedTransform', () => {
  test('resolves manifest-style env mutation transforms', () => {
    const transform: Transform = {
      id: 'env-example',
      type: 'env-mutation',
      target: '.env.example',
      payload: {
        variables: {
          AUTH_SECRET: { example: 'replace-me', required: true },
        },
      },
    };

    const typed = resolveTypedTransform(transform);

    expect(typed.type).toBe('env-mutation');
    if (typed.type === 'env-mutation') {
      expect(typed.filePath).toBe('.env.example');
      expect(typed.variables.AUTH_SECRET).toEqual({
        example: 'replace-me',
        required: true,
      });
    }
  });

  test('resolves package-json mutation payload', () => {
    const transform: Transform = {
      id: 'auth-install',
      type: 'package-json-mutation',
      payload: {
        dependencies: { 'next-auth': '^5.0.0' },
      },
    };

    const typed = resolveTypedTransform(transform);

    expect(typed.type).toBe('package-json-mutation');
    if (typed.type === 'package-json-mutation') {
      expect(typed.dependencies).toEqual({ 'next-auth': '^5.0.0' });
    }
  });
});
