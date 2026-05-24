export interface CapabilityManifest {
  id: string;
  name?: string;
  dependencies: string[];
  transforms?: string[];
}

export interface ExecutionPlan {
  capabilities: CapabilityManifest[];
  transforms: string[];
}
