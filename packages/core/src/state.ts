import { AdapterId, CapabilityId, FileOwnership, ProjectState, CapabilityManifest, Capability } from './models.js';

/** Create an empty project state for a new or uninitialized project. */
export function createEmptyProjectState(): ProjectState {
  return {
    capabilities: [],
    fileOwnership: new Map(),
    activeAdapters: [],
  };
}

/** Build a runtime ownership map from serializable entries. */
export function fileOwnershipFromEntries(
  entries: readonly FileOwnership[]
): Map<string, CapabilityId> {
  const ownership = new Map<string, CapabilityId>();
  for (const entry of entries) {
    ownership.set(entry.filePath, entry.ownerCapabilityId);
  }
  return ownership;
}

/** Serialize ownership map to a deterministic, JSON-friendly array. */
export function fileOwnershipToEntries(
  ownership: Map<string, CapabilityId>
): FileOwnership[] {
  return Array.from(ownership.entries())
    .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
    .map(([filePath, ownerCapabilityId]) => ({ filePath, ownerCapabilityId }));
}

/** Register active adapters on a project state. */
export function withActiveAdapters(state: ProjectState, adapters: AdapterId[]): ProjectState {
  return {
    ...state,
    activeAdapters: [...adapters],
  };
}

function ownershipFiles(manifest: CapabilityManifest): string[] | undefined {
  const ownedFiles = manifest.ownership?.files ?? [];
  const declaredFiles = manifest.files ?? [];
  const merged = [...ownedFiles, ...declaredFiles];

  return merged.length > 0 ? merged : undefined;
}

/** Convert a planning manifest into a resolved capability record. */
export function capabilityFromManifest(manifest: CapabilityManifest): Capability {
  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    dependencies: [...manifest.dependencies],
    adapters: manifest.adapters ? [...manifest.adapters] : undefined,
    transforms: manifest.transformDefinitions ? [...manifest.transformDefinitions] : undefined,
    files: ownershipFiles(manifest),
    ownedDependencies: manifest.ownership?.dependencies
      ? [...manifest.ownership.dependencies]
      : undefined,
    ownedScripts: manifest.ownership?.scripts ? [...manifest.ownership.scripts] : undefined,
    ownedEnvVars: manifest.ownership?.envVars ? [...manifest.ownership.envVars] : undefined,
    ownedMetadata: manifest.ownership?.metadata ? [...manifest.ownership.metadata] : undefined,
  };
}
