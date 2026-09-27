export const name = '@kiln/auth-capability';

export {
  AuthCapability,
  buildAuthEnvVars,
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
  createRouteHandlerContent,
  resolveAuthImportPath,
  type AuthAdapterOptions,
} from './templates.js';
export {
  AUTH_CAPABILITY_ID,
  AUTH_PRISMA_ADAPTER_PACKAGE,
  AUTH_PRISMA_ADAPTER_VERSION,
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
