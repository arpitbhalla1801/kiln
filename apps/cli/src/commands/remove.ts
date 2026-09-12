import {
  loadOwnershipTracker,
  LockfileStore,
  ownershipMetadataFromSnapshot,
  OwnershipMetadataStore,
} from '@kiln/project-model';
import { DEFAULT_ENV_EXAMPLE_PATH } from '@kiln/env-capability';
import { createTransformPipeline, TransformEngine } from '@kiln/transform-engine';
import type { OwnershipSnapshot } from '@kiln/core';
import { formatTransformPlan } from '../output.js';
import type { CliOptions } from '../output.js';
import { resolveProjectRoot } from '../project.js';

const SUPPORTED_CAPABILITIES = ['env', 'auth'];

export async function runRemove(capabilityId: string, options: CliOptions): Promise<void> {
  if (!SUPPORTED_CAPABILITIES.includes(capabilityId)) {
    throw new Error(
      `Unsupported capability '${capabilityId}'. Supported capabilities: ${SUPPORTED_CAPABILITIES.join(', ')}`
    );
  }

  const rootPath = await resolveProjectRoot(options.cwd);
  const tracker = await loadOwnershipTracker(rootPath);
  const snapshot = tracker.toSnapshot();

  const ownedFiles = snapshot.files.filter((entry) => entry.ownerCapabilityId === capabilityId);
  const ownedDependencies = snapshot.dependencies.filter(
    (entry) => entry.ownerCapabilityId === capabilityId
  );
  const ownedScripts = snapshot.scripts.filter((entry) => entry.ownerCapabilityId === capabilityId);
  const ownedEnvVars = snapshot.envVars.filter((entry) => entry.ownerCapabilityId === capabilityId);

  const ownsNothing =
    ownedFiles.length === 0 &&
    ownedDependencies.length === 0 &&
    ownedScripts.length === 0 &&
    ownedEnvVars.length === 0;

  if (ownsNothing) {
    console.log(`Capability '${capabilityId}' is not applied to this project.`);
    return;
  }

  const builder = createTransformPipeline();

  for (const file of ownedFiles) {
    builder.fileDelete(`${capabilityId}-remove-${file.filePath}`, file.filePath);
  }

  if (ownedDependencies.length > 0 || ownedScripts.length > 0) {
    builder.packageJsonMutation(`${capabilityId}-remove-package-json`, {
      removeDependencies: ownedDependencies.map((entry) => entry.name),
      removeScripts: ownedScripts.map((entry) => entry.name),
    });
  }

  if (ownedEnvVars.length > 0) {
    builder.envMutation(
      `${capabilityId}-remove-env-vars`,
      DEFAULT_ENV_EXAMPLE_PATH,
      {},
      'Remove environment variables',
      ownedEnvVars.map((entry) => entry.name)
    );
  }

  const transforms = builder.build();
  const engine = new TransformEngine();
  await engine.seedFromDisk(rootPath, transforms);
  engine.queueTransforms(transforms);

  const preview = await engine.execute({ dryRun: options.dryRun, rootDir: rootPath });

  console.log(`Capability: ${capabilityId}`);
  console.log(options.dryRun ? 'Mode: dry-run (remove)' : 'Mode: remove');
  console.log(formatTransformPlan(preview, options.dryRun));

  if (!options.dryRun) {
    const remaining: OwnershipSnapshot = {
      files: snapshot.files.filter((entry) => entry.ownerCapabilityId !== capabilityId),
      dependencies: snapshot.dependencies.filter((entry) => entry.ownerCapabilityId !== capabilityId),
      scripts: snapshot.scripts.filter((entry) => entry.ownerCapabilityId !== capabilityId),
      envVars: snapshot.envVars.filter((entry) => entry.ownerCapabilityId !== capabilityId),
      metadata: snapshot.metadata.filter((entry) => entry.ownerCapabilityId !== capabilityId),
    };

    await OwnershipMetadataStore.save(ownershipMetadataFromSnapshot(remaining), rootPath);

    const lockfile = await LockfileStore.load(rootPath);
    if (lockfile) {
      lockfile.snapshot.capabilities = lockfile.snapshot.capabilities.filter(
        (entry) => entry.id !== capabilityId
      );
      await LockfileStore.save(lockfile, rootPath);
    }
  }
}
