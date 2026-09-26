import type { LifecycleContext } from '@kiln/core';
import type { EnvVariableMap } from '@kiln/env-capability';
import type { ProjectInspection } from '@kiln/node-adapter';
import type { CapabilityExecutionPlan } from '@kiln/planner';
import type { TransformPlan } from '@kiln/transform-engine';
import type { InstallDependencies } from './install.js';

export interface RuntimeOptions {
  dryRun?: boolean;
  cwd?: string;
  providers?: string[];
  extraEnvVars?: EnvVariableMap;
}

export interface RuntimeExecutionResult {
  capabilityId: string;
  dryRun: boolean;
  preview: TransformPlan;
  resolvedDependencies: Map<string, string>;
  inspection: ProjectInspection;
  capabilityPlan: CapabilityExecutionPlan;
  /** Owned files kiln left alone because the user edited them since kiln wrote them. */
  warnings: string[];
}

export interface KilnRuntimeContext extends LifecycleContext {
  warnings?: string[];
  rootPath: string;
  dryRun: boolean;
  capabilityId: SupportedCapabilityId;
  inspection?: ProjectInspection;
  capabilityPlan?: CapabilityExecutionPlan;
  resolvedDependencies?: Map<string, string>;
  preview?: TransformPlan;
  dependenciesToInstall?: InstallDependencies;
}

export type SupportedCapabilityId = string;
