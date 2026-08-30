/** Unique identifier for a capability module. */
export type CapabilityId = string;

/** Unique identifier for a transform step. */
export type TransformId = string;

/** Unique identifier for a platform/runtime adapter. */
export type AdapterId = string;

/** Supported transform operation kinds (expanded in transform API work). */
export type TransformType =
  | 'file-create'
  | 'file-modify'
  | 'file-delete'
  | 'file-patch'
  | 'json-mutation'
  | 'package-json-mutation'
  | 'env-mutation';

/** Canonical list of transform types for validation and discovery. */
export const TRANSFORM_TYPES: readonly TransformType[] = [
  'file-create',
  'file-modify',
  'file-delete',
  'file-patch',
  'json-mutation',
  'package-json-mutation',
  'env-mutation',
] as const;

/** A single file or project mutation contributed by a capability. */
export interface Transform {
  id: TransformId;
  name?: string;
  type: TransformType;
  /** Primary target path or resource identifier for the transform. */
  target?: string;
  /** Type-specific payload (patch content, JSON path, env key, etc.). */
  payload?: Record<string, unknown>;
}

/** A versioned, composable feature module. */
export interface Capability {
  id: CapabilityId;
  name?: string;
  version: string;
  dependencies: CapabilityId[];
  adapters?: AdapterId[];
  transforms?: Transform[];
  files?: string[];
  ownedDependencies?: string[];
  ownedScripts?: string[];
  ownedEnvVars?: string[];
  ownedMetadata?: string[];
}

/** Lifecycle hook binding declared in a capability manifest. */
export interface ManifestHook {
  event: string;
  handler: string;
}

/** Validation rule declared in a capability manifest. */
export interface ManifestValidation {
  id: string;
  type: string;
  message?: string;
  config?: Record<string, unknown>;
}

/** Resources a capability claims ownership over. */
export interface OwnershipDeclaration {
  files?: string[];
  dependencies?: string[];
  scripts?: string[];
  envVars?: string[];
  metadata?: string[];
}

/**
 * Planning-time capability declaration.
 * Transform references are IDs only; full definitions are resolved before execution.
 */
export interface CapabilityManifest {
  id: CapabilityId;
  name?: string;
  version: string;
  dependencies: CapabilityId[];
  adapters?: AdapterId[];
  transforms?: TransformId[];
  transformDefinitions?: Transform[];
  hooks?: ManifestHook[];
  validations?: ManifestValidation[];
  ownership?: OwnershipDeclaration;
  files?: string[];
}

/** Records which capability owns a given project file. */
export interface FileOwnership {
  filePath: string;
  ownerCapabilityId: CapabilityId;
}

/** Snapshot of a kiln project's resolved capabilities, ownership, and adapters. */
export interface ProjectState {
  capabilities: Capability[];
  fileOwnership: Map<string, CapabilityId>;
  activeAdapters: AdapterId[];
}

/** Ordered capability resolution and transform execution schedule. */
export interface ExecutionPlan {
  capabilities: Capability[];
  transforms: TransformId[];
}

/** Contract implemented by platform adapters (node, etc.). */
export interface AdapterContract {
  id: AdapterId;
  version: string;
  provides: string[];
}
