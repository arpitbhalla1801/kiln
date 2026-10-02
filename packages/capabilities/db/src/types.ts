import type { Capability, OwnershipRegistration } from '@kiln-cli/core';
import type { TransformPipeline } from '@kiln-cli/transform-engine';
import type { EnvCapabilityPlan } from '@kiln-cli/env-capability';

export const DB_CAPABILITY_ID = 'db';
export const PRISMA_CLIENT_PACKAGE = '@prisma/client';
export const PRISMA_CLI_PACKAGE = 'prisma';
export const PRISMA_VERSION = '^5.0.0';

export const DB_SCRIPTS: Record<string, string> = {
  'db:generate': 'prisma generate',
  'db:migrate': 'prisma migrate dev',
  'db:studio': 'prisma studio',
};

export interface DbFilePaths {
  schemaFile: string;
  clientFile: string;
}

export interface DbCapabilityPlanOptions {
  tracker?: import('@kiln-cli/core').OwnershipTracker;
  envExamplePath?: string;
  envExampleExists?: boolean;
  envLocalExists?: boolean;
  gitignoreContent?: string | null;
  prismaInstalled?: boolean;
  clientInstalled?: boolean;
  clientVersion?: string;
  existingScripts?: Record<string, string>;
  sourceRoot?: string;
  schemaFileExists?: boolean;
  clientFileExists?: boolean;
  /** Whether next-auth is already a dependency; picks the Auth.js-compatible schema. */
  authPresent?: boolean;
  schemaFileContent?: string;
}

export interface DbCapabilityPlan {
  transforms: TransformPipeline;
  capability: Capability;
  ownershipRegistrations: OwnershipRegistration[];
  envPlan: EnvCapabilityPlan;
  paths: DbFilePaths;
}
