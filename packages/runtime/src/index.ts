export const name = '@kiln/runtime';

export {
  CapabilityRuntime,
  createCapabilityRuntime,
  type CapabilityRuntimeOptions,
} from './capability-runtime.js';
export { extractInstallDependencies } from './install.js';
export type {
  KilnRuntimeContext,
  RuntimeExecutionResult,
  RuntimeOptions,
  SupportedCapabilityId,
} from './types.js';
