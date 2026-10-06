export interface CapabilityRegistryEntry {
  id: string;
  /** "requires": must be installed before this capability can be added. */
  dependencies: string[];
  /** Optional partners this capability adapts to; adding one re-plans this capability if installed. */
  enhances: string[];
}

export const CAPABILITY_REGISTRY: Record<string, CapabilityRegistryEntry> = {};
export const SUPPORTED_CAPABILITY_IDS: string[] = [];

export function registerCapability(
  id: string,
  dependencies: string[] = [],
  enhances: string[] = []
): void {
  CAPABILITY_REGISTRY[id] = { id, dependencies, enhances };
  if (!SUPPORTED_CAPABILITY_IDS.includes(id)) {
    SUPPORTED_CAPABILITY_IDS.push(id);
  }
}

export function isSupportedCapabilityId(id: string): boolean {
  return id in CAPABILITY_REGISTRY;
}

registerCapability('env');
registerCapability('auth', ['env'], ['db']);
registerCapability('db', ['env'], ['auth']);

/** Ids of registered capabilities that enhance `id`, i.e. the ones to re-plan when `id` is added. */
export function enhancersOf(id: string): string[] {
  return Object.values(CAPABILITY_REGISTRY)
    .filter((entry) => entry.enhances.includes(id))
    .map((entry) => entry.id);
}
