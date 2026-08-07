import { ExecutionPlan, ProjectState } from './models.js';
import { OwnershipTracker } from './ownership.js';

export class ValidationRunner {
  state: ProjectState;

  constructor(state: ProjectState) {
    this.state = state;
  }

  validatePlan(plan: ExecutionPlan): void {
    const allCapabilities = new Map<string, ExecutionPlan['capabilities'][number]>();
    for (const capability of this.state.capabilities) {
      allCapabilities.set(capability.id, capability);
    }
    for (const capability of plan.capabilities) {
      allCapabilities.set(capability.id, capability);
    }

    const providedAdapters = new Set<string>(this.state.activeAdapters);
    const ownershipTracker = OwnershipTracker.fromFileOwnershipMap(this.state.fileOwnership);
    for (const capability of this.state.capabilities) {
      ownershipTracker.registerCapabilityOwnership(capability);
    }

    for (const capability of plan.capabilities) {
      for (const dependency of capability.dependencies) {
        if (!allCapabilities.has(dependency)) {
          throw new Error(
            `Dependency validation failed: Capability '${capability.id}' requires missing dependency '${dependency}'`
          );
        }
      }

      if (capability.adapters) {
        for (const adapter of capability.adapters) {
          if (!providedAdapters.has(adapter)) {
            throw new Error(
              `Adapter compatibility failed: Capability '${capability.id}' requires missing adapter '${adapter}'`
            );
          }
        }
      }

      ownershipTracker.registerCapabilityOwnership(capability);
    }
  }

  getOwnershipTracker(): OwnershipTracker {
    return OwnershipTracker.fromFileOwnershipMap(this.state.fileOwnership);
  }
}
