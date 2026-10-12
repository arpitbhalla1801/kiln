/** Unique identifier for a capability module. */
export type CapabilityId = string;

/** Unique identifier for a transform step. */
export type TransformId = string;

/** Unique identifier for a platform/runtime adapter. */
export type AdapterId = string;

/**
 * Supported transform operation kinds for manifest-declared
 * `transformDefinitions`. This is the manifest-level vocabulary, not the
 * execution-level one -- `file-modify` has no `TypedTransform` variant of
 * its own; `resolveTypedTransform` (in @kiln-cli/transform-engine) resolves it
 * into a `file-create`-tagged typed transform (an unconditional write,
 * matching "modify" semantics). It exists as a distinct manifest-level name
 * for readability in a manifest's `transformDefinitions`, not because it
 * executes differently.
 */
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

/** Resources a capability claims ownership over. */
export interface OwnershipDeclaration {
  files?: string[];
  dependencies?: string[];
  scripts?: string[];
  envVars?: string[];
  metadata?: string[];
}

/** A user-selectable variant of a capability, e.g. an auth provider. */
export interface ProviderDeclaration {
  id: string;
  description: string;
}

/** One input `kiln add` accepts for a capability, e.g. `--var AUTH_SECRET=...`. */
export interface ConfigOption {
  name: string;
  description: string;
  required: boolean;
}

/** A command that confirms the capability works once added. Declared, not run by kiln yet. */
export interface VerifyStep {
  command: string;
  description: string;
}

export const CAPABILITY_OPERATIONS = ['add', 'remove'] as const;
export type CapabilityOperation = (typeof CAPABILITY_OPERATIONS)[number];

/**
 * Planning-time capability declaration.
 * Transform references are IDs only; full definitions are resolved before execution.
 */
export interface CapabilityManifest {
  id: CapabilityId;
  name?: string;
  version: string;
  /** One agent-readable line: what adding this capability does for the project. */
  description: string;
  /** Frameworks it supports, e.g. `nextjs`. */
  frameworks: string[];
  /** Selectable variants; empty when the capability has none. */
  providers: ProviderDeclaration[];
  /** Inputs `kiln add` accepts; empty when it takes none. */
  config: ConfigOption[];
  /** Lifecycle operations kiln can run for it. */
  operations: CapabilityOperation[];
  /** Commands that confirm it works after `add`. */
  verify: VerifyStep[];
  dependencies: CapabilityId[];
  /** Optional partners this capability adapts to when present; never blocks an add. */
  enhances?: CapabilityId[];
  adapters?: AdapterId[];
  transforms?: TransformId[];
  transformDefinitions?: Transform[];
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
