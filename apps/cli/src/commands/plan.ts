import { createCapabilityRuntime } from '@kiln/runtime';
import type { CapabilityPlanResult } from '@kiln/runtime';
import type { EnvVariableMap } from '@kiln/env-capability';
import { assertCapabilityPrerequisites, resolveEnvVariables } from './add.js';
import { formatResolvedDependencies, formatTransformPlan } from '../output.js';
import type { CliOptions } from '../output.js';
import { resolveProjectRoot } from '../project.js';

const OPERATION_SYMBOLS = { create: '+', modify: '~', delete: '-' } as const;

export async function runPlanAdd(
  capabilityId: string,
  options: CliOptions,
  envVariables: EnvVariableMap = {},
  providers: string[] = []
): Promise<void> {
  const rootPath = await resolveProjectRoot(options.cwd);
  const runtime = createCapabilityRuntime();
  await runtime.loadPlugins(rootPath);
  await assertCapabilityPrerequisites(capabilityId, rootPath);

  const variables = resolveEnvVariables(capabilityId, envVariables);

  const result = await runtime.planCapability(capabilityId, {
    cwd: rootPath,
    variables,
    providers,
    extraEnvVars: envVariables,
  });

  if (options.json) {
    console.log(JSON.stringify(toJson(result), null, 2));
    return;
  }

  console.log(`Capability: ${result.capabilityId}`);
  console.log('Mode: plan');
  console.log(formatPlanSummary(result));

  if (result.conflicts.length > 0) {
    console.log('Conflicts detected:');
    for (const conflict of result.conflicts) {
      console.log(`  ${conflict}`);
    }
    return;
  }

  console.log(formatTransformPlan(result.preview!, true));
  console.log(formatResolvedDependencies(result.resolvedDependencies));

  console.log('Ownership updates:');
  if (result.ownershipUpdates.length === 0) {
    console.log('  none');
  } else {
    for (const update of result.ownershipUpdates) {
      console.log(`  ${update}`);
    }
  }
}

/** One line per change with a stable leading symbol: + add, ~ modify, - delete, ✗ conflict. */
function formatPlanSummary(result: CapabilityPlanResult): string {
  const lines = ['Summary:'];

  for (const conflict of result.conflicts) {
    lines.push(summaryRow('✗', 'conflict', conflict));
  }

  const operations = [...(result.preview?.operations ?? [])].sort((left, right) =>
    left.filePath.localeCompare(right.filePath)
  );
  for (const operation of operations) {
    lines.push(summaryRow(OPERATION_SYMBOLS[operation.type], operation.type, operation.filePath));
  }

  for (const [name, version] of [...result.resolvedDependencies].sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    lines.push(summaryRow('+', 'dep', `${name}@${version}`));
  }

  for (const update of result.ownershipUpdates) {
    lines.push(summaryRow('+', 'owns', update));
  }

  if (lines.length === 1) {
    lines.push('  no changes');
  }

  return lines.join('\n');
}

function summaryRow(symbol: string, label: string, text: string): string {
  return `  ${symbol} ${label.padEnd(8)} ${text}`;
}

function toJson(result: CapabilityPlanResult) {
  return {
    capabilityId: result.capabilityId,
    conflicts: result.conflicts,
    operations: (result.preview?.operations ?? []).map(({ type, filePath }) => ({ type, filePath })),
    dependencies: Object.fromEntries(result.resolvedDependencies),
    ownershipUpdates: result.ownershipUpdates,
  };
}
