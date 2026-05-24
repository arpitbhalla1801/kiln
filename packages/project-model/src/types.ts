export interface CapabilityVersion {
  id: string;
  version: string;
  resolved: string;
  integrity?: string;
  dependencies: Record<string, string>;
}

export interface InstallSnapshot {
  capabilities: CapabilityVersion[];
  timestamp: string;
  engineVersion: string;
}

export interface ProjectMetadata {
  name: string;
  version: string;
  capabilities: Record<string, string>;
}

export interface KilnLockfile {
  lockfileVersion: number;
  project: {
    name: string;
    version: string;
  };
  snapshot: InstallSnapshot;
}
