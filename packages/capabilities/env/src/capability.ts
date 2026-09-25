import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  type Capability as ResolvedCapability,
  type CapabilityManifest,
  capabilityFromManifest,
  fileExists,
  formatOwnershipConflict,
  loadManifestFromObject,
  mergeUnique,
  OwnershipTracker,
} from '@kiln/core';
import type { Capability } from '@kiln/capability-sdk';
import { ENV_MANIFEST } from './manifest-data.js';
import {
  createTransformPipeline,
  type TransformPipeline,
} from '@kiln/transform-engine';
import {
  ENV_CAPABILITY_ID,
  DEFAULT_ENV_EXAMPLE_PATH,
  DEFAULT_ENV_LOCAL_PATH,
  type EnvCapabilityPlan,
  type EnvCapabilityPlanOptions,
  type EnvVariableMap,
} from './types.js';
import {
  buildOwnershipRegistrations,
  toEnvVariableInputs,
  validateEnvVariableNames,
} from './validation.js';

export class EnvCapability implements Capability {
  readonly id = ENV_CAPABILITY_ID;

  async getManifest(): Promise<CapabilityManifest> {
    return loadManifestFromObject(ENV_MANIFEST);
  }

  async getCapability(): Promise<ResolvedCapability> {
    return capabilityFromManifest(await this.getManifest());
  }

  async planAdd(
    rootPath: string,
    options: EnvCapabilityPlanOptions
  ): Promise<EnvCapabilityPlan> {
    const { variables } = options;
    const envExamplePath = options.envExamplePath ?? DEFAULT_ENV_EXAMPLE_PATH;
    const ownerCapabilityId = options.ownerCapabilityId ?? ENV_CAPABILITY_ID;
    const variableInputs = toEnvVariableInputs(variables);

    validateEnvVariableNames(variableInputs);

    const tracker = options.tracker ?? new OwnershipTracker();

    const envLocalExists =
      options.envLocalExists ?? (await fileExists(join(rootPath, DEFAULT_ENV_LOCAL_PATH)));
    const gitignoreContent =
      options.gitignoreContent !== undefined
        ? options.gitignoreContent
        : await readGitignore(rootPath);
    const envExampleExists =
      options.envExampleExists ?? (await fileExists(join(rootPath, envExamplePath)));

    // Claim only what this add creates, so `kiln remove` never deletes a user's own
    // .env.example or variables that were defined before kiln touched them.
    const existingKeys = new Set([
      ...(await readEnvKeys(join(rootPath, envExamplePath))),
      ...(await readEnvKeys(join(rootPath, DEFAULT_ENV_LOCAL_PATH))),
    ]);
    const claimedVariables = variableInputs.filter(
      (variable) =>
        !existingKeys.has(variable.name) && tracker.getOwner('envVar', variable.name) === undefined
    );
    const claimFile = !envExampleExists && tracker.getOwner('file', envExamplePath) === undefined;

    // The calling capability owns what it adds (auth owns AUTH_SECRET, db owns DATABASE_URL),
    // so `kiln remove <capability>` cleans up its own env values.
    const ownershipRegistrations = buildOwnershipRegistrations(
      claimedVariables,
      envExamplePath,
      ownerCapabilityId,
      claimFile
    );
    // A resource owned by env or by this caller is fine (env is the shared baseline); one owned
    // by any other capability is a conflict.
    const conflicts = buildOwnershipRegistrations(variableInputs, envExamplePath, ownerCapabilityId).filter(
      (registration) => {
        const owner = tracker.getOwner(registration.resourceType, registration.resourceKey);
        return owner !== undefined && owner !== ENV_CAPABILITY_ID && owner !== ownerCapabilityId;
      }
    );
    if (conflicts.length > 0) {
      const [first] = conflicts;
      throw new Error(
        formatOwnershipConflict({
          resourceType: first.resourceType,
          resourceKey: first.resourceKey,
          existingOwner: tracker.getOwner(first.resourceType, first.resourceKey)!,
          attemptedOwner: ownerCapabilityId,
        })
      );
    }

    const transforms = buildTransforms({
      envExamplePath,
      variables,
      envExampleExists,
      ownerCapabilityId,
      envLocalExists,
      gitignoreContent,
    });

    const manifest = await this.getManifest();
    const capability = buildCapabilityWithOwnership(
      manifest,
      claimedVariables,
      envExamplePath,
      claimFile
    );

    return {
      transforms,
      capability,
      ownershipRegistrations,
    };
  }

  registerOwnership(
    tracker: OwnershipTracker,
    variables: EnvVariableMap,
    envExamplePath = DEFAULT_ENV_EXAMPLE_PATH
  ): void {
    const variableInputs = toEnvVariableInputs(variables);
    validateEnvVariableNames(variableInputs);

    const registrations = buildOwnershipRegistrations(
      variableInputs,
      envExamplePath,
      ENV_CAPABILITY_ID
    );

    for (const registration of registrations) {
      tracker.register(registration);
    }
  }
}

export interface BuildTransformsOptions {
  envExamplePath: string;
  variables: EnvVariableMap;
  envExampleExists: boolean;
  ownerCapabilityId?: string;
  envLocalExists: boolean;
  gitignoreContent: string | null;
}

export function buildTransforms(options: BuildTransformsOptions): TransformPipeline {
  const {
    envExamplePath,
    variables,
    envExampleExists,
    ownerCapabilityId = ENV_CAPABILITY_ID,
    envLocalExists,
    gitignoreContent,
  } = options;

  const builder = createTransformPipeline();

  if (!envExampleExists) {
    builder.fileCreate(
      `${ENV_CAPABILITY_ID}-create-env-example`,
      envExamplePath,
      '# Environment variables\n',
      'Create .env.example'
    );
  }

  if (Object.keys(variables).length > 0) {
    builder.envMutation(
      `${ENV_CAPABILITY_ID}-inject-env-vars`,
      envExamplePath,
      toExampleOnlyVariables(variables),
      'Inject environment variables',
      undefined,
      ownerCapabilityId,
      true
    );
  }

  if (!envLocalExists) {
    builder.fileCreate(
      `${ENV_CAPABILITY_ID}-create-env-local`,
      DEFAULT_ENV_LOCAL_PATH,
      '',
      'Create .env.local'
    );
  }

  if (Object.keys(variables).length > 0) {
    builder.envMutation(
      `${ENV_CAPABILITY_ID}-seed-env-local`,
      DEFAULT_ENV_LOCAL_PATH,
      toFlatEnvLocalVariables(variables),
      'Seed .env.local with default values',
      undefined,
      undefined,
      true
    );
  }

  const updatedGitignore = ensureGitignoreCoversEnvLocal(gitignoreContent);

  if (updatedGitignore !== undefined) {
    builder.fileCreate(
      `${ENV_CAPABILITY_ID}-gitignore-env-local`,
      '.gitignore',
      updatedGitignore,
      'Ensure .env.local is gitignored'
    );
  }

  return builder.build();
}

export function buildEnvRemovalTransforms(
  names: string[],
  envExamplePath: string = DEFAULT_ENV_EXAMPLE_PATH
): TransformPipeline {
  return createTransformPipeline()
    .envMutation(`${ENV_CAPABILITY_ID}-remove-vars-example`, envExamplePath, {}, 'Remove environment variables', names)
    .envMutation(`${ENV_CAPABILITY_ID}-remove-vars-local`, DEFAULT_ENV_LOCAL_PATH, {}, 'Remove environment variables', names)
    .build();
}

const DEFAULT_EXAMPLE_PLACEHOLDER = 'replace-me';

// .env.example must never contain a real secret value, even if the variable
// definition carries one (e.g. an auth capability's generated AUTH_SECRET).
function toExampleOnlyVariables(variables: EnvVariableMap): EnvVariableMap {
  const exampleOnly: EnvVariableMap = {};

  for (const [key, definition] of Object.entries(variables)) {
    const example =
      typeof definition === 'string' ? undefined : (definition.example ?? DEFAULT_EXAMPLE_PLACEHOLDER);
    const required = typeof definition === 'string' ? undefined : definition.required;
    exampleOnly[key] = { example: example ?? DEFAULT_EXAMPLE_PLACEHOLDER, required };
  }

  return exampleOnly;
}

function toFlatEnvLocalVariables(variables: EnvVariableMap): EnvVariableMap {
  const flat: EnvVariableMap = {};

  for (const [key, definition] of Object.entries(variables)) {
    flat[key] =
      typeof definition === 'string' ? definition : (definition.value ?? definition.example ?? '');
  }

  return flat;
}

async function readEnvKeys(filePath: string): Promise<string[]> {
  const content = await readFile(filePath, 'utf8').catch(() => '');
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#') && line.includes('='))
    .map((line) => line.slice(0, line.indexOf('=')).trim());
}

async function readGitignore(rootPath: string): Promise<string | null> {
  try {
    return await readFile(join(rootPath, '.gitignore'), 'utf8');
  } catch {
    return null;
  }
}

function ensureGitignoreCoversEnvLocal(content: string | null): string | undefined {
  if (content === null) {
    return undefined;
  }

  const alreadyCovered = content
    .split(/\r?\n/)
    .some((line) => line.trim() === DEFAULT_ENV_LOCAL_PATH);

  if (alreadyCovered) {
    return undefined;
  }

  const needsNewline = content.length > 0 && !content.endsWith('\n');
  return `${content}${needsNewline ? '\n' : ''}${DEFAULT_ENV_LOCAL_PATH}\n`;
}

function buildCapabilityWithOwnership(
  manifest: CapabilityManifest,
  variables: import('./types.js').EnvVariableInput[],
  envExamplePath: string,
  claimFile: boolean
): ResolvedCapability {
  const ownedEnvVars = mergeUnique(manifest.ownership?.envVars ?? [], variables.map((v) => v.name));
  const manifestFiles = (manifest.ownership?.files ?? []).filter((file) => file !== envExamplePath);
  const ownedFiles = claimFile ? mergeUnique(manifestFiles, [envExamplePath]) : manifestFiles;

  return capabilityFromManifest({
    ...manifest,
    ownership: {
      ...manifest.ownership,
      files: ownedFiles,
      envVars: ownedEnvVars,
    },
  });
}

