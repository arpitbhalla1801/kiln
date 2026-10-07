import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AuthCapability } from '@kiln-cli/auth-capability';
import type {
  Capability as PluginCapability,
  CapabilityPlanOptions,
} from '@kiln-cli/capability-sdk';
import {
  type Capability,
  createEmptyProjectState,
  LifecycleExecutor,
  LifecycleHooks,
  OwnershipTracker,
  ProjectState,
  ValidationRunner,
  withActiveAdapters,
} from '@kiln-cli/core';
import { DbCapability } from '@kiln-cli/db-capability';
import { EnvCapability, type EnvVariableMap } from '@kiln-cli/env-capability';
import { NodeAdapter } from '@kiln-cli/node-adapter';
import { createPlanExecutor, type CapabilityExecutionPlan } from '@kiln-cli/planner';
import {
  FileHashStore,
  hashContent,
  loadOwnershipTracker,
  LockfileStore,
  ownershipMetadataFromSnapshot,
  OwnershipMetadataStore,
  PluginConfigStore,
  saveOwnershipTracker,
  type KilnLockfile,
} from '@kiln-cli/project-model';
import { TransformEngine } from '@kiln-cli/transform-engine';
import { CAPABILITY_REGISTRY, enhancersOf, registerCapability } from './capability-registry.js';
import { extractInstallDependencies } from './install.js';
import { loadPlugins as loadPluginModules, type PluginLoadResult } from './plugin-loader.js';
import pkg from '../package.json' with { type: 'json' };
import type {
  CapabilityPlanResult,
  KilnRuntimeContext,
  RuntimeExecutionResult,
  RuntimeOptions,
  SupportedCapabilityId,
} from './types.js';

// auth and db fold env's plan into their own planAdd, so a missing `env` install
// never blocks them. Any other capability must have its requires installed.
const SELF_PROVISIONED_REQUIRES: Record<string, string[]> = { auth: ['env'], db: ['env'] };

export interface CapabilityRuntimeOptions {
  adapter?: NodeAdapter;
  envCapability?: EnvCapability;
  authCapability?: AuthCapability;
  dbCapability?: DbCapability;
  /** Additional capability instances to register alongside the built-ins, keyed by id. */
  capabilities?: Record<string, PluginCapability>;
}

export class CapabilityRuntime {
  private readonly adapter: NodeAdapter;
  private readonly envCapability: EnvCapability;
  private readonly authCapability: AuthCapability;
  private readonly dbCapability: DbCapability;
  private readonly capabilities: Map<string, PluginCapability>;
  private readonly pluginProvenance: Map<string, string> = new Map();
  private readonly lifecycleHooks: LifecycleHooks<KilnRuntimeContext>;

  constructor(options: CapabilityRuntimeOptions = {}) {
    this.adapter = options.adapter ?? new NodeAdapter();
    this.envCapability = options.envCapability ?? new EnvCapability();
    this.authCapability = options.authCapability ?? new AuthCapability();
    this.dbCapability = options.dbCapability ?? new DbCapability();
    this.capabilities = new Map<string, PluginCapability>([
      ['env', this.envCapability],
      ['auth', this.authCapability],
      ['db', this.dbCapability],
      ...Object.entries(options.capabilities ?? {}),
    ]);
    this.lifecycleHooks = new LifecycleHooks<KilnRuntimeContext>();
    this.registerDefaultHooks();
  }

  getLifecycleHooks(): LifecycleHooks<KilnRuntimeContext> {
    return this.lifecycleHooks;
  }

  /**
   * Loads and registers every third-party capability listed in the target
   * project's kiln.plugins.json (strict trust model: direct dependency,
   * exact version pin, loaded only from the project's own node_modules).
   * A broken or hostile plugin is skipped, never thrown -- it must not
   * block a built-in capability, or any other plugin, from working.
   */
  async loadPlugins(rootPath: string): Promise<PluginLoadResult[]> {
    const config = await PluginConfigStore.load(rootPath);
    if (config.plugins.length === 0) {
      return [];
    }

    const results = await loadPluginModules(rootPath, config.plugins);

    for (const result of results) {
      if (result.capability) {
        const manifest = await result.capability.getManifest();
        registerCapability(result.capability.id, manifest.dependencies, manifest.enhances);
        this.capabilities.set(result.capability.id, result.capability);
        this.pluginProvenance.set(result.capability.id, result.entry.package);
      } else {
        console.error(`kiln: skipping plugin '${result.entry.package}': ${result.reason}`);
      }
    }

    return results;
  }

  /** The npm package a registered capability id was loaded from, if any. */
  getPluginPackage(capabilityId: string): string | undefined {
    return this.pluginProvenance.get(capabilityId);
  }

  async addCapability(
    id: string,
    options: RuntimeOptions & Record<string, unknown> = {}
  ): Promise<RuntimeExecutionResult> {
    const capability = this.capabilities.get(id);
    if (!capability) {
      throw new Error(`Unknown capability: '${id}'`);
    }

    const rootPath = options.cwd ?? process.cwd();
    const missing = await this.findMissingRequires(id, rootPath);
    if (missing.length > 0) {
      throw new Error(formatMissingRequires(id, missing));
    }

    const tracker = await loadOwnershipTracker(rootPath);
    const lockfile = await LockfileStore.load(rootPath);
    const existingProviders =
      lockfile?.snapshot.capabilities.find((entry) => entry.id === id)?.providers ?? [];

    const planOptions: CapabilityPlanOptions & Record<string, unknown> = {
      ...options,
      tracker,
      existingProviders,
    };
    const capabilityPlan = await capability.planAdd(rootPath, planOptions);

    const result = await this.executeCapabilityPlan(id, rootPath, capabilityPlan, options);

    // A capability that `enhances` this one (e.g. db enhances auth) adapts its own output
    // to this one's presence on ITS next add, but nothing re-triggers that add. So after
    // adding X, re-run planAdd for every installed capability that enhances X, giving a
    // single `kiln add` the fully wired result regardless of add order.
    if (!options.dryRun && !options.skipSiblingRefresh) {
      const installed = await this.installedIds(rootPath);
      for (const enhancerId of enhancersOf(id)) {
        if (this.capabilities.has(enhancerId) && installed.has(enhancerId)) {
          await this.addCapability(enhancerId, { ...options, skipSiblingRefresh: true });
        }
      }
    }

    return result;
  }

  /**
   * Preview of `addCapability` for `kiln plan`: reports ownership conflicts as
   * data instead of throwing, and never installs or writes. Always dry-run.
   */
  async planCapability(
    id: string,
    options: RuntimeOptions & Record<string, unknown> = {}
  ): Promise<CapabilityPlanResult> {
    const capability = this.capabilities.get(id);
    if (!capability) {
      throw new Error(`Unknown capability: '${id}'`);
    }

    const rootPath = options.cwd ?? process.cwd();

    const missing = await this.findMissingRequires(id, rootPath);
    if (missing.length > 0) {
      return {
        capabilityId: id,
        inspection: await this.adapter.inspect(rootPath),
        conflicts: [formatMissingRequires(id, missing)],
        ownershipUpdates: [],
        preview: undefined,
        resolvedDependencies: new Map(),
      };
    }

    const tracker = await loadOwnershipTracker(rootPath);
    const lockfile = await LockfileStore.load(rootPath);
    const existingProviders =
      lockfile?.snapshot.capabilities.find((entry) => entry.id === id)?.providers ?? [];

    const planOptions: CapabilityPlanOptions & Record<string, unknown> = {
      ...options,
      tracker,
      existingProviders,
    };

    // Every built-in capability's own planAdd already validates ownership and
    // throws a formatOwnershipConflict message on conflict (see each
    // capability's validation.ts). That is the actual source of truth for
    // conflicts -- catch it here instead of re-deriving conflicts ourselves,
    // so plan and add can never disagree about what counts as a conflict.
    let capabilityPlan: CapabilityExecutionPlan;
    try {
      capabilityPlan = await capability.planAdd(rootPath, planOptions);
    } catch (error) {
      return {
        capabilityId: id,
        inspection: await this.adapter.inspect(rootPath),
        conflicts: [error instanceof Error ? error.message : String(error)],
        ownershipUpdates: [],
        preview: undefined,
        resolvedDependencies: new Map(),
      };
    }

    let result: RuntimeExecutionResult;
    try {
      result = await this.executeCapabilityPlan(id as SupportedCapabilityId, rootPath, capabilityPlan, {
        ...options,
        dryRun: true,
      });
    } catch (error) {
      return {
        capabilityId: id,
        inspection: await this.adapter.inspect(rootPath),
        conflicts: [error instanceof Error ? error.message : String(error)],
        ownershipUpdates: [],
        preview: undefined,
        resolvedDependencies: new Map(),
      };
    }

    const ownershipUpdates = (capabilityPlan.ownershipRegistrations ?? [])
      .filter((registration) => tracker.getOwner(registration.resourceType, registration.resourceKey) !== registration.ownerCapabilityId)
      .map(
        (registration) =>
          `${registration.resourceType} ${registration.resourceKey} -> ${registration.ownerCapabilityId}`
      );

    return {
      capabilityId: id,
      inspection: result.inspection,
      conflicts: [],
      ownershipUpdates,
      preview: result.preview,
      resolvedDependencies: result.resolvedDependencies,
    };
  }

  /** @deprecated use addCapability('env', { ...options, variables }) */
  async addEnv(
    variables: EnvVariableMap,
    options: RuntimeOptions = {}
  ): Promise<RuntimeExecutionResult> {
    return this.addCapability('env', { ...options, variables });
  }

  /** @deprecated use addCapability('auth', options) */
  async addAuth(options: RuntimeOptions = {}): Promise<RuntimeExecutionResult> {
    return this.addCapability('auth', { ...options });
  }

  /** @deprecated use addCapability('db', options) */
  async addDb(options: RuntimeOptions = {}): Promise<RuntimeExecutionResult> {
    return this.addCapability('db', { ...options });
  }

  async executeCapability(
    capabilityId: SupportedCapabilityId,
    options: RuntimeOptions = {},
    payload?: EnvVariableMap
  ): Promise<RuntimeExecutionResult> {
    return this.addCapability(capabilityId, {
      ...options,
      ...(payload ? { variables: payload } : {}),
    });
  }

  private async installedIds(rootPath: string): Promise<Set<string>> {
    const lockfile = await LockfileStore.load(rootPath);
    return new Set(lockfile?.snapshot.capabilities.map((entry) => entry.id) ?? []);
  }

  /** Installed capabilities that require `id`, i.e. the ones that must be removed before it. */
  async findInstalledDependents(id: string, rootPath: string): Promise<string[]> {
    const installed = await this.installedIds(rootPath);
    return [...installed].filter((installedId) => requiredIds(installedId).includes(id));
  }

  /** Required capabilities of `id` that the project's lockfile does not list as installed. */
  private async findMissingRequires(id: string, rootPath: string): Promise<string[]> {
    const required = requiredIds(id);
    if (required.length === 0) {
      return [];
    }
    const installed = await this.installedIds(rootPath);
    return required.filter((dependency) => !installed.has(dependency));
  }

  private async executeCapabilityPlan(
    capabilityId: SupportedCapabilityId,
    rootPath: string,
    capabilityPlan: CapabilityExecutionPlan,
    options: RuntimeOptions
  ): Promise<RuntimeExecutionResult> {
    const context: KilnRuntimeContext = {
      cwd: rootPath,
      rootPath,
      dryRun: options.dryRun ?? false,
      capabilityId,
      capabilityPlan,
      options: {
        dryRun: options.dryRun ?? false,
      },
      state: {},
    };

    const lifecycle = new LifecycleExecutor<KilnRuntimeContext>(this.lifecycleHooks);
    await lifecycle.execute(context);

    if (!context.inspection || !context.capabilityPlan || !context.preview || !context.resolvedDependencies) {
      throw new Error('Capability runtime did not complete all lifecycle phases');
    }

    return {
      capabilityId,
      dryRun: context.dryRun,
      preview: context.preview,
      resolvedDependencies: context.resolvedDependencies,
      inspection: context.inspection,
      capabilityPlan: context.capabilityPlan,
      warnings: context.warnings ?? [],
    };
  }

  private registerDefaultHooks(): void {
    this.lifecycleHooks.register('resolve', async (context) => {
      context.inspection = await this.adapter.inspect(context.rootPath);
      context.state.inspection = context.inspection;
    });

    this.lifecycleHooks.register('validate', async (context) => {
      if (!context.capabilityPlan) {
        throw new Error('Capability plan is required before validation');
      }

      const tracker = await loadOwnershipTracker(context.rootPath);
      const projectState = this.buildProjectState(context, tracker);
      const validationRunner = new ValidationRunner(projectState);

      const capabilities = await this.buildValidationCapabilities(
        context.capabilityId,
        context.capabilityPlan.capability
      );

      validationRunner.validatePlan({
        capabilities,
        transforms: [],
      });

      context.state.projectState = projectState;
    });

    this.lifecycleHooks.register('transform', async (context) => {
      if (!context.capabilityPlan) {
        throw new Error('Capability plan is required before transform');
      }

      const tracker = await loadOwnershipTracker(context.rootPath);
      const engine = new TransformEngine();
      const planExecutor = createPlanExecutor(engine, tracker);

      await engine.seedFromDisk(context.rootPath, context.capabilityPlan.transforms);
      planExecutor.queueCapabilityPlan(context.capabilityPlan);
      const finalized = planExecutor.finalize();

      context.preview = await engine.execute({
        dryRun: context.dryRun,
        rootDir: context.rootPath,
      });
      context.warnings = await findSkippedEditedFiles(
        context.rootPath,
        context.capabilityPlan.capability.files ?? [],
        context.preview.operations.map((operation) => operation.filePath)
      );
      context.resolvedDependencies = finalized.resolvedDependencies;
      context.dependenciesToInstall = extractInstallDependencies(context.capabilityPlan.transforms);
      context.state.preview = context.preview;
      context.state.engine = engine;
      context.state.tracker = tracker;
    });

    this.lifecycleHooks.register('install', async (context) => {
      if (context.dryRun || !context.dependenciesToInstall) {
        return;
      }

      const { dependencies, devDependencies } = context.dependenciesToInstall;
      const installResults = [];

      if (Object.keys(dependencies).length > 0) {
        installResults.push(await this.adapter.installDependencies(context.rootPath, dependencies));
      }

      if (Object.keys(devDependencies).length > 0) {
        installResults.push(
          await this.adapter.installDependencies(context.rootPath, devDependencies, { dev: true })
        );
      }

      for (const result of installResults) {
        if (result.exitCode !== 0) {
          throw new Error(
            `Dependency install failed: ${result.stderr || result.stdout || 'unknown error'}`
          );
        }
      }

      context.state.installResult = installResults[installResults.length - 1];
    });

    this.lifecycleHooks.register('finalize', async (context) => {
      if (context.dryRun) {
        return;
      }

      const tracker = context.state.tracker as OwnershipTracker | undefined;
      if (!tracker) {
        throw new Error('Ownership tracker missing during finalize');
      }

      // A var this capability's plan removes (e.g. a dropped auth provider's) stops being owned.
      const capabilityId = context.capabilityPlan?.capability.id;
      const released = new Set(
        (context.capabilityPlan?.transforms ?? []).flatMap((transform) =>
          transform.type === 'env-mutation' ? transform.removeVariables ?? [] : []
        )
      );
      if (released.size > 0) {
        const snapshot = tracker.toSnapshot();
        await OwnershipMetadataStore.save(
          ownershipMetadataFromSnapshot({
            ...snapshot,
            envVars: snapshot.envVars.filter(
              (entry) => !(released.has(entry.name) && entry.ownerCapabilityId === capabilityId)
            ),
          }),
          context.rootPath
        );
      } else {
        await saveOwnershipTracker(tracker, context.rootPath);
      }

      // Remember what kiln wrote so `kiln remove` can keep files the user has since edited.
      // Hash from disk, not plan content: env merges extend a file after it is created, and a
      // later capability can extend a file an earlier one created (both are kiln edits).
      const known = await FileHashStore.load(context.rootPath);
      const written: Record<string, string> = {};
      for (const transform of context.capabilityPlan?.transforms ?? []) {
        const touchesFile =
          transform.type === 'file-create' ||
          ((transform.type === 'file-patch' || transform.type === 'env-mutation') &&
            transform.filePath in known);
        if (touchesFile) {
          const onDisk = await readFile(join(context.rootPath, transform.filePath), 'utf8').catch(
            () => undefined
          );
          if (onDisk !== undefined) {
            written[transform.filePath] = onDisk;
          }
        }
      }
      await FileHashStore.update(context.rootPath, written);

      await this.updateLockfile(context);
    });
  }

  private async updateLockfile(context: KilnRuntimeContext): Promise<void> {
    if (!context.capabilityPlan || !context.resolvedDependencies) {
      return;
    }

    const existing = await LockfileStore.load(context.rootPath);
    const capability = context.capabilityPlan.capability;
    const pluginPackage = this.getPluginPackage(capability.id);

    const entry = {
      id: capability.id,
      version: capability.version,
      resolved: pluginPackage
        ? `npm:${pluginPackage}@${capability.version}`
        : `capability:${capability.id}@${capability.version}`,
      dependencies: Object.fromEntries(context.resolvedDependencies),
      ...(context.capabilityPlan.providers ? { providers: context.capabilityPlan.providers } : {}),
    };

    const otherCapabilities = (existing?.snapshot.capabilities ?? []).filter(
      (item) => item.id !== capability.id
    );

    const lockfile: KilnLockfile = {
      lockfileVersion: existing?.lockfileVersion ?? 1,
      project: {
        name: context.inspection?.packageName ?? 'unknown',
        version: context.inspection?.packageVersion ?? '0.0.0',
      },
      snapshot: {
        capabilities: [...otherCapabilities, entry],
        timestamp: new Date().toISOString(),
        engineVersion: pkg.version,
        lastCapability: capability.id,
      },
    };

    await LockfileStore.save(lockfile, context.rootPath);
  }

  private buildProjectState(context: KilnRuntimeContext, tracker: OwnershipTracker): ProjectState {
    const snapshot = tracker.toSnapshot();
    const fileOwnership = new Map(
      snapshot.files.map((entry) => [entry.filePath, entry.ownerCapabilityId])
    );

    return withActiveAdapters(
      {
        ...createEmptyProjectState(),
        fileOwnership,
      },
      [this.adapter.id]
    );
  }

  private getCapabilityAccessor(capabilityId: string): (() => Promise<Capability>) | undefined {
    const capability = this.capabilities.get(capabilityId);
    return capability ? () => capability.getCapability() : undefined;
  }

  private async buildValidationCapabilities(
    capabilityId: SupportedCapabilityId,
    capability: CapabilityExecutionPlan['capability']
  ): Promise<CapabilityExecutionPlan['capability'][]> {
    const dependencyIds = CAPABILITY_REGISTRY[capabilityId]?.dependencies ?? [];
    const dependencies: Capability[] = [];

    for (const dependencyId of dependencyIds) {
      const accessor = this.getCapabilityAccessor(dependencyId);
      if (accessor) {
        // Dependencies are validated for presence only. A dependency's files may already be owned
        // by the capability being added (auth-only installs own .env.example), so claiming them
        // here would fail every re-run. Ownership is enforced when the dependency itself executes.
        dependencies.push({
          ...(await accessor()),
          files: [],
          ownedDependencies: [],
          ownedScripts: [],
          ownedEnvVars: [],
          ownedMetadata: [],
        });
      }
    }

    return [...dependencies, capability];
  }
}

/** What `id` requires (without the ones it provisions itself) and what it enhances, for display. */
export function capabilityLinks(id: string): { requires: string[]; enhances: string[] } {
  return { requires: requiredIds(id), enhances: CAPABILITY_REGISTRY[id]?.enhances ?? [] };
}

/** `id`'s requires, minus the ones it provisions itself. */
function requiredIds(id: string): string[] {
  return (CAPABILITY_REGISTRY[id]?.dependencies ?? []).filter(
    (dependency) => !SELF_PROVISIONED_REQUIRES[id]?.includes(dependency)
  );
}

function formatMissingRequires(id: string, missing: string[]): string {
  const commands = missing.map((dependency) => `kiln add ${dependency}`).join(' and ');
  return `add ${id} requires ${missing.join(', ')}. Run ${commands} first.`;
}

/** Owned files that differ from what kiln last wrote and that this run leaves untouched. */
async function findSkippedEditedFiles(
  rootPath: string,
  ownedFiles: string[],
  touchedFiles: string[]
): Promise<string[]> {
  const known = await FileHashStore.load(rootPath);
  const warnings: string[] = [];

  for (const filePath of ownedFiles) {
    if (touchedFiles.includes(filePath) || !(filePath in known)) {
      continue;
    }
    const onDisk = await readFile(join(rootPath, filePath), 'utf8').catch(() => undefined);
    if (onDisk !== undefined && hashContent(onDisk) !== known[filePath]) {
      warnings.push(`Skipped ${filePath}: edited since kiln wrote it, left as is.`);
    }
  }

  return warnings;
}

export function createCapabilityRuntime(options?: CapabilityRuntimeOptions): CapabilityRuntime {
  return new CapabilityRuntime(options);
}
