import { access } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
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
  buildProviderMergePatch,
  createAuthConfigContent,
  createMiddlewareContent,
  createRouteHandlerContent,
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

export function buildAuthEnvVars(providers: string[], generateSecret = true): EnvVariableMap {
  const envVars: EnvVariableMap = generateSecret
    ? { AUTH_SECRET: { value: randomBytes(32).toString('base64'), required: true } }
    : {};

  for (const providerId of providers) {
    const provider = resolveProvider(providerId);
    for (const envVar of provider.envVars) {
      envVars[envVar] = { example: 'replace-me', required: true };
    }
  }

  return envVars;
}

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
    const requestedProviders = options.providers ?? [];
    const existingProviders = options.existingProviders ?? [];
    for (const providerId of [...requestedProviders, ...existingProviders]) {
      resolveProvider(providerId);
    }

    const newProviders = requestedProviders.filter((id) => !existingProviders.includes(id));
    const allProviders = [...existingProviders, ...newProviders];

    const sourceRoot = options.sourceRoot ?? (await detectSourceRoot(rootPath));
    const paths = buildAuthFilePaths(sourceRoot);

    const tracker = options.tracker ?? new OwnershipTracker();
    validateAuthOwnership(paths, tracker, AUTH_CAPABILITY_ID, allProviders);

    const authFileExists =
      options.authFileExists ?? (await fileExists(join(rootPath, paths.authFile)));
    const middlewareFileExists =
      options.middlewareFileExists ??
      (await fileExists(join(rootPath, paths.middlewareFile)));
    const routeHandlerFileExists =
      options.routeHandlerFileExists ??
      (await fileExists(join(rootPath, paths.routeHandlerFile)));
    const nextAuthInstalled =
      options.nextAuthInstalled ?? (await hasDependency(rootPath, NEXT_AUTH_PACKAGE));

    assertNoUnownedFile(tracker, paths.authFile, authFileExists, AUTH_CAPABILITY_ID);
    assertNoUnownedFile(tracker, paths.middlewareFile, middlewareFileExists, AUTH_CAPABILITY_ID);
    assertNoUnownedFile(
      tracker,
      paths.routeHandlerFile,
      routeHandlerFileExists,
      AUTH_CAPABILITY_ID
    );

    const authTransforms = buildAuthTransforms(
      paths,
      authFileExists,
      middlewareFileExists,
      routeHandlerFileExists,
      nextAuthInstalled,
      allProviders
    );

    if (authFileExists && newProviders.length > 0) {
      const currentAuthFileContent =
        options.authFileContent ??
        (await readFile(join(rootPath, paths.authFile), 'utf8').catch(() => undefined));
      authTransforms.push(
        ...buildProviderMergeTransforms(paths, currentAuthFileContent, existingProviders, newProviders)
      );
    }

    const envPlan = await this.envCapability.planAdd(
      rootPath,
      buildAuthEnvVars(requestedProviders, !authFileExists),
      {
        tracker,
        envExamplePath: options.envExamplePath,
        envExampleExists: options.envExampleExists,
      }
    );

    const manifest = await this.getManifest();
    const capability = buildCapabilityWithOwnership(manifest, paths, allProviders);
    const ownershipRegistrations = [
      ...buildAuthOwnershipRegistrations(paths, AUTH_CAPABILITY_ID, allProviders),
      ...envPlan.ownershipRegistrations,
    ];

    return {
      transforms: [...authTransforms, ...envPlan.transforms],
      capability,
      ownershipRegistrations,
      envPlan,
      paths,
      providers: allProviders,
    };
  }

  registerOwnership(tracker: OwnershipTracker, paths: AuthFilePaths, providers: string[] = []): void {
    const registrations = buildAuthOwnershipRegistrations(paths, AUTH_CAPABILITY_ID, providers);

    for (const registration of registrations) {
      tracker.register(registration);
    }

    this.envCapability.registerOwnership(tracker, buildAuthEnvVars(providers));
  }
}

export function buildAuthFilePaths(sourceRoot = ''): AuthFilePaths {
  const prefix = sourceRoot ? `${sourceRoot.replace(/\\/g, '/')}/` : '';

  return {
    authFile: `${prefix}auth.ts`,
    middlewareFile: `${prefix}middleware.ts`,
    routeHandlerFile: `${prefix}app/api/auth/[...nextauth]/route.ts`,
  };
}

export function buildAuthTransforms(
  paths: AuthFilePaths,
  authFileExists: boolean,
  middlewareFileExists: boolean,
  routeHandlerFileExists: boolean,
  nextAuthInstalled: boolean,
  providers: string[] = []
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
      createAuthConfigContent(providers),
      'Create auth config'
    );
  }

  if (providers.length > 0 && !routeHandlerFileExists) {
    builder.fileCreate(
      `${AUTH_CAPABILITY_ID}-create-route-handler`,
      paths.routeHandlerFile,
      createRouteHandlerContent(),
      'Create NextAuth route handler'
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

function buildProviderMergeTransforms(
  paths: AuthFilePaths,
  currentAuthFileContent: string | undefined,
  existingProviders: string[],
  newProviders: string[]
): TransformPipeline {
  const expectedPriorContent = createAuthConfigContent(existingProviders);

  if (currentAuthFileContent === expectedPriorContent) {
    return createTransformPipeline()
      .fileCreate(
        `${AUTH_CAPABILITY_ID}-merge-providers`,
        paths.authFile,
        createAuthConfigContent([...existingProviders, ...newProviders]),
        'Merge new providers into auth config'
      )
      .build();
  }

  const patch = buildProviderMergePatch(newProviders);
  return createTransformPipeline()
    .filePatch(
      `${AUTH_CAPABILITY_ID}-merge-provider-imports`,
      paths.authFile,
      patch.importSearch,
      patch.importReplace,
      'Add new provider imports to auth config'
    )
    .filePatch(
      `${AUTH_CAPABILITY_ID}-merge-provider-entries`,
      paths.authFile,
      patch.providersSearch,
      patch.providersReplace,
      'Add new providers to auth config providers array'
    )
    .build();
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
  paths: AuthFilePaths,
  providers: string[] = []
): Capability {
  const activePaths: Record<string, string> = { ...paths };
  if (providers.length === 0) {
    delete activePaths.routeHandlerFile;
  }

  const ownedFiles = mergeUnique(manifest.ownership?.files ?? [], Object.values(activePaths));

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
