import {
  formatOwnershipConflict,
  OwnershipRegistration,
  OwnershipTracker,
} from '@kiln/core';
import {
  AUTH_CAPABILITY_ID,
  NEXT_AUTH_PACKAGE,
  type AuthFilePaths,
} from './types.js';

export function buildAuthOwnershipRegistrations(
  paths: AuthFilePaths,
  ownerCapabilityId = AUTH_CAPABILITY_ID,
  providers: string[] = [],
  claimDependency = true
): OwnershipRegistration[] {
  const activePaths: Record<string, string> = { ...paths };
  if (providers.length === 0) {
    delete activePaths.routeHandlerFile;
  }

  const fileRegistrations: OwnershipRegistration[] = Object.values(activePaths).map((filePath) => ({
    resourceType: 'file',
    resourceKey: filePath,
    ownerCapabilityId,
  }));

  return [
    ...fileRegistrations,
    ...(claimDependency
      ? [
          {
            resourceType: 'dependency' as const,
            resourceKey: NEXT_AUTH_PACKAGE,
            ownerCapabilityId,
          },
        ]
      : []),
  ];
}

export function validateAuthOwnership(
  paths: AuthFilePaths,
  tracker: OwnershipTracker,
  ownerCapabilityId = AUTH_CAPABILITY_ID,
  providers: string[] = []
): void {
  const registrations = buildAuthOwnershipRegistrations(paths, ownerCapabilityId, providers);
  const conflicts = tracker.detectConflicts(registrations);

  if (conflicts.length > 0) {
    throw new Error(formatOwnershipConflict(conflicts[0]));
  }
}
