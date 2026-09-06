import type { TransformPlan } from '@kiln/transform-engine';

export interface CliOptions {
  dryRun: boolean;
  cwd: string;
}

export function formatTransformPlan(plan: TransformPlan, dryRun: boolean): string {
  const lines: string[] = [];
  const header = dryRun ? 'Dry-run transform plan' : 'Applied transforms';
  lines.push(header);

  if (plan.summary.total === 0) {
    lines.push('  no changes');
    return lines.join('\n');
  }

  lines.push(`  created: ${plan.summary.created}`);
  lines.push(`  modified: ${plan.summary.modified}`);
  lines.push(`  deleted: ${plan.summary.deleted}`);
  lines.push(`  total: ${plan.summary.total}`);

  const sortedOperations = [...plan.operations].sort((left, right) =>
    left.filePath.localeCompare(right.filePath)
  );

  for (const operation of sortedOperations) {
    lines.push(`  ${operation.type.padEnd(7)} ${operation.filePath}`);
  }

  return lines.join('\n');
}

export function formatResolvedDependencies(dependencies: Map<string, string>): string {
  if (dependencies.size === 0) {
    return 'Dependencies: none';
  }

  const lines = ['Dependencies:'];
  for (const [name, version] of Array.from(dependencies.entries()).sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    lines.push(`  ${name}@${version}`);
  }

  return lines.join('\n');
}

export function formatCapabilityResult(
  capabilityId: string,
  dryRun: boolean,
  preview: TransformPlan,
  resolvedDependencies: Map<string, string>
): string {
  const lines = [
    `Capability: ${capabilityId}`,
    dryRun ? 'Mode: dry-run' : 'Mode: apply',
    formatTransformPlan(preview, dryRun),
    formatResolvedDependencies(resolvedDependencies),
  ];

  return lines.join('\n');
}
