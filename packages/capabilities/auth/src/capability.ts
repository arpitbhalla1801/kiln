import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
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
} from '@kiln/core';
import type { Capability } from '@kiln/capability-sdk';
import { AUTH_MANIFEST } from './manifest-data.js';
import {
  buildEnvRemovalTransforms,
  DEFAULT_ENV_LOCAL_PATH,
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
  type AuthAdapterOptions,
} from './templates.js';
import {
  AUTH_CAPABILITY_ID,
  AUTH_PRISMA_ADAPTER_PACKAGE,
  AUTH_PRISMA_ADAPTER_VERSION,
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

const AUTH_SOURCE_ROOT_MARKERS = ['app', 'pages', 'auth.ts'];

// Mirrors @kiln/db-capability's PRISMA_CLIENT_PACKAGE -- not imported directly,
// to avoid a circular workspace dependency between the two capabilities.
const PRISMA_CLIENT_PACKAGE = '@prisma/client';
// Both capabilities place their file at `${sourceRoot}/auth.ts` and
// `${sourceRoot}/lib/db.ts` respectively, so the import from one to the
// other is always this, regardless of what sourceRoot resolves to.
const DB_CLIENT_IMPORT_PATH = './lib/db';

// The credentials provider needs no external OAuth app, so its demo vars get a
// real, working default instead of a placeholder -- the example runs as-is.
const CREDENTIALS_DEMO_DEFAULTS: Record<string, string> = {
  AUTH_DEMO_EMAIL: 'demo@kiln.dev',
  AUTH_DEMO_PASSWORD: 'kiln-demo-password',
};

export function buildAuthEnvVars(providers: string[], generateSecret = true): EnvVariableMap {
  const envVars: EnvVariableMap = generateSecret
    ? { AUTH_SECRET: { value: randomBytes(32).toString('base64'), required: true } }
    : {};

  for (const providerId of providers) {
    const provider = resolveProvider(providerId);
    for (const envVar of provider.envVars) {
      envVars[envVar] =
        envVar in CREDENTIALS_DEMO_DEFAULTS
          ? { value: CREDENTIALS_DEMO_DEFAULTS[envVar], required: true }
          : { example: 'replace-me', required: true };
    }
  }

  return envVars;
}

export class AuthCapability implements Capability {
  readonly id = AUTH_CAPABILITY_ID;
  private readonly envCapability: EnvCapability;

  constructor(envCapability?: EnvCapability) {
    this.envCapability = envCapability ?? new EnvCapability();
  }

  async getManifest(): Promise<CapabilityManifest> {
    return loadManifestFromObject(AUTH_MANIFEST);
  }

  async getCapability(): Promise<ResolvedCapability> {
    return capabilityFromManifest(await this.getManifest());
  }

  async planAdd(
    rootPath: string,
    options: AuthCapabilityPlanOptions
  ): Promise<AuthCapabilityPlan> {
    const requestedProviders = options.providers ?? [];
    const existingProviders = options.existingProviders ?? [];
    for (const providerId of [...requestedProviders, ...existingProviders]) {
      resolveProvider(providerId);
    }

    // Passing --provider at all means "this is the full desired provider set" --
    // reconcile additions and removals. No --provider flags means "leave providers alone".
    const allProviders = requestedProviders.length > 0 ? requestedProviders : existingProviders;
    const newProviders = allProviders.filter((id) => !existingProviders.includes(id));
    const removedProviders = existingProviders.filter((id) => !allProviders.includes(id));

    const sourceRoot = options.sourceRoot ?? (await detectSourceRoot(rootPath, AUTH_SOURCE_ROOT_MARKERS));
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
    const authSecretExists =
      options.authSecretExists ?? (await envLocalHasNonEmptyValue(rootPath, 'AUTH_SECRET'));
    const dbPresent = options.dbPresent ?? (await hasDependency(rootPath, PRISMA_CLIENT_PACKAGE));
    const adapterPackageInstalled = dbPresent
      ? options.adapterPackageInstalled ?? (await hasDependency(rootPath, AUTH_PRISMA_ADAPTER_PACKAGE))
      : true;
    const adapter: AuthAdapterOptions | undefined = dbPresent
      ? { dbClientImportPath: DB_CLIENT_IMPORT_PATH }
      : undefined;

    assertNoUnownedFile(tracker, paths.authFile, authFileExists);
    assertNoUnownedFile(tracker, paths.middlewareFile, middlewareFileExists);
    assertNoUnownedFile(tracker, paths.routeHandlerFile, routeHandlerFileExists);

    const authTransforms = buildAuthTransforms(
      paths,
      authFileExists,
      middlewareFileExists,
      routeHandlerFileExists,
      nextAuthInstalled,
      allProviders,
      adapter,
      adapterPackageInstalled
    );

    if (authFileExists && (newProviders.length > 0 || removedProviders.length > 0)) {
      const currentAuthFileContent =
        options.authFileContent ??
        (await readFile(join(rootPath, paths.authFile), 'utf8').catch(() => undefined));
      authTransforms.push(
        ...buildProviderMergeTransforms(paths, currentAuthFileContent, existingProviders, allProviders)
      );
    } else if (authFileExists && dbPresent) {
      // db was added after auth, with no provider change in this same call: if the
      // file is still kiln's plain, unedited version, it's safe to regenerate with
      // the adapter added. Re-run `kiln add auth` with no --provider to pick this up
      // after adding a provider and db in the same call.
      const currentAuthFileContent =
        options.authFileContent ??
        (await readFile(join(rootPath, paths.authFile), 'utf8').catch(() => undefined));
      if (currentAuthFileContent === createAuthConfigContent(existingProviders)) {
        authTransforms.push(
          ...createTransformPipeline()
            .fileCreate(
              `${AUTH_CAPABILITY_ID}-add-db-adapter`,
              paths.authFile,
              createAuthConfigContent(existingProviders, adapter),
              'Wire Prisma adapter into auth config'
            )
            .build()
        );
      }
    }

    const envPlan = await this.envCapability.planAdd(
      rootPath,
      {
        variables: {
          ...buildAuthEnvVars(allProviders, !authSecretExists),
          ...(options.extraEnvVars ?? {}),
        },
        tracker,
        envExamplePath: options.envExamplePath,
        envExampleExists: options.envExampleExists,
        envLocalExists: options.envLocalExists,
        gitignoreContent: options.gitignoreContent,
        ownerCapabilityId: AUTH_CAPABILITY_ID,
      }
    );

    const manifest = await this.getManifest();
    // Claim next-auth (and the Prisma adapter package, if wired) only when this
    // add installs them, so `kiln remove auth` never removes a dependency the
    // user already had.
    const claimDependency = !nextAuthInstalled;
    const claimAdapterDependency = Boolean(adapter) && !adapterPackageInstalled;
    const capability = buildCapabilityWithOwnership(
      manifest,
      paths,
      allProviders,
      claimDependency,
      claimAdapterDependency
    );
    const ownershipRegistrations = [
      ...buildAuthOwnershipRegistrations(
        paths,
        AUTH_CAPABILITY_ID,
        allProviders,
        claimDependency,
        claimAdapterDependency
      ),
      ...envPlan.ownershipRegistrations,
    ];

    // A dropped provider's vars go too; the runtime releases their ownership.
    const keptVars = new Set(allProviders.flatMap((id) => resolveProvider(id).envVars));
    const droppedVars = removedProviders
      .flatMap((id) => resolveProvider(id).envVars)
      .filter((name) => !keptVars.has(name));
    const envRemovalTransforms =
      droppedVars.length > 0 ? buildEnvRemovalTransforms(droppedVars, options.envExamplePath) : [];

    return {
      transforms: [...authTransforms, ...envPlan.transforms, ...envRemovalTransforms],
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
  providers: string[] = [],
  adapter?: AuthAdapterOptions,
  adapterPackageInstalled = false
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

  if (adapter && !adapterPackageInstalled) {
    builder.packageJsonMutation(
      `${AUTH_CAPABILITY_ID}-install-prisma-adapter`,
      {
        dependencies: { [AUTH_PRISMA_ADAPTER_PACKAGE]: AUTH_PRISMA_ADAPTER_VERSION },
      },
      'Install Auth.js Prisma adapter dependency'
    );
  }

  if (!authFileExists) {
    builder.fileCreate(
      `${AUTH_CAPABILITY_ID}-create-auth-config`,
      paths.authFile,
      createAuthConfigContent(providers, adapter),
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
  desiredProviders: string[]
): TransformPipeline {
  const expectedPriorContent = createAuthConfigContent(existingProviders);

  if (currentAuthFileContent === expectedPriorContent) {
    return createTransformPipeline()
      .fileCreate(
        `${AUTH_CAPABILITY_ID}-merge-providers`,
        paths.authFile,
        createAuthConfigContent(desiredProviders),
        'Reconcile providers in auth config'
      )
      .build();
  }

  // File was hand-edited: we can only safely append new providers via patch,
  // not remove ones we can't locate reliably in arbitrary edited content.
  const newProviders = desiredProviders.filter((id) => !existingProviders.includes(id));
  if (newProviders.length === 0) {
    return createTransformPipeline().build();
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

async function envLocalHasNonEmptyValue(rootPath: string, key: string): Promise<boolean> {
  const content = await readFile(join(rootPath, DEFAULT_ENV_LOCAL_PATH), 'utf8').catch(() => undefined);
  if (content === undefined) {
    return false;
  }

  const match = new RegExp(`^${key}=(.*)$`, 'm').exec(content);
  return match !== null && match[1].trim() !== '';
}

function assertNoUnownedFile(tracker: OwnershipTracker, filePath: string, fileExists: boolean): void {
  if (!fileExists) {
    return;
  }

  const currentOwner = tracker.getOwner('file', filePath);
  if (currentOwner === undefined) {
    throw new Error(
      `Refusing to add auth: '${filePath}' already exists and was not created by kiln. ` +
        'Remove or rename the file, or run kiln in a project without a pre-existing auth setup.'
    );
  }
}

function buildCapabilityWithOwnership(
  manifest: CapabilityManifest,
  paths: AuthFilePaths,
  providers: string[] = [],
  claimDependency = true,
  claimAdapterDependency = false
): ResolvedCapability {
  const activePaths: Record<string, string> = { ...paths };
  if (providers.length === 0) {
    delete activePaths.routeHandlerFile;
  }

  const ownedFiles = mergeUnique(manifest.ownership?.files ?? [], Object.values(activePaths));
  const dependencies = [
    ...(claimDependency ? [NEXT_AUTH_PACKAGE] : []),
    ...(claimAdapterDependency ? [AUTH_PRISMA_ADAPTER_PACKAGE] : []),
  ];

  return capabilityFromManifest({
    ...manifest,
    ownership: {
      ...manifest.ownership,
      files: ownedFiles,
      dependencies:
        dependencies.length > 0
          ? mergeUnique(manifest.ownership?.dependencies ?? [], dependencies)
          : [],
    },
  });
}

