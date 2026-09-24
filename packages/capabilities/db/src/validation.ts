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

export interface DbClaims {
  dependencies: string[];
  scripts: string[];
}

const ALL_DB_CLAIMS: DbClaims = {
  dependencies: [PRISMA_CLIENT_PACKAGE, PRISMA_CLI_PACKAGE],
  scripts: Object.keys(DB_SCRIPTS),
};

export function buildDbOwnershipRegistrations(
  paths: DbFilePaths,
  ownerCapabilityId = DB_CAPABILITY_ID,
  claims: DbClaims = ALL_DB_CLAIMS
): OwnershipRegistration[] {
  const fileRegistrations: OwnershipRegistration[] = Object.values(paths).map((filePath) => ({
    resourceType: 'file',
    resourceKey: filePath,
    ownerCapabilityId,
  }));

  return [
    ...fileRegistrations,
    ...claims.dependencies.map(
      (name): OwnershipRegistration => ({
        resourceType: 'dependency',
        resourceKey: name,
        ownerCapabilityId,
      })
    ),
    ...claims.scripts.map(
      (name): OwnershipRegistration => ({
        resourceType: 'script',
        resourceKey: name,
        ownerCapabilityId,
      })
    ),
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
