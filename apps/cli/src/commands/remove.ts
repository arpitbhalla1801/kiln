import { readFile, rmdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  FileHashStore,
  loadOwnershipTracker,
  LockfileStore,
  ownershipMetadataFromSnapshot,
  OwnershipMetadataStore,
} from '@kiln/project-model';
import { buildEnvRemovalTransforms, GITIGNORE_ENV_LOCAL_KEY } from '@kiln/env-capability';
import { SUPPORTED_CAPABILITY_IDS } from '@kiln/runtime';
import { createTransformPipeline, TransformEngine } from '@kiln/transform-engine';
import type { OwnershipSnapshot } from '@kiln/core';
import { formatTransformPlan } from '../output.js';
import type { CliOptions } from '../output.js';
import { resolveProjectRoot } from '../project.js';
import { findRemovalBreakage, partitionEditedFiles } from './remove-impact.js';

export async function runRemove(capabilityId: string, options: CliOptions): Promise<void> {
  if (!SUPPORTED_CAPABILITY_IDS.includes(capabilityId)) {
    throw new Error(
      `Unsupported capability '${capabilityId}'. Supported capabilities: ${SUPPORTED_CAPABILITY_IDS.join(', ')}`
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

  const ownsGitignoreLine = snapshot.metadata.some(
    (entry) => entry.ownerCapabilityId === capabilityId && entry.key === GITIGNORE_ENV_LOCAL_KEY
  );

  const ownsNothing =
    !ownsGitignoreLine &&
    ownedFiles.length === 0 &&
    ownedDependencies.length === 0 &&
    ownedScripts.length === 0 &&
    ownedEnvVars.length === 0;

  if (ownsNothing) {
    console.log(`Capability '${capabilityId}' is not applied to this project.`);
    return;
  }

  const { deletable, edited } = await partitionEditedFiles(
    rootPath,
    ownedFiles.map((entry) => entry.filePath)
  );

  const ownedScriptNames = new Set(ownedScripts.map((entry) => entry.name));
  const keptScripts = Object.fromEntries(
    Object.entries(await readScripts(rootPath)).filter(([name]) => !ownedScriptNames.has(name))
  );
  const breakage = await findRemovalBreakage(
    rootPath,
    deletable,
    ownedDependencies.map((entry) => entry.name),
    keptScripts
  );

  if (breakage.length > 0) {
    console.log(`Removing '${capabilityId}' will break code that still depends on it:`);
    for (const item of breakage) {
      console.log(`  ${item.file}: ${item.detail}`);
    }

    if (!options.dryRun && !options.force) {
      throw new Error(
        `Refusing to remove '${capabilityId}': ${breakage.length} reference(s) would break. ` +
          'Update that code first, or re-run with --force to remove anyway.'
      );
    }
  }

  const builder = createTransformPipeline();

  for (const filePath of deletable) {
    builder.fileDelete(`${capabilityId}-remove-${filePath}`, filePath);
  }

  // Take back the `.env.local` line kiln appended to .gitignore. Skipped when the user has
  // since removed or reworked it, since a patch with no match would fail.
  const gitignore = ownsGitignoreLine
    ? await readFile(join(rootPath, '.gitignore'), 'utf8').catch(() => undefined)
    : undefined;
  if (gitignore?.includes('\n.env.local\n')) {
    builder.filePatch(`${capabilityId}-remove-gitignore-line`, '.gitignore', '\n.env.local\n', '\n');
  }

  if (ownedDependencies.length > 0 || ownedScripts.length > 0) {
    const devDependencyNames = await readDevDependencyNames(rootPath);
    const removeDependencies: string[] = [];
    const removeDevDependencies: string[] = [];

    for (const entry of ownedDependencies) {
      if (devDependencyNames.has(entry.name)) {
        removeDevDependencies.push(entry.name);
      } else {
        removeDependencies.push(entry.name);
      }
    }

    builder.packageJsonMutation(`${capabilityId}-remove-package-json`, {
      removeDependencies,
      removeDevDependencies,
      removeScripts: ownedScripts.map((entry) => entry.name),
    });
  }

  const transforms = [
    ...builder.build(),
    ...(ownedEnvVars.length > 0
      ? buildEnvRemovalTransforms(ownedEnvVars.map((entry) => entry.name))
      : []),
  ];
  const engine = new TransformEngine();
  await engine.seedFromDisk(rootPath, transforms);
  engine.queueTransforms(transforms);

  const preview = await engine.execute({ dryRun: options.dryRun, rootDir: rootPath });

  console.log(`Capability: ${capabilityId}`);
  console.log(options.dryRun ? 'Mode: dry-run (remove)' : 'Mode: remove');
  console.log(formatTransformPlan(preview, options.dryRun));

  if (edited.length > 0) {
    console.log('Kept (edited since kiln wrote them, delete manually if unwanted):');
    for (const filePath of edited) {
      console.log(`  ${filePath}`);
    }
  }

  if (capabilityId === 'db') {
    console.log('Left in place: prisma/migrations, the database and its data. kiln never drops them.');
  }

  if (!options.dryRun) {
    // Removing env vars is a kiln edit to shared env files; re-baseline so a later remove still
    // recognizes them as untouched.
    const known = await FileHashStore.load(rootPath);
    const rebaselined: Record<string, string> = {};
    for (const transform of transforms) {
      if (
        (transform.type === 'env-mutation' || transform.type === 'file-patch') &&
        transform.filePath in known
      ) {
        const content = await readFile(join(rootPath, transform.filePath), 'utf8').catch(() => undefined);
        if (content !== undefined) {
          rebaselined[transform.filePath] = content;
        }
      }
    }
    await FileHashStore.update(rootPath, rebaselined, [...deletable, ...edited]);

    for (const filePath of deletable) {
      await removeEmptyParents(rootPath, filePath);
    }

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

/** Remove directories that only held the deleted file; rmdir refuses non-empty ones. */
async function removeEmptyParents(rootPath: string, filePath: string): Promise<void> {
  let directory = dirname(filePath);
  while (directory !== '.' && directory !== '/') {
    try {
      await rmdir(join(rootPath, directory));
    } catch {
      return;
    }
    directory = dirname(directory);
  }
}

async function readScripts(rootPath: string): Promise<Record<string, string>> {
  try {
    const content = await readFile(join(rootPath, 'package.json'), 'utf8');
    return (JSON.parse(content) as { scripts?: Record<string, string> }).scripts ?? {};
  } catch {
    return {};
  }
}

async function readDevDependencyNames(rootPath: string): Promise<Set<string>> {
  try {
    const content = await readFile(join(rootPath, 'package.json'), 'utf8');
    const packageJson = JSON.parse(content) as { devDependencies?: Record<string, string> };
    return new Set(Object.keys(packageJson.devDependencies ?? {}));
  } catch {
    return new Set();
  }
}
