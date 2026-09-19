import { readFile } from 'node:fs/promises';
import {
  CapabilityManifest,
  OwnershipDeclaration,
  TRANSFORM_TYPES,
  Transform,
  TransformType,
} from './models.js';

export class ManifestValidationError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(`Manifest validation failed for '${field}': ${message}`);
    this.name = 'ManifestValidationError';
    this.field = field;
  }
}

export function validateManifest(manifest: CapabilityManifest): void {
  const record = manifest as unknown as Record<string, unknown>;

  readRequiredString(record, 'id');
  readRequiredString(record, 'version');
  readStringArray(record, 'dependencies', true);
  readOptionalStringArray(record, 'adapters');
  readOptionalStringArray(record, 'transforms');
  validateTransformDefinitions(manifest.transformDefinitions);
  validateOwnership(manifest.ownership);
  readOptionalStringArray(record, 'files');

  if (manifest.name !== undefined) {
    readRequiredString(record, 'name');
  }
}

export function loadManifestFromObject(raw: unknown): CapabilityManifest {
  if (!isRecord(raw)) {
    throw new ManifestValidationError('manifest', 'expected a JSON object');
  }

  const manifest: CapabilityManifest = {
    id: readRequiredString(raw, 'id'),
    version: readRequiredString(raw, 'version'),
    dependencies: readStringArray(raw, 'dependencies', true),
    name: readOptionalString(raw, 'name'),
    adapters: readOptionalStringArray(raw, 'adapters'),
    transforms: readOptionalStringArray(raw, 'transforms'),
    transformDefinitions: readTransformDefinitions(raw),
    ownership: readOwnership(raw),
    files: readOptionalStringArray(raw, 'files'),
  };

  validateManifest(manifest);
  return manifest;
}

export function loadManifestFromJson(json: string): CapabilityManifest {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid JSON';
    throw new ManifestValidationError('manifest', message);
  }

  return loadManifestFromObject(parsed);
}

export async function loadManifestFromFile(filePath: string): Promise<CapabilityManifest> {
  try {
    return loadManifestFromJson(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      throw new ManifestValidationError('manifest', `file not found: ${filePath}`);
    }

    throw error;
  }
}

function validateRequiredString(value: unknown, field: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ManifestValidationError(field, 'must be a non-empty string');
  }
}

function validateTransformDefinitions(definitions: unknown): void {
  if (definitions === undefined) {
    return;
  }

  if (!Array.isArray(definitions)) {
    throw new ManifestValidationError('transformDefinitions', 'must be an array');
  }

  for (const definition of definitions) {
    validateTransformDefinition(definition);
  }
}

function validateTransformDefinition(definition: unknown): void {
  if (!isRecord(definition)) {
    throw new ManifestValidationError('transformDefinitions', 'each entry must be an object');
  }

  readRequiredString(definition, 'id');
  validateTransformType(definition.type, 'transformDefinitions.type');

  if (definition.name !== undefined) {
    readRequiredString(definition, 'name');
  }

  if (definition.target !== undefined) {
    readRequiredString(definition, 'target');
  }

  if (definition.payload !== undefined && !isRecord(definition.payload)) {
    throw new ManifestValidationError('transformDefinitions.payload', 'must be an object');
  }
}

function validateTransformType(value: unknown, field: string): void {
  if (typeof value !== 'string' || !TRANSFORM_TYPES.includes(value as TransformType)) {
    throw new ManifestValidationError(field, `must be one of: ${TRANSFORM_TYPES.join(', ')}`);
  }
}

function validateOwnership(ownership: unknown): void {
  if (ownership === undefined) {
    return;
  }

  if (!isRecord(ownership)) {
    throw new ManifestValidationError('ownership', 'must be an object');
  }

  readOptionalStringArray(ownership, 'files');
  readOptionalStringArray(ownership, 'dependencies');
  readOptionalStringArray(ownership, 'scripts');
  readOptionalStringArray(ownership, 'envVars');
  readOptionalStringArray(ownership, 'metadata');
}

function readRequiredString(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  validateRequiredString(value, field);
  return value as string;
}

function readOptionalString(record: Record<string, unknown>, field: string): string | undefined {
  const value = record[field];
  if (value === undefined) {
    return undefined;
  }

  validateRequiredString(value, field);
  return value as string;
}

function readStringArray(
  record: Record<string, unknown>,
  field: string,
  required: boolean
): string[] {
  const value = record[field];
  if (value === undefined && !required) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new ManifestValidationError(field, 'must be an array');
  }

  for (const entry of value) {
    if (typeof entry !== 'string' || entry.trim().length === 0) {
      throw new ManifestValidationError(field, 'must contain only non-empty strings');
    }
  }

  return [...value];
}

function readOptionalStringArray(
  record: Record<string, unknown>,
  field: string
): string[] | undefined {
  const value = record[field];
  if (value === undefined) {
    return undefined;
  }

  return readStringArray(record, field, false);
}

function readTransformDefinitions(record: Record<string, unknown>): Transform[] | undefined {
  const value = record.transformDefinitions;
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new ManifestValidationError('transformDefinitions', 'must be an array');
  }

  return value.map((entry) => {
    if (!isRecord(entry)) {
      throw new ManifestValidationError('transformDefinitions', 'each entry must be an object');
    }

    const transform: Transform = {
      id: readRequiredString(entry, 'id'),
      type: entry.type as TransformType,
      name: readOptionalString(entry, 'name'),
      target: readOptionalString(entry, 'target'),
      payload: entry.payload === undefined ? undefined : (entry.payload as Record<string, unknown>),
    };

    validateTransformDefinition(transform);
    return transform;
  });
}

function readOwnership(record: Record<string, unknown>): OwnershipDeclaration | undefined {
  const value = record.ownership;
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new ManifestValidationError('ownership', 'must be an object');
  }

  const ownership: OwnershipDeclaration = {
    files: readOptionalStringArray(value, 'files'),
    dependencies: readOptionalStringArray(value, 'dependencies'),
    scripts: readOptionalStringArray(value, 'scripts'),
    envVars: readOptionalStringArray(value, 'envVars'),
    metadata: readOptionalStringArray(value, 'metadata'),
  };

  validateOwnership(ownership);
  return ownership;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isErrnoException(error: unknown): error is { code?: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}
