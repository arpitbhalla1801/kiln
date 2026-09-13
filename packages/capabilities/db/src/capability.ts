import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  type Capability,
  type CapabilityManifest,
  capabilityFromManifest,
  loadManifestFromFile,
  loadManifestFromObject,
  OwnershipTracker,
} from '@kiln/core';
import { DB_MANIFEST } from './manifest-data.js';
import { EnvCapability, type EnvVariableMap } from '@kiln/env-capability';
import { createTransformPipeline, type TransformPipeline } from '@kiln/transform-engine';
import {
  DB_CAPABILITY_ID,
  PRISMA_CLIENT_PACKAGE,
  PRISMA_CLI_PACKAGE,
  PRISMA_VERSION,
  type DbCapabilityPlan,
  type DbCapabilityPlanOptions,
} from './types.js';
import { buildDbOwnershipRegistrations, validateDbOwnership } from './validation.js';

const DB_ENV_VARS: EnvVariableMap = {
  DATABASE_URL: { example: 'postgres://localhost:5432/app', required: true },
};

export class DbCapability {
  readonly manifestPath?: string;
  private readonly envCapability: EnvCapability;

  constructor(manifestPath?: string, envCapability?: EnvCapability) {
    this.manifestPath = manifestPath;
    this.envCapability = envCapability ?? new EnvCapability();
  }

  async getManifest(): Promise<CapabilityManifest> {
    if (this.manifestPath) {
      return loadManifestFromFile(this.manifestPath);
    }

    return loadManifestFromObject(DB_MANIFEST);
  }

  async getCapability(): Promise<Capability> {
    return capabilityFromManifest(await this.getManifest());
  }

  async planAdd(
    rootPath: string,
    options: DbCapabilityPlanOptions = {}
  ): Promise<DbCapabilityPlan> {
    const tracker = options.tracker ?? new OwnershipTracker();
    validateDbOwnership(tracker, DB_CAPABILITY_ID);

    const prismaInstalled =
      options.prismaInstalled ?? (await hasDependency(rootPath, PRISMA_CLI_PACKAGE));

    const dbTransforms = buildDbTransforms(prismaInstalled);

    const envPlan = await this.envCapability.planAdd(rootPath, DB_ENV_VARS, {
      tracker,
      envExamplePath: options.envExamplePath,
      envExampleExists: options.envExampleExists,
      envLocalExists: options.envLocalExists,
      gitignoreContent: options.gitignoreContent,
      ownerCapabilityId: DB_CAPABILITY_ID,
    });

    const manifest = await this.getManifest();
    const capability = capabilityFromManifest(manifest);
    const ownershipRegistrations = [
      ...buildDbOwnershipRegistrations(DB_CAPABILITY_ID),
      ...envPlan.ownershipRegistrations,
    ];

    return {
      transforms: [...dbTransforms, ...envPlan.transforms],
      capability,
      ownershipRegistrations,
      envPlan,
    };
  }

  registerOwnership(tracker: OwnershipTracker): void {
    const registrations = buildDbOwnershipRegistrations(DB_CAPABILITY_ID);

    for (const registration of registrations) {
      tracker.register(registration);
    }

    this.envCapability.registerOwnership(tracker, DB_ENV_VARS);
  }
}

export function buildDbTransforms(prismaInstalled: boolean): TransformPipeline {
  const builder = createTransformPipeline();

  if (!prismaInstalled) {
    builder.packageJsonMutation(
      `${DB_CAPABILITY_ID}-install-prisma`,
      {
        dependencies: { [PRISMA_CLIENT_PACKAGE]: PRISMA_VERSION },
        devDependencies: { [PRISMA_CLI_PACKAGE]: PRISMA_VERSION },
      },
      'Install Prisma'
    );
  }

  return builder.build();
}

async function hasDependency(rootPath: string, dependencyName: string): Promise<boolean> {
  const packageJson = await readPackageJson(rootPath);
  if (!packageJson) {
    return false;
  }

  const dependencies = isRecord(packageJson.dependencies) ? packageJson.dependencies : {};
  const devDependencies = isRecord(packageJson.devDependencies)
    ? packageJson.devDependencies
    : {};

  return dependencyName in dependencies || dependencyName in devDependencies;
}

async function readPackageJson(rootPath: string): Promise<Record<string, unknown> | null> {
  const packageJsonPath = join(rootPath, 'package.json');
  if (!(await fileExists(packageJsonPath))) {
    return null;
  }

  const content = await readFile(packageJsonPath, 'utf8');
  return JSON.parse(content) as Record<string, unknown>;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
