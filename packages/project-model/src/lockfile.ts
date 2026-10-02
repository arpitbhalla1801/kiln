import { KilnLockfile } from './types.js';

export class LockfileManager {
  static generate(lockfile: KilnLockfile): string {
    // Sort capabilities recursively to ensure deterministic generation
    const sortedCapabilities = [...lockfile.snapshot.capabilities].sort((a, b) => 
      a.id.localeCompare(b.id)
    );

    sortedCapabilities.forEach(cap => {
      if (cap.dependencies) {
        const sortedDeps: Record<string, string> = {};
        Object.keys(cap.dependencies)
          .sort()
          .forEach(k => {
            sortedDeps[k] = cap.dependencies[k];
          });
        cap.dependencies = sortedDeps;
      }
    });

    const deterministicLockfile: KilnLockfile = {
      lockfileVersion: lockfile.lockfileVersion,
      project: { 
        name: lockfile.project.name,
        version: lockfile.project.version,
      },
      snapshot: {
        timestamp: lockfile.snapshot.timestamp,
        engineVersion: lockfile.snapshot.engineVersion,
        capabilities: sortedCapabilities,
        ...(lockfile.snapshot.lastCapability ? { lastCapability: lockfile.snapshot.lastCapability } : {}),
      }
    };

    return JSON.stringify(deterministicLockfile, null, 2) + '\n';
  }

  static parse(content: string): KilnLockfile {
    const parsed = JSON.parse(content) as Partial<KilnLockfile>;
    
    if (parsed.lockfileVersion === undefined || !parsed.project || !parsed.snapshot) {
      throw new Error('Invalid lockfile format: missing required top-level fields');
    }

    return parsed as KilnLockfile;
  }
}
