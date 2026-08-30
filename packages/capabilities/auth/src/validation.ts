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
  ownerCapabilityId = AUTH_CAPABILITY_ID
): OwnershipRegistration[] {
  return [
    {
      resourceType: 'file',
      resourceKey: paths.authFile,
      ownerCapabilityId,
    },
    {
      resourceType: 'file',
      resourceKey: paths.middlewareFile,
      ownerCapabilityId,
    },
    {
      resourceType: 'dependency',
      resourceKey: NEXT_AUTH_PACKAGE,
      ownerCapabilityId,
    },
  ];
}

export function validateAuthOwnership(
  paths: AuthFilePaths,
  tracker: OwnershipTracker,
  ownerCapabilityId = AUTH_CAPABILITY_ID
): void {
  const registrations = buildAuthOwnershipRegistrations(paths, ownerCapabilityId);
  const conflicts = tracker.detectConflicts(registrations);

  if (conflicts.length > 0) {
    throw new Error(formatOwnershipConflict(conflicts[0]));
  }
}
