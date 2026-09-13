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
import { createDbClientContent, createSchemaPrismaContent } from './templates.js';
import {
  DB_CAPABILITY_ID,
  PRISMA_CLIENT_PACKAGE,
  PRISMA_CLI_PACKAGE,
  PRISMA_VERSION,
  type DbCapabilityPlan,
  type DbCapabilityPlanOptions,
  type DbFilePaths,
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
    const sourceRoot = options.sourceRoot ?? (await detectSourceRoot(rootPath));
    const paths = buildDbFilePaths(sourceRoot);

    const tracker = options.tracker ?? new OwnershipTracker();
    validateDbOwnership(paths, tracker, DB_CAPABILITY_ID);

    const prismaInstalled =
      options.prismaInstalled ?? (await hasDependency(rootPath, PRISMA_CLI_PACKAGE));
    const schemaFileExists =
      options.schemaFileExists ?? (await fileExists(join(rootPath, paths.schemaFile)));
    const clientFileExists =
      options.clientFileExists ?? (await fileExists(join(rootPath, paths.clientFile)));

    assertNoUnownedFile(tracker, paths.schemaFile, schemaFileExists);
    assertNoUnownedFile(tracker, paths.clientFile, clientFileExists);

    const dbTransforms = buildDbTransforms(paths, prismaInstalled, schemaFileExists, clientFileExists);

    const envPlan = await this.envCapability.planAdd(rootPath, DB_ENV_VARS, {
      tracker,
      envExamplePath: options.envExamplePath,
      envExampleExists: options.envExampleExists,
      envLocalExists: options.envLocalExists,
      gitignoreContent: options.gitignoreContent,
      ownerCapabilityId: DB_CAPABILITY_ID,
    });

    const manifest = await this.getManifest();
    const capability = buildCapabilityWithOwnership(manifest, paths);
    const ownershipRegistrations = [
      ...buildDbOwnershipRegistrations(paths, DB_CAPABILITY_ID),
      ...envPlan.ownershipRegistrations,
    ];

    return {
      transforms: [...dbTransforms, ...envPlan.transforms],
      capability,
      ownershipRegistrations,
      envPlan,
      paths,
    };
  }

  registerOwnership(tracker: OwnershipTracker, paths: DbFilePaths): void {
    const registrations = buildDbOwnershipRegistrations(paths, DB_CAPABILITY_ID);

    for (const registration of registrations) {
      tracker.register(registration);
    }

    this.envCapability.registerOwnership(tracker, DB_ENV_VARS);
  }
}

export function buildDbFilePaths(sourceRoot = ''): DbFilePaths {
  const prefix = sourceRoot ? `${sourceRoot.replace(/\\/g, '/')}/` : '';

  return {
    schemaFile: 'prisma/schema.prisma',
    clientFile: `${prefix}lib/db.ts`,
  };
}

export function buildDbTransforms(
  paths: DbFilePaths,
  prismaInstalled: boolean,
  schemaFileExists: boolean,
  clientFileExists: boolean
): TransformPipeline {
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

  if (!schemaFileExists) {
    builder.fileCreate(
      `${DB_CAPABILITY_ID}-create-schema`,
      paths.schemaFile,
      createSchemaPrismaContent(),
      'Create Prisma schema'
    );
  }

  if (!clientFileExists) {
    builder.fileCreate(
      `${DB_CAPABILITY_ID}-create-client`,
      paths.clientFile,
      createDbClientContent(),
      'Create Prisma client singleton'
    );
  }

  return builder.build();
}

function assertNoUnownedFile(tracker: OwnershipTracker, filePath: string, fileExists: boolean): void {
  if (!fileExists) {
    return;
  }

  const currentOwner = tracker.getOwner('file', filePath);
  if (currentOwner !== undefined) {
    return;
  }

  throw new Error(
    `Refusing to add db: '${filePath}' already exists and was not created by kiln. ` +
      'Remove or rename the file, or run kiln in a project without a pre-existing db setup.'
  );
}

async function detectSourceRoot(rootPath: string): Promise<string> {
  if (await fileExists(join(rootPath, 'src', 'app'))) {
    return 'src';
  }

  if (await fileExists(join(rootPath, 'src', 'pages'))) {
    return 'src';
  }

  return '';
}

function buildCapabilityWithOwnership(manifest: CapabilityManifest, paths: DbFilePaths): Capability {
  const ownedFiles = mergeUnique(manifest.ownership?.files ?? [], Object.values(paths));

  return capabilityFromManifest({
    ...manifest,
    ownership: {
      ...manifest.ownership,
      files: ownedFiles,
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
