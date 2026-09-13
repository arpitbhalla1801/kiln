export const name = '@kiln/runtime';

export {
  CapabilityRuntime,
  createCapabilityRuntime,
  type CapabilityRuntimeOptions,
} from './capability-runtime.js';
export { extractInstallDependencies, type InstallDependencies } from './install.js';
export {
  CAPABILITY_REGISTRY,
  SUPPORTED_CAPABILITY_IDS,
  isSupportedCapabilityId,
  type CapabilityRegistryEntry,
} from './capability-registry.js';
export type {
  KilnRuntimeContext,
  RuntimeExecutionResult,
  RuntimeOptions,
  SupportedCapabilityId,
} from './types.js';
