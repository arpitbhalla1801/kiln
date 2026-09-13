import {
  formatOwnershipConflict,
  OwnershipRegistration,
  OwnershipTracker,
} from '@kiln/core';
import {
  DB_CAPABILITY_ID,
  DB_SCRIPTS,
  PRISMA_CLIENT_PACKAGE,
  PRISMA_CLI_PACKAGE,
  type DbFilePaths,
} from './types.js';

export function buildDbOwnershipRegistrations(
  paths: DbFilePaths,
  ownerCapabilityId = DB_CAPABILITY_ID
): OwnershipRegistration[] {
  const fileRegistrations: OwnershipRegistration[] = Object.values(paths).map((filePath) => ({
    resourceType: 'file',
    resourceKey: filePath,
    ownerCapabilityId,
  }));

  const scriptRegistrations: OwnershipRegistration[] = Object.keys(DB_SCRIPTS).map(
    (scriptName) => ({
      resourceType: 'script',
      resourceKey: scriptName,
      ownerCapabilityId,
    })
  );

  return [
    ...fileRegistrations,
    { resourceType: 'dependency', resourceKey: PRISMA_CLIENT_PACKAGE, ownerCapabilityId },
    { resourceType: 'dependency', resourceKey: PRISMA_CLI_PACKAGE, ownerCapabilityId },
    ...scriptRegistrations,
  ];
}

export function validateDbOwnership(
  paths: DbFilePaths,
  tracker: OwnershipTracker,
  ownerCapabilityId = DB_CAPABILITY_ID
): void {
  const registrations = buildDbOwnershipRegistrations(paths, ownerCapabilityId);
  const conflicts = tracker.detectConflicts(registrations);

  if (conflicts.length > 0) {
    throw new Error(formatOwnershipConflict(conflicts[0]));
  }
}
