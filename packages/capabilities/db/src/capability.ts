import { join } from 'node:path';
import {
  type Capability as ResolvedCapability,
  type CapabilityManifest,
  capabilityFromManifest,
  detectSourceRoot,
  fileExists,
  hasDependency,
  loadManifestFromObject,
  mergeUnique,
  OwnershipTracker,
  readPackageJson,
} from '@kiln/core';
import type { Capability } from '@kiln/capability-sdk';
import { DB_MANIFEST } from './manifest-data.js';
import { EnvCapability, type EnvVariableMap } from '@kiln/env-capability';
import { createTransformPipeline, type TransformPipeline } from '@kiln/transform-engine';
import { createDbClientContent, createSchemaPrismaContent } from './templates.js';
import {
  DB_CAPABILITY_ID,
  DB_SCRIPTS,
  PRISMA_CLIENT_PACKAGE,
  PRISMA_CLI_PACKAGE,
  PRISMA_VERSION,
  type DbCapabilityPlan,
  type DbCapabilityPlanOptions,
  type DbFilePaths,
} from './types.js';
import { buildDbOwnershipRegistrations, validateDbOwnership } from './validation.js';

const DB_SOURCE_ROOT_MARKERS = ['app', 'pages'];

const DB_ENV_VARS: EnvVariableMap = {
  DATABASE_URL: { example: 'postgres://localhost:5432/app', required: true },
};

export class DbCapability implements Capability {
  readonly id = DB_CAPABILITY_ID;
  private readonly envCapability: EnvCapability;

  constructor(envCapability?: EnvCapability) {
    this.envCapability = envCapability ?? new EnvCapability();
  }

  async getManifest(): Promise<CapabilityManifest> {
    return loadManifestFromObject(DB_MANIFEST);
  }

  async getCapability(): Promise<ResolvedCapability> {
    return capabilityFromManifest(await this.getManifest());
  }

  async planAdd(
    rootPath: string,
    options: DbCapabilityPlanOptions
  ): Promise<DbCapabilityPlan> {
    const sourceRoot = options.sourceRoot ?? (await detectSourceRoot(rootPath, DB_SOURCE_ROOT_MARKERS));
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

    const clientInstalled =
      options.clientInstalled ??
      options.prismaInstalled ??
      (await hasDependency(rootPath, PRISMA_CLIENT_PACKAGE));
    const existingScripts = options.existingScripts ?? (await readExistingScripts(rootPath));

    const dbTransforms = buildDbTransforms(
      paths,
      prismaInstalled,
      schemaFileExists,
      clientFileExists,
      clientInstalled,
      existingScripts
    );

    const envPlan = await this.envCapability.planAdd(rootPath, {
      variables: DB_ENV_VARS,
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
    // Prisma always looks for the schema at the repo root, regardless of
    // where application source lives, so sourceRoot never applies here.
    schemaFile: 'prisma/schema.prisma',
    clientFile: `${prefix}lib/db.ts`,
  };
}

export function buildDbTransforms(
  paths: DbFilePaths,
  prismaInstalled: boolean,
  schemaFileExists: boolean,
  clientFileExists: boolean,
  clientInstalled = prismaInstalled,
  existingScripts: Record<string, string> = {}
): TransformPipeline {
  const builder = createTransformPipeline();

  if (!clientInstalled || !prismaInstalled) {
    builder.packageJsonMutation(
      `${DB_CAPABILITY_ID}-install-prisma`,
      {
        ...(clientInstalled ? {} : { dependencies: { [PRISMA_CLIENT_PACKAGE]: PRISMA_VERSION } }),
        ...(prismaInstalled ? {} : { devDependencies: { [PRISMA_CLI_PACKAGE]: PRISMA_VERSION } }),
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

  const missingScripts = Object.fromEntries(
    Object.entries(DB_SCRIPTS).filter(([name]) => !(name in existingScripts))
  );
  if (Object.keys(missingScripts).length > 0) {
    builder.packageJsonMutation(
      `${DB_CAPABILITY_ID}-add-scripts`,
      { scripts: missingScripts },
      'Add Prisma scripts'
    );
  }

  return builder.build();
}

async function readExistingScripts(rootPath: string): Promise<Record<string, string>> {
  const scripts = (await readPackageJson(rootPath))?.scripts;
  return typeof scripts === 'object' && scripts !== null ? (scripts as Record<string, string>) : {};
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

function buildCapabilityWithOwnership(manifest: CapabilityManifest, paths: DbFilePaths): ResolvedCapability {
  const ownedFiles = mergeUnique(manifest.ownership?.files ?? [], Object.values(paths));

  return capabilityFromManifest({
    ...manifest,
    ownership: {
      ...manifest.ownership,
      files: ownedFiles,
    },
  });
}

