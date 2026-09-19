import type { CapabilityId } from './models.js';

export interface DependencyVersionClaim {
  name: string;
  version: string;
  ownerCapabilityId: CapabilityId;
}

export interface DependencyVersionConflict {
  name: string;
  claims: DependencyVersionClaim[];
}

/** Reconciles dependency version claims across capabilities during planning. */
export class DependencyVersionRegistry {
  private claimsByName = new Map<string, DependencyVersionClaim[]>();

  addClaim(claim: DependencyVersionClaim): void {
    const claims = this.claimsByName.get(claim.name) ?? [];
    claims.push(claim);
    this.claimsByName.set(claim.name, claims);
  }

  detectConflicts(): DependencyVersionConflict[] {
    const conflicts: DependencyVersionConflict[] = [];

    for (const [name, claims] of this.claimsByName.entries()) {
      const owners = new Set(claims.map((claim) => claim.ownerCapabilityId));
      if (owners.size > 1) {
        conflicts.push({ name, claims: [...claims] });
      }
    }

    return conflicts.sort((left, right) => left.name.localeCompare(right.name));
  }

  reconcile(): Map<string, string> {
    const conflicts = this.detectConflicts();
    if (conflicts.length > 0) {
      const first = conflicts[0];
      throw new Error(
        `Dependency version conflict for '${first.name}' across capabilities: ${first.claims
          .map((claim) => `${claim.ownerCapabilityId}@${claim.version}`)
          .join(', ')}`
      );
    }

    const resolved = new Map<string, string>();
    for (const [name, claims] of this.claimsByName.entries()) {
      resolved.set(name, reconcileVersionClaims(claims));
    }

    return resolved;
  }

}

export function reconcileVersionClaims(claims: DependencyVersionClaim[]): string {
  if (claims.length === 0) {
    throw new Error('Cannot reconcile empty dependency version claims');
  }

  const owners = new Set(claims.map((claim) => claim.ownerCapabilityId));
  if (owners.size > 1) {
    throw new Error(
      `Dependency version conflict for '${claims[0].name}' across capabilities`
    );
  }

  return claims.reduce((selected, claim) => selectPreferredVersion(selected, claim.version), claims[0].version);
}

export function selectPreferredVersion(current: string, candidate: string): string {
  const currentCore = extractVersionCore(current);
  const candidateCore = extractVersionCore(candidate);

  if (compareVersionCores(candidateCore, currentCore) >= 0) {
    return candidate;
  }

  return current;
}

function extractVersionCore(version: string): string {
  return version.replace(/^[\^~>=<]+/, '');
}

function compareVersionCores(left: string, right: string): number {
  const leftParts = left.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = right.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;

    if (leftValue !== rightValue) {
      return leftValue - rightValue;
    }
  }

  return 0;
}
