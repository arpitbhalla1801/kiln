import type { EnvVariableDefinition } from '@kiln/transform-engine';

export const ENV_CAPABILITY_ID = 'env';
export const DEFAULT_ENV_EXAMPLE_PATH = '.env.example';

export interface EnvVariableInput {
  name: string;
  value?: string;
  example?: string;
  required?: boolean;
}

export interface EnvCapabilityPlanOptions {
  tracker?: import('@kiln/core').OwnershipTracker;
  envExamplePath?: string;
  envExampleExists?: boolean;
}

export interface EnvCapabilityPlan {
  transforms: import('@kiln/transform-engine').TransformPipeline;
  capability: import('@kiln/core').Capability;
  ownershipRegistrations: import('@kiln/core').OwnershipRegistration[];
}

export type EnvVariableMap = Record<string, string | EnvVariableDefinition>;
