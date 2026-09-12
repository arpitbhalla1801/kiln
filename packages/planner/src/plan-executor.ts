import {
  type Capability,
  type CapabilityId,
  type CapabilityManifest,
  type ExecutionPlan,
  DependencyVersionRegistry,
  OwnershipRegistration,
  OwnershipTracker,
  type Transform,
} from '@kiln/core';
import {
  TransformEngine,
  type TransformPipeline,
  type TypedTransform,
  resolveTypedTransforms,
} from '@kiln/transform-engine';
import { TransformRegistry } from './transform-registry.js';

export interface CapabilityExecutionPlan {
  transforms: TransformPipeline;
  capability: Capability;
  ownershipRegistrations?: OwnershipRegistration[];
  providers?: string[];
}

export interface PlanExecutionResult {
  transforms: TypedTransform[];
  resolvedDependencies: Map<string, string>;
}

export class PlanExecutor {
  private registry: TransformRegistry;
  private versionRegistry: DependencyVersionRegistry;

  constructor(
    private readonly engine: TransformEngine,
    private readonly ownershipTracker: OwnershipTracker,
    registry?: TransformRegistry,
    versionRegistry?: DependencyVersionRegistry
  ) {
    this.registry = registry ?? new TransformRegistry();
    this.versionRegistry = versionRegistry ?? new DependencyVersionRegistry();
  }

  getTransformRegistry(): TransformRegistry {
    return this.registry;
  }

  getDependencyVersionRegistry(): DependencyVersionRegistry {
    return this.versionRegistry;
  }

  getOwnershipTracker(): OwnershipTracker {
    return this.ownershipTracker;
  }

  registerManifest(manifest: CapabilityManifest): void {
    this.registry.registerManifest(manifest);
  }

  queueCapabilityPlan(plan: CapabilityExecutionPlan): TypedTransform[] {
    this.registerOwnership(plan.ownershipRegistrations ?? []);
    this.ownershipTracker.registerCapabilityOwnership(plan.capability);
    this.collectDependencyClaims(plan.transforms, plan.capability.id);

    const typedTransforms = plan.transforms;
    this.engine.queueTransforms(typedTransforms);
    return typedTransforms;
  }

  queueManifestPlan(
    executionPlan: ExecutionPlan,
    manifests: Map<CapabilityId, CapabilityManifest>
  ): TypedTransform[] {
    for (const manifest of manifests.values()) {
      this.registry.registerManifest(manifest);
    }

    for (const capability of executionPlan.capabilities) {
      this.registry.registerCapability(capability);
      this.ownershipTracker.registerCapabilityOwnership(capability);
      this.collectDependencyClaimsFromCapability(capability);
    }

    const transforms = this.registry.resolveAll(executionPlan.transforms);
    const typedTransforms = resolveTypedTransforms(transforms);
    this.engine.queueTransforms(typedTransforms);

    return typedTransforms;
  }

  queueManifestTransforms(
    executionPlan: ExecutionPlan,
    manifests: CapabilityManifest[]
  ): TypedTransform[] {
    const manifestMap = new Map(manifests.map((manifest) => [manifest.id, manifest]));
    return this.queueManifestPlan(executionPlan, manifestMap);
  }

  finalize(): PlanExecutionResult {
    const resolvedDependencies = this.versionRegistry.reconcile();

    return {
      transforms: [],
      resolvedDependencies,
    };
  }

  private registerOwnership(registrations: OwnershipRegistration[]): void {
    for (const registration of registrations) {
      this.ownershipTracker.register(registration);
    }
  }

  private collectDependencyClaimsFromCapability(capability: Capability): void {
    if (!capability.transforms) {
      return;
    }

    for (const transform of capability.transforms) {
      this.collectDependencyClaimsFromManifestTransform(transform, capability.id);
    }
  }

  private collectDependencyClaims(transforms: TransformPipeline, capabilityId: CapabilityId): void {
    for (const transform of transforms) {
      if (transform.type !== 'package-json-mutation') {
        continue;
      }

      this.addDependencyClaims(transform.dependencies, capabilityId);
      this.addDependencyClaims(transform.devDependencies, capabilityId);
    }
  }

  private collectDependencyClaimsFromManifestTransform(
    transform: Transform,
    capabilityId: CapabilityId
  ): void {
    if (transform.type !== 'package-json-mutation') {
      return;
    }

    const payload = transform.payload ?? {};
    this.addDependencyClaims(readStringRecord(payload.dependencies), capabilityId);
    this.addDependencyClaims(readStringRecord(payload.devDependencies), capabilityId);
  }

  private addDependencyClaims(
    dependencies: Record<string, string> | undefined,
    capabilityId: CapabilityId
  ): void {
    if (!dependencies) {
      return;
    }

    for (const [name, version] of Object.entries(dependencies)) {
      this.versionRegistry.addClaim({
        name,
        version,
        ownerCapabilityId: capabilityId,
      });

      this.ownershipTracker.registerDependency(name, capabilityId);
    }
  }
}

export function createPlanExecutor(
  engine?: TransformEngine,
  ownershipTracker?: OwnershipTracker
): PlanExecutor {
  return new PlanExecutor(
    engine ?? new TransformEngine(),
    ownershipTracker ?? new OwnershipTracker()
  );
}

function readStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const record: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') {
      record[key] = entry;
    }
  }

  return Object.keys(record).length > 0 ? record : undefined;
}
