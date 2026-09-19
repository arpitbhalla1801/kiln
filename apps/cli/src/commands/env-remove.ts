import {
  loadOwnershipTracker,
  ownershipMetadataFromSnapshot,
  OwnershipMetadataStore,
} from '@kiln/project-model';
import { buildEnvRemovalTransforms } from '@kiln/env-capability';
import { TransformEngine } from '@kiln/transform-engine';
import { formatTransformPlan } from '../output.js';
import type { CliOptions } from '../output.js';
import { resolveProjectRoot } from '../project.js';

export async function runEnvRemove(names: string[], options: CliOptions): Promise<void> {
  if (names.length === 0) {
    throw new Error('At least one variable name is required. Usage: kiln env remove <NAME> [<NAME>...]');
  }

  const rootPath = await resolveProjectRoot(options.cwd);
  const transforms = buildEnvRemovalTransforms(names);

  const engine = new TransformEngine();
  await engine.seedFromDisk(rootPath, transforms);
  engine.queueTransforms(transforms);

  const preview = await engine.execute({ dryRun: options.dryRun, rootDir: rootPath });

  console.log(options.dryRun ? 'Mode: dry-run (env remove)' : 'Mode: env remove');
  console.log(formatTransformPlan(preview, options.dryRun));

  if (!options.dryRun) {
    const tracker = await loadOwnershipTracker(rootPath);
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
