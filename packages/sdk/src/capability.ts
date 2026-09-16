import type { CapabilityManifest, ResolvedCapability } from './manifest.js';
import type { CapabilityPlan, CapabilityPlanOptions } from './plan.js';

/**
 * The minimal stable contract a kiln capability implements -- built-in or
 * third-party plugin alike.
 *
 * Deliberately does not include a `registerOwnership` method. All three
 * first-party capabilities (env, auth, db) have one today, but it's dead
 * code in the real execution path: the planner only ever consumes
 * `plan.ownershipRegistrations` and `plan.capability` (see
 * packages/planner/src/plan-executor.ts), never a capability's own
 * `registerOwnership`. It exists only as test-setup convenience in the
 * first-party packages, and its signature genuinely diverges across all
 * three (different second-argument shapes) -- dropping it from the
 * formal interface avoids forcing a fourth divergent signature to
 * standardize, for a method nothing in production actually calls.
 */
export interface Capability {
  readonly id: string;
  getManifest(): Promise<CapabilityManifest>;
  getCapability(): Promise<ResolvedCapability>;
  planAdd(rootPath: string, options: CapabilityPlanOptions): Promise<CapabilityPlan>;
}
