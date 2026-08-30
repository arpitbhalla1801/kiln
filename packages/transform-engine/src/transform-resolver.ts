import type { Transform } from '@kiln/core';
import {
  envMutation,
  fileCreate,
  filePatch,
  jsonMutation,
  packageJsonMutation,
} from './transform-builders.js';
import type {
  EnvVariableDefinition,
  JsonMutationOperation,
  PackageJsonMutationTransform,
  TypedTransform,
} from './transform-types.js';

export function resolveTypedTransform(transform: Transform): TypedTransform {
  switch (transform.type) {
    case 'file-create':
      return fileCreate(
        transform.id,
        transform.target ?? '',
        readStringPayload(transform.payload, 'content', ''),
        transform.name
      );
    case 'file-patch':
      return filePatch(
        transform.id,
        transform.target ?? '',
        readStringPayload(transform.payload, 'search', ''),
        readStringPayload(transform.payload, 'replace', ''),
        transform.name
      );
    case 'json-mutation':
      return jsonMutation(
        transform.id,
        transform.target ?? 'package.json',
        readStringPayload(transform.payload, 'path', ''),
        transform.payload?.value,
        readJsonOperation(transform.payload?.operation),
        transform.name
      );
    case 'package-json-mutation':
      return packageJsonMutation(
        transform.id,
        readPackageJsonMutationPayload(transform.payload),
        transform.name
      );
    case 'env-mutation':
      return envMutation(
        transform.id,
        transform.target ?? '.env.example',
        readEnvVariables(transform.payload),
        transform.name
      );
    case 'file-modify':
      return fileCreate(
        transform.id,
        transform.target ?? '',
        readStringPayload(transform.payload, 'content', ''),
        transform.name
      );
    case 'file-delete':
      throw new Error(
        `Transform '${transform.id}' uses file-delete which is not yet supported by the typed transform resolver`
      );
    default:
      throw new Error(`Unsupported transform type: ${transform.type}`);
  }
}

export function resolveTypedTransforms(transforms: Transform[]): TypedTransform[] {
  return transforms.map((transform) => resolveTypedTransform(transform));
}

function readStringPayload(
  payload: Record<string, unknown> | undefined,
  field: string,
  fallback = ''
): string {
  const value = payload?.[field];
  return typeof value === 'string' ? value : fallback;
}

function readJsonOperation(value: unknown): JsonMutationOperation {
  return value === 'delete' ? 'delete' : 'set';
}

function readEnvVariables(
  payload: Record<string, unknown> | undefined
): Record<string, string | EnvVariableDefinition> {
  const variables = payload?.variables;
  if (!variables || typeof variables !== 'object' || Array.isArray(variables)) {
    return {};
  }

  return variables as Record<string, string | EnvVariableDefinition>;
}

function readPackageJsonMutationPayload(
  payload: Record<string, unknown> | undefined
): Omit<PackageJsonMutationTransform, 'id' | 'type'> {
  return {
    filePath: readOptionalString(payload, 'filePath'),
    dependencies: readStringRecord(payload?.dependencies),
    devDependencies: readStringRecord(payload?.devDependencies),
    scripts: readStringRecord(payload?.scripts),
    removeDependencies: readStringArray(payload?.removeDependencies),
    removeDevDependencies: readStringArray(payload?.removeDevDependencies),
    removeScripts: readStringArray(payload?.removeScripts),
  };
}

function readOptionalString(
  payload: Record<string, unknown> | undefined,
  field: string
): string | undefined {
  const value = payload?.[field];
  return typeof value === 'string' ? value : undefined;
}

function readStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const record: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') {
      record[key] = entry;
    }
  }

  return Object.keys(record).length > 0 ? record : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const entries = value.filter((entry) => typeof entry === 'string');
  return entries.length > 0 ? entries : undefined;
}
