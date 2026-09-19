import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  type Capability as ResolvedCapability,
  type CapabilityManifest,
  capabilityFromManifest,
  fileExists,
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
  validateEnvOwnership,
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
    validateEnvOwnership(variableInputs, tracker, ENV_CAPABILITY_ID, envExamplePath);

    const ownershipRegistrations = buildOwnershipRegistrations(
      variableInputs,
      envExamplePath,
      ENV_CAPABILITY_ID
    );

    const envLocalExists =
      options.envLocalExists ?? (await fileExists(join(rootPath, DEFAULT_ENV_LOCAL_PATH)));
    const gitignoreContent =
      options.gitignoreContent !== undefined
        ? options.gitignoreContent
        : await readGitignore(rootPath);
    const envExampleExists =
      options.envExampleExists ?? (await fileExists(join(rootPath, envExamplePath)));

    const transforms = buildTransforms({
      envExamplePath,
      variables,
      envExampleExists,
      ownerCapabilityId,
      envLocalExists,
      gitignoreContent,
    });

    const manifest = await this.getManifest();
    const capability = buildCapabilityWithOwnership(manifest, variableInputs, envExamplePath);

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
      variables,
      'Inject environment variables',
      undefined,
      ownerCapabilityId
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

function toFlatEnvLocalVariables(variables: EnvVariableMap): EnvVariableMap {
  const flat: EnvVariableMap = {};

  for (const [key, definition] of Object.entries(variables)) {
    flat[key] =
      typeof definition === 'string' ? definition : (definition.value ?? definition.example ?? '');
  }

  return flat;
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
  envExamplePath: string
): ResolvedCapability {
  const ownedEnvVars = mergeUnique(manifest.ownership?.envVars ?? [], variables.map((v) => v.name));
  const ownedFiles = mergeUnique(manifest.ownership?.files ?? [], [envExamplePath]);

  return capabilityFromManifest({
    ...manifest,
    ownership: {
      ...manifest.ownership,
      files: ownedFiles,
      envVars: ownedEnvVars,
    },
  });
}

