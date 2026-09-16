export interface CapabilityRegistryEntry {
  id: string;
  dependencies: string[];
}

export const CAPABILITY_REGISTRY: Record<string, CapabilityRegistryEntry> = {};
export const SUPPORTED_CAPABILITY_IDS: string[] = [];

export function registerCapability(id: string, dependencies: string[] = []): void {
  CAPABILITY_REGISTRY[id] = { id, dependencies };
  if (!SUPPORTED_CAPABILITY_IDS.includes(id)) {
    SUPPORTED_CAPABILITY_IDS.push(id);
  }
}

export function isSupportedCapabilityId(id: string): boolean {
  return id in CAPABILITY_REGISTRY;
}

registerCapability('env');
registerCapability('auth', ['env']);
registerCapability('db', ['env']);
