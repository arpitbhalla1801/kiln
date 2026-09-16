/**
 * Structural mirror of @kiln/core's ownership tracking types.
 *
 * @kiln/core is a private, unpublished workspace package. A plugin never
 * imports or constructs an OwnershipTracker itself -- kiln's runtime
 * constructs one and hands a plugin an instance via
 * CapabilityPlanOptions.tracker. Declaring the same method surface here as
 * a structural interface means kiln's real OwnershipTracker class
 * satisfies it automatically (TypeScript types are structural, not
 * nominal), with zero runtime coupling to @kiln/core. Keep these shapes in
 * sync with packages/core/src/ownership.ts and ownership-types.ts.
 */

export type OwnershipResourceType = 'file' | 'dependency' | 'script' | 'envVar' | 'metadata';

export interface OwnershipRegistration {
  resourceType: OwnershipResourceType;
  resourceKey: string;
  ownerCapabilityId: string;
}

export interface OwnershipConflict {
  resourceType: OwnershipResourceType;
  resourceKey: string;
  existingOwner: string;
  attemptedOwner: string;
}

export interface OwnershipTracker {
  register(registration: OwnershipRegistration): void;
  tryRegister(registration: OwnershipRegistration): OwnershipConflict | null;
  registerFile(filePath: string, ownerCapabilityId: string): void;
  registerDependency(name: string, ownerCapabilityId: string): void;
  registerScript(name: string, ownerCapabilityId: string): void;
  registerEnvVar(name: string, ownerCapabilityId: string): void;
  registerMetadata(key: string, ownerCapabilityId: string): void;
  getOwner(resourceType: OwnershipResourceType, resourceKey: string): string | undefined;
  detectConflicts(registrations: OwnershipRegistration[]): OwnershipConflict[];
}
