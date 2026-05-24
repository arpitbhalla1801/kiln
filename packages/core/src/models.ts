export interface Capability {
  id: string;
  name?: string;
  version: string;
  dependencies: string[];
  adapters?: string[];
  transforms?: Transform[];
  files?: string[];
}

export interface Transform {
  id: string;
  name?: string;
}

export interface FileOwnership {
  filePath: string;
  ownerCapabilityId: string;
}

export interface ProjectState {
  capabilities: Capability[];
  fileOwnership: Map<string, string>;
  activeAdapters: string[];
}

export interface ExecutionPlan {
  capabilities: Capability[];
  transforms: string[];
}

export interface AdapterContract {
  id: string;
  version: string;
  provides: string[];
}
