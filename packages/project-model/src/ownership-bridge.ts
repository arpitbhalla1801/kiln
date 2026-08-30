import { OwnershipTracker } from '@kiln/core';
import type { OwnershipSnapshot } from '@kiln/core';
import { OwnershipMetadataStore } from './ownership-storage.js';
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

/** Build an ownership tracker from persisted project metadata. */
export function ownershipTrackerFromMetadata(metadata: OwnershipMetadata): OwnershipTracker {
  return new OwnershipTracker({ snapshot: ownershipSnapshotFromMetadata(metadata) });
}

/** Load ownership metadata from `.kiln/ownership.json` into a tracker. */
export async function loadOwnershipTracker(projectRoot: string): Promise<OwnershipTracker> {
  if (!(await OwnershipMetadataStore.exists(projectRoot))) {
    return new OwnershipTracker();
  }

  const metadata = await OwnershipMetadataStore.load(projectRoot);
  return ownershipTrackerFromMetadata(metadata);
}

/** Reload ownership metadata from disk into a tracker. */
export async function reloadOwnershipTracker(projectRoot: string): Promise<OwnershipTracker> {
  const metadata = await OwnershipMetadataStore.reload(projectRoot);
  return ownershipTrackerFromMetadata(metadata);
}

/** Persist an ownership tracker to `.kiln/ownership.json`. */
export async function saveOwnershipTracker(
  tracker: OwnershipTracker,
  projectRoot: string
): Promise<void> {
  const metadata = ownershipMetadataFromSnapshot(tracker.toSnapshot());
  await OwnershipMetadataStore.save(metadata, projectRoot);
}
