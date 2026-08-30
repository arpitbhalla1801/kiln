import { OwnershipMetadataStore } from '@kiln/project-model';
import { NodeAdapter } from '@kiln/node-adapter';
import { resolveProjectRoot } from '../project.js';
import type { CliOptions } from '../output.js';

export async function runInspect(options: CliOptions): Promise<void> {
  const rootPath = await resolveProjectRoot(options.cwd);
  const adapter = new NodeAdapter();
  const inspection = await adapter.inspect(rootPath);

  console.log('Kiln project inspection');
  console.log(`  root: ${inspection.rootPath}`);
  console.log(`  name: ${inspection.packageName ?? 'unknown'}`);
  console.log(`  version: ${inspection.packageVersion ?? 'unknown'}`);
  console.log(`  packageManager: ${inspection.packageManager.kind}`);
  console.log(`  lockfile: ${inspection.filesystem.lockfile ?? 'none'}`);
  console.log(`  typescript: ${inspection.hasTypeScript ? 'yes' : 'no'}`);
  console.log(`  nextjs: ${inspection.nextjs.detected ? 'yes' : 'no'}`);

  if (inspection.nextjs.detected) {
    console.log(`  nextRouter: ${inspection.nextjs.router ?? 'unknown'}`);
    console.log(`  nextVersion: ${inspection.nextjs.version ?? 'unknown'}`);
  }

  if (await OwnershipMetadataStore.exists(rootPath)) {
    const ownership = await OwnershipMetadataStore.load(rootPath);
    console.log('Ownership:');

    const fileOwners = [...ownership.files].sort((left, right) =>
      left.filePath.localeCompare(right.filePath)
    );
    for (const entry of fileOwners) {
      console.log(`  file ${entry.filePath} -> ${entry.ownerCapabilityId}`);
    }

    const dependencyOwners = [...ownership.dependencies].sort((left, right) =>
      left.name.localeCompare(right.name)
    );
    for (const entry of dependencyOwners) {
      console.log(`  dependency ${entry.name} -> ${entry.ownerCapabilityId}`);
    }

    const envOwners = [...ownership.envVars].sort((left, right) =>
      left.name.localeCompare(right.name)
    );
    for (const entry of envOwners) {
      console.log(`  env ${entry.name} -> ${entry.ownerCapabilityId}`);
    }
  } else {
    console.log('Ownership: not initialized');
  }
}
