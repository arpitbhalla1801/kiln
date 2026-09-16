/**
 * @kiln/capability-sdk
 *
 * The public, independently-versioned contract for writing a third-party
 * kiln capability plugin. See docs/plugin-architecture.md in the kiln repo
 * for the full design and the reasoning behind it.
 *
 * Design note: this package intentionally has no runtime dependency on
 * @kiln/core or @kiln/transform-engine, both private, unpublished
 * workspace packages. Kiln's own internals are free to change without
 * ever breaking a published plugin. Where a plugin needs to work with
 * something kiln constructs and hands it (an ownership tracker), or
 * builds itself as plain data (a transform pipeline), this SDK declares
 * the shape as a structural type instead of importing the concrete
 * implementation -- kiln's real classes and objects satisfy these types
 * automatically because TypeScript types are structural, not nominal.
 */

export const SDK_VERSION = '0.1.0';

export type { Capability } from './capability.js';
export type { CapabilityPlan, CapabilityPlanOptions } from './plan.js';
export type {
  CapabilityManifest,
  OwnershipDeclaration,
  ResolvedCapability,
  Transform,
  TransformType,
} from './manifest.js';
export type {
  OwnershipConflict,
  OwnershipRegistration,
  OwnershipResourceType,
  OwnershipTracker,
} from './ownership.js';
export type {
  EnvMutationTransform,
  EnvVariableDefinition,
  FileCreateTransform,
  FileDeleteTransform,
  FilePatchTransform,
  JsonMutationOperation,
  JsonMutationTransform,
  PackageJsonMutationTransform,
  TransformBase,
  TransformPipeline,
  TypedTransform,
} from './transforms.js';
