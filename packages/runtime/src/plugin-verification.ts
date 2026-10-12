import { createHash } from 'node:crypto';
import type { CapabilityManifest } from '@kiln-cli/core';

/** One third-party plugin release a kiln maintainer has reviewed. */
export interface VerifiedPlugin {
  package: string;
  version: string;
  /** Hash of the manifest as reviewed; a changed manifest is no longer verified. */
  manifestSha256: string;
}

/**
 * Maintainer-reviewed plugin releases. Add an entry only after reviewing the
 * plugin's code and the hash shown by `kiln capabilities show <id>`.
 */
export const VERIFIED_PLUGINS: VerifiedPlugin[] = [];

/** sha256 of the manifest with object keys sorted, so key order never changes the hash. */
export function manifestSha256(manifest: CapabilityManifest): string {
  return createHash('sha256').update(canonicalJson(manifest)).digest('hex');
}

export function isVerifiedPlugin(
  packageName: string,
  version: string,
  manifest: CapabilityManifest,
  verified: VerifiedPlugin[] = VERIFIED_PLUGINS
): boolean {
  const hash = manifestSha256(manifest);
  return verified.some(
    (entry) =>
      entry.package === packageName && entry.version === version && entry.manifestSha256 === hash
  );
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}
