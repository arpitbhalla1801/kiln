import { access } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type Capability,
  type CapabilityManifest,
  capabilityFromManifest,
  loadManifestFromFile,
  OwnershipTracker,
} from '@kiln/core';
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

const AUTH_ENV_VARS: EnvVariableMap = {
  AUTH_SECRET: { example: 'replace-me', required: true },
};

export class AuthCapability {
  readonly manifestPath: string;
  private readonly envCapability: EnvCapability;

  constructor(manifestPath?: string, envCapability?: EnvCapability) {
    this.manifestPath = manifestPath ?? defaultManifestPath();
    this.envCapability = envCapability ?? new EnvCapability();
  }

  async getManifest(): Promise<CapabilityManifest> {
    return loadManifestFromFile(this.manifestPath);
  }

  async getCapability(): Promise<Capability> {
    return capabilityFromManifest(await this.getManifest());
  }

  async planAdd(
    rootPath: string,
    options: AuthCapabilityPlanOptions = {}
  ): Promise<AuthCapabilityPlan> {
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

function defaultManifestPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../kiln.manifest.json');
}
