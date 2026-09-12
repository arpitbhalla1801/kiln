import { describe, expect, test } from 'bun:test';
import { buildAuthOwnershipRegistrations } from '../src/validation.js';
import type { AuthFilePaths } from '../src/types.js';

describe('buildAuthOwnershipRegistrations', () => {
  test('registers every path field plus the next-auth dependency', () => {
    const paths: AuthFilePaths = {
      authFile: 'src/auth.ts',
      middlewareFile: 'src/middleware.ts',
    };

    const registrations = buildAuthOwnershipRegistrations(paths, 'auth');

    expect(registrations).toEqual([
      { resourceType: 'file', resourceKey: 'src/auth.ts', ownerCapabilityId: 'auth' },
      { resourceType: 'file', resourceKey: 'src/middleware.ts', ownerCapabilityId: 'auth' },
      { resourceType: 'dependency', resourceKey: 'next-auth', ownerCapabilityId: 'auth' },
    ]);
  });

  test('picks up an extra path field without code changes', () => {
    const paths = {
      authFile: 'src/auth.ts',
      middlewareFile: 'src/middleware.ts',
      routeHandlerFile: 'src/app/api/auth/[...nextauth]/route.ts',
    } as AuthFilePaths;

    const registrations = buildAuthOwnershipRegistrations(paths, 'auth');
    const fileKeys = registrations
      .filter((registration) => registration.resourceType === 'file')
      .map((registration) => registration.resourceKey);

    expect(fileKeys).toEqual([
      'src/auth.ts',
      'src/middleware.ts',
      'src/app/api/auth/[...nextauth]/route.ts',
    ]);
  });
});
