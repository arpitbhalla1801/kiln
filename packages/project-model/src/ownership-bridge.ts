import type { OwnershipSnapshot } from '@kiln/core';
import type { OwnershipMetadata } from './types.js';

/** Convert core ownership snapshot into project-model metadata. */
export function ownershipMetadataFromSnapshot(snapshot: OwnershipSnapshot): OwnershipMetadata {
  return {
    files: [...snapshot.files],
    dependencies: snapshot.dependencies.map((entry) => ({
      name: entry.name,
      ownerCapabilityId: entry.ownerCapabilityId,
    })),
    scripts: snapshot.scripts.map((entry) => ({
      name: entry.name,
      ownerCapabilityId: entry.ownerCapabilityId,
    })),
    envVars: snapshot.envVars.map((entry) => ({
      name: entry.name,
      ownerCapabilityId: entry.ownerCapabilityId,
    })),
    metadata: snapshot.metadata.map((entry) => ({
      key: entry.key,
      ownerCapabilityId: entry.ownerCapabilityId,
    })),
  };
}

/** Convert project-model metadata into core ownership snapshot. */
export function ownershipSnapshotFromMetadata(metadata: OwnershipMetadata): OwnershipSnapshot {
  return {
    files: [...metadata.files],
    dependencies: metadata.dependencies.map((entry) => ({
      name: entry.name,
      ownerCapabilityId: entry.ownerCapabilityId,
    })),
    scripts: metadata.scripts.map((entry) => ({
      name: entry.name,
      ownerCapabilityId: entry.ownerCapabilityId,
    })),
    envVars: metadata.envVars.map((entry) => ({
      name: entry.name,
      ownerCapabilityId: entry.ownerCapabilityId,
    })),
    metadata: metadata.metadata.map((entry) => ({
      key: entry.key,
      ownerCapabilityId: entry.ownerCapabilityId,
    })),
  };
}
