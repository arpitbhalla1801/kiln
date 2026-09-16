/**
 * Structural mirror of @kiln/core's manifest and resolved-capability
 * shapes. Zero runtime dependency on @kiln/core, same reasoning as
 * ownership.ts. Keep in sync with packages/core/src/models.ts.
 *
 * Note: hooks and validations are deliberately not part of this shape.
 * They existed on CapabilityManifest in kiln's own history but were
 * schema-validated and never executed -- removed entirely rather than
 * carried into the plugin-facing contract. See issue #97.
 */

export type TransformType =
  | 'file-create'
  | 'file-modify'
  | 'file-delete'
  | 'file-patch'
  | 'json-mutation'
  | 'package-json-mutation'
  | 'env-mutation';

export interface Transform {
  id: string;
  name?: string;
  type: TransformType;
  target?: string;
  payload?: Record<string, unknown>;
}

export interface OwnershipDeclaration {
  files?: string[];
  dependencies?: string[];
  scripts?: string[];
  envVars?: string[];
  metadata?: string[];
}

/** A capability's planning-time declaration, loaded from kiln.manifest.json. */
export interface CapabilityManifest {
  id: string;
  name?: string;
  version: string;
  dependencies: string[];
  adapters?: string[];
  transforms?: string[];
  transformDefinitions?: Transform[];
  ownership?: OwnershipDeclaration;
  files?: string[];
}

/** A capability's resolved, runtime-ready shape (what getCapability() returns). */
export interface ResolvedCapability {
  id: string;
  name?: string;
  version: string;
  dependencies: string[];
  adapters?: string[];
  transforms?: Transform[];
  files?: string[];
  ownedDependencies?: string[];
  ownedScripts?: string[];
  ownedEnvVars?: string[];
  ownedMetadata?: string[];
}
