import type { FileOperation, TransformPlan } from '@kiln/transform-engine';

export interface CliOptions {
  dryRun: boolean;
  cwd: string;
  force?: boolean;
  verbose?: boolean;
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

    if (dryRun) {
      lines.push(...formatOperationDiff(operation));
    }
  }

  return lines.join('\n');
}

function formatOperationDiff(operation: FileOperation): string[] {
  const diffLines = formatLineDiff(operation.before, operation.content);
  return diffLines.map((line) => `      ${line}`);
}

/**
 * Multiset line diff: lines only in `before` show as removed, lines only in
 * `after` show as added. Groups all removals before additions rather than
 * interleaving by position -- a content preview, not a positional patch.
 */
function formatLineDiff(before: string | undefined, after: string | undefined): string[] {
  const beforeLines = splitLines(before);
  const afterLines = splitLines(after);

  const beforeCounts = countLines(beforeLines);
  const afterCounts = countLines(afterLines);

  const removedRemaining = new Map<string, number>();
  const addedRemaining = new Map<string, number>();

  for (const [line, count] of beforeCounts) {
    const common = Math.min(count, afterCounts.get(line) ?? 0);
    removedRemaining.set(line, count - common);
  }
  for (const [line, count] of afterCounts) {
    const common = Math.min(count, beforeCounts.get(line) ?? 0);
    addedRemaining.set(line, count - common);
  }

  const output: string[] = [];

  for (const line of beforeLines) {
    const remaining = removedRemaining.get(line) ?? 0;
    if (remaining > 0) {
      output.push(`- ${line}`);
      removedRemaining.set(line, remaining - 1);
    }
  }

  for (const line of afterLines) {
    const remaining = addedRemaining.get(line) ?? 0;
    if (remaining > 0) {
      output.push(`+ ${line}`);
      addedRemaining.set(line, remaining - 1);
    }
  }

  return output;
}

function splitLines(content: string | undefined): string[] {
  if (!content) {
    return [];
  }

  const lines = content.split('\n');
  if (lines[lines.length - 1] === '') {
    lines.pop();
  }

  return lines;
}

function countLines(lines: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const line of lines) {
    counts.set(line, (counts.get(line) ?? 0) + 1);
  }
  return counts;
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
