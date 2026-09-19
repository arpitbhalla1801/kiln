import type { CapabilityId, FileOwnership } from '@kiln/core';

/** Relative or absolute path to a project file. */
export type ProjectFilePath = string;

/** npm or capability dependency name. */
export type DependencyName = string;

/** package.json script name. */
export type ScriptName = string;

/** Environment variable name. */
export type EnvVarName = string;

/** A file tracked in the kiln project model. */
export interface ProjectFile {
  path: ProjectFilePath;
  content?: string;
  exists: boolean;
}

/** A package or capability dependency tracked by the project model. */
export interface ProjectDependency {
  name: DependencyName;
  /** Semver range or resolved version string. */
  version: string;
  resolved?: string;
  dev?: boolean;
  ownerCapabilityId?: CapabilityId;
}

/** A package.json script entry tracked by the project model. */
export interface ProjectScript {
  name: ScriptName;
  command: string;
  ownerCapabilityId?: CapabilityId;
}

/** An environment variable definition tracked by the project model. */
export interface ProjectEnvVar {
  name: EnvVarName;
  value?: string;
  example?: string;
  required?: boolean;
  ownerCapabilityId?: CapabilityId;
}

/** Ownership record for a dependency entry. */
export interface DependencyOwnership {
  name: DependencyName;
  ownerCapabilityId: CapabilityId;
}

/** Ownership record for a script entry. */
export interface ScriptOwnership {
  name: ScriptName;
  ownerCapabilityId: CapabilityId;
}

/** Ownership record for an environment variable. */
export interface EnvVarOwnership {
  name: EnvVarName;
  ownerCapabilityId: CapabilityId;
}

/** Ownership record for arbitrary project metadata keys. */
export interface MetadataOwnership {
  key: string;
  ownerCapabilityId: CapabilityId;
}

/**
 * Serializable ownership metadata for `.kiln/ownership.json`.
 * Aggregates ownership across files, dependencies, scripts, env vars, and metadata.
 */
export interface OwnershipMetadata {
  files: FileOwnership[];
  dependencies: DependencyOwnership[];
  scripts: ScriptOwnership[];
  envVars: EnvVarOwnership[];
  metadata: MetadataOwnership[];
}

/** Resolved capability version stored in the lockfile. */
export interface CapabilityVersion {
  id: string;
  version: string;
  resolved: string;
  integrity?: string;
  dependencies: Record<string, string>;
  providers?: string[];
}

/** Point-in-time install snapshot for reproducibility. */
export interface InstallSnapshot {
  capabilities: CapabilityVersion[];
  timestamp: string;
  engineVersion: string;
}

/** Kiln lockfile format for installed capability snapshots. */
export interface KilnLockfile {
  lockfileVersion: number;
  project: {
    name: string;
    version: string;
  };
  snapshot: InstallSnapshot;
}
