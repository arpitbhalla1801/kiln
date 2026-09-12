export const name = '@kiln/auth-capability';

export {
  AuthCapability,
  buildAuthFilePaths,
  buildAuthTransforms,
} from './capability.js';
export {
  buildAuthOwnershipRegistrations,
  validateAuthOwnership,
} from './validation.js';
export {
  createAuthConfigContent,
  createMiddlewareContent,
  resolveAuthImportPath,
} from './templates.js';
export {
  AUTH_CAPABILITY_ID,
  NEXT_AUTH_PACKAGE,
  NEXT_AUTH_VERSION,
  type AuthCapabilityPlan,
  type AuthCapabilityPlanOptions,
  type AuthFilePaths,
} from './types.js';
export {
  AUTH_PROVIDERS,
  resolveProvider,
  type AuthProviderDescriptor,
} from './providers.js';
