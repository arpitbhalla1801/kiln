import { access } from 'node:fs/promises';
import { join } from 'node:path';
import {
  type Capability,
  type CapabilityManifest,
  capabilityFromManifest,
  loadManifestFromFile,
  loadManifestFromObject,
  OwnershipTracker,
} from '@kiln/core';
import { ENV_MANIFEST } from './manifest-data.js';
import {
  createTransformPipeline,
  type TransformPipeline,
} from '@kiln/transform-engine';
import {
  ENV_CAPABILITY_ID,
  DEFAULT_ENV_EXAMPLE_PATH,
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

export class EnvCapability {
  readonly manifestPath?: string;

  constructor(manifestPath?: string) {
    this.manifestPath = manifestPath;
  }

  async getManifest(): Promise<CapabilityManifest> {
    if (this.manifestPath) {
      return loadManifestFromFile(this.manifestPath);
    }

    return loadManifestFromObject(ENV_MANIFEST);
  }

  async getCapability(): Promise<Capability> {
    return capabilityFromManifest(await this.getManifest());
  }

  async planAdd(
    rootPath: string,
    variables: EnvVariableMap,
    options: EnvCapabilityPlanOptions = {}
  ): Promise<EnvCapabilityPlan> {
    const envExamplePath = options.envExamplePath ?? DEFAULT_ENV_EXAMPLE_PATH;
    const variableInputs = toEnvVariableInputs(variables);

    validateEnvVariableNames(variableInputs);

    const tracker = options.tracker ?? new OwnershipTracker();
    validateEnvOwnership(variableInputs, tracker, ENV_CAPABILITY_ID);

    const ownershipRegistrations = buildOwnershipRegistrations(
      variableInputs,
      envExamplePath,
      ENV_CAPABILITY_ID
    );

    const transforms = await buildTransforms(
      rootPath,
      envExamplePath,
      variables,
      options.envExampleExists ?? (await fileExists(join(rootPath, envExamplePath)))
    );

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

export async function buildTransforms(
  rootPath: string,
  envExamplePath: string,
  variables: EnvVariableMap,
  envExampleExists?: boolean
): Promise<TransformPipeline> {
  const exists =
    envExampleExists ?? (await fileExists(join(rootPath, envExamplePath)));
  const builder = createTransformPipeline();

  if (!exists) {
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
      'Inject environment variables'
    );
  }

  return builder.build();
}

function buildCapabilityWithOwnership(
  manifest: CapabilityManifest,
  variables: import('./types.js').EnvVariableInput[],
  envExamplePath: string
): Capability {
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

function mergeUnique(existing: string[], additions: string[]): string[] {
  const merged = new Set(existing);
  for (const entry of additions) {
    merged.add(entry);
  }

  return Array.from(merged).sort((left, right) => left.localeCompare(right));
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
