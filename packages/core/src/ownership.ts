import type { Capability, CapabilityId, FileOwnership } from './models.js';
import {
  EXTERNAL_OWNER,
  type OwnershipConflict,
  type OwnershipRegistration,
  type OwnershipResourceType,
  type OwnershipSnapshot,
  type OwnershipTrackerOptions,
} from './ownership-types.js';

type OwnershipMap = Map<string, CapabilityId>;

/** Tracks capability ownership across files, dependencies, scripts, env vars, and metadata. */
export class OwnershipTracker {
  private files: OwnershipMap;
  private dependencies: OwnershipMap;
  private scripts: OwnershipMap;
  private envVars: OwnershipMap;
  private metadata: OwnershipMap;

  constructor(options: OwnershipTrackerOptions = {}) {
    this.files = new Map();
    this.dependencies = new Map();
    this.scripts = new Map();
    this.envVars = new Map();
    this.metadata = new Map();

    if (options.fileOwnership) {
      for (const [filePath, ownerCapabilityId] of options.fileOwnership.entries()) {
        this.files.set(filePath, ownerCapabilityId);
      }
    }

    if (options.snapshot) {
      this.loadSnapshot(options.snapshot);
    }
  }

  static fromFileOwnershipMap(fileOwnership: Map<string, CapabilityId>): OwnershipTracker {
    return new OwnershipTracker({ fileOwnership });
  }

  register(registration: OwnershipRegistration): void {
    const conflict = this.tryRegister(registration);
    if (conflict) {
      throw new Error(formatOwnershipConflict(conflict));
    }
  }

  tryRegister(registration: OwnershipRegistration): OwnershipConflict | null {
    const map = this.getMap(registration.resourceType);
    const existingOwner = map.get(registration.resourceKey);

    if (existingOwner !== undefined && existingOwner !== registration.ownerCapabilityId) {
      return {
        resourceType: registration.resourceType,
        resourceKey: registration.resourceKey,
        existingOwner,
        attemptedOwner: registration.ownerCapabilityId,
      };
    }

    map.set(registration.resourceKey, registration.ownerCapabilityId);
    return null;
  }

  registerFile(filePath: string, ownerCapabilityId: CapabilityId): void {
    this.register({ resourceType: 'file', resourceKey: filePath, ownerCapabilityId });
  }

  registerDependency(name: string, ownerCapabilityId: CapabilityId): void {
    this.register({ resourceType: 'dependency', resourceKey: name, ownerCapabilityId });
  }

  registerScript(name: string, ownerCapabilityId: CapabilityId): void {
    this.register({ resourceType: 'script', resourceKey: name, ownerCapabilityId });
  }

  registerEnvVar(name: string, ownerCapabilityId: CapabilityId): void {
    this.register({ resourceType: 'envVar', resourceKey: name, ownerCapabilityId });
  }

  registerMetadata(key: string, ownerCapabilityId: CapabilityId): void {
    this.register({ resourceType: 'metadata', resourceKey: key, ownerCapabilityId });
  }

  getOwner(resourceType: OwnershipResourceType, resourceKey: string): CapabilityId | undefined {
    return this.getMap(resourceType).get(resourceKey);
  }

  detectConflicts(registrations: OwnershipRegistration[]): OwnershipConflict[] {
    const conflicts: OwnershipConflict[] = [];

    for (const registration of registrations) {
      const conflict = this.detectConflict(registration);
      if (conflict) {
        conflicts.push(conflict);
      }
    }

    return conflicts.sort((left, right) =>
      `${left.resourceType}:${left.resourceKey}`.localeCompare(
        `${right.resourceType}:${right.resourceKey}`
      )
    );
  }

  registerCapabilityOwnership(capability: Capability): void {
    if (capability.files) {
      for (const filePath of capability.files) {
        this.registerFile(filePath, capability.id);
      }
    }

    if (capability.ownedDependencies) {
      for (const dependency of capability.ownedDependencies) {
        this.registerDependency(dependency, capability.id);
      }
    }

    if (capability.ownedScripts) {
      for (const script of capability.ownedScripts) {
        this.registerScript(script, capability.id);
      }
    }

    if (capability.ownedEnvVars) {
      for (const envVar of capability.ownedEnvVars) {
        this.registerEnvVar(envVar, capability.id);
      }
    }

    if (capability.ownedMetadata) {
      for (const key of capability.ownedMetadata) {
        this.registerMetadata(key, capability.id);
      }
    }
  }

  toSnapshot(): OwnershipSnapshot {
    return {
      files: mapToFileOwnership(this.files),
      dependencies: mapToNamedOwnership(this.dependencies),
      scripts: mapToNamedOwnership(this.scripts),
      envVars: mapToNamedOwnership(this.envVars),
      metadata: mapToKeyedOwnership(this.metadata),
    };
  }

  loadSnapshot(snapshot: OwnershipSnapshot): void {
    for (const entry of snapshot.files) {
      this.files.set(entry.filePath, entry.ownerCapabilityId);
    }

    for (const entry of snapshot.dependencies) {
      this.dependencies.set(entry.name, entry.ownerCapabilityId);
    }

    for (const entry of snapshot.scripts) {
      this.scripts.set(entry.name, entry.ownerCapabilityId);
    }

    for (const entry of snapshot.envVars) {
      this.envVars.set(entry.name, entry.ownerCapabilityId);
    }

    for (const entry of snapshot.metadata) {
      this.metadata.set(entry.key, entry.ownerCapabilityId);
    }
  }

  private detectConflict(registration: OwnershipRegistration): OwnershipConflict | null {
    const map = this.getMap(registration.resourceType);
    const existingOwner = map.get(registration.resourceKey);

    if (existingOwner !== undefined && existingOwner !== registration.ownerCapabilityId) {
      return {
        resourceType: registration.resourceType,
        resourceKey: registration.resourceKey,
        existingOwner,
        attemptedOwner: registration.ownerCapabilityId,
      };
    }

    return null;
  }

  private getMap(resourceType: OwnershipResourceType): OwnershipMap {
    switch (resourceType) {
      case 'file':
        return this.files;
      case 'dependency':
        return this.dependencies;
      case 'script':
        return this.scripts;
      case 'envVar':
        return this.envVars;
      case 'metadata':
        return this.metadata;
      default:
        throw new Error(`Unsupported ownership resource type: ${resourceType}`);
    }
  }
}

export function formatOwnershipConflict(conflict: OwnershipConflict): string {
  const base = `Ownership conflict detected: ${conflict.resourceType} '${conflict.resourceKey}' is already owned by '${conflict.existingOwner}'`;
  if (conflict.existingOwner !== EXTERNAL_OWNER) {
    return base;
  }

  return `${base}. It existed before kiln, so '${conflict.attemptedOwner}' will not overwrite it. Rename or remove it, or edit .kiln/ownership.json if you want kiln to manage it.`;
}

function mapToFileOwnership(map: OwnershipMap): FileOwnership[] {
  return Array.from(map.entries())
    .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
    .map(([filePath, ownerCapabilityId]) => ({ filePath, ownerCapabilityId }));
}

function mapToNamedOwnership(map: OwnershipMap): Array<{ name: string; ownerCapabilityId: CapabilityId }> {
  return Array.from(map.entries())
    .sort(([leftName], [rightName]) => leftName.localeCompare(rightName))
    .map(([name, ownerCapabilityId]) => ({ name, ownerCapabilityId }));
}

function mapToKeyedOwnership(map: OwnershipMap): Array<{ key: string; ownerCapabilityId: CapabilityId }> {
  return Array.from(map.entries())
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, ownerCapabilityId]) => ({ key, ownerCapabilityId }));
}
