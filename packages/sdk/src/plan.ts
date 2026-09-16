import type { OwnershipRegistration, OwnershipTracker } from './ownership.js';
import type { ResolvedCapability } from './manifest.js';
import type { TransformPipeline } from './transforms.js';

/**
 * Fields shared by every first-party capability's plan options today
 * (env, auth, db all duplicate these 5 verbatim). A plugin's own options
 * type should extend this rather than redeclaring the shared fields.
 */
export interface CapabilityPlanOptions {
  tracker?: OwnershipTracker;
  envExamplePath?: string;
  envExampleExists?: boolean;
  envLocalExists?: boolean;
  gitignoreContent?: string | null;
}

/**
 * The result of planning a capability's addition to a project. Shared by
 * every first-party capability today: transforms to apply, the resolved
 * capability data, and the ownership claims to register. A plugin's own
 * plan type may extend this with additional fields (the way auth/db add
 * `envPlan`/`paths`), but every consumer of a Capability's planAdd result
 * only relies on this base shape.
 */
export interface CapabilityPlan {
  transforms: TransformPipeline;
  capability: ResolvedCapability;
  ownershipRegistrations: OwnershipRegistration[];
}
