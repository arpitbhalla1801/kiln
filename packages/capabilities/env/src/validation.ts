import {
  formatOwnershipConflict,
  OwnershipRegistration,
  OwnershipTracker,
} from '@kiln/core';
import { ENV_CAPABILITY_ID } from './types.js';
import type { EnvVariableInput } from './types.js';

const ENV_VAR_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/;

export function validateEnvVariableNames(variables: EnvVariableInput[]): void {
  for (const variable of variables) {
    if (!ENV_VAR_NAME_PATTERN.test(variable.name)) {
      throw new Error(`Invalid environment variable name: ${variable.name}`);
    }
  }
}

export function buildOwnershipRegistrations(
  variables: EnvVariableInput[],
  envExamplePath: string,
  ownerCapabilityId: string,
  claimFile = true
): OwnershipRegistration[] {
  // .env.example is a shared baseline file that every env/auth/db-style capability
  // writes variables into -- ownership of the FILE stays with 'env' regardless of
  // which capability happens to create it first, so a later capability's own
  // variables aren't blocked by a conflict against the caller that created it.
  const registrations: OwnershipRegistration[] = claimFile
    ? [{ resourceType: 'file', resourceKey: envExamplePath, ownerCapabilityId: ENV_CAPABILITY_ID }]
    : [];

  for (const variable of variables) {
    registrations.push({
      resourceType: 'envVar',
      resourceKey: variable.name,
      ownerCapabilityId,
    });
  }

  return registrations;
}

export function validateEnvOwnership(
  variables: EnvVariableInput[],
  tracker: OwnershipTracker,
  ownerCapabilityId: string,
  envExamplePath: string
): void {
  const registrations = buildOwnershipRegistrations(variables, envExamplePath, ownerCapabilityId);
  const conflicts = tracker.detectConflicts(registrations);

  if (conflicts.length > 0) {
    throw new Error(formatOwnershipConflict(conflicts[0]));
  }
}

export function toEnvVariableInputs(variables: Record<string, string | { value?: string; example?: string; required?: boolean }>): EnvVariableInput[] {
  return Object.entries(variables).map(([name, definition]) => {
    if (typeof definition === 'string') {
      return { name, example: definition };
    }

    return {
      name,
      value: definition.value,
      example: definition.example,
      required: definition.required,
    };
  });
}
