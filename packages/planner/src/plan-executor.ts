import {
  type Capability,
  type CapabilityId,
  DependencyVersionRegistry,
  OwnershipRegistration,
  OwnershipTracker,
} from '@kiln/core';
import { TransformEngine, type TransformPipeline, type TypedTransform } from '@kiln/transform-engine';

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
  private versionRegistry: DependencyVersionRegistry;

  constructor(
    private readonly engine: TransformEngine,
    private readonly ownershipTracker: OwnershipTracker,
    versionRegistry?: DependencyVersionRegistry
  ) {
    this.versionRegistry = versionRegistry ?? new DependencyVersionRegistry();
  }

  getDependencyVersionRegistry(): DependencyVersionRegistry {
    return this.versionRegistry;
  }

  getOwnershipTracker(): OwnershipTracker {
    return this.ownershipTracker;
  }

  queueCapabilityPlan(plan: CapabilityExecutionPlan): TypedTransform[] {
    this.registerOwnership(plan.ownershipRegistrations ?? []);
    this.ownershipTracker.registerCapabilityOwnership(plan.capability);
    this.collectDependencyClaims(plan.transforms, plan.capability.id);

    const typedTransforms = plan.transforms;
    this.engine.queueTransforms(typedTransforms);
    return typedTransforms;
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

  private collectDependencyClaims(transforms: TransformPipeline, capabilityId: CapabilityId): void {
    for (const transform of transforms) {
      if (transform.type !== 'package-json-mutation') {
        continue;
      }

      this.addDependencyClaims(transform.dependencies, capabilityId);
      this.addDependencyClaims(transform.devDependencies, capabilityId);
    }
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
