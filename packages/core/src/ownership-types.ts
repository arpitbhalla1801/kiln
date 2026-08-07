import type { CapabilityId, FileOwnership } from './models.js';

export type OwnershipResourceType =
  | 'file'
  | 'dependency'
  | 'script'
  | 'envVar'
  | 'metadata';

export interface OwnershipRegistration {
  resourceType: OwnershipResourceType;
  resourceKey: string;
  ownerCapabilityId: CapabilityId;
}

export interface OwnershipConflict {
  resourceType: OwnershipResourceType;
  resourceKey: string;
  existingOwner: CapabilityId;
  attemptedOwner: CapabilityId;
}

export interface DependencyOwnershipRecord {
  name: string;
  ownerCapabilityId: CapabilityId;
}

export interface ScriptOwnershipRecord {
  name: string;
  ownerCapabilityId: CapabilityId;
}

export interface EnvVarOwnershipRecord {
  name: string;
  ownerCapabilityId: CapabilityId;
}

export interface MetadataOwnershipRecord {
  key: string;
  ownerCapabilityId: CapabilityId;
}

/** Serializable ownership snapshot for persistence and inspection. */
export interface OwnershipSnapshot {
  files: FileOwnership[];
  dependencies: DependencyOwnershipRecord[];
  scripts: ScriptOwnershipRecord[];
  envVars: EnvVarOwnershipRecord[];
  metadata: MetadataOwnershipRecord[];
}

export interface OwnershipTrackerOptions {
  snapshot?: OwnershipSnapshot;
  fileOwnership?: Map<string, CapabilityId>;
}
