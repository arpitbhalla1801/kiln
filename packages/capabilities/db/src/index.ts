export const name = '@kiln/db-capability';

export { DbCapability, buildDbFilePaths, buildDbTransforms } from './capability.js';
export { buildDbOwnershipRegistrations, validateDbOwnership } from './validation.js';
export {
  createDbClientContent,
  createSchemaPrismaContent,
} from './templates.js';
export {
  DB_CAPABILITY_ID,
  PRISMA_CLIENT_PACKAGE,
  PRISMA_CLI_PACKAGE,
  PRISMA_VERSION,
  type DbCapabilityPlan,
  type DbCapabilityPlanOptions,
  type DbFilePaths,
} from './types.js';
