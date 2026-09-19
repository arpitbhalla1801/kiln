export const name = '@kiln/env-capability';

export { EnvCapability, buildTransforms, buildEnvRemovalTransforms } from './capability.js';
export {
  buildOwnershipRegistrations,
  toEnvVariableInputs,
  validateEnvOwnership,
  validateEnvVariableNames,
} from './validation.js';
export {
  ENV_CAPABILITY_ID,
  DEFAULT_ENV_EXAMPLE_PATH,
  DEFAULT_ENV_LOCAL_PATH,
  type EnvCapabilityPlan,
  type EnvCapabilityPlanOptions,
  type EnvVariableInput,
  type EnvVariableMap,
} from './types.js';
