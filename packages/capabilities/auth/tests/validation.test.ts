import { describe, expect, test } from 'bun:test';
import { buildAuthOwnershipRegistrations } from '../src/validation.js';
import type { AuthFilePaths } from '../src/types.js';

describe('buildAuthOwnershipRegistrations', () => {
  test('registers every path field plus the next-auth dependency', () => {
    const paths: AuthFilePaths = {
      authFile: 'src/auth.ts',
      middlewareFile: 'src/middleware.ts',
      routeHandlerFile: 'src/app/api/auth/[...nextauth]/route.ts',
    };

    const registrations = buildAuthOwnershipRegistrations(paths, 'auth', ['github']);

    expect(registrations).toEqual([
      { resourceType: 'file', resourceKey: 'src/auth.ts', ownerCapabilityId: 'auth' },
      { resourceType: 'file', resourceKey: 'src/middleware.ts', ownerCapabilityId: 'auth' },
      {
        resourceType: 'file',
        resourceKey: 'src/app/api/auth/[...nextauth]/route.ts',
        ownerCapabilityId: 'auth',
      },
      { resourceType: 'dependency', resourceKey: 'next-auth', ownerCapabilityId: 'auth' },
    ]);
  });

  test('picks up an extra path field without code changes', () => {
    const paths = {
      authFile: 'src/auth.ts',
      middlewareFile: 'src/middleware.ts',
      someFutureFile: 'src/future.ts',
    } as unknown as AuthFilePaths;

    const registrations = buildAuthOwnershipRegistrations(paths, 'auth');
    const fileKeys = registrations
      .filter((registration) => registration.resourceType === 'file')
      .map((registration) => registration.resourceKey);

    expect(fileKeys).toEqual(['src/auth.ts', 'src/middleware.ts', 'src/future.ts']);
  });

  test('excludes routeHandlerFile when no providers are selected', () => {
    const paths: AuthFilePaths = {
      authFile: 'src/auth.ts',
      middlewareFile: 'src/middleware.ts',
      routeHandlerFile: 'src/app/api/auth/[...nextauth]/route.ts',
    };

    const withoutProviders = buildAuthOwnershipRegistrations(paths, 'auth', []);
    const fileKeysWithoutProviders = withoutProviders
      .filter((registration) => registration.resourceType === 'file')
      .map((registration) => registration.resourceKey);
    expect(fileKeysWithoutProviders).toEqual(['src/auth.ts', 'src/middleware.ts']);

    const withProviders = buildAuthOwnershipRegistrations(paths, 'auth', ['github']);
    const fileKeysWithProviders = withProviders
      .filter((registration) => registration.resourceType === 'file')
      .map((registration) => registration.resourceKey);
    expect(fileKeysWithProviders).toEqual([
      'src/auth.ts',
      'src/middleware.ts',
      'src/app/api/auth/[...nextauth]/route.ts',
    ]);
  });
});
