import type { OwnershipRegistration } from '@kiln-cli/capability-sdk';
import { LOGGING_CAPABILITY_ID, LOGGING_DEPENDENCIES, LOGGING_ENV_VARS } from './types.js';

// What `kiln remove logging` takes back. Only files this capability created
// (or already owns) are claimed, so a user's own instrumentation.ts is never
// deleted on remove.
export function buildLoggingOwnershipRegistrations(files: string[]): OwnershipRegistration[] {
  const owner = LOGGING_CAPABILITY_ID;
  return [
    ...files.map((resourceKey) => ({
      resourceType: 'file' as const,
      resourceKey,
      ownerCapabilityId: owner,
    })),
    ...Object.keys(LOGGING_DEPENDENCIES).map((resourceKey) => ({
      resourceType: 'dependency' as const,
      resourceKey,
      ownerCapabilityId: owner,
    })),
    ...LOGGING_ENV_VARS.map((resourceKey) => ({
      resourceType: 'envVar' as const,
      resourceKey,
      ownerCapabilityId: owner,
    })),
  ];
}
