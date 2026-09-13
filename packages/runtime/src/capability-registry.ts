export interface CapabilityRegistryEntry {
  id: string;
  dependencies: string[];
}

export const CAPABILITY_REGISTRY: Record<string, CapabilityRegistryEntry> = {
  env: { id: 'env', dependencies: [] },
  auth: { id: 'auth', dependencies: ['env'] },
  db: { id: 'db', dependencies: ['env'] },
};

export const SUPPORTED_CAPABILITY_IDS = Object.keys(CAPABILITY_REGISTRY);

export function isSupportedCapabilityId(id: string): boolean {
  return id in CAPABILITY_REGISTRY;
}
