/**
 * Structural mirror of @kiln/transform-engine's transform shapes.
 *
 * @kiln/transform-engine is a private, unpublished workspace package, but
 * TransformPipeline is just TypedTransform[] -- plain data, no class or
 * builder function required at runtime. A plugin builds these as plain
 * object literals; kiln's real TransformApplier dispatches on the `type`
 * discriminant structurally, with no dependency on where the object came
 * from. Keep these shapes in sync with
 * packages/transform-engine/src/transform-types.ts.
 */

export interface TransformBase {
  id: string;
  name?: string;
}

export interface FileCreateTransform extends TransformBase {
  type: 'file-create';
  filePath: string;
  content: string;
}

export interface FilePatchTransform extends TransformBase {
  type: 'file-patch';
  filePath: string;
  search: string;
  replace: string;
}

export interface FileDeleteTransform extends TransformBase {
  type: 'file-delete';
  filePath: string;
}

export type JsonMutationOperation = 'set' | 'delete';

export interface JsonMutationTransform extends TransformBase {
  type: 'json-mutation';
  filePath: string;
  path: string;
  value?: unknown;
  operation?: JsonMutationOperation;
}

export interface PackageJsonMutationTransform extends TransformBase {
  type: 'package-json-mutation';
  filePath?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  removeDependencies?: string[];
  removeDevDependencies?: string[];
  removeScripts?: string[];
}

export interface EnvVariableDefinition {
  value?: string;
  example?: string;
  required?: boolean;
}

export interface EnvMutationTransform extends TransformBase {
  type: 'env-mutation';
  filePath: string;
  variables: Record<string, string | EnvVariableDefinition>;
  removeVariables?: string[];
  section?: string;
  preserveExistingValues?: boolean;
}

/**
 * The six transform kinds a capability may compose. This union is closed
 * deliberately -- kiln does not support plugin-registered transform kinds.
 * A genuinely new mutation primitive ships as a first-party addition to
 * @kiln/transform-engine, never something a plugin can register at
 * runtime. See docs/plugin-architecture.md's "Rejected alternatives".
 */
export type TypedTransform =
  | FileCreateTransform
  | FilePatchTransform
  | FileDeleteTransform
  | JsonMutationTransform
  | PackageJsonMutationTransform
  | EnvMutationTransform;

export type TransformPipeline = TypedTransform[];
