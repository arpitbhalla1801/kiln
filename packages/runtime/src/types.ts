import type { LifecycleContext } from '@kiln/core';
import type { ProjectInspection } from '@kiln/node-adapter';
import type { CapabilityExecutionPlan } from '@kiln/planner';
import type { TransformPlan } from '@kiln/transform-engine';

export interface RuntimeOptions {
  dryRun?: boolean;
  cwd?: string;
  providers?: string[];
}

export interface RuntimeExecutionResult {
  capabilityId: string;
  dryRun: boolean;
  preview: TransformPlan;
  resolvedDependencies: Map<string, string>;
  inspection: ProjectInspection;
  capabilityPlan: CapabilityExecutionPlan;
}

export interface KilnRuntimeContext extends LifecycleContext {
  rootPath: string;
  dryRun: boolean;
  capabilityId: SupportedCapabilityId;
  inspection?: ProjectInspection;
  capabilityPlan?: CapabilityExecutionPlan;
  resolvedDependencies?: Map<string, string>;
  preview?: TransformPlan;
  dependenciesToInstall?: Record<string, string>;
}

export type SupportedCapabilityId = 'env' | 'auth';
