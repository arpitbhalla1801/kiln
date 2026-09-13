import { AuthCapability } from '@kiln/auth-capability';
import {
  type Capability,
  createEmptyProjectState,
  LifecycleExecutor,
  LifecycleHooks,
  OwnershipTracker,
  ProjectState,
  ValidationRunner,
  withActiveAdapters,
} from '@kiln/core';
import { DbCapability } from '@kiln/db-capability';
import { EnvCapability, type EnvVariableMap } from '@kiln/env-capability';
import { NodeAdapter } from '@kiln/node-adapter';
import { createPlanExecutor, type CapabilityExecutionPlan } from '@kiln/planner';
import {
  loadOwnershipTracker,
  LockfileStore,
  saveOwnershipTracker,
  type KilnLockfile,
} from '@kiln/project-model';
import { TransformEngine } from '@kiln/transform-engine';
import { CAPABILITY_REGISTRY } from './capability-registry.js';
import { extractInstallDependencies } from './install.js';
import pkg from '../package.json' with { type: 'json' };
import type {
  KilnRuntimeContext,
  RuntimeExecutionResult,
  RuntimeOptions,
  SupportedCapabilityId,
} from './types.js';

export interface CapabilityRuntimeOptions {
  adapter?: NodeAdapter;
  envCapability?: EnvCapability;
  authCapability?: AuthCapability;
  dbCapability?: DbCapability;
}

export class CapabilityRuntime {
  private readonly adapter: NodeAdapter;
  private readonly envCapability: EnvCapability;
  private readonly authCapability: AuthCapability;
  private readonly dbCapability: DbCapability;
  private readonly lifecycleHooks: LifecycleHooks<KilnRuntimeContext>;

  constructor(options: CapabilityRuntimeOptions = {}) {
    this.adapter = options.adapter ?? new NodeAdapter();
    this.envCapability = options.envCapability ?? new EnvCapability();
    this.authCapability = options.authCapability ?? new AuthCapability();
    this.dbCapability = options.dbCapability ?? new DbCapability();
    this.lifecycleHooks = new LifecycleHooks<KilnRuntimeContext>();
    this.registerDefaultHooks();
  }

  getLifecycleHooks(): LifecycleHooks<KilnRuntimeContext> {
    return this.lifecycleHooks;
  }

  async addEnv(
    variables: EnvVariableMap,
    options: RuntimeOptions = {}
  ): Promise<RuntimeExecutionResult> {
    const rootPath = options.cwd ?? process.cwd();
    const tracker = await loadOwnershipTracker(rootPath);
    const capabilityPlan = await this.envCapability.planAdd(rootPath, variables, {
      tracker,
    });

    return this.executeCapabilityPlan('env', rootPath, capabilityPlan, options);
  }

  async addAuth(options: RuntimeOptions = {}): Promise<RuntimeExecutionResult> {
    const rootPath = options.cwd ?? process.cwd();
    const tracker = await loadOwnershipTracker(rootPath);
    const lockfile = await LockfileStore.load(rootPath);
    const existingProviders =
      lockfile?.snapshot.capabilities.find((entry) => entry.id === 'auth')?.providers ?? [];
    const capabilityPlan = await this.authCapability.planAdd(rootPath, {
      tracker,
      providers: options.providers,
      existingProviders,
      extraEnvVars: options.extraEnvVars,
    });

    return this.executeCapabilityPlan('auth', rootPath, capabilityPlan, options);
  }

  async addDb(options: RuntimeOptions = {}): Promise<RuntimeExecutionResult> {
    const rootPath = options.cwd ?? process.cwd();
    const tracker = await loadOwnershipTracker(rootPath);
    const capabilityPlan = await this.dbCapability.planAdd(rootPath, { tracker });

    return this.executeCapabilityPlan('db', rootPath, capabilityPlan, options);
  }

  async executeCapability(
    capabilityId: SupportedCapabilityId,
    options: RuntimeOptions = {},
    payload?: EnvVariableMap
  ): Promise<RuntimeExecutionResult> {
    if (capabilityId === 'env') {
      return this.addEnv(payload ?? {}, options);
    }

    if (capabilityId === 'db') {
      return this.addDb(options);
    }

    return this.addAuth(options);
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

      await saveOwnershipTracker(tracker, context.rootPath);
      await this.updateLockfile(context);
    });
  }

  private async updateLockfile(context: KilnRuntimeContext): Promise<void> {
    if (!context.capabilityPlan || !context.resolvedDependencies) {
      return;
    }

    const existing = await LockfileStore.load(context.rootPath);
    const capability = context.capabilityPlan.capability;

    const entry = {
      id: capability.id,
      version: capability.version,
      resolved: `capability:${capability.id}@${capability.version}`,
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
    const accessors: Record<string, () => Promise<Capability>> = {
      env: () => this.envCapability.getCapability(),
      auth: () => this.authCapability.getCapability(),
      db: () => this.dbCapability.getCapability(),
    };

    return accessors[capabilityId];
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
        dependencies.push(await accessor());
      }
    }

    return [...dependencies, capability];
  }
}

export function createCapabilityRuntime(options?: CapabilityRuntimeOptions): CapabilityRuntime {
  return new CapabilityRuntime(options);
}
