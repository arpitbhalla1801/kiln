import {
  loadOwnershipTracker,
  ownershipMetadataFromSnapshot,
  OwnershipMetadataStore,
} from '@kiln-cli/project-model';
import { buildEnvRemovalTransforms, ENV_CAPABILITY_ID } from '@kiln-cli/env-capability';
import { TransformEngine } from '@kiln-cli/transform-engine';
import { formatTransformPlan } from '../output.js';
import type { CliOptions } from '../output.js';
import { resolveProjectRoot } from '../project.js';

export async function runEnvRemove(names: string[], options: CliOptions): Promise<void> {
  if (names.length === 0) {
    throw new Error('At least one variable name is required. Usage: kiln env remove <NAME> [<NAME>...]');
  }

  const rootPath = await resolveProjectRoot(options.cwd);
  const tracker = await loadOwnershipTracker(rootPath);

  // Removing a var another capability manages (e.g. db owns DATABASE_URL) silently breaks that
  // capability on its next run, so warn before doing it rather than failing after the fact.
  for (const name of names) {
    const owner = tracker.getOwner('envVar', name);
    if (owner !== undefined && owner !== ENV_CAPABILITY_ID) {
      console.warn(`Warning: '${name}' is managed by the '${owner}' capability. Removing it may break that capability.`);
    }
  }

  const transforms = buildEnvRemovalTransforms(names);

  const engine = new TransformEngine();
  await engine.seedFromDisk(rootPath, transforms);
  engine.queueTransforms(transforms);

  const preview = await engine.execute({ dryRun: options.dryRun, rootDir: rootPath });

  console.log(options.dryRun ? 'Mode: dry-run (env remove)' : 'Mode: env remove');
  console.log(formatTransformPlan(preview, options.dryRun));

  if (!options.dryRun) {
    const snapshot = tracker.toSnapshot();
    const removed = new Set(names);

    await OwnershipMetadataStore.save(
      ownershipMetadataFromSnapshot({
        ...snapshot,
        envVars: snapshot.envVars.filter((entry) => !removed.has(entry.name)),
      }),
      rootPath
    );
  }
}
