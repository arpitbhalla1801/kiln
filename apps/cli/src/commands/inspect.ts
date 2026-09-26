import { LockfileStore, OwnershipMetadataStore } from '@kiln/project-model';
import { NodeAdapter } from '@kiln/node-adapter';
import { SUPPORTED_CAPABILITY_IDS } from '@kiln/runtime';
import { collectChecks } from '../health.js';
import { resolveProjectRoot } from '../project.js';
import type { CliOptions } from '../output.js';

const PACKAGE_MANAGER_LABELS: Record<string, string> = { bun: 'Bun', npm: 'npm', pnpm: 'pnpm', yarn: 'Yarn' };

export async function runInspect(options: CliOptions): Promise<void> {
  const rootPath = await resolveProjectRoot(options.cwd);
  const inspection = await new NodeAdapter().inspect(rootPath);
  const ownership = (await OwnershipMetadataStore.exists(rootPath))
    ? await OwnershipMetadataStore.load(rootPath)
    : undefined;
  const snapshot = (await LockfileStore.load(rootPath))?.snapshot;
  const lockCapabilities = snapshot?.capabilities ?? [];

  const installed = new Set([
    ...lockCapabilities.map((entry) => entry.id),
    ...(ownership?.files ?? []).map((entry) => entry.ownerCapabilityId),
    ...(ownership?.dependencies ?? []).map((entry) => entry.ownerCapabilityId),
    ...(ownership?.envVars ?? []).map((entry) => entry.ownerCapabilityId),
  ]);
  const capabilityIds = [...new Set([...SUPPORTED_CAPABILITY_IDS, ...installed])];
  const lastOperation = lockCapabilities.find((entry) => entry.id === snapshot?.lastCapability);

  const framework = inspection.nextjs.detected ? 'Next.js' : 'Node';
  const packageManager = PACKAGE_MANAGER_LABELS[inspection.packageManager.kind] ?? inspection.packageManager.kind;
  const dependencies = [...new Set((ownership?.dependencies ?? []).map((entry) => entry.name))].sort();

  const checks = await collectChecks(options);
  const failing = checks.filter((check) => check.status === 'fail');
  const warnings = checks.filter((check) => check.status === 'warn');

  console.log(`Project: ${framework} + ${packageManager}`);
  console.log(`Capabilities: ${capabilityIds.map((id) => `${installed.has(id) ? '✓' : '✗'} ${id}`).join('  ')}`);
  console.log(`Managed files: ${ownership?.files.length ?? 0}`);
  console.log(`Dependencies added: ${dependencies.length > 0 ? dependencies.join(', ') : 'none'}`);
  console.log(`Last operation: ${lastOperation ? `${lastOperation.id}@${lastOperation.version}` : 'none'}`);
  console.log(`Status: ${statusLine(failing.length, warnings.length)}`);

  for (const check of [...failing, ...warnings]) {
    console.log(`  [${check.status}] ${check.name}: ${check.detail}`);
  }

  if (options.verbose && ownership) {
    console.log('Ownership:');
    for (const entry of [...ownership.files].sort((a, b) => a.filePath.localeCompare(b.filePath))) {
      console.log(`  file ${entry.filePath} -> ${entry.ownerCapabilityId}`);
    }
    for (const entry of [...ownership.dependencies].sort((a, b) => a.name.localeCompare(b.name))) {
      console.log(`  dependency ${entry.name} -> ${entry.ownerCapabilityId}`);
    }
    for (const entry of [...ownership.envVars].sort((a, b) => a.name.localeCompare(b.name))) {
      console.log(`  env ${entry.name} -> ${entry.ownerCapabilityId}`);
    }
  }
}

function statusLine(failures: number, warnings: number): string {
  if (failures > 0) {
    return `✗ unhealthy (${failures} failing)`;
  }
  return warnings > 0 ? `! ${warnings} warning(s)` : '✓ healthy';
}
