import {
  formatOwnershipConflict,
  OwnershipRegistration,
  OwnershipTracker,
} from '@kiln/core';
import { DB_CAPABILITY_ID, PRISMA_CLIENT_PACKAGE, PRISMA_CLI_PACKAGE } from './types.js';

export function buildDbOwnershipRegistrations(
  ownerCapabilityId = DB_CAPABILITY_ID
): OwnershipRegistration[] {
  return [
    { resourceType: 'dependency', resourceKey: PRISMA_CLIENT_PACKAGE, ownerCapabilityId },
    { resourceType: 'dependency', resourceKey: PRISMA_CLI_PACKAGE, ownerCapabilityId },
  ];
}

export function validateDbOwnership(
  tracker: OwnershipTracker,
  ownerCapabilityId = DB_CAPABILITY_ID
): void {
  const registrations = buildDbOwnershipRegistrations(ownerCapabilityId);
  const conflicts = tracker.detectConflicts(registrations);

  if (conflicts.length > 0) {
    throw new Error(formatOwnershipConflict(conflicts[0]));
  }
}
