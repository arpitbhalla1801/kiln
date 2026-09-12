import type { Capability, OwnershipRegistration } from '@kiln/core';
import type { TransformPipeline } from '@kiln/transform-engine';
import type { EnvCapabilityPlan } from '@kiln/env-capability';

export const AUTH_CAPABILITY_ID = 'auth';
export const NEXT_AUTH_PACKAGE = 'next-auth';
export const NEXT_AUTH_VERSION = '^5.0.0-beta.32';

export interface AuthFilePaths {
  authFile: string;
  middlewareFile: string;
  routeHandlerFile: string;
}

export interface AuthCapabilityPlanOptions {
  tracker?: import('@kiln/core').OwnershipTracker;
  envExamplePath?: string;
  envExampleExists?: boolean;
  sourceRoot?: string;
  authFileExists?: boolean;
  middlewareFileExists?: boolean;
  routeHandlerFileExists?: boolean;
  nextAuthInstalled?: boolean;
  providers?: string[];
}

export interface AuthCapabilityPlan {
  transforms: TransformPipeline;
  capability: Capability;
  ownershipRegistrations: OwnershipRegistration[];
  envPlan: EnvCapabilityPlan;
  paths: AuthFilePaths;
  providers: string[];
}
