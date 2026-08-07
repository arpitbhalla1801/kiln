import type { OwnershipMetadata } from './types.js';

const OWNERSHIP_METADATA_VERSION = 1;

export interface OwnershipDocument {
  version: number;
  ownership: OwnershipMetadata;
}

/** Serialize ownership metadata to deterministic JSON for `.kiln/ownership.json`. */
export function serializeOwnershipMetadata(metadata: OwnershipMetadata): string {
  const document: OwnershipDocument = {
    version: OWNERSHIP_METADATA_VERSION,
    ownership: sortOwnershipMetadata(metadata),
  };

  return JSON.stringify(document, null, 2) + '\n';
}

/** Parse ownership metadata from `.kiln/ownership.json` content. */
export function parseOwnershipMetadata(content: string): OwnershipMetadata {
  const parsed = JSON.parse(content) as Partial<OwnershipDocument>;

  if (parsed.version === undefined || !parsed.ownership) {
    throw new Error('Invalid ownership metadata format: missing required top-level fields');
  }

  return sortOwnershipMetadata({
    files: parsed.ownership.files ?? [],
    dependencies: parsed.ownership.dependencies ?? [],
    scripts: parsed.ownership.scripts ?? [],
    envVars: parsed.ownership.envVars ?? [],
    metadata: parsed.ownership.metadata ?? [],
  });
}

function sortOwnershipMetadata(metadata: OwnershipMetadata): OwnershipMetadata {
  return {
    files: [...metadata.files].sort((left, right) => left.filePath.localeCompare(right.filePath)),
    dependencies: [...metadata.dependencies].sort((left, right) =>
      left.name.localeCompare(right.name)
    ),
    scripts: [...metadata.scripts].sort((left, right) => left.name.localeCompare(right.name)),
    envVars: [...metadata.envVars].sort((left, right) => left.name.localeCompare(right.name)),
    metadata: [...metadata.metadata].sort((left, right) => left.key.localeCompare(right.key)),
  };
}
