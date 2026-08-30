import { readFile } from 'node:fs/promises';
import { LIFECYCLE_PHASES } from './lifecycle/types.js';
import {
  CapabilityManifest,
  ManifestHook,
  ManifestValidation,
  OwnershipDeclaration,
  TRANSFORM_TYPES,
  Transform,
  TransformType,
} from './models.js';

const MANIFEST_HOOK_EVENTS = new Set<string>([
  ...LIFECYCLE_PHASES,
  ...LIFECYCLE_PHASES.map((phase) => `before:${phase}`),
  ...LIFECYCLE_PHASES.map((phase) => `after:${phase}`),
]);

const MANIFEST_VALIDATION_TYPES = new Set<string>([
  'required-adapter',
  'required-dependency',
  'no-duplicate-env',
  'ownership-conflict',
  'custom',
]);

export class ManifestValidationError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(`Manifest validation failed for '${field}': ${message}`);
    this.name = 'ManifestValidationError';
    this.field = field;
  }
}

export function validateManifest(manifest: CapabilityManifest): void {
  validateRequiredString(manifest.id, 'id');
  validateRequiredString(manifest.version, 'version');
  validateDependencies(manifest.dependencies);
  validateOptionalStringArray(manifest.adapters, 'adapters');
  validateTransformRefs(manifest.transforms, 'transforms');
  validateTransformDefinitions(manifest.transformDefinitions);
  validateHooks(manifest.hooks);
  validateValidations(manifest.validations);
  validateOwnership(manifest.ownership);
  validateOptionalStringArray(manifest.files, 'files');

  if (manifest.name !== undefined) {
    validateRequiredString(manifest.name, 'name');
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
    hooks: readHooks(raw),
    validations: readValidations(raw),
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

function validateDependencies(dependencies: unknown): void {
  if (!Array.isArray(dependencies)) {
    throw new ManifestValidationError('dependencies', 'must be an array');
  }

  for (const dependency of dependencies) {
    if (typeof dependency !== 'string' || dependency.trim().length === 0) {
      throw new ManifestValidationError('dependencies', 'must contain only non-empty strings');
    }
  }
}

function validateOptionalStringArray(value: unknown, field: string): void {
  if (value === undefined) {
    return;
  }

  if (!Array.isArray(value)) {
    throw new ManifestValidationError(field, 'must be an array');
  }

  for (const entry of value) {
    if (typeof entry !== 'string' || entry.trim().length === 0) {
      throw new ManifestValidationError(field, 'must contain only non-empty strings');
    }
  }
}

function validateTransformRefs(value: unknown, field: string): void {
  validateOptionalStringArray(value, field);
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

  validateRequiredString(definition.id, 'transformDefinitions.id');
  validateTransformType(definition.type, 'transformDefinitions.type');

  if (definition.name !== undefined) {
    validateRequiredString(definition.name, 'transformDefinitions.name');
  }

  if (definition.target !== undefined) {
    validateRequiredString(definition.target, 'transformDefinitions.target');
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

function validateHooks(hooks: unknown): void {
  if (hooks === undefined) {
    return;
  }

  if (!Array.isArray(hooks)) {
    throw new ManifestValidationError('hooks', 'must be an array');
  }

  for (const hook of hooks) {
    validateHook(hook);
  }
}

function validateHook(hook: unknown): void {
  if (!isRecord(hook)) {
    throw new ManifestValidationError('hooks', 'each entry must be an object');
  }

  validateRequiredString(hook.event, 'hooks.event');
  validateRequiredString(hook.handler, 'hooks.handler');

  const event = hook.event as string;
  if (!MANIFEST_HOOK_EVENTS.has(event)) {
    throw new ManifestValidationError(
      'hooks.event',
      `must be a lifecycle phase or before:/after: prefix (${Array.from(MANIFEST_HOOK_EVENTS).join(', ')})`
    );
  }
}

function validateValidations(validations: unknown): void {
  if (validations === undefined) {
    return;
  }

  if (!Array.isArray(validations)) {
    throw new ManifestValidationError('validations', 'must be an array');
  }

  for (const validation of validations) {
    validateValidation(validation);
  }
}

function validateValidation(validation: unknown): void {
  if (!isRecord(validation)) {
    throw new ManifestValidationError('validations', 'each entry must be an object');
  }

  validateRequiredString(validation.id, 'validations.id');
  validateRequiredString(validation.type, 'validations.type');

  const validationType = validation.type as string;
  if (!MANIFEST_VALIDATION_TYPES.has(validationType)) {
    throw new ManifestValidationError(
      'validations.type',
      `must be one of: ${Array.from(MANIFEST_VALIDATION_TYPES).join(', ')}`
    );
  }

  if (validation.message !== undefined) {
    validateRequiredString(validation.message, 'validations.message');
  }

  if (validation.config !== undefined && !isRecord(validation.config)) {
    throw new ManifestValidationError('validations.config', 'must be an object');
  }
}

function validateOwnership(ownership: unknown): void {
  if (ownership === undefined) {
    return;
  }

  if (!isRecord(ownership)) {
    throw new ManifestValidationError('ownership', 'must be an object');
  }

  validateOptionalStringArray(ownership.files, 'ownership.files');
  validateOptionalStringArray(ownership.dependencies, 'ownership.dependencies');
  validateOptionalStringArray(ownership.scripts, 'ownership.scripts');
  validateOptionalStringArray(ownership.envVars, 'ownership.envVars');
  validateOptionalStringArray(ownership.metadata, 'ownership.metadata');
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

function readHooks(record: Record<string, unknown>): ManifestHook[] | undefined {
  const value = record.hooks;
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new ManifestValidationError('hooks', 'must be an array');
  }

  const hooks = value.map((entry) => {
    if (!isRecord(entry)) {
      throw new ManifestValidationError('hooks', 'each entry must be an object');
    }

    return {
      event: readRequiredString(entry, 'event'),
      handler: readRequiredString(entry, 'handler'),
    };
  });

  validateHooks(hooks);
  return hooks;
}

function readValidations(record: Record<string, unknown>): ManifestValidation[] | undefined {
  const value = record.validations;
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new ManifestValidationError('validations', 'must be an array');
  }

  const validations = value.map((entry) => {
    if (!isRecord(entry)) {
      throw new ManifestValidationError('validations', 'each entry must be an object');
    }

    return {
      id: readRequiredString(entry, 'id'),
      type: readRequiredString(entry, 'type'),
      message: readOptionalString(entry, 'message'),
      config:
        entry.config === undefined ? undefined : (entry.config as Record<string, unknown>),
    };
  });

  validateValidations(validations);
  return validations;
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
