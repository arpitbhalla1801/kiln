import {
  formatOwnershipConflict,
  OwnershipRegistration,
  OwnershipTracker,
} from '@kiln/core';
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
  ownerCapabilityId: string
): OwnershipRegistration[] {
  const registrations: OwnershipRegistration[] = [
    {
      resourceType: 'file',
      resourceKey: envExamplePath,
      ownerCapabilityId,
    },
  ];

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
  ownerCapabilityId: string
): void {
  const registrations = buildOwnershipRegistrations(variables, '.env.example', ownerCapabilityId);
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
