import { access } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  type Capability,
  type CapabilityManifest,
  capabilityFromManifest,
  loadManifestFromFile,
  loadManifestFromObject,
  OwnershipTracker,
} from '@kiln/core';
import { AUTH_MANIFEST } from './manifest-data.js';
import {
  EnvCapability,
  type EnvVariableMap,
} from '@kiln/env-capability';
import {
  createTransformPipeline,
  type TransformPipeline,
} from '@kiln/transform-engine';
import {
  createAuthConfigContent,
  createMiddlewareContent,
  resolveAuthImportPath,
} from './templates.js';
import {
  AUTH_CAPABILITY_ID,
  NEXT_AUTH_PACKAGE,
  NEXT_AUTH_VERSION,
  type AuthCapabilityPlan,
  type AuthCapabilityPlanOptions,
  type AuthFilePaths,
} from './types.js';
import {
  buildAuthOwnershipRegistrations,
  validateAuthOwnership,
} from './validation.js';
import { resolveProvider } from './providers.js';

const AUTH_ENV_VARS: EnvVariableMap = {
  AUTH_SECRET: { example: 'replace-me', required: true },
};

export class AuthCapability {
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

    return loadManifestFromObject(AUTH_MANIFEST);
  }

  async getCapability(): Promise<Capability> {
    return capabilityFromManifest(await this.getManifest());
  }

  async planAdd(
    rootPath: string,
    options: AuthCapabilityPlanOptions = {}
  ): Promise<AuthCapabilityPlan> {
    const providers = options.providers ?? [];
    for (const providerId of providers) {
      resolveProvider(providerId);
    }

    const sourceRoot = options.sourceRoot ?? (await detectSourceRoot(rootPath));
    const paths = buildAuthFilePaths(sourceRoot);

    const tracker = options.tracker ?? new OwnershipTracker();
    validateAuthOwnership(paths, tracker, AUTH_CAPABILITY_ID);

    const authFileExists =
      options.authFileExists ?? (await fileExists(join(rootPath, paths.authFile)));
    const middlewareFileExists =
      options.middlewareFileExists ??
      (await fileExists(join(rootPath, paths.middlewareFile)));
    const nextAuthInstalled =
      options.nextAuthInstalled ?? (await hasDependency(rootPath, NEXT_AUTH_PACKAGE));

    assertNoUnownedFile(tracker, paths.authFile, authFileExists, AUTH_CAPABILITY_ID);
    assertNoUnownedFile(tracker, paths.middlewareFile, middlewareFileExists, AUTH_CAPABILITY_ID);

    const authTransforms = buildAuthTransforms(
      paths,
      authFileExists,
      middlewareFileExists,
      nextAuthInstalled
    );

    const envPlan = await this.envCapability.planAdd(rootPath, AUTH_ENV_VARS, {
      tracker,
      envExamplePath: options.envExamplePath,
      envExampleExists: options.envExampleExists,
    });

    const manifest = await this.getManifest();
    const capability = buildCapabilityWithOwnership(manifest, paths);
    const ownershipRegistrations = [
      ...buildAuthOwnershipRegistrations(paths, AUTH_CAPABILITY_ID),
      ...envPlan.ownershipRegistrations,
    ];

    return {
      transforms: [...authTransforms, ...envPlan.transforms],
      capability,
      ownershipRegistrations,
      envPlan,
      paths,
      providers,
    };
  }

  registerOwnership(tracker: OwnershipTracker, paths: AuthFilePaths): void {
    const registrations = buildAuthOwnershipRegistrations(paths, AUTH_CAPABILITY_ID);

    for (const registration of registrations) {
      tracker.register(registration);
    }

    this.envCapability.registerOwnership(tracker, AUTH_ENV_VARS);
  }
}

export function buildAuthFilePaths(sourceRoot = ''): AuthFilePaths {
  const prefix = sourceRoot ? `${sourceRoot.replace(/\\/g, '/')}/` : '';

  return {
    authFile: `${prefix}auth.ts`,
    middlewareFile: `${prefix}middleware.ts`,
  };
}

export function buildAuthTransforms(
  paths: AuthFilePaths,
  authFileExists: boolean,
  middlewareFileExists: boolean,
  nextAuthInstalled: boolean
): TransformPipeline {
  const builder = createTransformPipeline();
  const authImportPath = resolveAuthImportPath(paths);

  if (!nextAuthInstalled) {
    builder.packageJsonMutation(
      `${AUTH_CAPABILITY_ID}-install-next-auth`,
      {
        dependencies: { [NEXT_AUTH_PACKAGE]: NEXT_AUTH_VERSION },
      },
      'Install next-auth dependency'
    );
  }

  if (!authFileExists) {
    builder.fileCreate(
      `${AUTH_CAPABILITY_ID}-create-auth-config`,
      paths.authFile,
      createAuthConfigContent(),
      'Create auth config'
    );
  }

  if (!middlewareFileExists) {
    builder.fileCreate(
      `${AUTH_CAPABILITY_ID}-create-middleware`,
      paths.middlewareFile,
      createMiddlewareContent(authImportPath),
      'Create auth middleware'
    );
  }

  return builder.build();
}

function assertNoUnownedFile(
  tracker: OwnershipTracker,
  filePath: string,
  fileExists: boolean,
  ownerCapabilityId: string
): void {
  if (!fileExists) {
    return;
  }

  const currentOwner = tracker.getOwner('file', filePath);
  if (currentOwner === ownerCapabilityId) {
    return;
  }

  if (currentOwner !== undefined) {
    // A different capability already owns this file; let the ownership
    // conflict check surface a consistent error for that case.
    return;
  }

  throw new Error(
    `Refusing to add auth: '${filePath}' already exists and was not created by kiln. ` +
      'Remove or rename the file, or run kiln in a project without a pre-existing auth setup.'
  );
}

async function detectSourceRoot(rootPath: string): Promise<string> {
  if (await fileExists(join(rootPath, 'src', 'app'))) {
    return 'src';
  }

  if (await fileExists(join(rootPath, 'src', 'pages'))) {
    return 'src';
  }

  if (await fileExists(join(rootPath, 'src', 'auth.ts'))) {
    return 'src';
  }

  return '';
}

function buildCapabilityWithOwnership(
  manifest: CapabilityManifest,
  paths: AuthFilePaths
): Capability {
  const ownedFiles = mergeUnique(manifest.ownership?.files ?? [], [
    paths.authFile,
    paths.middlewareFile,
  ]);

  return capabilityFromManifest({
    ...manifest,
    ownership: {
      ...manifest.ownership,
      files: ownedFiles,
      dependencies: mergeUnique(manifest.ownership?.dependencies ?? [], [NEXT_AUTH_PACKAGE]),
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
