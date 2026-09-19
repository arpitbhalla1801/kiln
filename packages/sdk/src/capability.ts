import type { CapabilityManifest, ResolvedCapability } from './manifest.js';
import type { CapabilityPlan, CapabilityPlanOptions } from './plan.js';

/**
 * The minimal stable contract a kiln capability implements -- built-in or
 * third-party plugin alike.
 *
 * Deliberately omits `registerOwnership`: the planner only ever consumes
 * `plan.ownershipRegistrations`/`plan.capability`, and the three first-party
 * capabilities' `registerOwnership` signatures diverge, so it's left out
 * of the formal interface.
 */
export interface Capability {
  readonly id: string;
  getManifest(): Promise<CapabilityManifest>;
  getCapability(): Promise<ResolvedCapability>;
  planAdd(rootPath: string, options: CapabilityPlanOptions): Promise<CapabilityPlan>;
}
