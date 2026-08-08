import type { TransformId, TransformType } from '@kiln/core';

export interface TransformBase {
  id: TransformId;
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
}

/** Discriminated union of supported kiln transforms. */
export type TypedTransform =
  | FileCreateTransform
  | FilePatchTransform
  | JsonMutationTransform
  | PackageJsonMutationTransform
  | EnvMutationTransform;

export type TransformPipeline = TypedTransform[];

export const TYPED_TRANSFORM_TYPES: readonly TransformType[] = [
  'file-create',
  'file-patch',
  'json-mutation',
  'package-json-mutation',
  'env-mutation',
] as const;

export function isTypedTransformType(type: string): type is TypedTransform['type'] {
  return (TYPED_TRANSFORM_TYPES as readonly string[]).includes(type);
}
