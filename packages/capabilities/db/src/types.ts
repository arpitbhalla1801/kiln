import type { Capability, OwnershipRegistration } from '@kiln/core';
import type { TransformPipeline } from '@kiln/transform-engine';
import type { EnvCapabilityPlan } from '@kiln/env-capability';

export const DB_CAPABILITY_ID = 'db';
export const PRISMA_CLIENT_PACKAGE = '@prisma/client';
export const PRISMA_CLI_PACKAGE = 'prisma';
export const PRISMA_VERSION = '^5.0.0';

export interface DbCapabilityPlanOptions {
  tracker?: import('@kiln/core').OwnershipTracker;
  envExamplePath?: string;
  envExampleExists?: boolean;
  envLocalExists?: boolean;
  gitignoreContent?: string | null;
  prismaInstalled?: boolean;
}

export interface DbCapabilityPlan {
  transforms: TransformPipeline;
  capability: Capability;
  ownershipRegistrations: OwnershipRegistration[];
  envPlan: EnvCapabilityPlan;
}
