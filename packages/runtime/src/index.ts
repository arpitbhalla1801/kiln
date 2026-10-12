export const name = '@kiln-cli/runtime';

export {
  capabilityLinks,
  CapabilityRuntime,
  createCapabilityRuntime,
  type CapabilityDescription,
  type CapabilityRuntimeOptions,
} from './capability-runtime.js';
export {
  isVerifiedPlugin,
  manifestSha256,
  VERIFIED_PLUGINS,
  type VerifiedPlugin,
} from './plugin-verification.js';
export { extractInstallDependencies, type InstallDependencies } from './install.js';
export {
  checkPluginPin,
  checkPluginPins,
  loadPlugin,
  loadPlugins,
  type PluginLoadResult,
  type PluginPinCheck,
} from './plugin-loader.js';
export {
  CAPABILITY_REGISTRY,
  SUPPORTED_CAPABILITY_IDS,
  isSupportedCapabilityId,
  registerCapability,
  type CapabilityRegistryEntry,
} from './capability-registry.js';
export type {
  CapabilityPlanResult,
  KilnRuntimeContext,
  RuntimeExecutionResult,
  RuntimeOptions,
  SupportedCapabilityId,
} from './types.js';
