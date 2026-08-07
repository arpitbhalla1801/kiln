import { ExecutionPlan, ProjectState, Capability } from './models.js';

export class ValidationRunner {
  state: ProjectState;
  
  constructor(state: ProjectState) {
    this.state = state;
  }

  validatePlan(plan: ExecutionPlan): void {
    const plannedCapabilities = new Map<string, Capability>();
    for (const cap of plan.capabilities) {
      plannedCapabilities.set(cap.id, cap);
    }
    
    // Merge planned with existing state to get full picture
    const allCapabilities = new Map<string, Capability>();
    for (const cap of this.state.capabilities) {
      allCapabilities.set(cap.id, cap);
    }
    for (const cap of plan.capabilities) {
      allCapabilities.set(cap.id, cap);
    }

    const providedAdapters = new Set<string>(this.state.activeAdapters);

    // Track ownership
    const fileOwnership = new Map<string, string>(this.state.fileOwnership);

    for (const cap of plan.capabilities) {
      // Dependency Validation
      for (const dep of cap.dependencies) {
        if (!allCapabilities.has(dep)) {
          throw new Error(`Dependency validation failed: Capability '${cap.id}' requires missing dependency '${dep}'`);
        }
      }

      // Adapter Compatibility Validation
      if (cap.adapters) {
        for (const adapter of cap.adapters) {
          if (!providedAdapters.has(adapter)) {
            throw new Error(`Adapter compatibility failed: Capability '${cap.id}' requires missing adapter '${adapter}'`);
          }
        }
      }

      // Duplicate Ownership Detection
      if (cap.files) {
        for (const file of cap.files) {
          if (fileOwnership.has(file) && fileOwnership.get(file) !== cap.id) {
            throw new Error(`Duplicate ownership detected: File '${file}' is already owned by '${fileOwnership.get(file)}'`);
          }
          fileOwnership.set(file, cap.id);
        }
      }
    }
  }
}
